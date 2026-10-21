<script setup lang="ts">
/**
 * NGÔI SAO ĐÁNH GIÁ 3D — cửa DUY NHẤT vẽ sao Chiến dịch (21.10.2026, thay ký tự ★/☆).
 * Ba hình cùng khuôn sao 3D mập: `public/img/sao-3d.svg` (sáng) · `sao-3d-tat.svg` (chưa đạt)
 * · `sao-3d-4.svg` (ngôi thứ 4 "Hoàn hảo", cầu vồng). Cỡ = 1em — đặt `font-size` ở chỗ dùng.
 * `song`: vệt sáng lướt + quầng thở cho sao 4 — chỉ gắn ở chỗ ÍT ngôi (HUD, dòng mốc, bảng kết
 * quả); bản đồ 60 ô giữ tĩnh (hàng chục animation vô hạn là máy vẽ lại suốt).
 */
defineProps<{ loai?: 'sang' | 'tat' | 'sao4'; song?: boolean }>();
</script>

<template>
  <span class="sao3d" :class="[loai ?? 'sang', { song }]" aria-hidden="true" />
</template>

<style scoped>
.sao3d {
  display: inline-block; width: 1em; height: 1em; vertical-align: -0.14em; flex: none;
  background: url('/img/sao-3d.svg') center / contain no-repeat;
  position: relative;
}
.sao3d.tat { background-image: url('/img/sao-3d-tat.svg'); }
.sao3d.sao4 {
  background-image: url('/img/sao-3d-4.svg');
  filter: drop-shadow(0 0 .08em rgba(162, 89, 255, .55));
}
.sao3d.sao4.song { animation: sao3d-tho 1.8s ease-in-out infinite; }
/* Vệt sáng lướt qua mặt sao: lớp gradient bị CẮT theo hình sao (mask) nên không lem ra ngoài. */
.sao3d.sao4.song::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .85) 48%, transparent 60%) 0 0 / 260% 100%;
  -webkit-mask: url('/img/sao-3d-4.svg') center / contain no-repeat;
  mask: url('/img/sao-3d-4.svg') center / contain no-repeat;
  animation: sao3d-anh 2.6s linear infinite;
}
@keyframes sao3d-anh { from { background-position: 100% 0; } to { background-position: -160% 0; } }
@keyframes sao3d-tho { 50% { filter: drop-shadow(0 0 .2em rgba(255, 120, 220, .9)) drop-shadow(0 0 .05em #fff); } }
@media (prefers-reduced-motion: reduce) { .sao3d.sao4.song, .sao3d.sao4.song::after { animation: none; } }
</style>
