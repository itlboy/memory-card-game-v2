<script setup lang="ts">
import {
  CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, OPTION_KEYS, OPTION_LABELS, levelSpec, optionSummary
} from '@mm/engine';
import {
  Brain, Check, ChevronLeft, Copy, Crown, Eye, Hash, Heart, Settings2, Share2, Sparkles, Timer
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import LevelMap from './LevelMap.vue';
import OnlineGame from './OnlineGame.vue';
import EmojiBar from './EmojiBar.vue';
import EmojiBlast from './EmojiBlast.vue';
import type { OptLevel, OptionKey, RoomConfig } from '@mm/engine';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';
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
const copiedCode = ref(false);
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
  wizard.value = 'level';   // đi qua các bước chọn bàn như chơi một mình
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

/** Copy riêng mã 6 số — bạn bè đọc mã qua điện thoại thì cần đúng phần này. */
async function copyCode(): Promise<void> {
  const code = o.room.value?.code ?? '';
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = true;
    sfx.select();
    setTimeout(() => { copiedCode.value = false; }, 1600);
  } catch { /* trình duyệt chặn */ }
}

/** Chia sẻ link: trên điện thoại mở luôn bảng chia sẻ của hệ điều hành (Zalo,
 *  Messenger…); máy tính không có thì lùi về copy. */
async function shareLink(): Promise<void> {
  const url = inviteLink.value;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: 'Lật Thẻ', text: `Vào chơi Lật Thẻ với mình — mã phòng ${o.room.value?.code ?? ''}`, url });
      sfx.select();
      return;
    } catch { /* người dùng bấm huỷ — không coi là lỗi */ }
  }
  await copyLink();
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = true;
    sfx.select();
    setTimeout(() => { copied.value = false; }, 1600);
  } catch { /* trình duyệt chặn */ }
}

/** Bật/tắt theme trong lobby — luôn giữ ít nhất một. */
function toggleTheme(id: string): void {
  const cur = o.room.value?.config.themeIds ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (!next.length) { flashThemeWarn(); return; }
  o.setConfig({ themeIds: next });
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

/** Năm hàng tuỳ chọn — giống hệt wizard chơi đơn, để hai chỗ đọc ra là một. */
const OPTION_ROWS: readonly { key: OptionKey; icon: IconName; name: string }[] = [
  { key: 'time',    icon: 'time',    name: 'Thời gian' },
  { key: 'lives',   icon: 'lives',   name: 'Số mạng' },
  { key: 'peek',    icon: 'peek',    name: 'Xem trước' },
  { key: 'shuffle', icon: 'shuffle', name: 'Xáo thẻ' },
  { key: 'special', icon: 'special', name: 'Thẻ đặc biệt' }
];

function setWizOption(key: OptionKey, muc: OptLevel): void {
  if (cfg.value.options[key] === muc) return;
  sfx.select();
  cfg.value = { ...cfg.value, options: { ...cfg.value.options, [key]: muc } };
}

/** Danh sách theme đầy đủ (tên + biểu tượng mẫu) từ data/themes.json. */
const allThemes = ref<CardTheme[]>([]);
void loadThemes().then((list) => {
  allThemes.value = list;
  // Phòng online mặc định bật TẤT CẢ theme: bàn thẻ trộn nhiều bộ biểu tượng
  // nên khó đoán hơn, và chủ phòng không phải đi chọn từng cái.
  if (!cfg.value.themeIds.length) cfg.value = { ...cfg.value, themeIds: list.map((t) => t.id) };
});
const themeName = (id: string): string => allThemes.value.find((t) => t.id === id)?.name ?? id;
/**
 * Luật của phòng KHÔNG còn là một cái tên, nên phòng chờ nói ra bằng chip — và
 * chỉ hiện thứ ĐANG BẬT. Bàn không tuỳ chọn gì thì dòng này rỗng, đúng như nó
 * nên vậy: không có luật lạ nào để đọc.
 */
const OPTION_ICONS: Record<OptionKey, IconName> = {
  time: 'time', lives: 'lives', peek: 'peek', shuffle: 'shuffle', special: 'special'
};
function optionChips(c?: RoomConfig): { key: OptionKey; icon: IconName; text: string }[] {
  if (!c) return [];
  return OPTION_KEYS
    .map((k) => ({ key: k, icon: OPTION_ICONS[k], text: optionSummary(k, c.options[k], c.level) ?? '' }))
    .filter((x) => x.text !== '');
}
/** Liệt kê hết 12 tên theme thì dòng cấu hình dài mấy dòng và vỡ bố cục. */
function themeSummary(ids: string[]): string {
  if (ids.length >= allThemes.value.length && allThemes.value.length) return `tất cả ${ids.length} theme`;
  if (ids.length > 3) return `${ids.length} theme`;
  return ids.map(themeName).join(', ');
}

/** Wizard chọn bàn chơi — dùng cả trước khi tạo phòng lẫn khi chỉnh trong lobby. */
// Cùng thứ tự với wizard chơi đơn: chế độ → cấp độ → theme.
const wizard = ref<null | 'level' | 'theme' | 'options'>(null);
const cfg = ref<RoomConfig>({ ...DEFAULT_ROOM_CONFIG, themeIds: [] });
const editingInLobby = computed(() => o.phase.value === 'lobby');
const WIZ_STEPS = ['level', 'theme', 'options'] as const;
const WIZ_TITLES = { level: 'Chọn cấp độ', theme: 'Chọn theme thẻ', options: 'Bàn chơi' } as const;

function wizToggleTheme(id: string): void {
  const cur = cfg.value.themeIds;
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  // Bỏ nốt theme cuối thì bàn không có biểu tượng nào — chặn, NHƯNG phải nói ra:
  // trước đây bấm mà không có gì xảy ra, người chơi tưởng nút bị lỗi.
  if (!next.length) { flashThemeWarn(); return; }
  cfg.value = { ...cfg.value, themeIds: next };
}

const themeWarn = ref(false);
let themeWarnTimer: ReturnType<typeof setTimeout> | undefined;
function flashThemeWarn(): void {
  themeWarn.value = true;
  sfx.miss();
  clearTimeout(themeWarnTimer);
  themeWarnTimer = setTimeout(() => { themeWarn.value = false; }, 2000);
}

function wizBack(): void {
  if (wizard.value === 'theme') { wizard.value = 'level'; return; }
  if (wizard.value === 'options') { wizard.value = 'theme'; return; }
  wizard.value = null;   // về nhập tên (tạo mới) hoặc lobby (đang chỉnh)
}

/** Biểu tượng của MỌI theme server có — trần trên cho bản đồ cấp. */
const allSymbols = computed(() => new Set(allThemes.value.flatMap((t) => t.symbols)).size);

const wizPool = computed(() => new Set(
  allThemes.value.filter((t) => cfg.value.themeIds.includes(t.id)).flatMap((t) => t.symbols)
).size);

/** Số thẻ của cấp phòng đang chọn — nói "cấp 12" suông thì không ai hình dung
 *  được bàn to cỡ nào. */
const cardCount = computed(() => {
  const lv = o.room.value?.config.level;
  return lv ? levelSpec(lv).pairs * 2 : 0;
});

function wizPickLevel(id: number): void {
  sfx.select();
  cfg.value = { ...cfg.value, level: id };
  wizard.value = 'theme';
}

/** Bộ theme đang chọn đủ biểu tượng cho cấp đã chọn chưa? */
const wizTooSmall = computed(() =>
  wizPool.value > 0 && wizPool.value < levelSpec(cfg.value.level).pairs);

const creatingRoom = ref(false);

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
  if (c) cfg.value = { level: c.level, themeIds: [...c.themeIds], options: { ...c.options } };
  wizard.value = 'level';
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
      <h2>{{ WIZ_TITLES[wizard!] }}</h2>
      <span class="dots" aria-hidden="true">
        <i v-for="(st, i) in WIZ_STEPS" :key="st" :class="{ on: i <= WIZ_STEPS.indexOf(wizard) }" />
      </span>
    </div>

    <div v-if="wizard === 'level'" class="step-body">
      <!-- MỞ SẴN HẾT cấp độ: thang cấp chỉ có nghĩa khi chơi một mình. Hai người
           trong phòng thì mỗi máy mở tới một cấp khác nhau, khoá lại thành ra
           tranh cãi chọn bàn nào. -->
      <LevelMap
        :progress="store.progress('classic')"
        :unlocked="CAMPAIGN_LEVELS"
        :symbol-count="allSymbols"
        @play="wizPickLevel"
      />
    </div>

    <div v-else-if="wizard === 'theme'" class="step-body">
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
          <!-- Badge góc, không chiếm chỗ trong luồng (xem MenuScreen) -->
          <span v-if="cfg.themeIds.includes(t.id)" class="tick" aria-hidden="true">
            <Check :size="12" />
          </span>
        </button>
      </div>

      <p v-if="themeWarn" class="warn" role="alert">Phải giữ ít nhất một theme.</p>
      <p v-if="wizTooSmall" class="warn" role="alert">
        Chưa đủ biểu tượng cho cấp {{ cfg.level }}. Hãy chọn thêm theme.
      </p>

      <button
        class="btn-primary" type="button"
        :disabled="wizTooSmall"
        @click="wizard = 'options'"
      >
        Tiếp
      </button>
    </div>

    <!-- BƯỚC CUỐI: tuỳ chọn bàn chơi, giống hệt wizard chơi đơn. Cả phòng chơi
         chung một bàn nên đây là luật của tất cả mọi người. -->
    <div v-else class="step-body opt-list">
      <div v-for="row in OPTION_ROWS" :key="row.key" class="opt-row">
        <div class="opt-head">
          <OptionIcon :name="row.icon" :size="24" />
          <span class="opt-name">{{ row.name }}</span>
          <span class="opt-hint">{{ optionSummary(row.key, cfg.options[row.key], cfg.level) ?? 'tắt' }}</span>
        </div>
        <div class="seg" role="group" :aria-label="row.name">
          <button
            v-for="(nhan, muc) in OPTION_LABELS[row.key]" :key="nhan"
            class="seg-btn" type="button"
            :aria-pressed="cfg.options[row.key] === muc"
            @click="setWizOption(row.key, muc as OptLevel)"
          >{{ nhan }}</button>
        </div>
      </div>

      <button
        class="btn-primary" type="button"
        :disabled="o.phase.value === 'connecting'"
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
    </div>

    <!-- Mời bạn: phải nói RÕ bấm vào đâu để làm gì. Nút mã nhỏ ở góc trước đây
         nhìn như chỉ để xem mã, nhiều người không biết là bấm được. -->
    <div class="invite">
      <div class="invite-code">
        <span class="invite-label">Mã phòng</span>
        <b class="code-big">{{ o.room.value?.code }}</b>
      </div>
      <div class="invite-actions">
        <button class="btn invite-btn" type="button" @click="copyCode">
          <Check v-if="copiedCode" :size="17" /><Copy v-else :size="17" />
          {{ copiedCode ? 'Đã copy mã' : 'Copy mã' }}
        </button>
        <button class="btn invite-btn primary" type="button" :title="inviteLink" @click="shareLink">
          <Check v-if="copied" :size="17" /><Share2 v-else :size="17" />
          {{ copied ? 'Đã copy link' : 'Chia sẻ link' }}
        </button>
      </div>
    </div>

    <ul class="lobby-list">
      <li v-for="p in o.room.value?.players" :key="p.id" :class="{ off: !p.connected }">
        <span class="avatar">{{ p.avatar }}</span>
        <b>{{ p.name }}</b>
        <small v-if="p.id === o.room.value?.hostId">chủ phòng</small>
        <small v-if="p.id === o.myId.value">(bạn)</small>
        <!-- Ping hiện từ PHÒNG CHỜ, không đợi vào ván: biết mạng mình thế nào
             trước khi bắt đầu thì còn kịp xử lý. -->
        <span
          v-if="p.id === o.myId.value && p.connected"
          class="ping" :class="o.netQuality.value"
          :title="`Độ trễ mạng của bạn${o.ping.value === null ? ' — đang đo' : `: ${o.ping.value}ms`}`"
        >{{ o.ping.value === null ? '···' : `${o.ping.value}ms` }}</span>
        <span v-if="!p.connected" class="offline">rớt mạng…</span>
        <span v-else class="ready-tag" :class="{ on: p.ready || p.id === o.room.value?.hostId }">
          <Crown v-if="p.id === o.room.value?.hostId" :size="15" class="crown" />
          <template v-else>{{ p.ready ? '✓ sẵn sàng' : 'chưa sẵn sàng' }}</template>
        </span>
      </li>
      <!-- Mã và nút chia sẻ đã nằm trong khối mời phía trên, nhắc lại ở đây chỉ
           làm dòng này vỡ chữ -->
      <li v-if="(o.room.value?.players.length ?? 0) < 4" class="empty">
        Còn {{ 4 - (o.room.value?.players.length ?? 0) }} chỗ trống
      </li>
    </ul>

    <template v-if="o.isHost.value">
      <!-- Tóm tắt bàn chơi + nút chỉnh (mở lại wizard) — không còn hàng cuộn ngang che mất theme -->
      <div class="cfg-summary">
        <span>
          Cấp <b>{{ o.room.value?.config.level }}</b> ({{ cardCount }} thẻ)
          · {{ themeSummary(o.room.value?.config.themeIds ?? []) }}
        </span>
        <button class="btn edit" type="button" @click="openCfgWizard"><Settings2 :size="16" /> Chỉnh</button>
      </div>
      <!-- Chỉ hiện tuỳ chọn ĐANG BẬT: bàn trơn thì dòng này rỗng, và không có
           gì để đọc là đúng — không có luật lạ nào. -->
      <div v-if="optionChips(o.room.value?.config).length" class="cfg-chips">
        <span v-for="c in optionChips(o.room.value?.config)" :key="c.key" class="cfg-chip">
          <OptionIcon :name="c.icon" :size="17" />{{ c.text }}
        </span>
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
      <div v-if="optionChips(o.room.value?.config).length" class="cfg-chips">
        <span v-for="c in optionChips(o.room.value?.config)" :key="c.key" class="cfg-chip">
          <OptionIcon :name="c.icon" :size="17" />{{ c.text }}
        </span>
      </div>
      <p class="hint">
        Cấp {{ o.room.value?.config.level }} ({{ cardCount }} thẻ)
        · {{ themeSummary(o.room.value?.config.themeIds ?? []) }}
        — chờ chủ phòng bắt đầu…
      </p>
    </template>
    <!-- Chat ngay ở phòng chờ: lúc ngồi đợi nhau mới là lúc cần nói chuyện
         nhất. Server không hề chặn emoji theo trạng thái phòng, nên đây chỉ là
         chuyện thêm giao diện. -->
    <div class="lobby-chat">
      <EmojiBar :o="o" />
    </div>
    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
  </section>

  <!-- TRONG VÁN — xem OnlineGame.vue (nó tự mount EmojiBlast) -->
  <OnlineGame v-else :o="o" @quit="quit" />

  <!-- Emoji người kia gửi, cho các màn NGOÀI ván. Teleport ra <body> nên chỉ
       được mount một bản: trong ván đã có bản của OnlineGame. -->
  <EmojiBlast v-if="o.phase.value !== 'playing' && o.phase.value !== 'ended'" :o="o" />

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

/* Riêng màn này ô ngang có padding hẹp hơn */
.option.wide { padding: 13px 16px; }
.option.wide .icon { font-size: 26px; }
/* Ô cấu hình được chọn: bùng gradient neon (hướng C) */
.option[aria-pressed='true']:not(.neon), .option[aria-checked='true']:not(.neon) {
  border-color: transparent;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  /* Bóng trung tính, không glow màu — glow lan vào khe giữa các ô làm chúng dính vào nhau */
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
  color: #fff;
}
.option[aria-pressed='true'] small, .option[aria-checked='true'] small { color: rgba(255, 255, 255, .85); }
.option[aria-pressed='true'] .grid-preview i { background: rgba(255, 255, 255, .9); }
/* Chế độ (neon sẵn màu riêng): ô đang chọn thắp viền trắng thay vì đổi màu */
.option.wide.neon[aria-pressed='true'] {
  outline: 3px solid rgba(255, 255, 255, .85); outline-offset: -3px;
}
/* KHÔNG SCROLL: panel chiếm trọn viewport (khung một bước nằm ở wizard.css) */
.online > .panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }

/* Ô lựa chọn CHIA ĐỀU chỗ trống của panel — không còn thanh 92px nổi giữa
   panel cao với khoảng trống trên dưới. Vẫn giữ luật KHÔNG SCROLL. */
.step-body.options.loose, .options.loose { grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
.step-body.options.loose > .option, .options.loose > .option {
  height: 100%; max-height: none;
  /* Padding dọc co theo chiều cao CỬA SỔ (không phải theo ô — dùng cqh ở đây
     sinh vòng lặp): máy 320×568 ô chỉ cao 68px, padding cố định 12px ăn hết chỗ
     của chú thích. */
  padding: clamp(4px, 1.5vh, 12px) 18px;
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
/* LUÔN 3 cột — cột app cố định 440px, không đổi theo breakpoint */
.options.wiz-grids { grid-template-columns: repeat(3, 1fr); }
.options.wiz-themes { grid-template-columns: repeat(3, 1fr); }   /* 12 theme = 3×4 */
.options.wiz-grids .option { padding: 6px 4px; gap: 2px; }
.options.wiz-grids strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.wiz-grids small, .theme-opt small { font-size: clamp(11.5px, 12cqw, 14px); }
/* Đủ specificity để thắng `.option { padding: 24px 16px }` viết bên dưới */
.options.wiz-themes .option.theme-opt { padding: 8px 5px; gap: 4px; position: relative; }
@container (max-height: 74px) {
  .theme-sample { display: none; }
}
/* Tên theme: MỘT dòng duy nhất, cỡ chữ co theo bề rộng ô (container query)
   — không bao giờ cắt mất từ như line-clamp trong ô grid nén */
.hint-multi { margin: 0 0 12px; color: var(--muted); font-size: var(--text-sm); }
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
.option .icon { font-size: 38px; }
/* KHÔNG ẩn mô tả ở ô thấp — mất chú thích thì người chơi không biết chế độ đó
   là gì. Thay vào đó để chữ co tiếp: min của clamp hạ xuống 12px/9,5px, đủ để
   máy hẹp nhất (320×568, ô chỉ còn 40px lòng trong) vẫn hiện đủ hai phần. */

.code-input {
  letter-spacing: .3em;
  font-family: var(--font-display); font-weight: 700; text-align: center; font-size: 22px;
}

/* Khối mời bạn vào phòng */
.invite {
  display: flex; flex-direction: column; gap: 8px;
  margin: 0 0 12px; padding: 10px 12px;
  border: 2px solid color-mix(in srgb, var(--accent) 35%, var(--line));
  border-radius: var(--r-md); background: var(--accent-soft);
}
.invite-code { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.invite-label { font-size: var(--text-sm); font-weight: 700; color: var(--muted); }
.code-big {
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(24px, 8vw, 34px); letter-spacing: .16em; line-height: 1;
  font-variant-numeric: tabular-nums; color: var(--accent);
}
.invite-actions { display: flex; gap: 8px; }
.invite-btn {
  flex: 1; gap: 6px;
  font-size: var(--text-sm); font-weight: 700;
}
.invite-btn.primary {
  border: 0; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 6px 16px var(--card-back-glow);
}

/* Ping: giống chip trong màn chơi (OnlineGame) để nhìn ra ngay là cùng một thứ */
.ping {
  flex-shrink: 0; font-size: 10px; font-weight: 800; white-space: nowrap;
  padding: 1px 5px; border-radius: var(--r-full);
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok);
}
.ping.ok  { background: color-mix(in srgb, var(--muted) 16%, transparent); color: var(--muted); }
.ping.bad { background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn); }
.ping.lost { background: color-mix(in srgb, var(--bad) 20%, transparent); color: var(--bad); }

.lobby-list {
  list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 8px;
  /* Co được: thêm thanh chat bên dưới thì danh sách nhường chỗ, KHÔNG đẩy nút
     chính ra khỏi màn hình (quy tắc không-scroll). */
  min-height: 0; overflow-y: auto;
}
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
/* --ok-solid chứ không phải --ok: nút này có chữ TRẮNG, mà trắng trên --ok chỉ
   đạt 3,23:1 (cần 4,5) nên nhìn mờ và mỏi mắt. Bóng vẫn dùng màu sáng cho nổi. */
.is-ready {
  background: var(--ok-solid);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--ok) 40%, transparent);
}
.hint { color: var(--muted); font-size: var(--text-sm); margin: 14px 0 0; }
/* Thanh chat lobby: dán xuống đáy panel (margin-top: auto) để nó không chen vào
   giữa danh sách người chơi và nút chính. KHÔNG SCROLL: nó chỉ cao 40px và
   .lobby-list được phép co lại, nên nút "Bắt đầu" vẫn nằm trong màn hình. */
.lobby-chat { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
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
/* ── Bảng tuỳ chọn: giống hệt wizard chơi đơn (MenuScreen), cùng số đo ── */
.opt-list { display: flex; flex-direction: column; gap: 7px; min-height: 0; overflow: hidden; }
.opt-row {
  flex: 0 0 auto; border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-soft); padding: 6px 9px 7px;
}
.opt-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.opt-name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-md); }
.opt-hint {
  margin-left: auto; font-size: var(--text-xs); color: var(--muted);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  max-width: 45%; overflow: hidden; text-overflow: ellipsis;
}
.seg { display: flex; gap: 4px; }
.seg-btn {
  flex: 1 1 0; min-width: 0; min-height: 30px; height: 30px; padding: 0 3px;
  position: relative;
  border: 1px solid var(--line); border-radius: var(--r-full);
  background: var(--panel-solid); color: var(--muted);
  font-family: var(--font-body); font-weight: 700; font-size: 11px;
  letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* Vùng chạm 46px trong khi nút cao 30px (NF-07) */
.seg-btn::after { content: ''; position: absolute; inset: -8px; }
/* MỌI mức đang chọn đều sáng như nhau, kể cả mức tắt ("Vô hạn" / "Không").
   Trước đây mức tắt chỉ đổi viền cho "đỡ ồn", nhưng trong một dãy chọn-một thì
   người chơi nhìn vào chỉ thấy MỘT HÀNG KHÔNG CÓ NÚT NÀO ĐƯỢC CHỌN — không đọc
   ra được là mình đang tắt hay chưa chọn gì. */
.seg-btn[aria-pressed="true"] {
  background: linear-gradient(150deg, var(--brand-500), #8b5cf6);
  border-color: transparent; color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5), 0 4px 14px var(--card-back-glow);
}
@media (hover: hover) {
  .seg-btn:not([aria-pressed="true"]):hover { border-color: var(--line-strong); color: var(--fg); }
}

/* Chip luật của phòng: chỉ hiện thứ đang bật.
   align-items: center + flex: 0 0 auto là BẮT BUỘC: panel là flex column nên
   mặc định con bị kéo giãn, và chip cao vọt lên 90px (đã chụp thấy). */
.cfg-chips {
  display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px;
  align-items: center; align-content: flex-start; flex: 0 0 auto;
}
.cfg-chip {
  display: inline-flex; align-items: center; align-self: flex-start; gap: 4px;
  flex: 0 0 auto; line-height: 1.5;
  font-size: var(--text-xs); font-weight: 800; padding: 3px 9px 3px 4px;
  border-radius: var(--r-full); background: var(--accent-soft); color: var(--fg);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.cfg-chip :deep(.opt-ico) { border-radius: 5px; }

</style>
