/**
 * SỐ ĐO CHO BẢNG `?debug=1` — một đối tượng thường, KHÔNG reactive.
 *
 * Vì sao ghi từ bên trong `useOnlineRoom` chứ không bọc `window.WebSocket` ở
 * component: bật bảng đo lúc ĐANG ở trong phòng thì socket đã mở từ trước, cái
 * bọc không thấy gói nào — đo được thật, bảng hiện "0 gói" giữa lúc chơi. Ghi ở
 * đúng chỗ nhận tin thì bật lúc nào cũng có số.
 *
 * Không reactive để việc đo không tự làm chậm cái nó đang đo: bảng đọc theo nhịp
 * `requestAnimationFrame` của chính nó.
 */
export const doNhip = {
  /** Tổng số gói tin nhận được từ server. */
  goi: 0,
  /** `performance.now()` của gói tin gần nhất — dùng để biết đã im bao lâu. */
  tinCuoi: 0,
  /** Số lần phải mở lại socket kể từ lúc vào phòng. */
  noiLai: 0,
  /** Trạng thái socket lúc gần nhất chạm tới: 'mở' | 'đang nối' | 'đứt'. */
  socket: '—' as string,
  /** Lá ĐANG NGỬA mà không có biểu tượng — ô trắng trơn, tức đường symbol hỏng. */
  laTrong: 0,
  /** Lá ÚP mà mặt sau không có hoạ tiết — thiếu khối CSS ở card-backs.css. */
  sauTrong: 0,
  /**
   * ms từ lúc nhận gói ĐỔI BÀN (`state`/`events`) tới lúc DOM đã cập nhật xong.
   *
   * Đo bằng `nextTick` ngay tại chỗ nhận tin, KHÔNG bằng MutationObserver: quan
   * sát class thì mọi lần đổi do HẸN GIỜ (quầng loé tắt sau 520ms, hai lá lật
   * sai úp lại sau 1,5 giây) cũng bị tính thành "gói tin về chậm" — bản đầu ra
   * 710ms chính vì vậy, một con số không nói lên điều gì.
   */
  tinToiDom: 0,
  /** Mã đóng socket lần gần nhất. 1006 = mạng rớt · 4000 = bị socket mới thay. */
  maDong: 0
};
