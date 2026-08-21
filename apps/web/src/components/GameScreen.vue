<script setup lang="ts">
import type { MemoryGame } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import BoardGrid from './BoardGrid.vue';
import HudBar from './HudBar.vue';
import PlayerStrip from './PlayerStrip.vue';
import type { useGameSession } from '@/composables/useGameSession';

const props = defineProps<{
  session: ReturnType<typeof useGameSession>;
  game: MemoryGame;
  levelId?: number;
}>();

const emit = defineEmits<{ quit: [] }>();
const board = ref<InstanceType<typeof BoardGrid> | null>(null);
onMounted(() => board.value?.focusFirst());

const s = props.session;
const POWER_TEXT: Record<string, string> = {
  bomb: '💥 Thẻ bom! Hai cặp đã mở bị úp lại.',
  x2: '✖️ Cặp tiếp theo được nhân đôi điểm!',
  eye: '👁️ Mắt thần — nhìn nhanh trong 2 giây!',
  freeze: '❄️ Đóng băng — đối thủ mất một lượt!'
};

const soloScore = computed(() => s.players.value[0]?.score ?? 0);

/** Vị trí hiệu ứng "+điểm": tâm của ô thẻ vừa ghép, tính theo % của lưới. */
const gainStyle = computed(() => {
  const g = s.lastGain.value;
  if (!g) return {};
  const cols = props.game.config.cols;
  const rows = props.game.config.rows;
  const col = g.index % cols;
  const row = Math.floor(g.index / cols);
  return {
    left: `${((col + 0.5) / cols) * 100}%`,
    top: `${((row + 0.5) / rows) * 100}%`
  };
});
const lives = computed(() =>
  props.game.config.lives == null ? null : (s.players.value[0]?.lives ?? 0)
);
const locked = computed(() => s.locked.value || s.revealingAll.value);

/**
 * Bàn thẻ phải lọt trọn màn hình, không cuộn: giới hạn bề rộng theo
 * (chiều cao viewport − phần khung phía trên) × tỉ lệ khung của lưới.
 * Thẻ tỉ lệ 3:4 nên lưới rộng/cao ≈ (cols·3)/(rows·4).
 */
const fitStyle = computed(() => {
  const { cols, rows } = props.game.config;
  const chrome = props.game.isMultiplayer ? 320 : 230;   // topbar + HUD + đệm
  return {
    '--fit': `min(100%, calc((100dvh - ${chrome}px) * ${(cols * 3) / (rows * 4)}))`
  };
});
</script>

<template>
  <section class="game" :style="fitStyle">
    <HudBar
      :score="soloScore"
      :moves="s.moves.value"
      :matched="s.matchedCount.value"
      :total-pairs="s.totalPairs.value"
      :combo="s.combo.value"
      :elapsed="s.elapsed.value"
      :time-left="s.timeLeft.value"
      :moves-left="s.movesLeft.value"
      :lives="lives"
      :level-id="levelId"
      @quit="emit('quit')"
    />

    <PlayerStrip
      v-if="game.isMultiplayer"
      :players="s.players.value"
      :current-id="s.current.value?.id ?? ''"
    />

    <p v-if="s.revealingAll.value" class="toast peek" role="status">
      👀 Ghi nhớ vị trí các thẻ…
    </p>
    <p v-else-if="s.lastPower.value" class="toast" role="status">
      {{ POWER_TEXT[s.lastPower.value.power] }}
    </p>

    <div class="board-wrap">
      <BoardGrid
        ref="board"
        :cards="s.cards.value"
        :cols="game.config.cols"
        :face-up="s.faceUp.value"
        :matched="s.matchedSet.value"
        :wrong-pair="s.wrongPair.value"
        :revealing-all="s.revealingAll.value"
        :locked="locked"
        @flip="s.flip"
      />
      <span
        v-if="s.lastGain.value"
        :key="s.lastGain.value.key"
        class="gain"
        :style="gainStyle"
        aria-hidden="true"
      >+{{ s.lastGain.value.amount }}</span>
    </div>
  </section>
</template>

<style scoped>
.game { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.board-wrap {
  position: relative; flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}
.board-wrap :deep(.board) { width: var(--fit, 100%); }
.gain {
  position: absolute; transform: translate(-50%, -50%);
  font-weight: 800; font-size: clamp(16px, 4vw, 24px); color: var(--gold);
  text-shadow: 0 1px 8px rgba(0, 0, 0, .35);
  pointer-events: none;
  animation: rise 1s ease-out forwards;
}
@keyframes rise {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(.7); }
  20% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(1); }
}
.toast {
  margin: 0; padding: 8px 12px; border-radius: 10px; font-size: 14px; text-align: center;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.toast.peek { background: color-mix(in srgb, var(--warn) 18%, transparent); }
</style>
