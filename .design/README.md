# Canvas thiết kế

Nguồn của canvas thiết kế đang sống ở
<https://claude.ai/code/artifact/1d62ce28-d611-4324-a6a1-790b9e563db1>.

- Mỗi `*.dc.html` là MỘT artboard (một khung thiết kế) trên canvas.
- `canvas.json` xếp chỗ các artboard, chia trang và chọn trang mở đầu.
- `_base.css` là bản chép token thật từ `apps/web/src/styles/` — sửa token
  trong app thì chép lại sang đây, không thì thiết kế lệch với bản chạy thật.

**Bản dựng không nằm trong git** (`.gitignore` loại `.design/*.html` trừ
`*.dc.html`): file đó nặng ~2,6MB vì nhúng cả trình sửa vào trong, mà dựng lại
được từ đúng đám file cạnh đây. Đừng commit nó.

## Các trang hiện có

1. **Phòng công khai** — luồng vào chơi online: danh sách phòng, tạo phòng,
   phòng chờ, vào bằng mã.
2. **Dải 10 người** — ba cách xếp dải người chơi khi bàn tới 10 người.
3. **Nút công khai** — bốn phương án cho nút công khai/riêng tư. Đã chọn A
   (hai ô cạnh nhau) và làm vào `OnlineScreen.vue`.
