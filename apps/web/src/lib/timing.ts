/**
 * Nhịp chia bài đầu ván — DÙNG CHUNG giữa hiệu ứng CSS (CardTile) và tiếng
 * chia bài (audio.deal).
 *
 * Vì sao phải chung: trước đây hình lấy 28ms mỗi thẻ còn tiếng cố định 10 tiếng
 * cách nhau 35ms, nên bàn 4 thẻ hình xong sau 84ms mà tiếng còn kêu tới 350ms,
 * còn bàn 50 thẻ thì hình chạy 686ms mà tiếng đã tắt từ giữa. Một công thức duy
 * nhất thì hai bên không bao giờ lệch nữa.
 */

/** Độ so le tối đa giữa hai thẻ liền nhau. */
export const DEAL_STEP_MS = 28;
/** Tổng thời gian chia bài không vượt mức này, bàn to cỡ nào cũng vậy — 28ms
 *  mỗi thẻ ở bàn 50 thẻ là chờ gần 1,4 giây, người chơi tưởng game treo. */
export const DEAL_WINDOW_MS = 700;

/** Khoảng cách giữa hai thẻ liền nhau, tính theo tổng số thẻ trên bàn. */
export const dealStep = (cards: number): number =>
  Math.min(DEAL_STEP_MS, DEAL_WINDOW_MS / Math.max(1, cards));

/** Thời điểm thẻ CUỐI bay vào — cũng là lúc tiếng chia bài phải dứt. */
export const dealSpan = (cards: number): number => dealStep(cards) * Math.max(0, cards - 1);
