<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/*
 * ICON BAY LƠ LỬNG sau các màn menu (13.10.2026, chủ dự án: "icon ngộ nghĩnh
 * thay đổi và di chuyển nhẹ nhàng"). Ba luật:
 *  · CHỈ ở màn menu/online — App không mount nó trong lúc chơi: bàn 88 thẻ đã
 *    là ca nặng nhất, và icon trôi cạnh bàn là thứ kéo mắt khỏi việc nhớ thẻ;
 *  · chỉ chạy `translate` + `opacity`, không `will-change` — chín lớp GPU sống
 *    mãi là đúng thứ iOS hay thả thành ô trắng (xem luật "Ô TRẮNG TRƠN");
 *  · máy bật giảm chuyển động thì đứng yên và không đổi hình.
 * Thỉnh thoảng một icon mờ đi rồi hiện lại thành hình khác — "thay đổi".
 */
const KHO = ['🐼', '🦊', '🐸', '🍓', '🍩', '🌈', '⭐', '🎈', '🐙', '🦄', '🍉', '🐣', '🍭', '🐳', '🌸', '🎲', '🍀', '🐝'];

/** Vị trí rải đều cột (%), cỡ, nhịp trôi — cố định để bố cục ổn định qua mỗi lần mở. */
const CHO = [
  { x: 8, y: 14, co: 30, nhip: 11 }, { x: 78, y: 9, co: 26, nhip: 13 },
  { x: 46, y: 22, co: 22, nhip: 9 }, { x: 88, y: 34, co: 34, nhip: 12 },
  { x: 4, y: 46, co: 28, nhip: 14 }, { x: 60, y: 52, co: 24, nhip: 10 },
  { x: 26, y: 66, co: 32, nhip: 12 }, { x: 84, y: 74, co: 26, nhip: 11 },
  { x: 12, y: 88, co: 24, nhip: 13 }
];

const tron = <T,>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((p, q) => p[0] - q[0]).map(([, v]) => v);
const hinh = ref<string[]>(tron(KHO).slice(0, CHO.length));
const tat = ref<boolean[]>(CHO.map(() => false));

let hen: ReturnType<typeof setInterval> | undefined;
function doiMot(): void {
  if (document.hidden) return;
  const i = Math.floor(Math.random() * CHO.length);
  tat.value[i] = true;
  setTimeout(() => {
    const dang = new Set(hinh.value);
    const moi = KHO.filter((e) => !dang.has(e));
    hinh.value[i] = moi[Math.floor(Math.random() * moi.length)] ?? hinh.value[i]!;
    tat.value[i] = false;
  }, 700);
}
onMounted(() => {
  if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hen = setInterval(doiMot, 2600);
});
onUnmounted(() => clearInterval(hen));
</script>

<template>
  <div class="icon-bay" aria-hidden="true">
    <span
      v-for="(c, i) in CHO" :key="i" class="ib" :class="{ tat: tat[i] }"
      :style="{ left: `${c.x}%`, top: `${c.y}%`, fontSize: `${c.co}px`, animationDuration: `${c.nhip}s`, animationDelay: `${-i * 1.7}s` }"
    >{{ hinh[i] }}</span>
  </div>
</template>

<style scoped>
/* Nằm trong #app (absolute), dưới mọi nội dung: <main>/thanh trên đứng sau trong DOM */
.icon-bay { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.ib {
  position: absolute; line-height: 1;
  opacity: var(--ib-mo, .6);
  transition: opacity .7s ease, scale .7s ease;
  animation: troi ease-in-out infinite alternate;
}
.ib.tat { opacity: 0; scale: .4; }
@keyframes troi {
  0%   { translate: 0 0; rotate: -8deg; }
  50%  { translate: 10px -14px; rotate: 6deg; }
  100% { translate: -6px 8px; rotate: -3deg; }
}
@media (prefers-reduced-motion: reduce) { .ib { animation: none; } }
</style>
