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

`#app` có `overflow: hidden` ở khối CHUNG, không chỉ khối desktop. Thiếu nó thì
bất kỳ thứ gì tràn ra đều làm cả trang cuộn được, lộ một khoảng trắng sâu bên
dưới — lỗi rất khó tái hiện vì phụ thuộc nội dung đang hiện.

**Bàn thẻ đo chỗ trống thật** (`useBoardFit`), dùng chung cho chơi đơn và online.
Đừng tính bằng hằng số kiểu `100dvh - 300px`: hằng số đoán sai ngay khi bố cục
đổi, và nó không biết gì về khoảng tỷ lệ lá bài. Tỷ lệ thẻ được phép tới VUÔNG
(1,0) — khoá ở 3:4 thì bàn cao bị chặn chiều cao trước, bề rộng thừa thành hai
dải trống (đo trên iPhone SE: bàn 2×4 hở 160px).

**Thanh emoji luôn MỘT hàng**: đúng 8 emoji, nút `flex: 1 1 auto` với sàn 34px
và trần 44px. Thêm cái thứ 9 là nút co xuống dưới ngưỡng bấm được, hoặc gãy
thành hai hàng — vừa xấu vừa ăn chỗ của bàn thẻ.

**Điểm tích luỹ hiện gọn** (`numShort`: 90.000 → "90k"). Số đầy đủ làm huy hiệu
phình ra và cắt mất chữ trong tên game.

- **Nhịp lắc lúc lật do JS bật (`.wob-up` / `.wob-down`), không do selector
  trạng thái.** `.card:not(.up) .inner { animation: flip-down }` áp cho MỌI lá
  đang úp kể cả lá chưa từng lật, mà keyframe đó mở ở `rotateY(180deg)` — mặt
  trước hướng ra ngoài — nên cả bàn loé nội dung một nhịp. **Lộ bài.** Thấy rõ
  nhất khi F5 giữa ván. Có test chặn.
- Nút thoát trên HUD giữ vùng chạm 44px (NF-07) nhưng dùng `margin-block` âm để
  không kéo cao cả HUD. Bỏ 44px cho HUD thấp lại là sai — ngón tay không bấm được.

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
| Thang cấp | 50 cấp, 9 cỡ bàn từ 4 tới 42 thẻ, chia 4 chặng. Sao và kỷ lục riêng từng chế độ, mở khoá dùng chung. Bản đồ cấp là ngoại lệ DUY NHẤT được cuộn — cuộn TRONG khung app, không phải cả trang |
| Đấu với máy | 1v1 với bot ngay trên trình duyệt, không cần mạng. 4 mức (Bot dễ / bình thường / Pro / siêu đẳng) khác nhau ở TRÍ NHỚ, xem `packages/engine/src/bot.ts`. Mức "Bot dễ" **không** cộng điểm tích luỹ |
| Thẻ đặc biệt | Tráo đổi, x2, mắt thần (hé cả bàn **5 giây**), đóng băng — có từ cấp 1, thưa ở cấp dễ rồi dày dần tới 30% (3.4). Thẻ tráo có trọng số gấp đôi nhưng **trần 2 lá mỗi bàn** (`POWER_MAX`), nhiều hơn thì ván thành may rủi. **Bom đang tắt**: xem `PLAYABLE_POWERS` trong `deck.ts`, luật xử lý vẫn còn nguyên để bật lại |
| Điểm | 100/cặp, combo x1.2/x1.5/x2, −10 lượt sai (Cổ điển), +5/giây còn lại, xếp 1–3 sao (3.5). Ván thi đấu cũng cộng vào tổng tích luỹ |
| Nội dung | 12 theme nạp từ `apps/web/public/data/themes.json` (6 mở sẵn, 6 mở bằng điểm tích lũy — 3.6). Mặc định bật hết theme đang mở khoá |
| Lưu trữ | Kỷ lục và sao theo từng chế độ, tuỳ chọn, 7 thành tích — localStorage (3.7) |
| Thông báo trong ván | Thông báo (thẻ đặc biệt, chuyển lượt, emoji đối thủ) nổi ở **dải trên mép bàn** (`.notice-bar`), cao 0px và ĐÈ lên HUD — không hiện giữa bàn (che chỗ đang bấm) và không chiếm chỗ (bàn thẻ co giãn mỗi lần thông báo hiện/tan) |
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

### Đối thủ máy (bot)

- Bot **chỉ đọc `publicView`** — đúng payload mà client online nhận. Thẻ úp không
  có `symbol` trong đó (NF-04), nên bot không thể gian lận về mặt kiến trúc, chứ
  không phải vì nó "tự nguyện không xem". ĐỪNG BAO GIỜ truyền `MemoryGame` hay
  `Card[]` vào `bot.ts`.
- Độ khó đến từ **giới hạn ký ức**, không phải từ việc cho bot cố tình lật sai:
  mỗi nước đi qua, khả năng nhớ một lá nhân thêm `retain`, nên bot quên dần tự
  nhiên. Bot biết hết rồi giả vờ sai thì người chơi nhận ra ngay là giả.

  | Mức | `retain` | nửa đời (nước) | nhớ lẫn chỗ | nghĩ |
  |---|---|---|---|---|
  | Bot dễ | 0,7071 | 2 | 30% | 2–5s |
  | Bot bình thường | 0,8409 | 4 | 20% | 1–4s |
  | Bot Pro | 0,9170 | 8 | 10% | 0,7–3,5s |
  | Bot siêu đẳng | 0,9439 | 12 | 5% | 0,5–2s |

  `retain = 0,5 ** (1 / nửa đời)` — sửa nửa đời thì tính lại, đừng đoán.
  "Nhớ lẫn chỗ" = có cặp trong ký ức nhưng vẫn đi bốc lá khác. Nhịp nghĩ là một
  KHOẢNG rút bằng rng của bot (`botThinkMs`): nhịp cố định nghe ra ngay là máy,
  và khoảng của các mức chồng nhau nên không đếm thời gian mà đoán được mức.

- Bộ điều khiển ở `useGameSession`: `botWatch()` chạy **mỗi khung**, không chỉ lúc
  tới lượt bot — nhìn theo lượt thì thẻ người chơi lật rồi úp lại không bao giờ
  vào ký ức bot, bot hoá ra mù trước mọi nước của đối thủ.
- Lượt của bot thì `flip()` của người chơi bị **chặn ở gốc** (không chỉ khoá giao
  diện): bấm được trong lượt bot nghĩa là người chơi tự tay mở thẻ cho bot ăn.
- Bot đi qua `applyFlip()`, người chơi đi qua `flip()`. Nhập hai đường lại là bot
  tự chặn chính nó.

### Luật chung cần biết khi sửa engine

- Tỉ lệ thẻ đặc biệt LÀM TRÒN LÊN, sàn 1 cặp khi tỉ lệ > 0 và bàn từ 3 cặp. Làm
  tròn xuống thì bàn nhỏ ra 0 (6 cặp × 7% = 0,42) nên người chơi phải tới cấp 25
  mới gặp thẻ tráo lần đầu — coi như tính năng không tồn tại.
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
- **Thẻ bom đang TẮT**, không xoá: xem `PLAYABLE_POWERS` trong `deck.ts`. Bật lại
  chỉ là thêm `'bomb'` vào danh sách, luật xử lý còn nguyên và bản lưu cũ vẫn đọc
  được. Thay bằng thẻ **tráo đổi** (`'swap'`) — hoán chỗ hai thẻ ĐÃ TỪNG LỘ RA
  mà chưa ghép được. Tráo thẻ chưa ai mở là vô nghĩa: người chơi không có ký ức
  nào về chúng để bị phá, chỉ còn cái animation cho vui. Chưa đủ hai thẻ như vậy
  (đầu ván) thì KHÔNG tráo và để dành thẻ cho lần sau (`powerUsed = false`).
- Thẻ tráo đổi phải chuyển cả tập `seen` theo LÁ BÀI, không theo ô: "đã từng lộ
  ra" là thuộc tính của lá bài, không chuyển thì Sinh tồn trừ mạng oan.
- Hiệu ứng tráo làm ở UI theo kiểu ngược: engine đã đổi chỗ xong, UI đặt mỗi lá
  về chỗ CŨ rồi kéo về 0. Mặt sau mọi lá giống hệt nhau nên KHÔNG có animation
  thì người chơi không thể biết vừa xảy ra gì.
- Chớp nhoáng: thời gian nhìn giãn theo số thẻ (`peekMsFor` = 2 giây + 0,26 giây
  mỗi thẻ), kèm đếm ngược 5 giây báo trước. Cố định 4 giây thì bàn nhỏ thừa thãi
  mà bàn lớn không ai nhớ nổi.

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
  chế độ/cấp độ/theme (ON-03), turn-based realtime (ON-04/05). Chế độ dùng được
  trong phòng: `ROOM_MODES` — mọi thứ trừ Chiến dịch
- **Mã phòng phải tồn tại thật.** `POST /api/rooms` gọi `RoomDO.open()` đánh dấu
  phòng đã mở; `GET /api/rooms/:code` cho client kiểm trước khi mở WebSocket.
  Thiếu bước này thì MỌI mã 6 số đều "vào được" (Durable Object sinh theo tên),
  nên gõ sai là lập phòng mới trong im lặng
- **Chơi lại là bỏ phiếu**, không phải quyền của chủ phòng: ai cũng bấm được,
  `RoomInfo.againVotes` cho cả phòng thấy ai đã bấm, đủ phiếu thì tự về lobby.
  Đối phương rời hẳn thì nút biến mất thay vì bấm vô nghĩa
- **Bấm thẻ phản hồi ngay**, không chờ hết vòng đi-về: ô vừa bấm lật tới đúng 90
  độ (cạnh thẻ, chưa thấy mặt nên không phạm NF-04), view về mới lật nốt
- **Ping đo bằng auto-response**: `setWebSocketAutoResponse` trả lời `{t:'ping'}`
  ngay ở tầng runtime nên KHÔNG đánh thức Durable Object — đây là chỗ tốn tiền
  nhất nếu làm sai (DO tính phí theo thời gian thức). Chỉ hiện ping của MÌNH;
  không đo được ping của người kia, với họ chỉ hiện trạng thái kết nối
- Emoji chat giới hạn 3 lần / 5 giây, chặn ở server (`ROOM_LIMITS.emojiBurst` và `emojiWindowMs`)
- Server-authoritative: client chỉ gửi `{t:'flip'}`; payload không bao giờ chứa
  thẻ úp (ON-09, NF-04); emoji chat danh sách đóng (ON-08)
- Rớt mạng có 30 giây vào lại bằng token, quá hạn bị xử thua (ON-07)

```bash
pnpm dev:server     # wrangler dev tại http://localhost:8787
pnpm dev            # web :3001 + wrangler :8787 song song
pnpm smoke:online   # E2E: 2 client chơi trọn ván qua WebSocket (cần dev:server đang chạy)
                    # MM_SERVER=<url> để soi chính worker đã deploy
pnpm release        # build web + deploy CẢ web và server trong một Worker
```

### Deploy: MỘT Worker duy nhất

Web và phòng online nằm trong cùng một Worker (`apps/server/wrangler.jsonc`), nên
`pnpm release` là lệnh deploy duy nhất. Trước đây web ở Cloudflare Pages còn
worker deploy riêng: hai lần deploy, hai host, và đã hai lần xảy ra chuyện web
mới chạy với server cũ vì quên deploy worker.

Không gộp theo chiều ngược lại được: Cloudflare không cho đặt Durable Object
trong Pages project (*"You cannot create and deploy a Durable Object within a
Pages project"*), nên `RoomDO` buộc phải ở Worker.

| Đường dẫn | Ai xử lý | Tính phí |
|---|---|---|
| `/api/*`, `/ws/*` | code Worker (`run_worker_first`) | có — WebSocket chỉ tính lúc bắt tay, tin nhắn sau đó miễn phí |
| còn lại | tầng static assets, KHÔNG gọi Worker | không — *"static assets are free and unlimited"* |

Ba điều dễ làm hỏng:

- Bỏ `run_worker_first` thì SPA fallback trả `index.html` cho `/api/rooms` —
  client nhận HTML, lỗi lúc chạy, không có gì báo đỏ. Có test chặn
  (`apps/web/test/deploy-config.test.ts`).
- **Đừng bật Workers Cache**: bật là request file tĩnh chuyển thành có phí.
- Client tự lấy `location.origin` ở bản build, nên KHÔNG cần `VITE_SERVER_URL`
  nữa. Biến đó vẫn được tôn trọng nếu muốn trỏ tay.

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
