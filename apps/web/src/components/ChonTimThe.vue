<script setup lang="ts">
/**
 * SỐ THẺ + ĐỘ KHÓ CỦA TÌM THẺ ngay trong màn Chơi nhanh / Đấu với máy (27.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/VSDue1KpVaC8WXysMR7iHR — "trong setup màn thì cho chọn loại thay vì cho hẳn đường đi
 * khác bên ngoài"). Thay chỗ dải số thẻ của BanChon khi Kiểu chơi = Tìm Thẻ; dòng Bộ thẻ vẫn của BanChon.
 * Lựa chọn ghi thẳng vào `mm.timThe.chon` (lib/tim-the) — màn Tìm Thẻ đọc lại lúc vào ván.
 */
import { TIM_THE_DO_KHO, TIM_THE_SO_THE, type TimTheChon } from '@/lib/tim-the';
import { t, td } from '@/lib/i18n';
import { sfx } from '@/lib/audio';
import { moChucNang } from '@/lib/phan-tich';

const props = defineProps<{ chon: TimTheChon }>();
const emit = defineEmits<{ doi: [c: TimTheChon] }>();

/** Kỷ lục chỉ có ở ván MỘT MÌNH (lib/tim-the). */

function doi(p: Partial<TimTheChon>): void {
  sfx.select();
  const moi = { ...props.chon, ...p };
  moChucNang('tim_the_chon', { so_the: moi.soThe, do_kho: moi.doKho });
  emit('doi', moi);
}
</script>

<template>
  <p class="nh-nhan">{{ t('tt.soThe') }}</p>
  <span class="ranh c5" role="radiogroup" :aria-label="t('tt.soThe')">
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
       nhiều làm ng chơi đau đầu". KHÔNG hiện kỷ lục ở đây (28.11.2026: "Kỷ lục ko để chỗ đó"). -->
</template>

<!-- Rãnh viên `.ranh` / `.nut-o`: styles/wizard.css (dùng chung với số người + số thẻ của Chơi nhanh, 28.11.2026) -->
