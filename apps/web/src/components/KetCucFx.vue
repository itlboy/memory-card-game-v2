<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sfx } from '@/lib/audio';
import { HET_HOI_MS, bocHieuUng, conLai } from '@/lib/ketcuc-fx';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';

/**
 * HIỆU ỨNG KẾT VÁN — component DUY NHẤT cho cả thắng, thua và hoà.
 *
 * Trước đây là hai component riêng (`CelebrationFx` + `DefeatFx`), nên thêm một
 * hình là thêm một file và sửa import ở hai chỗ dùng. Nay hình nằm trong sổ
 * `lib/ketcuc-fx.ts` + `styles/ketcuc-fx.css`; ở đây chỉ còn ba việc: bốc hiệu
 * ứng theo seed, dựng các lớp mà sổ khai, và lo phần TIẾNG kéo dài của màn thắng.
 *
 * Không chặn thao tác (`pointer-events: none` ở lớp bọc) — bảng kết quả hiện
 * lên phía trên và người chơi phải bấm được nút trong lúc hiệu ứng còn chạy.
 */
const props = defineProps<{
  loai: LoaiKetCuc;
  /** Seed của ván: cùng ván thì luôn ra cùng một hình, F5 không đổi. */
  seed?: number;
}>();

const hieuUng = computed(() => bocHieuUng(props.loai, props.seed ?? 7));
/*
 * HẠT BAY CÓ HẠN — hiệu ứng không được chạy mãi.
 *
 * Hiệu ứng nằm DƯỚI bảng kết quả, và bảng đó ở trên màn hình rất lâu: người
 * chơi đọc tỉ số rồi mới bấm. Mọi hạt (confetti, tia pháo, tro) đều khai
 * animation `infinite`, nên trước đây chúng quay cho tới lúc component bị gỡ —
 * `phao-hoa` là 230 phần tử cùng chạy, các hiệu ứng thua thì kèm một lớp
 * `backdrop-filter` trùm cả màn. Trên điện thoại đó là cả CPU lẫn GPU bị chiếm
 * đúng vào lúc người chơi bấm "Chơi lại", mà ngay sau cú chạm còn phải dựng một
 * bàn thẻ mới — người chơi báo "bấm chơi lại delay tới vài chục giây".
 *
 * Sau `HET_HOI_MS` chỉ giữ lớp nền (animation `forwards`, đã dừng sẵn nên gỡ
 * hạt đi không làm mất không khí kết ván).
 */
const hetHoi = ref(false);
let hoiTimer: ReturnType<typeof setTimeout> | undefined;
const lops = computed(() => {
  const tatCa = hieuUng.value.dung(props.seed ?? 7);
  return hetHoi.value ? conLai(tatCa) : tatCa;
});

/*
 * TIẾNG PHÁO HOA KÉO THÊM (chỉ màn thắng).
 *
 * `sfx.victory()` đã nổ 5 quả to trong ~3 giây đầu. Từ đó chỉ điểm nhẹ, rồi TẮT
 * HẲN ở 5,2s: bảng kết quả hiện ở 2,2s và người chơi cần đọc kết quả, bấm nút
 * trong yên tĩnh. Hình thì vẫn chạy tiếp phía sau bảng.
 */
const SOFT_START_MS = 2600;
const SOFT_EVERY_MS = 1900;
const SOFT_LEVEL = 0.18;
const SOFT_STOP_MS = 5200;
let softTimer: ReturnType<typeof setInterval> | undefined;
let startTimer: ReturnType<typeof setTimeout> | undefined;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

function imTieng(): void {
  clearInterval(softTimer);
  softTimer = undefined;
}

onMounted(() => {
  hoiTimer = setTimeout(() => { hetHoi.value = true; }, HET_HOI_MS);
  if (props.loai !== 'thang') return;
  startTimer = setTimeout(() => {
    sfx.firework(0, SOFT_LEVEL);
    softTimer = setInterval(() => sfx.firework(0, SOFT_LEVEL), SOFT_EVERY_MS);
  }, SOFT_START_MS);
  stopTimer = setTimeout(imTieng, SOFT_STOP_MS);
});

onBeforeUnmount(() => {
  clearTimeout(hoiTimer);
  clearTimeout(startTimer);
  clearTimeout(stopTimer);
  imTieng();
});
</script>

<template>
  <div class="ketcuc-fx" :data-loai="loai" :data-hieu-ung="hieuUng.id" aria-hidden="true">
    <template v-for="(l, i) in lops" :key="i">
      <i v-if="!l.con" :class="l.lop" :style="l.style" />
      <span v-else :class="l.lop" :style="l.style">
        <i v-for="(c, ci) in l.con" :key="ci" :class="c.lop" :style="c.style" />
      </span>
    </template>
  </div>
</template>
