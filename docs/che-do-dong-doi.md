# Chơi đội online — đội theo số

Trạng thái: **1.8.0 (15.11.2026) — ĐỘI THEO SỐ**, thay cho chế độ "mỗi người một lá" của 1.7.0
(chủ dự án: phòng chờ rối, muốn đơn giản). Phần "Ý tưởng / Luật đã chốt" bên dưới là thiết kế 1.7 —
giữ làm lịch sử; luật ĐANG CHẠY là mục này.

## Luật đang chạy (1.8.0)

- **Không có chế độ riêng.** Ai vào phòng (kể cả máy) cũng nhận một số đội 1–4 chưa ai dùng. Mỗi người
  một số = ván thường, chạy đúng nhánh code cũ. Chạm ô "Đội N" ở dòng của mình để chọn; **cùng số là
  cùng đội**. Chủ phòng đổi được đội của máy và người khác.
- **Mở ván cần ít nhất 2 đội.** Cả phòng cùng một số thì nút Bắt đầu ghi "Cần ít nhất 2 đội".
- **Trong ván đội: mỗi lượt một người lật cả hai lá.** Lượt sau của đội tới thành viên kế.
  A+B đấu C: A → C → B → C. Ghép đúng thì chính người đó đi tiếp. Đồng hồ lượt như ván thường.
- **Điểm, mạng, chuỗi tính theo đội**; cuối ván ghi thêm số cặp từng người tự ghép (`capTV`).
- **Máy** vào đội nào cũng được (đứng riêng, hoặc chung đội với người).
- Một người rời giữa ván: đồng đội đi mọi lượt của đội; cả đội rời mới xử thua.
- Chạm giữ một lá để chỉ cho đồng đội vẫn còn (chỉ đồng đội thấy).
- Ván đội chỉ ghi thắng/thua vào tài khoản; ván có máy không ghi gì.
- App cũ: phòng nào cũng vào được; nhưng nếu có người chung đội mà ai đó dùng app chưa hiểu đội theo số
  (`?dd=2`) thì server không mở ván và nêu tên người cần cập nhật.
- Kỹ thuật: engine cờ `teamTurn` (cờ `teamFlip` của 1.7 còn lại chỉ để ván dở + test cũ);
  server `room.ts` (`doiTrong`, `duDoi`, `coDoiGhep`, `chuanDoi`); client `ChonDoi.vue`, `TeamStrip.vue`.
  Test `packages/engine/test/doi-luot.test.ts`, smoke `pnpm smoke:doi`.

## NGUYÊN TẮC SỐ MỘT: không đổi luồng hiện tại

Chủ dự án yêu cầu: chế độ này là **phần gắn thêm**, không sửa lại luồng đang chạy.

- **Mọi thứ sau một cờ** (`teamFlip` hoặc tương đương). Không bật cờ thì engine, server, giao
  diện chạy **y hệt bây giờ** — cùng nhánh code, không chỉ "cùng kết quả".
- **Engine**: chỉ thêm nhánh `if (teamFlip)`, không viết lại `flip()` / `nextTurn` / `rankPlayers`
  chung. Trường mới trong `GameConfig`, `PlayerInit`, snapshot đều **tuỳ chọn** — snapshot cũ và
  phòng online đang chạy phải đọc được. **Toàn bộ test hiện có giữ nguyên và phải xanh**, không
  sửa test cũ cho khớp code mới.
- **Online**: chỉ **thêm** loại gói tin mới (chỉ thẻ, chia đội), không đổi định dạng gói tin đang
  có. Phòng thường không gửi/nhận gì mới. Client cũ vào phòng Đồng đội → từ chối kèm lời nhắc
  cập nhật, không để client cũ chơi sai luật.
- **Giao diện**: thành phần mới (vd `TeamStrip.vue`) **hiện thay thế** khi bật cờ, thay vì nhồi
  nhánh đội vào `PlayerStrip.vue`. Menu/phòng chờ chỉ thêm một lựa chọn, không đổi thứ tự bước
  hiện có.
- **Không đụng**: Chiến dịch, đấu máy offline, nhiều người chung máy, bot — ở giai đoạn 1–2.
- Nếu thấy buộc phải sửa luồng chung, **dừng lại hỏi chủ dự án** trước.

## Ý tưởng

Hai người chơi chung một đội. Trong một lượt của đội, **người A lật lá thứ nhất, người B lật lá
thứ hai**. Ai lật lá thứ hai phải nhớ cả những lá đồng đội từng mở → buộc phải phối hợp.

## Luật đã chốt

- Đội 2 người. Lượt đội: A lật lá 1, B lật lá 2.
- Ghép đúng → đội đi tiếp. Ghép sai → sang lượt đội/máy kia.
- **Ai lật trước: luân phiên cố định** A → B → A… mỗi lượt của đội, bất kể đúng hay sai lượt trước.
  Ghép đúng được đi tiếp thì **giữ nguyên người lật lá đầu cho cả lượt đó** (chủ dự án chốt 14.11.2026).
- Máy (nếu có) tự lật cả 2 lá như bình thường.
- **Mức máy: chọn như mọi khi**, không tự nâng vì có 2 người.
- Điểm, cặp, chuỗi ghép đúng (`streak`, `bestStreak`) tính **theo đội**. Thắng/thua/hoà theo đội.
- Giới hạn thời gian **theo từng lá** (~8 giây), không theo cả lượt.

## Kết hợp với chế độ/tuỳ chọn có sẵn

| | Được? | Cách xử lý |
|---|---|---|
| Cổ điển | ✅ | Như luật trên |
| Tính giờ | ✅ | Giới hạn theo từng lá |
| Sinh tồn | ✅ | Đội dùng chung số mạng; ai lật sai cũng trừ mạng đội |
| Nhìn trộm | ✅ | Cả hai cùng nhìn đầu ván |
| Chiến dịch | ❌ | Màn chiến dịch là chơi đơn (sao, tiến độ cá nhân) |
| Thẻ đặc biệt | ✅ | ❄️ đóng băng khoá **cả đội**; 👁 hé lộ cả hai cùng thấy; x2 áp cho đội |
| Xáo thẻ | ✅ | Giữ nguyên |

## Ưu tiên: ONLINE

Chủ dự án muốn chế độ này chủ yếu cho **online**. Các đội hình:

1. **2 vs 2** (hai đội người) — không cần máy, cạnh tranh nhất. **Đề xuất làm trước.**
2. **2 người vs máy** — rủ bạn vào phòng cùng đánh máy.
3. Thiếu người → máy lấp chỗ trống (vd 3 người: máy ghép đội với người lẻ).

> Kiểu 2 và 3 cần máy chạy được trong phòng online. **Kiểm tra trước**: hiện bot chỉ chạy ở
> client (`useGameSession`) hay server cũng chạy được? Nếu chỉ client thì kiểu 2–3 là giai đoạn sau.

### Thứ online bắt buộc phải có: báo hiệu cho đồng đội

Chơi chung máy thì nói miệng được, online thì không.

- **Chỉ thẻ**: chạm giữ một thẻ úp → thẻ đó nháy sáng trên màn đồng đội kèm "chỗ này!".
  **Chỉ đồng đội thấy**, đội kia không nhận được gói tin này (lọc ở server, đừng gửi rồi ẩn ở client).
- ~~Thanh emoji thêm kênh "chỉ đồng đội"~~ — **BỎ** (chủ dự án 14.11.2026): emoji chat CHUNG cả phòng như hiện nay.

### Online khác

- **Rớt mạng**: đồng đội rớt → người còn lại tự lật cả 2 lá (không xử thua cả đội). Cả đội rớt
  quá ngưỡng hiện có (ON-07 — `ROOM_LIMITS.reconnectMs`, hiện là **5 phút**, không phải 30 giây) mới xử thua.
- **Phòng chờ**: chủ phòng chọn kiểu "Đồng đội", xếp người vào 2 đội (mặc định chia xen kẽ theo
  thứ tự vào phòng, cho kéo/đổi đội). Link mời giữ nguyên.

## Offline (chung một máy) — làm sau, gần như có sẵn khi engine xong

Nhánh menu **"Đấu với máy"**: sau bước chọn mức máy, chèn bước
**"Ai đấu với máy?" — 👤 Một mình · 👥 Hai người cùng đội**. Chọn hai người → qua bước nhập tên
(đã có ở nhánh nhiều người) → các bước sau giữ nguyên. Không làm thành chế độ riêng, không làm
công tắc trong nhánh "Nhiều người".

## Kỹ thuật — gợi ý

- **Engine** (`packages/engine`):
  - `PlayerInit.team?: string`; `GameConfig.teamFlip?: boolean` (hoặc tên tương đương).
  - Ngoài "lượt của ai" (`turnIndex`) cần thêm "**ai được lật lá này**": lá 1 → người lật trước
    của đội, lá 2 → người còn lại. `flip()` từ chối người không đúng.
  - `nextTurn` xoay theo **đội**; trong đội xoay người lật trước.
  - `rankPlayers` / phá thế hoà theo đội. `snapshot()` / khôi phục phải mang `team` và vị trí
    luân phiên (phòng online đang chạy + resume offline).
  - Giới hạn giờ theo lá thay vì theo lượt khi bật chế độ này.
  - Test đủ: luân phiên, ghép đúng đi tiếp, freeze khoá cả đội, sinh tồn mạng chung, rớt mạng
    một người, snapshot vòng tròn.
- **Giao diện**: [PlayerStrip.vue](../apps/web/src/components/PlayerStrip.vue) gom theo 2 khối đội
  + tổng điểm đội; viền thẻ/nhãn "Lượt B lật" theo màu người được lật; màn kết quả "Đội thắng".
  Theo quy ước nổi khối của Lật Thẻ (mọi nút/ô kiểu thạch).
- **i18n**: mọi chữ mới qua i18n, đủ các ngôn ngữ đang có.

## Thứ tự làm đề xuất

1. Engine hỗ trợ đội + test (dùng chung offline/online).
2. Online 2 vs 2 + chỉ thẻ chỉ-đồng-đội + phòng chờ chia đội.
3. Bot trong phòng online → kiểu 2 người vs máy, máy lấp chỗ.
4. Offline chung máy (bước "Ai đấu với máy?").

Giai đoạn 1–2 là đủ chơi; 3–4 chỉ làm khi chủ dự án bảo.

## Đã chốt (14.11.2026, trước là mục "Còn mở")

- Ván đội **chỉ tính thắng/thua** vào tài khoản, **không** cộng điểm xếp hạng / danh hiệu online.
- **Chỉ đội 2** ở bản đầu (2 đấu 2 = đúng trần phòng 4).
- Bot đã chạy được TRÊN SERVER từ 1.6.0 (`room.ts`: `henMay`/`diMay`) — kiểu 2–3 khả thi, vẫn để giai đoạn 3.

## Cách làm thực tế (giai đoạn 1–2)

- Engine: **mỗi ĐỘI là một `Player`** (`id` `doi-A`/`doi-B`, `thanhVien: [a, b]`). Điểm, cặp, chuỗi,
  mạng chung, ❄️, x2, xếp hạng/hoà tự đi theo đội mà KHÔNG sửa `flip()`/`nextTurn`/`rankPlayers` —
  chỉ thêm nhánh `if (config.teamFlip)`: `nguoiLat()` (ai được lật lá này), `luotDoi` (luân phiên),
  đồng hồ theo lá, `roiDoi()` (một người rời, đội chơi tiếp).
- Phòng chờ (bản đơn giản chủ dự án chọn): MỘT danh sách, mỗi người một ô "Đội 1 / Đội 2", AI CŨNG tự đổi đội
  mình (chủ phòng đổi được người khác + máy). Đội hình hợp lệ: mỗi đội 2 người, hoặc 2 người đấu MỘT máy
  (máy là đội một thành viên, tự lật cả hai lá).
- Trong ván: `TeamStrip.vue` thay dải chip (một hàng 44px); chỉ thẻ = chạm giữ 0,4s (lớp ngoài CardTile).
- Online: client khai `?dd=1`; phòng Đồng đội từ chối client cũ. Gói tin MỚI: `doi`, `chi` (không có kênh emoji riêng — chat chung).
