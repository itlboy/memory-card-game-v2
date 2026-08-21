<script setup lang="ts">
import type { Card } from '@mm/engine';
import { computed } from 'vue';

const props = defineProps<{
  card: Card;
  faceUp: boolean;
  matched: boolean;
  wrong: boolean;
  /** Đang được thẻ mắt thần / Peek hé mở, không phải do người chơi lật. */
  peeking: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{ flip: [index: number] }>();

const POWER_ICON: Record<string, string> = { bomb: '💥', x2: '✖️', eye: '👁️', freeze: '❄️' };

const label = computed(() => {
  const pos = `Thẻ ${props.card.index + 1}`;
  if (props.matched) return `${pos}, ${props.card.symbol}, đã ghép đúng`;
  if (props.faceUp) return `${pos}, ${props.card.symbol}`;
  return `${pos}, chưa mở`;
});
</script>

<template>
  <button
    class="card"
    :class="{ up: faceUp, done: matched, wrong, peek: peeking }"
    :aria-label="label"
    :aria-disabled="disabled || matched ? 'true' : 'false'"
    :data-index="card.index"
    role="gridcell"
    type="button"
    @click="!disabled && !matched && emit('flip', card.index)"
  >
    <span class="inner">
      <span class="face back" aria-hidden="true">?</span>
      <span class="face front" aria-hidden="true">
        {{ card.symbol }}
        <span v-if="card.power && !card.powerUsed" class="badge">{{ POWER_ICON[card.power] }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.card {
  position: relative; aspect-ratio: 3 / 4; min-width: 44px; min-height: 44px;
  padding: 0; border: 0; background: transparent; perspective: 700px;
}
.inner {
  position: absolute; inset: 0; border-radius: 12px;
  transform-style: preserve-3d; transition: transform .32s ease; will-change: transform;
}
.card.up .inner, .card.done .inner { transform: rotateY(180deg); }
.card.peek .inner { transition-duration: .2s; }

.face {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; backface-visibility: hidden;
  box-shadow: var(--shadow); font-size: clamp(18px, 6.5vw, 38px);
}
.back { background: var(--card-back); color: rgba(255, 255, 255, .75); font-weight: 700; }
.front {
  background: var(--card-face); border: 1px solid var(--line);
  transform: rotateY(180deg);
}
.card.done { cursor: default; }
.card.done .front { border-color: var(--ok); box-shadow: inset 0 0 0 2px var(--ok); }

.badge {
  position: absolute; top: 2px; right: 3px; font-size: 11px; line-height: 1;
}
.card.wrong .inner { animation: shake .3s; }
@keyframes shake {
  25% { transform: rotateY(180deg) translateX(-5px); }
  75% { transform: rotateY(180deg) translateX(5px); }
}
</style>
