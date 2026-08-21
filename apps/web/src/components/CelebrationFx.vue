<script setup lang="ts">
import { computed } from 'vue';

/**
 * Màn ăn mừng toàn màn hình: pháo hoa + confetti — chạy TRƯỚC khi popup kết quả
 * hiện ra (và tiếp tục phía sau popup). Không chặn thao tác (pointer-events none).
 */
const props = defineProps<{ seed?: number }>();

const FW_COLORS = ['#ffd54a', '#ff7b72', '#7ce38b', '#79c0ff', '#d2a8ff', '#ff9ff3'];
const CONFETTI_COLORS = ['#6a5cff', '#c44cf0', '#ea8c00', '#0ea371', '#e5484d', '#38bdf8'];
const base = computed(() => props.seed ?? 7);

/** 8 vụ pháo hoa rải trong ~5.5 giây — phủ trọn khoảng chờ trước popup. */
const fireworks = computed(() => Array.from({ length: 8 }, (_, b) => {
  const baseDelay = 0.15 + b * 0.7;
  const color = FW_COLORS[(b * 2 + base.value) % FW_COLORS.length]!;
  return {
    left: `${10 + ((b * 37 + base.value * 13) % 80)}%`,
    top: `${8 + ((b * 23 + base.value * 7) % 45)}%`,
    flashDelay: `${baseDelay}s`,
    sparks: Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 60 + (i % 3) * 28;
      return {
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist + 30}px`,
        delay: `${baseDelay}s`,
        dur: `${0.85 + (i % 4) * 0.12}s`,
        color: i % 5 === 0 ? '#ffffff' : color
      };
    })
  };
}));

const confetti = computed(() => Array.from({ length: 70 }, (_, i) => ({
  left: `${(i * 37 + base.value) % 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  animationDelay: `${(i % 14) * 160}ms`,
  animationDuration: `${2400 + (i % 7) * 300}ms`,
  '--drift': `${((i * 13) % 9) - 4}rem`,
  '--spin': `${420 + (i * 47) % 400}deg`
})));
</script>

<template>
  <div class="celebration" aria-hidden="true">
    <i v-for="(c, i) in confetti" :key="`c${i}`" class="paper" :style="c" />
    <span v-for="(b, bi) in fireworks" :key="`b${bi}`" class="burst" :style="{ left: b.left, top: b.top }">
      <i
        v-for="(sp, si) in b.sparks" :key="si"
        :style="{
          '--dx': sp.dx, '--dy': sp.dy, background: sp.color,
          animationDelay: sp.delay, animationDuration: sp.dur
        }"
      />
      <b :style="{ animationDelay: b.flashDelay }" />
    </span>
  </div>
</template>

<style scoped>
.celebration { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 9; }
.paper {
  position: absolute; top: -3vh; width: 8px; height: 14px; border-radius: 2px;
  animation: fall linear forwards;
}
@keyframes fall {
  to { transform: translateY(105vh) translateX(var(--drift, 0)) rotate(var(--spin, 540deg)); opacity: .2; }
}
.burst { position: absolute; }
.burst i {
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  opacity: 0; box-shadow: 0 0 8px currentColor;
  animation-name: fw-spark; animation-timing-function: cubic-bezier(.1, .7, .4, 1);
  animation-fill-mode: forwards;
}
.burst b {
  position: absolute; width: 14px; height: 14px; border-radius: 50%;
  left: -7px; top: -7px; background: #fff; opacity: 0;
  box-shadow: 0 0 30px 14px rgba(255, 255, 255, .85);
  animation: fw-flash .35s ease-out forwards;
}
@keyframes fw-spark {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  75% { opacity: .95; }
  100% { transform: translate(var(--dx), var(--dy)) scale(.35); opacity: 0; }
}
@keyframes fw-flash {
  0% { transform: scale(.3); opacity: 1; }
  100% { transform: scale(2.4); opacity: 0; }
}
</style>
