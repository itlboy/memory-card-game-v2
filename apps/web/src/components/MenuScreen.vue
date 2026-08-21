<script setup lang="ts">
import { GRIDS } from '@mm/engine';
import type { Mode } from '@mm/engine';
import { computed, ref, watch } from 'vue';
import { sfx } from '@/lib/audio';
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import CampaignMap from './CampaignMap.vue';

const props = defineProps<{
  themes: CardTheme[];
  mode: Mode;
  grid: string;
  themeIds: string[];
  playerCount: number;
  totalScore: number;
}>();

const emit = defineEmits<{
  'update:mode': [Mode];
  'update:grid': [string];
  'update:themeIds': [string[]];
  'update:playerCount': [number];
  start: [];
  'start-level': [number];
  online: [];
}>();

/** Menu đi từng bước để người mới không bị ngợp: mỗi bước một câu hỏi. */
type Step = 'players' | 'count' | 'mode' | 'grid' | 'theme' | 'campaign';
const STEPS: readonly Step[] = ['players', 'count', 'mode', 'grid', 'theme', 'campaign'];

/** Bước hiện tại nằm trên URL (?w=grid) để F5 không bị bật về bước 1. */
function stepFromUrl(): Step {
  try {
    const w = new URLSearchParams(location.search).get('w') as Step | null;
    return w && STEPS.includes(w) ? w : 'players';
  } catch { return 'players'; }
}
const step = ref<Step>(stepFromUrl());

watch(step, (st) => {
  // Chỉ đụng đúng param `w` — các con trỏ khác (?playing, ?online, ?room) là của App
  const q = new URLSearchParams(location.search);
  if (st === 'players') {
    if (!q.has('w')) return;   // về bước 1: URL sạch — thoát là mất, đúng chủ đích
    q.delete('w');
  } else {
    q.set('w', st);
  }
  const qs = q.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
}, { immediate: true });

const isMulti = computed(() => props.playerCount > 1);

/** Đường đi của wizard tuỳ nhánh, dùng cho chấm tiến độ và nút quay lại. */
const path = computed<Step[]>(() =>
  isMulti.value
    ? ['players', 'count', 'mode', 'grid', 'theme']
    : ['players', 'mode', ...(props.mode === 'campaign' ? ['campaign' as const] : ['grid' as const, 'theme' as const])]
);
const stepIndex = computed(() => path.value.indexOf(step.value));
// Bước từ URL không khớp nhánh trong prefs (vd ?w=count nhưng đang chơi đơn) → về bước 1
if (step.value !== 'players' && !path.value.includes(step.value)) step.value = 'players';

const TITLES: Record<Step, string> = {
  players: 'Bạn muốn chơi thế nào?',
  count: 'Mấy người chơi?',
  mode: 'Chọn chế độ',
  grid: 'Kích thước lưới',
  theme: 'Chọn theme thẻ',
  campaign: 'Chọn màn'
};

const SOLO_MODES: { id: Mode; icon: string; name: string; desc: string }[] = [
  { id: 'campaign', icon: '🗺️', name: 'Chiến dịch',    desc: 'Đi từ dễ đến khó qua 20 màn · điểm cộng dồn' },
  { id: 'classic',  icon: '🧠', name: 'Cổ điển',       desc: 'Thong thả, không giới hạn thời gian' },
  { id: 'time',     icon: '⏱️', name: 'Đua thời gian', desc: 'Xong càng nhanh, thưởng càng nhiều' },
  { id: 'survival', icon: '❤️', name: 'Sinh tồn',      desc: '5 mạng — lật sai là mất mạng' },
  { id: 'peek',     icon: '👀', name: 'Chớp nhoáng',   desc: 'Nhìn 4 giây, nhớ hết, rồi lật' }
];
const MULTI_MODES = SOLO_MODES.filter((m) => m.id === 'classic' || m.id === 'survival');
const modes = computed(() => (isMulti.value ? MULTI_MODES : SOLO_MODES));

function pickPlayers(multi: boolean): void {
  sfx.select();
  emit('update:playerCount', multi ? Math.max(2, props.playerCount) : 1);
  // Nhiều người chỉ có 2 chế độ; nếu đang giữ chế độ solo thì đưa về Cổ điển
  if (multi && props.mode !== 'classic' && props.mode !== 'survival') emit('update:mode', 'classic');
  step.value = multi ? 'count' : 'mode';
}

function pickCount(n: number): void {
  sfx.select();
  emit('update:playerCount', n);
  step.value = 'mode';
}

function pickMode(m: Mode): void {
  sfx.select();
  emit('update:mode', m);
  step.value = m === 'campaign' && !isMulti.value ? 'campaign' : 'grid';
}

/** Ô chính giữa của lưới lẻ để trống — preview vẽ đúng như bàn thật. */
function isBlankCell(k: string, idx: number): boolean {
  const g = GRIDS[k]!;
  const total = g.cols * g.rows;
  return total % 2 === 1 && idx === Math.floor(total / 2);
}

function pickGrid(k: string): void {
  sfx.select();
  emit('update:grid', k);
  step.value = 'theme';
}

function back(): void {
  const i = stepIndex.value;
  if (i > 0) step.value = path.value[i - 1]!;
}

const gridKeys = Object.keys(GRIDS);
const unlocked = (t: CardTheme): boolean => t.unlockAt <= props.totalScore;
const best = computed(() => store.best(props.mode, props.grid));
const cells = computed(() => {
  const g = GRIDS[props.grid];
  return g ? g.cols * g.rows : 0;
});
/** Theme phải đủ biểu tượng cho lưới đã chọn. */
const themeTooSmall = computed(() => {
  const pool = new Set(
    props.themes.filter((t) => props.themeIds.includes(t.id)).flatMap((t) => t.symbols)
  );
  return pool.size > 0 && pool.size < Math.floor(cells.value / 2);
});

/** Bật/tắt một theme — luôn giữ ít nhất một theme được chọn. */
function toggleTheme(id: string): void {
  const cur = props.themeIds;
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  if (next.length) emit('update:themeIds', next);
}
</script>

<template>
  <section class="panel">
    <header class="wizard-head">
      <button v-if="stepIndex > 0" class="btn back" aria-label="Quay lại" type="button" @click="back">‹</button>
      <h2>{{ TITLES[step] }}</h2>
      <span class="dots" aria-hidden="true">
        <i v-for="(s, i) in path" :key="s" :class="{ on: i <= stepIndex }" />
      </span>
    </header>

    <Transition name="step" mode="out-in">
      <!-- BƯỚC 1: một mình hay nhiều người -->
      <div v-if="step === 'players'" key="players" class="step-body options">
        <button class="option big" type="button" @click="pickPlayers(false)">
          <span class="icon">🧍</span>
          <strong>Chơi một mình</strong>
          <small>Luyện trí nhớ, phá kỷ lục của chính bạn</small>
        </button>
        <button class="option big" type="button" @click="pickPlayers(true)">
          <span class="icon">👥</span>
          <strong>Chơi nhiều người</strong>
          <small>2–4 người thay lượt trên cùng máy này</small>
        </button>
        <button class="option big" type="button" @click="sfx.select(); emit('online')">
          <span class="icon">🌐</span>
          <strong>Chơi online</strong>
          <small>Tạo phòng, mời bạn bè bằng mã 6 ký tự</small>
        </button>
      </div>

      <!-- BƯỚC 2 (nhiều người): số người -->
      <div v-else-if="step === 'count'" key="count" class="step-body options row3">
        <button
          v-for="n in [2, 3, 4]" :key="n" class="option" type="button"
          :aria-pressed="playerCount === n"
          @click="pickCount(n)"
        >
          <span class="icon">{{ ['👥', '👨‍👩‍👦', '👨‍👩‍👧‍👦'][n - 2] }}</span>
          <strong>{{ n }} người</strong>
        </button>
      </div>

      <!-- BƯỚC: chọn chế độ -->
      <div v-else-if="step === 'mode'" key="mode" class="step-body options">
        <button
          v-for="m in modes" :key="m.id" class="option wide" type="button"
          :aria-pressed="mode === m.id"
          @click="pickMode(m.id)"
        >
          <span class="icon">{{ m.icon }}</span>
          <span class="text"><strong>{{ m.name }}</strong><small>{{ m.desc }}</small></span>
        </button>
      </div>

      <!-- BƯỚC: bản đồ Chiến dịch -->
      <div v-else-if="step === 'campaign'" key="campaign" class="step-body">
        <CampaignMap
          :progress="store.campaign()"
          :unlocked="store.unlockedLevel()"
          @play="emit('start-level', $event)"
        />
      </div>

      <!-- BƯỚC: kích thước lưới — chọn là sang bước theme -->
      <div v-else-if="step === 'grid'" key="grid" class="step-body options grid3">
        <button
          v-for="k in gridKeys" :key="k" class="option" type="button"
          :aria-pressed="grid === k"
          @click="pickGrid(k)"
        >
          <span
            class="grid-preview" aria-hidden="true"
            :style="{
              gridTemplateColumns: `repeat(${GRIDS[k]!.cols}, 1fr)`,
              width: `${GRIDS[k]!.cols * 8}px`
            }"
          >
            <i v-for="n in GRIDS[k]!.cols * GRIDS[k]!.rows" :key="n" :class="{ blank: isBlankCell(k, n - 1) }" />
          </span>
          <strong>{{ k.replace('x', '×') }}</strong>
          <small>{{ Math.floor(GRIDS[k]!.cols * GRIDS[k]!.rows / 2) }} cặp</small>
        </button>
      </div>

      <!-- BƯỚC cuối: theme (chọn được nhiều) + Bắt đầu -->
      <div v-else key="theme" class="step-body theme-step">
        <p class="hint-multi">Chọn được nhiều theme — bàn thẻ sẽ trộn biểu tượng của tất cả.</p>
        <div class="options grid2 fill" role="group" aria-label="Theme thẻ">
          <button
            v-for="t in themes" :key="t.id" class="option theme-opt" role="checkbox"
            :aria-checked="themeIds.includes(t.id)"
            :aria-disabled="!unlocked(t)"
            :disabled="!unlocked(t)"
            type="button"
            @click="unlocked(t) && toggleTheme(t.id)"
          >
            <span class="theme-sample" aria-hidden="true">{{ t.symbols.slice(0, 4).join(' ') }}</span>
            <strong class="tname">{{ themeIds.includes(t.id) ? '✓ ' : '' }}{{ t.name }}</strong>
            <small v-if="!unlocked(t)">🔒 {{ t.unlockAt / 1000 }}k điểm</small>
          </button>
        </div>

        <p v-if="themeTooSmall" class="warn" role="alert">
          Chưa đủ biểu tượng cho lưới {{ grid.replace('x', '×') }}. Hãy chọn thêm theme hoặc lưới nhỏ hơn.
        </p>

        <button class="btn-primary" :disabled="themeTooSmall" type="button" @click="emit('start')">
          Bắt đầu
        </button>

        <p class="best">
          <template v-if="best">
            Kỷ lục: <b>{{ best.score }}</b> điểm · {{ best.moves }} lượt · {{ clock(best.seconds) }}
          </template>
          <template v-else>Chưa có kỷ lục cho lưới {{ grid.replace('x', '×') }}.</template>
        </p>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.hint-multi { margin: 0 0 10px; color: var(--muted); font-size: var(--text-sm); }

/* KHÔNG SCROLL: panel chiếm trọn viewport, bước hiện tại co giãn trong chỗ còn lại */
section.panel { display: flex; flex-direction: column; min-height: 0; }
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

.options.grid3 {
  /* 12 cỡ bàn: 3 cột (mobile, 4 hàng) hay 4 cột (desktop, 3 hàng) đều tròn hàng */
  grid-template-columns: repeat(3, 1fr);
}
@media (min-width: 560px) {
  .options.grid3 { grid-template-columns: repeat(4, 1fr); }
}
.options.grid2 { grid-template-columns: repeat(3, 1fr); }   /* 12 theme = 3×4 */
@media (min-width: 560px) {
  .options.grid2 { grid-template-columns: repeat(4, 1fr); }
}
.theme-step { gap: 0; }
.grid-preview {
  display: grid; gap: 1.5px;
  align-content: center; max-width: 72%; min-height: 0;
}
.grid-preview i {
  aspect-ratio: 3 / 4; border-radius: 2px; min-height: 0;
  background: linear-gradient(150deg, var(--accent), var(--accent-2));
  opacity: .75;
}
.grid-preview i.blank { background: transparent; }
.options.grid3 .option { padding: 6px 4px; gap: 2px; }
.options.grid3 strong { font-size: var(--text-md); }
.options.grid3 small, .theme-opt small { font-size: var(--text-xs); }
.theme-opt { padding: 6px 4px; gap: 2px; }
.theme-sample { font-size: clamp(13px, 4vw, 20px); letter-spacing: 1px; white-space: nowrap; }
/* Tên theme: tối đa 2 dòng, không tràn khỏi ô nén */
.tname {
  font-size: var(--text-sm); line-height: 1.15; text-align: center;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.option[aria-checked='true'] {
  border-color: var(--accent); background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.wizard-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.wizard-head h2 { flex: 1; margin: 0; font-size: 19px; }
.back { min-width: 44px; font-size: 22px; line-height: 1; padding: 4px 12px; }
.dots { display: flex; gap: 6px; }
.dots i {
  width: 8px; height: 8px; border-radius: 50%; background: var(--line);
  transition: background .2s, transform .2s;
}
.dots i.on { background: var(--accent); transform: scale(1.15); }

.options { display: grid; gap: 10px; }
.options.row3 { grid-template-columns: repeat(3, 1fr); }

.option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 12px; min-height: 44px;
  border: 2px solid var(--line); border-radius: 14px; background: var(--panel-soft);
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
  text-align: center;
}
@media (hover: hover) {
.option:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-soft); }
}
.option[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); }
.option .icon { font-size: 30px; }
.option strong { font-size: 16px; }
.option small { color: var(--muted); font-size: 12.5px; }

.option.big { padding: 24px 16px; }
.option.big .icon { font-size: 42px; }
.option.big strong { font-size: 18px; }

.option.wide { flex-direction: row; text-align: left; gap: 14px; padding: 13px 16px; }
.option.wide .icon { font-size: 26px; }
.option.wide .text { display: flex; flex-direction: column; gap: 1px; }

.step-enter-active { transition: opacity .18s ease, transform .18s ease; }
.step-enter-from { opacity: 0; transform: translateX(14px); }
.step-leave-active { transition: opacity .12s ease; }
.step-leave-to { opacity: 0; }

.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
</style>
