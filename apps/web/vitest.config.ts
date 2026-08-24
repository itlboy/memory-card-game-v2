import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@mm/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // Cùng hai biến như vite.config: thiếu thì test chạm vào chúng là ReferenceError
  define: {
    __APP_VERSION__: JSON.stringify('1.1.0'),
    __BUILD_AT__: JSON.stringify('01/01/2026 00:00'),
    __BUILD_ISO__: JSON.stringify('2026-01-01T00:00:00.000Z')
  },
  test: {
    globals: true, environment: 'happy-dom', include: ['test/**/*.test.ts'],
    /*
     * 30 giây, không phải 5 giây mặc định. Nhiều test đẩy đồng hồ ảo qua vài
     * giây ván đấu, mà mỗi 16ms ảo là một khung `requestAnimationFrame` chạy cả
     * vòng lặp của session — 5 giây ván = hơn 300 khung, mỗi khung một lượt
     * microtask. Máy đang tải nhẹ là vượt mốc 5 giây THẬT và test đỏ ngẫu nhiên
     * (đã đỏ đúng kiểu đó ở 3 test khác nhau, luôn ở mốc 5044/5074/15030ms —
     * dấu hiệu hết thời gian chờ chứ không phải sai logic).
     */
    testTimeout: 30_000
  }
});
