<script setup lang="ts">
import { t } from '@/lib/i18n';
import type { Card } from '@mm/engine';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { chonCoAnh, taiTruocAnh } from '@/lib/emoji';
import CardTile from './CardTile.vue';

const props = defineProps<{
  cards: Card[];
  cols: number;
  faceUp: Set<number>;
  matched: Set<number>;
  wrongPair: number[];
  revealingAll: boolean;
  locked: boolean;
  /** Kiểu mặt sau của ván này. */
  back?: string;
  /** Hai ô vừa bị thẻ tráo đổi hoán chỗ. */
  swap?: { a: number; b: number; key: number } | null;
  /** Ô đã bấm nhưng server chưa xác nhận (chỉ ván online). */
  pending?: Set<number>;
  /** Lá VỪA ĐƯỢC MỞ bởi bất kỳ ai, kèm số đếm để lặp lại hiệu ứng. Trên bàn
   *  56–88 thẻ, không có tín hiệu này thì đối thủ mở lá nào cũng không ai thấy. */
  vuaMo?: { index: number; key: number; cuaToi?: boolean } | null;
  /** Hình của cả bàn để TẢI TRƯỚC (online: thẻ úp không mang symbol nên bàn tự
   *  không biết). Chỉ là TẬP hình đã sắp xếp — không kèm vị trí. */
  hinhCuaBan?: readonly string[];
}>();

const emit = defineEmits<{ flip: [index: number] }>();
const grid = ref<HTMLElement | null>(null);

/**
 * CỠ ẢNH MẶT BÀI CHO CẢ BÀN (lib/emoji.ts `chonCoAnh`): đo MỘT lá thật, không
 * đo từng lá (88 phép đo mỗi lần đổi cỡ). Hình = `.front` max(22px, 72cqw) ×
 * `.emoji` .92em. Trước khi đo được thì ĐOÁN theo bề ngang cột game ÷ số cột (bàn
 * bị chặn bởi chiều cao thì lá nhỏ hơn → đoán dư một bậc, không bao giờ thiếu nét).
 * Đoán sai là mỗi hình tải HAI lần (đã đo: bàn 12 thẻ tải 6 ảnh 512 rồi 6 ảnh 256).
 * Xoay máy / đổi khung → ResizeObserver đo lại.
 */
const doan = (): number => {
  const rong = typeof window === 'undefined' ? 400 : Math.min(window.innerWidth, 600);
  return chonCoAnh(Math.max(22, (rong / Math.max(1, props.cols)) * 0.72) * 0.92);
};
const coAnh = ref(doan());
function doCoAnh(): void {
  const la = grid.value?.querySelector<HTMLElement>('.card');
  if (!la || !la.offsetWidth) return;
  coAnh.value = chonCoAnh(Math.max(22, la.offsetWidth * 0.72) * 0.92);
}
let ro: ResizeObserver | null = null;
onMounted(() => {
  doCoAnh();
  if (typeof ResizeObserver !== 'undefined' && grid.value) {
    ro = new ResizeObserver(doCoAnh);
    ro.observe(grid.value);
  }
});
onUnmounted(() => ro?.disconnect());
watch(() => props.cards.length, () => { coAnh.value = doan(); doCoAnh(); }, { flush: 'post' });
/* Tải trước ảnh mọi hình của bàn ở đúng cỡ sẽ vẽ — lá lật lên là có hình ngay, không
   ra ô trắng chờ mạng. Offline: thẻ mang sẵn symbol; online: lấy `hinhCuaBan`. Cỡ đổi
   (xoay máy) thì tải cỡ mới — URL đã tải bỏ qua nên không tốn lại. */
watch(
  () => [coAnh.value, props.cards.length, props.hinhCuaBan] as const,
  () => taiTruocAnh([...props.cards.map((c) => c.symbol), ...(props.hinhCuaBan ?? [])], coAnh.value),
  { immediate: true }
);

/**
 * Hiệu ứng tráo thẻ. Engine đã đổi chỗ xong rồi, nên ở đây làm ngược: đặt thẻ
 * về chỗ CŨ của nó bằng transform, rồi để animation kéo về 0 — mắt thấy hai lá
 * bay chéo qua nhau vào chỗ mới. Đo bằng rect thật chứ không tính từ cols và cỡ
 * thẻ: bàn co giãn theo màn hình nên tính tay là sai.
 */
const swapFrom = ref<Record<number, { dx: number; dy: number; sign: number }>>({});
watch(() => props.swap?.key, () => {
  const sw = props.swap;
  if (!sw || !grid.value) { swapFrom.value = {}; return; }
  const kids = grid.value.children;
  const ra = kids[sw.a]?.getBoundingClientRect();
  const rb = kids[sw.b]?.getBoundingClientRect();
  if (!ra || !rb) return;
  // sign ngược dấu: hai lá nghiêng ngược chiều và một lá bay TRÊN lá kia. Giữa
  // đường bay chúng gặp nhau ở cùng một điểm, cùng dáng thì trông như một lá.
  swapFrom.value = {
    [sw.a]: { dx: rb.left - ra.left, dy: rb.top - ra.top, sign: 1 },
    [sw.b]: { dx: ra.left - rb.left, dy: ra.top - rb.top, sign: -1 }
  };
});

/** Điều hướng lưới bằng bàn phím (NF-07). */
function onKeydown(e: KeyboardEvent): void {
  const deltas: Record<string, number> = {
    ArrowRight: 1, ArrowLeft: -1, ArrowDown: props.cols, ArrowUp: -props.cols
  };
  const step = deltas[e.key];
  if (step === undefined) return;
  e.preventDefault();
  const active = document.activeElement as HTMLElement | null;
  const from = Number(active?.dataset.index ?? 0);
  let to = Math.min(props.cards.length - 1, Math.max(0, from + step));
  if (props.cards[to]?.blank) {
    // Nhảy qua ô trống; nếu ra ngoài lưới thì đứng yên
    const beyond = to + step;
    if (beyond < 0 || beyond >= props.cards.length) return;
    to = beyond;
  }
  grid.value?.querySelector<HTMLElement>(`[data-index="${to}"]`)?.focus();
}

defineExpose({
  focusFirst: () => grid.value?.querySelector<HTMLElement>('.card')?.focus()
});
</script>

<template>
  <div
    ref="grid"
    class="board"
    role="grid"
    :aria-label="t('ban.aria')"
    :style="{
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.ceil(cards.length / cols)}, minmax(0, 1fr))`
    }"
    @keydown="onKeydown"
  >
    <CardTile
      v-for="card in cards"
      :key="card.index"
      :card="card"
      :back="back ?? 'stars'"
      :card-count="cards.length"
      :co-anh="coAnh"
      :face-up="faceUp.has(card.index)"
      :matched="matched.has(card.index)"
      :wrong="wrongPair.includes(card.index)"
      :peeking="revealingAll"
      :disabled="locked"
      :swap-from="swapFrom[card.index]"
      :pending="pending?.has(card.index) ?? false"
      :vua-mo="vuaMo && vuaMo.index === card.index ? { key: vuaMo.key, cuaToi: vuaMo.cuaToi !== false } : null"
      @flip="emit('flip', $event)"
    />
  </div>
</template>

<style scoped>
.board {
  /* --card-gap do useBoardFit đặt: cỡ bàn được tính với đúng khe hở này. */
  display: grid; gap: var(--card-gap, 8px); width: 100%; touch-action: manipulation;
  /* CHIỀU CAO DO KHUNG QUYẾT ĐỊNH, KHÔNG DO SỐ ĐO CỦA JS.
     computeFit tính chiều cao thẻ vừa KHÍT chỗ trống — không chừa lấy một px —
     nên chỉ cần số đo lệch một nhịp là bàn tràn ra ngoài khung: đo xong rồi
     dải người chơi mới mọc thêm chip ping / dòng "mạng có vấn đề", hay view
     online về sau số đo đầu tiên. Đúng cảnh bàn 88 thẻ online tràn xuống dưới
     thanh emoji (người chơi báo, có ảnh).
     Nay hàng là `1fr` của khung bao và bàn cao đúng 100% khung, nên thẻ CO
     THEO chỗ thật còn lại; số của JS chỉ còn quyết định BỀ RỘNG (tức dáng thẻ).
     Tràn trở thành chuyện không thể xảy ra, không phụ thuộc lúc nào đo. */
  /* Cao đúng cỡ thẻ đã tính (`--fit-h`), KHÔNG phải 100% khung: ép 100% thì chỗ
     dư biến thành lá bài dài ngoằng — trên máy tính bàn 16 thẻ ra đúng cảnh đó,
     lá cao gấp rưỡi mà khe 6px trông như dính vào nhau (đã bị báo, có ảnh).
     `max-height: 100%` giữ nguyên điều đã chốt: số đo lệch một nhịp cũng không
     tràn, vì hàng là `1fr` nên thẻ co theo chiều cao thật của khung. */
  height: var(--fit-h, 100%); max-height: 100%; max-width: 100%;
}
</style>
