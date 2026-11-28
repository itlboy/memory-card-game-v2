import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import type { Cum } from './cum.js';

/**
 * API QUẢN TRỊ CỤM (28.11.2026, chủ dự án: "làm các api thống kê cần thiết để sau ko cần ssh vào redis hay db mysql").
 * Pod nào cũng trả lời được — dữ liệu đọc từ Redis + MySQL chung, không phụ thuộc pod nhận request.
 *
 *   GET /api/quantri/cum               — các pod (địa chỉ nội bộ, số phòng đang giữ), pod giữ sảnh, Redis/MySQL sống + độ trễ
 *   GET /api/quantri/phong             — phòng đang mở: mã, công khai/riêng, trạng thái, cấp, mở bao lâu, người (tên, đang
 *                                        nối?, máy?), pod chủ; kèm `ma: true` cho phòng chờ mọi người đã đi quá 15 phút
 *   GET /api/quantri/phong/<mã>        — một phòng, như trên
 *
 * XÁC THỰC: header `x-quantri-key` = env `QUANTRI_KEY` (khoá RIÊNG, không dùng chung THONGKE_KEY). Thiếu env → API tắt (404).
 *  - So bằng băm SHA-256 + timingSafeEqual: thời gian so không lộ độ dài / phần đúng của khoá.
 *  - Sai khoá trả 404 y như đường không tồn tại (không xác nhận có API).
 *  - Sai quá SAI_TOI_DA lần / 10 phút từ một IP (cf-connecting-ip) → 429 tới hết cửa sổ, kể cả khi lần sau đúng khoá.
 *  - KHÔNG BAO GIỜ trả token phòng / token người chơi / mật khẩu / email; tên người chơi là tên công khai trong phòng.
 */
const SAI_TOI_DA = 20;
const CUA_SO_MS = 10 * 60_000;
const VANG_QUA_MS = 15 * 60_000;

export interface QuanTri {
  xuLy(req: IncomingMessage, res: ServerResponse, url: URL, json: (res: ServerResponse, body: unknown, status?: number) => void): boolean;
}

interface DongPhong { id: number; code: string; status: string; is_public: number; level: number; opened_at: number; empty_at: number | null }
interface DongNguoi { room_id: number; name: string; bot_level: string | null; disconnected_at: number | null; last_seen: number | null }

export function moQuanTri(opts: {
  pool: Pool | null; cum: () => Cum | null; khoa: string | undefined; now?: () => number;
  /** Thông tin của chính pod nhận request (cho `/cum` khi chạy một pod không Redis). */
  podNay: () => { pod: string; phong: number; sanhKetNoi: number };
}): QuanTri {
  const now = opts.now ?? Date.now;
  const khoa = (opts.khoa ?? '').trim();
  const bamKhoa = createHash('sha256').update(khoa).digest();
  const sai = new Map<string, { n: number; tu: number }>();

  function dungKhoa(req: IncomingMessage): boolean {
    const gui = createHash('sha256').update(String(req.headers['x-quantri-key'] ?? '')).digest();
    return !!khoa && timingSafeEqual(gui, bamKhoa);
  }

  async function dsPhong(chiMa?: string): Promise<unknown[]> {
    if (!opts.pool) return [];
    const loc = chiMa ? ' AND code = ?' : '';
    const [rows] = await opts.pool.query(
      `SELECT id, code, status, is_public, level, opened_at, empty_at FROM rooms WHERE closed_at = 0${loc} ORDER BY opened_at DESC LIMIT 500`,
      chiMa ? [chiMa] : []
    );
    const phong = rows as DongPhong[];
    if (!phong.length) return [];
    const [prows] = await opts.pool.query(
      'SELECT room_id, name, bot_level, disconnected_at, last_seen FROM room_players WHERE left_at = 0 AND room_id IN (?) ORDER BY room_id, seat',
      [phong.map((r) => r.id)]
    );
    const nguoi = new Map<number, DongNguoi[]>();
    for (const p of prows as DongNguoi[]) nguoi.set(p.room_id, [...(nguoi.get(p.room_id) ?? []), p]);
    const chu = (await opts.cum()?.soLieu(phong.map((r) => r.code)))?.chu ?? [];
    const t = now();
    return phong.map((r, i) => {
      const ng = nguoi.get(r.id) ?? [];
      const nguoiThat = ng.filter((p) => !p.bot_level);
      const vangLau = r.status === 'lobby' && nguoiThat.every((p) => t - Number(p.disconnected_at ?? p.last_seen ?? 0) > VANG_QUA_MS);
      return {
        ma: r.code, congKhai: !!r.is_public, trangThai: r.status, cap: Number(r.level),
        moPhut: Math.round((t - Number(r.opened_at)) / 60_000),
        nguoi: ng.map((p) => ({ ten: p.name, may: !!p.bot_level, dangNoi: p.disconnected_at === null })),
        ...(opts.cum() ? { pod: chu[i] ?? null } : {}),
        ...(vangLau ? { phongMa: true } : {})
      };
    });
  }

  async function cum(): Promise<unknown> {
    const t0 = now();
    let mysql: { song: boolean; treMs?: number; phongMo?: number } = { song: false };
    if (opts.pool) {
      try {
        const [r] = await opts.pool.query('SELECT COUNT(*) AS n FROM rooms WHERE closed_at = 0');
        mysql = { song: true, treMs: now() - t0, phongMo: Number((r as { n: number }[])[0]?.n ?? 0) };
      } catch { /* mysql chết → song: false */ }
    }
    const c = opts.cum();
    if (!c) return { cum: false, pod: opts.podNay(), mysql };
    try {
      const [pods, sl] = await Promise.all([c.podSong(), c.soLieu([])]);
      return {
        cum: true, podNhan: c.pod,
        pods: pods.map((p) => ({ pod: p.pod, diaChi: p.diaChi, phong: p.phong, giuSanh: sl.sanh === p.pod })),
        redis: { song: true, treMs: sl.treMs }, mysql,
        soPhongCongKhai: sl.soPhongCongKhai, online: sl.online
      };
    } catch (e) {
      return { cum: true, podNhan: c.pod, redis: { song: false, loi: (e as Error).message.slice(0, 80) }, mysql };
    }
  }

  return {
    xuLy(req, res, url, json) {
      if (!url.pathname.startsWith('/api/quantri/')) return false;
      const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '?');
      const t = now();
      const s = sai.get(ip);
      if (s && t - s.tu > CUA_SO_MS) sai.delete(ip);
      if ((sai.get(ip)?.n ?? 0) >= SAI_TOI_DA) { json(res, { loi: 'thuQuaNhieu' }, 429); return true; }
      if (!dungKhoa(req) || req.method !== 'GET') {
        const x = sai.get(ip) ?? { n: 0, tu: t };
        x.n++; sai.set(ip, x);
        if (sai.size > 10_000) sai.clear();
        json(res, { error: 'Không có đường này' }, 404);
        return true;
      }
      const m = url.pathname.match(/^\/api\/quantri\/phong\/([0-9]{6})$/);
      const viec = url.pathname === '/api/quantri/cum' ? cum()
        : url.pathname === '/api/quantri/phong' ? dsPhong().then((ds) => ({ so: ds.length, phong: ds }))
        : m ? dsPhong(m[1]).then((ds) => ds[0] ?? null)
        : null;
      if (!viec) { json(res, { error: 'Không có đường này' }, 404); return true; }
      void viec.then((kq) => { res.setHeader('Cache-Control', 'no-store'); json(res, kq); })
        .catch((e) => { console.error('[quantri] lỗi:', (e as Error).message); if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500); });
      return true;
    }
  };
}
