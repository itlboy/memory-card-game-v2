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
  <div class="wrap">
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
/* KHÔNG SCROLL: 20 màn nén vừa chỗ còn lại — 4 cột mobile / 5 cột desktop */
.wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.summary { margin: 0 0 8px; color: var(--muted); font-size: 14px; }
.map {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(0, 1fr); overflow: hidden;
  gap: 6px; list-style: none; margin: 0; padding: 0;
}
li { display: flex; min-height: 0; align-items: center; }
.node { max-height: 96px; }
.node {
  width: 100%; min-height: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0; padding: 4px 2px; overflow: hidden;
  border: 2px solid var(--line); border-radius: 12px; background: transparent;
  container-type: inline-size;   /* số màn co theo cỡ ô, như các ô lựa chọn khác */
}
.node b { font-size: clamp(18px, 26cqw, 26px); }
.node small { color: var(--muted); font-size: clamp(11px, 15cqw, 14px); }
.node .stars { font-size: clamp(11px, 14cqw, 15px); color: var(--warn); letter-spacing: 1px; }
.node.cleared { border-color: var(--ok); }
.node.locked { opacity: .45; }
</style>
