# Bản cổng game web (CrazyGames, itch.io…)

Bắt đầu 28.11.2026 (dựng trên phần build Facebook Instant — xem `facebook-instant.md`). itch.io CHẠY từ 28.11 (`cozypi.itch.io/flip-match`);
CrazyGames: NHÚNG THẲNG `https://flipmatch.cozypi.com/cong/crazygames/` ("Externally hosted (iframe)") — `pnpm release` dựng và
chép bản cổng vào `dist/cong/<tên>/` SAU khi đóng gói OTA (`tools/nhung-cong-web.mjs`), nên mỗi lần deploy web là CrazyGames có bản mới.
Mục đích: kênh kéo người chơi 0 đồng cho mục tiêu 100 người online. **Bản app và web chính KHÔNG có quảng cáo** (chủ dự án
chốt 28.11.2026) — cổng nào bắt gắn SDK quảng cáo thì code đó chỉ nằm trong nhánh `laCong` của bản build này.

## Yêu cầu của cổng — bảng cho bộ phận kỹ thuật

Bản rút gọn để soát khi làm tính năng nằm ở `CLAUDE.md` (mục "BẢN CỔNG GAME — luật khi phát triển"). Bảng dưới là chi tiết
và nguồn (đọc 28.11.2026). Cổng đổi luật thì sửa bảng này trước.

| Yêu cầu | CrazyGames | itch.io | Game đáp ứng ở đâu |
|---|---|---|---|
| Link ra ngoài / quảng bá chéo | CẤM link App Store/Play trong game, cấm quảng bá game/nền tảng khác | khuyên không | `laCong`: ẩn gợi ý cài app, chia sẻ ảnh, QR, link mời |
| Quảng cáo | chỉ quảng cáo qua SDK CrazyGames; Basic Launch tắt hẳn | được, không che game | không quảng cáo nào |
| Mua trong game | chỉ qua SDK | — | Premium chỉ tặng; nút mua (khi có) phải ẩn ở bản cổng |
| Đăng nhập | Basic: KHÔNG đăng nhập ngoài | — | ẩn Google/Apple (`laNhung`) |
| Vào ván | QA chấm nhanh vào ván, ≤ 20 giây tới gameplay | — | không màn chào (tự đặt tên), quà Premium là dải báo 5 s |
| Khung | ngang trên máy tính: 821×462 · 907×510 · 1077×606 · 1216×684; toàn màn 1280×720 → 1920×1080; di động 800×450; tablet 1080×607 | đặt tay (420×780) | trang vỏ thu nhỏ theo chiều cao ≥ 640 |
| Trình duyệt | Chrome + Edge bắt buộc; Safari kém thì bị tắt ở Safari | — | thử khói WebKit + Chrome thật |
| Ngôn ngữ | có tiếng Anh, mặc định tiếng Anh | — | theo trình duyệt, tiếng chưa hỗ trợ → tiếng Anh |
| Phím | tránh Esc (thoát toàn màn), Ctrl/Cmd+W; không nút toàn màn hình riêng | có nút toàn màn của itch | không dùng |
| Chat | phải tắt được + lọc từ | — | chat chỉ emoji, không gõ chữ |
| Dung lượng | ≤ 250 MB, ≤ 1500 file; tải đầu ≤ 50 MB (≤ 20 MB để lên trang chủ di động) | ≤ 1 GB | ~2,5 MB / 177 file (emoji tải từ web) |
| Đường dẫn | chỉ tương đối | chỉ tương đối | `base: './'`, `tn()` |
| Hồ sơ nộp | 3 ảnh bìa 1920×1080 · 800×1200 · 800×800 (chỉ tên game, không icon/logo store, không viền); 2 video 15–20 s không tiếng (ngang 16:9, dọc 2:3), khung đầu = ảnh bìa | ảnh bìa 630×500, ảnh chụp | nguồn ảnh bìa/video: xem mục "Hồ sơ nộp" dưới |
| Full Launch (sau Basic) | gắn SDK: gameplay start/stop, tắt tiếng qua SDK, quảng cáo qua SDK, chịu được chặn quảng cáo; game nhiều người có thể đi thẳng Full | — | chưa làm — SDK nằm ở trang vỏ, nói với game qua `postMessage` |
| Basic Launch | ≥ 7 ngày VÀ ≥ 500 lượt chơi (tối đa 21 ngày); chấm thời gian chơi, quay lại ngày 1, tỉ lệ chuyển đổi, CTR ảnh bìa | — | đo ở admin tab Tăng trưởng (nền tảng Cổng game) |

Nguồn: docs.crazygames.com/requirements (intro, technical, gameplay, quality, multiplayer, ads, game-covers), /faq;
itch.io/docs/creators/html5.

## Hồ sơ nộp (ảnh bìa + video)

- Ảnh bìa dựng bằng HTML (cùng cách `tools/og/`), chụp bằng Playwright WebKit ở 3 cỡ — chỉ chữ "Flip Match" + lá bài (emoji Noto 3D).
- Video: quay gameplay thật của bản cổng bằng Playwright `recordVideo` (kịch bản lật–nhớ–ghép như người chơi: đọc mặt thẻ từ
  `aria-label` SAU khi lật — ảnh trong lá úp KHÔNG phải mặt thật), ghép ảnh bìa làm khung đầu bằng ffmpeg (xfade 0,5 s), H.264,
  không tiếng, ≤ 20 s. File nguồn chưa đưa vào repo (lần đầu làm ở scratchpad) — làm lại thì đưa script vào `tools/`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `VITE_CONG=crazygames pnpm build:cong` | build `VITE_NEN=cong` ra `apps/web/dist-cong`, đóng `apps/web/lat-the-cong-<tên>.zip` |
| `node tools/smoke-cong.mjs [thư mục ảnh]` | mở gói TRONG IFRAME ở cỡ khung CrazyGames: game lên, không service worker, không 404, không link ra ngoài, không tràn |

Không lệnh nào đụng `dist` hay gói OTA. Tên cổng (`VITE_CONG`, chữ thường) đi vào GA: `page_location = /cong/<tên>`.

## Tự động (`.github/workflows/cong-game.yml`)

Gắn tag `app-v*` (cùng nhịp bản app) hoặc `gh workflow run cong-game.yml --ref main` → mỗi cổng một job: build → thử khói
→ lưu zip làm artifact → đẩy nếu cổng có đường tự động.

| Cổng | Đẩy | Cần |
|---|---|---|
| itch.io | tự động, `butler push` kênh `html5` | secret `BUTLER_API_KEY` (itch.io → Settings → API keys), biến repo `ITCH_TARGET` = `tài-khoản/tên-game` |
| CrazyGames | TỰ ĐỘNG theo deploy web: CrazyGames nhúng `flipmatch.cozypi.com/cong/crazygames/` | không cần khoá; `pnpm release` chạy `tools/nhung-cong-web.mjs` |
| Poki | chưa nối — có `@poki/cli upload`, duyệt vẫn bấm tay | được Poki nhận game trước |

Thiếu khoá thì job vẫn xanh, chỉ dựng gói. Thêm cổng = thêm một dòng `matrix.include` (và một bước đẩy nếu cổng có CLI).
Bản cổng dùng CHUNG server game → không cần ra theo từng bản web; nhưng bản cổng cũ phải chạy được với server mới.

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

Premium tặng 1 tháng VẪN TẶNG ở bản cổng (28.11.2026, chủ dự án: "cho bên cổng"), nhưng báo bằng dải nổi trên cùng 5 giây
(`DaiBao` gắn ở App chỉ khi `laCong` và không ở màn online) thay vì phủ bảng. **Khi Premium có nút MUA thật: bản cổng phải ẩn
nút mua** — CrazyGames chỉ cho mua trong game qua SDK của họ.

Cũng ở bản cổng: không màn chào (tự đặt tên ngẫu nhiên + avatar, `lib/ho-so.ts` `tuDatHoSoCong`), bảng Premium tặng
không tự phủ lên menu — vào ván được trong một cú bấm.

## Chưa làm

1. Chạy thử trên Chrome thật (máy này Playwright chỉ có WebKit); soát phòng online trong iframe (API/WebSocket khác tên miền);
   soát nốt hộp thoại dài (Hồ sơ, Luật chơi, Premium, kết quả) ở 800×450.
2. Bảng Premium còn link Terms/Privacy ra web của mình — hỏi cổng hoặc ẩn.
3. Thông báo quyền riêng tư cho người mới (GA) theo yêu cầu cổng; ảnh bìa, mô tả, video ngắn cho hồ sơ nộp.
4. Tạo tài khoản nhà phát triển + trang game ở itch.io và CrazyGames; nạp `BUTLER_API_KEY` + `ITCH_TARGET` cho repo.
5. Bản cổng cũ phải chạy được với server mới — thêm vào diện `smoke:client-cu` khi đã nộp.
