import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

/**
 * Đo chỗ trống THẬT của bàn thẻ rồi tính cỡ lá bài — dùng chung cho màn chơi
 * đơn và màn chơi online.
 *
 * Vì sao phải chung: màn online từng tự tính bằng hằng số ước lượng
 * `100dvh - 300px`, đoán chiều cao của thanh HUD và bảng người chơi. Con số đó
 * sai ngay khi bố cục đổi, và nó KHÔNG biết gì về khoảng tỷ lệ lá bài — nên sau
 * khi cỡ bàn và trần tỷ lệ đổi, bàn online lệch hẳn so với bàn chơi đơn dù cùng
 * một cấp.
 */

/** Thẻ không được gầy hơn mức này. 0,58 là tỉ lệ lá tarot — vẫn ra dáng lá bài,
 *  mà lấp được phần chiều cao dư của lưới vuông trên màn dọc. */
export const MIN_ASPECT = 0.58;
/**
 * TRẦN TỈ LỆ: thẻ được phép nở ngang tới 1,25 (dáng 5:4) — cho MỌI cỡ bàn.
 *
 * Lịch sử, vì con số này đã đổi ba lần và lần nào cũng do người chơi báo:
 *  · 3:4 (dáng lá bài chuẩn): bàn hẹp-cao bị chặn chiều cao trước, bề rộng
 *    thừa thành hai dải trống — iPhone SE bàn 2×4 hở 160px, gần nửa bề rộng.
 *  · 1,0 (vuông) cho bàn nhỏ, 1,25 cho bàn ≥42 thẻ: bàn lớn lá chỉ 28–48px,
 *    dáng thẻ không đọc được mà mỗi px bề rộng đều quý, và nới trần ở đó còn
 *    cứu ngưỡng chạm (42 thẻ trên SE: 38,8px → 48,6px).
 *  · 1,25 cho tất cả (06.10.2026): chủ dự án gửi ảnh bàn 24 thẻ ĐẤU MÁY trên
 *    iPhone 15 Pro Max — lá vuông 81px, hở 25px mỗi bên. Tính trên khung đấu
 *    máy 406×490: 2×3 lấp 80%, 3×4 90%, 4×6 80%, cả ba KẸT Ở TRẦN VUÔNG (tỉ lệ
 *    cần: 1,26 / 1,11 / 1,27). Chơi một mình không hở vì không có dải người
 *    chơi (+55px chiều cao) — đúng nhận xét của người chơi. Lá 4×6 sau sửa đo
 *    được 97×85, vẫn là lá bài chứ không phải thanh ngang.
 *
 * Cái "bàn 2×3 trên SE cần 1,75 mới lấp hết" vẫn đúng: lưới quá "béo" so với
 * khung thì không lấp được, không phải lỗi — test chỉ đòi lấp hết KHI tỉ lệ
 * chưa chạm trần.
 */
export const MAX_ASPECT = 1.25;
/* Hai trần nay BẰNG NHAU; giữ hàm `tranTyLe` để chỗ gọi và test không đổi, và
   lúc nào muốn tách lại hai bậc thì chỉ sửa đúng một dòng. */
export const MAX_ASPECT_BAN_LON = 1.25;
export const NGUONG_BAN_LON = 42;
export const tranTyLe = (cols: number, rows: number): number =>
  cols * rows >= NGUONG_BAN_LON ? MAX_ASPECT_BAN_LON : MAX_ASPECT;

/**
 * Phần tính thuần, tách ra để test được mà không cần dựng component.
 * @returns tỷ lệ lá bài và bề rộng bàn (px)
 */
export function gapFor(availW: number): number {
  return availW < 420 ? 6 : 8;
}

export function computeFit(
  availW: number, availH: number, cols: number, rows: number
): { aspect: number; width: number; height: number; gap: number } {
  const gap = gapFor(availW);
  const cellW = (availW - gap * (cols - 1)) / cols;
  const cellH = (availH - gap * (rows - 1)) / rows;
  // Ưu tiên lấp cả hai chiều; kẹp trong khoảng dáng thẻ chấp nhận được
  const aspect = Math.min(tranTyLe(cols, rows), Math.max(MIN_ASPECT, cellW / cellH));
  const cardH = Math.min(cellH, cellW / aspect);
  return {
    aspect, gap,
    width: Math.floor(cardH * aspect * cols + gap * (cols - 1)),
    /* Chiều cao ĐI THEO bề rộng, cùng một phép tính. Có nó thì bàn cao đúng cỡ
       thẻ đã chọn: còn dư chỗ thì để dư, chứ không kéo lá dài ra cho kín khung
       (đã xảy ra — máy tính bàn 16 thẻ ra lá cao ngoằng, khe 6px trông bé xíu). */
    height: Math.floor(cardH * rows + gap * (rows - 1))
  };
}

export interface BoardFit {
  /** Gắn vào phần tử bao bàn thẻ; đây là thứ được đo. */
  wrap: Ref<HTMLElement | null>;
  /** Biến CSS cho `.board`: `--card-ar`, `--fit` và `--card-gap`. */
  fitStyle: Ref<Record<string, string>>;
}

/**
 * @param size Số cột và hàng hiện tại. Nhận hàm vì màn online lấy từ view của
 *   server và view đó thay đổi theo từng gói tin.
 */
export function useBoardFit(size: () => { cols: number; rows: number } | null): BoardFit {
  const wrap = ref<HTMLElement | null>(null);
  const cardAspect = ref(0.75);
  const boardWidth = ref<number | null>(null);
  const boardHeight = ref<number | null>(null);
  const boardGap = ref(8);

  function measure(): void {
    const el = wrap.value;
    const s = size();
    if (!el || !s) return;
    const availW = el.clientWidth;
    const availH = el.clientHeight;
    if (!availW || !availH) return;
    const fit = computeFit(availW, availH, s.cols, s.rows);
    cardAspect.value = fit.aspect;
    boardWidth.value = fit.width;
    boardHeight.value = fit.height;
    boardGap.value = fit.gap;
  }

  let ro: ResizeObserver | undefined;
  onMounted(() => {
    measure();
    ro = new ResizeObserver(measure);
    if (wrap.value) ro.observe(wrap.value);
  });
  onBeforeUnmount(() => ro?.disconnect());
  // Đổi cấp là đổi cỡ bàn: phải đo lại, ResizeObserver không nổ nếu khung bao
  // giữ nguyên kích thước
  watch(() => { const s = size(); return s ? [s.cols, s.rows] : null; }, measure);

  const fitStyle = computed(() => ({
    '--card-ar': String(cardAspect.value),
    '--fit': boardWidth.value ? `${boardWidth.value}px` : '100%',
    /* Cặp với `--fit`: bàn cao đúng cỡ thẻ đã tính, và `.board` kẹp thêm
       `max-height: 100%` nên số đo có lệch cũng không tràn ra ngoài khung. */
    '--fit-h': boardHeight.value ? `${boardHeight.value}px` : '100%',
    /* Khe hở PHẢI do JS quyết định, không phải media query theo viewport: trên
       iPhone 15 Pro Max viewport 430px (CSS lấy 8px) mà khung bàn chỉ 406px
       (JS lấy 6px) — bàn 88 thẻ tính theo 6px rồi vẽ bằng 8px là tràn ra ngoài. */
    '--card-gap': `${boardGap.value}px`
  }));

  return { wrap, fitStyle };
}
