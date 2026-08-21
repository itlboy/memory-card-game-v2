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
// Nhiều người: mạng hiển thị trong chip từng người, không chiếm chỗ HUD
const lives = computed(() =>
  props.game.config.lives == null || props.game.isMultiplayer
    ? null
    : (s.players.value[0]?.lives ?? 0)
);
const locked = computed(() => s.locked.value || s.revealingAll.value || s.countdownLeft.value !== null);

/**
 * Bàn thẻ phải lọt trọn màn hình, không cuộn: giới hạn bề rộng theo
 * (chiều cao viewport − phần khung phía trên) × tỉ lệ khung của lưới.
 * Thẻ tỉ lệ 3:4 nên lưới rộng/cao ≈ (cols·3)/(rows·4).
 */
const fitStyle = computed(() => {
  const { cols, rows } = props.game.config;
  const chrome = props.game.isMultiplayer ? 255 : 230;   // topbar + HUD (+ chip người chơi) + đệm
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
      :multiplayer="game.isMultiplayer"
      @quit="emit('quit')"
    />

    <PlayerStrip
      v-if="game.isMultiplayer"
      :players="s.players.value"
      :current-id="s.current.value?.id ?? ''"
      :turn-left="s.turnTimeLeft.value"
      :bonus-for="s.timeBonusFor.value"
    />

    <p v-if="s.revealingAll.value" class="toast peek" role="status">
      👀 Ghi nhớ vị trí các thẻ…
    </p>
    <p v-else-if="s.reshuffled.value" :key="s.reshuffled.value.key" class="toast shuffle" role="status">
      🔀 Các thẻ chưa mở vừa đổi chỗ cho nhau!
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
        :back="s.backStyle.value"
        @flip="s.flip"
      />
      <span
        v-if="s.lastGain.value"
        :key="s.lastGain.value.key"
        class="gain"
        :style="gainStyle"
        aria-hidden="true"
      >+{{ s.lastGain.value.amount }}</span>

      <!-- Đếm ngược 5 giây trước ván multiplayer + báo người đi đầu -->
      <div v-if="s.countdownLeft.value !== null" class="countdown" role="status" aria-live="assertive">
        <span class="num" :key="s.countdownLeft.value">{{ s.countdownLeft.value }}</span>
        <span class="first">🎲 <b>{{ s.current.value?.name }}</b> đi trước!</span>
      </div>

      <!-- Banner chuyển lượt: hiện to giữa bàn rồi tự tan (MP-03) -->
      <Transition name="banner">
        <div
          v-if="s.turnBanner.value"
          :key="s.turnBanner.value.key"
          class="turn-banner"
          role="status"
          aria-live="polite"
        >
          <small v-if="s.turnBanner.value.frozen">❄️ {{ s.turnBanner.value.frozen }} bị đóng băng, mất lượt</small>
          <span class="who">
            <span class="avatar">{{ s.turnBanner.value.avatar || '🎮' }}</span>
            Đến lượt <b>{{ s.turnBanner.value.name }}</b>
          </span>
        </div>
      </Transition>
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

.countdown {
  position: absolute; inset: 0; z-index: 7;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(3px); border-radius: var(--r-lg); pointer-events: none;
}
.countdown .num {
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(80px, 30vw, 150px); line-height: 1; color: var(--accent);
  text-shadow: 0 10px 40px var(--card-back-glow);
  animation: cd-pop .9s cubic-bezier(.2, 1.4, .4, 1);
}
@keyframes cd-pop { 0% { transform: scale(1.7); opacity: 0; } 30% { transform: scale(1); opacity: 1; } }
.countdown .first {
  font-size: clamp(16px, 4.5vw, 22px); padding: 6px 18px; border-radius: var(--r-full);
  background: var(--panel); border: 2px solid var(--accent); box-shadow: var(--shadow);
}
.countdown .first b { color: var(--accent); }

.turn-banner {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 26px; border-radius: 16px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  border: 2px solid var(--accent);
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px);
  pointer-events: none; z-index: 5; white-space: nowrap;
}
.turn-banner .who { display: flex; align-items: center; gap: 8px; font-size: clamp(17px, 4.5vw, 22px); }
.turn-banner b { color: var(--accent); }
.turn-banner .avatar { font-size: clamp(24px, 6vw, 32px); animation: wave .5s ease; }
.turn-banner small { color: var(--muted); font-size: 12.5px; }
@keyframes wave { 40% { transform: rotate(-12deg) scale(1.2); } 70% { transform: rotate(9deg); } }

.banner-enter-active { transition: opacity .18s ease, transform .25s cubic-bezier(.3, 1.5, .5, 1); }
.banner-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(.6); }
.banner-leave-active { transition: opacity .3s ease, transform .3s ease; }
.banner-leave-to { opacity: 0; transform: translate(-50%, -85%) scale(.95); }
.toast {
  margin: 0; padding: 8px 12px; border-radius: 10px; font-size: 14px; text-align: center;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.toast.peek { background: color-mix(in srgb, var(--warn) 18%, transparent); }
.toast.shuffle {
  background: color-mix(in srgb, var(--bad) 14%, transparent);
  animation: shuffle-in .3s cubic-bezier(.3, 1.5, .5, 1);
}
@keyframes shuffle-in { from { transform: scale(.8); opacity: 0; } }
</style>
