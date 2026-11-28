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

## Thu nhỏ theo chiều cao khung (28.11.2026, chủ dự án chọn)

`index.html` của gói là TRANG VỎ (`tools/dong-goi-fb.mjs` `dungKhungCong`): game thật nằm ở `game.html`, chạy trong iframe
con luôn cao ≥ 640 px CSS rồi `transform: scale` cho vừa khung thật (800×450 → tỉ lệ 0,70). Trong iframe con mọi thứ (vh,
lớp phủ fixed, Teleport, media query) thấy đúng một màn cao như điện thoại → KHÔNG sửa CSS nào của game. Khung cao ≥ 640
(toàn màn hình, điện thoại dọc) thì tỉ lệ 1. BẪY: đừng thu bằng transform trên `#app` — hộp thoại Teleport ra body và đơn
vị vh sẽ lệch. Gắn SDK cổng sau này: SDK ở trang vỏ, nói với game qua `postMessage`.

Cũng ở bản cổng: không màn chào (tự đặt tên ngẫu nhiên + avatar, `lib/ho-so.ts` `tuDatHoSoCong`), bảng Premium tặng
không tự phủ lên menu — vào ván được trong một cú bấm.

## Chưa làm

1. Chạy thử trên Chrome thật (máy này Playwright chỉ có WebKit); soát phòng online trong iframe (API/WebSocket khác tên miền);
   soát nốt hộp thoại dài (Hồ sơ, Luật chơi, Premium, kết quả) ở 800×450.
2. Bảng Premium còn link Terms/Privacy ra web của mình — hỏi cổng hoặc ẩn.
3. Thông báo quyền riêng tư cho người mới (GA) theo yêu cầu cổng; ảnh bìa, mô tả, video ngắn cho hồ sơ nộp.
4. itch.io: cùng gói, đẩy bằng `butler push` (tự động được); CrazyGames tải zip tay ở Developer Portal.
5. Bản cổng cũ phải chạy được với server mới — thêm vào diện `smoke:client-cu` khi đã nộp.
