# Lật Thẻ (Memory Match) — ghi chú cho Claude

## BẢN ĐỒ TÀI LIỆU — đổi một thứ, biết phải đổi theo ở đâu (15.10.2026)

- **`docs/ban-do.md`** — mọi "sự thật" công khai (60 màn, 15 ngôn ngữ, 48 bộ hình, hơn 100
  danh hiệu, email, tên miền, ID store…) kèm NGUỒN GỐC trong code và MỌI CHỖ nhắc lại
  (trang công khai, bản dịch, trang store, README, CLAUDE.md). Đổi sự thật = đi hết hàng
  đó; thêm chỗ nhắc lại mới = thêm vào bảng trong cùng commit.
- **`docs/ngon-ngu.md`** — thêm/bớt/đổi ngôn ngữ: 14 chỗ + bảng mã từng hệ.
- **`docs/trang-cong-khai.md`** — 4 trang công khai (about/changes/support/privacy), dựng
  theo ngôn ngữ cho SEO, Google Search Console, thêm mục "Có gì mới".
- `docs/i18n-style.md` (thuật ngữ dịch) · `docs/store-listing.md` (chữ store 15 ngôn ngữ) ·
  `docs/mobile-ci.md` (ra bản app). Trang studio `cozypi.com` ở repo riêng `itlboy/cozypi-site`.

## Ràng buộc thiết kế BẮT BUỘC

- **KHÔNG SCROLL trên mobile**: mọi màn hình (wizard chọn chế độ/lưới/theme,
  lobby online, màn chơi, bản đồ Chiến dịch) phải hiển thị TRỌN VẸN trong
  viewport — nút hành động chính (Bắt đầu, Tạo phòng…) không bao giờ bị đẩy
  ra ngoài màn hình. Cơ chế: `#app` khoá `100dvh`; panel là flex column
  chiếm trọn chỗ; bước hiện tại (`.step-body`) `flex: 1; min-height: 0`;
  lưới lựa chọn `grid-auto-rows: minmax(0, 1fr); overflow: hidden` để các ô
  tự nén theo chỗ còn lại. Thêm lựa chọn mới = ô nhỏ lại, KHÔNG dài trang ra.
- Lưới lựa chọn phải **tròn hàng** (không ô lẻ thừa hàng cuối):
  12 cỡ bàn = 2×6; 12 theme = 3×4 / 4×3; 4 mức số người (1..4) = BỐN THANH NGANG
  xếp dọc như bước mức máy (lưới 2×2 bị chê "hơi trống" 12.10.2026) — chơi
  chung một máy TỐI ĐA 4 người (chủ dự án chốt: 10 người "không chơi nổi");
  online vẫn tới 10. Dải lối tắt dùng lớp `lt-chip`, KHÔNG `.chip` (toàn cục, xếp cột).
  Từ 11.10.2026 "Chơi nhanh" gộp cả một mình lẫn nhiều người: bước đầu còn 4 ô
  (Chiến dịch · Chơi nhanh · Đấu máy · Online) + dải lối tắt (`.loi-tat`, NGOÀI
  lưới ô vì lưới chia đều 1fr), số người hỏi ở bước `count`.
- Hiệu ứng `:hover` phải bọc trong `@media (hover: hover)` — thiết bị cảm
  ứng giữ trạng thái hover của lần chạm trước, gây "2 ô cùng sáng".
- Kích thước chạm tối thiểu 44px (NF-07) — NGOẠI LỆ đã chốt: hai cỡ bàn lớn
  nhất (72 và 88 thẻ) cố ý phá ngưỡng, là bàn siêu khó người chơi tự chọn;
  mọi cỡ ≤56 thẻ vẫn phải giữ, có test canh. Lưới lẻ ô (3×3, 5×5) có ô trống
  chính giữa; mặt sau lá bài cả bàn PHẢI giống hệt nhau (khác = đánh dấu bài).
- **CẢNH KẾT VÁN: MỘT CẢNH CỐ ĐỊNH CHO MỖI TÌNH HUỐNG** (bộ mới 11.10.2026, chủ
  dự án duyệt mockup https://claude.ai/artifact/YQ6amnuWjzsHQeisNB1iC4 và chốt
  THAY bộ cũ). Thắng có ≥3, thua có ≥2 BIẾN THỂ bốc THEO SEED ván
  (`BIEN_THE`, `bocBienThe`): thắng = pháo giấy · pháo hoa đêm · vương miện;
  thua = đập vỡ màn · tan thành tro (game over kiểu TV đen BỎ 14.10.2026: lệch hẳn nét Kẹo, đen sì che bàn + chip). Pháo hoa đêm còn nền tối nhưng DỊU về 50% đúng lúc bảng kết quả hiện (`fx-diu`, mốc `--hien-bang`). Kỷ lục = biến thể thắng + băng
  vàng. Thêm biến thể: id ở `BIEN_THE` + nhánh `chayCanh` + template + CSS + tiếng
  `TIENG_BIEN_THE` (test canh đủ). TIẾNG THUA phát Ở KetCucFx theo biến thể,
  KHÔNG ở chỗ gọi (phát cả hai là chồng hai tiếng thua). Canvas hạt PHẢI nằm trên
  lớp nền tối (z 2) và dưới chữ (z 3) — từng nằm dưới, pháo hoa gần như vô hình.
  Duyệt biến thể trên máy thật: chế độ debug → Luật chơi → "Xem thử hiệu ứng" (bật debug: chạm 7 lần vào dòng phiên bản cuối trang Luật chơi, hoặc `?debug=1` — nút bật KHÔNG nằm sẵn trên màn, chủ dự án 14.10.2026). Bốn cảnh:
  thắng · kỷ lục · thua · hoà (cảnh "máy trêu" đã BỎ 14.10.2026 — đấu máy hiện y như
  đấu người; dòng an ủi "còn N cặp" CHỈ ở ván một mình, prop `motMinh`), chọn ở
  `chonCanh()`. `lib/ketcuc-fx.ts` lo chọn cảnh, mốc `HIEN_BANG_MS` (App và
  OnlineGame đọc, đừng chép tay số) và chuyển động JS; chữ lớn là CSS có delay ở
  `styles/ketcuc-fx.css`; `KetCucFx.vue` là component DUY NHẤT. Cảnh CHẠM BÀN
  THẺ (gợn sóng, lá rơi) bằng thuộc tính RIÊNG `translate/rotate/scale`, KHÔNG
  `transform` — lá đang dùng transform để lật, ghi đè là lộ mặt. Dọn cảnh phải
  `cancel()` mọi animation, không thì Chơi lại ra bàn thiếu lá. Lá rơi so le tối
  đa 600ms tổng (90ms/lá thì bàn 88 thẻ mất 8 giây — harness bắt). Tiếng vẫn ở
  chỗ gọi (`victory/win`), mốc khớp cảnh; tiếng THUA (cả thua máy, thua online) do
  KetCucFx phát theo biến thể — `defeat` (máy cười) không còn ai gọi. Huy hiệu danh hiệu: `MoKhoaFx` (z 19) bay vào viên
  🏅, viên chỉ nhích khi chạm (`dangKhoe`), khoe sau khi bảng kết quả hiện
  (`moKhoa(ids, { treMs })`), bậc cao trước.
- **MẶT SAU LÁ BÀI NẰM Ở SỔ RIÊNG.** Thêm/sửa/xoá chỉ đụng hai file:
  · mặt sau: một tên trong `CARD_BACKS` (engine) + một khối ở
  `styles/card-backs.css`. Thiếu khối là lá bài ra Ô TRẮNG TRƠN.
  Mọi mặt sau dùng chung khuôn
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
- **CHẠM VÀO LÁ BÀI — ba lớp, ba lý do khác nhau** (`CardTile.vue`):
  · **Ngón tay đặt xuống** (`.card.nhan`): PHÓNG TO 1,06 + rung một nhịp theo
  trục lật (`rotate: y`), KHÔNG ĐỔI MÀU MẶT LƯNG (chủ dự án 12.10.2026). Bản cũ
  lún 0,94 + thay lớp hoạ tiết bằng nền TRẮNG đục 92% — trạng thái nhấn kẹt là lá
  đứng yên thành Ô TRẮNG, đúng dạng "lá trắng" người chơi báo. Đây là phản hồi
  DUY NHẤT người chơi điện thoại có trước khi biết kết quả. Phải có
  `setPointerCapture`, và ba chốt chống kẹt: `lostpointercapture`, lá đổi trạng
  thái, tự nhả sau 1,5 giây (`nhaNhan`).
  · **Hover** (`.card.wob-hover`): phóng to 1,05 — vào 0,28s, ra 1s. Dùng
  `transition` chứ KHÔNG `animation`: animation không cắt giữa nhịp cho êm được,
  nên bản cũ phải chạy hết 1,4s và rời chuột rồi lá vẫn to thêm hơn một giây
  (người chơi báo). `z-index: 4` vì lá to ra là mép chờm sang ô bên cạnh.
  · **Loé viền** (`.card.loe`, 520ms): dấu "lá này VỪA MỞ", phát cho MỌI lá vừa
  mở — kể cả lá do đối thủ hoặc do MÁY mở. Trên bàn 56–88 thẻ không ai thấy đối
  phương mở lá nào (đã bị phản ánh); vòng sáng chạy ra ngoài mép nên bắt được
  mắt ở tầm nhìn ngoại vi. Tín hiệu đi từ event `flip` → `vuaMo` (ở cả
  `useGameSession` và `useOnlineRoom`) → BoardGrid → CardTile.
- **CHIA THẺ THEO HÀNG, LÚN RỒI NỞ** (`lib/timing.ts` + keyframes `deal`):
  mỗi hàng lệch nhau `DEAL_ROW_GAP_MS` 100ms, hàng trên trước; mỗi lá hiện ở cỡ
  0,92 rồi nở về 1 (nở quá 1,015 rồi mới về, không thì cái nở dừng đột ngột).
  Cả bàn đọc thành MỘT gợn sóng. Bản cũ so le 28ms mỗi THẺ và mỗi lá bay vào từ
  scale 0,72 + lệch 16px + xoay 22° rồi lắc tắt dần 2,4 giây — ba chuyển động
  cùng lúc trên hàng chục lá, đó chính là cái "giật".
  `DEAL_ANIM_MS` (520ms) PHẢI khớp `animation: deal 0.52s` trong CSS: JS dùng con
  số đó để biết lá đã nằm yên (`settled`, tức mở lại hover) — bản cũ khai 2,4s
  nên nó khoá hover hơn hai giây sau khi lá đã yên. `DEAL_TOTAL_CAP_MS` 3 giây là
  chốt chặn cho lúc thử nhịp cao (500ms × 11 hàng = 5 giây chờ trước nước đi đầu).
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
- **CHI PHÍ CỦA MỘT NHỊP CẬP NHẬT BÀN TÍNH THEO SỐ LÁ — bàn 88 thẻ ONLINE là ca
  xấu nhất.** Server broadcast lại CẢ view mỗi nhịp đồng hồ lượt, không chỉ khi
  có nước đi, nên mỗi giây Vue patch lại 88 component dù trên bàn không đổi gì.
  Offline cùng chi phí đó mà không ai thấy vì bàn chỉ đổi lúc người chơi bấm.
  Ba luật rút ra, đã đo trên bàn 8×11 (ms mỗi nhịp, Chrome desktop):
  · mặt sau vẽ bằng ẢNH NỀN, KHÔNG `mask` — mask là một bộ đệm nhân điểm ảnh cho
  MỖI lá: mask+hàng auto 0,94ms · mask+hàng `1fr` 1,38ms · ảnh nền+`1fr` 0,88ms.
  Hoạ tiết vốn là mực TRẮNG kèm opacity từng nét nên hai cách cho ra cùng hình.
  · các computed dựng bàn (`cards`, `faceUp`, `matchedSet` ở OnlineGame) phải
  GIỮ NGUYÊN THAM CHIẾU khi chữ ký nội dung không đổi (`giuNeuGiong`) — nhịp đồng
  hồ khi đó không đụng tới bàn thẻ. Chữ ký phải sinh từ chính dữ liệu dựng ra,
  viết tay là có ngày thiếu một mẩu và bàn đứng hình.
  · bàn ≥56 thẻ BỎ cú lắc 2,2 giây sau khi lật (chỉ còn transition 340ms): lá
  ~34px thì cái lắc gần như không thấy, mà máy vẫn vẽ lại lá đó suốt 2,2 giây.
  Đo bằng harness Chrome headless (`--dump-dom` + `document.title`), đừng đoán;
  FPS/rAF KHÔNG đo được ở máy này (thiếu display link), nên đo ms style+layout.
- **BANNER "ĐẾN LƯỢT …" NAY CHỈ CÒN Ở BÀN NHIỀU NGƯỜI THẬT CHUNG MỘT MÁY.**
  Ở đó nó là lời gọi ĐƯA MÁY cho người kế tiếp. Hai chỗ còn lại đã tắt vì chip
  của người đang đi nay nở rộng + gradient tím, nói đủ rồi, mà banner thì đập
  vào giữa màn hình MỖI LƯỢT:
  · ONLINE: công tắc `BAO_DEN_LUOT` ở đầu `useOnlineRoom.ts` (`false`);
  · ĐẤU BOT: nhận ra bằng `BOT_ID` TRONG DANH SÁCH NGƯỜI CHƠI, không bằng cờ
  `botLevel` — cờ đó tắt được giữa ván, cùng lý do vì sao chỗ xét thắng/thua
  đọc bảng xếp hạng chứ không đọc cờ.
  Chuyện ĐÓNG BĂNG vẫn báo ở cả hai: đó là SỰ KIỆN hiếm, không phải nhịp lặp
  mỗi lượt, và chip chỉ đeo được một icon chứ không kể được chuyện. Người chơi
  đã bác bản "chỉ bỏ banner của người khác, giữ banner của mình" — đừng dựng lại.
- **ĐỔI CỠ NÚT EMOJI THÌ PHẢI TÍNH LẠI MỐC ẨN BỚT.** Thanh emoji không cho
  xuống hàng và không cho nút co lại; máy hẹp thì ẩn từ CUỐI danh sách, nên mốc
  tính từ cỡ nút thật: n nút cần `(cỡ + gap)·n − gap`. Nút nay 40px + gap 4 →
  391/347/303/259px cho 9/8/7/6 nút. Để nguyên mốc cũ khi phóng nút là máy hẹp
  cố nhét 9 nút vào chỗ đủ 7 và cả thanh tràn. `test/diem-trong-chip.test.ts`
  SUY RA mốc từ cỡ nút chứ không chép tay, nên quên là đỏ.
- **LÁ NGƯỜI KHÁC MỞ ≠ LÁ MÌNH MỞ.** Bàn 88 thẻ giữa ván có mấy chục lá ngửa,
  một vòng loé 520ms lẫn mất, và nhìn lại cũng không biết lá nào vừa mở (người
  chơi phản ánh). Nay `vuaMo` mang thêm `cuaToi`:
  · lá MÌNH mở — giữ một nhịp 520ms, chỉ là dấu xác nhận (ngón tay đã biết chỗ);
  · lá ĐỐI THỦ / MÁY mở — nở HAI nhịp trong 1,4s (một nhịp thì chớp mắt là lỡ)
  rồi ĐỂ LẠI viền vàng tới khi lá úp lại hoặc được ghép. Phần "để lại" mới là
  cái giải quyết "nhìn lại không biết lá nào" — hiệu ứng động chỉ nói lúc đang
  chạy. Chọn bằng bài kiểm tra nhận diện (bấm đúng lá, đo ms) chứ không cảm tính.
  Sự kiện `flip` KHÔNG mang `playerId` (payload cố ý gọn, NF-04) nên nhận ra lá
  mình bằng `pending` (online) và bằng người-đang-đi (offline đấu bot).
  **Viền nằm NGOÀI mép lá thì phải nâng z-index của CẢ LÁ** (5: trên wob-hover 4,
  dưới hai mốc 6/7 của Tráo đổi) — không thì lá bên phải, vẽ sau trong DOM, đè
  mất cạnh phải của viền. Đã bắt được đúng lỗi đó trên mockup.
- **Ô TRẮNG TRƠN GIỮA BÀN TO = LỚP GPU BỊ THẢ, KHÔNG PHẢI LỖI TRẠNG THÁI.**
  Người chơi báo: lá ĐÃ TỪNG NGỬA, lúc úp lại thành ô trắng; chỉ gặp ở bàn 88
  thẻ. Đã loại hai nhánh: engine không có đường nào sinh thẻ rỗng (`buildDeck`
  NÉM LỖI khi theme thiếu biểu tượng) và bấm dồn dập không tái hiện được
  (`test/the-trang.test.ts`). Còn lại: `will-change: transform` xin cho MỖI lá
  đang động một lớp ghép, bàn 88 thẻ thì một nước của người cộng một nước của
  bot là hàng chục lớp sống 2,2 giây; iOS thả backing store khi thiếu bộ nhớ và
  chỗ bị thả hiện ra TRẮNG. Cách chữa: bàn ≥56 thẻ KHÔNG xin lớp riêng nữa
  (`banLon` → class `ban-lon`; bản huỷ `will-change: auto` phải đứng SAU khối
  xin vì cùng độ đặc hiệu). Cú lắc ở bàn to thì GIỮ — đã có lần cắt rồi trả
  lại, đó là quyết định của chủ dự án.
  **ĐỪNG THÊM NỀN DỰ PHÒNG CHO `.card`.** Đã thử (một màu phẳng dưới hai mặt
  thẻ, để lớp hỏng ra lá sẫm màu thay vì lỗ trắng) và đã GỠ: nó đổi diện mạo mà
  không ai yêu cầu (lá thôi biến mất lúc quay qua 90°, và sắc tối lộ ở mép trên
  theme sáng), rồi đẻ thêm lỗi khi vá vội. Chữa đúng chỗ là lớp GPU, không phải
  che triệu chứng bằng một lớp sơn.
- **MẶT BOT BÁO ĐEN LÀ SVG, KHÔNG PHẢI EMOJI.** Avatar là chuỗi chạy xuyên
  engine/lưu trữ; báo đen mang KHOÁ `MAT_BAO_DEN` (`:bao-den:`) và `MatBot.vue`
  là cửa duy nhất dịch khoá ra hình. Màn có bot (PlayerStrip, MenuScreen,
  GameScreen) KHÔNG được in `{{ avatar }}` thẳng — `test/mat-bot.test.ts` canh;
  online không có bot nên OnlineGame in chữ trơn vẫn đúng. Thang 5 mức:
  🐣 gà mờ · 🐥 gà cứng · báo đen (SVG tự vẽ) · 🐯 mãnh hổ · rồng thần (`MAT_RONG_VANG`,
  Twemoji 🐉 đổi sang vàng — CC-BY 4.0. Ghi công BẮT BUỘC theo giấy phép: nay ở
  `public/credits.txt` và trong chế độ debug của RulesDialog — chủ dự án bỏ dòng ghi
  công khỏi màn thường 11.10.2026, đừng xoá nốt hai chỗ này).
- **THANH TRÊN LÀ STACKING CONTEXT RIÊNG (backdrop-filter) NÊN PHẢI CÓ `z-index`.**
  Menu thả xuống trong header từng bị `<main>` (đứng sau trong DOM) vẽ đè dù
  menu đặt `z-index: 15` — z-index của con không thoát được context của cha.
  `.topbar { position: relative; z-index: 15 }` (dưới hộp thoại 20). Đo bằng
  `pnpm do:menu` (Chrome CDP, `elementFromPoint` tại tâm từng mục, ba cỡ máy,
  cần `localhost:8080` đang chạy dist mới). Harness PHẢI profile sạch + bỏ qua
  service worker: PWA precache index.html nên dùng lại profile là đo bản cũ —
  đã dính, cho kết quả xanh/đỏ ngược nhau.
- **RUNG THEO SỐ NHỊP, KHÔNG THEO ĐỘ DÀI** (`lib/rung.ts`, chốt 10.10.2026):
  sai 1 chạm nhẹ · chuỗi 1 → 1 · 2–3 → 2 · 4–5 → 3 (cuối mạnh) · 6+ → 4, chốt
  ở 4. Taptic Engine iPhone chỉ có cú chạm rời, không có "rung dài". Web trên
  iPhone KHÔNG rung được (Safari không có `navigator.vibrate`) — chỉ bản app
  (`@capacitor/haptics`) và Android; máy không rung được thì công tắc trong menu
  TỰ ẨN. Chỉ rung theo nước CỦA MÌNH (đấu máy lọc `BOT_ID`, online lọc `myId` /
  `myTurn`). Gắn đúng hai chỗ phát `sfx.match`/`sfx.miss`, có `test/rung.test.ts`.
  Thêm plugin Capacitor là phải `cap sync ios` (đã có trong `build:ios`).
- **DANH HIỆU: 153 MỤC (15.10.2026), MỘT CỬA MỞ KHOÁ** (`lib/achievements.ts`, 11.10.2026).
  Mở khoá CHỈ qua `moKhoa()` (cập nhật viên 🏅 + hàng đợi khoe `MoKhoaToast`),
  đừng gọi thẳng `store.unlockAchievements`. Danh hiệu đếm đọc `ThongKe`
  (`store.boDem` + điểm + tiến độ Chiến dịch; `wins` lấy MAX với tài khoản) và
  xét CẢ KHI THUA. Mỗi cỡ bàn là một lần chinh phục riêng — thắng bàn to không mở
  bàn nhỏ. `chinhPhuc.cells` phải là cỡ CÓ THẬT trong `BOARD_SIZES` (không có bàn
  8 thẻ — từng lặng lẽ mở nhầm bàn 4 thẻ, test bắt). Danh hiệu theme chép tay
  `THEME_DH`, test canh khớp `themes.json`: thêm theme là thêm một dòng ở đây.
  Bảng kết quả có khối `@media (max-height: 640px)` ở CUỐI file: trên SE bảng
  từng cao 633px/553px, nút "Về menu" lòi khỏi màn hình (đã thế từ trước khi có
  danh hiệu, tiêu đề bị cắt). `pnpm do:menu` chơi thật một ván 2×2 và canh.
- **MÀN ĐANG RỜI GIỮ ĐÚNG KHUNG CŨ** (`ghimKhungRoi` ở App.vue, `@before-leave`).
  Bản cũ neo `.screen-leave-active { inset: 0 }` theo <main> có đệm 12px nên lúc
  mờ dần khung PHÌNH 406→430px (chủ dự án: "nhảy nhẹ, container to ra" khi bấm
  chip lối tắt). Đừng đặt lại inset: 0. `pnpm do:menu` đo từng khung hình.
- Thông báo trong ván nổi ở `.notice-bar` (cao 0px, đè HUD), không hiện giữa bàn
  và không chiếm chỗ của bàn thẻ.

- **ĐA NGÔN NGỮ (bắt đầu 12.10.2026): MỌI chữ người chơi thấy đi qua `t()`.**
  Bộ dịch tự viết `lib/i18n.ts`; từ điển `locales/vi.ts` (bản GỐC, giữ đúng từng
  chữ — test giao diện đọc tiếng Việt) và `locales/en.ts` (khai kiểu `TuDien`:
  thiếu khoá là typecheck đỏ). Khoá ghép động (`opt.${key}.${muc}`) đi `td()`.
  MẶC ĐỊNH TIẾNG VIỆT, KHÔNG đoán theo trình duyệt (người Việt hay cài máy tiếng
  Anh); đổi ở menu Cài đặt hoặc `?lang=en`, nhớ ở localStorage `mm.lang`.
  `test/i18n.test.ts` chống sót ba lớp: đúng bộ khoá + không rỗng + tham số `{n}`
  khớp; mọi khoá động có thật; và CHẶN CHỮ TIẾNG VIỆT VIẾT CỨNG trong các file đã
  chuyển (`DA_CHUYEN`) — thêm chữ mới phải thêm khoá vào CẢ HAI từ điển. Dòng cố ý
  giữ tiếng Việt ghi `i18n-bo-qua`. LỚP THỨ TƯ (`test/i18n-man-hinh.test.ts`) là
  lớp QUAN TRỌNG NHẤT: dựng từng màn ở cả hai ngôn ngữ, gom MỌI chữ hiển thị (text +
  aria-label + title + placeholder) và đỏ khi bản English còn dấu tiếng Việt HOẶC
  còn cụm GIỐNG HỆT bản tiếng Việt. Ba lớp kia chỉ nhìn mã nguồn nên đã để lọt
  "Khởi đầu" lên trang chủ English (chủ dự án báo, có ảnh): chữ đến từ DỮ LIỆU (tên
  danh hiệu, theme, máy, "Bạn") qua props; chữ không dấu như "Thua" lọt cả phép dò
  dấu. Màn dịch xong phải THÊM vào lớp này. Tên do app đặt dịch LÚC VẼ qua
  `lib/ten.ts` (`tenNguoi`, `tenBot`), dữ liệu ván giữ chữ gốc. Danh hiệu là getter
  (`dh()` trong achievements.ts) nên đổi ngôn ngữ là tên đổi theo. App iOS ĐOÁN
  ngôn ngữ theo máy (khác web) vì đó là lựa chọn thật của người dùng.
  15 NGÔN NGỮ (12 từ 12.10.2026, thêm it · tr · zh-TW 15.10.2026) — danh sách `NGON_NGU`
  ở lib/i18n.ts là NGUỒN DUY NHẤT; mã ngôn ngữ khác nhau giữa app / iOS / Android / App
  Store / Play / store-listing, và thêm một ngôn ngữ là đổi ĐỦ 14 CHỖ — làm theo
  **`docs/ngon-ngu.md`**, đừng làm theo trí nhớ. Số định dạng theo ngôn ngữ (`num`/
  `numShort` đọc `bcp()`; "tr" chỉ ở tiếng Việt, ngôn ngữ khác "M"). Lớp kiểm trên màn
  hình chạy cho MỌI ngôn ngữ và so cả với bản English; từ đồng nguyên hợp lệ khai TỪNG
  từ theo ngôn ngữ ở `DONG_NGUYEN`. Ngôn ngữ khác chỉ dò ký tự RIÊNG tiếng Việt (dò cả
  bộ dấu là bắt nhầm "Memória"). `pnpm do:ngon-ngu` đo chữ tràn nút trên iPhone SE cho
  cả 15 ngôn ngữ, đo KHUNG CHỮ ĐANG HIỆN (không scrollWidth) và bỏ qua `.sr-only`
  (tiêu đề chỉ cho trình đọc màn hình, khung 1px — từng báo "tràn" giả ở mọi màn).
  Tên app không vừa thanh trên thì chỉ giữ biểu tượng (`anTen` ở TopBar, đo thật).
  Trung phồn thể (zh-TW) nhận từ thẻ máy zh-Hant/TW/HK/MO, xét TRƯỚC khi cắt về "zh".
  Chưa có tiếng Ả Rập (phải-sang-trái, phải lật bố cục).
  BẢN DỊCH (13.10.2026, chủ dự án đòi "chuyên nghiệp"): bảng thuật ngữ + văn phong ở
  `docs/i18n-style.md` — bàn = "board" (KHÔNG "table"), "Vs Computer", danh hiệu =
  Achievements, tên máy không đuôi "bot"; English viết Title Case cho nút/tiêu đề,
  ngôn ngữ khác theo lệ của chính nó. Thêm chữ mới là theo bảng đó, rồi `pnpm do:ngon-ngu`
  (một chữ dài hơn ở menu — "Карамель" — đủ làm cả menu tiếng Nga lòi khỏi màn).
  TÊN APP: "Lật Thẻ" (vi) / "Flip Match" (en) — chủ dự án chốt 12.10.2026 vì tên có
  dấu khó với người nước ngoài. Khoá `tb.thuongHieu` + `chung.tieuDeTrang` (tiêu đề
  tab, đặt trong `lib/i18n.ts`); app iOS đọc tên từ `ios/App/App/{en,vi}.lproj/
  InfoPlist.strings` + `CFBundleLocalizations` — đổi tên là đổi CẢ hai chỗ. Tên PWA
  (vite.config) và thẻ og (index.html) là tệp tĩnh một ngôn ngữ, còn tiếng Việt. Đợt 1 xong: thanh trên, trang chủ + wizard,
  màn chơi, bảng kết quả, cảnh kết ván, danh hiệu, tài khoản, tên theme/máy. Đợt 2: online; đợt 3:
  Luật chơi, tên theme, nhãn engine (`optionSummary` đang dịch tạm theo mẫu ở
  MenuScreen), lỗi server (dịch theo MÃ lỗi ở client), thẻ og. Chuyển xong file nào
  thì thêm vào `DA_CHUYEN`.

## GOOGLE ANALYTICS 4 (15.10.2026, chủ dự án chốt: GA4, KHÔNG hộp hỏi cookie)

- Một mã `G-MZ4MDWZRH3` (tài khoản GA "Cozy Pi" → thuộc tính "Flip Match") cho game web,
  app (qua phần web — tới app bằng cập nhật nóng), 4 trang công khai và `cozypi.com`.
- Cửa DUY NHẤT trong game: `lib/phan-tich.ts` (`batPhanTich`, `suKien`). Cố định: tắt Google
  Signals + cá nhân hoá quảng cáo; múi giờ châu Âu → `analytics_storage: denied` (không
  cookie, thay cho hộp hỏi đồng ý); trong app dùng `store.clientId()` làm client_id.
  KHÔNG chạy khi test / dev / localhost / `navigator.webdriver` (công cụ đo, chụp ảnh store).
- KHÔNG gửi dữ liệu cá nhân (tên, email, mã tài khoản). Thêm sự kiện mới = sửa luôn mục
  Google Analytics trong trang quyền riêng tư nếu nó đo thứ chưa kể ở đó.
- Không còn được viết "không theo dõi / no tracking" ở bất cứ đâu (trang, store, studio).

## SKIN — LỚP ÁO TÁCH KHỎI BỐ CỤC (13.10.2026)

- Ba skin: **Kẹo** (mặc định, mockup B chủ dự án duyệt
  https://claude.ai/artifact/6NDRazvmMWRh5ErbZZmnLo) · **Gỗ** · **Neon** (giao diện cũ).
  Người chơi đổi ở menu → Giao diện; nhớ ở localStorage `mm.skin`; `?skin=go` thử nhanh.
  `lib/skin.ts` + `styles/skins/<id>.css` + tên `tb.skin.<id>` ở 12 từ điển;
  `test/skin.test.ts` canh đủ và canh MỌI selector trong file skin bắt đầu bằng
  `:root[data-skin='<id>']` (lọt ra là đổi giao diện của mọi skin).
- **TƯƠNG PHẢN CHỮ/NỀN LÀ LUẬT, CÓ MÁY ĐO** (14.10.2026, viên "Màn 2" chữ trắng trên
  nền trắng ở Neon + Đêm Sao, viên trắng mất hình trên ô trắng ở Kẹo Bông). Nền và chữ
  đi theo CẶP token (`--nhan-nen/chu`, `--chon-nen/chu`) — ĐỪNG ghép màu CỨNG với token
  (`background: #fff; color: var(--fg)`): token lật theo skin tối, màu cứng thì không.
  Ô gradient chữ trắng (`.g-*`) mọi điểm màu ≥ 3:1. Hai lớp canh: `test/tuong-phan.test.ts`
  (tĩnh: cặp token mọi skin, `.g-*`, chặn ghép cứng+token — đã kiểm ngược) và
  `pnpm do:tuong-phan [url]` (Chrome thật, 5 skin × sáng/tối, đo MỌI chữ đang hiện với
  nền trộn thật; < 2:1 là LỖI, dưới chuẩn WCAG là cảnh báo). Thêm skin / màu / màn mới là
  chạy cả hai, cộng `pnpm do:safari` (bóng/viền bị cắt trên iPhone). Máy đo không thấy nền ẢNH (scene) và chữ gradient — đếm "bỏ qua" riêng.
- Component KHÔNG viết màu/gradient tay: đọc token. Hai lớp tô chung `--nhan-nen/chu`
  (nút, viên nhấn) và `--chon-nen/chu` (ô đang chọn, người đang đi) — 25 chỗ viết tay
  gradient tím từng làm skin Kẹo lòi tím khắp nơi. Hình nền: `--nen-man` (body, neo
  cửa sổ) và `--canh` (vẽ theo khung #app — neo theo cửa sổ thì trên máy tính giữa
  cột trống trơn). Màn tạm dừng dùng `--canh, --nen-man`.
- Skin Kẹo/Gỗ KHOÁ màu mặt sau lá theo skin; hoạ tiết vẫn theo ván, cả bàn vẫn chung một mặt.
- Font: Đêm Sao + Kẹo Bông dùng CHUNG font Kẹo (Grandstander 900 + Be Vietnam Pro) — Playfair/
  Quicksand bị chê xấu, đã gỡ khỏi `fonts.ts` (15.10.2026). Mặt máy ở bước mức máy nằm thẳng
  trên ô (không đĩa trắng): chống chìm bằng THỨ TỰ MÀU ô ở `BOT_CHOICES`.
- Gờ dày của Kẹo (4–5px) cần `overflow-clip-margin: 8px` ở lưới wizard, không thì ô hàng cuối cụt gờ.
- `cqw` trên CHÍNH `.card` tính theo cả bàn (container cha), không theo lá — gờ từng ra 15,6px.
- Nền tối chỉ hiện ở menu khi skin là Neon.
- Lá đã ghép GIỮ RÕ NÉT (viền xanh trong) — phủ mờ/opacity đã bị chê hai lần.
- Trang chủ (bước `players`): quạt lá có trần 420px + cụm canh giữa dọc (máy tính
  cột cao). Icon bay lơ lửng (`IconBay.vue`) CHỈ ở màn menu, không có trong ván.
- HUD gọn: nút thoát · viên số có icon (chỉ hiện thứ đang có nghĩa) · nút ⏸ · vạch
  tiến độ cặp. TẠM DỪNG (`tamDungVan`/`chayTiepVan` ở engine, chỉ ván offline): dời
  MỌI mốc tuyệt đối khi chạy tiếp, không nhận nước đi, lưu trong snapshot; tự dừng
  khi rời trang (`visibilitychange`). Màn dừng phủ KÍN #app bằng nền đặc — lớp kính mờ
  để lộ bàn nhoè đã bị chê "thiếu chuyên nghiệp".

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
- **CHIẾN DỊCH = 12 CỠ × 5 MÀN = 60 MÀN, THANG RIÊNG** (chủ dự án 14.10.2026, thay
  thang 50 cấp chia lệch 1·1·3·…·9·9·3·1·1). Giờ = `gio` (thời gian THẬT cần, đo
  bằng mô phỏng, cột trong BOARDS) × 1,8·1,6·1,4·1,25·1,1 — KHÔNG theo số cặp × hằng
  số (bàn nhỏ thừa giờ, bàn to gắt). Mỗi chặng đúng ba cỡ (một cỡ = một hàng lưới 5 cột).
  SAO = số lần QUÊN (`quen`: lật sai khi lá cùng cặp đã lộ, cùng điều kiện mất mạng),
  KHÔNG đếm mọi lần sai (lật hai lá chưa mở là dò) và KHÔNG theo thời gian. Mốc [2★,3★]
  là bảng đo `sao` trong BOARDS. Ngôi sao THỨ 4 (`summary.hoanHao`, `hh` trong tiến
  độ) = thắng không quên lần nào, vẽ bằng lớp `.sao4` (cầu vồng) ở global.css. Mốc
  hiện TRƯỚC ván (dòng ở bước theme), TRONG ván (viên sao HUD) và SAU ván, viết bằng
  dấu "<" (chủ dự án chê "≤" và câu lủng củng). `campaignSpec`
  cho màn Chiến dịch; `levelSpec`/`boardForLevel` là thang KHOÁ CỠ BÀN 1..`LEVEL_KEYS`
  (50) ĐÓNG BĂNG — khoá kỷ lục `mode:L<cấp>`, `level` online, app cũ trong store đều
  dùng số đó. Đừng ghi màn Chiến dịch vào `prefs.level`; `store.unlockedLevel()` chỉ
  đọc Chiến dịch, `unlockedKey()` cho chế độ thường.
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

- **CHỖ TRỐNG CỦA BÀN THẺ — SỐ ĐO TỪ ẢNH VÁN THẬT, ĐỪNG ƯỚC LƯỢNG.**
  Khung bàn khi chơi ONLINE (đã trừ header, HUD, dải người chơi, khung chat,
  đệm, vùng an toàn): **351×308 (SE) · 366×419 (iPhone 14) · 406×500 (Pro Max)**
  — xem `AREAS` trong `apps/web/test/board-fit.test.ts`. Chơi MỘT MÌNH thì cộng
  thêm 44px (không có khung chat). Bộ số cũ (510/618/700) cao hơn thực tế tới
  200px, nên mọi phép canh "lấp đủ bề rộng" từng luôn xanh trong khi bàn thật
  hụt — nó đo một cái máy không tồn tại. Suy ra từ ảnh chụp: bàn 88 thẻ trên
  Pro Max đo được 362×495 CSS px, khớp đúng `availH ≈ 500`.
- **BÀN BỊ CHẶN BỞI CHIỀU CAO, NÊN MẤT CHIỀU CAO LÀ MẤT BỀ RỘNG.** Mỗi px lấy
  của bàn (dải người chơi cao thêm, nút emoji cao thêm) biến thành hai dải
  trống hai bên — người chơi nhìn ra ngay: "có khung chat thì hở hai bên, chơi
  một mình thì không". Vì thế lá bài được nở NGANG QUÁ HÌNH VUÔNG: trần tỉ lệ
  `MAX_ASPECT` = 1,25 cho MỌI cỡ bàn (06.10.2026 — trước đó bàn <42 thẻ giữ
  trần vuông, và chủ dự án gửi ảnh bàn 24 thẻ đấu máy trên Pro Max hở 25px mỗi
  bên: 2×3 / 3×4 / 4×6 đều kẹt ở trần vuông, chỉ lấp 80–90%). Lá 4×6 nay 97×85,
  dáng 5:4 vẫn là lá bài. Nới trần còn CỨU NGƯỠNG CHẠM (42 thẻ trên SE:
  38,8px → 48,6px).
- **CHIP NGƯỜI CHƠI CAO CỐ ĐỊNH 44px** (`.player` ở PlayerStrip, `.pchip` ở
  OnlineGame). Chip đang đi (viên điểm 19px) cao 46px còn chip chờ 40px; lúc
  chuyển lượt chip mới còn hẹp trong 220ms transition nên container query hạ
  viên điểm → dải 48,5→45,5px → ResizeObserver đo lại → bàn 356→358→356px, đúng
  "bàn đổi kích thước xíu khi chuyển lượt" người chơi báo (đo trên Pro Max, bàn
  3 người). Khoá chiều cao thì nội dung chip ra sao cũng không chạm tới bàn.
  `test/chip-cao-co-dinh.test.ts` canh.

## LÀM VIỆC NHANH — đọc trước (rút từ 14.10.2026)

- **Chủ dự án thử trên APP (TestFlight / Play internal), không phải Safari.** Deploy web
  KHÔNG tới tay họ: sửa giao diện họ báo từ điện thoại xong là phải ra bản app
  (skill `phat-hanh-app`). Báo "xong" thì nói rõ web có rồi, app có từ build số mấy.
- **Ra bản app = một lệnh**: `gh workflow run mobile.yml --ref main -f phat_hanh=true`
  (cùng phiên bản, chỉ thêm build). Build phát hành có nhóm concurrency riêng nên đẩy
  `main` không huỷ nó nữa. Soát log iOS: `Upload succeeded` + dòng `Z Authority=Apple
  Distribution` (grep trần dính cả dòng lệnh trong script). Android tự lên Play
  internal ở trạng thái `completed` (biến repo `PLAY_RELEASE_STATUS`).
- **Có phiên Claude KHÁC làm chung thư mục repo** (thường thấy file `tools/`, `docs/`
  chưa commit không phải của mình). Commit đúng file của mình (`git add <đường dẫn>`,
  KHÔNG `-A`); release Cloudflare từ **worktree sạch** ở `origin/main`
  (`git worktree add <scratchpad>/wt origin/main` → merge `origin/develop` → push →
  `pnpm install --frozen-lockfile` → `pnpm release`) — `pnpm release` dựng từ thư mục
  đang đứng, đứng ở thư mục chung là đẩy luôn code dở của người kia lên.
- **Cổng 8080 / 8787 / 8091 thường đã có server CŨ chạy** (của phiên khác) → smoke đỏ
  oan. Server của mình chạy cổng lạ: `PORT=18438 node dist/server.mjs`,
  `npx wrangler dev --port 8797`; kiểm `lsof -iTCP:<cổng> -sTCP:LISTEN` trước.
- **Máy hay quá tải (load 30–60) → test dài hết giờ** (`flows` "Đua thời gian" sát
  ngưỡng 15s, `the-trang` 30s). Đừng nới timeout; chạy lại riêng file đó, và lấy CI
  GitHub (workflow docker.yml chạy `pnpm test` trên máy sạch) làm trọng tài. ĐỪNG nối
  `pnpm test ... ; echo` rồi `&& git commit` — echo nuốt mã lỗi, test đỏ vẫn commit.
- **SỬA GIAO DIỆN XONG LÀ CHẠY `pnpm do:safari`** (15.10.2026): WebKit của Playwright (engine
  Safari/iPhone), 3 khổ vùng web × 5 skin × 9 màn, dò viền/bóng bị khung cắt, nút lòi khỏi màn,
  trang cuộn; ảnh ở `/tmp/mm-safari`. Mọi công cụ khác chạy Chrome — mà Chrome có thứ Safari
  KHÔNG có (`overflow-clip-margin`), nên lỗi "cạnh nút bị cắt" ở Đêm Sao/Kẹo Bông/Gỗ đo Chrome
  xanh, iPhone hỏng. Lần đầu: `pnpm exec playwright install webkit`. Nó cũng bắt được nút
  "Bắt đầu" LÒI khỏi màn ở bước Bàn chơi trên iPhone SE (lỗi ở MỌI trình duyệt, chưa ai đo).
  Lưới cắt (`overflow: clip/hidden`) chứa ô có bóng/viền vẽ NGOÀI mép thì phải chừa ĐỆM thật
  (cả ngang lẫn dọc, margin âm bù lại) — đừng trông vào `overflow-clip-margin`.
- **Lỗi hình chỉ có trên iPhone** (tách lớp GPU): Chrome/WebKit headless trên Mac KHÔNG
  tái hiện được. Xin chủ dự án quay màn hình → `swift tools/video/tach-khung.swift` +
  `ghep-bang.swift` → soi từng khung. Đóng băng animation để soi thứ tự hiện:
  `document.getAnimations()` → `pause()` + `currentTime` (bỏ animation vô hạn của
  IconBay trước khi `finish()`). Playwright đã là devDependency ở gốc repo (cho `do:safari`).
- **Luật ghép lớp iOS đã chốt**: `section.panel { will-change: opacity }` (panel wizard
  là MỘT lớp — ô chồng vùng icon bay bị tách lớp riêng và nán lại đè bước mới);
  bước/màn đang rời tắt mọi chuyển động con (`.step-leave-active *`,
  `.screen-leave-active *`); phần đầu wizard đổi theo `buocHien` (sau `@after-leave`),
  không theo `step`. ĐỪNG dùng `will-change: transform` cho panel: nó nhốt
  `position: fixed` (hộp xem trước theme) vào trong panel.
- **Plugin native tự viết**: Android đăng ký `registerPlugin(X.class)` TRƯỚC
  `super.onCreate` trong MainActivity; iOS đặt class trong `SceneDelegate.swift`
  (`GameViewController.capacitorDidLoad` → `registerPluginInstance`) để khỏi sửa tay
  `project.pbxproj`. Thêm plugin npm Capacitor là phải `npx cap sync` và commit 3 file
  `capacitor.build.gradle`, `capacitor.settings.gradle`, `CapApp-SPM/Package.swift`.
  Không build native được ở máy này — đẩy `develop` để CI biên dịch thử TRƯỚC khi phát hành.
- **NHẠC NỀN: 5 BÀI, MỖI BÀI MỘT NHỊP ĐIỆU** (15.10.2026, `lib/nhac.ts`): 🎹 Vui · 🌙 Đêm ·
  🐋 Biển sâu miễn phí; 🌿 Vườn · 🎐 Hộp nhạc premium (ẩn theo `banPremium` như skin). Bài
  là DỮ LIỆU (`BAI`) chạy chung một máy; khác nhau ở nhịp điệu + kết cấu (swing, quạt chả,
  3/4, pad) chứ không chỉ ở tiếng — cùng khuôn là bị chê "na ná". Menu và LÚC VÀO VÁN nghe
  Y HỆT nhau (liền mạch), trong ván chỉ nhịp dồn 62→86 theo `gap`. Âm lượng 0,15. Mã `keo`
  giữ dù tên hiện là "Vui" (bản lưu đọc mã). Dòng chọn trong menu là HAI TẦNG — một hàng
  làm menu lòi khỏi SE. Nghe thử: https://claude.ai/artifact/249CoQUxBMFFA3eeYLpVJp
- **LINK MỜI MỞ THẲNG APP** (15.10.2026, `lib/link-moi.ts`): Universal Links iOS + App Links
  Android cho 3 host (cozypi + 2 hello314), chỉ đường `/` có `?room=`. Xác minh ở
  `public/.well-known/` (AASA: Team ID + bundle iOS; assetlinks: package Android + SHA-256 khoá
  ký Play — đổi/thêm khoá ký là thêm dấu vân tay). Link tới app qua `getLaunchUrl`/`appUrlOpen`
  rồi NẠP LẠI ở `?room=CODE` (một lối vào phòng như web). Thêm capability iOS là chạy
  `gh workflow run ios-profile.yml -f caps=…` rồi nạp lại `IOS_PROFILE_BASE64` (profile cũ
  thành INVALID). Zalo/Messenger mở link bằng trình duyệt riêng — không vào app được.
- **Nút Back Android cần `@capacitor/app`** (`lib/nut-back.ts`): thiếu plugin là Back
  thoát thẳng app kể cả giữa wizard. Ngôn ngữ app đồng bộ hai chiều với Cài đặt máy
  (`lib/ngon-ngu-app.ts`, plugin `NgonNguApp`, khoá `mm.langMay`, Android `localeConfig`).
- **CẬP NHẬT NÓNG (OTA, từ bản app 1.3.0)**: sửa phần WEB xong + deploy là app tự
  nhận ở lần MỞ LẠI kế tiếp, KHÔNG qua duyệt store (`@capgo/capacitor-updater` chế độ
  thủ công, `lib/ota.ts`). `pnpm --filter @mm/web build` tự chạy `tools/dong-goi-ota.mjs`
  → `dist/ota/manifest.json` + zip (bản dựng kiểu APP, VITE_SERVER_URL công khai), nên
  Docker và `pnpm release` đều mang theo. **Đổi phần NATIVE** (plugin, Swift/Java,
  Info.plist, quyền) thì vẫn phải ra bản store VÀ nâng `minNative` trong
  `apps/web/ota.json` = phiên bản app mới — quên nâng là app cũ tải gói gọi plugin nó
  không có. `statsUrl: ''` là BẮT BUỘC (mặc định plugin gửi crash/lỗi JS về Capgo →
  phải khai App Privacy). Gói hỏng (không `notifyAppReady` trong 10 giây) tự quay về gói
  trước. Luật chơi hiện cả gói web (v + giờ build) lẫn bản app store (`lc.banApp`).
- **Mockup cho chủ dự án**: ưu tiên ẢNH CHỤP THẬT (chế độ debug → "Xem thử hiệu ứng",
  hoặc sửa DOM ngay trên trang thật để ra bản đề xuất) ghép vào một artifact, thay vì
  vẽ lại bằng tay. Họ duyệt mockup trước khi làm tính năng giao diện mới.

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
- **THOÁT APP ≠ RỜI PHÒNG** (15.10.2026, chủ dự án báo "tạo bàn, thoát app ra thì bàn
  bị mất" + "phòng nháy khi vào lại"). Bốn luật, có `pnpm smoke:thoat-app` (cả hai server,
  trong CI) và `pnpm do:thoat-app` (WebKit, ghi từng khung hình) canh — đã kiểm ngược:
  · phòng chờ VẮNG HẲN (không ai còn sống, `conNguoiSong`) thì KHÔNG gỡ ai: chủ phòng giữ
  danh tính + quyền, phòng ở lại danh sách, dọn sau `EMPTY_LOBBY_MS` 15 PHÚT. Hạn giữ chỗ
  30 giây (`LOBBY_HOLD_MS`, để người bỏ đi không làm KẸT người đang chờ) chỉ đếm từ lúc
  có người tới (`datLaiHanGiuCho`). `HAN_BAN_GHI_MS` của sổ phải DÀI hơn (25 phút) và
  phòng sống tự khai lại mỗi 5 phút (nhịp trong `chuKySo`).
  · chủ phòng BẤM THOÁT ở phòng chờ = ĐÓNG PHÒNG (`cancel`), kể cả khi một mình.
  · NỐI LẠI LÀ VIỆC NGẦM: `connect()` không đổi phase khi đang ở phòng (bản cũ về
  'connecting' → màn nhập mã nháy lên); mở app = một đợt nối lại mới (bỏ hạn/banner cũ
  của lúc nằm nền), socket OPEN mà nằm nền >3s thì `resync` + 1,5s không tin là nối lại.
  · app bị hệ điều hành tắt (mất `?room=`): App.vue vào thẳng phòng nhờ `maPhongDangDo()`,
  phòng chờ VẼ NGAY từ ảnh lưu trong phiên (`phong`/`id`). Phòng đã chết → `kiemPhongCon`
  (GET /api/rooms/:code) đưa về danh sách kèm "Phòng … đã đóng", không quay vòng 5 phút.
  Online tạm giới hạn 4 NGƯỜI (`ROOM_LIMITS.maxPlayers`, chủ dự án 15.10.2026); phòng đầy
  rời danh sách; khán giả gặp phòng chờ còn chỗ thì tự vào làm người chơi.
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
- **CHƠI LẠI ĐỦ PHIẾU LÀ VÀO VÁN LUÔN; NGƯỜI ĐI ĐẦU XOAY VÒNG** (11.10.2026, chủ
  dự án báo). `t:'again'` đủ phiếu thì gọi `batDauDemNguoc()` — CÙNG hàm với nút
  Bắt đầu — chứ không về phòng chờ bắt bấm Sẵn sàng lại (bản cũ: hai người cùng
  bấm mà "không có hiện tượng gì"). Client ghi lại phiên ở tin `countdown` vì
  kết ván đã xoá nó. Người đi đầu: `xoayNguoiDau()` ở ENGINE, dùng chung cho
  room.ts và App (nhiều người cùng máy, đấu máy); chỗ gọi tắt `shufflePlayers`
  — chính cái xáo đó làm lượt đầu ngẫu nhiên mỗi ván. Ván đầu bốc ngẫu nhiên
  (online: crypto; offline: theo seed cho tất định). `nguoiDauTruoc` KHÔNG lưu
  xuống MySQL: server khởi động lại thì ván kế bốc lại, chấp nhận được.
  `tools/smoke-choilai.mjs` chơi thật 3 ván 2×2 bằng `predeal` (đã kiểm ngược:
  luật cũ là đỏ).
- **NÓI NHANH (`t:'say'`, 14.10.2026): chat CHỈ bằng 12 câu có sẵn** (`QUICK_SAYS` ở
  engine, emoji ở `lib/noi-nhanh.ts`, chữ ở `say.<mã>` 12 từ điển). KHÔNG làm ô gõ tự
  do: App Store 1.2 / Google Play bắt lọc từ xấu + báo cáo + chặn người chơi. Trên dây
  chỉ đi MÃ câu, mỗi máy tự dịch. Server bỏ mã lạ và tính CHUNG hạn mức với emoji.
  Nút 💬 là con ĐẦU của thanh emoji (luật ẩn bớt không chạm tới); bong bóng ở
  `LoiNoi.vue` (teleport, neo `data-chip-for` như EmojiBlast). Smoke:
  `tools/smoke-noi-nhanh.mjs`.
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
- **TÀI KHOẢN (ĐĂNG NHẬP GOOGLE) CHỈ CÓ Ở SERVER NODE, LÀ LỚP PHỦ.**
  `apps/node-server/src/taikhoan.ts` + `apps/web/src/lib/taikhoan.ts` +
  `TaiKhoanDialog.vue`. Bật khi có CẢ `MYSQL_URL` và `GOOGLE_CLIENT_ID`; thiếu
  một là `/api/auth/config` 404 và client GIẤU nút đăng nhập — bản Cloudflare
  `thebai2` không bao giờ có. Không đăng nhập thì mọi thứ y như cũ: thành tích
  vẫn ghi localStorage; có đăng nhập thì mỗi ván gửi THÊM một bản lên
  (`ghiVan`, gọi ĐÚNG MỘT LẦN từ watcher kết ván — tổng điểm và số ván cộng dồn
  ở server), và lúc đăng nhập đẩy bản cục bộ lên (`dongbo`: hợp theo MAX, gọi
  lại không nhân đôi). Kết cục đọc `loaiKetCuc` (hoà là kết cục thứ ba); nhiều
  người CHUNG MÁY thì KHÔNG lên sổ — không biết ai đang cầm máy. Khoá kỷ lục
  là ĐÚNG khoá của `store.best()` (`mode:L<cấp>`), server lọc theo mẫu đó.
  Google chỉ được hỏi lúc đăng nhập (`tokeninfo`), rồi server cấp phiên HMAC
  30 ngày ở `localStorage` `mm.auth`; khoá ký suy từ `MYSQL_URL` nếu không đặt
  `AUTH_SECRET` nên phiên sống qua lần thay pod. Không chống gian lận (cùng lý
  do PREDEAL), chỉ kiểm biên. `tools/smoke-taikhoan.mjs` chạy thẳng SQL qua
  server thật (cần `MYSQL_URL`, tự tạo và dọn user) — đã bắt được một lần
  `dist/server.mjs` gói trước khi sửa: ĐỔI server Node là phải `node build.mjs`
  lại trước khi smoke. Client ID tạo ở Google Cloud Console (OAuth client Web,
  origin = `https://flipmatch.cozypi.com` + `https://flipmatch.hello314.com` + `https://thebai.hello314.com`), đặt vào Secret `thebai-google`. ĐÃ BẬT
  08.10.2026 (project `lat-the-nkien`, tài khoản Google cá nhân). Đổi env trong
  `thebai.yaml` là phải `kubectl apply` tay — Keel chỉ thay ảnh.
  **APPLE + XOÁ TÀI KHOẢN (12.10.2026, để lên App Store):** luật 4.8 bắt có Sign
  in with Apple khi có Google, 5.1.1(v) bắt xoá tài khoản NGAY TRONG app
  (`DELETE /api/me`, kỷ lục/danh hiệu đi theo CASCADE, bản lưu trên máy giữ
  nguyên). Server tự kiểm chữ ký RS256 bằng JWKS của Apple (`xacMinhApple`), bật
  bằng `APPLE_BUNDLE_ID` (app iOS) và/hoặc `APPLE_SERVICES_ID` (web); có thêm
  `APPLE_TEAM_ID`+`APPLE_KEY_ID`+`APPLE_PRIVATE_KEY` (.p8) thì lúc xoá còn THU HỒI
  token ở Apple như luật đòi. `users.google_sub` nay NULL được, thêm `apple_sub`
  — nâng bảng cũ lúc khởi động qua `information_schema`. NÚT THEO NỀN
  (`coGoogle`/`coApple`): Google Identity Services là thư viện WEB, Google chặn
  nó trong WebView nên app gói KHÔNG vẽ nút Google (bấm là lỗi = App Review loại);
  Apple trong app iOS là hộp thoại native (`@capgo/capacitor-social-login`, nạp
  trễ), trên web là Apple JS. Android chưa có cả hai — muốn có phải làm Google
  native (OAuth client Android ở Google Cloud). Tên Apple chỉ tới ở LẦN ĐẦU, từ
  client; lần sau không được ghi đè bằng rỗng.
- **MYSQL KHÔNG CHO CHẠY NHIỀU POD.** Nó chỉ giải quyết "sống sót qua deploy".
  WebSocket dính vào một pod, engine chạy trong RAM pod đó, alarm cũng ở đó, và
  broadcast không đi qua database — hai pod là hai bản sao cùng một phòng ghi đè
  nhau, hai người cùng mã phòng không thấy nhau. `replicas` vẫn PHẢI là 1 và
  `strategy: Recreate`. Muốn scale thì thứ phải làm trước là ĐỊNH TUYẾN DÍNH
  theo mã phòng (mọi kết nối của một mã luôn về đúng một pod), không phải thêm
  kho dữ liệu.
- **Cụm k8s cá nhân `kien-server-main`** (`deploy/k8s/`; ĐỪNG gọi "Hà Nội" — nhầm với
  `k8s-hanoi` của SenPrints): server Node là bản CHÍNH, chạy trên MicroK8s tại `flipmatch.cozypi.com` (TÊN CHÍNH), `flipmatch.hello314.com` (server của bản app build ≤32), `thebai.hello314.com` (tên chính cũ — vẫn phục vụ nguyên vẹn, KHÔNG redirect: localStorage theo origin, và app phát hành trước 13.10 gọi server qua nó) và `thebai-server.hello314.com`,
  namespace `thebai`. Cloudflare Worker lùi về `thebai2.hello314.com` làm dự phòng
  (đổi chỗ ngày 29.08.2026 — tên miền của Worker là *Custom Domain* ở tầng account,
  không nằm trong `wrangler.jsonc`; chi tiết ở sổ tay `my-secrets`). Push vào `main` → Action đẩy
  ảnh lên GHCR → **Keel** hỏi registry mỗi 2 phút rồi tự thay ảnh; KHÔNG có kubeconfig
  nào trong GitHub Secret. **`replicas` phải giữ nguyên 1 và `strategy: Recreate`** —
  phòng online nằm trong bộ nhớ tiến trình, hai pod là hai kho phòng riêng, người nhập
  mã vào pod kia sẽ nhận "không có phòng". Chi tiết ở `deploy/k8s/thebai.yaml`; sổ tay
  hạ tầng nằm ở repo `my-secrets` (`docs/services/thebai-server.md`) và phải cập nhật
  cùng lúc khi đổi gì ở đây.
- **XONG VIỆC LÀ DEPLOY CẢ HAI NƠI, KHÔNG HỎI LẠI** (chủ dự án chốt 14.09.2026).
  Một "lần giao hàng" đầy đủ gồm ĐỦ BỐN BƯỚC, thiếu bước nào là người chơi vẫn
  thấy bản cũ ở một trong hai tên miền:
  1. `pnpm typecheck` + `pnpm test` + `pnpm build` xanh;
  2. commit trên `develop` → merge `--no-ff` sang `main` → `git push origin main develop`
     (đẩy `main` là Action tự đóng ảnh, Keel thay pod Node ở Hà Nội sau vài phút);
  3. `pnpm release` NGAY SAU ĐÓ cho bản Cloudflare dự phòng — Action KHÔNG đụng
     tới Cloudflare, nên bỏ bước này là `thebai2` đứng lại ở bản cũ vô thời hạn;
  4. kiểm cả hai tên miền bằng NỘI DUNG, không bằng hash.
- **KIỂM DEPLOY BẰNG NỘI DUNG, ĐỪNG SO HASH FILE.** Hash của Vite phụ thuộc môi
  trường build, nên hash CI KHÔNG BAO GIỜ trùng hash build ở máy — so hash là
  thấy "khác" rồi kết luận nhầm "server còn cũ". Đã mất một buổi vì chuyện này:
  chờ deploy, restart k8s tay, nghi oan Keel, trong khi bản mới đã chạy từ đầu.
  Cách đúng là tìm một mẩu NỘI DUNG chỉ có ở bản mới:
  ```bash
  CSS=$(curl -s "https://flipmatch.cozypi.com/?cb=$RANDOM" | grep -o '/assets/index-[^"]*\.css' | head -1)
  curl -s "https://flipmatch.cozypi.com$CSS" | grep -c 'flex: 0 0 40px'   # 1 = đã lên
  ```
  Soi thẳng trong pod khi cần: `node bin/secrets.mjs run k8s -- kubectl -n thebai exec deploy/thebai-server -- grep -l ... /app/web/assets/*`
- **STUDIO "COZY PI", TÊN CHÍNH LÀ `flipmatch.cozypi.com` (13.10.2026)** — `cozypi.com` dùng
  chung cho mọi app của studio (wildcard `*.cozypi.com` → tunnel; app mới chỉ thêm host
  vào ingress), email `support@cozypi.com`. `flipmatch.hello314.com` và
  `thebai.hello314.com` GIỮ NGUYÊN,
  KHÔNG REDIRECT**: localStorage (điểm, kỷ lục của người chưa đăng nhập) gắn theo
  origin — chuyển hướng là họ thấy mất sạch; và app phát hành trước 13.10 gọi server
  qua `thebai`. Trang store cần: `/privacy.html`, `/support.html` (file tĩnh ở
  `public/`, nằm trong `navigateFallbackDenylist` của SW). Đổi dữ liệu thu thập
  (bảng `users`, thứ gửi lên server) là phải sửa `privacy.html` + bảng App Privacy
  ở `docs/store-listing.md`. Ra bản app: skill `phat-hanh-app`.
- **APP ANDROID + iOS BUILD Ở GITHUB ACTIONS, KHÔNG Ở MÁY** (`.github/workflows/mobile.yml`,
  secret và bẫy ở `docs/mobile-ci.md`). Mã định danh app KHÁC
  NHAU giữa hai nền: iOS `com.hello314.flipmatch` (đã đăng ký với Apple trước khi có
  tên studio — cũng là `APPLE_BUNDLE_ID` của server), Android `com.cozypi.flipmatch`
  (đổi 13.10.2026 lúc chưa tạo app trên Play, vì nó HIỆN trong link Google Play).
  Lên store rồi là KHÔNG đổi được, đổi là thành một app khác. Thiếu secret thì bước đó tự bỏ qua chứ không
  đỏ — điền secret là lên mức, không sửa workflow. Phát hành = tag `app-v*`. App gói
  web vào trong nên `location.origin` là `capacitor://localhost` (iOS) hoặc
  `https://localhost` (Android): nhận ra app bằng `laApp` ở `lib/native.ts` (đọc
  `window.Capacitor`), ĐỪNG chỉ xét giao thức — Android là `https:` y trình duyệt.
  Bản trong app có thể CŨ HƠN SERVER HÀNG THÁNG (không phải vài phút như PWA), nên
  luật "đổi dạng trên dây thì client khai" càng phải giữ.
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
  là máy rộng xếp thêm cột; hàng CỐ ĐỊNH `--o-cao` = `clamp(66px, --app-h*0.105, 96px)`
  + `align-content: start`, hết chỗ thì cuộn. Từng là `minmax(--o-cao, 1fr)` (giãn
  lấp chỗ) nhưng từ khi chia tab Miễn phí/Premium, tab 12 theme giãn ô cao ~270px
  còn tab 36 theme ở cỡ chuẩn — hai tab không đồng nhất (chủ dự án báo 14.10.2026). Chiều cao do
  LƯỚI quyết định vẫn là xác định nên `container-type: size` giải được; chỉ
  `height: auto` mới làm truy vấn nhận 0.
- **`#app` LẤY CHIỀU CAO TỪ `--app-h` (JS đo), `100dvh` chỉ là dự phòng.**
  `useViewportLock.ts` đo `innerHeight` và kéo document về 0 ở mọi lối trang hiện
  lại, kèm `history.scrollRestoration = 'manual'`. Không có nó thì mở lại Chrome
  trên iPhone là header nằm ngoài màn hình và dưới footer có một khoảng trắng —
  trình duyệt dựng lại trang trước khi chốt chiều cao thanh công cụ (dvh ra số
  cũ) VÀ khôi phục luôn vị trí cuộn, mà `html, body { overflow: hidden }` khoá
  mất đường kéo về. Đừng lấy `visualViewport.height`: nó co khi bàn phím mở.
- **LỚP HIỆU ỨNG NẰM TRONG CỘT GAME, KHÔNG PHẢI CẢ CỬA SỔ.** `.ketcuc-fx` và
  `.mk-fx` là `absolute; inset: 0` trong `#app` (`position: relative`), KHÔNG
  `fixed` — trên máy tính cột hẹp giữa cửa sổ, fixed là băng rôn/tia vàng/pháo
  giấy tràn khắp trình duyệt (chủ dự án báo, có ảnh). Canvas hạt đo CHÍNH NÓ
  (`BoHat.w/h`), đừng dùng `innerWidth`; toạ độ từ `getBoundingClientRect` phải
  qua `BoHat.diem()`. MoKhoaFx không Teleport ra body nữa. Đo: `pnpm do:fx`.
- Gợi ý "Chinh phục" (`goiY`) KHÔNG đưa danh hiệu chuỗi ngày — chơi thêm ván
  hôm nay không nhích được, mà nó từng chiếm chỗ vì đạt 2/3 ("3 ngày liền").
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
- **MẶT BÀI VẼ BẰNG NOTO 3D TRÊN MỌI MÁY, KỂ CẢ APPLE** (15.10.2026; ban đầu chỉ máy không-Apple,
  cùng ngày chủ dự án cho Apple theo — ảnh CẢ HAI store đã chụp lại; chủ dự án so 5 bộ — artifact
  https://claude.ai/artifact/M5iMtdV57gUizNRgK7ppj1 — chọn bộ 3D mới của Google): WebP 512px ở
  `public/emoji/3d/`, tải bằng `node tools/tai-noto3d.mjs` (cần `cwebp`). GIỮ 512: quạt lá trang
  chủ / bàn 4 thẻ cần ~390px, 256 là mờ. BA CỠ 128 · 256 · 512 (`3d/128/`, `3d/256/`, `3d/`): BoardGrid
  đo MỘT lá → `chonCoAnh` (cỡ CSS × DPR) — ảnh giải nén ăn RAM theo điểm ảnh, bàn 88 thẻ toàn 512 là
  ~44MB (đúng thứ làm iOS thả lớp GPU). KHÔNG CÒN BỘ DỰ PHÒNG: Twemoji + Noto 2D đã gỡ
  (chủ dự án 15.10.2026: "chỉ còn mặc định của máy hoặc Noto 3D") — emoji Noto 3D chưa có là
  `tai-noto3d` thoát lỗi + test `emoji-vector` đỏ → chọn emoji khác. Chế độ debug → Luật chơi →
  "Bộ hình emoji" đổi Máy ⇄ Noto 3D (`mm.boEmoji`, chỉ máy đó; TẮT debug là về mặc định —
  `boEmojiVeMacDinh`). Thêm/sửa theme = `node tools/tai-noto3d.mjs`; chỉ emoji Unicode ≤14;
  số theme MỖI TAB chia hết cho 12. TẢI TRƯỚC lúc chia bài (`taiTruocAnh` trong BoardGrid,
  web lần đầu lật từng ra ô trắng): offline lấy symbol của thẻ, online lấy `hinhCuaBan` —
  CỬA THỨ HAI của predeal, chỉ TẬP hình Set+sort, KHÔNG vị trí (test/predeal canh). Cỡ ĐOÁN
  trước khi đo = bề ngang ÷ số cột (đoán sai là mỗi hình tải hai lần — đã đo). Mục dưới là lịch sử:
- **(14.10.2026) MẶT BÀI MÁY KHÔNG-APPLE VẼ BẰNG SVG TWEMOJI** (`lib/emoji.ts`, `public/emoji/<mã>.svg`,
  phương án B chủ dự án chốt 14.10.2026): emoji Android là bitmap ~136px → mờ trên
  mặt bài; Windows không có emoji cờ. iPhone/iPad/Mac GIỮ emoji Apple. Chỉ đổi cách
  VẼ — ký hiệu trên dây vẫn là chuỗi emoji nên Android chơi chung với iPhone như cũ.
  (Đã thay bằng Noto 3D và GỠ hẳn 15.10.2026 — chỉ mặt rồng thần còn là Twemoji.) Số theme
  MỖI TAB (miễn phí / premium) phải chia hết cho 3 VÀ 4 (lưới theme 3 hoặc 4 cột).
  Ghi công ở `lc.ghiCong`.
- **THEME PREMIUM (14.10.2026): MỘT gói mở hết, theme KHÔNG còn mở bằng điểm.**
  Cờ `premium` trong themes.json (+ `THEME_PREMIUM` ở server, test canh khớp); hiện
  48 miễn phí + 24 premium (thêm 12 + 12 ngày 15.10.2026). Hỏi quyền CHỈ qua `choiDuoc()` ở `lib/premium.ts` — đợt
  này CHƯA BÁN THẬT (nút mua báo "sắp có", `mm.premium='1'` để thử giao diện đã mua);
  làm IAP thì chỉ thay chỗ đặt `daMuaPremium`. Bước theme là `ThemePicker.vue` dùng
  chung cho MenuScreen + OnlineScreen: hai tab, ô premium chưa mua KHÔNG mờ/disabled
  mà chạm là mở hộp xem trước đủ bộ hình (vẽ qua `anhEmoji` như mặt bài). Online:
  chỉ chủ phòng cần sở hữu, người vào phòng chơi được; phòng tạo nhanh (`themeIds`
  rỗng) chỉ trộn theme miễn phí. Bản lưu chọn theme premium chưa mua bị lọc lúc nạp.
- **APP LÀ 4+ / MỌI LỨA TUỔI (chủ dự án 14.10.2026: "để các em bé có thể dùng").**
  Bộ hình KHÔNG có emoji vũ khí/chất nổ (🔪🗡️⚔️🏹🪓🧨🪤 đã thay) — App Store tính 4+
  chỉ khi câu "Guns or Other Weapons" = None (có vũ khí "Infrequent" là lên 9+). Đã khai:
  Messaging and Chat = Yes (12 câu nói nhanh), Contests = Infrequent. Thêm emoji vũ khí,
  rượu, thuốc lá… là phải làm lại Age Rating (Apple) + IARC (Google). Bộ Premium halloween/
  myth còn đầu lâu/zombie: bật `banPremium` là xét lại câu Horror/Fear ở cả hai store.
- **iPAD TRỌN MÀN HÌNH** (global.css, chủ dự án duyệt mockup 14.10.2026
  https://claude.ai/artifact/EJ13pwkGD115NwLWYxiUod): máy cảm ứng ≥700px (`hover: none`
  + `pointer: coarse`) KHÔNG thu về cột như máy tính — cột 600px giữa iPad 13" là thứ App
  Review chê. Bàn thẻ tự lấp màn; thanh trên, menu/wizard (khung 600px đã phóng), phòng
  chờ, HUD, dải người chơi, thanh emoji, hộp thoại PHÓNG `zoom: var(--ui-zoom)` theo bậc
  CẠNH NGẮN: mini 1,1 · 11" 1,2 · 13" 1,3 (game phóng UI theo màn, app thường thì không;
  iPad cầm xa mắt ~1,3 lần). ĐỪNG phóng bàn thẻ. `.online` là flex DỌC nên panel phải có
  `width: 100%` (margin auto làm nó co còn 340px). Đã đo 6 khổ dọc+ngang: không cuộn,
  không nút lòi. Ảnh store iPad: `KHUNG=ipad` (2064×2752, `<lang>-ipad/`, asc-store
  `-f chup_ipad=true`). Chụp khổ iPad phải chờ 5 giây (2 giây còn trắng trơn).
- Theme nằm ở `apps/web/public/data/themes.json` + bản sao server
  `apps/server/src/themes.ts` — sửa một nơi phải sửa nơi kia. Mỗi theme ≥18
  biểu tượng unique (test kiểm file thật).
- **BẢN ĐẦU LÊN STORE ẨN HẲN ĐỒ PREMIUM** (chủ dự án 14.10.2026): công tắc `banPremium`
  ở `lib/premium.ts` (`false`). Tắt thì: không có tab Premium trong ThemePicker, menu chỉ
  bày skin miễn phí (Kẹo · Neon · Gỗ — Gỗ đã về miễn phí; Đêm Sao + Kẹo Bông là premium),
  danh hiệu của theme premium ẩn và KHÔNG được đếm (mọi chỗ đếm đọc `dsHien`, không đọc
  `ACHIEVEMENTS`). Lý do: đồ khoá mà không mua được là App Review hay loại (luật 2.1).
  Có IAP thì bật `true`; đồ premium chưa mua đeo VƯƠNG MIỆN (không dùng ổ khoá).
  Thử giao diện đã mua: chế độ debug → Luật chơi → nút "Mở Premium để thử" (`datPremiumThu`, chỉ đổi `mm.premium` của máy đó — trong app không có console nên đây là lối duy nhất). Công tắc Twemoji trong menu đã BỎ: máy Apple
  nay MỌI máy vẽ NOTO 3D (15.10.2026, xem mục MẶT BÀI), bản lưu `kieuEmoji` cũ bị bỏ qua.
