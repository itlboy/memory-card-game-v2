<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sfx } from '@/lib/audio';
import { BoHat, bocBienThe, chayCanh, chonCanh, dongAnUi, VET_NUT } from '@/lib/ketcuc-fx';
import type { BienThe } from '@/lib/ketcuc-fx';
import type { LoaiKetCuc } from '@/lib/ketcuc-fx';
import { rung } from '@/lib/rung';
import { t, td } from '@/lib/i18n';

/**
 * HIỆU ỨNG KẾT VÁN — component DUY NHẤT cho mọi kết cục (xem `lib/ketcuc-fx.ts`).
 *
 * Phần CHỮ (CHIẾN THẮNG, THUA RỒI, HOÀ, băng kỷ lục, máy trêu) là DOM + CSS có
 * delay; phần CHUYỂN ĐỘNG (hạt, lá bài gợn/rơi, rung màn) do `chayCanh` lo.
 * Nằm ở z 9, DƯỚI bảng kết quả (10), không chặn chạm.
 */
const props = defineProps<{
  loai: LoaiKetCuc;
  /** Seed của ván — bốc BIẾN THỂ tất định (F5 hay view online dựng lại không đổi hình). */
  seed?: number;
  /** Ván vừa phá kỷ lục → cảnh kỷ lục (biến thể thắng + băng vàng + pháo hoa). */
  kyLuc?: boolean;
  /** Ván MỘT MÌNH → thua thì kèm dòng an ủi "còn N cặp". Đấu máy / online / nhiều
   *  người thì không (chủ dự án 14.10.2026: đấu máy hiện y như đấu người). */
  motMinh?: boolean;
  /** Ép một biến thể (khu "Xem thử hiệu ứng" trong chế độ debug). */
  bienThe?: BienThe | null;
  /** Xem thử: không có chỗ gọi nào phát tiếng gốc (thắng/hoà/máy cười) nên tự phát. */
  xemThu?: boolean;
}>();

const canh = computed(() => chonCanh(props.loai, { kyLuc: props.kyLuc }));
const bt = computed<BienThe | null>(() => props.bienThe ?? bocBienThe(canh.value, props.seed ?? 7));
const cv = ref<HTMLCanvasElement | null>(null);
/** Số cặp còn úp lúc thua — đếm từ DOM bàn thẻ, đúng cho cả offline lẫn online. */
const capConLai = ref(0);
let don: (() => void) | undefined;

/**
 * TIẾNG RIÊNG CỦA TỪNG BIẾN THỂ. Tiếng gốc của kết cục (fanfare thắng, hoà, máy
 * cười) vẫn phát ở chỗ gọi; riêng THUA phát toàn bộ ở đây vì ba biến thể thua
 * nghe khác hẳn nhau (kèn buồn + vỡ kính / gió cuốn tro / nhạc 8-bit).
 */
const TIENG_BIEN_THE: Record<BienThe, () => void> = {
  'phao-giay': () => {},
  'phao-hoa-dem': () => sfx.phaoHoaDem(),
  'vuong-mien': () => sfx.vuongMien(),
  'dap-vo': () => sfx.lose(),
  'tan-tro': () => sfx.tanTro(),
  'game-over': () => sfx.gameOver()
};

onMounted(() => {
  capConLai.value = Math.floor(document.querySelectorAll('.board button.card:not(.done)').length / 2);
  if (props.xemThu) {
    if (canh.value === 'thang' || canh.value === 'ky-luc') sfx.victory();
    else if (canh.value === 'hoa') sfx.win();
  }
  if (bt.value) TIENG_BIEN_THE[bt.value]();
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
  }, bt.value);
});
onBeforeUnmount(() => don?.());
</script>

<template>
  <div class="ketcuc-fx" :data-loai="loai" :data-canh="canh" :data-bien-the="bt ?? undefined" :aria-label="td(`fx.canh.${canh}`)" aria-hidden="true">
    <canvas ref="cv" class="fx-hat" />

    <!-- ===== THẮNG (3 biến thể) ===== -->
    <template v-if="canh === 'thang' || canh === 'ky-luc'">
      <div class="fx-toi" :class="{ 'fx-dem': bt === 'phao-hoa-dem' }" />
      <div v-if="bt === 'vuong-mien'" class="fx-tia-vang" />
      <div
        class="fx-chu fx-thang fx-tieu-de"
        :class="{ 'fx-neon': bt === 'phao-hoa-dem', 'fx-vang-khoi': bt === 'vuong-mien' }"
      ><template v-for="(dong, i) in t('fx.chienThang').split('|')" :key="i"><br v-if="i">{{ dong }}</template></div>
      <span v-if="bt === 'vuong-mien'" class="fx-vuong-mien" aria-hidden="true">👑</span>
      <div v-if="canh === 'ky-luc'" class="fx-bang">{{ t('fx.kyLucMoi') }}</div>
    </template>

    <!-- ===== THUA (3 biến thể) ===== -->
    <template v-else-if="canh === 'thua' && bt === 'game-over'">
      <div class="fx-crt-man" />
      <div class="fx-crt-vach" />
      <div class="fx-quet" />
      <div class="fx-khoi-thua fx-go">
        <div class="fx-game-over fx-tieu-de"><template v-for="(dong, i) in t('fx.gameOver').split('|')" :key="i"><br v-if="i">{{ dong }}</template></div>
        <p v-if="motMinh" class="fx-an-ui fx-an-ui-go">{{ dongAnUi(capConLai) }}</p>
        <p class="fx-nhan-nut">{{ t('fx.bamChoiLai') }}</p>
      </div>
    </template>

    <template v-else-if="canh === 'thua' && bt === 'tan-tro'">
      <div class="fx-toi" />
      <div class="fx-khoi-thua">
        <div class="fx-chu fx-thua fx-tieu-de fx-tro-chu" :aria-label="t('fx.thuaRoi')">
          <span v-for="(c, i) in [...t('fx.thuaRoi')]" :key="i" class="fx-ky" :style="{ animationDelay: `${0.35 + i * 0.04}s, ${1.35 + i * 0.07}s` }">{{ c === ' ' ? '\u00a0' : c }}</span>
        </div>
        <p v-if="motMinh" class="fx-an-ui">{{ dongAnUi(capConLai) }}</p>
      </div>
    </template>

    <template v-else-if="canh === 'thua'">
      <div class="fx-toi" />
      <!-- Viền đỏ sẫm nhói vào đúng lúc đồng hồ về 0 -->
      <div class="fx-vien" />
      <div class="fx-khoi-thua">
        <!-- Vết nứt + sóng chấn động: hiện lúc chữ chạm đất (~1,45s) -->
        <svg class="fx-nut" viewBox="-100 -60 200 120" aria-hidden="true">
          <path v-for="(d, i) in VET_NUT" :key="i" :d="d" :style="{ animationDelay: `${1.45 + i * 0.02}s` }" />
        </svg>
        <i class="fx-song" />
        <!-- Rơi TỪNG CHỮ, mỗi chữ nảy riêng -->
        <div class="fx-chu fx-thua fx-tieu-de" :aria-label="t('fx.thuaRoi')">
          <span v-for="(c, i) in [...t('fx.thuaRoi')]" :key="i" class="fx-ky" :style="{ animationDelay: `${0.85 + i * 0.05}s` }">{{ c === ' ' ? '\u00a0' : c }}</span>
        </div>
        <p v-if="motMinh" class="fx-an-ui">{{ dongAnUi(capConLai) }}</p>
        <!-- Đám mây xui xẻo trôi tới đổ mưa lên chữ (mưa vẽ trên canvas) -->
        <span class="fx-may-mua" aria-hidden="true">🌧️</span>
      </div>
    </template>


    <template v-else>
      <div class="fx-nua fx-trai" />
      <div class="fx-nua fx-phai" />
      <div class="fx-khoi-hoa">
        <div class="fx-chu fx-hoa">{{ t('fx.hoa') }}</div>
        <p class="fx-bat-tay">🤝</p>
      </div>
    </template>
  </div>
</template>
