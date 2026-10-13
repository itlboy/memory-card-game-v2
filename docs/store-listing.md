# Store listing — Flip Match (Lật Thẻ)

Bản chép-dán cho App Store Connect và Google Play Console. Ngôn ngữ chính
English (U.S.), thêm bản Vietnamese. Số ký tự đã đếm (giới hạn ghi trong ngoặc);
sửa nội dung thì chạy `python3 tools/dem-ky-tu-store.py` để soát lại.

Đổi luật chơi hay thêm tính năng thì sửa cả file này — cùng lý do với
`RulesDialog.vue` (CLAUDE.md: "Đổi thể thức chơi thì PHẢI cập nhật hướng dẫn").

## Ảnh chụp màn hình

`node tools/chup-store.mjs <url server> <thư mục ra> <en|vi>` chụp 7 cảnh ở khung
iPhone 6.9" (1320×2868 — cỡ App Store bắt buộc; Google Play nhận luôn). Server
phải chạy bản build mới (`pnpm node:dev`) vì cảnh phòng online cần API thật.
Kịch bản ở `tools/chup-store-kichban.mjs`; thêm ngôn ngữ = thêm một dòng `NHAN`.

## Chung

| Trường | Giá trị |
|---|---|
| Support URL | https://flipmatch.hello314.com/support.html |
| Marketing URL | https://flipmatch.hello314.com |
| Privacy Policy URL | https://flipmatch.hello314.com/privacy.html |
| Category (Apple) | Games → Primary **Puzzle**, Secondary **Board** |
| Category (Google) | Game → **Puzzle** |
| Copyright | 2026 314 Labs |
| Price | Free, no in-app purchases, no ads |

## English (U.S.)

**Name** (30) — App Store
```
Flip Match: Memory Cards
```

**Subtitle** (30) — App Store
```
Memory game with friends & bot
```

**Promotional text** (170) — App Store, sửa được bất cứ lúc nào không cần duyệt
```
Flip cards, match pairs, train your memory. Play solo, take on a 5-level bot, pass the phone around, or open an online room and invite friends with a 6-digit code.
```

**Keywords** (100) — App Store, phẩy không cách, KHÔNG lặp từ đã có trong Name
```
concentration,pairs,match,brain,training,puzzle,card,game,kids,family,multiplayer,online,offline
```

**Short description** (80) — Google Play
```
Flip cards, match pairs, train your memory. Solo, vs bot or online with friends.
```

**Description** (4000) — cả hai store
```
Flip Match is the classic memory card game, rebuilt for quick fun alone or with friends.

Flip two cards. Same picture? It's a match. Different? Remember where they were and try again. Clear the board in as few moves as you can.

PLAY YOUR WAY
• Solo — beat your own best time and move count
• Versus bot — five levels, from Wobbly Chick to Divine Dragon
• Same device — pass the phone around, up to 4 players
• Online rooms — create a room, share the 6-digit code or link, up to 10 players
• Campaign — a 50-stage journey where every stage has its own twist

MAKE THE BOARD YOURS
• 12 board sizes, from a 4-card warm-up to a brutal 88-card challenge
• 5 optional rules, each with 4 levels: timer, lives, peek, shuffle and special cards
• 24 card themes: animals, food, flags, numbers and more

KEEP COMING BACK
• 103 achievements to unlock
• Records for every board size
• Optional Sign in with Apple or Google to sync progress across devices and climb the leaderboard

MADE TO FEEL GOOD
• Smooth card flips with haptic feedback
• Satisfying win effects and sounds
• Works offline — no connection needed for solo, bot or same-device games
• 12 languages
• No ads. No tracking. No in-app purchases.
```

## Tiếng Việt

**Name** (30)
```
Lật Thẻ: Trò Chơi Trí Nhớ
```

**Subtitle** (30)
```
Lật thẻ ghép cặp cùng bạn bè
```

**Promotional text** (170)
```
Lật thẻ, ghép cặp, rèn trí nhớ. Chơi một mình, đấu máy 5 mức, chuyền máy cho cả nhóm, hoặc mở phòng online và mời bạn bè bằng mã 6 số.
```

**Keywords** (100)
```
lật thẻ,ghép cặp,trí nhớ,trò chơi,giải đố,thẻ bài,trẻ em,gia đình,nhiều người,online,offline
```

**Short description** (80) — Google Play
```
Lật thẻ ghép cặp rèn trí nhớ. Chơi một mình, đấu máy, hoặc online cùng bạn bè.
```

**Description** (4000)
```
Lật Thẻ là trò chơi trí nhớ kinh điển, làm mới để chơi nhanh một mình hay vui cùng bạn bè.

Lật hai lá. Cùng hình? Ghép được! Khác hình? Nhớ vị trí rồi thử lại. Dọn sạch bàn với ít lượt nhất có thể.

CHƠI THEO CÁCH CỦA BẠN
• Một mình — phá kỷ lục thời gian và số lượt của chính mình
• Đấu máy — năm mức, từ Gà Mờ tới Rồng Thần
• Chung một máy — chuyền điện thoại, tối đa 4 người
• Phòng online — tạo phòng, gửi mã 6 số hoặc link, tối đa 10 người
• Chiến dịch — hành trình 50 màn, màn nào cũng có luật riêng

BÀN CHƠI CỦA RIÊNG BẠN
• 12 cỡ bàn, từ 4 thẻ khởi động tới 88 thẻ siêu khó
• 5 luật tuỳ chọn, mỗi luật 4 mức: đồng hồ, số mạng, xem trước, xáo thẻ, thẻ đặc biệt
• 24 bộ hình: con vật, đồ ăn, cờ các nước, chữ số và nhiều nữa

MUỐN CHƠI MÃI
• 103 danh hiệu để chinh phục
• Kỷ lục riêng cho từng cỡ bàn
• Đăng nhập Apple hoặc Google (tuỳ chọn) để đồng bộ giữa các máy và lên bảng xếp hạng

CHƠI LÀ SƯỚNG
• Lật thẻ mượt, có rung phản hồi
• Hiệu ứng và âm thanh thắng ván đã tai đã mắt
• Chơi không cần mạng — một mình, đấu máy, chung máy đều chạy offline
• 12 ngôn ngữ
• Không quảng cáo. Không theo dõi. Không mua trong app.
```

## Phân loại độ tuổi (Apple) / Content rating (Google)

Trả lời "None" cho mọi mục bạo lực, tình dục, cờ bạc, thuốc… Hai mục cần chú ý:
- **User-generated content / Unrestricted web access**: KHÔNG. Chat online chỉ là
  danh sách emoji đóng (ON-08); thứ người chơi tự gõ duy nhất là tên hiển thị.
- **Social media / interacts with others online**: CÓ — phòng online cho người lạ
  vào cùng ván (phòng công khai), có bảng xếp hạng hiện tên.
Kết quả mong đợi: Apple 4+ / 9+, Google PEGI 3 / Everyone. Đặt độ tuổi mục tiêu
(Google, Target audience) là **13+** để không rơi vào chính sách Families.

## App Privacy (Apple) / Data safety (Google)

Khớp với `apps/web/public/privacy.html`:

| Dữ liệu | Thu khi | Gắn danh tính | Mục đích |
|---|---|---|---|
| Email, Name | đăng nhập (tuỳ chọn) | Có | App functionality (tài khoản) |
| User ID (mã Apple/Google) | đăng nhập | Có | App functionality |
| Gameplay content (điểm, kỷ lục, danh hiệu) | đăng nhập | Có | App functionality |
| Other user content (tên hiển thị online) | chơi online | Không | App functionality |
| Device ID (mã ngẫu nhiên do app tạo) | chơi online | Không | Analytics (đếm người chơi) |

- Không dùng để **theo dõi (tracking)** → không cần App Tracking Transparency.
- Dữ liệu mã hoá khi truyền: CÓ. Người dùng xoá được: CÓ (trong app).
