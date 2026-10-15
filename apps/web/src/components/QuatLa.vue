<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { anhEmoji } from '@/lib/emoji';
import type { CardTheme } from '@/lib/themes';

/*
 * QUẠT LÁ TRANG CHỦ (14.10.2026). Lá GIỮA luôn ngửa, chỉ ICON đổi mỗi 5 giây
 * (hình cũ mờ dần rồi hình mới rõ dần — bản thu nhỏ 0,6 bị chê mạnh tay) — bản lật lá ngẫu nhiên giữa ba vị trí bị chủ
 * dự án chê "rối mắt". Hình bốc ngẫu nhiên từ theme MIỄN PHÍ — trang chủ không
 * khoe theme phải mua.
 */
const props = defineProps<{ themes: CardTheme[] }>();

const DU_PHONG = ['🐼', '🦊', '🐸', '🍓', '🍩', '🐙', '🦄', '🍉', '🐳', '🌸', '🍀', '🐝'];
const NHIP_MS = 5000;

const kho = computed(() => {
  const s = props.themes.filter((t) => !t.premium).flatMap((t) => t.symbols);
  return s.length ? s : DU_PHONG;
});
const boc = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

const kyHieu = ref(boc(kho.value));

/* Hình cũ mờ dần, GẦN HẾT thì hình mới mới rõ dần (chủ dự án 15.10.2026). Bản cũ
   đổi chữ/ảnh NGAY TRÊN một phần tử lúc nó vừa mờ: ảnh SVG chưa tải xong thì hình
   cũ còn nằm đó lúc hiện lại, và WebKit giữ khung hình cũ của lớp đang chuyển —
   mắt thấy hình mới ĐÈ lên hình cũ. Nay mỗi hình là một phần tử riêng (`:key`),
   hai lớp chồng cùng một ô lưới, và ảnh được tải + giải mã XONG rồi mới đổi. */
let hen: ReturnType<typeof setInterval> | undefined;
let conSong = true;
async function doiHinh(): Promise<void> {
  if (document.hidden) return;
  const hinh = boc(kho.value.filter((e) => e !== kyHieu.value));
  const url = anhEmoji(hinh);
  if (url) {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => undefined);
  }
  if (conSong) kyHieu.value = hinh;
}
onMounted(() => { hen = setInterval(() => { void doiHinh(); }, NHIP_MS); });
onUnmounted(() => { conSong = false; clearInterval(hen); });
</script>

<template>
  <div class="quat" aria-hidden="true">
    <span class="la-quat trai"><i /></span>
    <span class="la-quat phai"><i /></span>
    <span class="la-quat giua">
      <span class="khung-hinh">
        <Transition name="hinh">
          <span :key="kyHieu" class="hinh">
            <img v-if="anhEmoji(kyHieu)" class="anh" :src="anhEmoji(kyHieu)!" alt="" draggable="false">
            <template v-else>{{ kyHieu }}</template>
          </span>
        </Transition>
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
  --la-h: min(86cqh, 53cqw, 320px);
  height: var(--la-h); aspect-ratio: 3 / 4;   /* 53cqw: quạt rộng ≈2,5 lá, phải lọt bề ngang */
  border-radius: 16px; display: flex; align-items: center; justify-content: center;
  background: var(--card-back); box-shadow: var(--elev-2);
  border: var(--quat-vien, 0);
}
.la-quat i { width: 34%; aspect-ratio: 1; background: var(--quat-hoa, rgba(255, 255, 255, .9)); clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
.la-quat.trai { transform: translate(-112%, -46%) rotate(-14deg); }
.la-quat.phai { transform: translate(12%, -48%) rotate(12deg); }
.la-quat.giua { transform: translate(-50%, -52%) rotate(-3deg); background: var(--card-face-up); z-index: 1;
  /* Cỡ hình theo CHÍNH LÁ (--la-h), không theo khung quạt: bản cũ `30cqh` tính theo
     chiều cao quạt nên máy hẹp (Mi 10S) lá co theo bề ngang còn hình thì không —
     hình phủ kín lá (chủ dự án báo). 0,36·cao ≈ 55% bề ngang lá, chừa lề như lá trong ván. */
  font-size: calc(var(--la-h) * .36); }
/* Hai hình (đang đi + đang tới) chồng đúng một ô lưới, không absolute: lá giữ
   nguyên cỡ và hình vẫn canh giữa. Cũ tắt 0,6s; mới chờ 0,5s (cũ đã gần hết) rồi
   rõ dần 0,6s. */
.khung-hinh { display: grid; place-items: center; }
.hinh { display: flex; grid-area: 1 / 1; }
.hinh-leave-active { transition: opacity .6s ease-in; }
.hinh-enter-active { transition: opacity .6s ease-out .5s; }
.hinh-enter-from, .hinh-leave-to { opacity: 0; }
.la-quat .anh { width: 1.15em; height: 1.15em; }
/* LẮC NHẸ (chủ dự án 13.10.2026): thuộc tính `rotate` RIÊNG nên cộng dồn lên góc
   nghiêng trong `transform`, không đè nó. Ba nhịp lệch nhau để không lắc đồng loạt
   như máy. Chỉ rotate — không will-change, không lớp GPU sống mãi. */
.la-quat { animation: lac-quat 3.2s ease-in-out infinite alternate; }
.la-quat.trai { animation-duration: 3.8s; animation-delay: -1.2s; }
.la-quat.phai { animation-duration: 3.5s; animation-delay: -2.4s; }
@keyframes lac-quat { from { rotate: -2.5deg; } to { rotate: 2.5deg; } }
@media (prefers-reduced-motion: reduce) { .la-quat { animation: none; } .hinh-enter-active, .hinh-leave-active { transition: none; } }
/* Máy thấp (SE + thanh địa chỉ): quạt còn dưới ~70px thì nhìn như lỗi — ẩn hẳn */
@container (max-height: 70px) { .la-quat { display: none; } }
</style>
