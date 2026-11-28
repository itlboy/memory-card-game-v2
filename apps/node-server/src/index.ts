import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect as netConnect } from 'node:net';
import type { Duplex } from 'node:stream';
import { createHash } from 'node:crypto';
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
import { moTkThiDau, type TkThiDau } from './tk-thidau.js';
import { moTkTen } from './tk-ten.js';
import { moCum, type Cum } from './cum.js';
import { chonPod } from './chon-pod.js';
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
 *  - không REDIS_URL: một tiến trình giữ mọi phòng — KHÔNG chạy hai bản, chúng thấy hai tập phòng khác nhau.
 *    Có REDIS_URL (28.11.2026): chạy NHIỀU pod, mỗi phòng một pod chủ, pod khác chuyển tiếp — xem cum.ts.
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
  players?: Array<{ id: string; token: string; name: string; avatar?: string; anh?: string; mau?: string; may?: unknown }>;
}
/**
 * GHÉP TRẬN THI ĐẤU TỰ ĐỘNG — TẠM TẮT từ 22.11.2026 (chủ dự án: "tạm thời tắt chế độ ghép trận tự động đi, nó có vẻ hơi
 * phiền mà hiệu quả không cao"). Code giữ nguyên; bật lại bằng biến môi trường `THI_DAU=1` ở server (không cần bản app mới).
 */
const THI_DAU_BAT = process.env.THI_DAU === '1';
const AVATAR_SANH = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐨', '🦁', '🐷', '🐧', '🐙'] as const;
const sanh = moSanh({
  avatars: AVATAR_SANH,
  // taiKhoan mở SAU (await) — đọc lúc gọi, không lúc dựng
  xacDinh: (khach, token) => taiKhoan?.aiTu(khach, token) ?? null,
  // THI ĐẤU (thidau.ts): sảnh ghép người rồi nhờ lập phòng không chủ, bàn đã chốt số thẻ.
  // TẠM TẮT (22.11.2026, xem THI_DAU_BAT): không trao hàm này thì sảnh không dựng thi đấu — không ai bị hỏi, không tin đẩy
  // thi đấu, lời chào không kèm `td:1` nên app tự ẩn công tắc "Gợi ý thi đấu".
  ...(THI_DAU_BAT ? {
    async taoPhongThiDau(soThe: number, n: number): Promise<string | null> {
      const cap = BOARD_SIZES.find((b) => b.pairs * 2 === soThe);
      if (!cap) return null;
      const code = await maMoi();
      await layPhong(code).room.openThiDau(code, cap.level, n);
      return code;
    }
  } : {}),
  ghiThiDau: (loai, nguoi, d) => tkThiDau?.ghi(loai, nguoi, d),
  diemTuanThiDau: async (ai) => (await taiKhoan?.diemTuan(ai)) ?? {},
  baoChoThiDau: (ten) => thongBao?.choThiDau(ten, () => sanh.thiDau().cho > 0),
  datPushThiDau: (token, bat) => thongBao?.datThiDau(token, bat),
  async xemPhong(ma: string): Promise<XemPhong | null> {
    const tai = xemPhongTaiCho(ma);
    if (tai || !cum) return tai;
    // Nhiều pod: phòng nằm ở pod khác → hỏi pod chủ qua đường nội bộ
    const chu = await cum.chuCua(ma);
    if (!chu || chu === 'toi') return null;
    try {
      const r = await fetch(`${chu.diaChi}/_noi/xem/${ma}`, { headers: { 'x-lt-noi': NOI_KEY }, signal: AbortSignal.timeout(3000) });
      return r.ok ? (await r.json() as XemPhong | null) : null;
    } catch { return null; }
  }
});

/** Thông tin phòng cho sảnh, đọc từ RoomDO trong RAM của pod này. */
function xemPhongTaiCho(ma: string): XemPhong | null {
    const r = (phongs.get(ma)?.room as unknown as { room?: PhongTho } | undefined)?.room;
    const chu = r?.players?.find((p) => p.id === r.hostId);
    if (!r || !chu) return null;
    const cap = BOARD_SIZES.find((b) => b.level === r.config?.level);
    return {
      status: r.status ?? '', hostToken: chu.token,
      host: { ten: chu.name, mat: chu.avatar ?? '🙂', ...(chu.anh ? { anh: chu.anh } : {}), ...(chu.mau ? { mau: chu.mau } : {}) },
      nguoi: r.players?.length ?? 0, toiDa: ROOM_LIMITS.maxPlayers, soThe: cap ? cap.pairs * 2 : 0
    };
}

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
/** Nhiều pod: sổ nằm ở Redis (chung cả cụm); một pod: Map trong RAM như cũ. Chọn lúc gọi vì `cum` mở sau (await). */
const soGoc = (): typeof soPhongGoc => cum?.soPhong ?? soPhongGoc;
const soPhong: typeof soPhongGoc = {
  khai: async (phong) => {
    if (phongThu.has(phong.code)) return;
    await soGoc().khai(phong);
    // Phòng ĐANG CHƠI cũng khai lên sổ (để người khác vào xem) — không phải "phòng mới" để báo
    if (batBao && thongBao && !phong.dangChoi && phong.nguoi < phong.toiDa) {
      // Nhiều pod: phòng đổi pod (deploy / pod chết) thì pod mới khai lại — chỉ báo MỘT lần cho cả cụm
      if (cum && !(await cum.lanDau('bao', phong.code, 6 * 3600))) return;
      thongBao.phongMoi(phong, async (code) =>
        (await soGoc().liet()).some((r) => r.code === code && !r.dangChoi && r.nguoi < r.toiDa));
    }
  },
  xoa: (code) => soGoc().xoa(code),
  liet: () => soGoc().liet()
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
    () => {
      phongs.delete(code); phongThu.delete(code);
      // Nhiều pod: phòng đóng hẳn → thôi giữ mã, SAU khi lệnh đóng đã xuống MySQL (pod khác nạp nhầm phòng chưa đóng là sống lại)
      if (cum && dangGiu.delete(code)) void (kho?.dayNgay() ?? Promise.resolve()).then(() => cum?.nha(code)).catch(() => undefined);
    },
    kho ? {
      luu: (duLieu, alarmLuc) => kho!.ghi(code, duLieu, alarmLuc),
      dong: (lyDo) => kho!.dong(code, lyDo)
    } : undefined,
    banDau
  );
  // `RoomDO` chỉ đọc `this.ctx`; `env` không dùng tới ở nhánh nào của Node.
  // `RoomDO` đọc `this.ctx` và `this.env.SO_PHONG` (sổ phòng công khai).
  p = { room: new RoomDO(box.ctx as never, { SO_PHONG: soPhong, TD_GHI: (kind: string, d: Record<string, unknown>) => tkThiDau?.ghi(kind, null, d) } as never), box };
  phongs.set(code, p);
  return p;
}

/* ---------- WebSocket ---------- */

const wss = new WebSocketServer({ noServer: true });

/* ---------- NHIỀU POD (cum.ts) ---------- */

/** Mở sau (await, cuối file). null = một pod, mọi đường đi y như cũ. */
let cum: Cum | null = null;
/** Mã các phòng pod này đang GIỮ (đã giành khoá + đã nạp). */
const dangGiu = new Set<string>();
/** Pod này đang giữ sảnh. */
let sanhCuaToi = false;
/** Đang nạp phòng từ MySQL — hai request cùng lúc cho một mã chỉ nạp một lần. */
const dangNap = new Map<string, Promise<boolean>>();
/** Khoá đường nội bộ giữa các pod (`/_noi/*`), suy từ AUTH_SECRET — mọi pod cùng .env nên cùng khoá. */
const NOI_KEY = createHash('sha256').update(`lt-noi:${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 32);

/** Mã phòng mới: một pod thì bốc là xong; nhiều pod thì phải GIÀNH được khoá (chống hai pod cấp trùng mã). */
async function maMoi(): Promise<string> {
  for (let lan = 0; ; lan++) {
    const code = makeCode();
    if (!cum) return code;
    if (phongs.has(code)) continue;
    if (await cum.gianh(code)) { dangGiu.add(code); return code; }
    if (lan > 20) throw new Error('không cấp được mã phòng');
  }
}

/** Nạp phòng đã giành được khoá từ MySQL vào RAM. false = không có phòng đang sống mang mã này. */
function napVe(code: string): Promise<boolean> {
  const dang = dangNap.get(code);
  if (dang) return dang;
  const viec = (async () => {
    const co = await kho?.napMot(code);
    if (!co) return false;
    if (cum && await cum.laThu(code)) phongThu.add(code);
    const { box, room } = layPhong(code, co.duLieu);
    dangGiu.add(code);
    void box.ctx.storage.setAlarm(co.alarmLuc !== null ? Math.max(co.alarmLuc, Date.now()) : Date.now() + 1_000);
    await room.chayTiepSauKhoiDong(Date.now()).catch((e) => console.error('[cum] chạy tiếp ván lỗi:', code, e));
    console.log(`[cum] nhận phòng ${code}`);
    return true;
  })().finally(() => dangNap.delete(code));
  dangNap.set(code, viec);
  return viec;
}

type DuongDi = 'toi' | 'khong' | 'ban' | { diaChi: string };
/**
 * Phòng `code` được xử lý ở đâu: 'toi' (pod này) · { diaChi } (chuyển tiếp) · 'khong' (không có phòng) · 'ban'
 * (đang chuyển chủ / pod đang tắt — client thử lại). `daChuyen`: request đã đi qua một pod rồi — không chuyển tiếp
 * lần nữa (hai pod đá bóng qua lại khi khoá đang đổi chủ).
 */
async function duongDiPhong(code: string, daChuyen: boolean): Promise<DuongDi> {
  if (!cum) return 'toi';
  if (dangGiu.has(code) && phongs.has(code)) return 'toi';
  for (let lan = 0; lan < 3; lan++) {
    const chu = await cum.chuCua(code);
    if (chu && chu !== 'toi') return daChuyen ? 'ban' : chu;
    if (dangTat) return 'ban';
    if (chu === 'toi' || await cum.gianh(code)) {
      if (dangGiu.has(code) && phongs.has(code)) return 'toi';
      if (await napVe(code)) return 'toi';
      await cum.nha(code);
      return 'khong';
    }
  }
  return 'ban';
}

/** Sảnh nằm ở pod nào (cùng luật như một phòng, tên `sanh`). */
async function duongDiSanh(daChuyen: boolean): Promise<Exclude<DuongDi, 'khong'>> {
  if (!cum || sanhCuaToi) return 'toi';
  for (let lan = 0; lan < 2; lan++) {
    const chu = await cum.chuCua('sanh');
    if (chu && chu !== 'toi') return daChuyen ? 'ban' : chu;
    if (dangTat) return 'ban';
    if (chu === 'toi' || await cum.gianh('sanh')) { sanhCuaToi = true; console.log('[cum] nhận sảnh'); return 'toi'; }
  }
  return 'ban';
}

/** Mất quyền giữ phòng (pod khác đã giành — pod này treo quá hạn): bỏ khỏi RAM NGAY, không ghi gì nữa. */
function boPhong(code: string): void {
  const p = phongs.get(code);
  dangGiu.delete(code);
  kho?.quen(code);
  if (!p) return;
  p.box.nha();
  phongs.delete(code);
  phongThu.delete(code);
  for (const s of [...p.box.sockets]) { try { s.close(1012, 'restart'); } catch { /* đã đóng */ } }
  console.log(`[cum] mất phòng ${code} — pod khác đã giữ`);
}

/** Quét phòng MỒ CÔI (pod giữ đã chết, chưa ai vào lại): giành về để đồng hồ / dọn phòng còn chạy. */
async function quetMoCoi(): Promise<void> {
  if (!cum || !kho || dangTat) return;
  try {
    for (const code of await kho.dsMa()) {
      if (dangTat) return;
      if (dangGiu.has(code)) continue;
      if ((await cum.chuCua(code)) === null) await duongDiPhong(code, false);
    }
  } catch (e) { console.error('[cum] quét mồ côi lỗi:', (e as Error).message); }
}

const daChuyen = (req: IncomingMessage): boolean => !!req.headers['x-lt-chuyen'];

/** Chuyển tiếp một request HTTP sang pod chủ (giữ nguyên Host / thân / header). */
function chuyenHttp(req: IncomingMessage, res: ServerResponse, diaChi: string): void {
  const u = new URL(req.url ?? '/', diaChi);
  const di = httpRequest(u, { method: req.method, headers: { ...req.headers, 'x-lt-chuyen': cum?.pod ?? '1' } }, (ve) => {
    res.writeHead(ve.statusCode ?? 502, ve.headers);
    ve.pipe(res);
  });
  di.setTimeout(15_000, () => di.destroy(new Error('quá hạn')));
  di.on('error', () => { if (!res.headersSent) json(res, { error: 'Máy chủ đang chuyển, thử lại' }, 503); else res.destroy(); });
  req.pipe(di);
}

/** Chuyển tiếp một kết nối WebSocket (bắt tay + luồng hai chiều) sang pod chủ — TCP thô, không mở gói. */
function chuyenWs(req: IncomingMessage, socket: Duplex, head: Buffer, diaChi: string): void {
  const u = new URL(diaChi);
  const di = netConnect(Number(u.port || 80), u.hostname, () => {
    const dong = [`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) dong.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    dong.push(`x-lt-chuyen: ${cum?.pod ?? '1'}`);
    di.write(`${dong.join('\r\n')}\r\n\r\n`);
    if (head.length) di.write(head);
    di.pipe(socket);
    socket.pipe(di);
  });
  di.setNoDelay(true);
  const huy = (): void => { di.destroy(); socket.destroy(); };
  di.on('error', huy); socket.on('error', huy);
  di.on('close', () => socket.destroy()); socket.on('close', () => di.destroy());
}

/** Từ chối một bắt tay WebSocket bằng mã đóng (client hiểu: 4404 phòng không có, 1012 thử lại). */
function tuChoiWs(req: IncomingMessage, socket: Duplex, head: Buffer, ma: number, lyDo: string): void {
  wss.handleUpgrade(req, socket, head, (raw) => { try { raw.close(ma, lyDo); } catch { /* đã đóng */ } });
}

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
      phong: { trongRam: phongs.size, dangChoi, nguoi: soNguoi, socket: soSocket, sanh: sanh.soKetNoi(), thiDau: sanh.thiDau() },
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

  // Đường NỘI BỘ giữa các pod: phải có khoá, và KHÔNG BAO GIỜ đi qua tunnel (request ngoài luôn mang cf-connecting-ip)
  if (url.pathname.startsWith('/_noi/')) {
    if (!cum || req.headers['x-lt-noi'] !== NOI_KEY || req.headers['cf-connecting-ip']) { res.writeHead(404); res.end(); return; }
    const m = url.pathname.match(/^\/_noi\/xem\/([0-9]{6})$/);
    if (m) { json(res, xemPhongTaiCho(m[1]!)); return; }
    res.writeHead(404); res.end(); return;
  }

  /*
   * Danh sách phòng công khai (ON-10). PHẢI đứng TRƯỚC `/api/rooms/:code` —
   * cùng lý do như bản Cloudflare (xem apps/server/src/index.ts), và hai tầng
   * HTTP này có test canh phải khớp nhau.
   */
  if (url.pathname === '/api/rooms/public' && req.method === 'GET') {
    // Phòng ĐANG CHƠI chỉ cho client khai `?v=2` (client cũ vẽ nó như phòng còn chỗ) — PublicRoom.dangChoi
    const v2 = url.searchParams.get('v') === '2';
    // `online` = số app đang nối sảnh (23.11.2026: ô Chơi online + màn Online hiện "N người đang online").
    // Nhiều pod: pod giữ sảnh ghi số vào Redis mỗi nhịp, pod khác đọc từ đó.
    void Promise.all([soPhong.liet(), cum && !sanhCuaToi ? cum.docOnline() : Promise.resolve(sanh.soKetNoi())])
      .then(([rooms, online]) => json(res, { rooms: rooms.filter((r) => v2 || !r.dangChoi), online }))
      .catch(() => json(res, { error: 'Lỗi server' }, 500));
    return;
  }

  // Tạo phòng (ON-01)
  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const thu = url.searchParams.get('thu') === '1';
    const tb = url.searchParams.get('tb');
    void (async () => {
      if (dangTat) { json(res, { error: 'Máy chủ đang khởi động lại, thử lại' }, 503); return; }
      // Nhiều pod: giao phòng mới cho MÁY đang ít phòng nhất, rồi pod ít phòng nhất trên máy đó (`chonPod`) — request đã
      // chuyển một lần thì tạo tại chỗ
      if (cum && !daChuyen(req)) {
        const chon = chonPod(await cum.podSong());
        if (chon) await cum.daGiao(chon.pod);
        if (chon && chon.pod !== cum.pod) { chuyenHttp(req, res, chon.diaChi); return; }
      }
      const code = await maMoi();
      if (thu) { phongThu.add(code); await cum?.datThu(code); }
      if (tb && thongBao) thongBao.ghiChuPhong(code, tb);
      await layPhong(code).room.open();
      json(res, { code });
    })().catch((e) => { console.error('[room] tạo phòng lỗi:', e); if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500); });
    return;
  }

  // Kiểm mã trước khi mở WebSocket, để báo lỗi rõ thay vì socket đóng im lặng
  const kiem = url.pathname.match(/^\/api\/rooms\/([0-9]{6})$/);
  if (kiem && req.method === 'GET') {
    const code = kiem[1]!;
    void duongDiPhong(code, daChuyen(req)).then((di) => {
      if (di === 'khong') json(res, { exists: false });
      else if (di === 'ban') json(res, { error: 'Máy chủ đang chuyển, thử lại' }, 503);
      else if (di !== 'toi') chuyenHttp(req, res, di.diaChi);
      else void layPhong(code).room.exists().then((exists) => json(res, { exists }));
    }).catch(() => json(res, { error: 'Lỗi server' }, 500));
    return;
  }

  if (url.pathname === '/health') { json(res, { ok: true, rooms: phongs.size, ...(cum ? { pod: cum.pod, giu: dangGiu.size, sanh: sanhCuaToi } : {}) }); return; }

  // Nhiều pod: sảnh (mời người online) và BXH (cần trạng thái online của sảnh) chạy ở pod giữ sảnh
  if (cum && (url.pathname.startsWith('/api/sanh/') || url.pathname === '/api/bxh')) {
    void duongDiSanh(daChuyen(req)).then((di) => {
      if (di === 'ban') json(res, { error: 'Máy chủ đang chuyển, thử lại' }, 503);
      else if (di !== 'toi') chuyenHttp(req, res, di.diaChi);
      else xuLyHttpTiep(req, res, url);
    }).catch(() => json(res, { error: 'Lỗi server' }, 500));
    return;
  }
  xuLyHttpTiep(req, res, url);
});

/** Phần còn lại của tầng HTTP (sau khi đã biết request thuộc pod này). */
function xuLyHttpTiep(req: IncomingMessage, res: ServerResponse, url: URL): void {

  // Tự kiểm sâu cho giám sát (UptimeRobot): bản build, MySQL, ổ đĩa, RAM — lỗi thì 503 + ok:false. Xem `kiemSucKhoe`.
  // Sảnh (mời người online) — trước tầng tài khoản vì cùng tiền tố /api/
  if (sanh.xuLyHttp(req, res, url)) return;
  if (tkThiDau?.xuLy(req, res, url, json)) return;
  if (tkTen?.xuLy(req, res, url, json)) return;

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
}

server.on('upgrade', (req, socket, head) => {
  const url = docUrl(req);
  if (!url) { socket.destroy(); return; }
  if (cum && url.pathname === '/ws/sanh') {
    void duongDiSanh(daChuyen(req)).then((di) => {
      if (di === 'ban') tuChoiWs(req, socket, head, 1012, 'restart');
      else if (di !== 'toi') chuyenWs(req, socket, head, di.diaChi);
      else if (!sanh.nhanUpgrade(req, url, socket, head)) socket.destroy();
    }).catch(() => socket.destroy());
    return;
  }
  if (sanh.nhanUpgrade(req, url, socket, head)) return;
  const m = url.pathname.match(/^\/ws\/([0-9]{6})$/);
  if (!m) { socket.destroy(); return; }
  const code = m[1]!;
  if (cum) {
    void duongDiPhong(code, daChuyen(req)).then((di) => {
      if (di === 'khong') tuChoiWs(req, socket, head, 4404, 'Phòng không tồn tại');
      else if (di === 'ban') tuChoiWs(req, socket, head, 1012, 'restart');
      else if (di !== 'toi') chuyenWs(req, socket, head, di.diaChi);
      else vaoPhongTaiCho(req, socket, head, url, code);
    }).catch(() => socket.destroy());
    return;
  }
  vaoPhongTaiCho(req, socket, head, url, code);
});

function vaoPhongTaiCho(req: IncomingMessage, socket: Duplex, head: Buffer, url: URL, code: string): void {
  wss.handleUpgrade(req, socket, head, (raw) => {
    // room.ts đọc `code` từ query, giống bản Cloudflare nhét vào ở index.ts
    url.searchParams.set('code', code);
    void moKetNoi(code, url, raw).catch((e) => {
      console.error('[room] lỗi khi vào phòng:', e);
      try { raw.close(1011, 'lỗi server'); } catch { /* đã đóng */ }
    });
  });
}

/* ---------- kho bền: phòng sống sót qua cập nhật ảnh ---------- */

let kho: Kho | null = null;
let taiKhoan: TaiKhoan | null = null;
let thongBao: ThongBao | null = null;
let tkThiDau: TkThiDau | null = null;
/** Tra mã người chơi GA → tên (tk-ten.ts). */
let tkTen: ReturnType<typeof moTkTen> | null = null;

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
  let thuTu = 0;
  for (const [code, { duLieu, alarmLuc }] of daLuu) {
    const { box } = layPhong(code, duLieu);
    // Không có mốc đã lưu cũng phải thức một lần (28.11.2026: ~28 phòng ma `alarm_at` rỗng sống tới 45 ngày) —
    // `alarm()` tự xét phòng vắng/hết người; giãn 200 ms mỗi phòng cho khỏi dồn cục lúc khởi động.
    void box.ctx.storage.setAlarm(alarmLuc !== null ? Math.max(alarmLuc, Date.now()) : Date.now() + 5_000 + (thuTu++) * 200);
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
            /*
             * NHIỀU POD: GHI XONG rồi NHẢ mọi phòng + sảnh, TRƯỚC khi đóng socket — máy nối lại (0,5 giây) sang pod khác,
             * pod đó giành khoá và nạp đúng bản vừa ghi. Đóng socket trước khi nhả là client đập vào khoá còn của pod
             * đang tắt và phải chờ khoá hết hạn (15 giây).
             */
            if (cum) {
              await (kho?.dayNgay() ?? Promise.resolve());
              for (const code of [...dangGiu]) { phongs.get(code)?.box.nha(); await cum.nha(code).catch(() => undefined); }
              if (sanhCuaToi) await cum.nha('sanh').catch(() => undefined);
            }
            // 2) Báo NGAY mọi máy (1012 = server khởi động lại): client nối lại mỗi 0,5 giây thay
            //    vì phát hiện chậm qua nhịp tim (mạng di động hay giữ socket "chết mà vẫn mở")
            for (const c of wss.clients) { try { c.close(1012, 'restart'); } catch { /* đã đóng */ } }
            sanh.dong();
            // 3) Đẩy nốt phần đang chờ ghi xuống MySQL
            await (kho?.dongKho() ?? Promise.resolve());
            await cum?.dong();
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
taiKhoan?.datDsOnline(() => sanh.dsAi());
console.log(taiKhoan
  ? `  tài khoản: BẬT (${[process.env.GOOGLE_CLIENT_ID && 'Google', (process.env.APPLE_BUNDLE_ID || process.env.APPLE_SERVICES_ID) && 'Apple'].filter(Boolean).join(' + ')})`
  : '  tài khoản: TẮT (cần MYSQL_URL + GOOGLE_CLIENT_ID và/hoặc APPLE_BUNDLE_ID)');
thongBao = await moThongBao(kho?.pool ?? null, process.env, fetch, { ghiTd: (d) => tkThiDau?.ghi('td_push', null, d) }).catch((e) => {
  console.error('[thongbao] không mở được:', (e as Error).message);
  return null;
});
console.log(thongBao
  ? '  thông báo phòng mới: BẬT'
  : '  thông báo phòng mới: TẮT (cần MYSQL_URL + APNS_* và/hoặc FCM_SERVICE_ACCOUNT)');
tkTen = moTkTen(kho?.pool ?? null, process.env);
tkThiDau = await moTkThiDau(kho?.pool ?? null, process.env).catch((e) => {
  console.error('[tk-thidau] không mở được:', (e as Error).message);
  return null;
});
cum = await moCum(process.env.REDIS_URL, PORT).catch((e) => {
  // Có REDIS_URL mà không nối được thì KHÔNG được chạy kiểu một pod: pod kia có thể đang giữ phòng → hai bản một phòng
  console.error('[cum] không nối được Redis — dừng:', (e as Error).message);
  process.exit(1);
});
if (cum && !kho) {
  // Cụm mà pod này không có MySQL: nó không nạp/ghi được phòng của ai — chạy tiếp là giữ phòng trong RAM riêng
  console.error('[cum] có REDIS_URL mà không có MySQL — dừng');
  process.exit(1);
}
if (cum) {
  // Không nạp hết phòng lúc khởi động: phòng thuộc pod đang giữ nó. Chỉ nhận phòng mồ côi (pod giữ đã chết),
  // rồi quét lại định kỳ. Nhịp gia hạn khoá: mất khoá nào là bỏ phòng đó ngay.
  cum.chayNhip(
    () => [...dangGiu, ...(sanhCuaToi ? ['sanh'] : [])],
    (ma) => {
      if (ma === 'sanh') { sanhCuaToi = false; sanh.xaKetNoi(); console.log('[cum] mất sảnh — pod khác đã giữ'); }
      else boPhong(ma);
    },
    () => { if (sanhCuaToi) void cum?.ghiOnline(sanh.soKetNoi()).catch(() => undefined); }
  );
  await quetMoCoi();
  setInterval(() => void quetMoCoi(), 10_000).unref();
} else {
  await khoiPhuc();
}
batBao = true;

server.listen(PORT, () => {
  console.log(`Lật Thẻ — server dự phòng chạy ở http://localhost:${PORT}`);
  console.log(`  web tĩnh: ${WEB_DIR}`);
  console.log(kho
    ? '  phòng lưu xuống MySQL: cập nhật ảnh không mất phòng đang mở'
    : '  phòng nằm trong RAM: restart là mất phòng đang mở (đặt MYSQL_URL để giữ)');
});
