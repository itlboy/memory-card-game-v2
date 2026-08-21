import { createApp } from 'vue';
import App from './App.vue';
import './styles/global.css';

// iOS Safari bỏ qua user-scalable=no — chặn pinch-zoom bằng gesture event
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

createApp(App).mount('#app');
