<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sfx } from '@/lib/audio';
import { BoHat, HIEN_BANG_MS, bocBienThe, chayCanh, chonCanh, dongAnUi } from '@/lib/ketcuc-fx';
import { anhEmoji } from '@/lib/emoji';
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
 * MÈO CỦA CẢNH (18.10.2026, mockup https://claude.ai/artifact/GB9pZQcPh43548oRPi83up):
 * thắng 😹 cười, thua 😿 khóc, hoà hai 😺 cụng đầu — luôn ĐỨNG TRÊN chữ, cả cụm canh
 * GIỮA màn. Ảnh Noto 3D (cùng bộ với mặt bài) bất kể máy đang vẽ mặt bài bằng gì.
 */
const MEO = { cuoi: '😹', khoc: '😿', hoa: '😺' } as const;
const anhMeo = (k: keyof typeof MEO) => anhEmoji(MEO[k], true, 256);
const bt = computed<BienThe | null>(() => props.bienThe ?? bocBienThe(canh.value, props.seed ?? 7));
const cv = ref<HTMLCanvasElement | null>(null);
/** Số cặp còn úp lúc thua — đếm từ DOM bàn thẻ, đúng cho cả offline lẫn online. */
const capConLai = ref(0);
let don: (() => void) | undefined;

/**
 * TIẾNG RIÊNG CỦA TỪNG BIẾN THỂ. Tiếng gốc của kết cục (fanfare thắng, hoà, máy
 * cười) vẫn phát ở chỗ gọi; riêng THUA phát toàn bộ ở đây (kèn buồn + mèo khóc)
 * nghe khác hẳn nhau (kèn buồn + vỡ kính / gió cuốn tro / nhạc 8-bit).
 */
const TIENG_BIEN_THE: Record<BienThe, () => void> = {
  'phao-giay': () => {},
  'phao-hoa-dem': () => sfx.phaoHoaDem(),
  'vuong-mien': () => sfx.vuongMien(),
  'meo-khoc': () => sfx.meoKhoc()
};

onMounted(() => {
  capConLai.value = Math.floor(document.querySelectorAll('.board button.card:not(.done)').length / 2);
  if (props.xemThu) {
    if (canh.value === 'thang' || canh.value === 'ky-luc') sfx.victory();
    else if (canh.value === 'hoa') sfx.win();
  }
  if (bt.value) TIENG_BIEN_THE[bt.value]();
  if (canh.value === 'thang' || canh.value === 'ky-luc') sfx.meoCuoi();
  else if (canh.value === 'hoa') sfx.meoHoa();
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

    <!-- ===== THẮNG (3 biến thể) — mèo cười trên chữ, cả cụm giữa màn ===== -->
    <template v-if="canh === 'thang' || canh === 'ky-luc'">
      <div class="fx-toi" :class="{ 'fx-dem': bt === 'phao-hoa-dem' }" />
      <div v-if="bt === 'vuong-mien'" class="fx-tia-vang" />
      <div class="fx-cum">
        <span class="fx-meo fx-meo-cuoi">
          <img v-if="anhMeo('cuoi')" :src="anhMeo('cuoi')!" alt="" /><template v-else>{{ MEO.cuoi }}</template>
          <span v-if="bt === 'vuong-mien'" class="fx-vuong-mien" aria-hidden="true">👑</span>
        </span>
        <div
          class="fx-chu fx-thang fx-tieu-de"
          :class="{ 'fx-neon': bt === 'phao-hoa-dem', 'fx-vang-khoi': bt === 'vuong-mien' }"
        ><template v-for="(dong, i) in t('fx.chienThang').split('|')" :key="i"><br v-if="i">{{ dong }}</template></div>
      </div>
      <div v-if="canh === 'ky-luc'" class="fx-bang">{{ t('fx.kyLucMoi') }}</div>
    </template>

    <!-- ===== THUA — mèo khóc trên chữ, chữ đập xuống như thắng ===== -->
    <template v-else-if="canh === 'thua'">
      <div class="fx-toi" />
      <div class="fx-cum">
        <span class="fx-meo fx-meo-khoc">
          <img v-if="anhMeo('khoc')" :src="anhMeo('khoc')!" alt="" /><template v-else>{{ MEO.khoc }}</template>
          <i class="fx-giot fx-giot-a" /><i class="fx-giot fx-giot-b" />
        </span>
        <div class="fx-chu fx-thua fx-tieu-de">{{ t('fx.thuaRoi') }}</div>
        <p v-if="motMinh" class="fx-an-ui">{{ dongAnUi(capConLai) }}</p>
      </div>
    </template>

    <!-- ===== HOÀ — hai mèo cụng đầu trên chữ ===== -->
    <template v-else>
      <div class="fx-toi" />
      <div class="fx-cum">
        <span class="fx-doi">
          <span class="fx-meo fx-meo-t"><img v-if="anhMeo('hoa')" :src="anhMeo('hoa')!" alt="" /><template v-else>{{ MEO.hoa }}</template></span>
          <span class="fx-meo fx-meo-p"><img v-if="anhMeo('hoa')" :src="anhMeo('hoa')!" alt="" /><template v-else>{{ MEO.hoa }}</template></span>
        </span>
        <div class="fx-chu fx-hoa fx-tieu-de">{{ t('fx.hoa') }}</div>
      </div>
    </template>
  </div>
</template>
