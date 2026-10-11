<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sfx } from '@/lib/audio';
import { BoHat, chayCanh, chonCanh, cauTreu, dongAnUi, TEN_CANH } from '@/lib/ketcuc-fx';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';
import { rung } from '@/lib/rung';
import MatBot from './MatBot.vue';

/**
 * HIỆU ỨNG KẾT VÁN — component DUY NHẤT cho mọi kết cục (xem `lib/ketcuc-fx.ts`).
 *
 * Phần CHỮ (CHIẾN THẮNG, THUA RỒI, HOÀ, băng kỷ lục, máy trêu) là DOM + CSS có
 * delay; phần CHUYỂN ĐỘNG (hạt, lá bài gợn/rơi, rung màn) do `chayCanh` lo.
 * Nằm ở z 9, DƯỚI bảng kết quả (10), không chặn chạm.
 */
const props = defineProps<{
  loai: LoaiKetCuc;
  /** Giữ để tương thích chỗ gọi; cảnh mới không bốc theo seed. */
  seed?: number;
  /** Ván vừa phá kỷ lục → cảnh kỷ lục (băng vàng + pháo hoa). */
  kyLuc?: boolean;
  /** Mặt máy vừa THẮNG mình (đấu máy) → cảnh máy trêu. */
  matMay?: string | null;
}>();

const canh = computed(() => chonCanh(props.loai, { kyLuc: props.kyLuc, matMay: props.matMay }));
const cv = ref<HTMLCanvasElement | null>(null);
/** Số cặp còn úp lúc thua — đếm từ DOM bàn thẻ, đúng cho cả offline lẫn online. */
const capConLai = ref(0);
let don: (() => void) | undefined;

onMounted(() => {
  capConLai.value = Math.floor(document.querySelectorAll('.board button.card:not(.done)').length / 2);
  if (canh.value === 'ky-luc') sfx.kyLuc();
  if (!cv.value) return;
  const giam = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  don = chayCanh(canh.value, {
    hat: new BoHat(cv.value),
    la: () => [...document.querySelectorAll<HTMLElement>('.board button.card')],
    ban: () => document.querySelector<HTMLElement>('.board'),
    man: () => document.getElementById('app'),
    rung: (n) => (n <= 1 ? rung.sai() : rung.ghep(n)),
    giamChuyenDong: giam
  });
});
onBeforeUnmount(() => don?.());
</script>

<template>
  <div class="ketcuc-fx" :data-loai="loai" :data-canh="canh" :aria-label="TEN_CANH[canh]" aria-hidden="true">
    <canvas ref="cv" class="fx-hat" />

    <template v-if="canh === 'thang' || canh === 'ky-luc'">
      <div class="fx-toi" />
      <div class="fx-chu fx-thang">CHIẾN<br>THẮNG!</div>
      <div v-if="canh === 'ky-luc'" class="fx-bang">KỶ LỤC MỚI!</div>
    </template>

    <template v-else-if="canh === 'thua'">
      <div class="fx-toi" />
      <div class="fx-khoi-thua">
        <div class="fx-chu fx-thua">THUA RỒI</div>
        <p class="fx-an-ui">{{ dongAnUi(capConLai) }}</p>
      </div>
    </template>

    <template v-else-if="canh === 'thua-may'">
      <div class="fx-may"><MatBot :mat="matMay ?? ''" /></div>
      <div class="fx-bong">{{ cauTreu(matMay) }}</div>
    </template>

    <template v-else>
      <div class="fx-nua fx-trai" />
      <div class="fx-nua fx-phai" />
      <div class="fx-khoi-hoa">
        <div class="fx-chu fx-hoa">HOÀ!</div>
        <p class="fx-bat-tay">🤝</p>
      </div>
    </template>
  </div>
</template>
