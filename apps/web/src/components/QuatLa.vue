<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { anhEmoji } from '@/lib/emoji';
import type { CardTheme } from '@/lib/themes';

/*
 * QUẠT LÁ TRANG CHỦ (14.10.2026). Lá GIỮA luôn ngửa, chỉ ICON đổi mỗi 5 giây
 * (chỉ mờ dần rồi hiện hình mới — bản thu nhỏ 0,6 bị chê mạnh tay) — bản lật lá ngẫu nhiên giữa ba vị trí bị chủ
 * dự án chê "rối mắt". Hình bốc ngẫu nhiên từ theme MIỄN PHÍ — trang chủ không
 * khoe theme phải mua.
 */
const props = defineProps<{ themes: CardTheme[] }>();

const DU_PHONG = ['🐼', '🦊', '🐸', '🍓', '🍩', '🐙', '🦄', '🍉', '🐳', '🌸', '🍀', '🐝'];
const NHIP_MS = 5000;
const AN_MS = 450;   // khớp `transition: opacity .45s` của .hinh bên dưới

const kho = computed(() => {
  const s = props.themes.filter((t) => !t.premium).flatMap((t) => t.symbols);
  return s.length ? s : DU_PHONG;
});
const boc = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

const kyHieu = ref(boc(kho.value));
const an = ref(false);

let hen: ReturnType<typeof setInterval> | undefined;
let henDoi: ReturnType<typeof setTimeout> | undefined;
function doiHinh(): void {
  if (document.hidden) return;
  const hinh = boc(kho.value.filter((e) => e !== kyHieu.value));
  an.value = true;
  henDoi = setTimeout(() => { kyHieu.value = hinh; an.value = false; }, AN_MS);
}
onMounted(() => { hen = setInterval(doiHinh, NHIP_MS); });
onUnmounted(() => { clearInterval(hen); clearTimeout(henDoi); });
</script>

<template>
  <div class="quat" aria-hidden="true">
    <span class="la-quat trai"><i /></span>
    <span class="la-quat phai"><i /></span>
    <span class="la-quat giua">
      <span class="hinh" :class="{ an }">
        <img v-if="anhEmoji(kyHieu)" class="anh" :src="anhEmoji(kyHieu)!" alt="" draggable="false">
        <template v-else>{{ kyHieu }}</template>
      </span>
    </span>
  </div>
</template>

<style scoped>
/* Quạt CO theo chỗ (điện thoại) nhưng có TRẦN 420px: cột máy tính cao 1.200px mà
   quạt ăn hết phần dư thì cụm nút bị đẩy dính đáy (chủ dự án báo). Có trần thì
   phần dư chia đều trên/dưới nhờ justify-content: center — cả cụm nằm giữa. */
.quat { flex: 1 1 auto; max-height: 420px; min-height: 0; position: relative; container-type: size; }
.la-quat {
  position: absolute; left: 50%; top: 50%;
  /* Nở theo chỗ trống (cqh của .quat), trần 320px: trên máy tính cột cao 1.200px
     mà quạt chỉ 170px thì lọt thỏm giữa một khoảng trống (chủ dự án báo). */
  height: min(86cqh, 53cqw, 320px); aspect-ratio: 3 / 4;   /* 53cqw: quạt rộng ≈2,5 lá, phải lọt bề ngang */
  border-radius: 16px; display: flex; align-items: center; justify-content: center;
  background: var(--card-back); box-shadow: var(--elev-2);
  border: var(--quat-vien, 0);
}
.la-quat i { width: 34%; aspect-ratio: 1; background: var(--quat-hoa, rgba(255, 255, 255, .9)); clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
.la-quat.trai { transform: translate(-112%, -46%) rotate(-14deg); }
.la-quat.phai { transform: translate(12%, -48%) rotate(12deg); }
.la-quat.giua { transform: translate(-50%, -52%) rotate(-3deg); background: var(--card-face-up); font-size: min(120px, 30cqh); z-index: 1; }
.hinh { display: flex; transition: opacity .45s ease-in-out; }
.hinh.an { opacity: 0; }
.la-quat .anh { width: 1.15em; height: 1.15em; }
/* LẮC NHẸ (chủ dự án 13.10.2026): thuộc tính `rotate` RIÊNG nên cộng dồn lên góc
   nghiêng trong `transform`, không đè nó. Ba nhịp lệch nhau để không lắc đồng loạt
   như máy. Chỉ rotate — không will-change, không lớp GPU sống mãi. */
.la-quat { animation: lac-quat 3.2s ease-in-out infinite alternate; }
.la-quat.trai { animation-duration: 3.8s; animation-delay: -1.2s; }
.la-quat.phai { animation-duration: 3.5s; animation-delay: -2.4s; }
@keyframes lac-quat { from { rotate: -2.5deg; } to { rotate: 2.5deg; } }
@media (prefers-reduced-motion: reduce) { .la-quat { animation: none; } .hinh { transition: none; } }
/* Máy thấp (SE + thanh địa chỉ): quạt còn dưới ~70px thì nhìn như lỗi — ẩn hẳn */
@container (max-height: 70px) { .la-quat { display: none; } }
</style>
