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
const lives = computed(() =>
  props.game.config.lives == null ? null : (s.players.value[0]?.lives ?? 0)
);
const locked = computed(() => s.locked.value || s.revealingAll.value);
</script>

<template>
  <section class="game">
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
  </section>
</template>

<style scoped>
.game { display: flex; flex-direction: column; gap: 10px; }
.toast {
  margin: 0; padding: 8px 12px; border-radius: 10px; font-size: 14px; text-align: center;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.toast.peek { background: color-mix(in srgb, var(--warn) 18%, transparent); }
</style>
