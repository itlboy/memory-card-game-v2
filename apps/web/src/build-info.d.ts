/** Hai biến do Vite nhúng lúc build — xem `define` trong vite.config.ts. */
declare const __APP_VERSION__: string;
/** Ngày build, ĐÃ định dạng theo giờ Việt Nam (không phải mốc ISO). */
declare const __BUILD_AT__: string;
/** Mốc ISO của lúc build, để tính tuổi bản build. */
declare const __BUILD_ISO__: string;
/** Mã gói web (OTA) — khớp `id` trong /ota/manifest.json của gói đó. */
declare const __OTA_ID__: string;
