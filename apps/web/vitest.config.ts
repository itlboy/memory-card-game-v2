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
