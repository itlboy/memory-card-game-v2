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
 * BÀN LỚN ĐƯỢC NỞ NGANG QUÁ HÌNH VUÔNG.
 *
 * Khi chiều cao là thứ chặn — ván ONLINE luôn thế, vì khung chat ăn ~44px —
 * thì trần vuông làm bề rộng thừa ra thành hai dải trống. Đo trên iPhone 15 Pro
 * Max (khung bàn thật 406×500): bàn 88 thẻ chỉ lấp 89% bề rộng, phí 44px; trên
 * SE còn 63%. Người chơi báo đúng chuyện này, kèm nhận xét sắc: chơi một mình
 * (không có khung chat) thì không hở.
 *
 * Nới trần CHỈ CHO BÀN LỚN, vì cái giá của nó là dáng lá bài:
 *  · bàn ≥42 thẻ — lá chỉ còn 28–48px, ở cỡ đó "dáng lá bài" gần như không đọc
 *    được, mà mỗi pixel bề rộng đều quý. Ngưỡng ĐẶT Ở 42 chứ không 56 vì chính
 *    bàn 42 thẻ là ca tệ nhất trên iPhone SE: trần vuông cho lá 38,8px — DƯỚI
 *    ngưỡng chạm 44px — còn trần 1,25 kéo lên 48,6px. Nới trần ở đây vừa lấp
 *    bề rộng vừa cứu luôn ngưỡng chạm;
 *  · bàn nhỏ giữ trần vuông — lá đã 83–166px, kéo rộng thêm chỉ làm nó thành
 *    thanh ngang chứ không dễ chơi hơn. Bàn 2×3 trên SE cần tới tỉ lệ 1,75 mới
 *    lấp hết bề rộng: đó là lưới quá "béo" so với khung, không phải lỗi.
 */
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
