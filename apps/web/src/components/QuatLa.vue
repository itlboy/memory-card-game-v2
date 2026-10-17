<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { anhEmoji } from '@/lib/emoji';
import { HINH_TRANG_CHU } from '@/lib/hinh-trang-chu';
import type { CardTheme } from '@/lib/themes';

/*
 * QUẠT LÁ TRANG CHỦ (14.10.2026). Lá GIỮA luôn ngửa, chỉ ICON đổi mỗi 5 giây
 * (hình cũ mờ dần rồi hình mới rõ dần — bản thu nhỏ 0,6 bị chê mạnh tay) — bản lật lá ngẫu nhiên giữa ba vị trí bị chủ
 * dự án chê "rối mắt". Hình bốc từ danh sách TUYỂN CHỌN `HINH_TRANG_CHU` (17.10.2026).
 */
defineProps<{ themes: CardTheme[] }>();

const NHIP_MS = 5000;

const kho = computed((): readonly string[] => HINH_TRANG_CHU);
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
    <span class="la-quat trai"><span class="lac"><i /></span></span>
    <span class="la-quat phai"><span class="lac"><i /></span></span>
    <span class="la-quat giua"><span class="lac">
      <span class="khung-hinh">
        <Transition name="hinh" mode="out-in">
          <span :key="kyHieu" class="hinh">
            <img v-if="anhEmoji(kyHieu)" class="anh" :src="anhEmoji(kyHieu)!" alt="" draggable="false">
            <template v-else>{{ kyHieu }}</template>
          </span>
        </Transition>
      </span>
    </span></span>
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
}
/* HAI LỚP, MỖI LỚP MỘT VIỆC (16.10.2026, chủ dự án: "trên iOS hiệu ứng 3 thẻ hơi giật",
   Android thì không). `.la-quat` chỉ ĐỨNG (vị trí + góc nghiêng, không động); `.lac` là
   thứ DUY NHẤT chuyển động, bằng `transform` thuần trong keyframes. Bản cũ cho chính
   `.la-quat` chạy `rotate` chồng lên `transform` tĩnh, còn ảnh lá giữa đổi (mờ dần) ngay
   trong phần tử đang lắc — WebKit gộp mọi thuộc tính biến hình của một phần tử vào MỘT
   animation trên GPU, có thay đổi kèm là đồng bộ lại / rút về luồng chính → khựng. */
.lac {
  position: absolute; inset: 0;
  border-radius: 16px; display: flex; align-items: center; justify-content: center;
  background: var(--card-back); box-shadow: var(--elev-2);
  border: var(--quat-vien, 0);
}
.lac i { width: 34%; aspect-ratio: 1; background: var(--quat-hoa, rgba(255, 255, 255, .9)); clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
.la-quat.trai { transform: translate(-112%, -46%) rotate(-14deg); }
.la-quat.phai { transform: translate(12%, -48%) rotate(12deg); }
.la-quat.giua .lac { background: var(--card-face-up); }
.la-quat.giua { transform: translate(-50%, -52%) rotate(-3deg); z-index: 1;
  /* Cỡ hình theo CHÍNH LÁ (--la-h), không theo khung quạt: bản cũ `30cqh` tính theo
     chiều cao quạt nên máy hẹp (Mi 10S) lá co theo bề ngang còn hình thì không —
     hình phủ kín lá (chủ dự án báo). 0,36·cao ≈ 55% bề ngang lá, chừa lề như lá trong ván. */
  font-size: calc(var(--la-h) * .36); }
/* `mode="out-in"`: hình cũ BIẾN HẲN rồi hình mới mới vào — KHÔNG lúc nào có hai hình
   trên lá. Bản chồng hai lớp (mới chờ 0,5s rồi rõ dần) vẫn bị chủ dự án báo "đè lên
   nhau" trên iOS từ khi mặt bài là ẢNH Noto 3D (15.10.2026): WebKit có lúc không làm
   mờ ảnh của lớp đang rời. Không còn hai phần tử cùng lúc thì không có gì để đè.
   Hai hình vẫn chung một ô lưới để lá giữ nguyên cỡ. */
.khung-hinh { display: grid; place-items: center; }
.hinh { display: flex; grid-area: 1 / 1; }
.hinh-leave-active { transition: opacity .6s ease-in; }
.hinh-enter-active { transition: opacity .6s ease-out; }
.hinh-enter-from, .hinh-leave-to { opacity: 0; }
.la-quat .anh { width: 1.15em; height: 1.15em; }
/* LẮC NHẸ (chủ dự án 13.10.2026) trên lớp `.lac` (góc nghiêng nằm ở `.la-quat` cha nên
   không bị đè). Ba nhịp lệch nhau để không lắc đồng loạt như máy. `transform` thuần:
   loại animation WebKit chạy trọn trên GPU. Ba lớp nhỏ, chỉ ở trang chủ. */
.lac { animation: lac-quat 3.2s ease-in-out infinite alternate; }
.la-quat.trai .lac { animation-duration: 3.8s; animation-delay: -1.2s; }
.la-quat.phai .lac { animation-duration: 3.5s; animation-delay: -2.4s; }
@keyframes lac-quat { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
@media (prefers-reduced-motion: reduce) { .lac { animation: none; } .hinh-enter-active, .hinh-leave-active { transition: none; } }
/* Máy thấp (SE + thanh địa chỉ): quạt còn dưới ~70px thì nhìn như lỗi — ẩn hẳn */
@container (max-height: 70px) { .la-quat { display: none; } }
</style>
