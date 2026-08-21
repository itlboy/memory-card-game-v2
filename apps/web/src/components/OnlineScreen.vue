<script setup lang="ts">
import { GRIDS, QUICK_EMOJIS } from '@mm/engine';
import type { Card } from '@mm/engine';
import { computed, onMounted, ref } from 'vue';
import BoardGrid from './BoardGrid.vue';
import HudBar from './HudBar.vue';
import ResultDialog from './ResultDialog.vue';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { store } from '@/lib/storage';
import { sfx } from '@/lib/audio';

const props = defineProps<{ joinCode?: string }>();
const emit = defineEmits<{ back: [] }>();

const o = useOnlineRoom();
const name = ref(store.playerNames()[0] ?? '');
const codeInput = ref(props.joinCode ?? '');
const copied = ref(false);
/** Vào bằng link mời: chỉ hiện đúng một việc — nhập tên rồi vào phòng. */
const invited = computed(() => !!props.joinCode);

onMounted(() => {
  // Vào bằng link mời: ý định là vào ĐÚNG phòng đó — đã có tên nhớ sẵn thì vào luôn
  if (invited.value) {
    if (name.value.trim()) join();
    return;
  }
  o.resumeStored();
});

function remember(): void { store.savePlayerNames([name.value.trim()]); }
function create(): void {
  if (!name.value.trim()) return;
  remember();
  void o.createRoom(name.value.trim());
}
function join(): void {
  if (!name.value.trim() || codeInput.value.trim().length !== 6) return;
  remember();
  o.join(codeInput.value, name.value.trim());
}
function quit(): void { o.leave(); emit('back'); }

const inviteLink = computed(() =>
  `${location.origin}${location.pathname}?room=${o.room.value?.code ?? ''}`);

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = true;
    sfx.select();
    setTimeout(() => { copied.value = false; }, 1600);
  } catch { /* trình duyệt chặn */ }
}

/* ---------- map view server → props của BoardGrid ---------- */
const cards = computed<Card[]>(() =>
  (o.view.value?.cards ?? []).map((c) => ({
    index: c.index,
    pairId: -1,
    symbol: c.symbol ?? '',
    ...(c.power ? { power: c.power as Card['power'] } : {}),
    ...(c.blank ? { blank: true } : {})
  })));
const faceUp = computed(() => new Set(
  (o.view.value?.cards ?? []).filter((c) => c.state !== 'down').map((c) => c.index)));
const matchedSet = computed(() => new Set(
  (o.view.value?.cards ?? []).filter((c) => c.state === 'matched').map((c) => c.index)));
const locked = computed(() => !o.myTurn.value || o.view.value?.status !== 'playing');

const gainStyle = computed(() => {
  const g = o.lastGain.value;
  const v = o.view.value;
  if (!g || !v) return {};
  return {
    left: `${(((g.index % v.cols) + 0.5) / v.cols) * 100}%`,
    top: `${((Math.floor(g.index / v.cols) + 0.5) / v.rows) * 100}%`
  };
});

const fitStyle = computed(() => {
  const v = o.view.value;
  if (!v) return {};
  return { '--fit': `min(100%, calc((100dvh - 300px) * ${(v.cols * 3) / (v.rows * 4)}))` };
});

const MODES = [
  { id: 'classic' as const, name: 'Cổ điển' },
  { id: 'survival' as const, name: 'Sinh tồn' }
];
const THEMES = [
  { id: 'animals', name: 'Động vật' }, { id: 'fruits', name: 'Trái cây' },
  { id: 'flags', name: 'Cờ quốc gia' }, { id: 'tech', name: 'Công nghệ' }
];
</script>

<template>
  <!-- NHẬP TÊN / TẠO / VÀO PHÒNG -->
  <section v-if="o.phase.value === 'idle' || o.phase.value === 'error' || o.phase.value === 'connecting'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Quay lại" type="button" @click="quit">‹</button>
      <h2>Chơi online</h2>
    </div>

    <p v-if="invited" class="invite">
      🎉 Bạn được mời vào phòng <b class="invite-code">{{ codeInput }}</b>
    </p>

    <label class="field">
      <span>Tên của bạn</span>
      <input v-model="name" maxlength="16" placeholder="VD: An" @keydown.enter="invited ? join() : create()">
    </label>

    <!-- Vào bằng link mời: một nút duy nhất, không hiện "Tạo phòng" để khỏi bấm nhầm -->
    <button
      v-if="invited" class="btn-primary"
      :disabled="!name.trim() || o.phase.value === 'connecting'"
      type="button" @click="join"
    >
      {{ o.phase.value === 'connecting' ? 'Đang vào phòng…' : 'Vào phòng chơi' }}
    </button>

    <template v-else>
      <button class="btn-primary" :disabled="!name.trim() || o.phase.value === 'connecting'" type="button" @click="create">
        {{ o.phase.value === 'connecting' ? 'Đang kết nối…' : 'Tạo phòng mới' }}
      </button>

      <div class="divider"><span>hoặc vào phòng có sẵn</span></div>

      <div class="joinrow">
        <input
          v-model="codeInput" class="code-input" maxlength="6" placeholder="MÃ PHÒNG"
          autocapitalize="characters" spellcheck="false" @keydown.enter="join"
        >
        <button class="btn join" :disabled="!name.trim() || codeInput.trim().length !== 6" type="button" @click="join">
          Vào phòng
        </button>
      </div>
    </template>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- LOBBY -->
  <section v-else-if="o.phase.value === 'lobby'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Rời phòng" type="button" @click="quit">‹</button>
      <h2>Phòng chờ</h2>
      <button class="btn code" type="button" :title="inviteLink" @click="copyLink">
        {{ o.room.value?.code }} {{ copied ? '✓ đã chép' : '⧉' }}
      </button>
    </div>

    <ul class="lobby-list">
      <li v-for="p in o.room.value?.players" :key="p.id" :class="{ off: !p.connected }">
        <span class="avatar">{{ p.avatar }}</span>
        <b>{{ p.name }}</b>
        <small v-if="p.id === o.room.value?.hostId">chủ phòng</small>
        <small v-if="p.id === o.myId.value">(bạn)</small>
        <span v-if="!p.connected" class="offline">rớt mạng…</span>
      </li>
      <li v-for="n in 4 - (o.room.value?.players.length ?? 0)" :key="`empty-${n}`" class="empty">
        Đang chờ người chơi… chia sẻ mã <b>{{ o.room.value?.code }}</b>
      </li>
    </ul>

    <template v-if="o.isHost.value">
      <h3 class="section-title">Chế độ</h3>
      <div class="chips">
        <button
          v-for="m in MODES" :key="m.id" class="chip compact" role="radio"
          :aria-checked="o.room.value?.config.mode === m.id" type="button"
          @click="o.setConfig({ mode: m.id })"
        ><strong>{{ m.name }}</strong></button>
      </div>
      <h3 class="section-title">Lưới</h3>
      <div class="chips">
        <button
          v-for="(g, k) in GRIDS" :key="k" class="chip compact" role="radio"
          :aria-checked="o.room.value?.config.grid === k" type="button"
          @click="o.setConfig({ grid: String(k) })"
        ><strong>{{ String(k).replace('x', '×') }}</strong></button>
      </div>
      <h3 class="section-title">Theme</h3>
      <div class="chips">
        <button
          v-for="t in THEMES" :key="t.id" class="chip compact" role="radio"
          :aria-checked="o.room.value?.config.themeId === t.id" type="button"
          @click="o.setConfig({ themeId: t.id })"
        ><strong>{{ t.name }}</strong></button>
      </div>
      <button
        class="btn-primary" type="button"
        :disabled="(o.room.value?.players.length ?? 0) < 2"
        @click="o.start()"
      >
        {{ (o.room.value?.players.length ?? 0) < 2 ? 'Cần ít nhất 2 người…' : 'Bắt đầu' }}
      </button>
    </template>
    <p v-else class="hint">
      {{ o.room.value?.config.mode === 'survival' ? 'Sinh tồn' : 'Cổ điển' }}
      · lưới {{ o.room.value?.config.grid.replace('x', '×') }} — chờ chủ phòng bắt đầu…
    </p>
    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- TRONG VÁN -->
  <section v-else class="game" :style="fitStyle">
    <HudBar
      :score="0" :moves="o.view.value?.moves ?? 0"
      :matched="o.view.value?.matchedPairs ?? 0"
      :total-pairs="o.view.value?.totalPairs ?? 0"
      :combo="1" :elapsed="0"
      :time-left="o.view.value?.timeLeft ?? null"
      :moves-left="null" :lives="null" :multiplayer="true"
      @quit="quit"
    />

    <div class="strip">
      <div
        v-for="p in o.view.value?.players" :key="p.id"
        class="pchip" :class="{ active: p.id === o.view.value?.currentId, off: !p.connected || p.forfeited }"
      >
        <span class="avatar">{{ p.avatar }}</span>
        <b>{{ p.name }}</b>
        <span class="pts">{{ p.score }}</span>
        <Transition name="bubble">
          <span v-if="o.bubbles.value[p.id]" :key="o.bubbles.value[p.id]!.key" class="bubble">
            {{ o.bubbles.value[p.id]!.emoji }}
          </span>
        </Transition>
      </div>
    </div>

    <p v-if="o.reconnecting.value" class="reconnect" role="status">📡 Mất kết nối — đang vào lại…</p>

    <div class="board-wrap">
      <BoardGrid
        :cards="cards" :cols="o.view.value?.cols ?? 4"
        :face-up="faceUp" :matched="matchedSet"
        :wrong-pair="o.wrongPair.value" :revealing-all="false" :locked="locked"
        @flip="o.flip"
      />
      <span v-if="o.lastGain.value" :key="o.lastGain.value.key" class="gain" :style="gainStyle" aria-hidden="true">
        +{{ o.lastGain.value.amount }}
      </span>
      <Transition name="banner">
        <div v-if="o.turnBanner.value" :key="o.turnBanner.value.key" class="turn-banner" role="status" aria-live="polite">
          <small v-if="o.turnBanner.value.frozen">❄️ {{ o.turnBanner.value.frozen }} bị đóng băng, mất lượt</small>
          <span class="who">
            <span class="avatar">{{ o.turnBanner.value.avatar || '🎮' }}</span>
            Đến lượt <b>{{ o.turnBanner.value.name }}</b>
          </span>
        </div>
      </Transition>
    </div>

    <!-- Emoji chat (ON-08) -->
    <div class="emoji-bar" aria-label="Gửi emoji">
      <button
        v-for="e in QUICK_EMOJIS" :key="e" class="emoji" type="button"
        @click="o.sendEmoji(e)"
      >{{ e }}</button>
    </div>

    <ResultDialog
      v-if="o.view.value?.summary"
      :summary="o.view.value.summary"
      :is-record="false" :show-stars="false" :multiplayer="true"
      :fresh-achievements="[]" :has-next="false"
      @replay="o.isHost.value ? o.again() : undefined"
      @next="o.again()"
      @menu="quit"
    />
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.head h2 { flex: 1; margin: 0; font-size: 19px; }
.back { font-size: 22px; line-height: 1; padding: 4px 12px; }
.code {
  font-family: var(--font-display); font-weight: 700; letter-spacing: .12em;
  color: var(--accent);
}

.invite {
  margin: 0 0 14px; padding: 12px 14px; border-radius: var(--r-md);
  background: var(--accent-soft); font-size: var(--text-md); text-align: center;
}
.invite-code {
  font-family: var(--font-display); letter-spacing: .15em; color: var(--accent);
}
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field span { font-size: var(--text-sm); font-weight: 700; color: var(--muted); }
input {
  min-height: 48px; padding: 0 14px; font: inherit; color: var(--fg);
  border: 2px solid var(--line); border-radius: var(--r-md); background: var(--panel-soft);
}
input:focus { outline: none; border-color: var(--accent); }

.divider {
  display: flex; align-items: center; gap: 10px; margin: 18px 0 10px;
  color: var(--muted); font-size: var(--text-sm);
}
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }

.joinrow { display: flex; gap: 8px; }
.code-input {
  flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: .25em;
  font-family: var(--font-display); font-weight: 700; text-align: center;
}
.join { white-space: nowrap; }

.lobby-list { list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 8px; }
.lobby-list li {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border: 2px solid var(--line); border-radius: var(--r-md); background: var(--panel-soft);
}
.lobby-list li.off { opacity: .55; }
.lobby-list li.empty {
  border-style: dashed; color: var(--muted); font-size: var(--text-sm); justify-content: center;
}
.lobby-list .avatar { font-size: 20px; }
.lobby-list small { color: var(--muted); font-size: var(--text-xs); }
.offline { margin-left: auto; font-size: var(--text-xs); color: var(--warn); }
.hint { color: var(--muted); font-size: var(--text-sm); margin: 14px 0 0; }
.warn {
  margin: 14px 0 0; padding: 10px 12px; border-radius: var(--r-sm); font-size: var(--text-sm);
  background: color-mix(in srgb, var(--bad) 14%, transparent);
}
.chip.compact { flex: 0 1 auto; min-width: 80px; }

/* ---- trong ván ---- */
.game { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.strip { display: flex; gap: 6px; }
.pchip {
  position: relative; flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border: 2px solid var(--line); border-radius: 12px;
  background: var(--panel); box-shadow: var(--shadow-soft);
}
.pchip.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 4px 18px var(--card-back-glow); }
.pchip.off { opacity: .55; }
.pchip .avatar { font-size: 18px; }
.pchip b { font-size: 13px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pchip .pts { margin-left: auto; font-family: var(--font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
.pchip.active .pts { color: var(--accent); }
.bubble {
  position: absolute; top: -26px; left: 8px; font-size: 22px;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .25)); z-index: 4;
}
.bubble-enter-active { transition: transform .25s cubic-bezier(.3, 1.6, .5, 1), opacity .2s; }
.bubble-enter-from { transform: scale(.3) translateY(8px); opacity: 0; }
.bubble-leave-active { transition: opacity .3s, transform .3s; }
.bubble-leave-to { opacity: 0; transform: translateY(-10px); }

.reconnect {
  margin: 0; padding: 6px 12px; border-radius: var(--r-sm); text-align: center;
  font-size: var(--text-sm); background: color-mix(in srgb, var(--warn) 16%, transparent);
}

.board-wrap {
  position: relative; flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}
.board-wrap :deep(.board) { width: var(--fit, 100%); }

.gain {
  position: absolute; transform: translate(-50%, -50%);
  font-weight: 800; font-size: clamp(16px, 4vw, 24px); color: var(--gold);
  text-shadow: 0 1px 8px rgba(0, 0, 0, .35); pointer-events: none;
  animation: rise 1s ease-out forwards;
}
@keyframes rise {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(.7); }
  20% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(1); }
}

.turn-banner {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 26px; border-radius: 16px;
  background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
  border: 2px solid var(--accent);
  box-shadow: 0 10px 40px var(--card-back-glow), var(--shadow);
  backdrop-filter: blur(6px); pointer-events: none; z-index: 5; white-space: nowrap;
}
.turn-banner .who { display: flex; align-items: center; gap: 8px; font-size: clamp(17px, 4.5vw, 22px); }
.turn-banner b { color: var(--accent); }
.turn-banner .avatar { font-size: clamp(24px, 6vw, 32px); }
.turn-banner small { color: var(--muted); font-size: 12.5px; }
.banner-enter-active { transition: opacity .18s ease, transform .25s cubic-bezier(.3, 1.5, .5, 1); }
.banner-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(.6); }
.banner-leave-active { transition: opacity .3s ease, transform .3s ease; }
.banner-leave-to { opacity: 0; transform: translate(-50%, -85%) scale(.95); }

.emoji-bar { display: flex; gap: 4px; justify-content: center; }
.emoji {
  min-width: 40px; min-height: 40px; font-size: 20px; border: 1px solid var(--line);
  border-radius: var(--r-full); background: var(--panel);
  transition: transform .12s ease;
}
.emoji:hover { transform: translateY(-2px) scale(1.1); }
</style>
