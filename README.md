# Lật Thẻ — Game Thẻ Bài Trí Nhớ

Game rèn luyện trí nhớ chạy trên trình duyệt. Hiện thực theo SRS v1.0, đã hoàn thành
mốc **v1.0 + v1.1** của lộ trình (mục 6).

## Chạy nhanh

```bash
pnpm install

pnpm dev        # phát triển — Vite + HMR, http://localhost:3001
pnpm test       # 60 test (engine + UI)
pnpm typecheck  # tsc + vue-tsc
pnpm build      # ra apps/web/dist
pnpm serve      # web server Node thuần phục vụ bản build, http://127.0.0.1:3001
```

`pnpm serve` không cần dependency nào; đổi port bằng `node server.js 4000`, đổi thư mục
gốc bằng `MM_ROOT=... node server.js`.

## Ràng buộc UI quan trọng

**Không scroll trên mobile**: mọi màn (wizard, lobby, màn chơi) phải trọn
trong viewport — nút hành động chính không bao giờ bị đẩy khỏi màn hình.
Lưới lựa chọn dùng `grid-auto-rows: minmax(0, 1fr)` để tự nén theo chỗ còn
lại; thêm lựa chọn = ô nhỏ đi, không dài trang ra. Chi tiết xem CLAUDE.md.

## Cấu trúc

```
packages/engine/     Luật chơi — TypeScript thuần, không phụ thuộc DOM/framework
apps/web/            Giao diện — Vue 3 + Vite
legacy/v1/           Bản vanilla JS đầu tiên, giữ để tham chiếu (node legacy/v1/server.js 3002)
server.js            Web server tĩnh cho bản build production
```

### Nguyên tắc kiến trúc

**Engine là nguồn sự thật duy nhất, và nó tất định.**

- Engine không bao giờ gọi `Date.now()` hay `Math.random()`. Mọi hàm nhận `now` từ
  bên ngoài, mọi ngẫu nhiên đi qua `seed`. Có test canh việc này
  (`packages/engine/test/determinism.test.ts`).
- Nhờ vậy cùng `(seed, chuỗi hành động, mốc thời gian)` luôn cho cùng kết quả — điều
  kiện để **server và client chạy chung một engine** mà không lệch trạng thái. Đây là
  nền cho v2.0 (server-authoritative, ON-09) và chế độ Race (ON-06, mọi người nhận
  bàn giống hệt nhau).
- Vue **không** bọc engine trong `reactive()`. Lớp UI giữ một `shallowRef` tới instance
  cùng số đếm `rev`, và đọc ra bản sao (xem `apps/web/src/composables/useGameSession.ts`).
  Nếu để trạng thái bàn thẻ sống trong hệ reactive của Vue thì engine sẽ không còn dùng
  chung được với server.

## Đã có

| Nhóm | Nội dung |
|---|---|
| Chơi đơn | Cổ điển (SP-01), Đua thời gian (SP-02), Chiến dịch (SP-03), Sinh tồn (SP-04), Chớp nhoáng (SP-05). **Mọi chế độ** đều đi qua cùng một thang 50 cấp |
| Nhiều người | 2–4 người cùng thiết bị, luân phiên, xếp hạng cuối ván (MP-01…MP-04). Dùng được mọi chế độ trừ Chiến dịch |
| Thang cấp | 50 cấp, 9 cỡ bàn từ 4 tới 42 thẻ, chia 4 chặng. Sao và kỷ lục riêng từng chế độ, mở khoá dùng chung |
| Thẻ đặc biệt | Tráo đổi, x2, mắt thần, đóng băng — bật từ cấp 3 (3.4). **Bom đang tắt**: xem `PLAYABLE_POWERS` trong `deck.ts`, luật xử lý vẫn còn nguyên để bật lại |
| Điểm | 100/cặp, combo x1.2/x1.5/x2, −10 lượt sai (Cổ điển), +5/giây còn lại, xếp 1–3 sao (3.5). Ván thi đấu cũng cộng vào tổng tích luỹ |
| Nội dung | 12 theme nạp từ `apps/web/public/data/themes.json` (6 mở sẵn, 6 mở bằng điểm tích lũy — 3.6). Mặc định bật hết theme đang mở khoá |
| Lưu trữ | Kỷ lục và sao theo từng chế độ, tuỳ chọn, 7 thành tích — localStorage (3.7) |
| Phi chức năng | Responsive 320px+, dark mode, ba mức âm lượng, điều hướng bàn phím, chạm ≥44px, PWA chạy offline |

### Luật riêng của từng chế độ

Người chơi xem được ngay trong game: nút **?** trên thanh trên cùng mở bảng
"Luật chơi" (`RulesDialog.vue`) — sửa luật thì phải sửa cả chỗ đó.

| Chế độ | Luật |
|---|---|
| Cổ điển | Không giới hạn thời gian; lật sai −10 điểm |
| Đua thời gian | Đồng hồ đếm ngược; mỗi cặp đúng **+2 giây** (`MATCH_TIME_BONUS_MS`), xong sớm thưởng thêm điểm |
| Sinh tồn | 5 mạng. Chỉ mất mạng khi thẻ vừa mở **đã từng lộ ra** — lật hai thẻ chưa ai thấy là dò bài, không bị trừ. Dưới 2 mạng mà ghép đúng **hai lần liền** thì hồi 1 mạng |
| Chớp nhoáng | Đếm ngược 5 giây báo trước, rồi hé mở cả bàn — thời gian nhìn giãn theo số thẻ (`peekMsFor`: 2 giây + 0,26 giây mỗi thẻ, nên bàn 42 thẻ được 13 giây) |
| Chiến dịch | Riêng chế độ này xếp 1–3 sao; nửa sau siết mốc sao. Cấp cần nhiều biểu tượng hơn bộ theme khả dụng sẽ bị khoá kèm nhắc |

### Luật chung cần biết khi sửa engine

- Bàn thẻ **không xếp hai thẻ cùng cặp cạnh nhau** (`deck.ts`) — trừ lưới dưới
  3 cặp, vì 2×2 chỉ có một cách xếp không kề nên ván nào cũng sẽ giống nhau.
- Cỡ bàn lấy từ bảng `BOARDS` trong `campaign.ts`, KHÔNG tính ra từ số cặp. Bảng
  đó là tập bàn duy nhất thoả cùng lúc bốn điều kiện: kín hết ô (không ô trống),
  tỷ lệ ≤ 2, lá bài ≥ 44px trên máy nhỏ nhất, và lấp được chỗ trống không hở hai
  bên. Thêm cỡ bàn mới thì phải kiểm lại cả bốn — lý do từng cỡ bị loại nằm ở
  chú thích của `BOARDS`.
- Nhiều người: mỗi lượt **15 giây**, ghép đúng +5 giây (trần 15). Bằng điểm là
  **hoà** (`isDraw`), không lấy người đầu danh sách làm người thắng.
- Chơi nhiều ván với nhau có **tỷ số cả loạt** (số ván thắng), giữ ở client theo
  tên người chơi.
- Avatar rút theo **seed** nên mỗi ván một bộ khác, còn F5 giữa ván vẫn giữ nguyên.

### Thêm theme mới (không sửa code)

Thêm một mục vào `apps/web/public/data/themes.json`:

```json
{ "id": "space", "name": "Không gian", "unlockAt": 8000, "symbols": ["🚀", "🛸", "…"] }
```

Cần tối thiểu 18 biểu tượng cho lưới 6×6. `unlockAt` là điểm tích lũy cần có; `0` = mở sẵn.

## Chơi online (v2.0)

Backend: **Cloudflare Durable Objects** (`apps/server`) — mỗi phòng là một DO chạy
chính `packages/engine`, WebSocket Hibernation, trạng thái snapshot vào storage.

- Tạo phòng mã 6 chữ số + link mời `?room=CODE` (ON-01), 2–4 người, chủ phòng chọn
  chế độ/lưới/theme (ON-03), turn-based realtime (ON-04/05). Chế độ dùng được
  trong phòng: `ROOM_MODES` — mọi thứ trừ Chiến dịch
- Emoji chat giới hạn 3 lần / 10 giây, chặn ở server (`ROOM_LIMITS.emojiBurst`)
- Server-authoritative: client chỉ gửi `{t:'flip'}`; payload không bao giờ chứa
  thẻ úp (ON-09, NF-04); emoji chat danh sách đóng (ON-08)
- Rớt mạng có 30 giây vào lại bằng token, quá hạn bị xử thua (ON-07)

```bash
pnpm dev:server     # wrangler dev tại http://localhost:8787
pnpm dev            # web — mặc định trỏ VITE_SERVER_URL=http://localhost:8787
pnpm smoke:online   # E2E: 2 client chơi trọn ván qua WebSocket (cần dev:server đang chạy)
pnpm deploy:server  # wrangler deploy (cần đăng nhập Cloudflare)
```

Deploy production: chạy `pnpm deploy:server` lấy URL worker, rồi đặt biến build
`VITE_SERVER_URL=https://memory-match-server.<account>.workers.dev` trong Cloudflare
Pages và rebuild.

## Chưa làm (v2.1+)

Quick match (ON-02), chế độ Race (ON-06), tài khoản, bảng xếp hạng toàn cầu,
PWA offline, i18n.

## Sai lệch có chủ ý so với SRS

- **Thẻ đặc biệt gắn trên một thẻ đơn, không phải cả cặp.** SRS nói "lật trúng thẻ bom →
  úp lại 2 cặp", nhưng lưới phải luôn chẵn ô. Giải pháp: hiệu ứng gắn lên đúng *một*
  trong hai thẻ của một cặp và kích hoạt ngay khi thẻ đó được lật, dùng một lần.
  Giữ được đúng luật chẵn ô và đúng tinh thần "lật trúng thì lãnh hậu quả".
- **Thưởng thời gian chỉ áp dụng cho chơi đơn.** Ở chế độ luân phiên nhiều người, cộng
  điểm thời gian cho một người là vô nghĩa vì đồng hồ dùng chung.
