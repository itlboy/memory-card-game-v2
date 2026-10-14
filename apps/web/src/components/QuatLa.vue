<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { anhEmoji } from '@/lib/emoji';
import type { CardTheme } from '@/lib/themes';

/*
 * QUẠT LÁ TRANG CHỦ (14.10.2026, chủ dự án: "không muốn mặc định lá giữa mở gấu
 * trúc"). Mỗi ~3 giây lá đang ngửa úp xuống và MỘT lá khác (ngẫu nhiên) ngửa lên
 * với hình ngẫu nhiên từ theme MIỄN PHÍ — trang chủ không khoe theme phải mua.
 * Lật bằng thuộc tính `scale` RIÊNG (co ngang về 0 rồi nở lại) nên không đè góc
 * nghiêng trong `transform` lẫn cú lắc ở `rotate`. Đổi mặt đúng lúc lá co về 0.
 */
const props = defineProps<{ themes: CardTheme[] }>();

const VI_TRI = ['trai', 'phai', 'giua'] as const;   // giữa cuối DOM = nằm trên cùng
const DU_PHONG = ['🐼', '🦊', '🐸', '🍓', '🍩', '🐙', '🦄', '🍉', '🐳', '🌸', '🍀', '🐝'];
const NHIP_MS = 3000;
const NUA_LAT_MS = 220;   // khớp `transition: scale .22s` bên dưới

const kho = computed(() => {
  const s = props.themes.filter((t) => !t.premium).flatMap((t) => t.symbols);
  return s.length ? s : DU_PHONG;
});
const boc = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

const moIdx = ref(Math.floor(Math.random() * VI_TRI.length));
const kyHieu = ref(boc(kho.value));
const dangLat = ref<number[]>([]);

let hen: ReturnType<typeof setInterval> | undefined;
let henNua: ReturnType<typeof setTimeout> | undefined;
function latTiep(): void {
  if (document.hidden) return;
  const cu = moIdx.value;
  const moi = boc([0, 1, 2].filter((i) => i !== cu));
  const hinh = boc(kho.value.filter((e) => e !== kyHieu.value));
  dangLat.value = [cu, moi];
  henNua = setTimeout(() => {
    moIdx.value = moi;
    kyHieu.value = hinh;
    dangLat.value = [];
  }, NUA_LAT_MS);
}
onMounted(() => { hen = setInterval(latTiep, NHIP_MS); });
onUnmounted(() => { clearInterval(hen); clearTimeout(henNua); });
</script>

<template>
  <div class="quat" aria-hidden="true">
    <span
      v-for="(vt, i) in VI_TRI" :key="vt"
      class="la-quat" :class="[vt, { mo: moIdx === i, lat: dangLat.includes(i) }]"
    >
      <template v-if="moIdx === i">
        <img v-if="anhEmoji(kyHieu)" class="anh" :src="anhEmoji(kyHieu)!" alt="" draggable="false">
        <template v-else>{{ kyHieu }}</template>
      </template>
      <i v-else />
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
  transition: scale .22s ease-in-out;
}
.la-quat i { width: 34%; aspect-ratio: 1; background: var(--quat-hoa, rgba(255, 255, 255, .9)); clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
.la-quat.trai { transform: translate(-112%, -46%) rotate(-14deg); }
.la-quat.phai { transform: translate(12%, -48%) rotate(12deg); }
.la-quat.giua { transform: translate(-50%, -52%) rotate(-3deg); z-index: 1; }
/* Lá ngửa nổi lên trên cùng — lá bên cạnh ngửa mà nằm dưới lá giữa là mất nửa hình */
.la-quat.mo { background: var(--card-face-up); font-size: min(120px, 30cqh); z-index: 2; }
.la-quat .anh { width: 1.15em; height: 1.15em; }
/* Lá đang lật: co ngang về 0 (thấy cạnh lá), đổi mặt, rồi nở lại */
.la-quat.lat { scale: 0 1; }
/* LẮC NHẸ (chủ dự án 13.10.2026): thuộc tính `rotate` RIÊNG nên cộng dồn lên góc
   nghiêng trong `transform`, không đè nó. Ba nhịp lệch nhau để không lắc đồng loạt
   như máy. Chỉ rotate — không will-change, không lớp GPU sống mãi. */
.la-quat { animation: lac-quat 3.2s ease-in-out infinite alternate; }
.la-quat.trai { animation-duration: 3.8s; animation-delay: -1.2s; }
.la-quat.phai { animation-duration: 3.5s; animation-delay: -2.4s; }
@keyframes lac-quat { from { rotate: -2.5deg; } to { rotate: 2.5deg; } }
@media (prefers-reduced-motion: reduce) { .la-quat { animation: none; transition: none; } }
/* Máy thấp (SE + thanh địa chỉ): quạt còn dưới ~70px thì nhìn như lỗi — ẩn hẳn */
@container (max-height: 70px) { .la-quat { display: none; } }
</style>
