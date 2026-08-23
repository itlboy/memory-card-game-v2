<script setup lang="ts">
import type { Card } from '@mm/engine';
import { computed } from 'vue';
import { dealStep } from '@/lib/timing';

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
  /** Tổng số thẻ — dùng để nén độ so le cho bàn lớn. */
  cardCount?: number;
  /** Chỗ CŨ của lá bài này so với chỗ mới, khi vừa bị thẻ tráo đổi hoán chỗ.
   *  Animation chạy từ đó về 0 nên mắt thấy nó bay sang chỗ mới. */
  swapFrom?: { dx: number; dy: number; sign: number };
  /** Đã bấm, đang chờ server xác nhận (ván online). */
  pending?: boolean;
  /** Kiểu mặt sau của ván này: stars | diamond | aurora. */
  back: string;
}>();

const emit = defineEmits<{ flip: [index: number] }>();

const POWER_ICON: Record<string, string> = { bomb: '💥', swap: '🔀', x2: '✖️', eye: '👁️', freeze: '❄️' };

/** Nhịp lấy từ lib/timing để TIẾNG chia bài dứt đúng lúc thẻ cuối bay vào. */
const dealStagger = computed(() => Math.round(props.dealOrder * dealStep(props.cardCount ?? 16)));

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
    :class="{ up: faceUp, done: matched, wrong, peek: peeking, swapping: !!swapFrom, pending }"
    :style="{
      '--deal': `${dealStagger}ms`,
      ...(swapFrom ? {
        '--sx': `${swapFrom.dx}px`,
        '--sy': `${swapFrom.dy}px`,
        '--sr': `${swapFrom.sign * 7}deg`,
        zIndex: swapFrom.sign > 0 ? 7 : 6
      } : {})
    }"
    :aria-label="label"
    :aria-disabled="disabled || matched ? 'true' : 'false'"
    :data-index="card.index"
    role="gridcell"
    type="button"
    @click="!disabled && !matched && emit('flip', card.index)"
  >
    <span class="inner">
      <span class="face back" :class="`bk-${back}`" aria-hidden="true"></span>
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
  /* Tỉ lệ do bàn quyết định (đo chỗ còn lại): 3:4 khi đủ chỗ, cao dần tới 5:8
     để lấp chiều cao dư trên màn dọc. */
  position: relative; aspect-ratio: var(--card-ar, 3 / 4); min-width: 44px; min-height: 44px;
  padding: 0; border: 0; background: transparent; perspective: 700px;
  animation: deal .38s cubic-bezier(.2, .9, .3, 1.2) backwards;
  animation-delay: var(--deal, 0ms);
  /* Container query: nội dung thẻ to theo kích thước THẺ, không theo viewport —
     bàn 2×2 thẻ to thì biểu tượng cũng to tương ứng */
  container-type: inline-size;
}
@keyframes deal {
  from { opacity: 0; transform: translateY(14px) scale(.7); }
}

.inner {
  position: absolute; inset: 0; border-radius: 12px;
  transform-style: preserve-3d;
  transition: transform .34s cubic-bezier(.3, .8, .4, 1.1);
}
@media (hover: hover) {
.card:not(.up):not(.done):not([aria-disabled='true']):hover .inner {
  transform: translateY(-3px) rotateZ(-1.2deg);
}
}
.card.up .inner, .card.done .inner { transform: rotateY(180deg); }
/**
 * Đã bấm, đang chờ server: lật tới ĐÚNG 90 độ — cạnh thẻ, chưa thấy mặt nào.
 * Vì sao dừng ở 90: server chưa gửi biểu tượng (thẻ úp không bao giờ có symbol
 * trong payload — NF-04), nên lật quá 90 là phải bịa ra một mặt. Dừng ở cạnh
 * thì bấm là thấy thẻ động ngay, và khi view về thì nó lật nốt liền mạch.
 */
.card.pending:not(.up):not(.done) .inner { transform: rotateY(90deg); }
.card.peek .inner { transition-duration: .2s; }

.face {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; backface-visibility: hidden;
  box-shadow: var(--shadow-soft);
  /* Biểu tượng ~58% bề rộng thẻ — thẻ to là chữ to theo */
  font-size: max(20px, 55cqw);
}
.back {
  overflow: hidden;
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, .3),
    inset 0 0 0 2px rgba(255, 255, 255, .12);
}
/* 3 mặt sau — mỗi ván bốc ngẫu nhiên một kiểu, cả bàn dùng chung
   (mặt sau PHẢI giống hệt nhau, khác đi là "đánh dấu bài") */
.back.bk-stars {
  background:
    url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22%3E %3Cg fill=%22rgba(255,255,255,0.9)%22 transform=%22translate(38,54) scale(1.05)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.55)%22 transform=%22translate(14,14) scale(0.5)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.35)%22 transform=%22translate(72,20) scale(0.34)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.6)%22 transform=%22translate(76,96) scale(0.44)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.4)%22 transform=%22translate(16,100) scale(0.3)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.3)%22 transform=%22translate(52,16) scale(0.26)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3Cg fill=%22rgba(255,255,255,0.45)%22 transform=%22translate(10,60) scale(0.36)%22%3E%3Cpath d=%22M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z%22/%3E%3C/g%3E %3C/svg%3E") center / 100% 100% no-repeat,
    radial-gradient(circle at 30% 18%, rgba(255, 255, 255, .22), transparent 45%),
    linear-gradient(160deg, #4c3fd6 0%, #7b46e6 55%, #b74cf0 100%);
}
.back.bk-diamond {
  background:
    url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22%3E %3Cdefs%3E%3Cpattern id=%22dm%22 width=%2220%22 height=%2220%22 patternUnits=%22userSpaceOnUse%22 patternTransform=%22rotate(45)%22%3E %3Cpath d=%22M0 10 H20 M10 0 V20%22 stroke=%22rgba(255,255,255,0.22)%22 stroke-width=%221.4%22 fill=%22none%22/%3E %3C/pattern%3E%3C/defs%3E %3Crect width=%22100%22 height=%22133%22 fill=%22url(%23dm)%22/%3E %3Cg transform=%22translate(50,66.5)%22%3E %3Crect x=%22-17%22 y=%22-17%22 width=%2234%22 height=%2234%22 transform=%22rotate(45)%22 fill=%22rgba(255,255,255,0.14)%22 stroke=%22rgba(255,255,255,0.85)%22 stroke-width=%222%22/%3E %3Crect x=%22-10%22 y=%22-10%22 width=%2220%22 height=%2220%22 transform=%22rotate(45)%22 fill=%22rgba(255,255,255,0.9)%22/%3E %3C/g%3E%3C/svg%3E") center / 100% 100% no-repeat,
    linear-gradient(180deg, #5a4be0 0%, #6a5cff 100%);
  box-shadow: var(--shadow-soft), inset 0 0 0 2px rgba(255, 255, 255, .5),
    inset 0 0 0 5px rgba(255, 255, 255, .18);
}
.back.bk-aurora {
  background:
    url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22 preserveAspectRatio=%22none%22%3E %3Cpath d=%22M0 92 C 22 76, 40 108, 62 88 S 96 70, 100 84 L100 133 L0 133 Z%22 fill=%22rgba(56,189,248,0.5)%22/%3E %3Cpath d=%22M0 104 C 26 92, 46 120, 70 102 S 100 90, 100 100 L100 133 L0 133 Z%22 fill=%22rgba(196,76,240,0.55)%22/%3E %3Cpath d=%22M0 118 C 30 108, 52 130, 78 116 S 100 108, 100 114 L100 133 L0 133 Z%22 fill=%22rgba(255,255,255,0.2)%22/%3E %3Ccircle cx=%2226%22 cy=%2230%22 r=%221.6%22 fill=%22rgba(255,255,255,0.9)%22/%3E %3Ccircle cx=%2270%22 cy=%2218%22 r=%221.1%22 fill=%22rgba(255,255,255,0.7)%22/%3E %3Ccircle cx=%2252%22 cy=%2244%22 r=%221.3%22 fill=%22rgba(255,255,255,0.8)%22/%3E %3Ccircle cx=%2284%22 cy=%2252%22 r=%221%22 fill=%22rgba(255,255,255,0.6)%22/%3E %3C/svg%3E") center / 100% 100% no-repeat,
    radial-gradient(circle at 72% 12%, rgba(255, 255, 255, .16), transparent 40%),
    linear-gradient(185deg, #241c6e 0%, #4c3fd6 62%, #7b46e6 100%);
}
/* Vệt sáng lướt ngang khi hover */
.back::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 38%, rgba(255, 255, 255, .28) 50%, transparent 62%);
  transform: translateX(-110%);
}
@media (hover: hover) {
.card:not(.up):not(.done):hover .back::after { animation: shine .6s ease; }
}
@keyframes shine { to { transform: translateX(110%); } }
.front {
  background:
    radial-gradient(circle at 50% 58%, var(--accent-soft), transparent 62%),
    var(--card-face);
  border: 1px solid var(--line);
  transform: rotateY(180deg);
  box-shadow: var(--shadow-soft), var(--inner-light);
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
@keyframes twinkle { 50% { transform: scale(1.25); opacity: .8; } }

/* Tráo đổi: lá bài bắt đầu ở CHỖ CŨ rồi bay về chỗ mới, hơi nâng lên và nghiêng
   để hai lá thấy rõ là đang đổi chỗ nhau chứ không phải trôi đi đâu. z-index để
   nó bay TRÊN các thẻ khác thay vì bị che. */
.card.swapping { animation: swap-move .58s cubic-bezier(.35, .85, .3, 1); }
@keyframes swap-move {
  from { transform: translate(var(--sx, 0), var(--sy, 0)) scale(1); }
  45%  { transform: translate(calc(var(--sx, 0) * .5), calc(var(--sy, 0) * .5)) scale(1.1) rotate(var(--sr, 7deg)); }
  to   { transform: translate(0, 0) scale(1) rotate(0); }
}

.card.wrong .inner { animation: shake .32s; }
@keyframes shake {
  20% { transform: rotateY(180deg) translateX(-6px); }
  45% { transform: rotateY(180deg) translateX(5px); }
  70% { transform: rotateY(180deg) translateX(-3px); }
}
</style>
