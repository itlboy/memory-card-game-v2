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
 * CHIA THEO HÀNG, KHÔNG THEO TỪNG THẺ.
 *
 * Bản trước so le 28ms một THẺ, nên bàn 88 thẻ có 88 animation lệch nhau lăn
 * bánh cùng lúc — nhìn ra thành giật, và không đọc được thứ tự nào cả. Nay cả
 * một hàng bay vào cùng lúc, hàng trên trước hàng dưới: mỗi lúc chỉ một, hai
 * hàng đang chuyển động, và mắt đi theo được.
 */

/** Khoảng cách giữa hai HÀNG liền nhau. */
export const DEAL_ROW_GAP_MS = 100;
/**
 * Trần cho tổng thời gian chia bài — CHỐT CHẶN, không phải mức thường dùng.
 *
 * Ở nhịp 100ms hiện tại thì trần này không bao giờ chạm: bàn nhiều hàng nhất là
 * 88 thẻ (8×11) chỉ mất 1,0 giây. Giữ nó lại vì nhịp là thứ hay được chỉnh —
 * lúc thử 500ms thì đúng bàn đó mất 5 giây, mà ván online thì 5 giây đó nằm
 * TRƯỚC nước đi đầu tiên. Quá trần thì các hàng tự dồn lại gần nhau hơn.
 */
export const DEAL_TOTAL_CAP_MS = 3000;

/** Khoảng cách giữa hai hàng, đã kẹp theo trần tổng. */
export const dealRowGap = (rows: number): number =>
  Math.min(DEAL_ROW_GAP_MS, DEAL_TOTAL_CAP_MS / Math.max(1, rows - 1));

/** Thẻ ở HÀNG này bắt đầu bay vào lúc nào (ms tính từ đầu ván). */
export const dealDelay = (row: number, rows: number): number =>
  Math.round(Math.max(0, row) * dealRowGap(rows));

/** Thời điểm HÀNG CUỐI bắt đầu bay vào. */
export const dealSpan = (rows: number): number => dealDelay(rows - 1, rows);

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
