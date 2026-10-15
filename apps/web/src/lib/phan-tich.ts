import { laApp, nenApp } from './native';
import { store } from './storage';

/**
 * GOOGLE ANALYTICS 4 — game web + app (app nhận qua cập nhật nóng, không cần bản store).
 * Chủ dự án chốt 15.10.2026: dùng GA4, KHÔNG có hộp hỏi cookie.
 *
 * Cấu hình cố định (đừng nới): tắt Google Signals + cá nhân hoá quảng cáo, không gửi
 * dữ liệu cá nhân (tên, email, mã tài khoản). Người ở CHÂU ÂU (đoán theo múi giờ) chạy
 * KHÔNG COOKIE (`analytics_storage: denied` — GA vẫn đếm lượt ẩn danh), để không cần hộp
 * hỏi đồng ý. Trong app (capacitor://, https://localhost) không có cookie bền → dùng mã
 * ẩn danh sẵn có của máy (`store.clientId()`) làm client_id, và gán địa chỉ trang giả
 * định trên tên miền thật để báo cáo không lẫn "localhost".
 *
 * KHÔNG chạy: chưa có mã đo lường, đang test/phát triển cục bộ, hay trình duyệt tự động
 * (`navigator.webdriver` — công cụ đo và chụp ảnh store) — không làm bẩn số liệu.
 * Trang quyền riêng tư (mục "Usage analytics") phải khớp với những gì gửi ở đây.
 */
export const GA_ID = 'G-MZ4MDWZRH3';   // tài khoản GA "Cozy Pi" → thuộc tính "Flip Match" (15.10.2026)

type Gtag = (...a: unknown[]) => void;
let gtag: Gtag | null = null;

const chauAu = (): boolean => {
  try { return /^(Europe|Atlantic\/(Reykjavik|Canary|Madeira|Faroe|Azores))/.test(Intl.DateTimeFormat().resolvedOptions().timeZone); }
  catch { return false; }
};

export function batPhanTich(): void {
  if (gtag || !/^G-[A-Z0-9]{6,}$/.test(GA_ID) || typeof window === 'undefined') return;
  if (import.meta.env.MODE === 'test' || import.meta.env.DEV || navigator.webdriver) return;
  if (!laApp && /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  // gtag CHUẨN đẩy `arguments`, không phải mảng — đổi sang mảng là GA bỏ qua lệnh
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function () { w.dataLayer.push(arguments); };
  gtag = w.gtag;
  const eu = chauAu();
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: eu ? 'denied' : 'granted'
  });
  gtag('js', new Date());
  gtag('config', GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(laApp ? {
      client_id: store.clientId(),
      client_storage: 'none',
      page_location: `https://flipmatch.cozypi.com/app/${nenApp}`
    } : {})
  });
  gtag('set', 'user_properties', { nen_tang: nenApp, ban_web: __OTA_ID__ });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

/** Một sự kiện. Tên snake_case ≤ 40 ký tự, tham số là số/chuỗi ngắn — KHÔNG dữ liệu cá nhân. */
export function suKien(ten: string, thamSo: Record<string, string | number | boolean | undefined> = {}): void {
  if (!gtag) return;
  try { gtag('event', ten, { nen_tang: nenApp, ...thamSo }); } catch { /* không bao giờ làm hỏng game */ }
}
