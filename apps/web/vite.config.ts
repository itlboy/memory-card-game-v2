import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Phiên bản và NGÀY BUILD nhúng lúc build, hiện ở cuối bảng Luật chơi.
 *
 * Định dạng ngay tại đây theo giờ Việt Nam, KHÔNG gửi mốc ISO cho client tự
 * định dạng: máy người chơi có thể lệch múi giờ hoặc sai đồng hồ, lúc đó con số
 * hiện ra không còn là "ngày tôi build" nữa — mà đó chính là thứ cần biết khi
 * hỏi "máy bạn đang chạy bản nào".
 */
const buildAt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false
}).format(new Date());

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.1.0'),
    __BUILD_AT__: JSON.stringify(buildAt),
    // Mốc ISO để tính "bao lâu trước". Phải có CẢ HAI: ngày giờ đã định dạng thì
    // không lệch theo máy người chơi, còn tuổi bản build thì bắt buộc phải so với
    // đồng hồ của họ.
    __BUILD_ISO__: JSON.stringify(new Date().toISOString()),
    // Mã gói web cho OTA (lib/ota.ts so với manifest trên server). tools/dong-goi-ota.mjs
    // truyền OTA_ID để mã nhúng trong gói KHỚP mã ghi trong manifest.
    __OTA_ID__: JSON.stringify(process.env.OTA_ID ?? `${process.env.npm_package_version ?? '0'}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`)
  },
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
        background_color: '#5cc2f2',
        theme_color: '#5cc2f2',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        // 665 SVG mặt bài chỉ máy không-Apple dùng (lib/emoji.ts): không nhét vào
        // precache (iPhone tải ~1MB vô ích), nạp dần lúc chơi và giữ trong cache.
        // Trang công khai + /site/ không thuộc game: không precache (thêm ~250KB vô ích).
        globIgnores: ['**/emoji/**', '**/site/**', '**/{about,support,privacy,changes}.html', 'sitemap.xml'],
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/emoji/'),
          handler: 'CacheFirst',
          options: { cacheName: 'emoji', expiration: { maxEntries: 800 } }
        }],
        // Ván online phải luôn đi thẳng ra server — không bao giờ trả từ cache
        // Trang tĩnh (privacy/support) là file riêng — store của Apple/Google mở
        // thẳng URL đó, không được rơi về index.html của game
        // /ota/: gói cập nhật nóng của app — mở link zip trên trình duyệt từng vào game thì SW
        // trả index.html thay cho file (14.10.2026)
        // Trang công khai (about/support/privacy/changes) + tài nguyên của chúng ở /site/:
        // service worker KHÔNG được trả index.html của game thay cho chúng.
        // /<mã>/<trang>.html là bản dựng sẵn từng ngôn ngữ (tools/dung-trang-cong-khai.mjs).
        navigateFallbackDenylist: [/^\/ws\//, /^\/api\//, /^\/ota\//, /^\/site\//, /^\/(privacy|support|about|changes)(\.html)?$/,
          /^\/[a-z]{2}(-[A-Z]{2})?\/(privacy|support|about|changes)(\.html)?$/, /^\/(sitemap\.xml|robots\.txt)$/],
        // Font đóng gói sẵn (styles/fonts.ts, file .woff2 cùng gốc) nên đã nằm trong
        // globPatterns ở trên — không còn cache font Google ở runtime.
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
