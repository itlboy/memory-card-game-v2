import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat, statfs } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { cpus, freemem, loadavg, totalmem, uptime as mayChayGiay } from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import { BOARD_SIZES, ROOM_LIMITS } from '@mm/engine';
import { RoomDO } from '../../server/src/room.js';
import { soPhongTrongRam } from '../../server/src/sophong.js';
import { moKho, type Kho } from './kho-mysql.js';
import { moTaiKhoan, type TaiKhoan } from './taikhoan.js';
import { moThongBao, type ThongBao } from './thongbao.js';
import { moSanh, type XemPhong } from './sanh.js';
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
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/* ---------- bảng phòng của tiến trình ---------- */

interface Phong { room: RoomDO; box: RoomBox }
const phongs = new Map<string, Phong>();

/*
 * SẢNH — mời người đang online vào phòng chờ (sanh.ts). Đọc phòng thẳng từ RoomDO trong RAM (cùng cách
 * /api/ping đếm người): chỉ cần trạng thái, token chủ phòng (xác thực người mời), số người, bàn.
 */
interface PhongTho {
  status?: string; hostId?: string; config?: { level?: number };
  players?: Array<{ id: string; token: string; name: string; avatar?: string; anh?: string; may?: unknown }>;
}
const AVATAR_SANH = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐨', '🦁', '🐷', '🐧', '🐙'] as const;
const sanh = moSanh({
  avatars: AVATAR_SANH,
  // taiKhoan mở SAU (await) — đọc lúc gọi, không lúc dựng
  xacDinh: (khach, token) => taiKhoan?.aiTu(khach, token) ?? null,
  xemPhong(ma: string): XemPhong | null {
    const r = (phongs.get(ma)?.room as unknown as { room?: PhongTho } | undefined)?.room;
    const chu = r?.players?.find((p) => p.id === r.hostId);
    if (!r || !chu) return null;
    const cap = BOARD_SIZES.find((b) => b.level === r.config?.level);
    return {
      status: r.status ?? '', hostToken: chu.token,
      host: { ten: chu.name, mat: chu.avatar ?? '🙂', ...(chu.anh ? { anh: chu.anh } : {}) },
      nguoi: r.players?.length ?? 0, toiDa: ROOM_LIMITS.maxPlayers, soThe: cap ? cap.pairs * 2 : 0
    };
  }
});

/**
 * Sổ phòng công khai (ON-10) — ở Node chỉ là một Map.
 *
 * Bản Cloudflare phải dựng hẳn một Durable Object cho việc này vì ở đó KHÔNG
 * liệt kê được các DO đang sống. Node thì mọi phòng vốn đã nằm trong RAM của
 * đúng một tiến trình (replicas PHẢI là 1, xem deploy/k8s/thebai.yaml), nên
 * liệt kê chỉ là lọc một Map. Cùng interface `SoPhong`, nên `RoomDO` chạy y
 * nguyên không biết mình đang ở đâu.
 */
const soPhongGoc = soPhongTrongRam();
/**
 * Bọc sổ phòng để báo "có phòng mới" (thongbao.ts). Chỉ móc ở `khai` — mọi phòng công khai
 * đều đi qua đây. `phongMoi` tự bỏ mã đã báo, nên phòng khai lại mỗi 5 phút không gửi lại.
 * `batBao` chỉ bật SAU `khoiPhuc()`: dựng lại phòng lúc khởi động cũng khai lên sổ, mà đó
 * không phải phòng mới.
 */
let batBao = false;
/**
 * PHÒNG THỬ (18.11.2026): tạo bằng `POST /api/rooms?thu=1` (tools/phong-thu.mjs). KHÔNG lên danh sách
 * công khai (người thật không lỡ vào) và KHÔNG bắn thông báo "có phòng mới"; log `[ws]` gắn "(thử)".
 * Chỉ nhớ trong RAM — server khởi động lại thì phòng thử còn sống sẽ thành phòng thường, nhưng
 * `batBao` tắt lúc dựng lại nên vẫn không báo; phòng thử sống vài phút nên chuyện đó hầu như không gặp.
 */
const phongThu = new Set<string>();
const soPhong: typeof soPhongGoc = {
  ...soPhongGoc,
  async khai(phong) {
    if (phongThu.has(phong.code)) return;
    await soPhongGoc.khai(phong);
    // Phòng ĐANG CHƠI cũng khai lên sổ (để người khác vào xem) — không phải "phòng mới" để báo
    if (batBao && thongBao && !phong.dangChoi && phong.nguoi < phong.toiDa) {
      thongBao.phongMoi(phong, async (code) =>
        (await soPhongGoc.liet()).some((r) => r.code === code && !r.dangChoi && r.nguoi < r.toiDa));
    }
  }
};

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
    () => { phongs.delete(code); phongThu.delete(code); },
    kho ? {
      luu: (duLieu, alarmLuc) => kho!.ghi(code, duLieu, alarmLuc),
      dong: (lyDo) => kho!.dong(code, lyDo)
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

  /*
   * LOG KẾT NỐI (18.11.2026, chủ dự án: ván 3 người "hay lỗi mạng, treo" mà log trống trơn). Một dòng
   * lúc vào, một dòng lúc ra (mã đóng + bao lâu + client im bao lâu trước khi đứt), một dòng mỗi lần
   * client xin `resync` (= client thấy nghẽn: mất nhịp tim / nước đi không được xác nhận / bàn đứng im —
   * GA `online_su_co` ghi phía client). `cid` cắt 6 ký tự: đủ ghép các dòng của cùng một máy, không
   * lộ định danh. KHÔNG ghi tên người chơi. Đọc: kubectl -n thebai logs deploy/thebai-server | grep '[ws]'.
   * Mã đóng: 1000/1001 bình thường · 1005 không mã · 1006 đứt đột ngột (mạng/hệ điều hành cắt) ·
   * 4000 bị socket mới thay · 4001 tự rời · 4002 chủ huỷ · 4003 bị mời ra.
   */
  const cid = (url.searchParams.get('cid') ?? '?').slice(0, 6);
  const nhan = `${code}${phongThu.has(code) ? '(thử)' : ''} ${cid} ${url.searchParams.get('nen') ?? '?'} ${url.searchParams.get('v') ?? '?'}`;
  const vaoLuc = Date.now();
  let tinCuoi = vaoLuc;
  let soResync = 0;
  console.log(`[ws] vào ${nhan}${url.searchParams.get('token') ? ' (vào lại)' : ''} · ${box.sockets.size} socket`);

  raw.on('message', (data) => {
    const text = String(data);
    tinCuoi = Date.now();
    if (text.includes('"resync"')) { soResync++; console.log(`[ws] resync ${nhan} (lần ${soResync})`); }
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
    const giay = (ms: number): string => (ms / 1000).toFixed(1);
    console.log(`[ws] ra ${nhan} mã ${code2}${String(reason) ? ` "${String(reason).slice(0, 40)}"` : ''} sau ${giay(Date.now() - vaoLuc)}s · client im ${giay(Date.now() - tinCuoi)}s · resync ${soResync} · còn ${box.sockets.size} socket`);
    void room.webSocketClose(ws as never, code2, String(reason), true)
      .catch((e) => console.error('[room] lỗi khi đóng:', e));
  });
  raw.on('error', (e) => { box.sockets.delete(ws); console.log(`[ws] lỗi ${nhan}: ${(e as Error).message}`); });
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
  '.zip': 'application/zip',   // gói cập nhật nóng /ota/*.zip
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',   // ảnh trang công khai (site/img)
  '.xml': 'application/xml; charset=utf-8',   // sitemap.xml (SEO)
  '.txt': 'text/plain; charset=utf-8',   // robots.txt
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
  // Gói cập nhật nóng: tên = <bản app>-<giờ dựng>.zip, nội dung một tên KHÔNG BAO
  // GIỜ đổi → cache vĩnh viễn, Cloudflare giữ hộ. Bản cũ trả no-cache: CF báo
  // EXPIRED mỗi lần và kéo nguyên 3 MB từ pod cho từng máy cập nhật (đo
  // 15.10.2026). manifest.json thì KHÔNG: nó là thứ báo "có gói mới".
  if (/[/\\]ota[/\\][^/\\]+\.zip$/.test(file)) return 'public, max-age=31536000, immutable';
  // tải chênh lệch: file theo sha256 + danh sách file của từng bản — không bao giờ đổi nội dung
  if (/[/\\]ota[/\\](f[/\\][0-9a-f]{64}(\.[a-z0-9]+)?|[^/\\]+\.files\.json)$/.test(file)) return 'public, max-age=31536000, immutable';
  // Không có hash trong tên → luôn hỏi lại. no-cache chứ KHÔNG no-store:
  // no-store cấm lưu hẳn, service worker mất khả năng precache và app mất chạy
  // offline — đúng thứ PWA dựng lên để có.
  if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) return 'no-cache';
  // Ảnh và dữ liệu theme: cache ngắn rồi hỏi lại.
  if (/[/\\](data|site)[/\\]/.test(file)) return 'public, max-age=300, must-revalidate';
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
    // /ota/* KHÔNG có trong ảnh (18.10.2026 — Worker phục vụ cập nhật nóng): thiếu file phải là
    // 404 THẬT, không SPA fallback — app đọc index.html thành manifest là hỏng (luật CLAUDE.md)
    if (url.pathname.startsWith('/ota/')) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('not found'); return; }
    file = join(WEB_DIR, 'index.html');
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      // apple-app-site-association không có đuôi nhưng là JSON (link mời mở app)
      'Content-Type': MIME[extname(file)] ?? (file.endsWith('apple-app-site-association') ? MIME['.json'] : 'application/octet-stream'),
      'Cache-Control': cacheControl(file),
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không thấy web đã build. Chạy `pnpm build` trước, hoặc đặt WEB_DIR.');
  }
}

/**
 * Đọc URL của request — KHÔNG ĐƯỢC NÉM. `new URL()` ném với Host / đường dẫn dị dạng, và ném trong
 * handler của http.Server là SẬP CẢ TIẾN TRÌNH: mọi phòng online đứt (bắt được 19.10.2026 khi công cụ
 * đo gửi request lạ vào server thử). Hỏng thì trả null → 400 / huỷ socket.
 */
function docUrl(req: IncomingMessage): URL | null {
  try { return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); } catch { /* Host lạ */ }
  try { return new URL(req.url ?? '/', 'http://localhost'); } catch { return null; }
}


/*
 * /api/ping — TỰ KIỂM SÂU (20.11.2026, chủ dự án: "trả về thông tin bản build, kiểm tra cả kết nối mysql, ổ cứng gần
 * đầy cũng báo lỗi"). `/health` chỉ nói tiến trình còn sống; cái này trả lời "server có ĐANG LÀM VIỆC ĐƯỢC không".
 * `ok:false` + HTTP 503 khi: có cấu hình MySQL mà truy vấn hỏng/chậm, ổ đĩa còn dưới ngưỡng, hoặc RAM sắp chạm trần.
 * Không lộ gì nhạy cảm: không tên máy, không chuỗi kết nối, không đường dẫn. Kết quả giữ 5 giây (gọi dồn không
 * đập vào DB).
 */
declare const __BAN_BUILD__: { ban: string; commit: string };
const BAT_DAU = Date.now();
/* Độ trễ vòng sự kiện (event loop) — bộ đếm có sẵn của Node, lấy mẫu mỗi 20 ms, gần như không tốn gì. Trễ cao =
 * server bận tới mức nước đi của người chơi phải xếp hàng. Đặt lại sau mỗi lần đọc → số là của khoảng giữa hai lần ping. */
const TRE_VONG_MAU_MS = 20;
const treVong = monitorEventLoopDelay({ resolution: TRE_VONG_MAU_MS });
treVong.enable();
let cpuTruoc = { luc: Date.now(), dung: process.cpuUsage() };
/** Ổ còn dưới ngưỡng này (theo % HOẶC theo MB, cái nào chạm trước) là báo lỗi. */
const O_TRONG_TOI_THIEU_PHAN_TRAM = 10;
const O_TRONG_TOI_THIEU_MB = 500;
/** RAM tiến trình chạm bấy nhiêu % trần cgroup (mem_limit / limits.memory) là báo lỗi — sắp bị OOM kill. */
const RAM_TOI_DA_PHAN_TRAM = 90;
let kiemCache: { luc: number; kq: Promise<Record<string, unknown> & { ok: boolean }> } | null = null;

function tranRam(): number | null {
  for (const f of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const v = readFileSync(f, 'utf8').trim();
      const n = Number(v);
      if (v !== 'max' && Number.isFinite(n) && n > 0 && n < 2 ** 50) return n;
    } catch { /* không có cgroup này */ }
  }
  return null;
}

function kiemSucKhoe(): Promise<Record<string, unknown> & { ok: boolean }> {
  if (kiemCache && Date.now() - kiemCache.luc < 5000) return kiemCache.kq;
  const kq = (async () => {
    const loi: string[] = [];
    // MySQL: SELECT 1 có hạn 2 giây. Không cấu hình MySQL thì không coi là lỗi (bản thử không DB).
    let mysql: Record<string, unknown> = { coCauHinh: !!process.env.MYSQL_URL, ketNoi: !!kho };
    if (process.env.MYSQL_URL) {
      if (!kho) { loi.push('mysql: không kết nối (đang chạy bằng RAM)'); }
      else {
        const t0 = performance.now();
        try {
          await Promise.race([
            kho.pool.query('SELECT 1'),
            new Promise((_, tu) => setTimeout(() => tu(new Error('quá 2 giây')), 2000))
          ]);
          mysql = { ...mysql, ok: true, ms: Math.round(performance.now() - t0) };
        } catch (e) {
          mysql = { ...mysql, ok: false };
          loi.push(`mysql: ${(e as Error).message.slice(0, 80)}`);
        }
      }
    }
    // Ổ đĩa: statfs của / trong container = ổ thật của máy (overlay nằm trên đó).
    let o: Record<string, unknown> = {};
    try {
      const st = await statfs('/');
      const tong = st.blocks * st.bsize, trong = st.bavail * st.bsize;
      const pt = Math.round((trong / tong) * 1000) / 10;
      o = { tongMB: Math.round(tong / 1048576), trongMB: Math.round(trong / 1048576), trongPhanTram: pt };
      if (pt < O_TRONG_TOI_THIEU_PHAN_TRAM || trong < O_TRONG_TOI_THIEU_MB * 1048576) loi.push(`ổ đĩa: còn ${o.trongMB} MB (${pt}%)`);
    } catch { o = { loi: 'không đọc được' }; }
    // RAM: RSS tiến trình so với trần cgroup; kèm RAM trống của máy để tham khảo.
    const rss = process.memoryUsage().rss, tran = tranRam();
    const ram: Record<string, unknown> = {
      tienTrinhMB: Math.round(rss / 1048576),
      tranMB: tran ? Math.round(tran / 1048576) : null,
      mayTrongMB: Math.round(freemem() / 1048576),
      mayTongMB: Math.round(totalmem() / 1048576)
    };
    if (tran && (rss / tran) * 100 >= RAM_TOI_DA_PHAN_TRAM) loi.push(`ram: tiến trình ${ram.tienTrinhMB}/${ram.tranMB} MB`);
    const heap = process.memoryUsage();
    ram.heapMB = Math.round(heap.heapUsed / 1048576);
    ram.heapTongMB = Math.round(heap.heapTotal / 1048576);
    // CPU của TIẾN TRÌNH trong khoảng từ lần ping trước (% của một nhân)
    const bayGio = Date.now(), dung = process.cpuUsage(cpuTruoc.dung);
    const cpuPhanTram = Math.round(((dung.user + dung.system) / 1000 / Math.max(1, bayGio - cpuTruoc.luc)) * 1000) / 10;
    cpuTruoc = { luc: bayGio, dung: process.cpuUsage() };
    // Số Node đo GỒM cả chu kỳ lấy mẫu (rảnh vẫn ra ~20 ms) → trừ đi cho ra phần TRỄ THẬT
    const treMs = (ns: number): number => Math.max(0, Math.round((ns / 1e6 - TRE_VONG_MAU_MS) * 10) / 10);
    const vong = { tbMs: treMs(treVong.mean), p99Ms: treMs(treVong.percentile(99)), maxMs: treMs(treVong.max) };
    treVong.reset();
    if (vong.p99Ms > 500) loi.push(`vòng sự kiện: p99 ${vong.p99Ms} ms`);
    let soSocket = 0, soNguoi = 0, dangChoi = 0;
    for (const ph of phongs.values()) {
      const r = (ph.room as unknown as { room?: { status?: string; players?: unknown[] } }).room;
      if (r?.status === 'playing') dangChoi++;
      soNguoi += r?.players?.length ?? 0;
    }
    try { soSocket = wss.clients.size; } catch { /* chưa có */ }
    return {
      ok: loi.length === 0,
      loi,
      ban: __BAN_BUILD__.ban,
      commit: __BAN_BUILD__.commit,
      node: process.version,
      chayGiay: Math.round((Date.now() - BAT_DAU) / 1000),
      mayChayGiay: Math.round(mayChayGiay()),
      phong: { trongRam: phongs.size, dangChoi, nguoi: soNguoi, socket: soSocket, sanh: sanh.soKetNoi() },
      cpu: { tienTrinhPhanTram: cpuPhanTram, soNhan: cpus().length },
      vongSuKien: vong,
      taiKhoan: !!taiKhoan,
      thongBao: !!thongBao,
      mysql,
      oDia: o,
      ram,
      tai: loadavg().map((x) => Math.round(x * 100) / 100),
      luc: new Date().toISOString()
    };
  })();
  kiemCache = { luc: Date.now(), kq };
  return kq;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = docUrl(req);
  if (!url) { res.writeHead(400); res.end(); return; }

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  /*
   * Danh sách phòng công khai (ON-10). PHẢI đứng TRƯỚC `/api/rooms/:code` —
   * cùng lý do như bản Cloudflare (xem apps/server/src/index.ts), và hai tầng
   * HTTP này có test canh phải khớp nhau.
   */
  if (url.pathname === '/api/rooms/public' && req.method === 'GET') {
    // Phòng ĐANG CHƠI chỉ cho client khai `?v=2` (client cũ vẽ nó như phòng còn chỗ) — PublicRoom.dangChoi
    const v2 = url.searchParams.get('v') === '2';
    void soPhong.liet().then((rooms) => json(res, { rooms: rooms.filter((r) => v2 || !r.dangChoi) }));
    return;
  }

  // Tạo phòng (ON-01)
  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const code = makeCode();
    if (url.searchParams.get('thu') === '1') phongThu.add(code);
    const tb = url.searchParams.get('tb');
    if (tb && thongBao) thongBao.ghiChuPhong(code, tb);
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

  // Tự kiểm sâu cho giám sát (UptimeRobot): bản build, MySQL, ổ đĩa, RAM — lỗi thì 503 + ok:false. Xem `kiemSucKhoe`.
  // Sảnh (mời người online) — trước tầng tài khoản vì cùng tiền tố /api/
  if (sanh.xuLyHttp(req, res, url)) return;

  if (url.pathname === '/api/ping' && req.method === 'GET') {
    void kiemSucKhoe().then((k) => json(res, k, k.ok ? 200 : 503));
    return;
  }

  /*
   * Tài khoản (đăng nhập Google, điểm, danh hiệu) — CHỈ Ở BẢN NODE, và chỉ khi
   * có MySQL + GOOGLE_CLIENT_ID/APPLE_*. Không có thì `taiKhoan` là null và các đường
   * `/api/auth/*`, `/api/me*`, `/api/bxh` rơi xuống 404 của fallback tĩnh —
   * client dò `/api/auth/config` lúc mở app để biết mà giấu nút đăng nhập.
   */
  // Thông báo "có phòng mới" — cũng chỉ ở bản Node, thiếu cấu hình thì 404 và client giấu chuông.
  if (thongBao && url.pathname.startsWith('/api/thongbao')) {
    void thongBao.xuLy(req, res, url, json).then((daXuLy) => {
      if (!daXuLy) json(res, { error: 'Không có đường này' }, 404);
    }).catch((e) => {
      console.error('[thongbao] lỗi:', (e as Error).message);
      if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500);
    });
    return;
  }

  if (taiKhoan && url.pathname.startsWith('/api/')) {
    void taiKhoan.xuLy(req, res, url, json).then((daXuLy) => {
      if (!daXuLy) json(res, { error: 'Không có đường này' }, 404);
    }).catch((e) => {
      console.error('[taikhoan] lỗi:', (e as Error).message);
      if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500);
    });
    return;
  }

  // Tên miền server riêng (`<game>-api.*`) CHỈ là API: không phát web — web ở Worker tên game.
  if (/-api\./.test(url.hostname)) { json(res, { error: 'Không có đường này' }, 404); return; }
  void traFileTinh(url, res);
});

server.on('upgrade', (req, socket, head) => {
  const url = docUrl(req);
  if (!url) { socket.destroy(); return; }
  if (sanh.nhanUpgrade(req, url, socket, head)) return;
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
let taiKhoan: TaiKhoan | null = null;
let thongBao: ThongBao | null = null;

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
    // Ván bị dừng lúc pod cũ tắt (deploy) → chạy tiếp, dời mốc đúng bằng khoảng đã tắt
    await layPhong(code).room.chayTiepSauKhoiDong(Date.now()).catch((e) => console.error('[kho] chạy tiếp ván lỗi:', code, e));
  }
  console.log(`[kho] dựng lại ${daLuu.size} phòng từ lần chạy trước`);
}

/**
 * Tắt êm: đẩy nốt phần đang chờ ghi, rồi thoát.
 *
 * CÓ HẠN CHỜ, và đó là phần quan trọng: `dongKho()` chờ database nuốt nốt lô
 * cuối, nhưng nếu database không phản hồi thì nó chờ MÃI. Đo được: treo
 * MariaDB lại rồi gửi SIGTERM — tiến trình sống thêm 22 giây trước khi
 * Kubernetes phải SIGKILL. Mà mỗi giây đó là một giây phòng online đứt, vì
 * `Recreate` chờ pod cũ biến mất hẳn rồi mới dựng pod mới.
 *
 * 1,5 giây là quá đủ cho một lô ghi bình thường (gom 300ms, vài câu lệnh trên
 * mạng nội bộ). Quá hạn thì bỏ, thoát luôn: mất vài trăm mili giây cuối của
 * một phòng còn hơn giữ cả server không chết.
 */
const HAN_TAT_MS = 1500;
let dangTat = false;
for (const tin of ['SIGTERM', 'SIGINT'] as const) {
  process.on(tin, () => {
    // Nhấn Ctrl+C hai lần, hoặc k8s gửi lại tín hiệu: đừng chạy chồng
    if (dangTat) { process.exit(0); return; }
    dangTat = true;
    void (async () => {
      try {
        await Promise.race([
          (async () => {
            // 1) DỪNG đồng hồ mọi ván đang chơi rồi lưu — pod mới dời mốc, không ai mất lượt vì deploy
            const luc = Date.now();
            await Promise.all([...phongs.values()].map((p) => p.room.dungDeKhoiDongLai(luc).catch(() => undefined)));
            // 2) Báo NGAY mọi máy (1012 = server khởi động lại): client nối lại mỗi 0,5 giây thay
            //    vì phát hiện chậm qua nhịp tim (mạng di động hay giữ socket "chết mà vẫn mở")
            for (const c of wss.clients) { try { c.close(1012, 'restart'); } catch { /* đã đóng */ } }
            sanh.dong();
            // 3) Đẩy nốt phần đang chờ ghi xuống MySQL
            await (kho?.dongKho() ?? Promise.resolve());
          })(),
          new Promise((r) => setTimeout(r, HAN_TAT_MS))
        ]);
      } catch { /* đang tắt, kệ */ }
      process.exit(0);
    })();
  });
}

kho = await moKho(process.env.MYSQL_URL);
taiKhoan = await moTaiKhoan(kho?.pool ?? null, process.env).catch((e) => {
  console.error('[taikhoan] không mở được tầng tài khoản:', (e as Error).message);
  return null;
});
taiKhoan?.datOnline((ai) => sanh.trangThai(ai));
console.log(taiKhoan
  ? `  tài khoản: BẬT (${[process.env.GOOGLE_CLIENT_ID && 'Google', (process.env.APPLE_BUNDLE_ID || process.env.APPLE_SERVICES_ID) && 'Apple'].filter(Boolean).join(' + ')})`
  : '  tài khoản: TẮT (cần MYSQL_URL + GOOGLE_CLIENT_ID và/hoặc APPLE_BUNDLE_ID)');
thongBao = await moThongBao(kho?.pool ?? null, process.env).catch((e) => {
  console.error('[thongbao] không mở được:', (e as Error).message);
  return null;
});
console.log(thongBao
  ? '  thông báo phòng mới: BẬT'
  : '  thông báo phòng mới: TẮT (cần MYSQL_URL + APNS_* và/hoặc FCM_SERVICE_ACCOUNT)');
await khoiPhuc();
batBao = true;

server.listen(PORT, () => {
  console.log(`Lật Thẻ — server dự phòng chạy ở http://localhost:${PORT}`);
  console.log(`  web tĩnh: ${WEB_DIR}`);
  console.log(kho
    ? '  phòng lưu xuống MySQL: cập nhật ảnh không mất phòng đang mở'
    : '  phòng nằm trong RAM: restart là mất phòng đang mở (đặt MYSQL_URL để giữ)');
});
