/**
 * GỢI Ý CÀI APP STORE trên web điện thoại (07.11.2026, mockup A chủ dự án duyệt:
 * https://claude.ai/artifact/F8E7g9e1TnHuqhJGWfTriF). App đã lên Google Play (03.11) và
 * App Store (07.11) nên thẻ này THAY viên "Cài như app" (thêm web vào màn hình chính,
 * lib/cai-app.ts) trên trang chủ — hai lời mời cài cùng màn là rối. Hướng dẫn thêm vào
 * màn hình chính vẫn còn trong Luật chơi và `/?cai=1`.
 *
 * - Android (mọi trình duyệt, kể cả Zalo/Facebook nhúng) → Google Play.
 * - iPhone/iPad KHÔNG phải Safari (Chrome, Firefox, trình duyệt nhúng) → App Store.
 * - Safari iOS: KHÔNG hiện — Safari tự vẽ Smart App Banner từ thẻ meta `apple-itunes-app`
 *   (index.html), hiện thêm thẻ này là hai thanh mời cùng lúc.
 * - Không hiện trong app (`laApp`), bản web đã cài (`daCai`), máy tính.
 * - ✕ là ẩn 30 ngày trên máy đó.
 */
import { ref } from 'vue';
import { daCai, heMay, trongAppKhac } from './cai-app';
import { laApp } from './native';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const safariIos = heMay === 'ios' && !trongAppKhac && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(ua);

export const STORE_APP = {
  android: { ten: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.cozypi.flipmatch' },
  ios: { ten: 'App Store', url: 'https://apps.apple.com/app/id6822105774' },
} as const;

/** Store cho máy này, hoặc null khi không nên gợi ý. */
export const storeGoiY = laApp || daCai || heMay === 'khac' || safariIos ? null : STORE_APP[heMay];

const KHOA = 'mm.anGoiYApp';
const NGAY_AN = 30;
const docAn = (): boolean => {
  try { const t = Number(localStorage.getItem(KHOA)); return t > 0 && Date.now() - t < NGAY_AN * 864e5; } catch { return false; }
};
export const anGoiYApp = ref(docAn());
export function tatGoiYApp(): void {
  anGoiYApp.value = true;
  try { localStorage.setItem(KHOA, String(Date.now())); } catch { /* chế độ riêng tư */ }
}
