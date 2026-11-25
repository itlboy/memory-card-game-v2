<script setup lang="ts">
import { baoHien } from '@/lib/dai-bao';
import MatNguoi from './MatNguoi.vue';
import BongNgo from './BongNgo.vue';
import IconVong from './IconVong.vue';

/**
 * DẢI BÁO CHUNG — một chỗ, một kiểu (lib/dai-bao.ts). Nổi `fixed` trên cùng, đè lên hàng trên cùng
 * của màn chứ KHÔNG chiếm chỗ (chủ dự án: "mất diện tích quá"). Chỉ mount MỘT bản (OnlineScreen).
 */
</script>

<template>
  <Teleport to="body">
    <Transition name="dai-bao">
      <div
        v-if="baoHien" :key="baoHien.so" class="dai-bao" :class="`b-${baoHien.loai}`"
        :role="baoHien.loai === 'can' || baoHien.loai === 'mang' ? 'alert' : 'status'"
      >
        <span v-if="baoHien.mat || baoHien.anh" class="db-mat" :class="{ 'co-mau': !!baoHien.mau }" :style="baoHien.mau ? { '--m': baoHien.mau } : undefined">
          <MatNguoi :mat="baoHien.mat ?? ''" :anh="baoHien.anh" />
          <BongNgo v-if="baoHien.loai === 'xem'" class="db-bong" :size="16" />
        </span>
        <!-- Icon vòng màu theo nghĩa (lib/icon-vong.ts, 21.11.2026) — thay emoji hệ thống và hai vòng xanh vẽ tay -->
        <IconVong v-else-if="baoHien.ic" :ic="baoHien.ic" :size="30" />
        <span class="db-chu">{{ baoHien.chu }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dai-bao {
  position: fixed; z-index: 90; left: 12px; right: 12px;
  top: calc(env(safe-area-inset-top, 0px) + 10px);
  max-width: 520px; margin: 0 auto; min-height: 46px; box-sizing: border-box;
  display: flex; align-items: center; gap: 10px; padding: 7px 14px;
  border-radius: 16px; border: 2px solid; pointer-events: none;
  font: 800 15px/1.25 var(--font-body);
  box-shadow: 0 4px 0 var(--db-day), 0 8px 22px rgba(14, 26, 58, .22);
}
.b-tot { background: #e3f7da; border-color: #7cc65f; --db-day: #9fd487; color: #185c2a; }
.b-can { background: #fff3c4; border-color: #f0c33c; --db-day: #ddb03a; color: #5a3d00; }
.b-roi { background: #f1f3f8; border-color: #b9c2d6; --db-day: #a9b3c9; color: #33405f; }
.b-mang { background: #ffe9e2; border-color: #f19a7c; --db-day: #e0896b; color: #7a2208; }
.b-xem { background: #e5efff; border-color: #9cc0f5; --db-day: #9cb8e6; color: #1f5aab; }
.db-mat {
  position: relative; flex: none; width: 30px; height: 30px; border-radius: 50%; background: #fff;
  display: grid; place-items: center; font-size: 19px; line-height: 1;
}
.db-mat :deep(img) { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.db-bong { position: absolute; right: -6px; bottom: -5px; }
.db-chu { min-width: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.b-can { animation: db-rung .5s .1s 2; }
/* MÀN TỐI (21.11.2026, chủ dự án: "thông báo trên màn hình tối hơi sáng quá"; mockup duyệt
   https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 1): nền sẫm ngả màu loại tin, viền vừa, chữ sáng dịu */
:global([data-theme='dark'] .dai-bao) { box-shadow: 0 4px 0 var(--db-day), 0 8px 22px rgba(0, 0, 0, .45); }
:global([data-theme='dark'] .dai-bao.b-tot) { background: #16301f; border-color: #3f8a52; --db-day: #0d1f14; color: #bfeccb; }
:global([data-theme='dark'] .dai-bao.b-can) { background: #33290f; border-color: #a9851f; --db-day: #1f1806; color: #ffe39a; }
:global([data-theme='dark'] .dai-bao.b-roi) { background: #222842; border-color: #4a5378; --db-day: #12162a; color: #d3d9f0; }
:global([data-theme='dark'] .dai-bao.b-mang) { background: #3a1d17; border-color: #b0563f; --db-day: #22100c; color: #ffc9b8; }
:global([data-theme='dark'] .dai-bao.b-xem) { background: #18284a; border-color: #4a76c4; --db-day: #0e1830; color: #c9dcff; }
:global([data-theme='dark'] .dai-bao .db-mat) { background: #2a3052; }
@keyframes db-rung { 25% { transform: translateX(-4px) rotate(-1deg); } 75% { transform: translateX(4px) rotate(1deg); } }
.dai-bao-enter-active, .dai-bao-leave-active { transition: transform .22s cubic-bezier(.3, 1.4, .5, 1), opacity .18s; }
.dai-bao-enter-from, .dai-bao-leave-to { transform: translateY(-16px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .b-can { animation: none; }
  .dai-bao-enter-active, .dai-bao-leave-active { transition: opacity .15s; }
  .dai-bao-enter-from, .dai-bao-leave-to { transform: none; }
}
/* Ô màu hồ sơ: vuông bo góc, tô đặc, phẳng (`.vong-mau` ở global.css) */
.dai-bao .db-mat.co-mau, :global([data-theme='dark'] .dai-bao .db-mat.co-mau) { border-radius: 9px; background: var(--m); }
</style>
