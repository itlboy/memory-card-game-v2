<script setup lang="ts">
import { anhEmoji } from '@/lib/emoji';
import { HINH_TRANG_CHU } from '@/lib/hinh-trang-chu';
import { LUNG } from '@/lib/lung-la';
/*
 * LÁ BÀI RƠI — riêng hình nền Hoa anh đào (26.11.2026, chủ dự án: "hoa anh đào có hiệu ứng lá bài khác… làm các lá
 * bài rơi"; cảnh này KHÔNG còn ba lá to). Lá rơi chậm từ trên xuống như cánh hoa: vừa rơi vừa đưa ngang và LẬT.
 * LÁ BÀI THẬT HAI MẶT (chủ dự án: "các lá rơi xuống có nội dung thật"): mặt ngửa là hình bốc từ bộ tuyển chọn của
 * trang chủ (`HINH_TRANG_CHU`, cùng ảnh với lá trong ván), mặt lưng hồng in bông hoa; lá xoay quanh trục dọc nên lúc
 * thấy hình, lúc thấy lưng. Hình bốc MỘT LẦN lúc mở màn (không đổi giữa chừng — đổi là phải tải + giải mã ảnh trong lúc
 * đang chạy animation, đúng thứ làm iOS khựng).
 * Luật giống IconBay: chỉ ở màn menu (App không mount lúc đang chơi), chỉ `transform` thuần, HAI LỚP mỗi lớp một
 * chuyển động (lớp ngoài RƠI, lớp trong ĐƯA + LẬT) để WebKit chạy trọn trên GPU, không `will-change`.
 * Máy bật giảm chuyển động thì không hiện (lá đứng im giữa trời trông như lỗi).
 */
const tron = <T,>(a: readonly T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((p, q) => p[0] - q[0]).map(([, v]) => v);
const HINH = tron(HINH_TRANG_CHU);
/** Mặt lưng của từng lá rơi: xáo bộ Hoa anh đào rồi chia vòng — đủ cả năm hình, không lá kề nào trùng nhau liên tục. */
const LUNG_LA = tron(LUNG['anh-dao']);
/*
 * 26.11.2026, chủ dự án: "tại sao lá bài rơi có độ trong suốt, cho tốc độ rơi nhẹ hơn". Bỏ hẳn độ mờ theo lớp xa/gần
 * (`mo` cũ .7/.9 — nhìn xuyên qua lá thấy núi, trông như lỗi); xa gần giờ chỉ còn thể hiện bằng CỠ lá. Rơi chậm lại
 * `CHAM` lần: nhân vào thời gian rơi `rs` (và độ trễ, để các lá vẫn rải đều chứ không dồn một đợt lúc mở màn).
 */
const CHAM = 1.6;
const LA = [
  // xa
  { x: 5, co: 22, rs: 21, ds: 5.2, tre: -3, mat: false }, { x: 31, co: 20, rs: 24, ds: 5.8, tre: -15, mat: true },
  { x: 58, co: 24, rs: 22, ds: 5.4, tre: -9, mat: false }, { x: 86, co: 20, rs: 25, ds: 6, tre: -19, mat: false },
  // giữa
  { x: 14, co: 40, rs: 16, ds: 4.6, tre: -6, mat: true }, { x: 44, co: 36, rs: 18, ds: 4.9, tre: -13, mat: false },
  { x: 70, co: 42, rs: 15, ds: 4.4, tre: -2, mat: false }, { x: 92, co: 34, rs: 17, ds: 4.7, tre: -10, mat: true },
  // gần
  { x: 22, co: 78, rs: 12, ds: 3.9, tre: -1.5, mat: false }, { x: 52, co: 92, rs: 11, ds: 3.6, tre: -6.5, mat: true },
  { x: 76, co: 70, rs: 13, ds: 4.1, tre: -10, mat: false }, { x: 2, co: 64, rs: 12.5, ds: 4, tre: -8, mat: true }
];
</script>

<template>
  <div class="la-roi" aria-hidden="true">
    <span v-for="(l, i) in LA" :key="i" class="lr" :data-lung="LUNG_LA[i % LUNG_LA.length]" :style="{ left: `${l.x}%`, width: `${l.co}px`, marginLeft: `${-l.co / 2}px`, animationDuration: `${l.rs * CHAM}s`, animationDelay: `${l.tre * CHAM}s` }">
      <span class="lat" :class="{ nguoc: l.mat }" :style="{ animationDuration: `${l.ds * 2}s`, animationDelay: `${l.tre}s` }">
        <i class="mat"><img v-if="anhEmoji(HINH[i % HINH.length]!)" :src="anhEmoji(HINH[i % HINH.length]!)!" alt="" draggable="false"><template v-else>{{ HINH[i % HINH.length] }}</template></i>
        <i class="lung" />
      </span>
    </span>
  </div>
</template>

<style scoped>
.la-roi { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.lr { container-type: inline-size; position: absolute; top: -130px; aspect-ratio: 3 / 4; animation: lr-roi linear infinite; }
.lat { position: absolute; inset: 0; transform-style: preserve-3d; animation: lr-dua ease-in-out infinite alternate; }
.lat i {
  position: absolute; inset: 0; display: grid; place-items: center; border-radius: 16%; box-shadow: 0 3px 6px rgba(120, 20, 60, .25);
  backface-visibility: hidden; -webkit-backface-visibility: hidden; font-style: normal; font-size: 55cqw; line-height: 1;
}
/* Mặt NGỬA: nền kem + viền như lá ngửa trong ván, hình chiếm ~60% bề ngang */
.lat .mat { border: max(2px, 5cqw) solid #f27aa6; background: radial-gradient(110% 80% at 50% 35%, #fffdf2, #fff1c9 90%); }
.lat .mat img { width: 62cqw; height: 62cqw; }
/* Mặt LƯNG: hồng trơn + một hình nhỏ của bộ Hoa anh đào, mỗi lá một hình (`data-lung`, hình ở keo-lung.css) */
.lat .lung {
  border: max(2px, 5cqw) solid #fff; transform: rotateY(180deg);
  background: var(--lung-hinh, none) center / var(--lung-co, 39.5%) auto no-repeat, linear-gradient(155deg, #ff9dc0, #e2558c);
}
@keyframes lr-roi { from { transform: translateY(0); } to { transform: translateY(calc(100vh + 260px)); } }
/* Đưa ngang + nghiêng + LẬT quanh trục dọc: đi từ gần ngửa hẳn tới gần úp hẳn rồi quay lại (alternate) */
@keyframes lr-dua {
  from { transform: translateX(-16px) rotate(-22deg) rotateY(-35deg); }
  to   { transform: translateX(16px) rotate(20deg) rotateY(215deg); }
}
/* Nửa số lá bắt đầu từ mặt lưng cho đỡ đều */
.lat.nguoc { animation-direction: alternate-reverse; }
@media (prefers-reduced-motion: reduce) { .la-roi { display: none; } }
</style>
