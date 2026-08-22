<script setup lang="ts">
import { GRIDS } from '@mm/engine';
import { Brain, ChevronLeft, Eye, Globe, Heart, Map, Timer, User, Users } from 'lucide-vue-next';
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

// Mỗi chế độ một màu neon cố định — theo suốt game (hướng thiết kế C)
const SOLO_MODES = [
  { id: 'campaign' as Mode, icon: Map,    g: 'g-violet', name: 'Chiến dịch',    desc: 'Đi từ dễ đến khó qua 20 màn · điểm cộng dồn' },
  { id: 'classic' as Mode,  icon: Brain,  g: 'g-blue',   name: 'Cổ điển',       desc: 'Thong thả, không giới hạn thời gian' },
  { id: 'time' as Mode,     icon: Timer,  g: 'g-amber',  name: 'Đua thời gian', desc: 'Xong càng nhanh, thưởng càng nhiều' },
  { id: 'survival' as Mode, icon: Heart,  g: 'g-red',    name: 'Sinh tồn',      desc: '5 mạng — quên thẻ đã mở là mất mạng' },
  { id: 'peek' as Mode,     icon: Eye,    g: 'g-teal',   name: 'Chớp nhoáng',   desc: 'Nhìn 4 giây, nhớ hết, rồi lật' }
];
// Mỗi số người một màu riêng: ba ô cùng màu thì nhìn như một khối, mắt không
// phân biệt được đang chọn cái nào
const COUNTS = [
  { n: 2, g: 'g-pink',   desc: 'Đấu tay đôi, thay lượt nhau' },
  { n: 3, g: 'g-violet', desc: 'Ba người, ai nhớ giỏi nhất?' },
  { n: 4, g: 'g-cyan',   desc: 'Bốn người, đông vui nhất' }
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
      <button v-if="stepIndex > 0" class="btn back" aria-label="Quay lại" type="button" @click="back"><ChevronLeft :size="22" /></button>
      <h2>{{ TITLES[step] }}</h2>
      <span class="dots" aria-hidden="true">
        <i v-for="(s, i) in path" :key="s" :class="{ on: i <= stepIndex }" />
      </span>
    </header>

    <Transition name="step" mode="out-in">
      <!-- BƯỚC 1: một mình hay nhiều người -->
      <div v-if="step === 'players'" key="players" class="step-body options loose">
        <button class="option big neon g-violet" type="button" @click="pickPlayers(false)">
          <User class="opt-icon" :size="40" />
          <strong>Chơi một mình</strong>
          <small>Luyện trí nhớ, phá kỷ lục của chính bạn</small>
        </button>
        <button class="option big neon g-pink" type="button" @click="pickPlayers(true)">
          <Users class="opt-icon" :size="40" />
          <strong>Chơi nhiều người</strong>
          <small>2–4 người thay lượt trên cùng máy này</small>
        </button>
        <button class="option big neon g-cyan" type="button" @click="sfx.select(); emit('online')">
          <Globe class="opt-icon" :size="40" />
          <strong>Chơi online</strong>
          <small>Tạo phòng, mời bạn bè bằng mã 6 ký tự</small>
        </button>
      </div>

      <!-- BƯỚC 2 (nhiều người): số người -->
      <div v-else-if="step === 'count'" key="count" class="step-body options loose counts">
        <button
          v-for="c in COUNTS" :key="c.n" class="option neon" :class="c.g" type="button"
          :aria-label="`${c.n} người chơi`"
          :aria-pressed="playerCount === c.n"
          @click="pickCount(c.n)"
        >
          <span class="count-num" aria-hidden="true">{{ c.n }}</span>
          <span class="text"><strong>người chơi</strong><small>{{ c.desc }}</small></span>
        </button>
      </div>

      <!-- BƯỚC: chọn chế độ -->
      <div v-else-if="step === 'mode'" key="mode" class="step-body options loose modes">
        <button
          v-for="m in modes" :key="m.id" class="option wide neon" :class="m.g" type="button"
          :aria-pressed="mode === m.id"
          @click="pickMode(m.id)"
        >
          <component :is="m.icon" class="opt-icon" :size="26" />
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
              gridTemplateRows: `repeat(${GRIDS[k]!.rows}, 1fr)`,
              aspectRatio: `${GRIDS[k]!.cols * 3} / ${GRIDS[k]!.rows * 4}`
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
            <span class="theme-sample" aria-hidden="true">{{ t.symbols.slice(0, 3).join(' ') }}</span>
            <strong class="tname">{{ t.name }}</strong>
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

/* Ô lựa chọn CHIA ĐỀU chỗ trống của panel: ít nút thì ô cao lên, nhiều nút thì
   ô nén lại — không còn thanh 92px nổi giữa panel 820px với khoảng trống trên dưới.
   Vẫn giữ luật KHÔNG SCROLL: grid nén trong chỗ còn lại, không đẩy trang dài ra. */
.step-body.options.loose { grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
.step-body.options.loose > .option {
  height: 100%; max-height: none; padding: 12px 18px;
}
/* Ô "big" không có wrapper .text: dùng grid để icon một cột, còn tiêu đề và
   mô tả XẾP DỌC ở cột thứ hai — nằm ngang cùng hàng thì tiêu đề bị ngắt dòng */
.options.loose .option.big {
  display: grid; grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 14px; row-gap: 2px; align-items: center; align-content: center;
  text-align: left; justify-items: start;
}
.options.loose .option.big .opt-icon { grid-row: span 2; flex-shrink: 0; }
/* Chỉ ô XẾP DỌC mới chặn theo chiều cao. Ô `.wide` (icon và chữ nằm ngang) thấp
   nhưng rộng — chặn theo chiều cao ở đó làm chữ tụt xuống vô cớ. */
.options.loose > .option:not(.wide) strong { font-size: clamp(18px, min(9cqw, 13cqh), 30px); }
.options.loose > .option:not(.wide) small { font-size: clamp(13px, min(5.4cqw, 8cqh), 18px); }
.options.loose > .option:not(.wide) .opt-icon { width: clamp(34px, min(15cqw, 22cqh), 62px); height: auto; }
.options.loose .option.big strong, .options.loose .option.big small { display: block; }


/* 12 cỡ bàn và 12 theme: LUÔN 3×4 — cột app cố định 440px ở mọi cỡ máy nên
   không đổi số cột theo breakpoint nữa (media query đo viewport, không đo cột,
   nên 4 cột sẽ vỡ trong cột hẹp). */
.options.grid3 { grid-template-columns: repeat(3, 1fr); }
.options.grid2 { grid-template-columns: repeat(3, 1fr); }
.theme-step { gap: 0; }
/* Preview co theo chỗ CÒN LẠI của ô: chiều cao cố định theo số hàng sẽ bị cắt
   mất hàng khi ô nén (màn thấp), làm preview không còn đúng hình bàn nữa.
   Tỷ lệ khung = cols*3 : rows*4 nên mỗi chấm vẫn giữ dáng lá bài 3:4. */
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
.options.grid3 .option { padding: 6px 4px; gap: 2px; }
.options.grid3 strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.grid3 small, .theme-opt small { font-size: clamp(11.5px, 12cqw, 14px); }
/* Phải đủ specificity để thắng `.option { padding: 16px 12px }` viết bên dưới —
   padding 12px hai bên ăn hết 1/4 bề rộng ô nên chữ co theo container bị bóp. */
.options.grid2 .option.theme-opt { padding: 8px 5px; gap: 4px; }
.theme-sample { font-size: clamp(15px, 26cqw, 32px); letter-spacing: 1px; white-space: nowrap; opacity: .9; }
/* Tên theme: cỡ chữ co theo bề rộng ô và ĐƯỢC PHÉP xuống dòng. Giữ một dòng thì
   cỡ chữ bị bề rộng ô (chỉ ~89px) khoá ở 12px trong khi ô còn trống gần 80px
   chiều cao — hai dòng chữ to đọc dễ hơn một dòng chữ tí xíu.
   Selector phải thắng `.option strong` (0,1,1) nên mới viết dạng này. */
.option strong.tname {
  font-size: clamp(13px, 20cqw, 21px);
  line-height: 1.15; text-align: center; max-width: 100%;
  overflow-wrap: break-word;
}
/* Ô cấu hình được chọn: bùng gradient neon (hướng C) */
.option[aria-checked='true']:not(.neon), .option[aria-pressed='true']:not(.neon) {
  border-color: transparent;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: 0 8px 26px rgba(106, 92, 255, .5), inset 0 1px 0 rgba(255, 255, 255, .3);
  color: #fff;
}
.option[aria-checked='true'] small, .option[aria-pressed='true'] small { color: rgba(255, 255, 255, .85); }
.option[aria-pressed='true'] .grid-preview i { background: rgba(255, 255, 255, .9); }
/* Ô neon màu riêng (chế độ, số người) đang chọn: thắp viền trắng, giữ màu gốc */
.option.neon[aria-pressed='true'], .option.neon[aria-checked='true'] {
  outline: 3px solid rgba(255, 255, 255, .85); outline-offset: -3px;
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
/* Số người chơi: 3 THANH NGANG chồng nhau. Xếp 3 cột thì trong cột app hẹp mỗi
   ô chỉ còn ~100px rộng nhưng cao 650px — ra ba sọc dọc, không ai nhận ra là nút. */
.options.loose.counts > .option {
  flex-direction: row; justify-content: center; align-items: center;
  gap: 14px; text-align: left;
}
.options.loose.counts .count-num { font-size: 40px; flex-shrink: 0; }
.options.loose.counts .text { display: flex; flex-direction: column; gap: 1px; }

.option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 12px; min-height: 44px;
  border: 2px solid var(--line); border-radius: 14px; background: var(--panel-soft);
  transition: transform .15s ease, box-shadow .15s ease;   /* chọn đổi màu tức thì */
  text-align: center;
  /* Cỡ chữ co theo bề rộng Ô (không phải theo màn hình): ô lựa chọn giờ chiếm
     trọn chỗ nên chữ cố định 16px trông bé tí giữa khoảng trống. */
  /* `size` (không phải inline-size) để cỡ chữ dùng được CẢ chiều cao ô: ô lớn
     cao 320px mà chữ chỉ theo bề rộng thì vẫn lọt thỏm. An toàn vì chiều cao ô
     do lưới quyết định, không do nội dung — không sinh vòng lặp layout. */
  container-type: size;
}
@media (hover: hover) {
.option:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-soft); }
}
.option[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); }
.option .icon { font-size: 30px; }
.opt-icon { color: var(--accent); flex-shrink: 0; }
.neon .opt-icon { color: #fff; }
.neon small { color: rgba(255, 255, 255, .85); }
.count-num {
  font-family: var(--font-display); font-weight: 800; font-size: 34px;
  color: var(--accent); line-height: 1;
}
.neon .count-num { color: #fff; }
.option strong { font-size: clamp(16px, 8cqw, 28px); }
.option small { color: var(--muted); font-size: clamp(12.5px, 5cqw, 17px); line-height: 1.35; }

.option.big .icon { font-size: 42px; }
.option.big strong { font-size: clamp(17px, 8.6cqw, 28px); }

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

.step-enter-active { transition: opacity .18s ease, transform .18s ease; }
.step-enter-from { opacity: 0; transform: translateX(14px); }
.step-leave-active { transition: opacity .12s ease; }
.step-leave-to { opacity: 0; }

.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
</style>
