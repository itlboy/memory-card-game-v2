<script setup lang="ts">
import { computed } from 'vue';
import { clock } from '@/lib/format';

const props = defineProps<{
  score: number;
  moves: number;
  matched: number;
  totalPairs: number;
  combo: number;
  elapsed: number;
  timeLeft: number | null;
  movesLeft: number | null;
  lives: number | null;
  levelId?: number;
}>();

defineEmits<{ quit: [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
const timeLabel = computed(() => (props.timeLeft === null ? 'Thời gian' : 'Còn lại'));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
</script>

<template>
  <div class="hud panel">
    <div v-if="levelId" class="stat"><span>Màn</span><b>{{ levelId }}</b></div>
    <div class="stat"><span>Điểm</span><b>{{ score }}</b></div>
    <div class="stat"><span>Lượt</span><b>{{ moves }}<i v-if="movesLeft !== null">/{{ moves + movesLeft }}</i></b></div>
    <div class="stat"><span>Cặp</span><b>{{ matched }}/{{ totalPairs }}</b></div>
    <div class="stat" :class="{ urgent }"><span>{{ timeLabel }}</span><b>{{ timeText }}</b></div>
    <div class="stat"><span>Combo</span><b>x{{ combo }}</b></div>
    <div v-if="lives !== null" class="stat"><span>Mạng</span><b>{{ '❤️'.repeat(Math.max(0, lives)) || '—' }}</b></div>
    <button class="btn quit" aria-label="Thoát về menu" type="button" @click="$emit('quit')">✕</button>
  </div>
</template>

<style scoped>
.hud { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; }
.stat { display: flex; flex-direction: column; min-width: 52px; }
.stat span { font-size: 11px; text-transform: uppercase; color: var(--muted); }
.stat b { font-variant-numeric: tabular-nums; }
.stat b i { font-style: normal; color: var(--muted); font-weight: 400; font-size: 13px; }
.stat.urgent b { color: var(--bad); }
.quit { margin-left: auto; }
</style>
