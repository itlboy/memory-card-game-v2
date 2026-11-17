<script setup lang="ts">
/**
 * ĐUÔI BONG BÓNG DÙNG CHUNG (18.11.2026, chủ dự án: "làm lại bong bóng chat cho tử tế").
 *
 * Hai bản trước đều hỏng ở chỗ nối: ô vuông xoay 45° lộ thành con thoi; hai tam giác clip-path
 * chồng nhau thì cạnh xiên mỏng hơn viền thân (chênh nhau rõ) và mũi nhọn hoắt. Nay vẽ bằng SVG:
 *  - một nét (stroke) đúng bằng độ dày viền thân → viền đều từ thân xuống tới mũi;
 *  - mũi bo tròn (stroke-linejoin: round), hai cạnh hơi lõm như bong bóng truyện tranh;
 *  - lớp nền phủ lên đoạn viền thân nằm trong miệng đuôi → đuôi liền thân.
 * Bóng đổ: thân phải dùng `filter: drop-shadow` (box-shadow không ăn theo đuôi).
 *
 * Màu lấy từ biến CSS của thân: `--nen` (màu nền) và `--vien` (màu viền).
 * Vị trí theo hướng: `xuong` (dưới thân), `len` (trên thân), `trai` (bên trái thân) — cha tự đặt
 * vị trí dọc cạnh (left / top) qua class gốc `.duoi-bong`.
 */
import { computed } from 'vue';

const props = withDefaults(defineProps<{ huong: 'xuong' | 'len' | 'trai'; day: number; rong?: number; cao?: number }>(), {
  rong: 20, cao: 12,
});

const hinh = computed(() => {
  const { huong, day, rong: W, cao } = props;
  const c = day / 2, H = cao + day * 2, m = W / 2;
  const g = c - day * 0.4;   // điểm bắt đầu hơi lùi vào trong viền thân: góc bo của thân cũng không lòi mấu
  const p = (u: number, v: number) => (huong === 'xuong' ? [u, v] : huong === 'len' ? [u, H - v] : [H - v, u]);
  const P = (u: number, v: number) => p(u, v).map((n) => +n.toFixed(2)).join(' ');
  const than = `Q${P(m * 0.62, c + cao * 0.42)} ${P(m, c + cao)} Q${P(W - m * 0.62, c + cao * 0.42)} ${P(W, g)}`;
  const [w, h] = huong === 'trai' ? [H, W] : [W, H];
  return { w, h, vien: `M${P(0, g)} ${than}`, nen: `M${P(0, -1.5)} L${P(0, g)} ${than} L${P(W, -1.5)} Z` };
});
</script>

<template>
  <svg
    class="duoi-bong" :class="props.huong" aria-hidden="true"
    :width="hinh.w" :height="hinh.h" :viewBox="`0 0 ${hinh.w} ${hinh.h}`"
  >
    <path :d="hinh.nen" class="n" />
    <path :d="hinh.vien" class="v" :stroke-width="props.day" />
  </svg>
</template>

<style scoped>
.duoi-bong { position: absolute; overflow: visible; pointer-events: none; }
/* top/bottom/right: 100% = mép TRONG của viền thân (khối chứa absolute là padding box) */
.xuong { top: 100%; }
.len { bottom: 100%; }
.trai { right: 100%; }
.n { fill: var(--nen); }
.v { fill: none; stroke: var(--vien); stroke-linejoin: round; stroke-linecap: round; }
</style>
