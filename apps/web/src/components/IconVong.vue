<script setup lang="ts">
import { computed } from 'vue';
import { ICON_VONG, type TenIcon } from '@/lib/icon-vong';

/** Icon Lucide trong vòng màu theo nghĩa — xem lib/icon-vong.ts (luật: không emoji hệ thống làm icon). */
const p = withDefaults(defineProps<{ ic: TenIcon; size?: number }>(), { size: 28 });
const muc = computed(() => ICON_VONG[p.ic]);
</script>

<template>
  <span class="ic-vong" :class="`iv-${muc.mau}`" :style="{ '--iv': `${size}px` }" aria-hidden="true">
    <component :is="muc.c" :size="Math.round(size * .56)" :stroke-width="2.5" />
  </span>
</template>

<style scoped>
.ic-vong {
  flex: none; width: var(--iv); height: var(--iv); border-radius: 50%; display: inline-grid; place-items: center;
  box-sizing: border-box; color: #fff; vertical-align: middle;
  background: linear-gradient(var(--iv-a), var(--iv-b)); box-shadow: 0 2px 0 var(--iv-c);
}
.iv-xanh { --iv-a: #5fd27f; --iv-b: #2f9e57; --iv-c: #227a41; }
.iv-do { --iv-a: #ff8f70; --iv-b: #e0533a; --iv-c: #b13c27; }
.iv-vang { --iv-a: #ffd35a; --iv-b: #f0a816; --iv-c: #c0820b; color: #5a3d00; }
.iv-xam { --iv-a: #aab3cc; --iv-b: #7d88a8; --iv-c: #646f8f; }
.iv-tim { --iv-a: #9d8fff; --iv-b: #6a5cff; --iv-c: #4b3fd1; }
/* Màn tối: vòng sẫm hơn một nấc để không loá trên nền tối */
:global([data-theme='dark'] .ic-vong) { filter: saturate(.9) brightness(.92); }
</style>
