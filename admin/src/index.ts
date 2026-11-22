/**
 * admin.cozypi.com — trang thống kê Lật Thẻ. Đọc GA4; riêng ô Thi đấu đọc thống kê ẩn danh của server game (thidau.ts).
 *
 * Hai lớp khoá: Cloudflare Access chắn ở cạnh (policy "Chỉ Kiên"), Worker kiểm lại JWT của Access
 * cho MỌI đường (kể cả file tĩnh). Trang tải TỪNG Ô khi cuộn tới (`/api/o/<phan>`); số GA nhớ tạm ở
 * Cache API (xem api.ts) — mở trang ít thì gọi GA ít, không có tác vụ chạy nền nào.
 */
import { kiemAccess } from './access.ts';
import { tra, json, xuLyApi } from './api.ts';
import { Ga, type KhoaSa } from './ga.ts';
import { HTML, CSS, JS } from './trang.ts';
import { layThiDau } from './thidau.ts';

/** Mã phiên bản theo NỘI DUNG JS+CSS, gắn vào đường dẫn trong HTML. Lúc Cloudflare đang chuyển bản,
 *  HTML và app.js có thể tới từ hai bản khác nhau (đã gặp 17.11.2026: HTML mới + JS cũ → kẹt "đang tải");
 *  đường dẫn khác nhau theo bản thì trình duyệt không lấy nhầm file của bản kia từ cache. */
const PHIEN = (() => { let h = 5381; for (const c of JS + CSS) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); })();
const HTML_PHIEN = HTML.replaceAll('__PHIEN__', PHIEN);

interface Env {
  ACCESS_TEAM: string;
  ACCESS_AUD: string;
  GA_TZ: string;
  NGAY_CONG_KHAI: string;
  GA_SA_JSON?: string;
  GA_PROPERTY_ID?: string;
  /** Ô Thi đấu (thidau.ts): địa chỉ máy chủ game + khoá đọc thống kê (wrangler secret). */
  GAME_API?: string;
  THONGKE_KEY?: string;
}

function layGa(env: Env): Ga | null {
  if (!env.GA_SA_JSON || !env.GA_PROPERTY_ID) return null;
  try { return new Ga(JSON.parse(env.GA_SA_JSON) as KhoaSa, env.GA_PROPERTY_ID.trim()); } catch { return null; }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ai = await kiemAccess(req, env.ACCESS_TEAM, env.ACCESS_AUD).catch((e) => { console.log(`[access] lỗi: ${e instanceof Error ? e.message : e}`); return null; });
    const url = new URL(req.url);
    if (!ai) {
      // Phiên Access CŨ (vd trước khi đổi tên miền nhóm 17.11.2026: cổng Access vẫn cho qua nhưng khoá
      // của nhóm cũ đã mất) → xoá cookie rồi quay lại, cổng Access sẽ hiện trang đăng nhập. Chỉ làm MỘT
      // lần (cờ ?dn=1) để cấu hình sai thật không thành vòng lặp đăng nhập vô tận.
      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && req.headers.get('Cf-Access-Jwt-Assertion') && !url.searchParams.has('dn')) {
        return new Response(null, { status: 302, headers: {
          location: '/?dn=1',
          'set-cookie': 'CF_Authorization=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
          'cache-control': 'no-store'
        } });
      }
      return tra('Không có quyền. Trang này chỉ mở qua Cloudflare Access.', 'text/plain; charset=utf-8', 403);
    }

    if (req.method !== 'GET') return tra('Chỉ đọc.', 'text/plain; charset=utf-8', 405);
    switch (url.pathname) {
      case '/': return tra(HTML_PHIEN, 'text/html; charset=utf-8');
      case '/app.css': return tra(CSS, 'text/css; charset=utf-8');
      case '/app.js': return tra(JS, 'text/javascript; charset=utf-8');
    }

    // Ô Thi đấu KHÔNG qua GA — đứng trước nhánh GA để GA chưa nối / hết hạn mức thì ô này vẫn chạy
    if (url.pathname === '/api/thidau') return layThiDau(env, Number(url.searchParams.get('ngay')) || 30);

    if (url.pathname.startsWith('/api/')) {
      const ga = layGa(env);
      if (!ga) return json({ chuaCauHinh: true, email: ai.email }, 503);
      const kq = await xuLyApi(url, ga, env, ai.email, caches.default, (p) => ctx.waitUntil(p));
      if (kq) return kq;
    }
    return tra('Không có trang này.', 'text/plain; charset=utf-8', 404);
  }
} satisfies ExportedHandler<Env>;
