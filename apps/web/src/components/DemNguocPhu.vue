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
import MatNguoi from './MatNguoi.vue';

/** `diTruoc`: dòng "X đi trước" dưới con số (ghép cặp online — ván có lượt). */
defineProps<{ n: number; diTruoc?: { mat?: string; anh?: string; chu: string } | null }>();
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');
</script>

<template>
  <Teleport to="#app" :disabled="!coApp">
    <div class="dem-phu" role="status" aria-live="assertive">
      <span :key="n" class="so">{{ n }}</span>
      <span v-if="diTruoc" class="first"><span class="mat-dau"><MatNguoi :mat="diTruoc.mat" :anh="diTruoc.anh" /></span> <b>{{ diTruoc.chu }}</b></span>
    </div>
  </Teleport>
</template>

<style scoped>
.dem-phu {
  /* 16: TRÊN thanh trên cùng (TopBar 15), như `.countdown` của OnlineGame */
  position: fixed; inset: 0; z-index: 16;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
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
/* Dòng "X đi trước" — chép nguyên từ `.countdown .first` của OnlineGame (mockup duyệt 09.11.2026) */
.mat-dau { display: inline-grid; place-items: center; font-size: 1.5em; line-height: 1; }
.first {
  display: flex; align-items: center; gap: 7px; white-space: nowrap;
  font-size: clamp(16px, 4.5vw, 22px); padding: 6px 18px; border-radius: var(--r-full);
  /* XANH LÁ (09.11.2026): ô trắng cũ trùng mặt lá sáng, vàng thì trùng sao lưng bài — xanh khác cả hai */
  background: linear-gradient(#a3ec72, #46ad22); border: 2px solid #33861a; color: #fff;
  box-shadow: 0 4px 0 #23600f, 0 10px 28px rgba(0, 0, 0, .35);
}
.first b {
  color: #fff;
  font-family: var(--font-display); font-weight: 800; letter-spacing: .01em;
  --vs: 1.2px; --vm: #23600f;
  text-shadow:
    var(--vs) 0 var(--vm), calc(-1 * var(--vs)) 0 var(--vm), 0 var(--vs) var(--vm), 0 calc(-1 * var(--vs)) var(--vm),
    var(--vs) var(--vs) var(--vm), calc(-1 * var(--vs)) var(--vs) var(--vm),
    var(--vs) calc(-1 * var(--vs)) var(--vm), calc(-1 * var(--vs)) calc(-1 * var(--vs)) var(--vm),
    0 2px 0 var(--vm);
}
@media (prefers-reduced-motion: reduce) { .dem-phu, .so { animation: none; } }
</style>
