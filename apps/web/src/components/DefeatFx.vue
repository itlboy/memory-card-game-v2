<script setup lang="ts">
import { computed } from 'vue';

/**
 * Màn THUA toàn màn hình — đối trọng của `CelebrationFx`.
 *
 * Trước đây thua chỉ có TIẾNG (`sfx.defeat()`), còn hình thì y hệt một ván
 * đang chơi dở: bàn đứng im rồi bảng tỉ số hiện ra. Thắng thì pháo hoa rợp
 * trời. Hai kết cục đọc ra khác hẳn nhau ở tai mà giống hệt nhau ở mắt, nên
 * người thua không có khoảnh khắc nào để hiểu "xong rồi, mình thua".
 *
 * Cố ý làm NGƯỢC mọi thứ của màn ăn mừng, để không lẫn được:
 *   pháo hoa bắn LÊN, sáng, nhiều màu  ↔  tro rơi XUỐNG, xám, một màu
 *   confetti xoay tít, nhanh            ↔  tàn tro trôi chậm, lệch dần
 *   nền bừng sáng                       ↔  nền tối dần từ mép vào
 *
 * Không chặn thao tác (`pointer-events: none`) và không phát tiếng — tiếng đã
 * do `sfx.defeat()` lo, chồng thêm chỉ làm ồn.
 */
const props = defineProps<{ seed?: number }>();
const base = computed(() => props.seed ?? 3);

/** Tàn tro: chậm, xám, trôi lệch — 34 hạt là đủ dày mà không nặng máy yếu. */
const tro = computed(() => Array.from({ length: 34 }, (_, i) => {
  const n = i * 29 + base.value * 11;
  return {
    left: `${n % 100}%`,
    width: `${3 + (i % 3)}px`,
    height: `${3 + (i % 3)}px`,
    opacity: 0.18 + ((i % 5) * 0.07),
    animationDelay: `${(i % 12) * 210}ms`,
    animationDuration: `${3400 + (i % 6) * 520}ms`,
    '--troi': `${((i * 7) % 7) - 3}rem`
  };
}));
</script>

<template>
  <div class="defeat-fx" aria-hidden="true">
    <div class="toi" />
    <i v-for="(t, i) in tro" :key="i" class="tan" :style="t" />
  </div>
</template>

<style scoped>
.defeat-fx {
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow: hidden;
  pointer-events: none;
}

/* Tối dần TỪ MÉP VÀO — ngược với kiểu bừng sáng của màn ăn mừng, và không che
   mất bàn thẻ ở giữa (người thua vẫn muốn nhìn lại bàn). */
.toi {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center,
    rgb(0 0 0 / 0%) 38%, rgb(8 10 20 / 42%) 78%, rgb(6 8 16 / 68%) 100%);
  opacity: 0;
  animation: toi-dan 1.6s ease-out forwards;
}

.tan {
  position: absolute;
  top: -6%;
  border-radius: 50%;
  background: #97a1b8;
  animation-name: tro-roi;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes toi-dan { to { opacity: 1; } }

@keyframes tro-roi {
  from { transform: translate3d(0, -10vh, 0); }
  to   { transform: translate3d(var(--troi), 108vh, 0); }
}

/* Đứng im hẳn thì thà không có gì: giữ lớp tối, bỏ hạt rơi. */
@media (prefers-reduced-motion: reduce) {
  .tan { display: none; }
  .toi { animation-duration: 0.01ms; }
}
</style>
