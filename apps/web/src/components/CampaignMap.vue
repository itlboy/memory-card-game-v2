<script setup lang="ts">
import { allLevels } from '@mm/engine';
import { computed } from 'vue';
import type { LevelProgress } from '@/lib/storage';
import { starText } from '@/lib/format';

const props = defineProps<{ progress: Record<string, LevelProgress>; unlocked: number }>();
const emit = defineEmits<{ play: [id: number] }>();

const levels = allLevels();
const totalStars = computed(() => Object.values(props.progress).reduce((n, p) => n + p.stars, 0));
</script>

<template>
  <div>
    <p class="summary">Đã đạt <b>{{ totalStars }}</b> / {{ levels.length * 3 }} sao</p>
    <ol class="map">
      <li v-for="l in levels" :key="l.id">
        <button
          class="node"
          :class="{ locked: l.id > unlocked, cleared: (progress[String(l.id)]?.stars ?? 0) > 0 }"
          :disabled="l.id > unlocked"
          :aria-label="`Màn ${l.id}, lưới ${l.cols}×${l.rows}, ${l.timeLimit} giây${l.id > unlocked ? ', chưa mở khoá' : ''}`"
          type="button"
          @click="emit('play', l.id)"
        >
          <b>{{ l.id }}</b>
          <small>{{ l.cols }}×{{ l.rows }}</small>
          <span class="stars">{{ l.id > unlocked ? '🔒' : starText(progress[String(l.id)]?.stars ?? 0) }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.summary { margin: 0 0 10px; color: var(--muted); font-size: 14px; }
.map {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 8px; list-style: none; margin: 0; padding: 0;
}
.node {
  width: 100%; min-height: 72px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 1px; padding: 8px 4px;
  border: 2px solid var(--line); border-radius: 12px; background: transparent;
}
.node b { font-size: 18px; }
.node small { color: var(--muted); font-size: 11px; }
.node .stars { font-size: 11px; color: var(--warn); letter-spacing: 1px; }
.node.cleared { border-color: var(--ok); }
.node.locked { opacity: .45; }
</style>
