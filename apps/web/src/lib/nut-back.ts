import { nenApp } from './native';
import { t } from './i18n';

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
 * lần nữa trong 2 giây mới thoát, cho khỏi lỡ tay. iOS không có nút Back hệ thống;
 * cử chỉ vuốt lùi bật ở native (`allowsBackForwardNavigationGestures`, SceneDelegate.swift).
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
