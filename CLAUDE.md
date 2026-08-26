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
  12 cỡ bàn = 3×4 (mobile) / 4×3 (desktop); 12 theme = 3×4 / 4×3.
- Hiệu ứng `:hover` phải bọc trong `@media (hover: hover)` — thiết bị cảm
  ứng giữ trạng thái hover của lần chạm trước, gây "2 ô cùng sáng".
- Kích thước chạm tối thiểu 44px (NF-07); lưới lẻ ô (3×3, 5×5) có ô trống
  chính giữa; mặt sau lá bài cả bàn PHẢI giống hệt nhau (khác = đánh dấu bài).
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

## Quy trình

- **NHÁNH: làm việc trên `develop`, KHÔNG commit thẳng vào `main`.** `main` là
  nhánh phát hành. Xong việc và test sạch thì merge
  `develop` → `main` (`pnpm test` + `pnpm typecheck` + `pnpm build` phải xanh,
  và các luật giao diện ở phần trên phải được kiểm bằng ảnh/đo DOM thật).
  Nhánh chính tên là `main`, không phải `master`.
- `pnpm dev` = web :3001 + wrangler :8787 song song. `pnpm test` (engine +
  web), `pnpm smoke:online` và các script `tools/smoke-*.mjs` là E2E thật
  qua wrangler dev (cần server đang chạy); đặt `MM_SERVER=<url>` để soi chính
  worker đã deploy.
- **Server dự phòng (Node)**: `pnpm node:dev` chạy ở cổng 8080, `pnpm
  docker:build` đóng ảnh. GitHub Action `.github/workflows/docker.yml` chạy test
  + bộ smoke THẲNG vào server Node rồi mới đẩy ảnh lên GHCR (amd64 + arm64, vì
  VPS ở Việt Nam hay là ARM). Deploy Cloudflare vẫn là `pnpm release` chạy tay —
  Action không đụng tới.
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
- Số của tuỳ chọn: **làm tròn LÊN**, không bao giờ để số thập phân tới tay người
  chơi (thời gian tròn lên bội số 5 giây). Số mạng neo theo BẢNG ĐO tỉ lệ sống
  sót, không chia số thẻ cho hằng số — số lần lật sai tăng theo bình phương số
  thẻ, nên chia tuyến tính làm ba mức dính vào nhau ở bàn nhỏ và cùng chết ở bàn
  lớn. Đo lại bảng bằng bot khi đổi luật mất mạng.
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
- Theme nằm ở `apps/web/public/data/themes.json` + bản sao server
  `apps/server/src/themes.ts` — sửa một nơi phải sửa nơi kia. Mỗi theme ≥18
  biểu tượng unique (test kiểm file thật).
