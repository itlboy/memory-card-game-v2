<script setup lang="ts">
import type { MemoryGame } from '@mm/engine';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BoardGrid from './BoardGrid.vue';
import HudBar from './HudBar.vue';
import PlayerStrip from './PlayerStrip.vue';
import type { useGameSession } from '@/composables/useGameSession';

const props = defineProps<{
  session: ReturnType<typeof useGameSession>;
  game: MemoryGame;
  levelId?: number;
  /** Số ván thắng của từng người trong loạt (theo tên). */
  seriesWins?: Record<string, number>;
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

/** Điểm vừa cộng có phải combo không — combo mới có vòng sáng lan. */
const gainHot = computed(() => s.combo.value >= 1.5);
/** Đổi số này để con số Điểm ở HUD nảy đúng lúc điểm bay tới. */
const scoreBump = ref(0);
const gainEl = ref<HTMLElement | null>(null);
let bumpTimer: ReturnType<typeof setTimeout> | undefined;

/** Đích của điểm bay: ô "Điểm" ở HUD, hoặc ô điểm trong chip người đang chơi. */
function scoreTarget(): Element | null {
  const root = gainEl.value?.closest('.game');
  if (!root) return null;
  const id = s.current.value?.id;
  return props.game.isMultiplayer && id
    ? root.querySelector(`[data-pts-for="${id}"]`)
    : root.querySelector('[data-score-target] b');
}

// Điểm phải BAY VỀ chỗ nó được ghi, không thì con số hiện lên rồi tan đi mà
// người chơi không nối được với ô Điểm. Toạ độ đo thật vì HUD đổi bố cục
// theo chế độ (multiplayer ẩn Điểm, Sinh tồn thêm Mạng…).
watch(() => s.lastGain.value?.key, async (key) => {
  if (!key) return;
  clearTimeout(bumpTimer);
  await nextTick();
  const el = gainEl.value;
  const target = scoreTarget();
  if (!el || !target) return;
  const from = el.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  el.style.setProperty('--to-x', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  el.style.setProperty('--to-y', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
  bumpTimer = setTimeout(() => { scoreBump.value++; }, 850);   // đúng lúc cập bến
});

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
/** Ván Chớp nhoáng: màn đếm ngược nói sắp mở bài thay vì báo người đi đầu. */
const isPeek = computed(() => (props.game.config.peekMs ?? 0) > 0);

/**
 * Bàn thẻ phải lọt trọn màn hình và LẤP hết chỗ được chia.
 * Cách cũ trừ một hằng số "chrome" đoán trước (230/255px) rồi khoá thẻ ở 3:4:
 * hằng số đoán sai, và tỉ lệ cứng khiến lưới vuông trên màn dọc chạm bề rộng
 * trước rồi bỏ không hàng trăm pixel chiều cao (4×4 thừa 301px trên iPhone 13).
 * Giờ đo thật chỗ còn lại, và cho thẻ cao thêm tới 5:8 để lấp phần dư.
 */
const wrap = ref<HTMLElement | null>(null);
const cardAspect = ref(0.75);
const boardWidth = ref<number | null>(null);
/** Thẻ không được gầy hơn mức này. 0,58 là tỉ lệ lá tarot — vẫn ra dáng lá bài,
 *  mà lấp được phần chiều cao dư của lưới vuông trên màn dọc. */
const MIN_ASPECT = 0.58;
const MAX_ASPECT = 0.75;   // 3:4 — dáng lá bài chuẩn

function measureBoard(): void {
  const el = wrap.value;
  if (!el) return;
  const { cols, rows } = props.game.config;
  const availW = el.clientWidth;
  const availH = el.clientHeight;
  if (!availW || !availH) return;
  const gap = availW < 420 ? 6 : 8;
  const cellW = (availW - gap * (cols - 1)) / cols;
  const cellH = (availH - gap * (rows - 1)) / rows;
  // Ưu tiên lấp cả hai chiều; kẹp trong khoảng dáng thẻ chấp nhận được
  const ar = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, cellW / cellH));
  const cardH = Math.min(cellH, cellW / ar);
  cardAspect.value = ar;
  boardWidth.value = Math.floor(cardH * ar * cols + gap * (cols - 1));
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  measureBoard();
  ro = new ResizeObserver(measureBoard);
  if (wrap.value) ro.observe(wrap.value);
});
onBeforeUnmount(() => ro?.disconnect());
watch(() => [props.game.config.cols, props.game.config.rows], measureBoard);

const fitStyle = computed(() => ({
  '--card-ar': String(cardAspect.value),
  '--fit': boardWidth.value ? `${boardWidth.value}px` : '100%'
}));
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
      :score-bump="scoreBump"
      @quit="emit('quit')"
    />

    <PlayerStrip
      v-if="game.isMultiplayer"
      :players="s.players.value"
      :current-id="s.current.value?.id ?? ''"
      :turn-left="s.turnTimeLeft.value"
      :bonus-for="s.timeBonusFor.value"
      :series-wins="seriesWins"
    />

    <div ref="wrap" class="board-wrap">
      <!-- Thông báo NỔI trên bàn: để trong luồng thì mỗi lần hiện/ẩn là bàn thẻ
           bị đẩy lên đẩy xuống, vừa khó chịu vừa dễ bấm nhầm ô. -->
      <Transition name="toast">
        <p v-if="s.revealingAll.value" class="toast peek" role="status">
          <!-- Chữ ngắn để thông báo gọn MỘT dòng: hai dòng thì nó che thêm một
               hàng thẻ, mà đây đúng là lúc người chơi cần nhìn cả bàn. -->
          👀 Ghi nhớ vị trí!
          <b v-if="s.peekLeft.value !== null" class="peek-clock">{{ Math.ceil(s.peekLeft.value) }}s</b>
        </p>
        <p v-else-if="s.lifeGain.value" :key="`life-${s.lifeGain.value.key}`" class="toast life" role="status">
          ❤️ Hồi 1 mạng — ghép đúng hai lần liền!
        </p>
        <p v-else-if="s.lastPower.value" :key="s.lastPower.value.index" class="toast" role="status">
          {{ POWER_TEXT[s.lastPower.value.power] }}
        </p>
      </Transition>
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
      <template v-if="s.lastGain.value">
        <span
          ref="gainEl"
          :key="s.lastGain.value.key"
          class="gain"
          :style="gainStyle"
          aria-hidden="true"
        >+{{ s.lastGain.value.amount }}</span>
        <!-- Vòng sáng chỉ dành cho combo: thường xuyên quá thì hết đặc biệt -->
        <span
          v-if="gainHot"
          :key="`ring-${s.lastGain.value.key}`"
          class="gain-ring"
          :style="gainStyle"
          aria-hidden="true"
        />
      </template>

      <!-- Đếm ngược 5 giây trước ván: báo người đi đầu (multiplayer), hoặc báo
           trước khi cả bàn bật lên (Chớp nhoáng) -->
      <div v-if="s.countdownLeft.value !== null" class="countdown" role="status" aria-live="assertive">
        <span class="num" :key="s.countdownLeft.value">{{ s.countdownLeft.value }}</span>
        <span v-if="isPeek" class="first">👀 Sắp mở cả bàn — <b>chuẩn bị ghi nhớ!</b></span>
        <span v-else class="first">🎲 <b>{{ s.current.value?.name }}</b> đi trước!</span>
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
/* Số điểm bật lên ở tâm thẻ vừa ghép rồi BỊ HÚT về ô Điểm. Đích truyền vào
   bằng --to-x/--to-y (đo bằng getBoundingClientRect) chứ không phải % cố định,
   vì HUD đổi bố cục theo chế độ chơi. */
.gain {
  --to-x: 0px; --to-y: -120px;
  position: absolute; transform: translate(-50%, -50%);
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(18px, 4.5vw, 26px); color: var(--gold);
  text-shadow: 0 2px 10px rgba(217, 158, 0, .5);
  pointer-events: none;
  animation: gain-suck 1.05s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes gain-suck {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); }
  45% { opacity: 1; transform: translate(calc(-50% + var(--to-x) * .18), calc(-50% + var(--to-y) * .18)) scale(1.2); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--to-x)), calc(-50% + var(--to-y))) scale(.45); }
}
/* Vòng sáng lan từ thẻ — chỉ khi đang có combo */
.gain-ring {
  position: absolute;
  width: 70px; height: 70px; margin: -35px 0 0 -35px;
  border: 3px solid var(--gold); border-radius: 50%;
  pointer-events: none;
  animation: gain-ring .7s ease-out forwards;
}
@keyframes gain-ring {
  0% { opacity: .9; transform: scale(.4); }
  100% { opacity: 0; transform: scale(2.6); }
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
/* GIỮA bàn, không đẩy bố cục. Trước đây nằm sát mép trên (top: 8px) nên che
   đúng hàng thẻ đầu — chỗ người chơi đang bấm. Giữa bàn thì đọc xong là biến,
   và hơi trong suốt để vẫn thấy thẻ phía sau. */
.toast {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 8; max-width: min(94%, 460px);
  margin: 0; padding: 10px 16px; border-radius: var(--r-full);
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(15px, 4.2vw, 20px); line-height: 1.25; text-align: center;
  color: var(--fg); background: var(--panel-solid);
  border: 2px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  box-shadow: var(--shadow);
  opacity: .93;
  /* Làm mờ thẻ ngay dưới thông báo, để chữ đọc được mà bàn vẫn hiện ra */
  backdrop-filter: blur(2px);
  pointer-events: none;
}
.toast.peek { border-color: color-mix(in srgb, var(--warn) 65%, var(--line)); }
/* Đồng hồ đếm giây còn lại của lúc hé mở — cùng dòng với thông báo, không đẩy
   bố cục; số cố định bề rộng để 3s→2s không làm dòng chữ nhảy qua nhảy lại. */
.peek-clock {
  display: inline-block; min-width: 2.2em; margin-left: 4px;
  padding: 1px 7px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn);
  font-variant-numeric: tabular-nums;
}
.toast.life { border-color: color-mix(in srgb, var(--ok) 70%, var(--line)); }
.toast-enter-active { animation: toast-in .32s cubic-bezier(.3, 1.5, .5, 1); }
.toast-leave-active { transition: opacity .3s ease, transform .3s ease; }
.toast-leave-to { opacity: 0; transform: translate(-50%, -60%) scale(.96); }
@keyframes toast-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(.88); }
  to { opacity: .93; transform: translate(-50%, -50%) scale(1); }
}
</style>
