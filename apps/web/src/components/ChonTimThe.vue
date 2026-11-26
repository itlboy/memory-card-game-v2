<script setup lang="ts">
/**
 * SỐ THẺ + ĐỘ KHÓ CỦA TÌM THẺ ngay trong màn Chơi nhanh / Đấu với máy (27.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/VSDue1KpVaC8WXysMR7iHR — "trong setup màn thì cho chọn loại thay vì cho hẳn đường đi
 * khác bên ngoài"). Thay chỗ dải số thẻ của BanChon khi Kiểu chơi = Tìm Thẻ; dòng Bộ thẻ vẫn của BanChon.
 * Lựa chọn ghi thẳng vào `mm.timThe.chon` (lib/tim-the) — màn Tìm Thẻ đọc lại lúc vào ván.
 */
import { computed } from 'vue';
import { TIM_THE_DO_KHO, TIM_THE_SO_THE, docKyLuc, type TimTheChon } from '@/lib/tim-the';
import { t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import { sfx } from '@/lib/audio';
import { Trophy } from 'lucide-vue-next';

const props = defineProps<{ chon: TimTheChon }>();
const emit = defineEmits<{ doi: [c: TimTheChon] }>();

/** Kỷ lục chỉ có ở ván MỘT MÌNH (lib/tim-the). */
const kyLuc = computed(() => (props.chon.doiThu === 'mot' ? docKyLuc(props.chon.soThe, props.chon.doKho) : 0));

function doi(p: Partial<TimTheChon>): void {
  sfx.select();
  emit('doi', { ...props.chon, ...p });
}
</script>

<template>
  <p class="nh-nhan">{{ t('tt.soThe') }}</p>
  <span class="ranh c6" role="radiogroup" :aria-label="t('tt.soThe')">
    <button
      v-for="n in TIM_THE_SO_THE" :key="n" class="nut-o thach th-nho th-chon" type="button" role="radio"
      :aria-checked="chon.soThe === n" :aria-label="t('tt.the', { n })" @click="doi({ soThe: n })"
    ><b>{{ n }}</b></button>
  </span>
  <p class="nh-nhan">{{ t('tt.doKho') }}</p>
  <span class="ranh c3" role="radiogroup" :aria-label="t('tt.doKho')">
    <button
      v-for="k in TIM_THE_DO_KHO" :key="k" class="nut-o thach th-nho th-chon" type="button" role="radio"
      :aria-checked="chon.doKho === k" @click="doi({ doKho: k })"
    ><b>{{ td(`tt.${k}`) }}</b></button>
  </span>
  <!-- KHÔNG ghi thông số (giây xem / giây chọn / số lượt) — chủ dự án 27.11.2026: "Ko cần hiện các thông số kỹ thuật
       nhiều làm ng chơi đau đầu". Chỉ còn kỷ lục khi có. -->
  <p v-if="kyLuc" class="tt-tom"><Trophy :size="14" :stroke-width="2.6" class="ic" aria-hidden="true" /> <b>{{ num(kyLuc) }}</b></p>
</template>

<style scoped>
/* Rãnh viên thạch — cùng chất với màn Tìm Thẻ cũ (TimThe.vue) */
.ranh {
  flex: none; display: grid; gap: 2px; padding: 3px; border-radius: 999px;
  background: var(--k-mem, var(--panel-soft)); border: 2px solid var(--t3, var(--line));
  box-shadow: inset 0 2px 4px rgba(29, 42, 90, .14);
}
.ranh.c6 { grid-template-columns: repeat(6, 1fr); }
.ranh.c3 { grid-template-columns: repeat(3, 1fr); }
.nut-o {
  position: relative; display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 4px; min-width: 0;
  border: 1.5px solid transparent; border-radius: 999px; background: none; color: var(--fg); font: inherit; cursor: pointer;
}
.nut-o[aria-checked='true'] {
  border-color: #33861a; color: #fff; background: linear-gradient(#a3ec72 -40%, #46ad22 70%); text-shadow: 0 1px 0 #23600f;
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .45), 0 2px 0 #33861a, 0 3px 5px rgba(10, 20, 60, .18);
}
.nut-o b { font-family: var(--font-display); font-size: 18px; font-weight: 800; }
.tt-tom { flex: none; margin: 0; text-align: center; font-size: 13.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tt-tom b { color: var(--fg); }
.ic { vertical-align: -2px; }
/* Màn thấp (iPhone SE…): Đấu với máy + Tìm Thẻ có thêm hai hàng — gọn lại để Bắt đầu không lọt khỏi màn (KHÔNG SCROLL) */
@media (max-height: 700px) {
  .nut-o { min-height: 38px; }
  .tt-tom { display: none; }
}
</style>
