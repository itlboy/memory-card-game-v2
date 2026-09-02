# Lật Thẻ (Memory Match) — ghi chú cho Claude

## Ràng buộc thiết kế BẮT BUỘC

- **KHÔNG SCROLL trên mobile**: mọi màn hình (wizard chọn chế độ/lưới/theme,
  lobby online, màn chơi, bản đồ Chiến dịch) phải hiển thị TRỌN VẸN trong
  viewport — nút hành động chính (Bắt đầu, Tạo phòng…) không bao giờ bị đẩy
  ra ngoài màn hình. Cơ chế: `#app` khoá `100dvh`; panel là flex column
  chiếm trọn chỗ; bước hiện tại (`.step-body`) `flex: 1; min-height: 0`;
  lưới lựa chọn `grid-auto-rows: minmax(0, 1fr); overflow: hidden` để các ô
  tự nén theo chỗ còn lại. Thêm lựa chọn mới = ô nhỏ lại, KHÔNG dài trang ra.
- Lưới lựa chọn phải **tròn hàng** (không ô lẻ thừa hàng cuối):
  12 cỡ bàn = 2×6; 12 theme = 3×4 / 4×3; 9 mức số người = 3×3.
- Hiệu ứng `:hover` phải bọc trong `@media (hover: hover)` — thiết bị cảm
  ứng giữ trạng thái hover của lần chạm trước, gây "2 ô cùng sáng".
- Kích thước chạm tối thiểu 44px (NF-07) — NGOẠI LỆ đã chốt: hai cỡ bàn lớn
  nhất (72 và 88 thẻ) cố ý phá ngưỡng, là bàn siêu khó người chơi tự chọn;
  mọi cỡ ≤56 thẻ vẫn phải giữ, có test canh. Lưới lẻ ô (3×3, 5×5) có ô trống
  chính giữa; mặt sau lá bài cả bàn PHẢI giống hệt nhau (khác = đánh dấu bài).
- **HIỆU ỨNG KẾT VÁN VÀ MẶT SAU LÁ BÀI NẰM Ở SỔ RIÊNG.** Thêm/sửa/xoá chỉ đụng
  hai file, không sửa component nào:
  · hiệu ứng: một mục trong `lib/ketcuc-fx.ts` + một khối cùng tên ở
  `styles/ketcuc-fx.css`. `KetCucFx.vue` là component DUY NHẤT cho cả ba kết
  cục (thay `CelebrationFx`/`DefeatFx` cũ), nhận `loai` + `seed`.
  · mặt sau: một tên trong `CARD_BACKS` (engine) + một khối ở
  `styles/card-backs.css`. Thiếu khối là lá bài ra Ô TRẮNG TRƠN.
  Luật: mỗi loại kết cục ≥4 hình (test canh); bốc theo SEED chứ không
  `Math.random()` — F5 giữa lúc xem kết quả không được đổi hình, và view online
  dựng lại nhiều lần vẫn phải ra đúng một hình. Mọi mặt sau dùng chung khuôn
  SVG `viewBox="0 0 100 133"` + `center / 100% 100%` để hoạ tiết đứng đúng chỗ ở
  mọi cỡ thẻ, và CẢ BÀN dùng một kiểu (khác nhau = đánh dấu bài).
- **`summary.status === 'won'` KHÔNG PHẢI "TÔI THẮNG"** — nó chỉ nói BÀN ĐÃ SẠCH.
  Đấu máy mà máy dọn nhiều cặp hơn thì vẫn 'won', nên đọc `status` trần là thua
  bot vẫn được pháo hoa (đã xảy ra thật, người chơi báo). Dùng
  `session.loaiKetCuc` (offline) / `loaiKetCuc` ở OnlineGame (online); cả hai
  nhận ra ván đấu máy qua BẢNG XẾP HẠNG chứ không qua cờ `botLevel` — cờ đó tắt
  được giữa ván. HOÀ là kết cục thứ ba, không được rơi vào nhánh thua.
- **CÓ `viewport-fit=cover` THÌ PHẢI CÓ `env(safe-area-inset-*)`.** index.html
  đặt `cover` để trang trải ra tận mép máy, nhưng thế cũng là cho trang TRÙM
  LÊN dải home indicator ở đáy — dải đó iOS giữ cho cử chỉ hệ thống, nút nào
  nằm trong là bị hệ thống ăn mất cú chạm (vuốt lên ra màn hình chính, giữ lâu
  thì gọi trợ lý ảo). Người chơi báo đúng chuyện này. Đệm ở `#app` kèm
  `box-sizing: border-box`: #app khoá `100dvh` nên đệm nằm TRONG chiều cao đã
  khoá, không phá luật KHÔNG SCROLL. Thứ TELEPORT ra `<body>` (EmojiBlast) nằm
  ngoài #app nên phải tự cộng `env()`. Đo trên iPhone 14 giả lập: đáy hàng nút
  từ 33px (trong dải 34px) lên 67px.
- **Vùng chạm ≠ HÌNH của nút.** Nút nhỏ mà vẫn phải 44px thì nới vùng chạm bằng
  `::after { inset: -8px }`, đừng phình cái nút lên (nút thoát 44px từng kéo cao
  cả HUD). Nhớ ghi đè cả `min-width`/`min-height` — `.btn` toàn cục đặt 44px.
- **Không lộ bài, kể cả trong một khung hình.** Mọi animation bắt đầu ở
  `rotateY(180deg)` là mặt TRƯỚC hướng ra ngoài; đừng bật animation lật bằng
  selector trạng thái (`:not(.up)` đúng với cả lá chưa từng lật) — để JS gắn
  class đúng lúc lá ĐỔI mặt. Đây là lỗi đã xảy ra thật, thấy rõ khi F5 giữa ván.
- **Lắc thẻ phải cùng trục với cú lật** (`rotateY`, không `rotateZ`), biên độ
  giảm dần; một lá chỉ một animation chạy cùng lúc (cái sau đè cái trước).
- Cỡ chữ wizard dùng chung `.option strong` / `.option small` ở wizard.css.
  KHÔNG ghi đè cỡ chữ theo dáng ô — đã gây chuyện bước 1 chữ 18px trong khi các
  bước sau 22,7px.
- **MỌI NÚT ĐỀU CÓ TIẾNG, gắn ở MỘT chỗ.** `App.vue` bắt `pointerdown` ở PHA
  CAPTURE của document rồi gọi `sfx.clickMacDinh()`; nút nào có tiếng riêng thì
  hàm đó tự im (chờ `CHO_MS` 90ms, thấy `mocPhat` đã nhích là bỏ). Đừng đi gắn
  `sfx` vào từng handler: app đã hơn 60 nút và mỗi nút thêm sau sẽ lại là một
  nút im lặng — đúng lỗi "bấm thoát bàn không kêu gì" người chơi đã báo. Muốn
  một nút chủ đích không kêu thì đặt `data-nosfx`. Có
  `test/nut-co-tieng.test.ts` canh cả hai nửa.
- Thông báo trong ván nổi ở `.notice-bar` (cao 0px, đè HUD), không hiện giữa bàn
  và không chiếm chỗ của bàn thẻ.

## Hướng thiết kế đã chốt: C · Arcade neon

- **Màn định danh** (mỗi ô một thứ khác nhau — cách chơi, chế độ, entry
  online): ô gradient MÀU RIÊNG luôn bật, chữ/icon trắng (class
  `.neon .g-*` trong global.css).
- Viền trắng "đang chọn" (`aria-pressed`/`aria-checked`) CHỈ dùng cho ô thật sự
  có trạng thái bật/tắt (theme, cỡ bàn). Bước nào **bấm là đi luôn** (số người,
  mức bot, chế độ) thì KHÔNG gắn: ở đó không có gì để bật/tắt, mà giá trị nhớ từ
  lần trước lại làm một ô sáng viền ngay khi vừa vào bước — người chơi đọc ra
  thành "nút bị dính trạng thái active". Có test chặn.
- **Màn cấu hình** (lưới, theme): ô nền tối; Ô ĐƯỢC CHỌN bùng gradient
  tím + glow (`aria-checked/pressed` + `:not(.neon)`).
- **CẤP CHỈ CÒN LÀ ĐỘ KHÓ TRONG CHIẾN DỊCH.** Ngoài Chiến dịch, bước đầu là
  chọn SỐ THẺ (`SizeGrid.vue`, 12 cỡ trong `BOARD_SIZES`, 4→88 thẻ), không phải bản đồ 50
  cấp: ở đó cấp chỉ quyết định cỡ bàn, còn độ khó nằm ở năm tuỳ chọn. Giá trị
  phát ra vẫn là một số CẤP hợp lệ (cấp đầu tiên của mỗi cỡ) để engine, server
  và khoá lưu kỷ lục không phải đổi — mỗi cỡ bàn một khoá. Thời gian gốc ngoài
  Chiến dịch là `baseTimeLimit = cặp×9`, KHÔNG dùng `levelSpec().timeLimit`
  (con số đó còn trừ 2 giây mỗi cấp, là cách Chiến dịch siết dần).
- **Mặc định năm tuỳ chọn = MỨC 0 cả năm** (bàn trơn, thuần trí nhớ). Người chơi
  tự bật thứ mình muốn và lựa chọn đó được LƯU (`prefs.options`), nên mặc định
  chỉ áp cho người chơi mới. Test nào cần một luật cụ thể phải khai rõ cả năm
  hàng, đừng dựa vào mặc định — nó đã đổi hai lần.
- **KHÔNG CÒN "CHẾ ĐỘ".** Bốn chế độ cũ là bốn tổ hợp cờ của cùng một engine,
  nay là năm tuỳ chọn bàn chơi (`packages/engine/src/options.ts`): thời gian ·
  số mạng · xem trước · xáo thẻ · thẻ đặc biệt, mỗi cái 4 mức 0..3. Chiến dịch
  KHÔNG đi qua đó — nó là hành trình 50 màn có luật riêng từng màn.
  `mode` chỉ còn là KHOÁ LƯU kỷ lục/tiến độ, không còn luật chơi nào đọc nó.
- Năm màu cũ theo sang năm tuỳ chọn (icon `<OptionIcon>`): thời gian g-amber ·
  mạng g-red · xem trước g-teal · xáo thẻ tím · thẻ đặc biệt g-blue; Chiến dịch
  giữ g-violet. Nhánh người chơi: solo xanh / local hồng / online cyan.
  Gradient của icon khai báo MỘT LẦN ở `IconDefs.vue` — id gradient là toàn cục,
  mount nhiều bản là mọi icon lấy chung một màu.
- Trạng thái chọn đổi màu TỨC THÌ (không transition màu — chỉ hover
  desktop mới transition transform/shadow).

## Kiến trúc

- `packages/engine`: luật chơi TS thuần, **tất định** — cấm `Date.now()` /
  `Math.random()` (có test grep chặn); mọi thời điểm qua tham số `now`, mọi
  ngẫu nhiên qua `seed`. Server (Durable Object) và client chạy CHUNG engine.
- `apps/web`: Vue 3 + Vite. Engine không nằm trong `reactive()` — UI giữ
  `shallowRef` + số đếm `rev`, computed trả về BẢN SAO (Vue 3.4 không lan
  truyền khi computed trả cùng reference).
- `apps/server`: Cloudflare Worker + RoomDO (WebSocket Hibernation), 1 phòng
  = 1 DO, server-authoritative: client chỉ gửi `{t:'flip'}`, payload không
  bao giờ chứa thẻ úp (NF-04). Wrangler PHẢI v4.
- Trạng thái lên URL: `?playing=1` (ván dở, ruột trong sessionStorage bằng
  `engine.snapshot()`), `?room=CODE`, `?online=1`, `?w=<bước wizard>` —
  F5 không mất chỗ đứng; logo về trang chủ thì lau sạch URL (chủ đích).
  MenuScreen chỉ được đụng param `w`; App giữ phần còn lại.

## Kích thước để TEST và VẼ MOCKUP

- **Dùng VÙNG WEB, không phải kích thước màn hình.** Người chơi mở game trong
  trình duyệt điện thoại, nên phải trừ thanh địa chỉ (trên) và thanh công cụ
  (dưới) của Safari/Chrome. Lấy 932px cho iPhone 15 Pro Max là tự cho mình thừa
  gần 200px không có thật — rồi mọi phép đo "không scroll" đều sai theo.

  | máy | màn hình | **vùng web (dùng cái này)** |
  |---|---|---|
  | iPhone SE (nhỏ nhất còn phải đỡ) | 375 × 667 | **375 × 553** |
  | iPhone 14 / 15 | 390 × 844 | **390 × 664** |
  | iPhone 15 Pro Max | 430 × 932 | **430 × 745** |

  Ba con số vùng web trên là mức thanh địa chỉ ĐANG HIỆN — trạng thái xấu nhất,
  và là trạng thái người chơi thấy khi vừa mở trang. Cuộn xuống thì thanh thu
  lại và cao thêm ~85px, nhưng đừng thiết kế dựa vào đó: màn phòng chờ và màn
  chơi vốn KHÔNG SCROLL nên thanh không bao giờ tự thu.

- Chỗ trống của BÀN THẺ thì đã trừ sẵn HUD và dải người chơi: 351×510 (SE) và
  366×618 (iPhone 14) — xem `AREAS` trong `apps/web/test/board-fit.test.ts`.
  Đừng lẫn hai loại số này với nhau.

## Quy trình

- **NHÁNH: làm việc trên `develop`, KHÔNG commit thẳng vào `main`.** `main` là
  nhánh phát hành. Xong việc và test sạch thì merge
  `develop` → `main` (`pnpm test` + `pnpm typecheck` + `pnpm build` phải xanh,
  và các luật giao diện ở phần trên phải được kiểm bằng ảnh/đo DOM thật).
  Nhánh chính tên là `main`, không phải `master`.
- **PHIÊN ONLINE NẰM Ở `localStorage`, KHÔNG PHẢI `sessionStorage`** (`token` +
  `code` + `name` + `luc`, khoá `mm.online`). `token` là thứ DUY NHẤT server
  dùng để nhận ra ai vào lại, nên để trong sessionStorage là nó chết theo cái
  TAB: đóng tab rồi mở lại thành người lạ — id mới, avatar mới, chiếm thêm một
  chỗ. Đo được thật: phòng hiện ra `Kiên🦊 Mai🐼 Kiên🐯`, một người hoá hai.
  Đổi chỗ lưu KHÔNG đụng bảo mật — token vẫn do server sinh và vẫn là bí mật
  riêng. Nhưng PHẢI có hạn (`HAN_PHIEN_MS`, 30 phút): localStorage sống mãi nên
  thiếu hạn là hôm sau bấm "Chơi online" bị kéo vào phòng đã chết. Ván OFFLINE
  thì ngược lại, vẫn ở sessionStorage — nó gắn với `?playing=1` của một tab.
  `clientId` (localStorage, bền) CHỈ để thống kê, KHÔNG dùng nhận diện: client
  tự gửi nên ai cũng gửi được `cid` của người khác để chiếm chỗ họ.
- **Hạn giữ chỗ khi rớt mạng là 5 PHÚT** (`ROOM_LIMITS.reconnectMs`, và
  `IDLE_SILENT_MS` ở room.ts phải khớp). Mốc cũ 30 giây khiến khoá màn hình một
  lúc là mất chỗ, rồi vào lại được cấp chỗ MỚI — một người hoá hai. Nới không
  treo ván: hết lượt thì engine tự `turn-timeout`. Client tự nối lại có backoff,
  `onWake` thử lại cả khi đã báo lỗi, và màn lỗi có nút "Thử lại" (`o.retry()`).
- **SỔ PHÒNG CÔNG KHAI (ON-10)**: màn "Chơi online" mở ra là thấy danh sách
  phòng đang chờ (`GET /api/rooms/public`). Phòng mặc định CÔNG KHAI; chủ phòng
  tắt công tắc thì phòng ẩn khỏi danh sách nhưng vẫn vào được bằng mã 6 số —
  KHÔNG có mật khẩu riêng (mã phòng vốn đã là bí mật, thêm lớp nữa là bắt người
  chơi truyền tay hai thứ). Tên phòng LÀ tên chủ phòng, không có ô gõ tên.
  Cloudflare KHÔNG liệt kê được Durable Object, nên phòng phải tự KHAI lên một
  DO singleton (`SoPhongDO`); Node chỉ là một Map. Cả hai sau cùng interface
  `SoPhong` (`sophong.ts`), RoomDO không biết mình chạy ở đâu.
  Móc đồng bộ nằm trong `save()` — MỘT chỗ, có chốt `chuKySo()` để không khai
  lại sau mỗi nước lật thẻ; và mọi lối xoá phòng phải gọi `depPhong()` chứ không
  `storage.deleteAll()` trần, không thì phòng chết nằm lại trong danh sách. Có
  `tools/smoke-sophong.mjs` chạy với cả hai server.
- **Hết ván online phải còn đường VỀ PHÒNG CHỜ** (`t:'tolobby'`, một người bấm
  là đủ). `t:'again'` đòi mọi người còn kết nối cùng bấm nên khi đối phương đã
  đi thì không bao giờ đủ phiếu — thiếu `tolobby` thì người ở lại chỉ còn lối về
  menu và MẤT PHÒNG. Có `tools/smoke-tolobby.mjs` canh.
- `pnpm dev` = web :3001 + wrangler :8787 song song. `pnpm test` (engine +
  web), `pnpm smoke:online` và các script `tools/smoke-*.mjs` là E2E thật
  qua wrangler dev (cần server đang chạy); đặt `MM_SERVER=<url>` để soi chính
  worker đã deploy.
- **Server dự phòng (Node)**: `pnpm node:dev` chạy ở cổng 8080, `pnpm
  docker:build` đóng ảnh. GitHub Action `.github/workflows/docker.yml` chạy test
  + bộ smoke THẲNG vào server Node rồi mới đẩy ảnh lên GHCR (amd64 + arm64, vì
  VPS ở Việt Nam hay là ARM). Deploy Cloudflare vẫn là `pnpm release` chạy tay —
  Action không đụng tới.
- **SCHEMA PHÒNG LÀ BỐN BẢNG CHUẨN HOÁ** (`rooms` · `room_players` ·
  `room_themes` · `matches`). Ba luật dễ hiểu sai:
  (1) `rooms.id` là ĐỊNH DANH, `code` chỉ là một giá trị — phòng không bị xoá
  cứng nữa nên nếu `code` làm khoá chính thì mã 6 số không bao giờ tái dùng
  được; (2) `closed_at` và `left_at` là SỐ NGUYÊN, `0` = đang sống, nhờ vậy đặt
  được `UNIQUE (code, closed_at)`: chỉ MỘT phòng sống giữ một mã, còn phòng đã
  đóng thì trùng mã bao nhiêu cũng được; (3) mọi truy vấn tìm phòng đang sống
  PHẢI có `closed_at = 0` — quên là phòng đã đóng sống lại và người chơi vào
  được. Đóng phòng phải xoá `game_state` (4KB snapshot vô dụng) và `token`
  (bí mật vào lại một phòng không còn). Phòng đóng quá 30 ngày bị xoá cứng lúc
  khởi động; `matches` KHÔNG đi theo — lịch sử ván đấu sống lâu hơn phòng.
  `matches` trích thẳng từ `engine.snapshot()` (`summaryCache` + `endedAt`), nên
  không phải sửa room.ts; `INSERT IGNORE` + `UNIQUE (room_id, ended_at)` làm nó
  idempotent. `game_state` giữ nguyên khối JSON vì đó là ruột engine, không phải
  thực thể — tách ra là buộc database đổi theo mỗi lần đổi luật chơi.
- **KHO DÙNG POOL, KHÔNG PHẢI MỘT CONNECTION**: ghi một phòng là một giao dịch
  (rooms + room_players + room_themes cùng đúng hoặc cùng sai), mà hai giao dịch
  chồng nhau trên cùng connection thì `beginTransaction` thứ hai lặng lẽ commit
  cái thứ nhất. Kho giữ bảng tra `mã → id` trong RAM và PHẢI xoá khỏi đó khi
  phòng đóng, không thì phòng mới dùng lại mã cũ sẽ ghi đè phòng đã đóng.
- **PHÒNG LƯU XUỐNG MYSQL** (`apps/node-server/src/kho-mysql.ts`, bật bằng biến
  `MYSQL_URL`): không có nó thì mỗi lần Keel thay ảnh là mọi phòng đang mở biến
  mất. Ghi là GHI TRỄ (gộp 300ms, chạy sau) vì `save()` chạy sau MỖI nước lật
  thẻ — MySQL không được nằm trên đường đi của một nước đi; đo bằng bộ smoke thì
  có và không có MySQL không phân biệt được. Nguồn ĐỌC vẫn là Map trong RAM.
  Không đặt `MYSQL_URL` thì server chạy y như cũ, nên dev và CI không cần
  database. Khôi phục lúc khởi động PHẢI đặt lại alarm (ở Node alarm chỉ là
  `setTimeout`, chết theo tiến trình) — thiếu là phòng nằm chết, ván không tick.
  Và sau `deleteAll()` mọi lệnh lưu phải bị BỎ QUA: `depPhong()` gọi
  `deleteAlarm()` ngay sau đó, mà nó cũng lưu, nên nó ghi đè lệnh xoá bằng một
  bản ghi rỗng và phòng đã huỷ sống lại thành rác. Cả hai lỗi này đã xảy ra
  thật; `tools/smoke-kho.mjs` canh (cần server có `MYSQL_URL`, truyền
  `--restart "<lệnh>"` để kiểm cả phần khởi động lại).
- **MYSQL KHÔNG CHO CHẠY NHIỀU POD.** Nó chỉ giải quyết "sống sót qua deploy".
  WebSocket dính vào một pod, engine chạy trong RAM pod đó, alarm cũng ở đó, và
  broadcast không đi qua database — hai pod là hai bản sao cùng một phòng ghi đè
  nhau, hai người cùng mã phòng không thấy nhau. `replicas` vẫn PHẢI là 1 và
  `strategy: Recreate`. Muốn scale thì thứ phải làm trước là ĐỊNH TUYẾN DÍNH
  theo mã phòng (mọi kết nối của một mã luôn về đúng một pod), không phải thêm
  kho dữ liệu.
- **Cụm k8s ở nhà** (`deploy/k8s/`): server Node là bản CHÍNH, chạy trên MicroK8s ở Hà
  Nội tại `thebai.hello314.com` (tên chính người chơi vào) và `thebai-server.hello314.com`,
  namespace `thebai`. Cloudflare Worker lùi về `thebai2.hello314.com` làm dự phòng
  (đổi chỗ ngày 29.08.2026 — tên miền của Worker là *Custom Domain* ở tầng account,
  không nằm trong `wrangler.jsonc`; chi tiết ở sổ tay `my-secrets`). Push vào `main` → Action đẩy
  ảnh lên GHCR → **Keel** hỏi registry mỗi 2 phút rồi tự thay ảnh; KHÔNG có kubeconfig
  nào trong GitHub Secret. **`replicas` phải giữ nguyên 1 và `strategy: Recreate`** —
  phòng online nằm trong bộ nhớ tiến trình, hai pod là hai kho phòng riêng, người nhập
  mã vào pod kia sẽ nhận "không có phòng". Chi tiết ở `deploy/k8s/thebai.yaml`; sổ tay
  hạ tầng nằm ở repo `my-secrets` (`docs/services/thebai-server.md`) và phải cập nhật
  cùng lúc khi đổi gì ở đây.
- **Deploy: `pnpm release`** — web và phòng online nằm trong MỘT Worker
  (`apps/server/wrangler.jsonc` có khối `assets`), nên chỉ một lệnh, không còn
  chuyện web mới chạy với server cũ. `pnpm deploy:server` chỉ deploy worker mà
  KHÔNG build lại web — dùng khi biết chắc web không đổi. Không đặt Durable
  Object trong Pages được, nên `RoomDO` buộc ở Worker và gộp theo chiều này.
  `/api/*` và `/ws/*` phải nằm trong `run_worker_first`, bỏ ra là SPA fallback
  trả index.html cho lời gọi API (có test chặn). Đừng bật Workers Cache —
  request file tĩnh sẽ chuyển thành có phí.
- Patch bằng python replace PHẢI có `assert old in s` — đã 2 lần patch fail
  âm thầm gây bug ngoài production (bàn phím số). Cắt khối bằng `s.index()` thì
  mốc kết thúc phải là chuỗi DUY NHẤT.
- **Sửa CSS xong phải ĐO `getComputedStyle`**, đừng tin là đã sửa: đã hai lần
  rule trùng ở cuối file âm thầm ghi đè (cỡ chữ HUD, cỡ nút thoát).
- Đọc kết quả test phải xem cả dòng `Test Files`, không chỉ `Tests` — đã một lần
  tưởng xanh trong khi `Test Files 1 failed`.
- Test đỏ thất thường = đang phụ thuộc ngẫu nhiên (seed bàn thẻ). Sửa bằng cách
  chọn dữ liệu không có yếu tố đó, KHÔNG phải chạy lại cho tới lúc xanh.
- **BÀN XÁO NGẪU NHIÊN HOÀN TOÀN.** Không còn luật chống "hai thẻ cùng cặp nằm
  kề nhau" (trước đây xáo lại tới 200 lần cho tới khi sạch). Đã bỏ theo quyết
  định của chủ dự án — đừng thêm lại; `deck.test.ts` canh phân bố đúng mức ngẫu
  nhiên nên vòng lọc quay lại là test đỏ.
- Số của tuỳ chọn: **làm tròn LÊN**, không bao giờ để số thập phân tới tay người
  chơi (thời gian tròn lên bội số 5 giây). Số mạng neo theo BẢNG ĐO tỉ lệ sống
  sót, không chia số thẻ cho hằng số — số lần lật sai tăng theo bình phương số
  thẻ, nên chia tuyến tính làm ba mức dính vào nhau ở bàn nhỏ và cùng chết ở bàn
  lớn. Đo lại bảng bằng bot khi đổi luật mất mạng.
- **BÀN-BIẾT-TRƯỚC (`t:'predeal'`)**: server gửi nội dung CẢ BÀN cho client để lật
  thẻ hiện ngay, khỏi chờ vòng đi-về (đo được 180ms qua Cloudflare tunnel). Công tắc
  DUY NHẤT là `PREDEAL` ở `apps/server/src/flags.ts` (`PREDEAL=0` tắt gấp không cần
  build lại). Không có cờ nào ở client — tắt ở server là client không có gì trong tay
  và tự về hành vi chờ server.
  Đánh đổi đã chấp nhận: mở DevTools là thấy cả bàn; trò chơi với bạn bè nên KHÔNG
  chống bằng code. Nhưng phải chống LỖI CỦA MÌNH làm lộ bài, bằng ba lớp — **đừng phá
  lớp nào**: (1) dữ liệu đi bằng thông điệp RIÊNG, KHÔNG trộn vào `GameView`, nên
  `view.cards[].symbol` của thẻ úp vẫn rỗng; (2) client chỉ rót symbol vào ô ĐƯỢC PHÉP
  ngửa, qua đúng một cửa `symbolNeuDuocPhep()` — `predeal` KHÔNG được xuất ra khỏi
  composable; (3) `test/predeal.test.ts` canh cả hai (đã kiểm ngược: đọc thẳng
  `predeal` hay bỏ chốt là test đỏ).
  Móc gửi đặt trong `send`/`broadcast` của room.ts, KHÔNG rải ở từng chỗ dựng view —
  rải ra là có ngày thêm đường gửi mà quên. Gửi lại cả bàn kèm MỖI view (không chỉ lúc
  bắt đầu) vì xáo thẻ và thẻ Tráo đổi đổi chỗ thẻ giữa ván, bản đồ theo index sẽ lệch.
- **NƯỚC ĐI PHẢI GỬI LẠI ĐƯỢC — đây là lý do thật khiến game đi lần lượt vẫn
  hỏng vì mạng.** Mỗi `flip` mang `seq` tăng dần của riêng người gửi, server nhớ
  `lastFlipSeq` và BỎ tin trùng (nhưng vẫn trả view, không thì người gửi ngồi
  chờ tới hết lượt). Không có `seq` thì gửi lại một nước cũ trên dây trông y hệt
  lật thêm một thẻ, nên client không dám gửi lại và nước đi rơi là mất luôn.
  Client khởi tạo bộ đếm bằng `Date.now()` chứ không phải 0 — tải lại trang giữa
  ván mà đếm lại từ đầu là mọi nước đi mới bị chốt chống trùng nuốt sạch, im
  lặng, không lỗi nào hiện ra; `welcome.flipSeq` còn kéo nó lên trên số server
  đang giữ. `pending` được GIỮ qua các lần vào lại và gửi lại sau khi nối
  (`guiLaiChoGui`), nên nhánh bỏ cuộc là lối DUY NHẤT dọn nó.
- **Thang xử lý sự cố đi từ RẺ tới ĐẮT**: 1,5s im → gửi lại · 3s → gửi lại ·
  4,5s → `t:'resync'` (xin lại trạng thái trên socket ĐANG MỞ) · 6s → mới mở lại
  socket. Đừng đảo lại: bắt tay TCP+TLS+WS chính là thứ dễ hỏng nhất trên mạng
  yếu, nên lấy nó làm cách chữa đầu tiên là mạng càng yếu càng hỏng thêm.
- **Đồng hồ lượt DỪNG khi người đang đi nghẽn mạng, nhưng CÓ TRẦN**
  (`TURN_PAUSE_CAP_MS` 5 PHÚT, neo đúng `ROOM_LIMITS.reconnectMs`, cộng dồn
  trong một lượt, cấp lại mỗi lượt). Dừng là dừng MỌI đồng hồ: `elapsed()` cũng
  đứng theo, không thì giữ được lượt mà vẫn thua vì hết giờ ván. Trần cũ 30 giây
  vô nghĩa với người chơi — chỗ trong phòng giữ 5 phút mà lượt mất sau 30 giây.
  Trần là bắt buộc: việc dừng dựa vào nhịp `alive` do CLIENT gửi — bản cũ nằm
  trong cache service worker, một bản dựng lỗi, hay ai đó nối bằng công cụ riêng
  đều làm ván TREO HẲN, tệ hơn hẳn cái nó định chữa. Ngưỡng phát hiện nghẽn là
  `LAG_MS` 7 giây ở room.ts, KHÁC `SILENT_MS` 20 giây (hai câu hỏi khác nhau:
  "còn ở đây không" và "đường truyền có kịp đưa nước đi lên không"). Mọi mốc đẩy
  vào `scheduleNext` PHẢI ở tương lai — mốc quá khứ làm alarm nổ vòng và nuốt
  luôn những mốc khác (đo được: bàn Chớp nhoáng nằm hé mở 10,9 giây thay vì 3,6).
- **`turnLimit` = `TURN_LIMIT_SEC` 25 giây, không phải 15.** 15 giây là gốc của
  gần hết chuyện "mạng yếu là hỏng": ngưỡng phát hiện nghẽn phải ngắn hơn nó, mà
  mạng di động nghẽn 5-10 giây là thường, nên 15 không chừa chỗ cho cơ chế cứu
  nào. Neo test vào hằng số, đừng chép tay con số.
- **ĐỔI DẠNG TRÊN DÂY THÌ CLIENT KHAI, SERVER KHÔNG TỰ QUYẾT.** Web là PWA:
  service worker giữ bản JS cũ trong cache, nên ngay sau MỖI lần deploy luôn có
  người đang chạy client cũ hơn server — đó là trạng thái bình thường của vài
  phút đầu, không phải ca hiếm. Đã hỏng thật: server đổi sang gửi view dạng gọn
  cho TẤT CẢ, client cũ đọc `view.cards` ra `undefined`, người chơi trên iPhone
  (và mọi trình duyệt điện thoại) thấy BÀN TRẮNG KHÔNG CÓ THẺ NÀO; máy tính
  không dính vì nó tải bản mới liên tục. Nay client khai `?pv=1` lúc mở socket,
  server lưu vào `Attachment.goi` và `broadcast` dựng HAI bản. Chốt tương tự cho
  `seq`: tin không kèm `seq` vẫn phải chạy. `tools/smoke-client-cu.mjs` canh.
- **VIEW GỬI Ở DẠNG GỌN** (`packView`/`unpackView`): bỏ mảng `cards`, chỉ mang
  `n` và những ô KHÔNG úp trơn. Gói ở đúng hai hàm gửi của room.ts, không rải ra
  từng chỗ dựng view. `unpackView` nhận CẢ HAI dạng nên bên nhận không cần biết
  bên gửi chọn dạng nào. `predeal` chỉ phát cho cả phòng khi bàn THỰC SỰ đổi chỗ
  thẻ (xáo thẻ, thẻ Tráo đổi); đường `send()` tới một socket thì vẫn gửi đủ.
  Bộ smoke mở gói bằng `tools/lib-view.mjs`. Đo thật trên bàn 88 thẻ: 6 nước lật
  từ 8.049 byte xuống 1.423.
- Bot: người chơi đi `flip()` (có chốt chặn lượt), bot đi `applyFlip()`. Nhập
  một đường là bot tự chặn chính nó, ván treo. Bot phải `observe` MỖI KHUNG, nếu
  không nó mù trước mọi nước của đối thủ.
- Bot chỉ có MỘT tham số: nửa đời ký ức (`BOT_HALF_LIFE`), `retain` suy ra bằng
  `0,5 ** (1 / nửa đời)`. `mistake` và `capacity` đã bỏ — ba tham số cùng làm một
  việc (khiến bot quên) mà tương tác nhau, chỉnh một cái là phải đo lại cả ba.
  Đổi bảng thì PHẢI đo bằng TỈ LỆ THẮNG 1v1 (`test/duel.test.ts`), đừng đo số lần
  lật khi bot chơi một mình: bộ số cũ đo solo rất đẹp mà vào trận thật thắng 0%,
  vì solo không có ai làm ký ức bot già đi giữa hai lượt.
- Bàn nhỏ có TRẦN ~57% dù bot nhớ tuyệt đối — ván ngắn nên ai bốc trúng cặp mới
  là chính. Đừng cân bằng bàn nhỏ bằng cách nâng trí nhớ.
- Hai mức cạnh nhau phải cách nhau ĐỦ RỘNG: đường tỉ lệ thắng bão hoà ở quãng
  nửa đời 12→15 rồi mới dựng lại từ 18, nên 12 và 15 ra hai mức gần như bằng
  nhau (bàn nhỏ và vừa bằng hệt nhau). Thang đang dùng: 3 · 6 · 12 · 20.
- **HAI CHỖ CHẠY SERVER, MỘT BỘ LUẬT.** `apps/server` (Cloudflare Worker + Durable
  Object) và `apps/node-server` (Node, dự phòng — đặt được ở Hà Nội khi CF lag).
  Luật phòng dùng CHUNG `apps/server/src/room.ts`: node-server nạp thẳng lớp
  `RoomDO` và chỉ thay tầng dưới bằng `cf-shim.ts`. **Đừng bao giờ tạo bản luật
  thứ hai cho Node** — hai bản sẽ lệch nhau ở đúng những chỗ đã tốn hàng loạt sự
  cố để tìm ra (mất mạng im lặng, bàn treo, chia link, kiểm biên tuỳ chọn).

  Nhưng TẦNG HTTP thì có hai bản, nên **đổi/thêm endpoint là phải sửa CẢ HAI**:
  `apps/server/src/index.ts` và `apps/node-server/src/index.ts` (route
  `/api/rooms`, `/api/rooms/:code`, `/ws/:code`, sinh mã phòng, CORS, thứ tự
  API-trước-SPA-fallback). Có test canh hai bên khớp nhau. Sửa `themes.ts` cũng
  vậy — bản Node dùng chung file của apps/server.

  Đổi bất cứ gì trong room.ts thì chạy bộ smoke với CẢ HAI: `pnpm dev:server` rồi
  `MM_SERVER=http://127.0.0.1:8787 …`, và `pnpm node:dev` rồi
  `MM_SERVER=http://127.0.0.1:8080 …`.
- **Đổi thể thức chơi thì PHẢI cập nhật hướng dẫn.** Luật chơi được kể lại ở
  `RulesDialog.vue` (và tóm tắt ở ô chọn trong `OnlineScreen.vue`, dòng cấu hình
  phòng chờ, thẻ chia sẻ og). Thêm/bỏ/đổi một luật mà quên chỗ này là người chơi
  đọc thấy một thứ không còn tồn tại — mà không có test nào đỏ. Rà bằng cách tìm
  thẳng tên luật trong toàn bộ mã nguồn, đừng đi theo trí nhớ. Icon trong hướng
  dẫn dùng CÙNG bộ với icon của luật đó trong màn chơi, để đọc xong nhận ra ngay.
- **LƯỚI THEME LÀ MỘT BẢN CSS DÙNG CHUNG** (`styles/theme-grid.css`), hai màn
  (MenuScreen và OnlineScreen) chỉ gắn class `.theme-grid`. Trước đây mỗi màn
  một bản và chúng lệch nhau hai lần: ngưỡng ẩn emoji (phòng online mất emoji
  trên iPhone), rồi cơ chế ô-cao-tối-thiểu (24 theme bên online bóp ô còn ~30px,
  dính sát nhau). Số cột `repeat(auto-fill, minmax(84px, 1fr))` nên thêm theme
  là máy rộng xếp thêm cột; hàng `minmax(clamp(66px, --app-h*0.105, 96px), 1fr)`
  — còn chỗ thì ô GIÃN lấp hết, hết chỗ thì dừng ở sàn rồi cuộn (đặt cứng
  `var(--o-cao)` là máy cao còn một khoảng trống to mà ô vẫn bé). Chiều cao do
  LƯỚI quyết định vẫn là xác định nên `container-type: size` giải được; chỉ
  `height: auto` mới làm truy vấn nhận 0.
- **`#app` LẤY CHIỀU CAO TỪ `--app-h` (JS đo), `100dvh` chỉ là dự phòng.**
  `useViewportLock.ts` đo `innerHeight` và kéo document về 0 ở mọi lối trang hiện
  lại, kèm `history.scrollRestoration = 'manual'`. Không có nó thì mở lại Chrome
  trên iPhone là header nằm ngoài màn hình và dưới footer có một khoảng trắng —
  trình duyệt dựng lại trang trước khi chốt chiều cao thanh công cụ (dvh ra số
  cũ) VÀ khôi phục luôn vị trí cuộn, mà `html, body { overflow: hidden }` khoá
  mất đường kéo về. Đừng lấy `visualViewport.height`: nó co khi bàn phím mở.
- **Lớp hiệu ứng kết ván ở `z-index: 9`, DƯỚI hộp kết quả (10).** `DefeatFx` cũ
  để 40 nên lớp xám và vết rạn phủ luôn lên bảng tỉ số (đã bị báo lỗi, có ảnh).
  Đặt dưới còn làm `backdrop-filter` chỉ lọc bàn thẻ và HUD, đúng thứ cần lọc.
- **Lưới chọn theme CUỘN TRONG KHUNG, không nén ô nhỏ dần** — khác luật chung
  của wizard (`grid-auto-rows: minmax(0,1fr)`, thêm ô thì ô bé lại). Theme còn
  thêm mãi, mà đo trên iPhone SE với 15 theme thì ô đã chỉ còn 34,7px, dưới
  ngưỡng chạm. Nay ô cố định 68px và danh sách tự cuộn — nút "Tiếp" vẫn đứng
  yên nên KHÔNG phá luật KHÔNG SCROLL. Chiều cao phải XÁC ĐỊNH (`height: 68px`,
  không phải `auto` + `min-height`): `.option` có `container-type: size`, mà
  container query chỉ giải được khi chiều cao xác định — để auto thì truy vấn
  nhận 0 và hàng emoji mẫu bị ẩn ở mọi cỡ ô.
- Theme nằm ở `apps/web/public/data/themes.json` + bản sao server
  `apps/server/src/themes.ts` — sửa một nơi phải sửa nơi kia. Mỗi theme ≥18
  biểu tượng unique (test kiểm file thật).
