/**
 * Đường /api/* — tách khỏi index.ts để test được bằng node (không cần Access, không cần runtime Worker).
 *
 * Nhớ tạm hai tầng ở Cache API (cạnh Cloudflare, khoá là URL nội bộ chỉ Worker đọc được):
 *   - bản TƯƠI: kỳ đã qua 1 giờ, kỳ có hôm nay 5 phút, thời gian thực 1 phút (ô có lỗi báo cáo: ≤ 1 phút);
 *   - bản CŨ: 24 giờ, chỉ dùng khi GA hỏng/bận → trả kèm `cu: true`. Không có bản cũ thì 429/503 + Retry-After
 *     để trang tự thử lại (19.11.2026: trước đây ô lỗi không được nhớ → mỗi lần tải lại bắn lại hết → 429 mãi).
 */
import { GaLoi, type Ga } from './ga.ts';
import { lapKeHoach } from './khoang.ts';
import { dangDienRa, laPhan, motO, PHAN } from './thongke.ts';
import { tangTruong } from './tangtruong.ts';

export const AN_TOAN: Record<string, string> = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'private, no-store'
};

export const tra = (body: BodyInit, type: string, status = 200, them: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, ...AN_TOAN, ...them } });
export const json = (o: unknown, status = 200, them: Record<string, string> = {}) =>
  tra(JSON.stringify(o), 'application/json; charset=utf-8', status, them);

/** Phần của Cache API mà code này dùng — test đưa bản giả vào. */
export interface KhoNho {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}

export const GIAY_CU = 86400;

/**
 * Bản tươi còn hạn → trả luôn. Hết hạn (hoặc `boQua`) → hỏi GA; GA hỏng thì lấy bản cũ (≤ 24 giờ) với
 * `cu: true`, không có bản cũ thì ném lỗi gốc. Kết quả có ô lỗi (`loi` khác rỗng): nhớ tươi tối đa 1 phút
 * (sửa xong mở lại sớm thấy) và KHÔNG đè bản cũ đầy đủ.
 */
export async function nho<T>(kho: KhoNho, khoa: string, giay: number, boQua: boolean, lam: () => Promise<T>,
  cho: (p: Promise<unknown>) => void): Promise<{ data: T; cu: boolean }> {
  const k = encodeURIComponent(khoa);
  const reqTuoi = new Request(`https://admin.cozypi.com/__nho/${k}`);
  const reqCu = new Request(`https://admin.cozypi.com/__cu/${k}`);
  if (!boQua) {
    const co = await kho.match(reqTuoi);
    if (co) return { data: (await co.json()) as T, cu: false };
  }
  let kq: T;
  try {
    kq = await lam();
  } catch (e) {
    const cu = await kho.match(reqCu).catch(() => undefined);
    if (cu) {
      console.log(`[ga] ${khoa}: dùng bản cũ — ${e instanceof Error ? e.message.slice(0, 200) : e}`);
      return { data: (await cu.json()) as T, cu: true };
    }
    throw e;
  }
  const coLoi = Object.keys((kq as { loi?: Record<string, string> }).loi ?? {}).length > 0;
  const than = JSON.stringify(kq);
  cho(kho.put(reqTuoi, new Response(than, { headers: { 'cache-control': `max-age=${coLoi ? Math.min(giay, 60) : giay}` } })));
  if (!coLoi) cho(kho.put(reqCu, new Response(than, { headers: { 'cache-control': `max-age=${GIAY_CU}` } })));
  return { data: kq, cu: false };
}

/** GA hỏng mà không có bản cũ: bận → 503 thử lại sau vài giây; hết hạn mức giờ/ngày → 429 tới đầu giờ sau. */
export function traLoiGa(e: unknown, now = Date.now()): Response {
  const msg = e instanceof Error ? e.message.slice(0, 300) : 'lỗi';
  if (e instanceof GaLoi && e.loai === 'ban') {
    return json({ loiChung: 'GA đang bận (quá nhiều yêu cầu cùng lúc) — tự thử lại sau ít giây.', ban: true }, 503, { 'retry-after': '5' });
  }
  if (e instanceof GaLoi && e.loai === 'het_quota') {
    const giay = /day|daily/i.test(msg) ? 3600 : Math.max(60, 3600 - Math.floor(now / 1000) % 3600);
    return json({ loiChung: 'Hết hạn mức GA trong giờ/ngày — số sẽ có lại sau.', hetQuota: true }, 429, { 'retry-after': String(giay) });
  }
  return json({ loiChung: msg }, 502);
}

export interface EnvApi { GA_TZ: string; NGAY_CONG_KHAI: string }

/** Trả lời một đường /api/*; null = không phải đường API nào. */
export async function xuLyApi(url: URL, ga: Ga, env: EnvApi, email: string, kho: KhoNho,
  cho: (p: Promise<unknown>) => void, now = new Date()): Promise<Response | null> {
  const boQua = url.searchParams.get('moi') === '1';
  try {
    if (url.pathname === '/api/dang-dien-ra') {
      const { data, cu } = await nho(kho, 'ddr3', 60, boQua, () => dangDienRa(ga), cho);
      return json({ ...data, cu });
    }
    if (url.pathname === '/api/tangtruong') {
      // Tab Tăng trưởng: luôn 28 ngày trọn tới hôm qua → khoá theo NGÀY (múi GA), nhớ 1 giờ
      const ngay = new Intl.DateTimeFormat('en-CA', { timeZone: env.GA_TZ }).format(now);
      const { data, cu } = await nho(kho, `tt1:${ngay}`, 3600, boQua, () => tangTruong(ga, now, env.GA_TZ), cho);
      return json({ ...data, cu });
    }
    const m = /^\/api\/o\/([a-z_]+)$/.exec(url.pathname);
    if (m) {
      const phan = m[1]!;
      if (!laPhan(phan)) return json({ loiChung: `Không có ô "${phan}". Có: ${PHAN.join(', ')}` }, 404);
      const q = url.searchParams;
      const kh = lapKeHoach({ khoang: q.get('khoang') ?? undefined, hat: q.get('hat') ?? undefined,
        tu: q.get('tu') ?? undefined, den: q.get('den') ?? undefined }, now, env.GA_TZ, env.NGAY_CONG_KHAI);
      // Khoá theo KẾ HOẠCH đã chuẩn hoá + giờ cuối (24h lúc 10h khác 24h lúc 11h). Chỉ ô biểu đồ phụ thuộc hạt
      // (độ mịn cột) — ô khác bỏ hạt khỏi khoá để đổi hạt không hỏi lại GA.
      const khoa = `o:${phan}:${kh.khoang}:${kh.ky.startDate}:${kh.ky.endDate}:${kh.gio?.at(-1) ?? ''}`
        + (phan === 'chuoi' ? `:${kh.hat}:${kh.cot.at(-1)?.k ?? ''}` : '');
      const giay = kh.realtime ? 60 : kh.dangChay ? 300 : 3600;
      const { data, cu } = await nho(kho, khoa, giay, boQua, () => motO(ga, kh, phan), cho);
      return json({ ...data, cu, email });
    }
  } catch (e) {
    return traLoiGa(e);
  }
  return null;
}
