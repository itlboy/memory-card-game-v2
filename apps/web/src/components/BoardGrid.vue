<script setup lang="ts">
import type { Card } from '@mm/engine';
import { ref, watch } from 'vue';
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
}>();

const emit = defineEmits<{ flip: [index: number] }>();
const grid = ref<HTMLElement | null>(null);

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
    aria-label="Bàn thẻ"
    :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    @keydown="onKeydown"
  >
    <CardTile
      v-for="card in cards"
      :key="card.index"
      :card="card"
      :back="back ?? 'stars'"
      :deal-order="card.index"
      :card-count="cards.length"
      :face-up="faceUp.has(card.index)"
      :matched="matched.has(card.index)"
      :wrong="wrongPair.includes(card.index)"
      :peeking="revealingAll"
      :disabled="locked"
      :swap-from="swapFrom[card.index]"
      @flip="emit('flip', $event)"
    />
  </div>
</template>

<style scoped>
.board {
  display: grid; gap: 8px; width: 100%; touch-action: manipulation;
}
@media (max-width: 420px) { .board { gap: 6px; } }
</style>
