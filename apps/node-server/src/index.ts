import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import { ROOM_LIMITS } from '@mm/engine';
import { RoomDO } from '../../server/src/room.js';
import { soPhongTrongRam } from '../../server/src/sophong.js';
import { moKho, type Kho } from './kho-mysql.js';
import {
  MmRequestResponsePair, MmResponse, MmSocket, makePairFactory, taoBoiCanh, type RoomBox
} from './cf-shim.js';

/**
 * SERVER DỰ PHÒNG chạy trên Node — cùng luật chơi, khác chỗ đặt.
 *
 * Vì sao cần: Cloudflare đi qua POP gần người chơi, nhưng có hôm đường tới POP
 * đó lag và cả phòng lỗi. Có một bản chạy được ngay tại Hà Nội thì đổi máy chủ
 * là chơi tiếp, không phải chờ mạng ai đó hết lag.
 *
 * ĐIỂM QUAN TRỌNG NHẤT: file này KHÔNG chứa luật chơi nào. Nó nạp thẳng
 * `RoomDO` của bản Cloudflare và chỉ thay tầng bên dưới (xem cf-shim.ts). Viết
 * bản luật thứ hai cho Node là chắc chắn hai bản lệch nhau — mà lệch ở đúng
 * những chỗ đã tốn hàng loạt sự cố để tìm ra (mất mạng im lặng, bàn treo, chia
 * link, kiểm biên tuỳ chọn).
 *
 * KHÁC bản Cloudflare ở hai chỗ, cố ý:
 *  - phòng nằm trong RAM, restart là mất hết phòng đang mở (bản CF giữ được qua
 *    hibernation). Với vai trò dự phòng thì đổi lại được: không cần hạ tầng gì.
 *  - một tiến trình giữ mọi phòng, nên KHÔNG chạy nhiều bản cùng lúc trên cùng
 *    một cổng mà không có gì chia phòng — hai tiến trình sẽ thấy hai tập phòng
 *    khác nhau và người chơi vào cùng mã lại ở hai phòng riêng.
 */

/* ---------- nối shim vào chỗ build đã thay tên (xem build.mjs) ---------- */

/**
 * Socket đang trong quá trình vào phòng. room.ts gọi `new WebSocketPair()` ở
 * giữa thân `fetch()`, nên phải có chỗ để nó lấy đúng socket hiện tại.
 *
 * Một biến toàn cục là đủ vì mỗi kết nối được xử lý TRỌN VẸN trước khi nhận kết
 * nối sau: `moKetNoi` đặt biến, gọi fetch (đồng bộ tới chỗ dựng pair), rồi xoá.
 */
let socketDangVao: MmSocket | null = null;

const g = globalThis as unknown as Record<string, unknown>;
g.__mmResponse = MmResponse;
g.__mmPairRR = MmRequestResponsePair;
g.__mmPair = makePairFactory(() => {
  if (!socketDangVao) throw new Error('WebSocketPair dựng ngoài lúc vào phòng');
  return socketDangVao;
});

const PORT = Number(process.env.PORT ?? 8080);
/** Thư mục web đã build (`pnpm build`). Bỏ trống thì server chỉ chạy API. */
const WEB_DIR = process.env.WEB_DIR ?? join(process.cwd(), 'apps/web/dist');

const CODE_ALPHABET = '0123456789';
function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_LIMITS.codeLength));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/* ---------- bảng phòng của tiến trình ---------- */

interface Phong { room: RoomDO; box: RoomBox }
const phongs = new Map<string, Phong>();

/**
 * Sổ phòng công khai (ON-10) — ở Node chỉ là một Map.
 *
 * Bản Cloudflare phải dựng hẳn một Durable Object cho việc này vì ở đó KHÔNG
 * liệt kê được các DO đang sống. Node thì mọi phòng vốn đã nằm trong RAM của
 * đúng một tiến trình (replicas PHẢI là 1, xem deploy/k8s/thebai.yaml), nên
 * liệt kê chỉ là lọc một Map. Cùng interface `SoPhong`, nên `RoomDO` chạy y
 * nguyên không biết mình đang ở đâu.
 */
const soPhong = soPhongTrongRam();

/**
 * Lấy (hoặc dựng) phòng theo mã. Tương đương `env.ROOM.getByName(code)` của CF:
 * ở đó mọi mã đều "có" một Durable Object, còn phòng CÓ THẬT hay không thì
 * `exists()` mới trả lời — nên ở đây cũng dựng vô điều kiện.
 */
function layPhong(code: string, banDau?: Record<string, unknown>): Phong {
  const co = phongs.get(code);
  if (co) return co;
  let p: Phong;
  const box = taoBoiCanh(
    () => p.room.alarm(),
    () => { phongs.delete(code); kho?.xoa(code); },
    kho ? {
      luu: (duLieu, alarmLuc) => kho!.ghi(code, duLieu, alarmLuc),
      xoa: () => kho!.xoa(code)
    } : undefined,
    banDau
  );
  // `RoomDO` chỉ đọc `this.ctx`; `env` không dùng tới ở nhánh nào của Node.
  // `RoomDO` đọc `this.ctx` và `this.env.SO_PHONG` (sổ phòng công khai).
  p = { room: new RoomDO(box.ctx as never, { SO_PHONG: soPhong } as never), box };
  phongs.set(code, p);
  return p;
}

/* ---------- WebSocket ---------- */

const wss = new WebSocketServer({ noServer: true });

async function moKetNoi(code: string, url: URL, raw: WsSocket): Promise<void> {
  const { room, box } = layPhong(code);
  const ws = new MmSocket(raw);
  // `new WebSocketPair()` trong room.ts sẽ lấy đúng socket này (xem cf-shim)
  socketDangVao = ws;
  let res: { status: number; body: string | null };
  try {
    res = (await room.fetch(taoRequest(url))) as unknown as { status: number; body: string | null };
  } finally {
    socketDangVao = null;
  }
  // Phòng từ chối (mã sai, thiếu tên): nói lý do rồi đóng, đừng để client treo
  if (res.status !== 101) {
    ws.close(4404, res.body ?? 'từ chối');
    return;
  }

  raw.on('message', (data) => {
    const text = String(data);
    // Tự đáp `ping` như setWebSocketAutoResponse của CF: KHÔNG đưa vào
    // webSocketMessage, không thì mỗi nhịp tim là một lần chạy luật phòng.
    if (box.autoResponse && text === box.autoResponse.request) {
      ws.send(box.autoResponse.response);
      return;
    }
    void room.webSocketMessage(ws as never, text)
      .catch((e) => console.error('[room] lỗi xử lý tin:', e));
  });
  raw.on('close', (code2, reason) => {
    box.sockets.delete(ws);
    void room.webSocketClose(ws as never, code2, String(reason), true)
      .catch((e) => console.error('[room] lỗi khi đóng:', e));
  });
  raw.on('error', () => { box.sockets.delete(ws); });
}

/** `Request` tối giản cho room.fetch: nó chỉ đọc `url` và header Upgrade. */
function taoRequest(url: URL): Request {
  return {
    url: url.toString(),
    headers: { get: (k: string) => (k.toLowerCase() === 'upgrade' ? 'websocket' : null) }
  } as unknown as Request;
}

/* ---------- HTTP ---------- */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function json(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(body);
}

/**
 * Luật cache, PHẢI khớp `apps/web/public/_headers`.
 *
 * Vì sao phải viết lại ở đây: `_headers` là định dạng RIÊNG của Cloudflare —
 * chỉ Pages/Worker đọc nó, Node bỏ qua hoàn toàn. Thiếu chỗ này thì server Node
 * trả file tĩnh KHÔNG kèm Cache-Control, trình duyệt tự suy đoán và giữ
 * `index.html` cũ; HTML cũ trỏ tới tên asset cũ nên cả bản deploy mới thành vô
 * nghĩa. Nặng hơn: `sw.js` bị giữ lại là người chơi mắc kẹt ở service worker
 * cũ, và nó lại giữ tiếp bản cũ của mọi thứ khác. Đây là lỗi đã xảy ra thật
 * trên `thebai2.hello314.com`: ảnh mới lên pod rồi mà trình duyệt vẫn chạy bản
 * cũ.
 *
 * Sửa luật ở đây thì phải sửa cả `_headers` — hai bản cache lệch nhau là hai
 * nơi hành xử khác nhau, đúng thứ tốn hàng loạt sự cố để tìm ra.
 */
function cacheControl(file: string): string {
  // Asset có hash trong tên: nội dung đổi thì TÊN đổi, không bao giờ trả nhầm
  // bản cũ → cache một năm.
  if (/[/\\]assets[/\\]/.test(file)) return 'public, max-age=31536000, immutable';
  // Không có hash trong tên → luôn hỏi lại. no-cache chứ KHÔNG no-store:
  // no-store cấm lưu hẳn, service worker mất khả năng precache và app mất chạy
  // offline — đúng thứ PWA dựng lên để có.
  if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) return 'no-cache';
  // Ảnh và dữ liệu theme: cache ngắn rồi hỏi lại.
  if (/[/\\]data[/\\]/.test(file)) return 'public, max-age=300, must-revalidate';
  return 'no-cache';
}

/**
 * Trả file tĩnh của web đã build, và mọi đường không khớp thì trả index.html
 * (SPA fallback). `/api/*` và `/ws/*` đã được chặn TRƯỚC đó — bỏ thứ tự này ra
 * là lời gọi API nhận về index.html, đúng cái bẫy mà bản Cloudflare có test
 * canh (`run_worker_first`).
 */
async function traFileTinh(url: URL, res: ServerResponse): Promise<void> {
  const duong = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(WEB_DIR, duong);
  try {
    const st = await stat(file);
    if (st.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(WEB_DIR, 'index.html');
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': cacheControl(file),
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không thấy web đã build. Chạy `pnpm build` trước, hoặc đặt WEB_DIR.');
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  /*
   * Danh sách phòng công khai (ON-10). PHẢI đứng TRƯỚC `/api/rooms/:code` —
   * cùng lý do như bản Cloudflare (xem apps/server/src/index.ts), và hai tầng
   * HTTP này có test canh phải khớp nhau.
   */
  if (url.pathname === '/api/rooms/public' && req.method === 'GET') {
    void soPhong.liet().then((rooms) => json(res, { rooms }));
    return;
  }

  // Tạo phòng (ON-01)
  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const code = makeCode();
    void layPhong(code).room.open().then(() => json(res, { code }));
    return;
  }

  // Kiểm mã trước khi mở WebSocket, để báo lỗi rõ thay vì socket đóng im lặng
  const kiem = url.pathname.match(/^\/api\/rooms\/([0-9]{6})$/);
  if (kiem && req.method === 'GET') {
    void layPhong(kiem[1]!).room.exists().then((exists) => json(res, { exists }));
    return;
  }

  if (url.pathname === '/health') { json(res, { ok: true, rooms: phongs.size }); return; }

  void traFileTinh(url, res);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const m = url.pathname.match(/^\/ws\/([0-9]{6})$/);
  if (!m) { socket.destroy(); return; }
  const code = m[1]!;
  wss.handleUpgrade(req, socket, head, (raw) => {
    // room.ts đọc `code` từ query, giống bản Cloudflare nhét vào ở index.ts
    url.searchParams.set('code', code);
    void moKetNoi(code, url, raw).catch((e) => {
      console.error('[room] lỗi khi vào phòng:', e);
      try { raw.close(1011, 'lỗi server'); } catch { /* đã đóng */ }
    });
  });
});

/* ---------- kho bền: phòng sống sót qua cập nhật ảnh ---------- */

let kho: Kho | null = null;

/**
 * Dựng lại các phòng đã lưu, rồi mới nhận request.
 *
 * Thứ PHẢI làm cùng: đặt lại alarm. Ở CF, alarm là của Durable Object nên nó
 * sống qua mọi thứ; ở Node nó chỉ là `setTimeout`, chết theo tiến trình. Thiếu
 * bước này thì phòng khôi phục xong nằm chết — ván không tick, người rớt không
 * bao giờ bị xử, phòng rác không ai dọn. Mốc đã qua thì chạy NGAY (đặt 0), đó
 * đúng là việc lẽ ra phải làm trong lúc server đang tắt.
 *
 * KHÔNG đụng gì tới `disconnectedAt` của người chơi: sau khởi động lại không
 * còn socket nào, mà `connected()` đã tính cả điều kiện "có socket" nên tự khắc
 * đúng. Việc phát hiện ai đã đi hẳn để watchdog trong room.ts lo, y như một lần
 * mất mạng bình thường — thêm luật riêng cho ca này là bắt đầu có HAI bộ luật.
 */
async function khoiPhuc(): Promise<void> {
  if (!kho) return;
  const daLuu = await kho.napTatCa();
  if (!daLuu.size) return;
  for (const [code, { duLieu, alarmLuc }] of daLuu) {
    const { box } = layPhong(code, duLieu);
    if (alarmLuc !== null) {
      void box.ctx.storage.setAlarm(Math.max(alarmLuc, Date.now()));
    }
  }
  console.log(`[kho] dựng lại ${daLuu.size} phòng từ lần chạy trước`);
}

/** Tắt êm: đẩy nốt phần đang chờ ghi, không thì mất vài giây cuối. */
for (const tin of ['SIGTERM', 'SIGINT'] as const) {
  process.on(tin, () => {
    void (async () => {
      try { await kho?.dong(); } catch { /* đang tắt */ }
      process.exit(0);
    })();
  });
}

kho = await moKho(process.env.MYSQL_URL);
await khoiPhuc();

server.listen(PORT, () => {
  console.log(`Lật Thẻ — server dự phòng chạy ở http://localhost:${PORT}`);
  console.log(`  web tĩnh: ${WEB_DIR}`);
  console.log(kho
    ? '  phòng lưu xuống MySQL: cập nhật ảnh không mất phòng đang mở'
    : '  phòng nằm trong RAM: restart là mất phòng đang mở (đặt MYSQL_URL để giữ)');
});
