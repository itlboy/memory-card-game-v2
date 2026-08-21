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
  /** Thứ tự chia bài lúc vào ván, cho animation so le. */
  dealOrder: number;
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
  <span v-if="card.blank" class="card blank" aria-hidden="true" />
  <button
    v-else
    class="card"
    :class="{ up: faceUp, done: matched, wrong, peek: peeking }"
    :style="{ '--deal': `${dealOrder * 28}ms` }"
    :aria-label="label"
    :aria-disabled="disabled || matched ? 'true' : 'false'"
    :data-index="card.index"
    role="gridcell"
    type="button"
    @click="!disabled && !matched && emit('flip', card.index)"
  >
    <span class="inner">
      <span class="face back" aria-hidden="true"><span class="mark">✦</span></span>
      <span class="face front" aria-hidden="true">
        {{ card.symbol }}
        <span v-if="card.power && !card.powerUsed" class="badge">{{ POWER_ICON[card.power] }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.card.blank {
  pointer-events: none; animation: none; background: transparent;
}
.card {
  position: relative; aspect-ratio: 3 / 4; min-width: 44px; min-height: 44px;
  padding: 0; border: 0; background: transparent; perspective: 700px;
  animation: deal .38s cubic-bezier(.2, .9, .3, 1.2) backwards;
  animation-delay: var(--deal, 0ms);
}
@keyframes deal {
  from { opacity: 0; transform: translateY(14px) scale(.7); }
}

.inner {
  position: absolute; inset: 0; border-radius: 12px;
  transform-style: preserve-3d;
  transition: transform .34s cubic-bezier(.3, .8, .4, 1.1);
  will-change: transform;
}
.card:not(.up):not(.done):not([aria-disabled='true']):hover .inner {
  transform: translateY(-3px) rotateZ(-1.2deg);
}
.card.up .inner, .card.done .inner { transform: rotateY(180deg); }
.card.peek .inner { transition-duration: .2s; }

.face {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; backface-visibility: hidden;
  box-shadow: var(--shadow-soft); font-size: clamp(18px, 6.5vw, 38px);
}
.back {
  background: var(--card-back);
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, .25);
}
.back .mark {
  color: rgba(255, 255, 255, .55); font-size: clamp(14px, 4.5vw, 24px);
  text-shadow: 0 1px 6px rgba(0, 0, 0, .25);
  transition: transform .3s ease;
}
.card:not(.up):not(.done):hover .back .mark { transform: rotate(90deg) scale(1.15); }

.front {
  background: var(--card-face); border: 1px solid var(--line);
  transform: rotateY(180deg);
}
.card.done { cursor: default; }
.card.done .front {
  border-color: var(--ok);
  box-shadow: inset 0 0 0 2px var(--ok), 0 0 14px color-mix(in srgb, var(--ok) 45%, transparent);
}
/* Pop khi vừa ghép đúng */
.card.done .inner { animation: pop .42s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes pop {
  0% { transform: rotateY(180deg) scale(1); }
  45% { transform: rotateY(180deg) scale(1.14); }
  100% { transform: rotateY(180deg) scale(1); }
}

.badge {
  position: absolute; top: 2px; right: 3px; font-size: 11px; line-height: 1;
  animation: twinkle 1.6s ease-in-out infinite;
}
@keyframes twinkle { 50% { transform: scale(1.25); filter: brightness(1.3); } }

.card.wrong .inner { animation: shake .32s; }
@keyframes shake {
  20% { transform: rotateY(180deg) translateX(-6px); }
  45% { transform: rotateY(180deg) translateX(5px); }
  70% { transform: rotateY(180deg) translateX(-3px); }
}
</style>
