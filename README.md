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

**Thông báo trong ván nổi trên mép bàn** (`.notice-bar` trong global.css), cao
`0px` và đè lên HUD. Hai điều nó cố tình không làm: không hiện giữa bàn (che
đúng chỗ đang bấm, mà lúc mắt thần hé cả bàn thì che nghĩa là mất luôn thứ vừa
trả giá để xem), và không chiếm chỗ (chiếm chỗ thì bàn thẻ co giãn mỗi lần
thông báo hiện/tan, thẻ nhảy dưới ngón tay).

**Vùng chạm và HÌNH của nút là hai chuyện khác nhau.** Nút thoát trên HUD:
hình 28px cho vừa chiều cao dòng, vùng chạm vẫn 44px (NF-07) nhờ
`::after { inset: -8px }`. Để nút nhìn thấy đúng 44px thì nó cao hơn cả HUD;
thu vùng chạm xuống 28px thì ngón tay không bấm được.

**Cỡ chữ trong wizard dùng chung `.option strong` / `.option small`** ở
wizard.css. Đừng ghi đè cỡ chữ theo dáng ô — đã có hai rule làm thế
(`.options.loose > .option:not(.wide)` và `.option.big`) khiến bước 1 ra 18px
trong khi các bước sau ra 22,7px, cùng một wizard hai cỡ chữ. Ghi đè ICON thì
được, icon ô lớn thật sự cần nở theo ô.

### Hiệu ứng lá bài (CardTile)

- **Lắc phải cùng TRỤC với cú lật.** Thẻ lật quanh trục dọc (`rotateY`) nên nhịp
  lắc cũng phải là `rotateY` đi quá mốc rồi đảo chiều — như cánh cửa bản lề.
  Dùng `rotateZ` (xoay tròn trong mặt phẳng) thì hai chuyển động khác trục, mắt
  thấy sai ngay.
- **Nhịp lắc do JS bật (`.wob-up` / `.wob-down`), KHÔNG do selector trạng thái.**
  `.card:not(.up) .inner { animation: flip-down }` áp cho MỌI lá đang úp, kể cả
  lá chưa bao giờ bị lật; mà keyframe đó mở ở `rotateY(180deg)` — mặt TRƯỚC
  hướng ra ngoài — nên mỗi lá úp đều loé nội dung rồi mới quay về úp. **Lộ bài**,
  thấy rõ nhất khi F5 giữa ván (cả bàn loé một nhịp). Có test chặn.
- **Hover và cú lật phải ở HAI LỚP khác nhau**: nhịp lắc lúc hover gắn vào
  `.card`, animation lật gắn vào `.inner`. Để chung một lớp thì hover ghi đè
  animation lật, và lúc RỜI chuột `flip-down` chạy lại từ khung đầu —
  `rotateY(180deg)`, mặt trước quay ra ngoài. **Lộ bài mỗi lần đưa chuột ra khỏi
  một lá vừa úp** (đo được -180°). Có test chặn.
- **Một lá chỉ nên có một animation chạy cùng lúc**: cái sau ghi đè cái trước.
  Vì thế nhịp lắc lúc lật chỉ bật sau khi chia bài xong (cờ `.dealt`) — trước đó
  animation `deal` lo phần lắc; chạy cả hai thì hoá ra chia bài không lắc gì.
- **`perspective` là thuộc tính áp cho CON, không áp cho chính nó.** `.card` có
  `perspective: 700px` nên `.inner` quay có chiều sâu, còn chính `.card` quay thì
  phải viết `transform: perspective(700px) rotateY(...)`, không thì trông như bị
  bóp bề ngang.
- Mọi nhịp lắc tắt hẳn khi người dùng bật "giảm chuyển động".

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
| Đấu với máy | Cấp sau mở khi NGƯỜI thắng bot (hoà cũng tính). Không lấy "bàn sạch" làm mốc: phần lớn bàn do bot dọn, chọn Bot siêu đẳng rồi ngồi xem là mở hết cấp mà không chơi gì. Nút "Cấp tiếp theo" hỏi `store.unlockedLevel()`, thua thì thành "Chơi lại". 1v1 với bot ngay trên trình duyệt, không cần mạng. 4 mức (Bot dễ / bình thường / Pro / siêu đẳng) khác nhau ở TRÍ NHỚ, xem `packages/engine/src/bot.ts`. Mức "Bot dễ" **không** cộng điểm tích luỹ |
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

  | Mức | `retain` | nửa đời (nước) | nhớ lẫn chỗ |
  |---|---|---|---|
  | Bot dễ | 0,7071 | 2 | 60% |
  | Bot bình thường | 0,8409 | 4 | 40% |
  | Bot Pro | 0,9170 | 8 | 20% |
  | Bot siêu đẳng | 0,9439 | 12 | 10% |

  `retain = 0,5 ** (1 / nửa đời)` — sửa nửa đời thì tính lại, đừng đoán.
  "Nhớ lẫn chỗ" = có cặp trong ký ức nhưng vẫn đi bốc lá khác.

  **Ghi nhớ là 100%**, chỉ có nhớ LẠI mới là xác suất; và ở nước ngay sau khi
  thấy thì `retain ** 0 = 1` nên mức nào cũng nhớ chắc. Vì thế `mistake` là van
  duy nhất chặn bot ăn một cặp nó vừa thấy. Đã cân nhắc thêm tham số `encode`
  (xác suất ghi được vào đầu) rồi BỎ: người chơi không phân biệt được "không kịp
  ghi" với "biết mà lật trượt", mà hai van cùng diễn một chuyện thì mỗi lần cân
  bằng phải nghĩ cả hai.

  Số đo (số lần lật để bot một mình dọn sạch bàn, 40 seed):

  | bàn | Bot dễ | bình thường | Pro | siêu đẳng |
  |---|---|---|---|---|
  | 4×4 (8 cặp) | 36,1 | 30,4 | 27,4 | 26,4 |
  | 6×7 (21 cặp) | 161,9 | 116,8 | 86,7 | 77,5 |

  Hai điều đọc ra từ bảng này: **bàn nhỏ thì bốn mức gần như bằng nhau** (lật hết
  một lượt là biết cả bàn, trí nhớ không kịp phát huy) — muốn cảm nhận khác biệt
  phải từ bàn 20 thẻ trở lên; và **với Bot dễ thì `mistake` gần như vô tác dụng**
  (nâng 30%→60% chỉ làm nó chậm thêm 4,6%) vì nửa đời 2 nước thì nó hiếm khi có
  cặp nào trong đầu để mà bỏ. Muốn Bot dễ yếu hơn nữa thì giảm NỬA ĐỜI.

  Nhịp nghĩ: 400–3000ms, **giống nhau ở mọi mức** — cho bot giỏi nghĩ nhanh hơn
  thì ngồi đếm thời gian là đoán ra mức, mà độ khó vốn nằm ở trí nhớ. Rút bằng
  rng của bot nên vẫn tất định (`botThinkMs`). Hai ngoại lệ cắt thời gian chờ:
  lá THỨ HAI của lượt chỉ 250–800ms (đã cân nhắc ở lá đầu, nghĩ lâu cả hai lá
  làm một lượt dài tới 6 giây), và còn đúng một cặp thì 300ms.

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

## Bẫy đã sập — đọc trước khi sửa

Mỗi dòng ở đây là một lỗi ĐÃ xảy ra thật, không phải lo xa. Kèm cách phát hiện,
vì thứ khó nhất không phải sửa mà là biết mình đang sai.

### CSS

- **Rule trùng ở cuối file vẫn đang ghi đè.** Sửa cỡ chữ trong HudBar không có
  tác dụng vì cuối file còn `.stat span`/`.stat b` khai báo lại; sửa cỡ chữ
  wizard cũng vậy. **Cách phát hiện:** ĐO `getComputedStyle`, đừng tin là đã
  sửa. Một lần đo bằng Playwright chỉ mất 30 giây và cho con số thật.
- **`.btn` toàn cục đặt `min-width`/`min-height: 44px`.** Khai báo `width`/
  `height` nhỏ hơn thì nút vẫn nở lại — phải ghi đè cả hai cặp. Cùng loại bẫy
  với trên: đo, đừng đoán.
- **`animation` trên cùng một phần tử thì cái sau đè cái trước**, không cộng
  gộp. Hai hiệu ứng cùng lúc = mất một cái, im lặng.
- **Transition không diễn được nhịp tắt dần.** `transition` chỉ đi một chiều từ
  giá trị cũ sang mới; muốn quá đà rồi trả về, hay lắc giảm biên độ, phải dùng
  `@keyframes`.
- **Selector trạng thái ≠ "vừa mới đổi trạng thái".** `:not(.up)` đúng với cả lá
  chưa bao giờ lật. Cần "vừa đổi" thì phải để JS gắn class một lần (xem
  `flipAnim` trong CardTile) — đây chính là cái gây lộ bài.

### Test

- **Đọc cả dòng `Test Files`, không chỉ `Tests`.** Đã một lần grep mỗi dòng
  `Tests ` rồi tưởng xanh, trong khi `Test Files 1 failed`.
- **Test bấm "hai lá bất kỳ" để nhường lượt là bẫy**: khoảng 1/15 bàn thì đúng
  hai lá đó khớp nhau, ghép đúng thì người chơi GIỮ lượt và bot không bao giờ
  được đi. Ba test đấu bot đã đỏ vì chuyện này. Phải chọn lá có `pairId` khác.
- **Mốc chờ mặc định 5 giây của vitest quá chặt cho test web ở đây** (đã nâng lên
  30s): test đẩy đồng hồ ảo qua vài giây ván đấu, mỗi 16ms ảo là một khung
  `requestAnimationFrame` chạy cả vòng lặp session — 5 giây ván là hơn 300 khung.
  Máy đang tải (ví dụ `pnpm dev` đang bật) là vượt mốc 5 giây THẬT. Dấu hiệu nhận
  ra: test đỏ ở đúng mốc 5044/15030ms và không có dòng `AssertionError`.
- **Test đỏ thất thường = test đang phụ thuộc thứ ngẫu nhiên.** Seed lấy từ
  `Math.random()`, nên test Sinh tồn bấm phải lá "mắt thần" là cả bàn lật lên và
  lượt dò không còn tính là sai. Sửa bằng cách CHỌN dữ liệu không có yếu tố đó
  (chỉ lấy cặp không mang thẻ đặc biệt), không phải bằng cách thử lại.
- **Test xanh vì lý do sai.** Test "mức dễ không cộng điểm" từng xanh khi ván
  chưa kết thúc (điểm hai đầu đều 0). Luôn kèm một mệnh đề chốt rằng tình huống
  đã thật sự xảy ra (`expect(...).toContain('Chơi lại')`), và một test đối chứng
  chiều ngược lại.
- **Bot chen vào giữa hai cú bấm của một cặp** làm bàn khoá và nước sau bị bỏ →
  ghép hết bàn mà được 0 cặp. Test nào kiểm chuyện khác thì tắt bot đi
  (`session.setBot(null)`) và chờ hết khoá trước.
- **Nhịp nghĩ của bot là một KHOẢNG** nên `advanceTimersByTime` phải chờ dư,
  không thì test đỏ đúng lúc bot rút phải nhịp chậm.

### Probe bằng Playwright

- **`NFD` không tách được `Đ`/`đ`.** Bỏ dấu để so chữ thì "Đấu với máy" thành
  "Đau voi may", không phải "Dau voi may" — locator trượt và im lặng trả về
  false. So bằng đoạn không có `đ`, hoặc bấm theo `.option` thứ n.
- **Đo góc quay 3D phải dùng ma trận**, `asin` không phân biệt 0° với 180°.
  Lấy `atan2(-m.m13, m.m11)` từ `DOMMatrix`.
- Trước khi kết luận "không thấy phần tử", dump `textContent` của mọi `button` —
  đã nhiều lần tưởng lỗi code trong khi chỉ là chuỗi tìm sai.

### Engine và bot

- **Bot phải nhìn bàn mỗi khung, không phải mỗi lượt.** Nhìn theo lượt thì thẻ
  người chơi lật rồi úp lại không bao giờ vào ký ức — bot mù trước mọi nước của
  đối thủ, chơi như đánh một mình.
- **Đường lật của bot và của người phải TÁCH.** Thêm chốt chặn lượt vào `flip()`
  mà bot cũng gọi `flip()` thì bot tự chặn chính nó, ván treo vĩnh viễn. Bot đi
  `applyFlip()`, người đi `flip()`.
- **Chặn nước đi ở GỐC, không chỉ khoá giao diện.** Bấm được trong lượt bot thì
  nước đó ghi vào tài khoản bot — người chơi tự tay mở thẻ cho đối thủ ăn điểm.
- **`retain` và nửa đời ký ức là quan hệ hàm số mũ.** Đổi nửa đời thì phải tính
  `0,5 ** (1 / nửa đời)`; nhích `retain` "một chút" không bằng nhớ dai thêm "một
  chút". Và luôn ĐO lại độ khó sau khi đổi: bộ 2/4/5/6 nhìn có vẻ giãn đều nhưng
  đo ra Pro và Siêu đẳng chỉ chênh 6%, người chơi không phân biệt được.
- **Mốc mở cấp phải là thành tích CỦA NGƯỜI, không phải trạng thái bàn.** Trong
  ván đấu bot thì bàn sạch không chứng minh gì — bot dọn phần lớn. Và mọi nút
  dẫn tới cấp sau phải hỏi lại `store.unlockedLevel()`, đừng chỉ so `id + 1`:
  nút không biết cấp đó có mở hay không.
- **Computed đọc localStorage phải có mốc phản ứng riêng** (`progressRev`), không
  thì nó nhớ mãi giá trị cũ. Đừng lấy `totalScore` làm mốc: ván Bot dễ không
  cộng điểm, gán lại cùng một số thì Vue không coi là thay đổi.
- **Trần cho thẻ đặc biệt mạnh.** Không chặn thì bàn 21 cặp ra tới 6 lá tráo,
  ván thành may rủi (`POWER_MAX`).

### Âm thanh

- **Sóng VUÔNG ở ~1kHz nghe như báo lỗi lò vi sóng**: hoạ âm bậc lẻ dồn đúng dải
  tai người nhạy nhất (2–4kHz). Tiếng đếm ngược cũ dùng nó. Giờ đếm ngược là một
  câu nhạc ngũ cung đi lên (C5 D5 E5 G5 A5, tam giác + quãng tám rất nhẹ) và vào
  ván là hợp âm C trưởng rải nhanh đọng ở C6 — câu nhạc dựng lên rồi được giải
  quyết, nghe ra "bắt đầu!" chứ không phải một tiếng bíp nữa.
- **Nhiễu lọc highpass ở 2–3kHz nghe "rẹt rẹt" xót tai.** Tiếng giấy/bìa nên
  dùng bandpass quanh 700–1000Hz với Q hẹp, cộng một nốt trầm rất nhẹ để có
  thân. Ít tiếng mà đúng dải còn hơn nhiều tiếng.
- iOS treo `AudioContext` khi app xuống nền: mọi đường vào phải kiểm lại context
  còn sống (`verifyAlive`), `suspended` coi như chết và dựng lại.

### Sửa file bằng script

- **Xoá một rule CSS thì đếm lại dấu `}`.** Xoá rule cuối trong khối
  `@media` để lại dấu đóng thừa → cả file style 500, trang trắng. Kiểm nhanh:
  `curl -s "http://localhost:3001/src/components/X.vue?vue&type=style&index=0&scoped=true&lang.css" | head -2`
  — ra HTML thay vì JS là đang lỗi.
- **Patch bằng python PHẢI `assert old in s`.** Đã hai lần patch fail âm thầm gây
  bug ngoài production.
- Cắt một khối bằng `s.index("...")` thì mốc kết thúc phải là chuỗi DUY NHẤT —
  một lần cắt trúng `</div>` sai chỗ làm hỏng template, phải `git checkout` lại.

## Sai lệch có chủ ý so với SRS

- **Thẻ đặc biệt gắn trên một thẻ đơn, không phải cả cặp.** SRS nói "lật trúng thẻ bom →
  úp lại 2 cặp", nhưng lưới phải luôn chẵn ô. Giải pháp: hiệu ứng gắn lên đúng *một*
  trong hai thẻ của một cặp và kích hoạt ngay khi thẻ đó được lật, dùng một lần.
  Giữ được đúng luật chẵn ô và đúng tinh thần "lật trúng thì lãnh hậu quả".
- **Thưởng thời gian chỉ áp dụng cho chơi đơn.** Ở chế độ luân phiên nhiều người, cộng
  điểm thời gian cho một người là vô nghĩa vì đồng hồ dùng chung.
