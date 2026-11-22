<script setup lang="ts">
import type { QuickSay } from '@mm/engine';
import { computed } from 'vue';
import { ICON_NOI } from '@/lib/noi-nhanh';

/** Icon của một câu nói nhanh: Lucide trong vòng màu (lib/noi-nhanh.ts `ICON_NOI`) — dùng ở khung chọn và bong bóng. */
const p = withDefaults(defineProps<{ id: QuickSay; size?: number }>(), { size: 24 });
const muc = computed(() => ICON_NOI[p.id]);
</script>

<template>
  <span class="ic-noi" :class="`in-${muc.mau}`" :style="{ '--in': `${size}px` }" aria-hidden="true">
    <component :is="muc.c" :size="Math.round(size * .58)" :stroke-width="2.6" />
  </span>
</template>

<style scoped>
.ic-noi {
  flex: none; width: var(--in); height: var(--in); border-radius: 50%; display: inline-grid; place-items: center; box-sizing: border-box;
  color: #fff; background: linear-gradient(var(--in-a), var(--in-b)); box-shadow: 0 2px 0 var(--in-c);
}
.in-vang { --in-a: #ffd35a; --in-b: #f0a816; --in-c: #c0820b; color: #5a3d00; }
.in-xanh { --in-a: #5fd27f; --in-b: #2f9e57; --in-c: #227a41; }
.in-xam { --in-a: #aab3cc; --in-b: #7d88a8; --in-c: #646f8f; }
.in-hong { --in-a: #ff8fb3; --in-b: #ef4f86; --in-c: #c23566; }
.in-troi { --in-a: #6cc4ff; --in-b: #2f8fe6; --in-c: #1f6fc0; }
.in-tim { --in-a: #9d8fff; --in-b: #6a5cff; --in-c: #4b3fd1; }
</style>
