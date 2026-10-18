<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sfx } from '@/lib/audio';
import { BoHat, HIEN_BANG_MS, bocBienThe, chayCanh, chonCanh, dongAnUi } from '@/lib/ketcuc-fx';
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
/**
 * THÚ CỦA CẢNH (18.10.2026, mockup duyệt https://claude.ai/artifact/GB9pZQcPh43548oRPi83up):
 * thắng GẤU TRÚC cười to kiểu mèo 😸, mắt mở (nốt nhạc ♪♫ bay ra — không chữ "ha", mỗi nước viết tiếng cười một
 * kiểu), thua SƯ TỬ khóc to "oa oa", hoà HAI CHÚ CHUỘT cụng đầu — luôn ĐỨNG TRÊN chữ, cả cụm
 * canh GIỮA màn. SVG TỰ VẼ (`public/img/`, cùng chất với robot trang chủ): bộ Noto 3D chỉ có
 * mặt trung tính cho ba con này, không vẽ được cười/khóc.
 */
const THU = { cuoi: '/img/gau-truc-cuoi.svg', khoc: '/img/su-tu-khoc.svg', hoa: '/img/chuot.svg' } as const;
const bt = computed<BienThe | null>(() => props.bienThe ?? bocBienThe(canh.value, props.seed ?? 7));
const cv = ref<HTMLCanvasElement | null>(null);
/** Số cặp còn úp lúc thua — đếm từ DOM bàn thẻ, đúng cho cả offline lẫn online. */
const capConLai = ref(0);
let don: (() => void) | undefined;

/**
 * TIẾNG RIÊNG CỦA TỪNG BIẾN THỂ. Tiếng gốc của kết cục (fanfare thắng, hoà, máy
 * cười) vẫn phát ở chỗ gọi; riêng THUA phát toàn bộ ở đây (kèn buồn + sư tử khóc)
 * nghe khác hẳn nhau (kèn buồn + vỡ kính / gió cuốn tro / nhạc 8-bit).
 */
const TIENG_BIEN_THE: Record<BienThe, () => void> = {
  'phao-giay': () => {},
  'phao-hoa-dem': () => sfx.phaoHoaDem(),
  'vuong-mien': () => sfx.vuongMien(),
  'su-tu-khoc': () => sfx.suTuKhoc()
};

onMounted(() => {
  capConLai.value = Math.floor(document.querySelectorAll('.board button.card:not(.done)').length / 2);
  if (props.xemThu) {
    if (canh.value === 'thang' || canh.value === 'ky-luc') sfx.victory();
    else if (canh.value === 'hoa') sfx.win();
  }
  if (bt.value) TIENG_BIEN_THE[bt.value]();
  if (canh.value === 'thang' || canh.value === 'ky-luc') sfx.gauCuoi();
  else if (canh.value === 'hoa') sfx.chuotHoa();
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
  <div class="ketcuc-fx" :style="{ '--hien-bang': `${HIEN_BANG_MS[canh]}ms` }" :data-loai="loai" :data-canh="canh" :data-bien-the="bt ?? undefined" :aria-label="td(`fx.canh.${canh}`)" aria-hidden="true">
    <canvas ref="cv" class="fx-hat" />

    <!-- ===== THẮNG (3 biến thể) — gấu trúc cười trên chữ, nốt nhạc bay ra, cả cụm giữa màn ===== -->
    <template v-if="canh === 'thang' || canh === 'ky-luc'">
      <div class="fx-toi" :class="{ 'fx-dem': bt === 'phao-hoa-dem' }" />
      <div v-if="bt === 'vuong-mien'" class="fx-tia-vang" />
      <div class="fx-cum">
        <span class="fx-thu fx-thu-cuoi">
          <img :src="THU.cuoi" alt="" />
          <b v-for="n in 4" :key="n" class="fx-not" :class="`fx-not-${n}`" aria-hidden="true">{{ n % 2 ? '♪' : '♫' }}</b>
          <i v-for="n in 3" :key="`l${n}`" class="fx-lap" :class="`fx-lap-${n}`" aria-hidden="true">✦</i>
          <span v-if="bt === 'vuong-mien'" class="fx-vuong-mien" aria-hidden="true">👑</span>
        </span>
        <div
          class="fx-chu fx-thang fx-tieu-de"
          :class="{ 'fx-neon': bt === 'phao-hoa-dem', 'fx-vang-khoi': bt === 'vuong-mien' }"
        ><template v-for="(dong, i) in t('fx.chienThang').split('|')" :key="i"><br v-if="i">{{ dong }}</template></div>
      </div>
      <div v-if="canh === 'ky-luc'" class="fx-bang">{{ t('fx.kyLucMoi') }}</div>
    </template>

    <!-- ===== THUA — sư tử khóc to trên chữ, chữ đập xuống như thắng ===== -->
    <template v-else-if="canh === 'thua'">
      <div class="fx-toi" />
      <div class="fx-cum">
        <span class="fx-thu fx-thu-khoc">
          <img :src="THU.khoc" alt="" />
          <i class="fx-giot fx-giot-a" /><i class="fx-giot fx-giot-b" />
        </span>
        <div class="fx-chu fx-thua fx-tieu-de">{{ t('fx.thuaRoi') }}</div>
        <p v-if="motMinh" class="fx-an-ui">{{ dongAnUi(capConLai) }}</p>
      </div>
    </template>

    <!-- ===== HOÀ — hai chú chuột cụng đầu trên chữ ===== -->
    <template v-else>
      <div class="fx-toi" />
      <div class="fx-cum">
        <span class="fx-doi">
          <span class="fx-thu fx-thu-t"><img :src="THU.hoa" alt="" /></span>
          <span class="fx-thu fx-thu-p"><img :src="THU.hoa" alt="" /></span>
        </span>
        <div class="fx-chu fx-hoa fx-tieu-de">{{ t('fx.hoa') }}</div>
      </div>
    </template>
  </div>
</template>
