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

## Hướng thiết kế đã chốt: C · Arcade neon

- **Màn định danh** (mỗi ô một thứ khác nhau — cách chơi, chế độ, entry
  online): ô gradient MÀU RIÊNG luôn bật, chữ/icon trắng (class
  `.neon .g-*` trong global.css); đang chọn thì thắp outline trắng.
- **Màn cấu hình** (lưới, theme): ô nền tối; Ô ĐƯỢC CHỌN bùng gradient
  tím + glow (`aria-checked/pressed` + `:not(.neon)`).
- Màu cố định từng chế độ, dùng xuyên suốt: Chiến dịch g-violet ·
  Cổ điển g-blue · Đua thời gian g-amber · Sinh tồn g-red ·
  Chớp nhoáng g-teal; nhánh người chơi: solo tím / local hồng / online cyan.
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
- **Deploy: `pnpm release`** — web và phòng online nằm trong MỘT Worker
  (`apps/server/wrangler.jsonc` có khối `assets`), nên chỉ một lệnh, không còn
  chuyện web mới chạy với server cũ. `pnpm deploy:server` chỉ deploy worker mà
  KHÔNG build lại web — dùng khi biết chắc web không đổi. Không đặt Durable
  Object trong Pages được, nên `RoomDO` buộc ở Worker và gộp theo chiều này.
  `/api/*` và `/ws/*` phải nằm trong `run_worker_first`, bỏ ra là SPA fallback
  trả index.html cho lời gọi API (có test chặn). Đừng bật Workers Cache —
  request file tĩnh sẽ chuyển thành có phí.
- Patch bằng python replace PHẢI có `assert old in s` — đã 2 lần patch fail
  âm thầm gây bug ngoài production (bàn phím số).
- Theme nằm ở `apps/web/public/data/themes.json` + bản sao server
  `apps/server/src/themes.ts` — sửa một nơi phải sửa nơi kia. Mỗi theme ≥18
  biểu tượng unique (test kiểm file thật).
