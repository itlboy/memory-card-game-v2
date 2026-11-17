<script setup lang="ts">
/**
 * NỀN + VIỀN BONG BÓNG vẽ liền một nét (lib/duong-bong.ts). Đặt làm con ĐẦU TIÊN của bong bóng;
 * bong bóng tự lo padding, KHÔNG có border/background riêng (để thì lộ hai lớp chồng nhau).
 * Màu: `--nen` (nền) và `--vien` (viền) của bong bóng. Bóng đổ: `filter: drop-shadow` ở bong
 * bóng (box-shadow không ăn theo đuôi).
 *
 * Đo khung bằng ResizeObserver: bong bóng đổi bề rộng theo chữ/emoji, đường viền phải theo.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { duongBong, type CanhDuoi } from '@/lib/duong-bong';

const props = defineProps<{ canh?: CanhDuoi; day: number; r: number; vt?: number }>();
const svg = ref<SVGSVGElement | null>(null);
const co = ref<[number, number]>([0, 0]);
let ro: ResizeObserver | undefined;

function do_(): void {
  const cha = svg.value?.parentElement;
  if (cha) co.value = [cha.offsetWidth, cha.offsetHeight];
}
onMounted(() => {
  do_();
  if (typeof ResizeObserver !== 'undefined' && svg.value?.parentElement) {
    ro = new ResizeObserver(do_);
    ro.observe(svg.value.parentElement);
  }
});
onBeforeUnmount(() => ro?.disconnect());

const d = computed(() => (co.value[0] > 0 ? duongBong(co.value[0], co.value[1], props.day, props.r, props.canh, props.vt) : ''));
</script>

<template>
  <svg ref="svg" class="khung-bong" aria-hidden="true" :width="co[0]" :height="co[1]">
    <path v-if="d" :d="d" :stroke-width="props.day" />
  </svg>
</template>

<style scoped>
/* z-index −1 trong bong bóng (bong bóng là ngữ cảnh xếp lớp riêng: fixed + z-index) → nằm dưới chữ */
.khung-bong { position: absolute; left: 0; top: 0; z-index: -1; overflow: visible; pointer-events: none; }
path { fill: var(--nen); stroke: var(--vien); stroke-linejoin: round; }
</style>
