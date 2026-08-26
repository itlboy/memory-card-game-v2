import { nextTick, onScopeDispose, watchEffect } from 'vue';
import { ghiUrl, urlApp } from '@/lib/appUrl';

/**
 * NÚT BACK CỦA TRÌNH DUYỆT không được ném người chơi ra khỏi web.
 *
 * Vì sao trước đây bấm Back là mất trang: cả app chỉ ghi URL bằng
 * `history.replaceState`, nên đi năm bước wizard, vào ván, mở phòng online thì
 * lịch sử trình duyệt vẫn chỉ có ĐÚNG MỘT mục — không có gì để lùi về, và cú
 * Back đầu tiên đưa họ ra khỏi trang. Trên điện thoại đây là thao tác theo thói
 * quen, và cử chỉ vuốt lùi của iOS cũng bắn ra đúng sự kiện này.
 *
 * CÁCH LÀM: đúng MỘT "chốt" trong lịch sử.
 *
 *   - Khi app có thứ gì đó đóng được (hộp thoại, bước wizard, ván đang chơi) →
 *     đẩy một mục chốt.
 *   - Back → chốt bị tiêu, app đóng ĐÚNG MỘT thứ, rồi đẩy chốt mới nếu vẫn còn
 *     thứ khác để đóng.
 *   - Ở trang chủ, không còn gì để đóng → không có chốt nào → Back rời trang
 *     như bình thường.
 *
 * Bản đầu tôi làm phức tạp hơn nhiều: một CHỒNG mục lịch sử, mỗi lớp một mục, và
 * dọn mục thừa bằng `history.back()`. Nó hỏng thật: `history.back()` chạy bất
 * đồng bộ nên khi wizard đóng lại đúng lúc ván mở ra, cú Back thật của người
 * chơi bị con đếm "đang tự lùi" nuốt mất — bấm Back giữa ván không hiện hộp hỏi
 * gì cả. Nó còn KÉO URL LÙI THEO, biến `?playing=1` thành `?w=theme`.
 * Một chốt duy nhất thì không có gì để lệch: không tự lùi, không đụng URL.
 */

interface Chot {
  /** Lớn hơn = đóng trước. Hộp thoại phải đóng trước bước wizard bên dưới nó. */
  uuTien: number;
  /** Đang có gì để đóng không. Đọc ref nên watchEffect theo dõi được. */
  co: () => boolean;
  dong: () => void;
}

const chots: Chot[] = [];
/** Đã đẩy chốt vào lịch sử chưa. Chỉ có tối đa MỘT. */
let daBat = false;
let daNghe = false;

/** Thứ cần đóng trước nhất; null = không còn gì. */
function canDong(): Chot | null {
  let ra: Chot | null = null;
  for (const c of chots) {
    if (!c.co()) continue;
    if (!ra || c.uuTien > ra.uuTien) ra = c;
  }
  return ra;
}

function batChot(): void {
  if (daBat || typeof history === 'undefined') return;
  daBat = true;
  history.pushState({ mmBack: 1 }, '', location.href);
}

function onPop(): void {
  daBat = false;               // chốt vừa bị tiêu
  const c = canDong();
  if (!c) return;              // không còn gì: để trình duyệt rời trang
  c.dong();
  nextTick(() => {
    /*
     * Cú Back KÉO URL LÙI THEO — đó là chuyện đã biến `?playing=1` thành
     * `?w=level`, và F5 sau đó dựng lại wizard thay vì ván đang chơi. App tự ghi
     * URL của nó (lib/appUrl.ts) nên chỉ cần đặt lại cho khớp. Làm ở nhịp SAU
     * để watcher của màn kịp ghi URL mới của nó trước (ví dụ lùi một bước wizard
     * thì `?w=` phải đổi theo).
     */
    if (location.pathname + location.search !== urlApp()) ghiUrl(urlApp());
    // Đóng xong còn thứ khác (ví dụ hộp hỏi vừa mở ra) thì đặt chốt mới ngay.
    if (canDong()) batChot();
  });
}

/**
 * Đăng ký một thứ mà nút Back nên đóng.
 *
 * `uuTien` quyết định thứ tự: hộp thoại (30) đóng trước ván đang chơi (20),
 * ván đóng trước bước wizard (10). Cùng một lúc chỉ đóng ĐÚNG MỘT thứ.
 */
export function useBackCloser(uuTien: number, co: () => boolean, dong: () => void): void {
  const chot: Chot = { uuTien, co, dong };
  chots.push(chot);

  if (!daNghe && typeof window !== 'undefined') {
    daNghe = true;
    window.addEventListener('popstate', onPop);
  }
  // Có gì đóng được thì luôn giữ sẵn một chốt. watchEffect theo dõi ref bên
  // trong `co()`, nên vào ván hay mở hộp thoại là chốt tự bật.
  watchEffect(() => { if (canDong()) batChot(); });

  onScopeDispose(() => {
    const i = chots.indexOf(chot);
    if (i !== -1) chots.splice(i, 1);
  });
}

/** Chỉ dùng cho test: quên hết chốt giữa hai lần dựng app. */
export function _resetBackGuard(): void {
  chots.length = 0;
  daBat = false;
}
