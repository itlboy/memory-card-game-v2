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
 * Trần tỷ lệ: thẻ được phép nở ngang tới VUÔNG. Khoá ở 3:4 (dáng lá bài chuẩn)
 * thì bàn hẹp và cao bị chặn chiều cao trước, bề rộng thừa ra thành hai dải
 * trống hai bên — đo trên iPhone SE: bàn 2×4 hở 160px, gần một nửa bề rộng.
 *
 * Cho tới 1,0 thì diện tích dùng được lên từ 88,5% tới 97,1% (tính trên 11 cỡ
 * bàn × 3 cỡ máy). Nới thêm tới 1,2 được 99,4% nhưng thẻ thành rộng hơn cao,
 * không còn ra hình lá bài nữa — nên dừng ở vuông.
 */
export const MAX_ASPECT = 1;

/**
 * Phần tính thuần, tách ra để test được mà không cần dựng component.
 * @returns tỷ lệ lá bài và bề rộng bàn (px)
 */
export function computeFit(
  availW: number, availH: number, cols: number, rows: number
): { aspect: number; width: number } {
  const gap = availW < 420 ? 6 : 8;
  const cellW = (availW - gap * (cols - 1)) / cols;
  const cellH = (availH - gap * (rows - 1)) / rows;
  // Ưu tiên lấp cả hai chiều; kẹp trong khoảng dáng thẻ chấp nhận được
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, cellW / cellH));
  const cardH = Math.min(cellH, cellW / aspect);
  return { aspect, width: Math.floor(cardH * aspect * cols + gap * (cols - 1)) };
}

export interface BoardFit {
  /** Gắn vào phần tử bao bàn thẻ; đây là thứ được đo. */
  wrap: Ref<HTMLElement | null>;
  /** Biến CSS cho `.board`: `--card-ar` và `--fit`. */
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
    '--fit': boardWidth.value ? `${boardWidth.value}px` : '100%'
  }));

  return { wrap, fitStyle };
}
