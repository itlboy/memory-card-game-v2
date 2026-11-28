import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import type { Cum } from './cum.js';
import { doSucKhoe, mucCanhBao, type SucKhoe } from './suc-khoe-may.js';
import type { BaoLoi } from './baoloi.js';

/**
 * API QUẢN TRỊ CỤM (28.11.2026, chủ dự án: "làm các api thống kê cần thiết để sau ko cần ssh vào redis hay db mysql").
 * Pod nào cũng trả lời được — dữ liệu đọc từ Redis + MySQL chung, không phụ thuộc pod nhận request.
 *
 *   GET /api/quantri/cum               — các pod (địa chỉ nội bộ, số phòng đang giữ), pod giữ sảnh, Redis/MySQL sống + độ trễ
 *   GET /api/quantri/phong             — phòng đang mở: mã, công khai/riêng, trạng thái, cấp, mở bao lâu, người (tên, đang
 *                                        nối?, máy?), pod chủ; kèm `ma: true` cho phòng chờ mọi người đã đi quá 15 phút
 *   GET /api/quantri/phong/<mã>        — một phòng, như trên
 *   GET /api/quantri/tong              — TỔNG QUAN: online ở sảnh, người trong phòng (thật / bot thường trực), phòng theo trạng
 *                                        thái + công khai/riêng, ván online hôm nay / 7 ngày, người chơi hôm nay / 7 ngày,
 *                                        tài khoản (tổng, mới hôm nay), khách — "hôm nay" theo giờ Việt Nam
 *   POST /api/quantri/mcp              — MCP (Streamable HTTP, JSON-RPC): cùng các số trên dưới dạng tool cho Claude —
 *                                        `claude mcp add --transport http latthe <gốc>/api/quantri/mcp --header "x-quantri-key: …"`
 *   Lọc /phong: `?trangThai=lobby|playing|ended`, `?congKhai=1|0`, `?boMa=1` (bỏ phòng ma)
 *   GET /api/quantri/baoloi[?truoc=<id>]        — thư báo lỗi / góp ý mới nhất (30 thư, không kèm ảnh)
 *   GET /api/quantri/baoloi/<id>/anh            — ảnh đính kèm
 *   POST /api/quantri/baoloi/<id>/trangthai     — { tt: 'moi' | 'xem' | 'xong' }
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

/** Đọc thân JSON (tối đa 64 KB). */
function docThan(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, loi) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { s += c; if (s.length > 65_536) { req.destroy(); loi(new Error('quá lớn')); } });
    req.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { loi(e); } });
    req.on('error', loi);
  });
}

export function moQuanTri(opts: {
  pool: Pool | null; cum: () => Cum | null; khoa: string | undefined; now?: () => number;
  /** Thư báo lỗi trong app (baoloi.ts). */
  baoLoi?: () => BaoLoi | null;
  /** Thông tin của chính pod nhận request (cho `/cum` khi chạy một pod không Redis). */
  podNay: () => { pod: string; phong: number; sanhKetNoi: number };
  /** "Ai đang online" — danh sách kết nối sảnh (chỉ pod giữ sảnh có; index.ts chuyển request về pod đó). */
  nguoiOnline?: () => unknown[];
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

  /** Bot thường trực (phong-bot) mang ký tự vô hình U+2060 trong tên — tách khỏi người thật. */
  const BOT_TEN = '%\u2060%';
  const dauNgayVN = (t: number): number => { const d = new Date(t + 7 * 3600_000); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 7 * 3600_000; };

  async function tong(): Promise<unknown> {
    const t = now();
    const homNay = dauNgayVN(t), bayNgay = t - 7 * 86_400_000;
    const c = opts.cum();
    const sl = c ? await c.soLieu([]).catch(() => null) : null;
    const ra: Record<string, unknown> = {
      luc: new Date(t).toISOString(),
      online: { sanh: c ? sl?.online ?? null : opts.podNay().sanhKetNoi, ghiChu: 'số app đang mở (nối sảnh) — người trong phòng tính riêng ở nguoiTrongPhong' }
    };
    if (c) {
      const pods = await c.podSong().catch(() => []);
      ra.cum = { soPod: pods.length, pods: pods.map((p) => ({ pod: p.pod, may: tenMay(p.diaChi), phong: p.phong, giuSanh: sl?.sanh === p.pod, sk: p.sk ?? null })),
        canhBao: pods.flatMap((p) => canhBao(tenMay(p.diaChi), p.sk as SucKhoe | undefined)) };
    }
    if (!opts.pool) return ra;
    const q = async <T>(sql: string, v: unknown[] = []): Promise<T[]> => (await opts.pool!.query(sql, v))[0] as T[];
    const [phong, nguoi, van, choi, tk, khach] = await Promise.all([
      q<{ status: string; is_public: number; n: number }>('SELECT status, is_public, COUNT(*) AS n FROM rooms WHERE closed_at = 0 GROUP BY status, is_public'),
      q<{ bot: number; noi: number; n: number }>(
        `SELECT (p.name LIKE ?) AS bot, (p.disconnected_at IS NULL) AS noi, COUNT(*) AS n FROM room_players p JOIN rooms r ON r.id = p.room_id
         WHERE r.closed_at = 0 AND p.left_at = 0 AND p.bot_level IS NULL GROUP BY bot, noi`, [BOT_TEN]),
      q<{ homNay: number; bayNgay: number }>('SELECT SUM(ended_at >= ?) AS homNay, COUNT(*) AS bayNgay FROM matches WHERE ended_at >= ?', [homNay, bayNgay]),
      q<{ homNay: number; bayNgay: number }>(
        `SELECT COUNT(DISTINCT IF(updated_at >= ?, CONCAT(is_guest, ':', player), NULL)) AS homNay,
                COUNT(DISTINCT CONCAT(is_guest, ':', player)) AS bayNgay FROM weekly_scores WHERE updated_at >= ?`, [homNay, bayNgay]),
      q<{ tong: number; moi: number }>('SELECT COUNT(*) AS tong, SUM(created_at >= ?) AS moi FROM users', [homNay]),
      q<{ tong: number; moi: number }>('SELECT COUNT(*) AS tong, SUM(created_at >= ?) AS moi FROM guest_scores', [homNay])
    ]);
    const demPhong = { tong: 0, cho: 0, dangChoi: 0, ketThuc: 0, congKhai: 0, rieng: 0 };
    for (const r of phong) {
      const n = Number(r.n);
      demPhong.tong += n;
      if (r.status === 'lobby') demPhong.cho += n; else if (r.status === 'playing' || r.status === 'countdown') demPhong.dangChoi += n; else demPhong.ketThuc += n;
      if (r.is_public) demPhong.congKhai += n; else demPhong.rieng += n;
    }
    const dem = (bot: number, noi?: number): number => nguoi.filter((x) => Number(x.bot) === bot && (noi === undefined || Number(x.noi) === noi)).reduce((a, x) => a + Number(x.n), 0);
    ra.phong = demPhong;
    ra.nguoiTrongPhong = { nguoiThatDangNoi: dem(0, 1), nguoiThatDangRot: dem(0, 0), botThuongTruc: dem(1) };
    ra.vanOnline = { homNay: Number(van[0]?.homNay ?? 0), bayNgay: Number(van[0]?.bayNgay ?? 0) };
    ra.nguoiChoi = { homNay: Number(choi[0]?.homNay ?? 0), bayNgay: Number(choi[0]?.bayNgay ?? 0), ghiChu: 'tài khoản + khách có ghi ván (cả offline)' };
    ra.taiKhoan = { tong: Number(tk[0]?.tong ?? 0), moiHomNay: Number(tk[0]?.moi ?? 0) };
    ra.khach = { tong: Number(khach[0]?.tong ?? 0), moiHomNay: Number(khach[0]?.moi ?? 0) };
    return ra;
  }

  /* ---------- MCP (Streamable HTTP, chỉ JSON — không SSE, không phiên) ---------- */
  const CONG_CU = [
    { name: 'tong_quan', description: 'Tổng quan Lật Thẻ lúc này: người online, người trong phòng, số phòng theo trạng thái, ván online và người chơi hôm nay / 7 ngày, tài khoản, các pod.', inputSchema: { type: 'object', properties: {} } },
    { name: 'danh_sach_phong', description: 'Các phòng online đang mở: mã, công khai/riêng, trạng thái, cấp, mở bao lâu, người chơi (tên, đang nối, máy), pod giữ, phòng ma.', inputSchema: { type: 'object', properties: {
      trangThai: { type: 'string', enum: ['lobby', 'playing', 'countdown', 'ended'], description: 'Lọc theo trạng thái' },
      congKhai: { type: 'boolean', description: 'true = chỉ phòng công khai, false = chỉ phòng riêng' },
      boMa: { type: 'boolean', description: 'Bỏ phòng ma (phòng chờ mọi người đã đi > 15 phút)' } } } },
    { name: 'xem_phong', description: 'Chi tiết một phòng theo mã 6 số.', inputSchema: { type: 'object', properties: { ma: { type: 'string', pattern: '^[0-9]{6}$' } }, required: ['ma'] } },
    { name: 'bao_loi', description: 'Thư báo lỗi / góp ý người chơi gửi từ app (mới nhất trước): loại, ở đâu, chuyện gì xảy ra, nội dung, email nếu có, thông tin máy (dòng máy, hệ điều hành, màn hình, bản app, chẩn đoán), có ảnh không, trạng thái.', inputSchema: { type: 'object', properties: {
      soLuong: { type: 'number', description: 'Số thư (mặc định 10, tối đa 50)' },
      chiMoi: { type: 'boolean', description: 'Chỉ thư chưa xử lý (trạng thái khác "xong")' } } } },
    { name: 'nguoi_online', description: 'Ai đang mở app lúc này (kết nối sảnh): tên, avatar, nền tảng, ngôn ngữ, nước, Google hay khách, đang làm gì (hd.l: chu trang chủ · menu đang chọn bàn · nhanh chơi nhanh · cd Chiến dịch màn hd.man · may đấu máy hd.may · tim Tìm Thẻ · timcd Chiến dịch Tìm Thẻ · mua Mưa Thẻ · online phòng hd.ma, hd.o = lobby/playing/xem/sanh), làm từ lúc nào (hdLuc), số xu / danh hiệu / màn Chiến dịch / Premium / bản app (tk), nối lúc nào (luc). App bản cũ không gửi hd/tk.', inputSchema: { type: 'object', properties: {} } },
    { name: 'cum_may_chu', description: 'Sức khoẻ cụm máy chủ: từng máy/pod với CPU, RAM, swap, ổ cứng của máy (%), RAM pod, số phòng giữ, ai giữ sảnh; Redis và MySQL + độ trễ; danh sách cảnh báo (≥ 80% vàng, ≥ 95% đỏ).', inputSchema: { type: 'object', properties: {} } }
  ];
  async function goiCongCu(ten: string, a: Record<string, unknown>): Promise<unknown> {
    if (ten === 'tong_quan') return tong();
    if (ten === 'cum_may_chu') return cum();
    if (ten === 'nguoi_online') return { luc: now(), nguoi: opts.nguoiOnline?.() ?? [] };
    if (ten === 'xem_phong') return /^[0-9]{6}$/.test(String(a.ma ?? '')) ? (await dsPhong(String(a.ma)))[0] ?? { loi: 'không có phòng đang mở mang mã này' } : { loi: 'mã phải là 6 số' };
    if (ten === 'danh_sach_phong') return locPhong(await dsPhong(), a);
    if (ten === 'bao_loi') {
      const bl = opts.baoLoi?.();
      if (!bl) return { loi: 'chưa bật báo lỗi (cần MySQL)' };
      const n = Math.min(50, Math.max(1, Number(a.soLuong) || 10));
      const ds = (await bl.ds(a.chiMoi ? 50 : n)) as { trangThai: string }[];
      return a.chiMoi ? ds.filter((x) => x.trangThai !== 'xong').slice(0, n) : ds;
    }
    throw new Error(`không có công cụ ${ten}`);
  }
  async function mcp(than: unknown): Promise<{ status: number; body?: unknown }> {
    const m = than as { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> } | null;
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return { status: 400, body: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } } };
    if (m.id === undefined) return { status: 202 };   // thông báo (notifications/initialized…): không trả lời
    const ok = (result: unknown): { status: number; body: unknown } => ({ status: 200, body: { jsonrpc: '2.0', id: m.id, result } });
    if (m.method === 'initialize') {
      return ok({ protocolVersion: String(m.params?.protocolVersion ?? '2025-06-18'), capabilities: { tools: {} },
        serverInfo: { name: 'latthe-quantri', version: '1.0.0' },
        instructions: 'Số liệu vận hành Lật Thẻ (Flip Match): người online, phòng, ván, cụm máy chủ. Chỉ đọc. Tên người chơi là tên công khai trong phòng.' });
    }
    if (m.method === 'ping') return ok({});
    if (m.method === 'tools/list') return ok({ tools: CONG_CU });
    if (m.method === 'tools/call') {
      const ten = String(m.params?.name ?? '');
      try {
        const kq = await goiCongCu(ten, (m.params?.arguments ?? {}) as Record<string, unknown>);
        return ok({ content: [{ type: 'text', text: JSON.stringify(kq, null, 1) }] });
      } catch (e) { return ok({ content: [{ type: 'text', text: (e as Error).message }], isError: true }); }
    }
    return { status: 200, body: { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found' } } };
  }

  function locPhong(ds: unknown[], a: Record<string, unknown>): { so: number; phong: unknown[] } {
    const kq = (ds as { trangThai: string; congKhai: boolean; phongMa?: boolean }[]).filter((p) =>
      (!a.trangThai || p.trangThai === a.trangThai) &&
      (a.congKhai === undefined || a.congKhai === null || p.congKhai === a.congKhai) &&
      (!a.boMa || !p.phongMa));
    return { so: kq.length, phong: kq };
  }

  /** Cảnh báo theo ngưỡng (≥ 80% vàng, ≥ 95% đỏ) cho từng máy: CPU, RAM, swap, ổ cứng máy + RAM pod. */
  function canhBao(ten: string, sk: SucKhoe | undefined): { muc: 'vang' | 'do'; chiSo: string; giaTri: number; may: string; ten?: string }[] {
    if (!sk) return [];
    const ra: { muc: 'vang' | 'do'; chiSo: string; giaTri: number; may: string; ten?: string }[] = [];
    for (const [chiSo, v] of [['CPU', sk.may.cpu], ['RAM', sk.may.ram], ['Swap', sk.may.swap], ['Ổ cứng', sk.may.oDia], ['RAM pod', sk.pod.ram]] as const) {
      const m = mucCanhBao(v);
      if (m && v != null) ra.push({ muc: m, chiSo, giaTri: v, may: ten, ...(sk.ten ? { ten: sk.ten } : {}) });
    }
    return ra;
  }
  const tenMay = (diaChi: string): string => diaChi.replace(/^https?:\/\//, '');

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
    if (!c) { const sk = await doSucKhoe(); return { cum: false, pod: { ...opts.podNay(), sk }, mysql, canhBao: canhBao('máy này', sk) }; }
    try {
      const [pods, sl] = await Promise.all([c.podSong(), c.soLieu([])]);
      return {
        cum: true, podNhan: c.pod,
        pods: pods.map((p) => ({ pod: p.pod, diaChi: p.diaChi, phong: p.phong, giuSanh: sl.sanh === p.pod, sk: p.sk ?? null })),
        canhBao: pods.flatMap((p) => canhBao(tenMay(p.diaChi), p.sk as SucKhoe | undefined)),
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
      const laMcp = url.pathname === '/api/quantri/mcp';
      const mTt = url.pathname.match(/^\/api\/quantri\/baoloi\/(\d{1,12})\/trangthai$/);
      if (!dungKhoa(req) || req.method !== (laMcp || mTt ? 'POST' : 'GET')) {
        const x = sai.get(ip) ?? { n: 0, tu: t };
        x.n++; sai.set(ip, x);
        if (sai.size > 10_000) sai.clear();
        json(res, { error: 'Không có đường này' }, 404);
        return true;
      }
      if (laMcp) {
        docThan(req).then((than) => mcp(than)).then(({ status, body }) => {
          if (body === undefined) { res.writeHead(status); res.end(); return; }
          json(res, body, status);
        }).catch(() => { if (!res.headersSent) json(res, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); });
        return true;
      }
      // Báo lỗi: danh sách / ảnh / đổi trạng thái
      const bl = opts.baoLoi?.() ?? null;
      const mAnh = url.pathname.match(/^\/api\/quantri\/baoloi\/(\d{1,12})\/anh$/);
      if (mAnh || mTt || url.pathname === '/api/quantri/baoloi') {
        if (!bl) { json(res, { loi: 'chưa bật báo lỗi (cần MySQL)' }, 503); return true; }
        const loiSv = (e: unknown): void => { console.error('[quantri] báo lỗi:', (e as Error).message); if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500); };
        if (mAnh) {
          void bl.anh(Number(mAnh[1])).then((a) => {
            if (!a) { json(res, { error: 'Không có ảnh' }, 404); return; }
            res.writeHead(200, { 'Content-Type': a.loai, 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
            res.end(a.du);
          }).catch(loiSv);
        } else if (mTt) {
          docThan(req).then((b) => {
            const tt = String((b as { tt?: unknown } | null)?.tt ?? '');
            if (tt !== 'moi' && tt !== 'xem' && tt !== 'xong') { json(res, { error: 'tt phải là moi | xem | xong' }, 400); return; }
            return bl.datTrangThai(Number(mTt[1]), tt).then((ok) => json(res, { ok }));
          }).catch(loiSv);
        } else {
          const truoc = Number(url.searchParams.get('truoc')) || undefined;
          void bl.ds(30, truoc).then((ds) => { res.setHeader('Cache-Control', 'no-store'); json(res, { thu: ds }); }).catch(loiSv);
        }
        return true;
      }
      const m = url.pathname.match(/^\/api\/quantri\/phong\/([0-9]{6})$/);
      const sp = url.searchParams;
      const viec = url.pathname === '/api/quantri/cum' ? cum()
        : url.pathname === '/api/quantri/tong' ? tong()
        : url.pathname === '/api/quantri/phong' ? dsPhong().then((ds) => locPhong(ds, {
          trangThai: sp.get('trangThai') ?? undefined,
          congKhai: sp.has('congKhai') ? sp.get('congKhai') === '1' : undefined,
          boMa: sp.get('boMa') === '1'
        }))
        : m ? dsPhong(m[1]).then((ds) => ds[0] ?? null)
        : url.pathname === '/api/quantri/online' ? Promise.resolve({ luc: now(), nguoi: opts.nguoiOnline?.() ?? [] })
        : null;
      if (!viec) { json(res, { error: 'Không có đường này' }, 404); return true; }
      void viec.then((kq) => { res.setHeader('Cache-Control', 'no-store'); json(res, kq); })
        .catch((e) => { console.error('[quantri] lỗi:', (e as Error).message); if (!res.headersSent) json(res, { error: 'Lỗi server' }, 500); });
      return true;
    }
  };
}
