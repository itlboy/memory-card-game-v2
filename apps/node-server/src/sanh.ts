import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * SẢNH — MỜI NGƯỜI ĐANG ONLINE VÀO PHÒNG CHỜ (21.11.2026, mockup duyệt
 * https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 3). CHỈ Ở BẢN NODE, lớp phủ như tài khoản/thông báo:
 * bản Cloudflare không có → `/ws/sanh` bị từ chối, `/api/sanh/*` 404, client giấu nút.
 *
 * Ai MỜI ĐƯỢC (chủ dự án): người đang mở app và KHÔNG ở phòng chờ / ván online nào — đang ở trang chủ hay
 * đang chơi offline đều được. App giữ MỘT kết nối nhẹ tới `/ws/sanh` lúc đó (vào nền / vào phòng là đóng).
 * Server đặt `sid` ngẫu nhiên cho mỗi kết nối — KHÔNG dùng mã máy (`cid`) hay token, nên danh sách lộ ra
 * cho chủ phòng không chứa định danh bền nào. Chỉ nằm trong RAM, không ghi DB.
 *
 * CHỐNG LÀM PHIỀN (giữ chặt — dễ bị coi là spam):
 *  - chỉ CHỦ PHÒNG của phòng đang CHỜ và CÒN CHỖ mới xem danh sách / mời (xác thực bằng mã phòng + token);
 *  - mỗi người chỉ có MỘT lời mời đang treo; lời mời hết hạn sau `HAN_MOI_MS`;
 *  - cùng phòng mời lại cùng người phải chờ `CACH_MOI_LAI_MS`; bị "Để sau" là khoá hẳn với phòng đó;
 *  - mỗi phòng tối đa `MOI_MOI_PHUT` lời mời một phút.
 */
export const HAN_MOI_MS = 20_000;
export const CACH_MOI_LAI_MS = 2 * 60_000;
export const MOI_MOI_PHUT = 8;
export const TOI_DA_DS = 30;
/** Trần kết nối sảnh — máy 768 MB, mỗi socket rảnh ~ vài chục KB. */
export const TOI_DA_KET_NOI = 3000;
const NHIP_TIM_MS = 30_000;
const KHOA_TU_CHOI_MS = 60 * 60_000;

/**
 * `chu` trang chủ · `choi` đang chơi offline — cả hai MỜI ĐƯỢC. `phong` = đang ở phòng chờ / ván online
 * (21.11.2026, app giữ kết nối cả lúc đó để bảng xếp hạng hiện "Đang chơi"): KHÔNG mời được, không lên danh sách mời.
 */
export type TrangThai = 'chu' | 'choi' | 'phong';
export interface NguoiSanh { sid: string; ten: string; mat: string; tt: TrangThai }
interface KetNoi extends NguoiSanh {
  ws: WebSocket; song: boolean; moi: { id: string; ma: string; het: number } | null;
  /** Danh tính trên bảng xếp hạng (`u:<id>` / `k:<mã băm khách>`) — app gửi sau khi nối, server tự xác minh. */
  ai: string | null;
}
/** Trạng thái online của một dòng bảng xếp hạng: `sid` chỉ có khi đang rảnh (thách được). */
export interface OnlineBxh { sid?: string; ban: boolean }

/** Thứ sảnh cần biết về một phòng — index.ts đọc từ RoomDO. */
export interface XemPhong {
  status: string;
  hostToken: string;
  host: { ten: string; mat: string; anh?: string };
  nguoi: number;
  toiDa: number;
  soThe: number;
}

export interface Sanh {
  /** Người có danh tính `ai` có đang mở app (và bật nhận lời mời) không — cho bảng xếp hạng. */
  trangThai(ai: string): OnlineBxh | null;
  /** Trả true nếu đây là đường `/ws/sanh` (đã nhận xử lý). */
  nhanUpgrade(req: IncomingMessage, url: URL, socket: Duplex, head: Buffer): boolean;
  /** Trả true nếu đã trả lời request `/api/sanh/*`. */
  xuLyHttp(req: IncomingMessage, res: ServerResponse, url: URL): boolean;
  soKetNoi(): number;
  dong(): void;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function json(res: ServerResponse, body: unknown, status = 200): void { res.writeHead(status, CORS); res.end(JSON.stringify(body)); }

function docBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((ok) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { s += c; if (s.length > 2048) { req.destroy(); ok(null); } });
    req.on('end', () => { try { const v = JSON.parse(s) as unknown; ok(v && typeof v === 'object' ? v as Record<string, unknown> : null); } catch { ok(null); } });
    req.on('error', () => ok(null));
  });
}

const docTt = (v: unknown): TrangThai => (v === 'choi' || v === 'phong' ? v : 'chu');
const tenSach = (v: unknown): string => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

export function moSanh(opts: {
  xemPhong(ma: string): XemPhong | null; avatars: readonly string[]; now?: () => number;
  /** Xác minh danh tính app gửi lên (phiên đăng nhập / mã khách) → khoá bảng xếp hạng, hoặc null. */
  xacDinh?(khach: unknown, token: unknown): string | null;
}): Sanh {
  const now = opts.now ?? Date.now;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const ketNoi = new Map<string, KetNoi>();
  /** `ma:sid` → mốc được mời lại. */
  const daMoi = new Map<string, number>();
  /** `ma:sid` → hết khoá (người kia bấm Để sau). */
  const tuChoi = new Map<string, number>();
  /** ma → các mốc mời trong phút qua. */
  const nhipPhong = new Map<string, number[]>();
  /** ai → sid của kết nối mới nhất mang danh tính đó (một người mở hai máy: máy sau thắng). */
  const theoAi = new Map<string, string>();

  const nhipTim = setInterval(() => {
    const t = now();
    for (const k of ketNoi.values()) {
      if (!k.song) { try { k.ws.terminate(); } catch { /* đã đóng */ } continue; }
      k.song = false;
      try { k.ws.ping(); } catch { /* đã đóng */ }
    }
    for (const [k, v] of daMoi) if (v <= t) daMoi.delete(k);
    for (const [k, v] of tuChoi) if (v <= t) tuChoi.delete(k);
    for (const [k, v] of nhipPhong) { const c = v.filter((x) => x > t - 60_000); if (c.length) nhipPhong.set(k, c); else nhipPhong.delete(k); }
  }, NHIP_TIM_MS);
  nhipTim.unref?.();

  function gui(k: KetNoi, tin: unknown): void { try { k.ws.send(JSON.stringify(tin)); } catch { /* đã đóng */ } }

  function moiKetNoi(ws: WebSocket, url: URL): void {
    const sid = randomBytes(5).toString('hex');
    const k: KetNoi = {
      sid, ws, song: true, moi: null, ai: null,
      ten: tenSach(url.searchParams.get('ten')),
      mat: opts.avatars[randomBytes(1)[0]! % opts.avatars.length] ?? '🙂',
      tt: docTt(url.searchParams.get('tt'))
    };
    ketNoi.set(sid, k);
    ws.on('pong', () => { k.song = true; });
    ws.on('close', () => { ketNoi.delete(sid); if (k.ai && theoAi.get(k.ai) === sid) theoAi.delete(k.ai); });
    ws.on('error', () => { /* close theo sau */ });
    ws.on('message', (raw) => {
      k.song = true;
      let m: Record<string, unknown>;
      try { m = JSON.parse(String(raw)) as Record<string, unknown>; } catch { return; }
      if (m.t === 'tt') k.tt = docTt(m.tt);
      else if (m.t === 'ai') {
        // Danh tính KHÔNG đi trên URL (log) — gửi trong tin nhắn, server xác minh (phiên ký / băm mã khách)
        const ai = opts.xacDinh?.(m.khach, m.token) ?? null;
        if (k.ai && theoAi.get(k.ai) === sid) theoAi.delete(k.ai);
        k.ai = ai;
        if (ai) theoAi.set(ai, sid);
      }
      else if (m.t === 'ten') k.ten = tenSach(m.ten);
      else if (m.t === 'tuChoi' && k.moi && m.id === k.moi.id) {
        tuChoi.set(`${k.moi.ma}:${sid}`, now() + KHOA_TU_CHOI_MS);
        k.moi = null;
      } else if (m.t === 'nhan' && k.moi && m.id === k.moi.id) k.moi = null;
    });
    gui(k, { t: 'chao', sid, han: HAN_MOI_MS });
  }

  /** Xác thực chủ phòng: phòng còn chờ + token đúng của chủ phòng. */
  async function xacThuc(req: IncomingMessage, res: ServerResponse): Promise<{ ma: string; p: XemPhong; b: Record<string, unknown> } | null> {
    const b = await docBody(req);
    const ma = String(b?.ma ?? '');
    const token = String(b?.token ?? '');
    if (!b || !/^\d{6}$/.test(ma) || !token) { json(res, { loi: 'sai' }, 400); return null; }
    const p = opts.xemPhong(ma);
    if (!p || p.hostToken !== token) { json(res, { loi: 'khongPhaiChu' }, 403); return null; }
    return { ma, p, b };
  }

  type DongDs = NguoiSanh & { daMoi?: number; choMoi?: number; tuChoi?: true };
  function dsCho(ma: string): DongDs[] {
    const t = now();
    const ra: DongDs[] = [];
    for (const k of ketNoi.values()) {
      if (k.tt === 'phong') continue;
      const khoa = `${ma}:${k.sid}`;
      const d = daMoi.get(khoa);
      ra.push({
        sid: k.sid, ten: k.ten, mat: k.mat, tt: k.tt,
        ...(d && d > t && k.moi?.ma === ma && k.moi.het > t ? { daMoi: k.moi.het - t } : {}),
        // Còn bao lâu mới mời lại được (vạch đếm ngược trên nút Mời — chủ dự án 21.11.2026)
        ...(d && d > t ? { choMoi: d - t } : {}),
        ...((tuChoi.get(khoa) ?? 0) > t ? { tuChoi: true as const } : {})
      });
      if (ra.length >= TOI_DA_DS) break;
    }
    // Người rảnh ở trang chủ lên trước, người đang chơi offline sau
    return ra.sort((a, b) => (a.tt === b.tt ? 0 : a.tt === 'chu' ? -1 : 1));
  }

  return {
    nhanUpgrade(req, url, socket, head) {
      if (url.pathname !== '/ws/sanh') return false;
      if (ketNoi.size >= TOI_DA_KET_NOI) { socket.destroy(); return true; }
      wss.handleUpgrade(req, socket, head, (ws) => moiKetNoi(ws, url));
      return true;
    },
    xuLyHttp(req, res, url) {
      if (!url.pathname.startsWith('/api/sanh/')) return false;
      if (req.method !== 'POST') { json(res, { loi: 'phuongThuc' }, 405); return true; }
      if (url.pathname === '/api/sanh/ds') {
        void xacThuc(req, res).then((x) => {
          if (!x) return;
          json(res, { ds: x.p.status === 'lobby' ? dsCho(x.ma) : [], tong: ketNoi.size, han: HAN_MOI_MS, cach: CACH_MOI_LAI_MS });
        });
        return true;
      }
      if (url.pathname === '/api/sanh/moi') {
        void xacThuc(req, res).then((x) => {
          if (!x) return;
          const { ma, p, b } = x;
          const t = now();
          if (p.status !== 'lobby') { json(res, { loi: 'dangChoi' }); return; }
          if (p.nguoi >= p.toiDa) { json(res, { loi: 'day' }); return; }
          const k = ketNoi.get(String(b.sid ?? ''));
          if (!k) { json(res, { loi: 'khongCo' }); return; }
          if (k.tt === 'phong') { json(res, { loi: 'banPhong' }); return; }
          const khoa = `${ma}:${k.sid}`;
          if ((tuChoi.get(khoa) ?? 0) > t) { json(res, { loi: 'tuChoi' }); return; }
          if ((daMoi.get(khoa) ?? 0) > t) { json(res, { loi: 'vuaMoi', con: (daMoi.get(khoa) ?? t) - t }); return; }
          if (k.moi && k.moi.het > t) { json(res, { loi: 'banMoi' }); return; }
          const nhip = (nhipPhong.get(ma) ?? []).filter((x2) => x2 > t - 60_000);
          if (nhip.length >= MOI_MOI_PHUT) { json(res, { loi: 'nhieuQua' }); return; }
          nhip.push(t); nhipPhong.set(ma, nhip);
          const id = randomBytes(4).toString('hex');
          k.moi = { id, ma, het: t + HAN_MOI_MS };
          daMoi.set(khoa, t + CACH_MOI_LAI_MS);
          // `thach`: lời mời từ nút "Thách" ở bảng xếp hạng — chỉ đổi chữ trên thẻ, luật chống làm phiền y hệt
          gui(k, { t: 'moi', id, ma, han: HAN_MOI_MS, tu: p.host, nguoi: p.nguoi, toiDa: p.toiDa, soThe: p.soThe, ...(b.thach === true ? { thach: true } : {}) });
          json(res, { ok: true, han: HAN_MOI_MS, cach: CACH_MOI_LAI_MS });
        });
        return true;
      }
      json(res, { loi: 'khongCo' }, 404);
      return true;
    },
    soKetNoi: () => ketNoi.size,
    trangThai(ai) {
      const sid = theoAi.get(ai);
      const k = sid ? ketNoi.get(sid) : undefined;
      if (!k) return null;
      return k.tt === 'phong' ? { ban: true } : { sid: k.sid, ban: false };
    },
    dong() {
      clearInterval(nhipTim);
      for (const k of ketNoi.values()) { try { k.ws.close(1012, 'restart'); } catch { /* đã đóng */ } }
    }
  };
}
