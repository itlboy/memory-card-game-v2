import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';
import App from './App.vue';
import { sfx } from './lib/audio';
import './styles/global.css';
import './styles/card-backs.css';
import './styles/ketcuc-fx.css';

// iOS Safari bỏ qua user-scalable=no — chặn pinch-zoom bằng gesture event
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

// Cache app shell để rời app rồi quay lại là hiện ngay (mobile hay giải phóng
// tab); bản mới tự thay khi có deploy. Thiếu SW cũng không sao — app vẫn chạy.
void registerSW({ immediate: true });

// Mở sẵn cho console: `sfx.volume = 2.5` để thử âm lượng (giá trị được nhớ lại).
// Không có dòng này thì `sfx` chỉ là biến trong module, console không thấy.
(window as unknown as { sfx: typeof sfx }).sfx = sfx;

createApp(App).mount('#app');
