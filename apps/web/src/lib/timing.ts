/**
 * Nhịp chia bài đầu ván — DÙNG CHUNG giữa hiệu ứng CSS (CardTile) và tiếng
 * chia bài (audio.deal).
 *
 * Vì sao phải chung: trước đây hình lấy 28ms mỗi thẻ còn tiếng cố định 10 tiếng
 * cách nhau 35ms, nên bàn 4 thẻ hình xong sau 84ms mà tiếng còn kêu tới 350ms,
 * còn bàn 50 thẻ thì hình chạy 686ms mà tiếng đã tắt từ giữa. Một công thức duy
 * nhất thì hai bên không bao giờ lệch nữa.
 */

/**
 * CẢ BÀN HIỆN CÙNG LÚC (chủ dự án 16.10.2026: chia lần lượt từng hàng "không mượt").
 *
 * Lịch sử: so le 28ms mỗi THẺ (giật, 88 animation lệch nhau) → lệch 100ms mỗi HÀNG
 * (gợn sóng, vẫn bị chê) → nay MỌI lá chạy chung một nhịp `deal`, không trễ. Đừng dựng
 * lại độ trễ theo hàng/theo thẻ.
 */

/**
 * Thẻ coi như đã đáp xuống bàn sau bấy nhiêu ms tính từ lúc nó hiện ra.
 *
 * Bằng đoạn NỞ RA của keyframe `deal` (tới 62% của 520ms): từ mốc đó lá đã ở
 * gần đúng cỡ, bấm vào lật lúc này vẫn mượt. Phần còn lại chỉ là nảy về 1.
 */
export const DEAL_SETTLE_MS = 320;

/**
 * Cả animation `deal` dài bấy nhiêu ms.
 *
 * 520ms, không phải 2,4 giây như bản cũ: bản cũ có một đoạn lắc tắt dần rất dài
 * ở cuối, mà chính nó khoá `settled` — tức là khoá cả hiệu ứng hover — hơn hai
 * giây sau khi lá đã nằm yên trên bàn.
 */
export const DEAL_ANIM_MS = 520;
