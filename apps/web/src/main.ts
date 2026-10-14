import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';
import App from './App.vue';
import { sfx } from './lib/audio';
import { nhac } from './lib/nhac';
import { laApp } from './lib/native';
import { ganNutBackAndroid } from './lib/nut-back';
import './styles/fonts';   // font đóng gói sẵn — xem styles/fonts.ts
import './styles/global.css';
import './styles/card-backs.css';
import './styles/theme-grid.css';
import './styles/ketcuc-fx.css';
import './styles/skins/keo.css';
import './styles/skins/go.css';
import './styles/skins/neon.css';
import { ganSkin } from './lib/skin';

// iOS Safari bỏ qua user-scalable=no — chặn pinch-zoom bằng gesture event
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

// Cache app shell để rời app rồi quay lại là hiện ngay (mobile hay giải phóng
// tab); bản mới tự thay khi có deploy. Thiếu SW cũng không sao — app vẫn chạy.
// Trong app iOS gói bằng Capacitor web nằm sẵn trong máy, SW chỉ thêm một lớp cache lệch bản.
if (!laApp) void registerSW({ immediate: true });

// Mở sẵn cho console: `sfx.volume = 2.5` để thử âm lượng (giá trị được nhớ lại).
// Không có dòng này thì `sfx` chỉ là biến trong module, console không thấy.
(window as unknown as { sfx: typeof sfx }).sfx = sfx;
// Tương tự cho nhạc nền: `nhac.dung()` / `nhac.chay('van')` để nghe thử hai tâm trạng
(window as unknown as { nhac: typeof nhac }).nhac = nhac;

// Skin gắn TRƯỚC khi mount: không loé giao diện mặc định một khung hình
ganSkin();
createApp(App).mount('#app');

// MÀN CHỜ (app): giữ tới khi game vẽ xong khung đầu rồi mờ dần — cả iOS lẫn Android.
// Không có bước này thì iOS bỏ màn chờ ngay lúc WebView mở, trước khi game kịp vẽ,
// nên người chơi gần như không thấy nó (Android thì thấy) — chủ dự án báo 14.10.2026.
// Hai rAF = sau khi trình duyệt THẬT SỰ vẽ. capacitor.config có chốt 3 giây phòng JS lỗi.
ganNutBackAndroid();

if (laApp) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 300 }))
      .catch(() => { /* không có plugin (web) — bỏ qua */ });
  }));
}
