/**
 * Chạy trong app gói (Capacitor) hay trong trình duyệt?
 *
 * Trong app, origin là `capacitor://localhost` — không phải địa chỉ ai bấm vào
 * được, và service worker cũng không có ý nghĩa (web đã nằm sẵn trong app).
 * Mọi chỗ cần "địa chỉ công khai của game" dùng `SITE_URL` thay vì
 * `location.origin`.
 */
export const laApp = typeof location !== 'undefined' && !/^https?:$/.test(location.protocol);

/** Địa chỉ công khai của game (dùng cho link chia sẻ). Trong trình duyệt là chính origin. */
export const SITE_URL: string = laApp
  ? ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://thebai.hello314.com').replace(/\/$/, '')
  : (typeof location === 'undefined' ? '' : location.origin);
