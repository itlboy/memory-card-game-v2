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
  /** Đổi số này để con số Điểm nảy một nhịp (khi điểm vừa bay tới). */
  scoreBump?: number;
}>();

defineEmits<{ quit: [] }>();

const timeText = computed(() => clock(props.timeLeft ?? props.elapsed));
const timeLabel = computed(() => (props.timeLeft === null ? 'Thời gian' : 'Còn lại'));
const urgent = computed(() => props.timeLeft !== null && props.timeLeft <= 10);
</script>

<template>
  <div class="hud panel">
    <div class="stats">
    <div v-if="levelId" class="stat"><span>Màn</span><b>{{ levelId }}</b></div>
    <div v-if="!multiplayer" class="stat" data-score-target>
      <span>Điểm</span><b :key="scoreBump" :class="{ bump: scoreBump }">{{ score }}</b>
    </div>
    <div v-if="!multiplayer" class="stat"><span>Lượt</span><b>{{ moves }}<i v-if="movesLeft !== null">/{{ moves + movesLeft }}</i></b></div>
    <div class="stat"><span>Cặp</span><b>{{ matched }}/{{ totalPairs }}</b></div>
    <div class="stat" :class="{ urgent }"><span>{{ timeLabel }}</span><b>{{ timeText }}</b></div>
    <div v-if="!multiplayer" class="stat combo" :class="{ hot: combo >= 1.5, max: combo >= 2 }">
      <span>Combo</span><b :key="combo">x{{ combo }}</b>
    </div>
    <div v-if="lives !== null" class="stat"><span>Mạng</span><b>{{ lives > 0 ? `❤️ ${lives}` : '—' }}</b></div>
    </div>
    <button class="btn quit" aria-label="Thoát về menu" type="button" @click="$emit('quit')"><X :size="20" /></button>
  </div>
</template>

<style scoped>
/* Nút thoát KHÔNG nằm cùng dòng wrap với các số: trước đây nhiều chỉ số
   (Màn·Điểm·Lượt·Cặp·Còn lại·Combo·Mạng) đẩy nó rơi xuống hàng dưới. Giờ các
   số wrap trong .stats, nút luôn dính góc phải. */
.hud { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.stats { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.quit { flex-shrink: 0; }
.stat { display: flex; flex-direction: column; min-width: 52px; }
/* Cột app luôn hẹp (≤440px) nên đây là bố cục duy nhất, không đặt trong media
   query: 6 chỉ số của Sinh tồn phải vừa MỘT dòng, trước đây vượt vài pixel nên
   xuống hàng làm HUD cao gấp đôi. */
.hud { gap: 6px; padding: 8px 10px; }
.stats { gap: 6px; }
.stat { min-width: 0; }
.stat span { font-size: 10px; letter-spacing: .03em; }
.stat b { font-size: var(--text-md); }
.stat span {
  font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted); font-weight: 700;
}
.stat b {
  font-variant-numeric: tabular-nums; font-family: var(--font-display);
  font-size: var(--text-lg); line-height: 1.2;
}
.stat b i { font-style: normal; color: var(--muted); font-weight: 400; font-size: 13px; }
/* Điểm vừa được cộng bay tới: con số nảy và thắp vàng — nối liền hiệu ứng
   trên bàn với chỗ điểm thật sự được ghi */
.stat b.bump { animation: score-bump .4s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes score-bump {
  45% { transform: scale(1.4); color: var(--gold); }
}
.stat.urgent b { color: var(--bad); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .35; } }
.combo b { display: inline-block; animation: bump .3s cubic-bezier(.3, 1.6, .5, 1); }
.combo.hot b { color: var(--warn); }
.combo.max b {
  color: var(--gold);
  text-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent);
}
@keyframes bump { 40% { transform: scale(1.35); } }
</style>
