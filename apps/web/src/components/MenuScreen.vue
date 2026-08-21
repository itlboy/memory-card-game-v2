<script setup lang="ts">
import { GRIDS } from '@mm/engine';
import type { Mode } from '@mm/engine';
import { computed, ref } from 'vue';
import { sfx } from '@/lib/audio';
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import CampaignMap from './CampaignMap.vue';

const props = defineProps<{
  themes: CardTheme[];
  mode: Mode;
  grid: string;
  themeId: string;
  playerCount: number;
  totalScore: number;
}>();

const emit = defineEmits<{
  'update:mode': [Mode];
  'update:grid': [string];
  'update:themeId': [string];
  'update:playerCount': [number];
  start: [];
  'start-level': [number];
  online: [];
}>();

/** Menu đi từng bước để người mới không bị ngợp: mỗi bước một câu hỏi. */
type Step = 'players' | 'count' | 'mode' | 'setup' | 'campaign';
const step = ref<Step>('players');

const isMulti = computed(() => props.playerCount > 1);

/** Đường đi của wizard tuỳ nhánh, dùng cho chấm tiến độ và nút quay lại. */
const path = computed<Step[]>(() =>
  isMulti.value
    ? ['players', 'count', 'mode', 'setup']
    : ['players', 'mode', props.mode === 'campaign' ? 'campaign' : 'setup']
);
const stepIndex = computed(() => path.value.indexOf(step.value));

const TITLES: Record<Step, string> = {
  players: 'Bạn muốn chơi thế nào?',
  count: 'Mấy người chơi?',
  mode: 'Chọn chế độ',
  setup: 'Chọn bàn chơi',
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
  step.value = m === 'campaign' && !isMulti.value ? 'campaign' : 'setup';
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
  const t = props.themes.find((x) => x.id === props.themeId);
  return !!t && t.symbols.length < Math.floor(cells.value / 2);
});
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
      <div v-if="step === 'players'" key="players" class="options">
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
      <div v-else-if="step === 'count'" key="count" class="options row3">
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
      <div v-else-if="step === 'mode'" key="mode" class="options">
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
      <div v-else-if="step === 'campaign'" key="campaign">
        <CampaignMap
          :progress="store.campaign()"
          :unlocked="store.unlockedLevel()"
          @play="emit('start-level', $event)"
        />
      </div>

      <!-- BƯỚC cuối: lưới + theme -->
      <div v-else key="setup">
        <h3 class="section-title">Kích thước lưới</h3>
        <div class="chips" role="radiogroup" aria-label="Kích thước lưới">
          <button
            v-for="k in gridKeys" :key="k" class="chip compact" role="radio"
            :aria-checked="grid === k" type="button"
            @click="emit('update:grid', k)"
          >
            <strong>{{ k.replace('x', '×') }}</strong>
            <small>{{ Math.floor(GRIDS[k]!.cols * GRIDS[k]!.rows / 2) }} cặp</small>
          </button>
        </div>

        <h3 class="section-title">Theme thẻ</h3>
        <div class="chips" role="radiogroup" aria-label="Theme thẻ">
          <button
            v-for="t in themes" :key="t.id" class="chip compact" role="radio"
            :aria-checked="themeId === t.id"
            :aria-disabled="!unlocked(t)"
            :disabled="!unlocked(t)"
            type="button"
            @click="unlocked(t) && emit('update:themeId', t.id)"
          >
            <strong>{{ t.name }}</strong>
            <small v-if="!unlocked(t)">🔒 cần {{ t.unlockAt }} điểm tích lũy</small>
            <small v-else>{{ t.symbols.length }} biểu tượng</small>
          </button>
        </div>

        <p v-if="themeTooSmall" class="warn" role="alert">
          Theme này không đủ biểu tượng cho lưới {{ grid.replace('x', '×') }}. Hãy chọn lưới nhỏ hơn hoặc theme khác.
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
.option:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-soft); }
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
