import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    // Trình duyệt mobile giải phóng tab khi người chơi rời app; không có cache thì
    // quay lại là tải lại toàn bộ bundle + font + theme từ mạng (chờ vài giây).
    // Service worker cache app shell nên mở lại là hiện ngay, và chơi được offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['data/themes.json'],
      manifest: {
        name: 'Lật Thẻ — Game Thẻ Bài Trí Nhớ',
        short_name: 'Lật Thẻ',
        description: 'Game thẻ bài trí nhớ: lật thẻ, tìm cặp giống nhau, phá kỷ lục của chính bạn.',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#edeffa',
        theme_color: '#6a5cff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        // Ván online phải luôn đi thẳng ra server — không bao giờ trả từ cache
        navigateFallbackDenylist: [/^\/ws\//, /^\/api\//],
        runtimeCaching: [
          {
            // Font Google: dùng bản đã tải, âm thầm cập nhật nền
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Trỏ thẳng vào mã nguồn TS của engine: HMR chạy xuyên package, không cần build lại
      '@mm/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: { target: 'es2022' }
});
