/**
 * admin.cozypi.com — trang thống kê Lật Thẻ. CHỈ ĐỌC GA4, không chạm MySQL hay server game.
 *
 * Hai lớp khoá: Cloudflare Access chắn ở cạnh (policy "Chỉ Kiên"), Worker kiểm lại JWT của Access
 * cho MỌI đường (kể cả file tĩnh). Số GA nhớ tạm ở Cache API: kỳ đã qua 1 giờ, kỳ có hôm nay
 * 5 phút, thời gian thực 1 phút — mở trang ít thì gọi GA ít, không có tác vụ chạy nền nào.
 */
import { kiemAccess } from './access.ts';
import { Ga, type KhoaSa } from './ga.ts';
import { lapKeHoach } from './khoang.ts';
import { dangDienRa, tongQuan } from './thongke.ts';
import { HTML, CSS, JS } from './trang.ts';

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
}

const AN_TOAN: Record<string, string> = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'private, no-store'
};

const tra = (body: BodyInit, type: string, status = 200, them: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, ...AN_TOAN, ...them } });
const json = (o: unknown, status = 200) => tra(JSON.stringify(o), 'application/json; charset=utf-8', status);

function layGa(env: Env): Ga | null {
  if (!env.GA_SA_JSON || !env.GA_PROPERTY_ID) return null;
  try { return new Ga(JSON.parse(env.GA_SA_JSON) as KhoaSa, env.GA_PROPERTY_ID.trim()); } catch { return null; }
}

/** Nhớ tạm kết quả GA ở cache của cạnh Cloudflare. Khoá cache là URL nội bộ, chỉ Worker đọc được. */
async function nho<T>(khoa: string, giay: number, boQua: boolean, lam: () => Promise<T>, ctx: ExecutionContext): Promise<T> {
  const cache = caches.default;
  const req = new Request(`https://admin.cozypi.com/__nho/${encodeURIComponent(khoa)}`);
  if (!boQua) {
    const co = await cache.match(req);
    if (co) return co.json() as Promise<T>;
  }
  const kq = await lam();
  // Có ô lỗi (GA trục trặc, chưa đăng ký dimension) thì KHÔNG nhớ — sửa xong mở lại là thấy ngay.
  const coLoi = Object.keys((kq as { loi?: Record<string, string> }).loi ?? {}).length > 0;
  if (!coLoi) ctx.waitUntil(cache.put(req, new Response(JSON.stringify(kq), { headers: { 'cache-control': `max-age=${giay}` } })));
  return kq;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ai = await kiemAccess(req, env.ACCESS_TEAM, env.ACCESS_AUD).catch(() => null);
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

    if (url.pathname.startsWith('/api/')) {
      const ga = layGa(env);
      if (!ga) return json({ chuaCauHinh: true, email: ai.email }, 503);
      const boQua = url.searchParams.get('moi') === '1';
      try {
        if (url.pathname === '/api/dang-dien-ra') {
          return json(await nho('ddr2', 60, boQua, () => dangDienRa(ga), ctx));
        }
        if (url.pathname === '/api/tong-quan') {
          const q = url.searchParams;
          const kh = lapKeHoach({ khoang: q.get('khoang') ?? undefined, hat: q.get('hat') ?? undefined,
            tu: q.get('tu') ?? undefined, den: q.get('den') ?? undefined }, new Date(), env.GA_TZ, env.NGAY_CONG_KHAI);
          // Khoá cache theo KẾ HOẠCH (đã chuẩn hoá) + giờ hiện tại cho kỳ theo giờ — 24h lúc 10h khác 24h lúc 11h.
          const khoa = `tq:${kh.khoang}:${kh.hat}:${kh.ky.startDate}:${kh.ky.endDate}:${kh.cot.at(-1)?.k ?? ''}`;
          const giay = kh.realtime ? 60 : kh.dangChay ? 300 : 3600;
          return json({ ...(await nho(khoa, giay, boQua, () => tongQuan(ga, kh), ctx)), email: ai.email });
        }
      } catch (e) {
        return json({ loiChung: e instanceof Error ? e.message.slice(0, 300) : 'lỗi' }, 502);
      }
    }
    return tra('Không có trang này.', 'text/plain; charset=utf-8', 404);
  }
} satisfies ExportedHandler<Env>;
