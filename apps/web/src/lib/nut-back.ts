import { nenApp } from './native';
import { t } from './i18n';
import { coTheLui } from '@/composables/useBackGuard';

/**
 * NÚT BACK CỦA ANDROID trong app gói (chủ dự án báo 14.10.2026: "bấm Back ở wizard
 * là thoát app").
 *
 * Vì sao: KHÔNG có plugin `@capacitor/app` thì Capacitor không chuyển nút Back vào
 * WebView — Android đóng activity luôn, bỏ qua cơ chế "một chốt lịch sử" mà web đã
 * dựng cho Back (composables/useBackGuard.ts). Trên trình duyệt cơ chế đó vẫn đúng.
 *
 * Nay: còn lịch sử để lùi (`canGoBack` = có chốt) → `history.back()`, useBackGuard
 * đóng đúng MỘT thứ như trên web. Không còn gì (trang chủ) → hỏi một nhịp: Back
 * lần nữa trong 2 giây mới thoát, cho khỏi lỡ tay. iOS không có nút Back hệ thống:
 * xem `ganVuotLuiIos` bên dưới.
 */
const CUA_SO_MS = 2000;

export function ganNutBackAndroid(): void {
  if (nenApp !== 'android') return;
  void import('@capacitor/app').then(({ App }) => {
    let lanTruoc = 0;
    void App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) { history.back(); return; }
      const bay = Date.now();
      if (bay - lanTruoc < CUA_SO_MS) { void App.exitApp(); return; }
      lanTruoc = bay;
      baoThoat();
    });
  }).catch(() => { /* không có plugin — giữ hành vi mặc định */ });
}

function baoThoat(): void {
  document.querySelector('.bao-thoat')?.remove();
  const el = document.createElement('div');
  el.className = 'bao-thoat';
  el.setAttribute('role', 'status');
  el.textContent = t('chung.backThoat');
  (document.getElementById('app') ?? document.body).appendChild(el);
  setTimeout(() => el.remove(), CUA_SO_MS);
}

/**
 * VUỐT TỪ MÉP TRÁI ĐỂ LÙI trong app iOS (chủ dự án 25.10.2026).
 *
 * Không dùng cử chỉ có sẵn của WKWebView (`allowsBackForwardNavigationGestures`): nó
 * trượt vào ẢNH CHỤP CŨ của mục lịch sử trước rồi gỡ ảnh trước khi app vẽ lại — vào
 * Chiến dịch vuốt lùi thì thấy trang chủ, trang Chiến dịch nháy lên, rồi mới về trang
 * chủ; giữa ván còn trượt ảnh wizard vào trong khi thật ra chỉ hiện hộp hỏi thoát.
 * Tự làm thì không có ảnh chụp: kéo đủ xa rồi thả là `history.back()`, đi đúng chốt
 * của useBackGuard như nút Back Android. Không còn gì để lùi (trang chủ) thì không bắt.
 */
const MEP_PX = 24;
const NGUONG_PX = 64;

export function ganVuotLuiIos(): void {
  if (nenApp !== 'ios') return;
  let dang = false;
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let mui: HTMLElement | null = null;
  const thoi = () => { dang = false; mui?.remove(); mui = null; };
  const tuyChon = { passive: true, capture: true } as const;

  document.addEventListener('touchstart', (e) => {
    const ch = e.touches[0];
    if (e.touches.length !== 1 || !ch || ch.clientX > MEP_PX || !coTheLui()) return;
    dang = true; x0 = ch.clientX; y0 = ch.clientY; dx = 0;
  }, tuyChon);

  document.addEventListener('touchmove', (e) => {
    const ch = e.touches[0];
    if (!dang || !ch) return;
    dx = ch.clientX - x0;
    const dy = Math.abs(ch.clientY - y0);
    if (dy > 40 && dy > dx) { thoi(); return; } // vuốt dọc, không phải lùi
    if (dx <= 8) return;
    if (!mui) {
      mui = document.createElement('div');
      mui.className = 'vuot-lui';
      mui.setAttribute('aria-hidden', 'true');
      mui.textContent = '‹';
      document.body.appendChild(mui);
    }
    mui.style.top = `${ch.clientY}px`;
    mui.style.setProperty('--k', String(Math.min(dx / NGUONG_PX, 1)));
    mui.classList.toggle('du', dx >= NGUONG_PX);
  }, tuyChon);

  document.addEventListener('touchend', () => {
    if (dang && dx >= NGUONG_PX && coTheLui()) history.back();
    thoi();
  }, tuyChon);
  document.addEventListener('touchcancel', thoi, tuyChon);
}
