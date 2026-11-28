# admin.cozypi.com — thống kê Lật Thẻ

Một Cloudflare Worker riêng, đọc GA4. **Ngoại lệ duy nhất (23.11.2026): ô "Thi đấu"** đọc thống kê ẩn danh của server game
(`GET <GAME_API>/api/thongke/thidau`, header `x-thongke-key` = secret `THONGKE_KEY` của Worker — `src/thidau.ts`); nạp khoá:
`node $S run cloudflare -- node $S run latthe-thongke -- sh -c 'printf %s "$LATTHE_THONGKE_KEY" | npx wrangler secret put THONGKE_KEY'`.
Các ô còn lại không chạm MySQL, không chạm server game, không có
tác vụ chạy nền: chỉ hỏi GA lúc có người mở trang, kết quả nhớ tạm ở Cache API (kỳ đã qua 1 giờ,
kỳ có hôm nay 5 phút, thời gian thực 1 phút; ô có báo cáo lỗi chỉ nhớ 1 phút) + một bản cũ 24 giờ để
dùng khi GA bận.

## BẪY: GA4 chỉ cho 10 request đồng thời mỗi thuộc tính

Quá 10 là `429 RESOURCE_EXHAUSTED`. Trước 19.11.2026 trang bắn 29 runReport một lúc (+3 realtime) và
ô lỗi không được nhớ → mỗi lần tải lại/tự làm mới lại bắn đủ 29 → 429 mãi. Nay:

- **Trang tải từng ô** (`/api/o/<phan>`, `phan` ∈ `kpi chuoi nen_tang quoc_gia heat choi nguoi_moi online
  loi_js khac` — `PHAN` ở `src/thongke.ts`, khớp `data-phan` ở `src/trang.ts`): ô chỉ tải khi cuộn tới gần
  (IntersectionObserver, 200px), tối đa 3 ô cùng lúc; tự làm mới chỉ làm ô đang hiện; đổi khoảng thì huỷ
  lượt đang tải. Ô lỗi có nút "Thử lại", GA bận thì tự thử lại theo `Retry-After`.
- **Worker** (`src/ga.ts`): hàng đợi ≤ 4 request GA cùng lúc mỗi isolate; 429 vì đồng thời / 503 thì thử
  lại ~0.5s, 1.5s, 4s; 429 vì **hết token giờ/ngày thì không thử lại** (`GaLoi` loại `het_quota`).
  Token xin chung một lần.
- GA hỏng mà còn bản cũ (≤ 24 giờ) → trả bản cũ kèm `cu: true` (trang ghi "Đang hiện số cũ"); không có thì
  503 (bận, `Retry-After: 5`) hoặc 429 (hết hạn mức, `Retry-After` tới đầu giờ sau).

Thêm báo cáo vào một ô thì nhớ: mỗi ô nên ≤ ~8 báo cáo.

Mockup đã duyệt: https://claude.ai/artifact/VdBjJtK6bNfLz1AXFcjRB9 (17.11.2026).

## Tab "Tăng trưởng" (28.11.2026) — mục tiêu 100 người online thường xuyên

`/api/tangtruong` (`src/tangtruong.ts`), KHÔNG theo bộ chọn khoảng: luôn 28 ngày trọn tới hôm qua, 11 báo cáo GA, nhớ 1 giờ,
chỉ tải khi mở tab. Đọc số thế nào:

- **Online trung bình** = tổng giây chơi GA của ngày (`userEngagementDuration`) / 86 400 — số người có mặt cùng lúc tính
  đều cả ngày. **Giờ đỉnh** = giờ nhiều giây chơi nhất / 3 600. Là ƯỚC LƯỢNG (GA chỉ tính lúc app ở trước mặt, không đếm
  người chặn GA) — số tức thời thật nằm ở ô Máy chủ (tab Online); server chưa lưu lịch sử số online.
- **Giữ chân**: nhóm người mới theo 7 ngày (cohort GA theo `firstSessionDate`), còn hoạt động ngày 1 / ngày 7, TÁCH nền
  tảng bằng lọc `pagePath`. Nhóm mới nhất (2–7 ngày trước) chưa đủ 7 ngày nên chỉ có ngày 1.
- **Người mới đến từ đâu**: app là webview nên GA ghi `(direct)` → phân theo TRANG VÀO (`/app/ios` = App Store,
  `/app/android` = Google Play), web theo nguồn GA. BẪY: trang ngôn ngữ (`/en`, `/ja`…) và Mỹ có nhiều "người mới" 0 phút
  chơi = máy quét / kiểm thử tự động của chính mình — vì thế bảng kèm phút chơi mỗi người, và ô số đầu trang chỉ tính app.
- Link mời/chia sẻ ĐÃ mang `utm_source` (`moi_ban`, `chia_se`) từ 17.11.2026, nhưng link mời mở thẳng APP (WebView không nhận URL)
  nên GA không thấy nguồn đó — người do lời mời kéo về đếm bằng dòng "trong đó là người MỚI" (sự kiện `online_vao_link_moi`
  của người mới) ở bảng Lan truyền.
- BẪY Android: Google Play tự chạy máy thử (pre-launch report) cho MỖI bản đẩy lên store — chúng mở app, bấm lung tung, thành
  "người mới" không bao giờ quay lại (`ban_web` (not set), máy Google/TCL/Samsung, vài giây chơi). Người Android thật chỉ
  ~5 người/ngày (11.2026) nên % giữ chân Android không đủ tin.

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
| `chuc_nang` | Event | Phòng online đã tạo, Cách vào phòng, Tính năng được dùng (tên hiển thị: `TINH_NANG` trong `src/trang.ts`) |
| `ban_web` | User | Phiên bản web |
| `thong_diep` | Event | Lỗi JavaScript |
| `ngan_xep` | Event | Lỗi JavaScript — chỗ lỗi `tệp:dòng:cột` (chưa đăng ký thì ô vẫn chạy, chỉ thiếu dòng này) |

Không cần đăng ký: người chơi, người mới, thời gian chơi, quốc gia, giờ cao điểm, số ván, và
**nền tảng** — lấy từ `pagePath` (app gửi `/app/ios`, `/app/android`; web là mọi đường khác).

## Thêm số liệu

Game gửi thêm sự kiện qua `suKien()` (`apps/web/src/lib/phan-tich.ts`) → thêm một báo cáo vào một ô
(hàm theo `phan`) trong `src/thongke.ts` + một dòng bảng `DS` (hoặc khung `data-phan`) trong `src/trang.ts`. Tham số mới cần đăng ký custom dimension (bảng trên).
Không gửi dữ liệu cá nhân lên GA.

## Lệnh

```bash
pnpm install --ignore-workspace
npm test                 # khoảng/hạt (khoang.ts), hàng đợi + thử lại GA (ga.ts), đường /api/o + bản cũ (api.ts)
npx tsc --noEmit
node ~/Code/kien/my-secrets/bin/secrets.mjs run cloudflare -- npm run deploy   # chỉ từ code đã lên origin/main
```
