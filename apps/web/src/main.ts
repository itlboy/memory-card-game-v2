import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';
import App from './App.vue';
import './styles/global.css';

// iOS Safari bỏ qua user-scalable=no — chặn pinch-zoom bằng gesture event
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

// Cache app shell để rời app rồi quay lại là hiện ngay (mobile hay giải phóng
// tab); bản mới tự thay khi có deploy. Thiếu SW cũng không sao — app vẫn chạy.
void registerSW({ immediate: true });

createApp(App).mount('#app');
