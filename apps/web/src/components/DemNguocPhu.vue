<script setup lang="ts">
/**
 * ĐẾM NGƯỢC TRÊN LỚP PHỦ TỐI — CÙNG kiểu đếm ngược vào ván ghép cặp online (OnlineGame `.countdown`, mockup duyệt
 * 09.11.2026 https://claude.ai/artifact/XLV7MArxK818WLkYLXMMKp). Tìm Thẻ dùng ở: đếm ngược vào ván online, và đếm 3-2-1
 * trước MỖI lần lật bàn cho nhớ (chủ dự án 27.11.2026: "lật thẻ hơi bất ngờ… cho người chơi chuẩn bị tinh thần", "đếm
 * ngược phải có lớp phủ mờ đen").
 *
 * Nền tối nằm NGAY trên khối fixed, inset 0 (kín màn từ khung đầu), chỉ mờ dần độ trong — KHÔNG backdrop-filter, KHÔNG
 * phần tử phủ lớn dần (bài học 16.10.2026: "nháy chưa kín màn rồi mới kín"). Số trắng viền bằng text-shadow 8 hướng —
 * KHÔNG -webkit-text-stroke (Safari vẽ viền đè chữ thành "vòng đen").
 * Teleport ra #app (như KetCucFx) để phủ cả thanh trên, không bị khung cha có transform giam lại.
 */
defineProps<{ n: number }>();
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');
</script>

<template>
  <Teleport to="#app" :disabled="!coApp">
    <div class="dem-phu" role="status" aria-live="assertive">
      <span :key="n" class="so">{{ n }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
.dem-phu {
  /* 16: TRÊN thanh trên cùng (TopBar 15), như `.countdown` của OnlineGame */
  position: fixed; inset: 0; z-index: 16;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10, 14, 40, .55);
  animation: phu .2s ease-out;
  pointer-events: none;
}
@keyframes phu { from { background-color: rgba(10, 14, 40, 0); } }
.so {
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(80px, 30vw, 150px); line-height: 1;
  --vs: .016em; --vm: #17193a;
  color: #fff;
  text-shadow:
    var(--vs) 0 var(--vm), calc(-1 * var(--vs)) 0 var(--vm), 0 var(--vs) var(--vm), 0 calc(-1 * var(--vs)) var(--vm),
    var(--vs) var(--vs) var(--vm), calc(-1 * var(--vs)) var(--vs) var(--vm),
    var(--vs) calc(-1 * var(--vs)) var(--vm), calc(-1 * var(--vs)) calc(-1 * var(--vs)) var(--vm);
  animation: pop .9s cubic-bezier(.2, 1.4, .4, 1);
}
@keyframes pop { 0% { transform: scale(1.7); opacity: 0; } 30% { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dem-phu, .so { animation: none; } }
</style>
