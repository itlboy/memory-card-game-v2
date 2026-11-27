/**
 * TRA MÃ NGƯỜI CHƠI GA → TÊN (27.11.2026, chủ dự án: "log lên GA cả tên người dùng" → chọn cách gắn MÃ ẨN DANH lên GA,
 * bảng tra lưu TẬP TRUNG ở server). GA chỉ nhận mã (`user_id` + thuộc tính `ma_nguoi`), KHÔNG BAO GIỜ nhận tên — điều khoản
 * GA cấm thông tin định danh. Muốn biết mã đó là ai thì trang admin hỏi cổng này (khoá `THONGKE_KEY`, như /api/thongke/thidau).
 *
 * Dạng mã (app tự tính — lib/taikhoan.ts `maGa`):
 *   `u<id>`        người đã đăng nhập (id bảng `users`)
 *   `k<16 hex>`    khách: 16 ký tự đầu của `guest_scores.guest_hash` (sha256 của mã khách — server đã lưu sẵn)
 *
 *   GET /api/thongke/ten?ma=u12,k0123456789abcdef   header x-thongke-key   → { ten: { "u12": "Kiên", ... } }
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'mysql2/promise';

export function moTkTen(pool: Pool | null, env: { THONGKE_KEY?: string }) {
  const khoa = env.THONGKE_KEY?.trim() ?? '';
  return {
    xuLy(req: IncomingMessage, res: ServerResponse, url: URL, json: (res: ServerResponse, body: unknown, status?: number) => void): boolean {
      if (url.pathname !== '/api/thongke/ten') return false;
      const gui = String(req.headers['x-thongke-key'] ?? '');
      const dung = !!khoa && gui.length === khoa.length && timingSafeEqual(Buffer.from(gui), Buffer.from(khoa));
      if (!pool || !dung || req.method !== 'GET') { json(res, { loi: 'khongCo' }, 404); return true; }
      const ds = (url.searchParams.get('ma') ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 500);
      const uid = ds.filter((m) => /^u\d{1,12}$/.test(m)).map((m) => Number(m.slice(1)));
      const kh = ds.filter((m) => /^k[0-9a-f]{16}$/.test(m)).map((m) => m.slice(1));
      void (async () => {
        const ten: Record<string, string> = {};
        if (uid.length) {
          const [r] = await pool.query('SELECT id, COALESCE(ten_hien, name) AS ten FROM users WHERE id IN (?)', [uid]);
          for (const x of r as { id: number; ten: string }[]) ten[`u${x.id}`] = String(x.ten ?? '');
        }
        if (kh.length) {
          const [r] = await pool.query('SELECT LEFT(guest_hash, 16) AS ma, name FROM guest_scores WHERE LEFT(guest_hash, 16) IN (?)', [kh]);
          for (const x of r as { ma: string; name: string }[]) ten[`k${x.ma}`] = String(x.name ?? '');
        }
        json(res, { ten });
      })().catch((e) => json(res, { loi: (e as Error).message }, 500));
      return true;
    }
  };
}
