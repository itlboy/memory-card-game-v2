# Bản cổng game web (CrazyGames, itch.io…)

Bắt đầu 28.11.2026, nhánh `ban-nhung` (dựng trên phần build Facebook Instant — xem `facebook-instant.md`). **Chưa nộp cổng nào.**
Mục đích: kênh kéo người chơi 0 đồng cho mục tiêu 100 người online. **Bản app và web chính KHÔNG có quảng cáo** (chủ dự án
chốt 28.11.2026) — cổng nào bắt gắn SDK quảng cáo thì code đó chỉ nằm trong nhánh `laCong` của bản build này.

## Lệnh

| Lệnh | Việc |
|---|---|
| `VITE_CONG=crazygames pnpm build:cong` | build `VITE_NEN=cong` ra `apps/web/dist-cong`, đóng `apps/web/lat-the-cong-<tên>.zip` |
| `node tools/smoke-cong.mjs [thư mục ảnh]` | mở gói TRONG IFRAME ở cỡ khung CrazyGames: game lên, không service worker, không 404, không link ra ngoài, không tràn |

Không lệnh nào đụng `dist` hay gói OTA. Tên cổng (`VITE_CONG`, chữ thường) đi vào GA: `page_location = /cong/<tên>`.

## Khác bản web ở đâu

Cờ lúc build ở `lib/nen-fb.ts`: `laCong` (riêng cổng game), `laNhung` = `laFacebook || laCong` (mọi thứ chung của hai bản
nhúng: `base: './'`, tắt PWA/service worker, không gợi ý cài app, không đăng nhập Google/Apple, `/emoji/` tải từ
`flipmatch.cozypi.com`, ngôn ngữ theo trình duyệt). Riêng `laCong`:

- Không nút chia sẻ ảnh kết quả / Chỉ số trí nhớ (ảnh in link tải app — cổng cấm quảng bá chéo và link store).
- Mời bạn chỉ bằng MÃ 6 số: không link `?room=`, không QR (link trỏ về web của mình).
- Chat vốn chỉ có emoji nên không cần bộ lọc từ.

## Yêu cầu CrazyGames (đọc 28.11.2026, docs.crazygames.com/requirements)

- Gói ≤ 50 MB (≤ 20 MB mới được lên trang chủ di động), ≤ 1500 file, chỉ đường dẫn tương đối. Gói hiện ~2,5 MB / 175 file.
- Không quảng bá chéo, KHÔNG link App Store/Play, không đăng nhập ngoài, không quảng cáo tự gắn, không nút toàn màn hình riêng.
- Có tiếng Anh. Chơi được ở khung NGANG trên máy tính (dọc thì có nền hai bên): 821×462 → 1216×684, toàn màn tới 1920×1080;
  di động 800×450. Chạy tốt trên Chrome/Edge; Safari kém thì bị tắt ở Safari.
- Basic Launch: không cần SDK, quảng cáo TẮT. Kết thúc khi đủ 7 ngày VÀ 500 lượt chơi (tối đa 21 ngày). Full Launch mới cần
  SDK (gameplay start/stop, tắt tiếng, quảng cáo qua SDK) và mới chia doanh thu. Không đòi độc quyền.

## Chưa làm — CHẶN NỘP

1. **Bố cục khung ngang thấp.** Ở 800×450 / 821×462 màn chào bị cắt mất nút "Vào chơi"; menu, bàn chơi, hộp thoại chưa soát.
   Game thiết kế cho màn dọc ≥ ~640 px cao. Cần phương án (thu nhỏ theo chiều cao hay bố cục ngang riêng) — làm mockup trước.
2. Màn chào bắt nhập tên trước khi chơi: cổng game chấm "vào ván trong ≤ 1 cú bấm" → bản cổng nên tự đặt tên ngẫu nhiên.
3. Chạy thử trên Chrome thật (máy này Playwright chỉ có WebKit), soát phòng online trong iframe (API/WebSocket khác tên miền).
4. Thông báo quyền riêng tư cho người mới (GA) theo yêu cầu cổng; trang giới thiệu, ảnh bìa, video ngắn cho hồ sơ nộp.
5. itch.io: cùng gói, chưa tạo trang.
