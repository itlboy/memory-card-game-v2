<script setup lang="ts">
import { GRIDS, QUICK_EMOJIS } from '@mm/engine';
import {
  Brain, Check, ChevronLeft, Copy, Crown, Hash, Heart, Settings2, Sparkles, Timer
} from 'lucide-vue-next';
import type { Card } from '@mm/engine';
import { computed, onMounted, ref, watch } from 'vue';
import BoardGrid from './BoardGrid.vue';
import CelebrationFx from './CelebrationFx.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import HudBar from './HudBar.vue';
import ResultDialog from './ResultDialog.vue';
import type { RoomConfig } from '@mm/engine';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { store } from '@/lib/storage';
import { sfx } from '@/lib/audio';
import { loadThemes, type CardTheme } from '@/lib/themes';

const props = defineProps<{ joinCode?: string }>();
const emit = defineEmits<{ back: [] }>();

const o = useOnlineRoom();
const name = ref(store.playerNames()[0] ?? '');
/** Tên gợi ý trong ô nhập. Đặt tên vui thì bạn bè trong phòng dễ nhớ nhau hơn
 *  là "Người 1", "Người 2" — nên gợi ý bằng biệt danh thay vì một tên khô. */
const NAME_HINTS = [
  'Cáo Nhanh Tay', 'Mèo Trí Nhớ', 'Sóc Lật Thẻ', 'Gấu Bình Tĩnh',
  'Cú Đêm', 'Hổ Con', 'Cá Heo Vui', 'Thỏ Tinh Mắt',
  'Rồng Nhỏ', 'Ong Chăm Chỉ', 'Panda Ngủ Muộn', 'Sói Đơn Độc'
];
const namePlaceholder = `VD: ${NAME_HINTS[Math.floor(Math.random() * NAME_HINTS.length)]!}`;
const codeInput = ref(props.joinCode ?? '');
const copied = ref(false);
/** Vào bằng link mời: chỉ hiện đúng một việc — nhập tên rồi vào phòng. */
const invited = computed(() => !!props.joinCode);
/** Bước của màn vào online: chọn việc trước, điền form sau. */
const entryStep = ref<'choose' | 'create' | 'join'>(invited.value ? 'join' : 'choose');

function backEntry(): void {
  if (entryStep.value !== 'choose' && !invited.value) {
    entryStep.value = 'choose';
    o.error.value = '';
    return;
  }
  quit();
}

onMounted(() => {
  // Vào bằng link mời / F5 khi đang trong phòng: ưu tiên resume đúng phòng đó
  if (invited.value) {
    if (o.resumeStored(props.joinCode)) return;   // F5: vào lại bằng token, giữ danh tính
    if (name.value.trim()) join();                // link mời + đã nhớ tên: vào luôn
    return;
  }
  o.resumeStored();
});

// Đang trong phòng thì URL luôn mang ?room=CODE để F5 quay lại đúng chỗ
watch(() => o.room.value?.code, (code) => {
  if (code) history.replaceState(null, '', `${location.pathname}?room=${code}`);
});

function remember(): void { store.savePlayerNames([name.value.trim()]); }
function create(): void {
  if (!name.value.trim()) return;
  sfx.select();
  wizard.value = 'mode';   // đi qua các bước chọn bàn như chơi một mình
}
const codeValid = computed(() => /^\d{6}$/.test(codeInput.value.trim()));

function join(): void {
  if (!name.value.trim() || !codeValid.value) return;
  remember();
  o.join(codeInput.value, name.value.trim());
}
/** Nội dung popup xác nhận; null = không hiện. */
const confirm = ref<{ title: string; body: string; label: string; action: () => void } | null>(null);

function exit(): void {
  o.leave();
  history.replaceState(null, '', location.pathname);
  emit('back');
}

/** Thoát có xác nhận — dùng cho nút ✕ trong ván và khi bấm logo. */
function quit(): void {
  const phase = o.phase.value;
  if (phase === 'playing' && !o.spectator.value) {
    confirm.value = {
      title: 'Đầu hàng?',
      body: 'Bạn sẽ bị xử thua ván này và rời khỏi phòng.',
      label: 'Đầu hàng & rời phòng',
      action: () => { o.surrender(); exit(); }
    };
    return;
  }
  if (phase === 'lobby' && o.isHost.value && (o.room.value?.players.length ?? 0) > 1) {
    confirm.value = {
      title: 'Huỷ phòng?',
      body: 'Phòng sẽ đóng và mọi người bị đưa ra ngoài.',
      label: 'Huỷ phòng',
      action: () => { o.cancelRoom(); exit(); }
    };
    return;
  }
  if (phase === 'lobby') { o.surrender(); exit(); return; }
  exit();
}

/** Đang dở việc (wizard tạo phòng / trong phòng / trong ván) — App hỏi confirm trước khi rời trang. */
function isBusy(): boolean {
  if (wizard.value !== null) return true;
  return (o.phase.value === 'lobby' || o.phase.value === 'playing') && !o.spectator.value;
}

defineExpose({ requestHome: quit, isBusy });

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

/** Bật/tắt theme trong lobby — luôn giữ ít nhất một. */
function toggleTheme(id: string): void {
  const cur = o.room.value?.config.themeIds ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (next.length) o.setConfig({ themeIds: next });
}

const meReady = computed(() => !!o.me.value?.ready);
const readyCount = computed(() => {
  const r = o.room.value;
  if (!r) return { ok: 0, need: 0 };
  const others = r.players.filter((p) => p.id !== r.hostId);
  return { ok: others.filter((p) => p.ready).length, need: others.length };
});
const canStart = computed(() => {
  const r = o.room.value;
  return !!r && r.players.length >= 2 && readyCount.value.ok === readyCount.value.need;
});
const startLabel = computed(() => {
  const r = o.room.value;
  if (!r || r.players.length < 2) return 'Cần ít nhất 2 người…';
  if (!canStart.value) return `Chờ sẵn sàng (${readyCount.value.ok}/${readyCount.value.need})…`;
  return 'Bắt đầu';
});

// Màu neon từng chế độ — đồng bộ với wizard offline (hướng thiết kế C)
const MODES = [
  { id: 'classic' as const, icon: Brain, g: 'g-blue', name: 'Cổ điển', desc: 'Lật sai −10 điểm, thong thả' },
  { id: 'survival' as const, icon: Heart, g: 'g-red', name: 'Sinh tồn', desc: '5 mạng — quên thẻ đã mở là mất mạng' }
];

/** Danh sách theme đầy đủ (tên + biểu tượng mẫu) từ data/themes.json. */
const allThemes = ref<CardTheme[]>([]);
void loadThemes().then((list) => { allThemes.value = list; });
const themeName = (id: string): string => allThemes.value.find((t) => t.id === id)?.name ?? id;

/** Wizard chọn bàn chơi — dùng cả trước khi tạo phòng lẫn khi chỉnh trong lobby. */
const wizard = ref<null | 'mode' | 'grid' | 'theme'>(null);
const cfg = ref<RoomConfig>({ mode: 'classic', grid: '4x4', themeIds: ['animals'] });
const editingInLobby = computed(() => o.phase.value === 'lobby');
const WIZ_STEPS = ['mode', 'grid', 'theme'] as const;

function isBlankCell(k: string, idx: number): boolean {
  const g = GRIDS[k]!;
  const total = g.cols * g.rows;
  return total % 2 === 1 && idx === Math.floor(total / 2);
}

function wizToggleTheme(id: string): void {
  const cur = cfg.value.themeIds;
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (next.length) cfg.value = { ...cfg.value, themeIds: next };
}

function wizBack(): void {
  if (wizard.value === 'theme') { wizard.value = 'grid'; return; }
  if (wizard.value === 'grid') { wizard.value = 'mode'; return; }
  wizard.value = null;   // về nhập tên (tạo mới) hoặc lobby (đang chỉnh)
}

/** Đủ biểu tượng cho lưới đã chọn chưa? */
const wizPool = computed(() => new Set(
  allThemes.value.filter((t) => cfg.value.themeIds.includes(t.id)).flatMap((t) => t.symbols)
).size);
const wizTooSmall = computed(() => {
  const g = GRIDS[cfg.value.grid];
  return !!g && wizPool.value > 0 && wizPool.value < Math.floor((g.cols * g.rows) / 2);
});

const creatingRoom = ref(false);
/** Ăn mừng 5 giây trước rồi mới hiện popup kết quả. */
const showResult = ref(false);
let resultTimer: ReturnType<typeof setTimeout> | undefined;
const iWon = computed(() => o.view.value?.summary?.ranking[0]?.id === o.myId.value);
watch(() => o.view.value?.summary, (s) => {
  clearTimeout(resultTimer);
  showResult.value = false;
  if (!s) return;
  resultTimer = setTimeout(() => { showResult.value = true; }, iWon.value ? 5000 : 1500);
});

function wizFinish(): void {
  if (editingInLobby.value) {
    o.setConfig({ ...cfg.value });
    wizard.value = null;
    return;
  }
  remember();
  creatingRoom.value = true;
  void o.createRoom(name.value.trim(), { ...cfg.value });
}

// Tạo phòng xong (vào lobby) thì đóng wizard
watch(o.phase, (ph) => {
  if (creatingRoom.value && ph !== 'connecting' && ph !== 'idle') {
    creatingRoom.value = false;
    wizard.value = null;
  }
});

function openCfgWizard(): void {
  const c = o.room.value?.config;
  if (c) cfg.value = { mode: c.mode, grid: c.grid, themeIds: [...c.themeIds] };
  wizard.value = 'mode';
}
</script>

<template>
  <!-- Một root duy nhất: component này nằm trong <Transition> của App,
       nhiều root sẽ làm Transition render trắng trang -->
  <div class="online">
  <!-- WIZARD CHỌN BÀN CHƠI: dùng khi tạo phòng và khi chỉnh trong lobby -->
  <section v-if="wizard" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Quay lại" type="button" @click="wizBack"><ChevronLeft :size="22" /></button>
      <h2>{{ wizard === 'mode' ? 'Chọn chế độ' : wizard === 'grid' ? 'Kích thước lưới' : 'Chọn theme thẻ' }}</h2>
      <span class="dots" aria-hidden="true">
        <i v-for="(st, i) in WIZ_STEPS" :key="st" :class="{ on: i <= WIZ_STEPS.indexOf(wizard) }" />
      </span>
    </div>

    <div v-if="wizard === 'mode'" class="step-body options loose">
      <button
        v-for="m in MODES" :key="m.id" class="option wide neon" :class="m.g" type="button"
        :aria-pressed="cfg.mode === m.id"
        @click="sfx.select(); cfg = { ...cfg, mode: m.id }; wizard = 'grid'"
      >
        <component :is="m.icon" class="opt-icon" :size="26" />
        <span class="text"><strong>{{ m.name }}</strong><small>{{ m.desc }}</small></span>
      </button>
    </div>

    <div v-else-if="wizard === 'grid'" class="step-body options wiz-grids">
      <button
        v-for="(g, k) in GRIDS" :key="k" class="option" type="button"
        :aria-pressed="cfg.grid === k"
        @click="sfx.select(); cfg = { ...cfg, grid: String(k) }; wizard = 'theme'"
      >
        <span
          class="grid-preview" aria-hidden="true"
          :style="{
            gridTemplateColumns: `repeat(${g.cols}, 1fr)`,
            gridTemplateRows: `repeat(${g.rows}, 1fr)`,
            aspectRatio: `${g.cols * 3} / ${g.rows * 4}`
          }"
        >
          <i v-for="n in g.cols * g.rows" :key="n" :class="{ blank: isBlankCell(String(k), n - 1) }" />
        </span>
        <strong>{{ String(k).replace('x', '×') }}</strong>
        <small>{{ Math.floor(g.cols * g.rows / 2) }} cặp</small>
      </button>
    </div>

    <div v-else class="step-body">
      <p class="hint-multi">Chọn được nhiều theme — bàn thẻ sẽ trộn biểu tượng của tất cả.</p>
      <div class="options wiz-themes fill" role="group" aria-label="Theme thẻ">
        <button
          v-for="t in allThemes" :key="t.id" class="option theme-opt" role="checkbox"
          :aria-checked="cfg.themeIds.includes(t.id)"
          type="button"
          @click="wizToggleTheme(t.id)"
        >
          <span class="theme-sample" aria-hidden="true">{{ t.symbols.slice(0, 3).join(' ') }}</span>
          <strong class="tname">{{ t.name }}</strong>
        </button>
      </div>

      <p v-if="wizTooSmall" class="warn" role="alert">
        Chưa đủ biểu tượng cho lưới {{ cfg.grid.replace('x', '×') }}. Hãy chọn thêm theme hoặc quay lại đổi lưới.
      </p>

      <button
        class="btn-primary" type="button"
        :disabled="wizTooSmall || o.phase.value === 'connecting'"
        @click="wizFinish"
      >
        {{ editingInLobby ? 'Lưu bàn chơi' : o.phase.value === 'connecting' ? 'Đang tạo phòng…' : 'Tạo phòng' }}
      </button>
    </div>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- VÀO ONLINE: bước 1 chọn việc, bước 2 điền form -->
  <section v-else-if="o.phase.value === 'idle' || o.phase.value === 'error' || o.phase.value === 'connecting'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Quay lại" type="button" @click="backEntry"><ChevronLeft :size="22" /></button>
      <h2>{{ entryStep === 'choose' ? 'Chơi online' : entryStep === 'create' ? 'Tạo phòng mới' : 'Vào phòng' }}</h2>
    </div>

    <!-- BƯỚC 1: tạo phòng hay vào phòng có sẵn -->
    <div v-if="entryStep === 'choose'" class="options loose">
      <button class="option neon g-violet" type="button" @click="entryStep = 'create'">
        <Sparkles class="opt-icon" :size="34" />
        <strong>Tạo phòng mới</strong>
        <small>Lấy mã 6 số rồi mời bạn bè vào chơi</small>
      </button>
      <button class="option neon g-cyan" type="button" @click="entryStep = 'join'">
        <Hash class="opt-icon" :size="34" />
        <strong>Vào phòng có sẵn</strong>
        <small>Nhập mã 6 số bạn bè gửi cho</small>
      </button>
    </div>

    <!-- BƯỚC 2a: tạo phòng — chỉ cần tên -->
    <template v-else-if="entryStep === 'create'">
      <label class="field">
        <span>Tên của bạn</span>
        <input v-model="name" maxlength="16" :placeholder="namePlaceholder" @keydown.enter="create">
      </label>
      <button class="btn-primary" :disabled="!name.trim()" type="button" @click="create">
        Tiếp tục
      </button>
    </template>

    <!-- BƯỚC 2b: vào phòng — tên + mã (link mời thì mã điền sẵn, giấu ô mã) -->
    <template v-else>
      <p v-if="invited" class="invite">
        🎉 Bạn được mời vào phòng <b class="invite-code">{{ codeInput }}</b>
      </p>
      <label class="field">
        <span>Tên của bạn</span>
        <input v-model="name" maxlength="16" :placeholder="namePlaceholder" @keydown.enter="join">
      </label>
      <label v-if="!invited" class="field">
        <span>Mã phòng</span>
        <input
          v-model="codeInput" class="code-input" maxlength="6" placeholder="••••••"
          type="tel" inputmode="numeric" pattern="[0-9]*"
          autocomplete="one-time-code" spellcheck="false"
          @input="codeInput = codeInput.replace(/[^0-9]/g, '')"
          @keydown.enter="join"
        >
      </label>
      <button
        class="btn-primary"
        :disabled="!name.trim() || !codeValid || o.phase.value === 'connecting'"
        type="button" @click="join"
      >
        {{ o.phase.value === 'connecting' ? 'Đang vào phòng…' : 'Vào phòng chơi' }}
      </button>
    </template>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- LOBBY -->
  <section v-else-if="o.phase.value === 'lobby'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Rời phòng" type="button" @click="quit"><ChevronLeft :size="22" /></button>
      <h2>Phòng chờ</h2>
      <button class="btn code" type="button" :title="inviteLink" @click="copyLink">
        {{ o.room.value?.code }}
        <Check v-if="copied" :size="16" />
        <Copy v-else :size="16" />
      </button>
    </div>

    <ul class="lobby-list">
      <li v-for="p in o.room.value?.players" :key="p.id" :class="{ off: !p.connected }">
        <span class="avatar">{{ p.avatar }}</span>
        <b>{{ p.name }}</b>
        <small v-if="p.id === o.room.value?.hostId">chủ phòng</small>
        <small v-if="p.id === o.myId.value">(bạn)</small>
        <span v-if="!p.connected" class="offline">rớt mạng…</span>
        <span v-else class="ready-tag" :class="{ on: p.ready || p.id === o.room.value?.hostId }">
          <Crown v-if="p.id === o.room.value?.hostId" :size="15" class="crown" />
          <template v-else>{{ p.ready ? '✓ sẵn sàng' : 'chưa sẵn sàng' }}</template>
        </span>
      </li>
      <li v-if="(o.room.value?.players.length ?? 0) < 4" class="empty">
        Còn {{ 4 - (o.room.value?.players.length ?? 0) }} chỗ trống — chia sẻ mã
        <b>{{ o.room.value?.code }}</b> để mời bạn bè
      </li>
    </ul>

    <template v-if="o.isHost.value">
      <!-- Tóm tắt bàn chơi + nút chỉnh (mở lại wizard) — không còn hàng cuộn ngang che mất theme -->
      <div class="cfg-summary">
        <span>
          {{ o.room.value?.config.mode === 'survival' ? '❤️ Sinh tồn' : '🧠 Cổ điển' }}
          · lưới <b>{{ o.room.value?.config.grid.replace('x', '×') }}</b>
          · {{ o.room.value?.config.themeIds.map(themeName).join(', ') }}
        </span>
        <button class="btn edit" type="button" @click="openCfgWizard"><Settings2 :size="16" /> Chỉnh</button>
      </div>
      <button
        class="btn-primary" type="button"
        :disabled="!canStart"
        @click="o.start()"
      >{{ startLabel }}</button>
    </template>
    <template v-else>
      <button
        class="btn-primary" :class="{ 'is-ready': meReady }" type="button"
        @click="o.setReady(!meReady)"
      >
        {{ meReady ? '✅ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng!' }}
      </button>
      <p class="hint">
        {{ o.room.value?.config.mode === 'survival' ? '❤️ Sinh tồn' : '🧠 Cổ điển' }}
        · lưới {{ o.room.value?.config.grid.replace('x', '×') }}
        · {{ o.room.value?.config.themeIds.map(themeName).join(', ') }}
        — chờ chủ phòng bắt đầu…
      </p>
    </template>
    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- TRONG VÁN -->
  <section v-else class="game" :style="fitStyle">
    <HudBar
      :score="0" :moves="o.view.value?.moves ?? 0"
      :matched="o.view.value?.matchedPairs ?? 0"
      :total-pairs="o.view.value?.totalPairs ?? 0"
      :combo="1" :elapsed="o.elapsed.value"
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
        <small v-if="p.lives !== null" class="lives">{{ '❤️'.repeat(Math.max(0, p.lives)) || '💔' }}</small>
        <span
          v-if="p.id === o.view.value?.currentId && o.turnTimeLeft.value !== null"
          class="turn-clock" :class="{ urgent: o.turnTimeLeft.value <= 10 }"
          role="timer" :aria-label="`Còn ${Math.ceil(o.turnTimeLeft.value)} giây`"
        ><Timer :size="12" />{{ Math.ceil(o.turnTimeLeft.value) }}</span>
        <Transition name="plus">
          <span
            v-if="o.timeBonusFor.value && o.timeBonusFor.value.playerId === p.id"
            :key="o.timeBonusFor.value.key" class="plus10"
          >+5s</span>
        </Transition>
        <span class="pts">{{ p.score }}</span>
        <Transition name="bubble">
          <span v-if="o.bubbles.value[p.id]" :key="o.bubbles.value[p.id]!.key" class="bubble">
            {{ o.bubbles.value[p.id]!.emoji }}
          </span>
        </Transition>
      </div>
    </div>

    <p v-if="o.spectator.value" class="spectate" role="status">
      👁️ Phòng đã bắt đầu — bạn đang xem trận đấu
    </p>
    <p v-if="o.reconnecting.value" class="reconnect" role="status">📡 Mất kết nối — đang vào lại…</p>

    <div class="board-wrap">
      <BoardGrid
        :cards="cards" :cols="o.view.value?.cols ?? 4"
        :face-up="faceUp" :matched="matchedSet"
        :wrong-pair="o.wrongPair.value" :revealing-all="false" :locked="locked"
        :back="o.backStyle.value"
        @flip="o.flip"
      />
      <span v-if="o.lastGain.value" :key="o.lastGain.value.key" class="gain" :style="gainStyle" aria-hidden="true">
        +{{ o.lastGain.value.amount }}
      </span>
      <!-- Đếm ngược 5 giây trước ván + báo người đi đầu -->
      <div v-if="o.countdownLeft.value !== null" class="countdown" role="status" aria-live="assertive">
        <span class="num" :key="o.countdownLeft.value">{{ o.countdownLeft.value }}</span>
        <span class="first">🎲 <b>{{ o.countdown.value?.firstName }}</b> đi trước!</span>
      </div>

      <!-- Emoji chat phóng to giữa bàn -->
      <Transition name="blast">
        <div v-if="o.emojiBlast.value" :key="o.emojiBlast.value.key" class="emoji-blast" aria-hidden="true">
          <span class="big">{{ o.emojiBlast.value.emoji }}</span>
          <span class="from">{{ o.emojiBlast.value.name }}</span>
        </div>
      </Transition>

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

    <!-- Emoji chat (ON-08) — khán giả không gửi được -->
    <div
      v-if="!o.spectator.value" class="emoji-bar"
      :class="{ spent: !o.emojiReady.value }"
      :aria-label="o.emojiReady.value ? 'Gửi emoji' : 'Gửi emoji — đợi chút, bạn vừa gửi liên tục'"
    >
      <button
        v-for="e in QUICK_EMOJIS" :key="e" class="emoji" type="button"
        :disabled="!o.emojiReady.value"
        @click="o.sendEmoji(e)"
      >{{ e }}</button>
      <!-- Hết lượt: nói rõ còn phải chờ mấy giây -->
      <span v-if="o.emojiCooldown.value" class="cooldown" role="status">
        🧊 {{ o.emojiCooldown.value }}s
      </span>
    </div>

    <CelebrationFx v-if="o.view.value?.summary && iWon" />
    <ResultDialog
      v-if="o.view.value?.summary && showResult"
      :summary="o.view.value.summary"
      :is-record="false" :show-stars="false" :multiplayer="true"
      :fresh-achievements="[]" :has-next="false"
      :total-before="0" :total-after="0"
      @replay="o.isHost.value ? o.again() : undefined"
      @next="o.again()"
      @menu="quit"
    />
  </section>

  <ConfirmDialog
    v-if="confirm"
    :title="confirm.title" :body="confirm.body" :confirm-label="confirm.label"
    @confirm="confirm.action()"
    @cancel="confirm = null"
  />
  </div>
</template>

<style scoped>
.online { display: flex; flex-direction: column; height: 100%; }
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.head h2 { flex: 1; margin: 0; font-size: 19px; }
.back { font-size: 22px; line-height: 1; padding: 4px 12px; }
.code {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-display); font-weight: 700; letter-spacing: .12em;
  color: var(--accent);
}
.ready-tag { display: inline-flex; align-items: center; gap: 4px; }
.crown { color: var(--gold); }
.edit { display: inline-flex; align-items: center; gap: 5px; }
.turn-clock { display: inline-flex; align-items: center; gap: 2px; }

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

.options { display: grid; gap: 10px; }
/* Ô nằm ngang: icon PHẢI dính lề trái. `justify-content: center` kế thừa từ
   `.option` đẩy cụm icon+chữ vào giữa, nên mỗi ô icon lệch một chỗ tuỳ độ dài
   chữ (đo được 20px đến 57px giữa các chế độ) — nhìn như xếp so le. */
.option.wide {
  flex-direction: row; text-align: left; gap: 14px; padding: 13px 16px;
  justify-content: flex-start;
}
.option.wide .text { flex: 1; min-width: 0; }
.option.wide .icon { font-size: 26px; }
.option.wide .text { display: flex; flex-direction: column; gap: 1px; }
/* Ô cấu hình được chọn: bùng gradient neon (hướng C) */
.option[aria-pressed='true']:not(.neon), .option[aria-checked='true']:not(.neon) {
  border-color: transparent;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: 0 8px 26px rgba(106, 92, 255, .5), inset 0 1px 0 rgba(255, 255, 255, .3);
  color: #fff;
}
.option[aria-pressed='true'] small, .option[aria-checked='true'] small { color: rgba(255, 255, 255, .85); }
.option[aria-pressed='true'] .grid-preview i { background: rgba(255, 255, 255, .9); }
/* Chế độ (neon sẵn màu riêng): ô đang chọn thắp viền trắng thay vì đổi màu */
.option.wide.neon[aria-pressed='true'] {
  outline: 3px solid rgba(255, 255, 255, .85); outline-offset: -3px;
}
/* KHÔNG SCROLL: panel chiếm trọn viewport, bước hiện tại co giãn trong chỗ còn lại */
.online > .panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.step-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.step-body.options { display: grid; }
.step-body.options, .options.fill {
  flex: 1; min-height: 0; grid-auto-rows: minmax(0, 1fr); overflow: hidden;
  /* Desktop màn cao: ô không kéo dài vô lý — cap chiều cao, canh giữa cell */
  align-items: center;
}
.step-body.options > .option, .options.fill > .option {
  height: 100%; max-height: 210px;
}
.option { min-height: 0; overflow: hidden; justify-content: center; }

/* Ô lựa chọn CHIA ĐỀU chỗ trống của panel — không còn thanh 92px nổi giữa
   panel cao với khoảng trống trên dưới. Vẫn giữ luật KHÔNG SCROLL. */
.step-body.options.loose, .options.loose { grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
.step-body.options.loose > .option, .options.loose > .option {
  height: 100%; max-height: none; padding: 12px 18px;
  flex-direction: row; gap: 14px; text-align: left; align-items: center;
}
/* Màn entry (chọn Tạo phòng / Vào phòng): .options.loose là con trực tiếp của
   panel nên phải tự giãn, không thì 2 ô nổi trên với khoảng trống dưới */
.online > .panel > .options.loose { flex: 1; min-height: 0; overflow: hidden; }
/* Ô entry không có wrapper .text: grid để tiêu đề và mô tả XẾP DỌC */
.options.loose > .option:not(.wide) {
  display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto;
  column-gap: 14px; row-gap: 2px; align-items: center; align-content: center;
  justify-items: start; text-align: left;
}
.options.loose > .option:not(.wide) > .opt-icon { grid-row: span 2; }
/* Chỉ ô XẾP DỌC mới chặn theo chiều cao. Ô `.wide` (icon và chữ nằm ngang) thấp
   nhưng rộng — chặn theo chiều cao ở đó làm chữ tụt xuống vô cớ. */
.options.loose > .option:not(.wide) strong { font-size: clamp(18px, min(9cqw, 13cqh), 30px); }
.options.loose > .option:not(.wide) small { font-size: clamp(13px, min(5.4cqw, 8cqh), 18px); }
.options.loose > .option:not(.wide) .opt-icon { width: clamp(34px, min(15cqw, 22cqh), 62px); height: auto; }
/* LUÔN 3 cột — cột app cố định 440px, không đổi theo breakpoint */
.options.wiz-grids { grid-template-columns: repeat(3, 1fr); }
.options.wiz-themes { grid-template-columns: repeat(3, 1fr); }   /* 12 theme = 3×4 */
.options.wiz-grids .option { padding: 6px 4px; gap: 2px; }
.options.wiz-grids strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.wiz-grids small, .theme-opt small { font-size: clamp(11.5px, 12cqw, 14px); }
/* Preview co theo chỗ còn lại của ô — xem chú thích ở MenuScreen */
.grid-preview {
  display: grid; gap: 1.5px;
  flex: 1; min-height: 0; width: auto; max-width: 72%; margin: 0 auto;
}
.grid-preview i {
  border-radius: 2px; min-height: 0; min-width: 0;
  background: linear-gradient(150deg, var(--accent), var(--accent-2));
  opacity: .75;
}
.grid-preview i.blank { background: transparent; }
/* Đủ specificity để thắng `.option { padding: 24px 16px }` viết bên dưới */
.options.wiz-themes .option.theme-opt { padding: 8px 5px; gap: 4px; }
.theme-sample { font-size: clamp(15px, 26cqw, 32px); letter-spacing: 1px; white-space: nowrap; opacity: .9; }
/* Tên theme: MỘT dòng duy nhất, cỡ chữ co theo bề rộng ô (container query)
   — không bao giờ cắt mất từ như line-clamp trong ô grid nén */
/* .option strong đặt 16px nên phải thắng specificity, không thì cqw vô hiệu
   và tên dài ("Thiên nhiên") bị cắt trong ô grid nén */
/* Tên theme được phép xuống hai dòng: giữ một dòng thì bề rộng ô khoá cỡ chữ
   ở 13px trong khi ô còn thừa chiều cao */
.option strong.tname {
  font-size: clamp(13px, 20cqw, 21px);
  line-height: 1.15; text-align: center; max-width: 100%;
  overflow-wrap: break-word;
}
.hint-multi { margin: 0 0 12px; color: var(--muted); font-size: var(--text-sm); }
.dots { display: flex; gap: 6px; }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
.dots i.on { background: var(--accent); }
.cfg-summary {
  display: flex; align-items: center; gap: 10px; margin-top: 12px;
  padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-soft); font-size: var(--text-sm);
}
.cfg-summary span { flex: 1; min-width: 0; }
.cfg-summary .edit { white-space: nowrap; }
.option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 24px 16px; border: 2px solid var(--line); border-radius: 14px;
  background: var(--panel-soft); text-align: center;
  transition: transform .15s ease, box-shadow .15s ease;   /* chọn đổi màu tức thì */
  /* Cỡ chữ co theo bề rộng Ô — giống MenuScreen. Ô lựa chọn chiếm trọn chỗ nên
     chữ cố định 17px trông bé tí giữa khoảng trống. */
  /* `size` (không phải inline-size) để cỡ chữ dùng được CẢ chiều cao ô: ô lớn
     cao 320px mà chữ chỉ theo bề rộng thì vẫn lọt thỏm. An toàn vì chiều cao ô
     do lưới quyết định, không do nội dung — không sinh vòng lặp layout. */
  container-type: size;
}
@media (hover: hover) {
.option:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-soft); }
}
.option .icon { font-size: 38px; }
.opt-icon { color: var(--accent); flex-shrink: 0; }
.neon .opt-icon { color: #fff; }
.neon small { color: rgba(255, 255, 255, .85); }
.option strong { font-family: var(--font-display); font-size: clamp(17px, 8cqw, 28px); }
.option small { color: var(--muted); font-size: clamp(12.5px, 5cqw, 17px); line-height: 1.35; }

.code-input {
  letter-spacing: .3em;
  font-family: var(--font-display); font-weight: 700; text-align: center; font-size: 22px;
}

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
.ready-tag { margin-left: auto; font-size: var(--text-xs); color: var(--muted); white-space: nowrap; }
.ready-tag.on { color: var(--ok); font-weight: 700; }
.is-ready { background: var(--ok); box-shadow: 0 8px 22px color-mix(in srgb, var(--ok) 40%, transparent); }
.hint { color: var(--muted); font-size: var(--text-sm); margin: 14px 0 0; }
.warn {
  margin: 14px 0 0; padding: 10px 12px; border-radius: var(--r-sm); font-size: var(--text-sm);
  background: color-mix(in srgb, var(--bad) 14%, transparent);
}
.chip.compact { flex: 0 1 auto; min-width: 80px; }

.cfg-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.cfg-label {
  flex: 0 0 52px; font-family: var(--font-display); font-size: var(--text-xs);
  text-transform: uppercase; letter-spacing: .07em; color: var(--muted); font-weight: 700;
}
.cfg-chips {
  flex: 1; min-width: 0; display: flex; gap: 6px;
  overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  padding: 2px;   /* chừa chỗ cho viền chip khi được chọn */
}
.cfg-chips::-webkit-scrollbar { display: none; }
.chip.mini {
  flex: 0 0 auto; min-height: 40px; min-width: 0; padding: 6px 12px;
  font-size: var(--text-sm); font-weight: 700; white-space: nowrap;
  display: inline-flex; align-items: center;
}

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
.pchip .lives { font-size: 10px; letter-spacing: -2px; white-space: nowrap; }
.pchip .pts { margin-left: auto; font-family: var(--font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
.turn-clock {
  font-family: var(--font-display); font-size: 13px; font-variant-numeric: tabular-nums;
  padding: 1px 7px; border-radius: var(--r-full);
  background: var(--accent-soft); color: var(--accent); white-space: nowrap;
}
.turn-clock.urgent {
  background: color-mix(in srgb, var(--bad) 16%, transparent);
  color: var(--bad);
  animation: clock-pulse .5s steps(2) infinite;
}
@keyframes clock-pulse { 50% { opacity: .45; transform: scale(1.12); } }
.plus10 {
  position: absolute; top: -18px; right: 8px;
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  color: var(--ok); text-shadow: 0 1px 6px rgba(0, 0, 0, .2); pointer-events: none;
}
.plus-enter-active { transition: transform .8s ease-out, opacity .8s ease-out; }
.plus-enter-from { transform: translateY(10px); opacity: 0; }
.plus-leave-active { transition: opacity .3s; }
.plus-leave-to { opacity: 0; }
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
.spectate {
  margin: 0; padding: 6px 12px; border-radius: var(--r-sm); text-align: center;
  font-size: var(--text-sm); background: var(--accent-soft);
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

/* Emoji người khác gửi bay giữa bàn chơi — để hơi trong, người chơi vẫn theo
   được thẻ bên dưới trong lúc nó bay qua. */
.emoji-blast {
  position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  pointer-events: none; z-index: 6;
  opacity: .78;
}
.emoji-blast .big {
  font-size: clamp(64px, 22vw, 110px); line-height: 1;
  filter: drop-shadow(0 8px 26px rgba(0, 0, 0, .35));
  animation: blast-pop 1.9s cubic-bezier(.2, 1.4, .4, 1) forwards;
}
.emoji-blast .from {
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-md);
  color: #fff; padding: 2px 12px; border-radius: var(--r-full);
  background: color-mix(in srgb, var(--accent) 85%, black);
  box-shadow: 0 4px 14px var(--card-back-glow);
}
@keyframes blast-pop {
  0% { transform: scale(.2) rotate(-14deg); opacity: 0; }
  18% { transform: scale(1.3) rotate(6deg); opacity: 1; }
  30% { transform: scale(1) rotate(0); }
  75% { transform: scale(1) translateY(0); opacity: 1; }
  100% { transform: scale(.9) translateY(-46px); opacity: 0; }
}
.blast-enter-active { transition: opacity .1s; }
.blast-leave-active { transition: opacity .25s; }
.blast-leave-to { opacity: 0; }

.emoji-bar {
  display: flex; gap: 4px; justify-content: center;
  transition: opacity .18s ease;
}
/* Hết lượt trong 10 giây: mờ đi để thấy rõ là đang chờ */
.emoji-bar { position: relative; }
.emoji-bar.spent .emoji { opacity: .35; }
.cooldown {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 4px 12px; border-radius: var(--r-full);
  background: var(--panel-solid); border: 2px solid var(--accent);
  box-shadow: var(--shadow-soft);
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  pointer-events: none;
}
.emoji {
  min-width: 40px; min-height: 40px; font-size: 20px; border: 1px solid var(--line);
  border-radius: var(--r-full); background: var(--panel);
  transition: transform .12s ease;
}
.emoji:disabled { cursor: not-allowed; }
@media (hover: hover) {
.emoji:not(:disabled):hover { transform: translateY(-2px) scale(1.1); }
}
</style>
