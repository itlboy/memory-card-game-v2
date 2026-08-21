<script setup lang="ts">
import type { Card } from '@mm/engine';
import { ref } from 'vue';
import CardTile from './CardTile.vue';

const props = defineProps<{
  cards: Card[];
  cols: number;
  faceUp: Set<number>;
  matched: Set<number>;
  wrongPair: number[];
  revealingAll: boolean;
  locked: boolean;
}>();

const emit = defineEmits<{ flip: [index: number] }>();
const grid = ref<HTMLElement | null>(null);

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
  const to = Math.min(props.cards.length - 1, Math.max(0, from + step));
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
      :face-up="faceUp.has(card.index)"
      :matched="matched.has(card.index)"
      :wrong="wrongPair.includes(card.index)"
      :peeking="revealingAll"
      :disabled="locked"
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
