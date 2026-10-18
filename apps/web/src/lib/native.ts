/**
 * Chạy trong app gói (Capacitor) hay trong trình duyệt?
 *
 * Trong app, origin là `capacitor://localhost` (iOS) hoặc `https://localhost`
 * (Android) — không phải địa chỉ ai bấm vào được, và service worker cũng không
 * có ý nghĩa (web đã nằm sẵn trong app). Mọi chỗ cần "địa chỉ công khai của
 * game" dùng `SITE_URL` thay vì `location.origin`.
 *
 * ĐỪNG nhận ra app chỉ bằng giao thức: Android là `https:` y như trình duyệt,
 * nên bản cũ (chỉ xét giao thức) coi app Android là trang web — bật service
 * worker và in link mời `https://localhost/?room=…`. Cầu nối native của
 * Capacitor gắn `window.Capacitor` TRƯỚC khi script trang chạy, ở cả hai nền.
 */
interface CapBridge { isNativePlatform?: () => boolean; getPlatform?: () => string }
export const laApp = typeof location !== 'undefined' && (
  (globalThis as { Capacitor?: CapBridge }).Capacitor?.isNativePlatform?.() === true
  || !/^https?:$/.test(location.protocol)
);

/** Nền đang chạy: 'ios' | 'android' (app gói) hoặc 'web'. */
export const nenApp: 'ios' | 'android' | 'web' = (() => {
  if (!laApp) return 'web';
  const p = (globalThis as { Capacitor?: CapBridge }).Capacitor?.getPlatform?.();
  return p === 'android' ? 'android' : 'ios';
})();

/** Địa chỉ công khai của game (dùng cho link chia sẻ). Trong trình duyệt là chính origin. */
export const SITE_URL: string = laApp
  ? ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://flipmatch.cozypi.com').replace(/\/$/, '')
  : (typeof location === 'undefined' ? '' : location.origin);

/**
 * SERVER GAME RIÊNG (18.10.2026, chủ dự án: "nên làm server riêng từng game"): phòng online + tài
 * khoản đi `flipmatch-api.cozypi.com` (k8s), tên miền web chỉ còn là web (Worker). Ba tên miền web
 * chạy trên k8s đổi sang tên này; nơi khác (thebai2 — Worker + Durable Object dự phòng, localhost
 * khi thử dist) vẫn dùng chính origin. `/api` `/ws` trên tên web cũ VẪN CHẠY cho app cũ ngoài kia.
 */
export const API_RIENG = 'https://flipmatch-api.cozypi.com';
const WEB_TREN_K8S = ['flipmatch.cozypi.com', 'flipmatch.hello314.com', 'thebai.hello314.com'];
export const SERVER_URL: string = ((import.meta.env.VITE_SERVER_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:8787'
    : typeof location === 'undefined' ? ''
    : WEB_TREN_K8S.includes(location.hostname) ? API_RIENG : location.origin)).replace(/\/$/, '');
