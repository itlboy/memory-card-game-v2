import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type { Pool } from 'mysql2/promise';

/**
 * BÁO LỖI / GÓP Ý TRONG APP (28.11.2026, mockup duyệt https://claude.ai/artifact/QUH5duZnNP6ZJ7kS8Q78BJ).
 *
 *   POST /api/baoloi   { loai, noi, vanDe[], noiDung?, email?, anh?, may{…}, cid? }  → { ok: true, id }
 *
 * Người chơi chạm chọn là chính (loại, ở đâu, chuyện gì xảy ra) — chữ, ảnh, email KHÔNG bắt buộc. App gửi kèm thông tin
 * máy / màn hình / bản app / chẩn đoán (`may`, xem apps/web/src/lib/bao-loi.ts), KHÔNG gửi tên người chơi.
 * Đọc: API quản trị `/api/quantri/baoloi*` (quantri.ts) → trang admin tab Kỹ thuật, MCP `bao_loi`.
 *
 * CHỐNG SPAM: mỗi máy (cid) và mỗi IP tối đa `TOI_DA_GIO` thư / giờ (đếm trong RAM của pod; nhiều pod thì trần nhân theo
 * số pod — chấp nhận được). IP chỉ dùng dạng băm để đếm, KHÔNG lưu xuống database.
 */
export const LOAI = ['loi', 'gopy', 'hoi'] as const;
export const NOI = ['motMinh', 'may', 'online', 'timThe', 'chienDich', 'premium', 'khac'] as const;
export const VAN_DE = ['dung', 'vang', 'matKetNoi', 'hienThi', 'diemSai', 'cham', 'amThanh', 'khac',
  'tinhNang', 'giaoDien', 'doKho'] as const;
const TOI_DA_GIO = 5;
const ANH_TOI_DA = 800 * 1024;
const THAN_TOI_DA = 1.3 * 1024 * 1024;

const TAO_BANG = `CREATE TABLE IF NOT EXISTS bug_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at BIGINT NOT NULL,
  kind VARCHAR(8) NOT NULL,
  place VARCHAR(16) NOT NULL,
  issues VARCHAR(255) NOT NULL DEFAULT '',
  body TEXT NULL,
  email VARCHAR(190) NULL,
  device TEXT NULL,
  image MEDIUMBLOB NULL,
  image_type VARCHAR(16) NULL,
  status VARCHAR(8) NOT NULL DEFAULT 'moi',
  KEY k_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export interface BaoLoi {
  xuLy(req: IncomingMessage, res: ServerResponse, url: URL, json: (res: ServerResponse, body: unknown, status?: number) => void): boolean;
  /** Cho quantri.ts: danh sách mới nhất (không kèm ảnh). */
  ds(gioiHan: number, tuId?: number): Promise<unknown[]>;
  /** Cho quantri.ts: ảnh của một thư. */
  anh(id: number): Promise<{ loai: string; du: Buffer } | null>;
  /** Cho quantri.ts: đánh dấu đã xem / đã xử lý. */
  datTrangThai(id: number, tt: 'moi' | 'xem' | 'xong'): Promise<boolean>;
}

function docThan(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((ok) => {
    const ds: Buffer[] = [];
    let n = 0;
    req.on('data', (c: Buffer) => { n += c.length; if (n > THAN_TOI_DA) { req.destroy(); ok(null); } else ds.push(c); });
    req.on('end', () => { try { const v = JSON.parse(Buffer.concat(ds).toString('utf8')) as unknown; ok(v && typeof v === 'object' ? v as Record<string, unknown> : null); } catch { ok(null); } });
    req.on('error', () => ok(null));
  });
}

/** Chữ người gõ: bỏ ký tự điều khiển (giữ xuống dòng), cắt độ dài. */
const sachChu = (v: unknown, n: number): string => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);

/** Thông tin máy: chỉ giữ khoá/giá trị đơn giản (chữ ≤ 300, số, bool, mảng chữ ngắn), tối đa ~6 KB. */
function sachMay(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  const ra: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof x === 'number' && Number.isFinite(x)) ra[k] = x;
    else if (typeof x === 'boolean') ra[k] = x;
    else if (typeof x === 'string') ra[k] = sachChu(x, 300);
    else if (Array.isArray(x)) ra[k] = x.slice(0, 20).map((y) => sachChu(typeof y === 'string' ? y : JSON.stringify(y), 300));
  }
  const s = JSON.stringify(ra);
  return s.length > 6000 ? s.slice(0, 6000) : s;
}

export async function moBaoLoi(pool: Pool | null, now: () => number = Date.now): Promise<BaoLoi | null> {
  if (!pool) return null;
  await pool.query(TAO_BANG);
  const dem = new Map<string, number[]>();
  function quaGioiHan(khoa: string, t: number): boolean {
    const ds = (dem.get(khoa) ?? []).filter((x) => x > t - 3_600_000);
    if (ds.length >= TOI_DA_GIO) { dem.set(khoa, ds); return true; }
    ds.push(t); dem.set(khoa, ds);
    if (dem.size > 20_000) dem.clear();
    return false;
  }

  return {
    xuLy(req, res, url, json) {
      if (url.pathname !== '/api/baoloi') return false;
      if (req.method !== 'POST') { json(res, { loi: 'phuongThuc' }, 405); return true; }
      void (async () => {
        const b = await docThan(req);
        if (!b) { json(res, { loi: 'sai' }, 400); return; }
        const loai = String(b.loai ?? '');
        const noi = String(b.noi ?? '');
        if (!(LOAI as readonly string[]).includes(loai) || !(NOI as readonly string[]).includes(noi)) { json(res, { loi: 'sai' }, 400); return; }
        const vanDe = Array.isArray(b.vanDe) ? [...new Set(b.vanDe.map(String))].filter((x) => (VAN_DE as readonly string[]).includes(x)) : [];
        const noiDung = sachChu(b.noiDung, 2000);
        if (!vanDe.length && !noiDung && loai !== 'hoi') { json(res, { loi: 'trong' }, 400); return; }
        const emailTho = sachChu(b.email, 190);
        const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTho) ? emailTho : null;
        let anh: Buffer | null = null, loaiAnh: string | null = null;
        const m = typeof b.anh === 'string' ? b.anh.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
        if (m) {
          const du = Buffer.from(m[2]!, 'base64');
          if (du.length > ANH_TOI_DA) { json(res, { loi: 'anhLon' }, 413); return; }
          anh = du; loaiAnh = m[1]!;
        }
        const t = now();
        const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '');
        const ipBam = createHash('sha256').update(`bl:${ip}`).digest('hex').slice(0, 16);
        const cid = sachChu(b.cid, 64);
        if (quaGioiHan(`ip:${ipBam}`, t) || (cid && quaGioiHan(`c:${cid}`, t))) { json(res, { loi: 'nhieuQua' }, 429); return; }
        try {
          const [kq] = await pool.execute(
            'INSERT INTO bug_reports (at, kind, place, issues, body, email, device, image, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [t, loai, noi, vanDe.join(','), noiDung || null, email, sachMay(b.may), anh, loaiAnh]
          );
          const id = Number((kq as { insertId: number }).insertId);
          console.log(`[baoloi] #${id} ${loai} ${noi} ${vanDe.join(',')}${anh ? ' +ảnh' : ''}`);
          json(res, { ok: true, id });
        } catch (e) {
          console.error('[baoloi] ghi lỗi:', (e as Error).message);
          json(res, { loi: 'server' }, 500);
        }
      })();
      return true;
    },
    async ds(gioiHan, tuId) {
      const [rows] = await pool.query(
        `SELECT id, at, kind, place, issues, body, email, device, image IS NOT NULL AS has_image, status FROM bug_reports
         ${tuId ? 'WHERE id < ?' : ''} ORDER BY id DESC LIMIT ?`,
        tuId ? [tuId, gioiHan] : [gioiHan]
      );
      return (rows as Record<string, unknown>[]).map((r) => {
        let may: unknown = null;
        try { may = r.device ? JSON.parse(String(r.device)) : null; } catch { /* để null */ }
        return {
          id: Number(r.id), luc: Number(r.at), loai: r.kind, noi: r.place,
          vanDe: String(r.issues ?? '').split(',').filter(Boolean), noiDung: r.body ?? '', email: r.email ?? null,
          may, coAnh: !!Number(r.has_image), trangThai: r.status
        };
      });
    },
    async anh(id) {
      const [rows] = await pool.query('SELECT image, image_type FROM bug_reports WHERE id = ? AND image IS NOT NULL', [id]);
      const r = (rows as { image: Buffer; image_type: string }[])[0];
      return r ? { loai: r.image_type, du: r.image } : null;
    },
    async datTrangThai(id, tt) {
      const [kq] = await pool.execute('UPDATE bug_reports SET status = ? WHERE id = ?', [tt, id]);
      return ((kq as { affectedRows?: number }).affectedRows ?? 0) > 0;
    }
  };
}
