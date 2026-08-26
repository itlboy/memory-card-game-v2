<script setup lang="ts">
import { BOT_SPECS, CAMPAIGN_LEVELS, OPTION_KEYS, OPTION_LABELS, levelSpec, optionSummary } from '@mm/engine';
import { Bot, Check, ChevronLeft, Globe, Lock, Map, User, Users } from 'lucide-vue-next';
import type { BoardOptions, BotLevel, Mode, OptLevel, OptionKey } from '@mm/engine';
import { computed, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiQuery } from '@/lib/appUrl';
import { sfx } from '@/lib/audio';
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import LevelMap from './LevelMap.vue';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';

const props = defineProps<{
  themes: CardTheme[];
  mode: Mode;
  /** Cấp độ đang chọn — quyết định cỡ bàn, dùng cho MỌI chế độ. */
  level: number;
  themeIds: string[];
  playerCount: number;
  totalScore: number;
  /** Số biểu tượng của các theme đang chọn — bước theme dùng để cảnh báo. */
  symbolCount: number;
  /** Số biểu tượng của TẤT CẢ theme đang mở khoá. Bản đồ cấp chặn theo con số
   *  này: cấp mà không bộ nào đủ thì có chọn theme kiểu gì cũng không chơi
   *  được, còn lại để bước theme phía sau lo. */
  maxSymbolCount: number;
  /** Đang đấu với máy ở mức nào, null là không đấu máy. */
  botLevel: BotLevel | null;
  /** Tuỳ chọn bàn chơi (năm công tắc 0..3). Chiến dịch không dùng tới. */
  options: BoardOptions;
}>();

const emit = defineEmits<{
  'update:mode': [Mode];
  'update:level': [number];
  'update:themeIds': [string[]];
  'update:playerCount': [number];
  'update:botLevel': [BotLevel | null];
  'start-level': [number];
  'update:options': [BoardOptions];
  online: [];
}>();

/** Menu đi từng bước để người mới không bị ngợp: mỗi bước một câu hỏi. */
/*
 * KHÔNG CÒN BƯỚC "CHỌN CHẾ ĐỘ". Bốn chế độ cũ (cổ điển, đua thời gian, sinh
 * tồn, chớp nhoáng) hoá ra chỉ là bốn tổ hợp cờ của cùng một engine, nên chúng
 * thành năm công tắc ở bước `options`, bật cái nào cũng được.
 *
 * Chiến dịch KHÔNG theo đường đó: 50 màn nối nhau, mở khoá dần, có mốc sao —
 * đó là một hành trình có luật riêng từng màn, không phải bàn chơi tự chọn.
 * Nó lên thẳng màn đầu thành một lối đi riêng, nên tổng số bước KHÔNG tăng.
 */
type Step = 'players' | 'bot' | 'count' | 'names' | 'level' | 'theme' | 'options';
const STEPS: readonly Step[] = ['players', 'bot', 'count', 'names', 'level', 'theme', 'options'];

/** Bước hiện tại nằm trên URL (?w=level) để F5 không bị bật về bước 1. */
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
  ghiQuery(q.toString() || null);
}, { immediate: true });

const isMulti = computed(() => props.playerCount > 1);

/** Đường đi của wizard tuỳ nhánh, dùng cho chấm tiến độ và nút quay lại. */
// Cấp độ đứng TRƯỚC theme: chọn chơi cấp nào là quyết định chính, còn theme là
// trang trí. Bản đồ cấp chỉ chặn cấp mà KHÔNG bộ theme nào đủ biểu tượng; bước
// theme sau đó cảnh báo nếu bộ đang chọn không đủ cho cấp này.
const path = computed<Step[]>(() => {
  // Chiến dịch: luật do từng màn quyết định, không có bước tuỳ chọn
  if (props.mode === 'campaign') return ['players', 'level', 'theme'];
  if (props.botLevel) return ['players', 'bot', 'level', 'theme', 'options'];
  return isMulti.value
    ? ['players', 'count', 'names', 'level', 'theme', 'options']
    : ['players', 'level', 'theme', 'options'];
});
const stepIndex = computed(() => path.value.indexOf(step.value));
// Bước từ URL không khớp nhánh trong prefs (vd ?w=count nhưng đang chơi đơn) → về bước 1
if (step.value !== 'players' && !path.value.includes(step.value)) step.value = 'players';

const TITLES: Record<Step, string> = {
  players: 'Bạn muốn chơi thế nào?',
  bot: 'Máy chơi giỏi cỡ nào?',
  count: 'Mấy người chơi?',
  names: 'Tên từng người',
  level: 'Chọn cấp độ',
  theme: 'Chọn theme thẻ',
  options: 'Bàn chơi'
};

// Mỗi số người một màu riêng: ba ô cùng màu thì nhìn như một khối, mắt không
// phân biệt được đang chọn cái nào
const COUNTS = [
  { n: 2, g: 'g-pink',   desc: 'Đấu tay đôi, thay lượt nhau' },
  { n: 3, g: 'g-violet', desc: 'Ba người, ai nhớ giỏi nhất?' },
  { n: 4, g: 'g-cyan',   desc: 'Bốn người, đông vui nhất' }
];

/** Bốn mức của máy. Mô tả nói bằng CẢM GIÁC chơi (và nói cho vui), không nói
 *  "retain 0,72" — trọng số là chuyện của engine. */
const BOT_CHOICES = [
  { id: 'easy' as BotLevel,   g: 'g-teal',   desc: 'Bot này hay quên, mở trước quên sau. Không tính điểm nhé.' },
  { id: 'normal' as BotLevel, g: 'g-blue',   desc: 'Bot này mới học xong lớp 5' },
  { id: 'hard' as BotLevel,   g: 'g-amber',  desc: 'Bot này trình độ đại học đấy, hãy cẩn thận' },
  { id: 'insane' as BotLevel, g: 'g-red',    desc: 'Thắng được bot này tôi gọi bạn bằng cụ' }
];

function pickBotMode(): void {
  sfx.select();
  emit('update:playerCount', 1);
  emit('update:botLevel', props.botLevel ?? 'normal');
  step.value = 'bot';
}

function pickBotLevel(l: BotLevel): void {
  sfx.select();
  emit('update:botLevel', l);
  // Máy chỉ đấu 1v1 và không có Chiến dịch (chuỗi màn của riêng một người)
  if (props.mode === 'campaign') emit('update:mode', 'classic');
  step.value = 'level';
}

/** Chiến dịch: một mình, không bot, và KHÔNG qua bảng tuỳ chọn. */
function pickCampaign(): void {
  sfx.select();
  emit('update:mode', 'campaign');
  emit('update:playerCount', 1);
  emit('update:botLevel', null);
  step.value = 'level';
}

function pickPlayers(multi: boolean): void {
  sfx.select();
  emit('update:botLevel', null);
  emit('update:playerCount', multi ? Math.max(2, props.playerCount) : 1);
  // Chơi nhanh luôn dùng khoá lưu 'classic' — kỷ lục và tiến độ giữ nguyên chỗ
  // cũ, còn luật ván thì do bảng tuỳ chọn quyết định.
  emit('update:mode', 'classic');
  step.value = multi ? 'count' : 'level';
}

function pickCount(n: number): void {
  sfx.select();
  emit('update:playerCount', n);
  syncNames(n);
  step.value = 'names';
}

/* ---------- tên người chơi (nhiều người cùng máy) ---------- */
const names = ref<string[]>([]);

/** Dựng đủ n ô tên, giữ tên đã lưu từ lần chơi trước. */
function syncNames(n: number): void {
  const saved = store.playerNames();
  names.value = Array.from({ length: n }, (_, i) => names.value[i] ?? saved[i] ?? '');
}

// F5 ngay ở bước này (?w=names) thì pickCount chưa từng chạy — phải tự dựng ô
watch(step, (st) => { if (st === 'names') syncNames(props.playerCount); }, { immediate: true });

/** Tên bỏ trống thì lấy "Người i" — không ép người chơi phải điền. */
function confirmNames(): void {
  const filled = names.value.map((v, i) => v.trim() || `Người ${i + 1}`);
  store.savePlayerNames(filled);
  names.value = filled;
  sfx.select();
  step.value = 'level';
}

/**
 * Năm hàng tuỳ chọn. Tên và mô tả nói bằng thứ người chơi thấy trên bàn, không
 * nói tên cờ trong engine.
 *
 * ĐÚNG NĂM HÀNG, không thêm: đo trên iPhone SE (390×667) thì mỗi hàng 73px và
 * còn dư 44px — hàng thứ sáu cần 80px, tức là tràn. Muốn thêm thì phải gộp hàng
 * chứ không được để trang dài ra (luật KHÔNG SCROLL).
 */
const OPTION_ROWS: readonly { key: OptionKey; icon: IconName; name: string }[] = [
  { key: 'time',    icon: 'time',    name: 'Thời gian' },
  { key: 'lives',   icon: 'lives',   name: 'Số mạng' },
  { key: 'peek',    icon: 'peek',    name: 'Xem trước' },
  { key: 'shuffle', icon: 'shuffle', name: 'Xáo thẻ' },
  { key: 'special', icon: 'special', name: 'Thẻ đặc biệt' }
];

/** Giá trị THẬT của từng hàng cho cấp đang chọn — không bắt người chơi đoán
 *  "Nhanh" nghĩa là bao nhiêu giây. */
const optionHints = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const k of OPTION_KEYS) out[k] = optionSummary(k, props.options[k], props.level) ?? 'tắt';
  return out;
});

function setOption(key: OptionKey, muc: OptLevel): void {
  if (props.options[key] === muc) return;
  sfx.select();
  emit('update:options', { ...props.options, [key]: muc });
}

/** Xong bước theme: chiến dịch chơi luôn, còn lại sang bảng tuỳ chọn. */
function xongTheme(): void {
  if (props.mode === 'campaign') { emit('start-level', props.level); return; }
  sfx.select();
  step.value = 'options';
}

function pickLevel(id: number): void {
  sfx.select();
  emit('update:level', id);
  step.value = 'theme';
}

function back(): void {
  const i = stepIndex.value;
  if (i > 0) step.value = path.value[i - 1]!;
}

/*
 * NÚT BACK CỦA TRÌNH DUYỆT lùi đúng một bước wizard, y như nút mũi tên trong
 * app. Trước đây mọi bước đều ghi URL bằng replaceState nên lịch sử chỉ có một
 * mục, và Back ở bước 5 là văng thẳng ra khỏi web.
 *
 * Độ sâu = chỉ số bước: ở bước đầu là 0 (Back lúc đó mới thật sự rời trang).
 */
useBackCloser(10, () => stepIndex.value > 0, back);

const unlocked = (t: CardTheme): boolean => t.unlockAt <= props.totalScore;
const best = computed(() => store.best(props.mode, props.level));
/** Số cặp mà cấp đang chọn cần — bước theme dùng để cảnh báo thiếu biểu tượng. */
const pairsNeeded = computed(() => levelSpec(props.level).pairs);
/** Bộ theme đang chọn có đủ biểu tượng cho cấp đã chọn chưa? */
const themeTooSmall = computed(() => {
  const pool = new Set(
    props.themes.filter((t) => props.themeIds.includes(t.id)).flatMap((t) => t.symbols)
  );
  return pool.size > 0 && pool.size < pairsNeeded.value;
});
/** Sao/đã qua tính riêng từng chế độ; mở khoá thì dùng chung (xem storage). */
const progress = computed(() => store.progress(props.mode));

/**
 * CHỈ CHƠI MỘT MÌNH mới đi theo thang cấp. Nhiều người cùng máy, đấu máy và
 * online thì mở sẵn hết.
 *
 * Vì sao: thang cấp là để dẫn người mới đi từ dễ tới khó, chuyện đó chỉ có nghĩa
 * khi chơi một mình. Bạn bè ngồi cạnh nhau hay hai người trong phòng online thì
 * họ muốn chọn bàn to nhỏ theo ý — bắt họ "cày" mở khoá là gò bó vô ích, mà máy
 * của ai mở tới đâu lại khác nhau nên còn thành tranh cãi chọn bàn nào.
 */
const unlockedLevel = computed(() =>
  isMulti.value || props.botLevel ? CAMPAIGN_LEVELS : store.unlockedLevel());

/** Bật/tắt một theme — luôn giữ ít nhất một theme được chọn. */
function toggleTheme(id: string): void {
  const cur = props.themeIds;
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  // Bỏ nốt theme cuối thì bàn không có biểu tượng nào — chặn, NHƯNG phải nói ra:
  // trước đây bấm mà không có gì xảy ra, người chơi tưởng nút bị lỗi.
  if (!next.length) {
    themeWarn.value = true;
    sfx.miss();
    clearTimeout(themeWarnTimer);
    themeWarnTimer = setTimeout(() => { themeWarn.value = false; }, 2000);
    return;
  }
  emit('update:themeIds', next);
}
const themeWarn = ref(false);
let themeWarnTimer: ReturnType<typeof setTimeout> | undefined;
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
        <!--
          Chiến dịch lên thẳng đây, thành một LỐI ĐI RIÊNG chứ không phải một
          "chế độ" ngang hàng với các tuỳ chọn: nó là chuỗi 50 màn mở khoá dần,
          luật cố định sẵn từng màn, nên không có bảng tuỳ chọn.
        -->
        <button class="option big neon g-violet" type="button" @click="pickCampaign()">
          <Map class="opt-icon" :size="40" />
          <strong>Chiến dịch</strong>
          <small>{{ CAMPAIGN_LEVELS }} màn từ dễ đến khó · điểm cộng dồn vào tổng</small>
        </button>
        <button class="option big neon g-blue" type="button" @click="pickPlayers(false)">
          <User class="opt-icon" :size="40" />
          <strong>Chơi nhanh</strong>
          <small>Một ván lẻ, bàn chơi do bạn đặt luật</small>
        </button>
        <button class="option big neon g-amber" type="button" @click="pickBotMode()">
          <Bot class="opt-icon" :size="40" />
          <strong>Đấu với máy</strong>
          <small>Một mình vẫn có đối thủ — máy chơi ngay trên máy bạn, không cần mạng</small>
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

      <!-- BƯỚC (đấu máy): mức của máy -->
      <div v-else-if="step === 'bot'" key="bot" class="step-body options loose">
        <button
          v-for="b in BOT_CHOICES" :key="b.id" class="option wide neon" :class="b.g" type="button"
          @click="pickBotLevel(b.id)"
        >
          <span class="bot-face" aria-hidden="true">{{ BOT_SPECS[b.id].avatar }}</span>
          <span class="text"><strong>{{ BOT_SPECS[b.id].name }}</strong><small>{{ b.desc }}</small></span>
        </button>
      </div>

      <!-- BƯỚC 2 (nhiều người): số người -->
      <div v-else-if="step === 'count'" key="count" class="step-body options loose counts">
        <button
          v-for="c in COUNTS" :key="c.n" class="option wide neon" :class="c.g" type="button"
          :aria-label="`${c.n} người chơi`"
          @click="pickCount(c.n)"
        >
          <!-- Đúng bằng số người: 2 người thì 2 hình, 4 người thì 4 hình. Một
               icon "nhóm" dùng chung cho cả ba ô thì mắt không đọc ra số nào. -->
          <span class="who-icons" :class="{ pair: c.n === 4 }" aria-hidden="true">
            <User v-for="i in c.n" :key="i" class="opt-icon" :size="26" />
          </span>
          <span class="text"><strong>{{ c.n }} người chơi</strong><small>{{ c.desc }}</small></span>
        </button>
      </div>

      <!-- BƯỚC (nhiều người): điền tên từng người -->
      <div v-else-if="step === 'names'" key="names" class="step-body names">
        <p class="hint-multi">Để trống thì dùng "Người 1", "Người 2"…</p>
        <div class="name-list">
          <label v-for="(_, i) in names" :key="i" class="name-row">
            <span class="name-no">{{ i + 1 }}</span>
            <input
              v-model="names[i]"
              type="text" maxlength="12" enterkeyhint="next"
              :placeholder="`Người ${i + 1}`"
              :aria-label="`Tên người chơi ${i + 1}`"
              @keydown.enter="confirmNames"
            >
          </label>
        </div>
        <button class="btn-primary" type="button" @click="confirmNames">Tiếp tục</button>
      </div>

      <!-- BƯỚC: chọn chế độ -->
      <!-- BƯỚC: chọn cấp độ. MỌI chế độ đều qua đây — trước kia chỉ Chiến dịch
           có bản đồ, các chế độ khác chọn 1 trong 12 cỡ bàn cố định, nên cùng
           một việc lại có hai kiểu chọn và chỉ Chiến dịch mới chơi tiếp được
           cấp sau. -->
      <div v-else-if="step === 'level'" key="level" class="step-body">
        <LevelMap
          :progress="progress"
          :unlocked="unlockedLevel"
          :symbol-count="maxSymbolCount"
          :show-stars="mode === 'campaign'"
          @play="pickLevel"
        />
      </div>

      <!-- BƯỚC: theme (chọn được nhiều) -->
      <div v-else-if="step === 'theme'" key="theme" class="step-body theme-step">
        <p class="hint-multi">Chọn được nhiều theme — bàn thẻ sẽ trộn biểu tượng của tất cả.</p>
        <div class="options grid2 fill" role="group" aria-label="Theme thẻ">
          <button
            v-for="t in themes" :key="t.id" class="option theme-opt" role="checkbox"
            :aria-checked="themeIds.includes(t.id)"
            :aria-disabled="!unlocked(t)"
            :aria-label="unlocked(t) ? t.name : `${t.name} — cần ${t.unlockAt / 1000}k điểm`"
            :disabled="!unlocked(t)"
            type="button"
            @click="unlocked(t) && toggleTheme(t.id)"
          >
            <span class="theme-sample" aria-hidden="true">{{ t.symbols.slice(0, 3).join(' ') }}</span>
            <strong class="tname">{{ t.name }}</strong>
            <!-- Badge khoá ở góc đã nói trạng thái; ở đây chỉ cần mốc điểm -->
            <small v-if="!unlocked(t)">{{ t.unlockAt / 1000 }}k điểm</small>
            <!-- Dấu chọn / khoá nằm TUYỆT ĐỐI ở góc: nằm trong luồng thì nó chiếm
                 một dòng và đẩy tên theme tràn ra khỏi ô -->
            <span v-if="themeIds.includes(t.id)" class="tick" aria-hidden="true">
              <Check :size="12" />
            </span>
            <span v-else-if="!unlocked(t)" class="tick locked" aria-hidden="true">
              <Lock :size="11" />
            </span>
          </button>
        </div>

        <p v-if="themeWarn" class="warn" role="alert">Phải giữ ít nhất một theme.</p>
        <p v-if="themeTooSmall" class="warn" role="alert">
          Chưa đủ biểu tượng cho cấp {{ level }} ({{ pairsNeeded }} cặp). Hãy chọn thêm theme.
        </p>

        <!-- Chiến dịch vào thẳng màn; chơi nhanh còn một bước đặt luật bàn -->
        <button
          class="btn-primary" :disabled="themeTooSmall" type="button"
          @click="xongTheme()"
        >
          {{ mode === 'campaign' ? `Bắt đầu cấp ${level}` : 'Tiếp' }}
        </button>

        <p class="best">
          <template v-if="best">
            Kỷ lục cấp {{ level }}: <b>{{ best.score }}</b> điểm · {{ best.moves }} lượt · {{ clock(best.seconds) }}
          </template>
          <template v-else>Chưa có kỷ lục cho cấp {{ level }}.</template>
        </p>
      </div>

      <!--
        BƯỚC: tuỳ chọn bàn chơi — thay cho bước chọn chế độ cũ.
        Mỗi hàng thật sự có trạng thái bật/tắt nên viền "đang chọn" ở đây là
        ĐÚNG (khác các bước bấm-là-đi như số người hay mức bot).
      -->
      <div v-else key="options" class="step-body opt-list">
        <div v-for="row in OPTION_ROWS" :key="row.key" class="opt-row">
          <div class="opt-head">
            <OptionIcon :name="row.icon" :size="24" />
            <span class="opt-name">{{ row.name }}</span>
            <span class="opt-hint">{{ optionHints[row.key] }}</span>
          </div>
          <div class="seg" role="group" :aria-label="row.name">
            <button
              v-for="(nhan, muc) in OPTION_LABELS[row.key]" :key="nhan"
              class="seg-btn" type="button"
              :aria-pressed="options[row.key] === muc"
              @click="setOption(row.key, muc as OptLevel)"
            >{{ nhan }}</button>
          </div>
        </div>

        <button class="btn-primary" type="button" @click="emit('start-level', level)">
          Bắt đầu cấp {{ level }}
        </button>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
/* KHÔNG SCROLL: panel chiếm trọn viewport (khung một bước nằm ở wizard.css) */
section.panel { display: flex; flex-direction: column; min-height: 0; }
.hint-multi { margin: 0 0 10px; color: var(--muted); font-size: var(--text-sm); }

/* Điền tên: danh sách dồn lên trên, nút Tiếp tục ở dưới cùng như các bước khác */
.names { justify-content: flex-start; }
.name-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.name-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 2px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-soft);
}
.name-row:focus-within { border-color: var(--accent); }
.name-no {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-md);
  color: #fff; background: linear-gradient(150deg, #6a5cff, #8b5cf6);
}
.name-row input {
  flex: 1; min-width: 0;
  border: 0; background: none; color: var(--fg);
  font-family: var(--font-body); font-size: var(--text-lg); font-weight: 700;
}
.name-row input:focus { outline: none; }


/* Ô lựa chọn CHIA ĐỀU chỗ trống của panel: ít nút thì ô cao lên, nhiều nút thì
   ô nén lại — không còn thanh 92px nổi giữa panel 820px với khoảng trống trên dưới.
   Vẫn giữ luật KHÔNG SCROLL: grid nén trong chỗ còn lại, không đẩy trang dài ra. */
.step-body.options.loose { grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
.step-body.options.loose > .option {
  height: 100%; max-height: none;
  /* Padding dọc co theo chiều cao CỬA SỔ (không phải theo ô — dùng cqh ở đây
     sinh vòng lặp): máy 320×568 ô chỉ cao 68px, padding cố định 12px ăn hết chỗ
     của chú thích. */
  padding: clamp(4px, 1.5vh, 12px) 18px;
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
.options.loose .option.big strong, .options.loose .option.big small { display: block; }


/* 12 cỡ bàn và 12 theme: LUÔN 3×4 — cột app cố định 440px ở mọi cỡ máy nên
   không đổi số cột theo breakpoint nữa (media query đo viewport, không đo cột,
   nên 4 cột sẽ vỡ trong cột hẹp). */
.options.grid3 { grid-template-columns: repeat(3, 1fr); }
.options.grid2 { grid-template-columns: repeat(3, 1fr); }
/* Mặt máy: emoji thay icon lucide, cỡ theo ô như .opt-icon */
.bot-face { font-size: clamp(28px, min(12cqw, 20cqh), 48px); line-height: 1; flex-shrink: 0; }

/* Bó icon người: 4 hình vẫn phải vừa cột icon, nên cho phép xuống hai hàng và
   xếp khít lại. */
.who-icons {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 1px; max-width: 62px; flex-shrink: 0;
}
.who-icons .opt-icon { width: clamp(18px, 7cqw, 27px); height: auto; }
/* 4 người xếp 2+2 cho vuông vắn; 3 người vẫn một hàng ba */
.who-icons.pair { max-width: 58px; }

.theme-step { gap: 0; }
.options.grid3 .option { padding: 6px 4px; gap: 2px; }
.options.grid3 strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.grid3 small, .theme-opt small { font-size: clamp(10px, min(12cqw, 15cqh), 14px); }
/* Phải đủ specificity để thắng `.option { padding: 16px 12px }` viết bên dưới —
   padding 12px hai bên ăn hết 1/4 bề rộng ô nên chữ co theo container bị bóp. */
.options.grid2 .option.theme-opt { padding: 8px 5px; gap: 4px; position: relative; }
/* Ô quá thấp thì bỏ hàng emoji mẫu và dòng mốc điểm, giữ tên theme — thà mất
   phần trang trí chứ không để chữ bị cắt. Badge khoá ở góc vẫn cho biết ô nào
   chưa mở, và aria-label giữ đủ thông tin cho trình đọc màn hình. */
@container (max-height: 74px) {
  .theme-sample { display: none; }
  .theme-opt small { display: none; }
}
/* Ô cấu hình được chọn: bùng gradient neon (hướng C) */
.option[aria-checked='true']:not(.neon), .option[aria-pressed='true']:not(.neon) {
  border-color: transparent;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  /* Bóng trung tính, không glow màu — glow lan vào khe giữa các ô làm chúng dính vào nhau */
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
  color: #fff;
}
.option[aria-checked='true'] small, .option[aria-pressed='true'] small { color: rgba(255, 255, 255, .85); }
.option[aria-pressed='true'] .grid-preview i { background: rgba(255, 255, 255, .9); }
/* Ô neon màu riêng (chế độ, số người) đang chọn: thắp viền trắng, giữ màu gốc */
/*
 * Viền trắng = ĐANG CHỌN, chỉ dành cho ô THẬT SỰ có trạng thái bật/tắt.
 *
 * Các bước "bấm là đi luôn" (số người, mức bot, chế độ) KHÔNG dùng aria-pressed
 * nữa: ở đó chẳng có gì để bật/tắt, mà giá trị nhớ từ lần chơi trước lại làm một
 * ô sáng viền ngay khi vừa vào bước — người chơi đọc ra thành "nút đang bị dính
 * trạng thái active", đúng như đã bị phản ánh.
 */
.option.neon[aria-pressed='true'], .option.neon[aria-checked='true'] {
  outline: 3px solid rgba(255, 255, 255, .85); outline-offset: -3px;
}
.wizard-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.wizard-head h2 { flex: 1; margin: 0; font-size: 19px; }
.back { min-width: 44px; font-size: 22px; line-height: 1; padding: 4px 12px; }

/* Số người chơi: 3 THANH NGANG chồng nhau. Xếp 3 cột thì trong cột app hẹp mỗi
   ô chỉ còn ~100px rộng nhưng cao 650px — ra ba sọc dọc, không ai nhận ra là nút. */
.options.loose.counts > .option {
  flex-direction: row; justify-content: center; align-items: center;
  gap: 14px; text-align: left;
}
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
.option[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); }
.option .icon { font-size: 30px; }
.option.big .icon { font-size: 42px; }
/* KHÔNG ghi đè cỡ chữ ở đây: cả wizard dùng chung `.option strong` trong
   wizard.css, ghi đè riêng cho ô .big là nguồn gốc chuyện bước 1 chữ nhỏ hơn
   các bước sau. */

/* Riêng màn này ô ngang có padding hẹp hơn (dáng ô đã cao sẵn) */
.option.wide { padding: 13px 16px; }
.option.wide .icon { font-size: 26px; }

.step-enter-active { transition: opacity .18s ease, transform .18s ease; }
.step-enter-from { opacity: 0; transform: translateX(14px); }
.step-leave-active { transition: opacity .12s ease; }
.step-leave-to { opacity: 0; }

.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
/* ── BẢNG TUỲ CHỌN BÀN CHƠI ───────────────────────────────────────────────
   Năm hàng phải vừa iPhone SE mà KHÔNG cuộn. Đo trên Chrome: hàng 73px, năm
   hàng + nút còn dư 44px. Hàng thứ sáu cần 80px nên sẽ tràn — muốn thêm tuỳ
   chọn thì phải gộp hàng, đừng để trang dài ra. */
.opt-list {
  display: flex; flex-direction: column; gap: 7px;
  min-height: 0; overflow: hidden;
}
.opt-row {
  flex: 0 0 auto;
  border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-soft); padding: 6px 9px 7px;
}
.opt-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.opt-name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-md); }
/* Giá trị THẬT của cấp đang chọn. tabular-nums để số không nhảy khi đổi mức. */
.opt-hint {
  margin-left: auto; font-size: var(--text-xs); color: var(--muted);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  max-width: 45%; overflow: hidden; text-overflow: ellipsis;
}
.seg { display: flex; gap: 4px; }
/* 11px chứ không 12: "Bình thường" ở 12px bị cắt thành "Bình thườ…" trên bàn
   390px — đã đo. Ghi đè min-height của .btn toàn cục (44px) vì đây không phải
   nút hành động; vùng chạm nới bằng ::after bên dưới. */
.seg-btn {
  flex: 1 1 0; min-width: 0; min-height: 30px; height: 30px; padding: 0 3px;
  position: relative;
  border: 1px solid var(--line); border-radius: var(--r-full);
  background: var(--panel-solid); color: var(--muted);
  font-family: var(--font-body); font-weight: 700; font-size: 11px;
  letter-spacing: -.01em; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
/* Vùng chạm ≠ hình của nút (NF-07): nút 30px, vùng chạm 46px. */
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

</style>
