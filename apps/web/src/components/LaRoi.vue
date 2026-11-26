<script setup lang="ts">
/*
 * LÁ BÀI RƠI — riêng hình nền Hoa anh đào (26.11.2026, chủ dự án: "hoa anh đào có hiệu ứng lá bài khác… làm các lá
 * bài rơi"). Vài lá bài nhỏ rơi chậm từ trên xuống như cánh hoa: vừa rơi vừa đưa ngang và lật mặt.
 * Luật giống IconBay: chỉ ở màn menu (App không mount lúc đang chơi), chỉ `transform` thuần, HAI LỚP mỗi lớp một
 * chuyển động (lớp ngoài RƠI, lớp trong ĐƯA + LẬT) để WebKit chạy trọn trên GPU, không `will-change`.
 * Máy bật giảm chuyển động thì không hiện (lá đứng im giữa trời trông như lỗi).
 */
/*
 * BA TẦNG XA–GẦN (bản 2, cảnh này không còn ba lá to): lá XA nhỏ, mờ, rơi chậm; lá GẦN to gấp mấy lần, rõ, rơi nhanh
 * hơn — mắt thấy chiều sâu. 12 lá. Lá gần đi qua đúng khoảng giữa màn hình (chỗ ba lá to từng đứng).
 */
const LA = [
  // xa
  { x: 5, co: 22, rs: 21, ds: 5.2, tre: -3, mat: false, mo: .7 }, { x: 31, co: 20, rs: 24, ds: 5.8, tre: -15, mat: true, mo: .7 },
  { x: 58, co: 24, rs: 22, ds: 5.4, tre: -9, mat: false, mo: .7 }, { x: 86, co: 20, rs: 25, ds: 6, tre: -19, mat: false, mo: .7 },
  // giữa
  { x: 14, co: 40, rs: 16, ds: 4.6, tre: -6, mat: true, mo: .9 }, { x: 44, co: 36, rs: 18, ds: 4.9, tre: -13, mat: false, mo: .9 },
  { x: 70, co: 42, rs: 15, ds: 4.4, tre: -2, mat: false, mo: .9 }, { x: 92, co: 34, rs: 17, ds: 4.7, tre: -10, mat: true, mo: .9 },
  // gần
  { x: 22, co: 78, rs: 12, ds: 3.9, tre: -1.5, mat: false, mo: 1 }, { x: 52, co: 92, rs: 11, ds: 3.6, tre: -6.5, mat: true, mo: 1 },
  { x: 76, co: 70, rs: 13, ds: 4.1, tre: -10, mat: false, mo: 1 }, { x: 2, co: 64, rs: 12.5, ds: 4, tre: -8, mat: true, mo: 1 }
];
</script>

<template>
  <div class="la-roi" aria-hidden="true">
    <span v-for="(l, i) in LA" :key="i" class="lr" :style="{ left: `${l.x}%`, width: `${l.co}px`, marginLeft: `${-l.co / 2}px`, opacity: l.mo, animationDuration: `${l.rs}s`, animationDelay: `${l.tre}s` }">
      <i :class="{ mat: l.mat }" :style="{ animationDuration: `${l.ds}s`, animationDelay: `${l.tre}s` }" />
    </span>
  </div>
</template>

<style scoped>
.la-roi { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.lr { container-type: inline-size; position: absolute; top: -130px; aspect-ratio: 3 / 4; animation: lr-roi linear infinite; }
.lr i {
  display: block; width: 100%; height: 100%; border-radius: 16%; border: max(2px, 5cqw) solid #fff;
  background: radial-gradient(circle at 50% 50%, #fff 0 16%, rgba(255, 255, 255, .35) 17% 30%, transparent 31%), linear-gradient(155deg, #ff9dc0, #e2558c);
  box-shadow: 0 3px 6px rgba(120, 20, 60, .25);
  animation: lr-dua ease-in-out infinite alternate;
}
/* Lá NGỬA: mặt kem với một bông hoa — xen vài lá cho đỡ đều */
.lr i.mat { background: radial-gradient(circle at 50% 50%, #ff8fb5 0 14%, #ffd0e0 15% 30%, transparent 31%), linear-gradient(#fffdf2, #fff1c9); border-color: #f27aa6; }
@keyframes lr-roi { from { transform: translateY(0); } to { transform: translateY(calc(100vh + 260px)); } }
@keyframes lr-dua {
  from { transform: translateX(-16px) rotate(-28deg) rotateY(-50deg); }
  to   { transform: translateX(16px) rotate(24deg) rotateY(55deg); }
}
@media (prefers-reduced-motion: reduce) { .la-roi { display: none; } }
</style>
