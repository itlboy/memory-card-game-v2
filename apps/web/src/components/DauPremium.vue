<script setup lang="ts">
/**
 * DẤU PREMIUM NHỎ Ở GÓC TRÊN PHẢI AVATAR (26.11.2026, mockup duyệt https://claude.ai/artifact/UTdgp7a6ngSsiWyv3ZXz7U — chủ dự án:
 * "huy hiệu nhỏ xíu hiển thị trên hoặc gần avatar để biết là người dùng premium", rồi "gắn bên trên góc phải").
 * Đặt LÀM CON TRỰC TIẾP của ô avatar: luật `:has()` bên dưới tự cho ô đó `position: relative`, dấu bám góc. Cỡ theo `em`
 * của ô avatar nên avatar to nhỏ gì dấu cũng cân. `loai` rỗng / lạ → không vẽ gì.
 */
import { Crown, Gem, Heart } from 'lucide-vue-next';
defineProps<{ loai?: string | null }>();
</script>

<template>
  <i v-if="loai === 'vm' || loai === 'tim' || loai === 'kc'" class="dau-pm" :class="loai" aria-hidden="true">
    <Crown v-if="loai === 'vm'" :stroke-width="2.8" /><Heart v-else-if="loai === 'tim'" :stroke-width="0" fill="currentColor" /><Gem v-else :stroke-width="2.6" />
  </i>
</template>

<style>
/* KHÔNG scoped: luật `:has()` phải chạm được ô avatar của component cha */
:where(.avatar, .hs-av, .mb-av, .av):has(> .dau-pm) { position: relative; overflow: visible; }
.dau-pm {
  position: absolute; top: -.32em; right: -.36em; z-index: 1; display: grid; place-items: center;
  width: .78em; height: .78em; min-width: 14px; min-height: 14px; border-radius: 50%; font-style: normal; line-height: 1;
  box-shadow: 0 0 0 1.5px var(--panel-solid, #fff);
}
.dau-pm svg { width: 62%; height: 62%; }
.dau-pm.vm { background: #f5b324; color: #5b3d00; }
.dau-pm.tim { background: #ef4f7a; color: #fff; }
.dau-pm.kc { background: #2bb3e6; color: #fff; }
</style>
