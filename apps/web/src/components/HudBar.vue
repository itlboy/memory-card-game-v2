<script setup lang="ts">
import { X } from 'lucide-vue-next';
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
  /** Nhiều người chơi: ẩn Điểm/Lượt/Combo — các số này nằm trong chip từng người. */
  multiplayer?: boolean;
}>();

defineEmits<{ quit: [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
const timeLabel = computed(() => (props.timeLeft === null ? 'Thời gian' : 'Còn lại'));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
</script>

<template>
  <div class="hud panel">
    <div v-if="levelId" class="stat"><span>Màn</span><b>{{ levelId }}</b></div>
    <div v-if="!multiplayer" class="stat"><span>Điểm</span><b>{{ score }}</b></div>
    <div v-if="!multiplayer" class="stat"><span>Lượt</span><b>{{ moves }}<i v-if="movesLeft !== null">/{{ moves + movesLeft }}</i></b></div>
    <div class="stat"><span>Cặp</span><b>{{ matched }}/{{ totalPairs }}</b></div>
    <div class="stat" :class="{ urgent }"><span>{{ timeLabel }}</span><b>{{ timeText }}</b></div>
    <div v-if="!multiplayer" class="stat combo" :class="{ hot: combo >= 1.5, max: combo >= 2 }">
      <span>Combo</span><b :key="combo">x{{ combo }}</b>
    </div>
    <div v-if="lives !== null" class="stat"><span>Mạng</span><b>{{ '❤️'.repeat(Math.max(0, lives)) || '—' }}</b></div>
    <button class="btn quit" aria-label="Thoát về menu" type="button" @click="$emit('quit')"><X :size="20" /></button>
  </div>
</template>

<style scoped>
.hud { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; }
.stat { display: flex; flex-direction: column; min-width: 52px; }
.stat span {
  font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted); font-weight: 700;
}
.stat b {
  font-variant-numeric: tabular-nums; font-family: var(--font-display);
  font-size: var(--text-lg); line-height: 1.2;
}
.stat b i { font-style: normal; color: var(--muted); font-weight: 400; font-size: 13px; }
.stat.urgent b { color: var(--bad); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.combo b { display: inline-block; animation: bump .3s cubic-bezier(.3, 1.6, .5, 1); }
.combo.hot b { color: var(--warn); }
.combo.max b {
  color: var(--gold);
  text-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent);
}
@keyframes bump { 40% { transform: scale(1.35); } }
.quit { margin-left: auto; }
</style>
