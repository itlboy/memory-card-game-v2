# admin.cozypi.com — thống kê Lật Thẻ

Một Cloudflare Worker riêng, **chỉ đọc GA4**. Không chạm MySQL, không chạm server game, không có
tác vụ chạy nền: chỉ hỏi GA lúc có người mở trang, kết quả nhớ tạm ở Cache API (kỳ đã qua 1 giờ,
kỳ có hôm nay 5 phút, thời gian thực 1 phút; ô nào lỗi thì không nhớ).

Mockup đã duyệt: https://claude.ai/artifact/VdBjJtK6bNfLz1AXFcjRB9 (17.11.2026).

## Vì sao nằm ngoài workspace pnpm

`admin/` KHÔNG thuộc `pnpm-workspace.yaml` (chỉ `apps/*`, `packages/*`) và có lockfile riêng. Đặt
vào `apps/` là đổi `pnpm-lock.yaml` gốc → Dockerfile server (COPY từng package.json rồi
`--frozen-lockfile`) và mọi workflow CI phải theo. Trang admin không đáng để chạm tới game.
Cài: `cd admin && pnpm install --ignore-workspace`.

Chỉ dùng chung một file với game: `packages/engine/src/theme-gop.ts` (gộp id theme cũ → 12 theme).

## Khoá hai lớp

1. **Cloudflare Access** ứng dụng "Lật Thẻ admin" (`admin.cozypi.com`, phiên 24 giờ) gắn policy dùng
   chung **"Chỉ Kiên"** — xem `my-secrets/docs/platform/cloudflare.md`.
2. **Worker tự kiểm JWT Access** (`src/access.ts`) cho MỌI đường, kể cả `/app.js`: chữ ký RS256 theo
   khoá của team, `aud` = `ACCESS_AUD`, `iss`, hạn. `ACCESS_AUD` rỗng → từ chối hết.
   `workers_dev: false` + `preview_urls: false`: không có cửa `*.workers.dev` đi vòng Access.

BẪY: xoá/tạo lại ứng dụng Access là **AUD đổi** → trang trả 403 cho tới khi sửa `ACCESS_AUD` trong
`wrangler.jsonc` và deploy lại.

## Nối GA (một lần)

1. Google Cloud → IAM → Service Accounts → tạo `latthe-admin-ga` (KHÔNG cấp role dự án nào) → Keys →
   tạo khoá JSON. Bật **Google Analytics Data API** cho dự án đó.
2. GA → Admin → Property access management → thêm email service account, vai trò **Viewer**.
3. GA → Admin → Property details → chép **Property ID** (số, không phải `G-MZ4MDWZRH3`). Xem luôn
   múi giờ thuộc tính; khác `Asia/Ho_Chi_Minh` thì sửa `GA_TZ`.
4. Cất vào kho: `secrets set-file google-analytics service_account <file.json>` +
   `secrets set google-analytics property_id <số>` (ở my-secrets), xoá file tải về.
5. Nạp vào Worker (từ thư mục `admin/`):
   ```bash
   S=~/Code/kien/my-secrets/bin/secrets.mjs
   eval "$(node $S env google-analytics --export)"
   node $S run cloudflare -- sh -c 'npx wrangler secret put GA_SA_JSON < "$GA_SA_FILE" && printf %s "$GA_PROPERTY_ID" | npx wrangler secret put GA_PROPERTY_ID'
   ```

Chưa nạp thì trang vẫn mở, báo "Chưa nối GA".

## Custom dimension phải đăng ký trong GA

GA → Admin → Custom definitions. **GA chỉ có số từ ngày đăng ký** — chưa đăng ký thì ô tương ứng
báo lỗi tên dimension, các ô khác vẫn chạy.

| Tên tham số | Phạm vi | Ô dùng |
|---|---|---|
| `che_do` | Event | Chế độ chơi, Ván online |
| `so_the` | Event | Cỡ bàn hay chơi |
| `theme` | Event | Chủ đề hay chọn |
| `chuc_nang` | Event | Phòng online đã tạo, Cách vào phòng |
| `ban_web` | User | Phiên bản web |

Không cần đăng ký: người chơi, người mới, thời gian chơi, quốc gia, giờ cao điểm, số ván, và
**nền tảng** — lấy từ `pagePath` (app gửi `/app/ios`, `/app/android`; web là mọi đường khác).

## Thêm số liệu

Game gửi thêm sự kiện qua `suKien()` (`apps/web/src/lib/phan-tich.ts`) → thêm một báo cáo trong
`src/thongke.ts` + một ô trong `src/trang.ts`. Tham số mới cần đăng ký custom dimension (bảng trên).
Không gửi dữ liệu cá nhân lên GA.

## Lệnh

```bash
pnpm install --ignore-workspace
npm test                 # khoảng/hạt thời gian (src/khoang.ts)
npx tsc --noEmit
node ~/Code/kien/my-secrets/bin/secrets.mjs run cloudflare -- npm run deploy   # chỉ từ code đã lên origin/main
```
