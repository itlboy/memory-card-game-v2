<script setup lang="ts">
/**
 * SAO BĂNG — một vệt sáng rơi DỌC màn hình, đi kèm hình nền hành tinh (Premium, 25.11.2026).
 * Chủ dự án: "đừng lạm dụng quá kẻo gây khó chịu, ít thôi" → MỖI LẦN MỘT VỆT, cách nhau 25–55 giây, vệt mảnh và mờ,
 * diễn ~1 giây rồi biến mất. Không âm thanh, không chặn chạm. Người bật "giảm chuyển động" thì không có.
 * Nằm dưới mọi nội dung như IconBay (absolute trong #app, z 0).
 */
import { onMounted, onUnmounted, ref } from 'vue';

const vet = ref<{ key: number; x: number; y: number; dai: number } | null>(null);
let hen: ReturnType<typeof setTimeout> | undefined;
let so = 0;
const giam = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ban(): void {
  // Xuất phát ở nửa trên, lệch ngẫu nhiên theo chiều ngang; tab đang ẩn thì thôi (khỏi dồn hiệu ứng lúc quay lại)
  if (!document.hidden) vet.value = { key: ++so, x: 12 + Math.random() * 76, y: 4 + Math.random() * 30, dai: 70 + Math.random() * 60 };
  hen = setTimeout(ban, 25_000 + Math.random() * 30_000);
}
onMounted(() => { if (!giam) hen = setTimeout(ban, 6_000 + Math.random() * 8_000); });
onUnmounted(() => clearTimeout(hen));
</script>

<template>
  <div class="sao-bang" aria-hidden="true">
    <i v-if="vet" :key="vet.key" :style="{ left: `${vet.x}%`, top: `${vet.y}%`, height: `${vet.dai}px` }" @animationend="vet = null" />
  </div>
</template>

<style scoped>
.sao-bang { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
/* Vệt DỌC hơi nghiêng: đầu sáng ở dưới, đuôi mờ dần lên trên */
.sao-bang i {
  position: absolute; width: 2px; border-radius: 2px; transform-origin: top center;
  background: linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, .85));
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, .7));
  animation: roi 1.05s ease-in forwards;
}
@keyframes roi {
  0% { opacity: 0; transform: rotate(14deg) translateY(-40px) scaleY(.3); }
  18% { opacity: .9; }
  100% { opacity: 0; transform: rotate(14deg) translateY(46vh) scaleY(1); }
}
</style>
