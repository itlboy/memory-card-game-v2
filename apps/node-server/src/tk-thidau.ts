import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Pool } from 'mysql2/promise';

/**
 * THỐNG KÊ THI ĐẤU (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục "Thống kê").
 * Máy chủ quyết định mọi bước của thi đấu nên ghi TỪNG SỰ KIỆN ở đây — chính xác hơn GA (không phụ thuộc trình chặn,
 * không mất khi app đóng). KHÔNG tên, KHÔNG email, KHÔNG IP: `who` là 12 ký tự băm từ danh tính sảnh, chỉ để nối các
 * bước của cùng một người (phễu, giữ chân). `country` lấy từ header Cloudflare, `platform`/`lang` do app khai.
 *
 * Sự kiện (`kind`): td_dot · td_hoi · td_tra_loi · td_chia · td_cho · td_chon_the · td_van · td_choi_lai · td_tat · td_push.
 * `data` là JSON nhỏ theo từng loại (xem thidau.ts / room). Ghi theo lô mỗi 5 giây; hỏng DB thì bỏ lô, không ảnh hưởng trận.
 *
 * Xem: `GET /api/thongke/thidau?ngay=30` kèm header `x-thongke-key` = env `THONGKE_KEY` (thiếu env → 404). Trả từng
 * dòng thô (ẩn danh) để dashboard tự cắt theo giờ / nền tảng / nước / người mới-cũ.
 */
export interface NguoiTk { who: string | null; platform: string; lang: string; country: string }
export interface TkThiDau {
  ghi(kind: string, nguoi: NguoiTk | null, data: Record<string, unknown>): void;
  xuLy(req: IncomingMessage, res: ServerResponse, url: URL, json: (res: ServerResponse, body: unknown, status?: number) => void): boolean;
  dong(): Promise<void>;
}

const TAO_BANG = `CREATE TABLE IF NOT EXISTS td_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at BIGINT NOT NULL,
  kind VARCHAR(16) NOT NULL,
  who CHAR(12) NULL,
  platform VARCHAR(8) NOT NULL DEFAULT '',
  lang VARCHAR(8) NOT NULL DEFAULT '',
  country CHAR(2) NOT NULL DEFAULT '',
  data VARCHAR(512) NOT NULL DEFAULT '{}',
  KEY k_at (at), KEY k_kind_at (kind, at)
) CHARACTER SET ascii`;

const sach = (v: string, n: number): string => v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, n);

export async function moTkThiDau(pool: Pool | null, env: { THONGKE_KEY?: string }, now: () => number = Date.now): Promise<TkThiDau> {
  if (pool) await pool.query(TAO_BANG);
  let lo: unknown[][] = [];
  async function xa(): Promise<void> {
    if (!pool || !lo.length) return;
    const gui = lo; lo = [];
    try { await pool.query('INSERT INTO td_events (at, kind, who, platform, lang, country, data) VALUES ?', [gui]); }
    catch (e) { console.error('[tk-thidau] không ghi được:', (e as Error).message); }
  }
  const nhip = setInterval(() => { void xa(); }, 5_000);
  nhip.unref?.();
  const khoa = env.THONGKE_KEY?.trim() ?? '';

  return {
    ghi(kind, ng, data) {
      // Log một dòng cho mọi sự kiện: không có MySQL (máy dev) vẫn soát được luồng
      console.log(`[thidau] ${kind} ${ng?.who ?? '-'} ${JSON.stringify(data)}`);
      if (!pool || lo.length > 2000) return;
      // JSON.stringify thoát mọi ký tự ngoài ASCII? KHÔNG — nên chỉ đưa số/chuỗi ASCII vào `data` (thidau.ts không ghi tên)
      const d = JSON.stringify(data).replace(/[^\x20-\x7e]/g, '?').slice(0, 512);
      lo.push([now(), sach(kind, 16), ng?.who ? sach(ng.who, 12) : null, sach(ng?.platform ?? '', 8), sach(ng?.lang ?? '', 8), sach(ng?.country ?? '', 2).toUpperCase(), d]);
    },
    xuLy(req, res, url, json) {
      if (url.pathname !== '/api/thongke/thidau') return false;
      const gui = String(req.headers['x-thongke-key'] ?? '');
      const dung = !!khoa && gui.length === khoa.length && timingSafeEqual(Buffer.from(gui), Buffer.from(khoa));
      if (!pool || !dung || req.method !== 'GET') { json(res, { loi: 'khongCo' }, 404); return true; }
      const ngay = Math.min(90, Math.max(1, Number(url.searchParams.get('ngay')) || 30));
      void xa().then(() => pool.query('SELECT at, kind, who, platform, lang, country, data FROM td_events WHERE at >= ? ORDER BY at LIMIT 200000', [now() - ngay * 86_400_000]))
        .then(([rows]) => json(res, { ngay, ds: (rows as Record<string, unknown>[]).map((r) => [Number(r.at), r.kind, r.who, r.platform, r.lang, r.country, r.data]) }))
        .catch((e) => json(res, { loi: (e as Error).message }, 500));
      return true;
    },
    async dong() { clearInterval(nhip); await xa(); }
  };
}
