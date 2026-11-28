# Bản Facebook Instant Games

Bắt đầu 22.11.2026, nhánh `facebook-instant`. **Chưa phát hành** — Meta bắt buộc xác minh doanh nghiệp
và chương trình Approved Partner trước khi game lên; app Meta "Flip Match" đang ở chế độ Development.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm build:fb` | build với `VITE_NEN=facebook` ra `apps/web/dist-fb`, đóng `apps/web/lat-the-fb.zip` (gói tải lên Meta) |
| `pnpm smoke:fb` | mở gói trong trình duyệt ẩn với SDK giả: game lên ở thư mục con, đúng trình tự SDK, không service worker, không 404 |

Không lệnh nào đụng `dist` (bản web đang deploy) hay gói OTA.

## Khác bản web ở đâu

Một cờ LÚC BUILD: `laFacebook` (`lib/nen-fb.ts`). Build web/app thì cờ là `false` hằng số, mọi nhánh
Facebook bị cắt khỏi gói.

- **Khởi động** (`lib/facebook.ts`, `main.ts`): `initializeAsync` → `setLoadingProgress` → `startGameAsync`
  sau khung hình đầu. Mỗi lời gọi có hạn 8 giây — SDK treo thì game vẫn lên.
- **index.html** (`vite.config.ts`): chèn `fbinstant.8.0.js` trước script game; bỏ Smart App Banner, thẻ og, icon.
- **Tắt**: service worker/PWA, gợi ý cài app và link store, nút đăng nhập Google/Apple. OTA và thông báo đẩy
  vốn chỉ chạy trong app nên tự không chạy.
- **Tài nguyên**: `base: './'` (Meta host gói ở thư mục con). Đường dẫn viết trong CHUỖI JS phải bọc `tn()`
  (`lib/nen-fb.ts`); `/emoji/` (43 MB) không vào zip, tải từ `flipmatch.cozypi.com`.
- **Server**: `VITE_SERVER_URL=https://flipmatch-api.cozypi.com`; `nenApp` vẫn là `'web'` (server chưa biết
  giá trị thứ tư).

## Cái bẫy

- **Đừng thêm export vào `lib/native.ts` cho bản Facebook.** Nhiều test `vi.mock('@/lib/native')` trọn
  module; thêm export là hỏng test (đã dính với `tn`). Cờ và hàm Facebook ở `lib/nen-fb.ts`.
- **Tên miền phải khai trong tab Content Security Policy của app Meta** (không có `https://`):
  `flipmatch-api.cozypi.com` (connect-src, cả wss) và `flipmatch.cozypi.com` (img-src). Thiếu là game
  lên nhưng không vào được phòng online / không có hình lá bài.
- `fbapp-config.json` do `tools/dong-goi-fb.mjs` sinh; giá trị phải VIẾT HOA (`PORTRAIT`). Cấu trúc bọc
  trong `instant_games` là theo định dạng cũ — **chưa kiểm với lần tải lên thật**.
- Hai thuộc tính tĩnh `/emoji/3d/128/…` trong `CaiAppDialog.vue`, `MinhHoaCai.vue` vẫn là đường dẫn tuyệt
  đối: chúng thuộc hướng dẫn cài app, bản Facebook không hiện.

## Chưa làm

1. Đăng nhập bằng danh tính Facebook + route server xác minh chữ ký (đọc tài liệu SDK 8.0 chế độ
   Zero Permissions trước — `getSignedPlayerInfoAsync` mới chỉ thấy nhắc trong FAQ).
2. Mời bạn / chia sẻ qua SDK thay cho copy link `?room=` và `navigator.share`.
3. Lưu tiến độ qua SDK (localStorage trong khung Facebook có thể bị xoá).
4. Ngôn ngữ theo `FBInstant.getLocale()` (`fbNgonNgu()` có sẵn, chưa nối vào `lib/i18n.ts`).
5. Ảnh kết quả vẽ bằng canvas dùng emoji từ tên miền khác — cần CORS, chưa kiểm.
6. Chạy thử thật trong Facebook (tải zip lên app ở chế độ Development).
