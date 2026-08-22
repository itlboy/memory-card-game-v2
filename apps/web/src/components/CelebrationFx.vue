<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { sfx } from '@/lib/audio';

/**
 * Màn ăn mừng toàn màn hình: pháo hoa + confetti — chạy TRƯỚC khi popup kết quả
 * hiện ra (và tiếp tục phía sau popup). Không chặn thao tác (pointer-events none).
 */
const props = defineProps<{ seed?: number }>();

const FW_COLORS = ['#ffd54a', '#ff7b72', '#7ce38b', '#79c0ff', '#d2a8ff', '#ff9ff3'];
const CONFETTI_COLORS = ['#6a5cff', '#c44cf0', '#ea8c00', '#0ea371', '#e5484d', '#38bdf8'];
const base = computed(() => props.seed ?? 7);

// Hình thì lặp mãi, nhưng TIẾNG phải lùi về sau: sfx.victory() đã nổ 5 quả to
// trong ~3 giây đầu; từ đó trở đi chỉ điểm nhẹ để người chơi còn nghe được tiếng
// bấm nút trên bảng kết quả.
const SOFT_START_MS = 4000;
const SOFT_EVERY_MS = 1900;
const SOFT_LEVEL = 0.18;
/** Bảng kết quả hiện ở 5s (App.vue và OnlineScreen.vue), cho tiếng kéo thêm 2
 *  giây rồi TẮT HẲN — người chơi cần đọc kết quả và bấm nút trong yên tĩnh.
 *  Hình thì vẫn chạy tiếp. */
const SOFT_STOP_MS = 7000;
let softTimer: ReturnType<typeof setInterval> | undefined;
let startTimer: ReturnType<typeof setTimeout> | undefined;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

function hushSound(): void {
  clearInterval(softTimer);
  softTimer = undefined;
}

onMounted(() => {
  startTimer = setTimeout(() => {
    sfx.firework(0, SOFT_LEVEL);
    softTimer = setInterval(() => sfx.firework(0, SOFT_LEVEL), SOFT_EVERY_MS);
  }, SOFT_START_MS);
  stopTimer = setTimeout(hushSound, SOFT_STOP_MS);
});
onBeforeUnmount(() => {
  clearTimeout(startTimer);
  clearTimeout(stopTimer);
  hushSound();
});

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
          animationDelay: sp.delay, animationDuration: 'var(--fw-cycle)'
        }"
      />
      <b :style="{ animationDelay: b.flashDelay }" />
    </span>
  </div>
</template>

<style scoped>
.celebration {
  position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 9;
  /* Chu kỳ của một vụ pháo hoa: nổ ở đầu rồi nghỉ hết chu kỳ. 8 vụ lệch nhau
     0,7s nên trong 5,6s luôn có vụ đang nổ, không bị khoảng lặng. */
  --fw-cycle: 5.6s;
}
.paper {
  position: absolute; top: -3vh; width: 8px; height: 14px; border-radius: 2px;
  /* LẶP MÃI: bảng kết quả hiện sau 5 giây, mà hiệu ứng chạy một lượt rồi tắt
     thì đúng lúc người chơi xem kết quả lại chẳng còn gì để ăn mừng. */
  animation: fall linear infinite;
}
@keyframes fall {
  to { transform: translateY(105vh) translateX(var(--drift, 0)) rotate(var(--spin, 540deg)); opacity: .2; }
}
.burst { position: absolute; }
.burst i {
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  opacity: 0; box-shadow: 0 0 8px currentColor;
  animation-name: fw-spark; animation-timing-function: cubic-bezier(.1, .7, .4, 1);
  animation-fill-mode: forwards; animation-iteration-count: infinite;
}
.burst b {
  position: absolute; width: 14px; height: 14px; border-radius: 50%;
  left: -7px; top: -7px; background: #fff; opacity: 0;
  box-shadow: 0 0 30px 14px rgba(255, 255, 255, .85);
  animation: fw-flash var(--fw-cycle) ease-out infinite;
}
/* Nổ trong ~16% đầu chu kỳ rồi nghỉ: để nguyên 0→100% mà lặp thì pháo hoa
   nổ liên tục mỗi 0,9 giây, thành ra như đèn nháy chứ không phải pháo hoa. */
@keyframes fw-spark {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  12% { opacity: .95; }
  16% { transform: translate(var(--dx), var(--dy)) scale(.35); opacity: 0; }
  100% { transform: translate(var(--dx), var(--dy)) scale(.35); opacity: 0; }
}
@keyframes fw-flash {
  0% { transform: scale(.3); opacity: 1; }
  6% { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
</style>
