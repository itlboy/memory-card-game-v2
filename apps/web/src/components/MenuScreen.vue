<script setup lang="ts">
import { anhEmoji } from '@/lib/emoji';
import { taiTruocTheme } from '@/lib/anh-theme';
import { tenBot } from '@/lib/ten';
import { tenTheme } from '@/lib/achievements';
import { t, td, ngonNgu } from '@/lib/i18n';
/** Bí danh của `t` cho chỗ vòng lặp theme đã đặt tên biến là `t`. */
const tr = t;

/**
 * Gợi ý số thật của tuỳ chọn do ENGINE sinh bằng tiếng Việt ("5 mạng", "30 giây",
 * "xáo 3 lần", "4 thẻ"). Đợt 3 sẽ đưa nhãn engine vào từ điển; tới lúc đó dịch
 * theo mẫu ở đây cho khỏi lẫn tiếng Việt trong bản English.
 */
function dichGoiYTuyChon(s: string | null): string | null {
  if (!s || ngonNgu.value === 'vi') return s;
  // i18n-bo-qua: mẫu tiếng Việt của engine là thứ ĐI DỊCH, không phải chữ hiển thị
  return s.replace(/^xáo (\d+) lần$/, '$1 swaps').replace(/ mạng$/, ' lives').replace(/ giây$/, 's').replace(/ thẻ$/, ' cards'); // i18n-bo-qua
}
import { BOT_SPECS, CAMPAIGN_LEVELS, LEVEL_KEYS, OPTION_KEYS, OPTION_LABELS, campaignSpec, levelSpec, optionSummary } from '@mm/engine';
import { Bot, ChevronLeft, Globe, Map, Play, Users } from 'lucide-vue-next';
import type { BoardOptions, BotLevel, Mode, OptLevel, OptionKey } from '@mm/engine';
import { computed, ref, watch } from 'vue';
import MatBot from './MatBot.vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiQuery } from '@/lib/appUrl';
import { sfx } from '@/lib/audio';
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import LevelMap from './LevelMap.vue';
import SizeGrid from './SizeGrid.vue';
import ThemePicker from './ThemePicker.vue';
import QuatLa from './QuatLa.vue';
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
  /** DẢI LỐI TẮT trên bước đầu: danh hiệu gợi ý, chuỗi ngày chơi, màn chiến
   *  dịch đang mở. Thiếu thứ nào thì chip đó không hiện. */
  goiY?: { id: string; name: string } | null;
  chuoiNgay?: number;
  manChienDich?: number;
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
  'chinh-phuc': [string];
}>();

/** Menu đi từng bước để người mới không bị ngợp: mỗi bước một câu hỏi. */
/*
 * KHÔNG CÒN BƯỚC "CHỌN CHẾ ĐỘ". Bốn chế độ cũ (cổ điển, đua thời gian, sinh
 * tồn, chớp nhoáng) hoá ra chỉ là bốn tổ hợp cờ của cùng một engine, nên chúng
 * thành năm công tắc ở bước `options`, bật cái nào cũng được.
 *
 * Chiến dịch KHÔNG theo đường đó: 60 màn nối nhau, mở khoá dần, có mốc sao —
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
  // "Chơi nhanh" gộp cả một mình lẫn nhiều người: luôn hỏi số người trước
  return isMulti.value
    ? ['players', 'count', 'names', 'level', 'theme', 'options']
    : ['players', 'count', 'level', 'theme', 'options'];
});
const stepIndex = computed(() => path.value.indexOf(step.value));
/**
 * BƯỚC ĐANG HIỆN TRÊN PHẦN ĐẦU (tiêu đề, chấm tiến độ, nút quay lại, nền panel).
 *
 * Trễ hơn `step` đúng một nhịp: chỉ đổi khi thân bước cũ đã RỜI HẲN
 * (`@after-leave` của Transition out-in), tức đổi cùng lúc thân bước mới bắt đầu
 * hiện. Bản cũ đọc thẳng `step` nên phần đầu nhảy sang bước mới NGAY khi bấm,
 * trong lúc lưới bước cũ còn đang mờ dần bên dưới — tiêu đề mới đè lên nội dung
 * cũ, rồi nội dung mới mới tới. Trên iPhone nhịp mờ khối lớn chậm hơn nên lộ rõ
 * (chủ dự án báo 14.10.2026, "vỡ vỡ"; Android không thấy). Đo bằng WebKit,
 * đóng băng animation ở giữa nhịp rời.
 */
const buocHien = ref<Step>(step.value);
const hienIndex = computed(() => path.value.indexOf(buocHien.value));
let dangRoi = false;
function batDauRoi(): void { dangRoi = true; }
function xongRoi(): void { dangRoi = false; buocHien.value = step.value; }
// Không có nhịp rời nào bắt đầu sau lần vẽ lại (Transition bị thay bằng bản giả
// trong test, hay bước đổi mà khoá không đổi) thì đổi ngay — không treo tiêu đề cũ.
watch(step, () => { if (!dangRoi) buocHien.value = step.value; }, { flush: 'post' });
// Bước từ URL không khớp nhánh trong prefs (vd ?w=count nhưng đang chơi đơn) → về bước 1
if (step.value !== 'players' && !path.value.includes(step.value)) step.value = 'players';
buocHien.value = step.value;


/**
 * Số người: 1..4 — BỐN Ô, lưới 2×2 (luật lưới tròn hàng ở CLAUDE.md). "1" là
 * chơi một mình: từ 11.10.2026 "Chơi nhanh" và "Chơi nhiều người" gộp thành MỘT
 * ô ở bước đầu. Trần 4 người do chủ dự án chốt: 10 người chung một máy "không
 * chơi nổi". Online vẫn tới 10 (ROOM_LIMITS) — đó là mỗi người một máy.
 *
 * Mỗi số một màu riêng: hai ô cùng màu cạnh nhau thì nhìn như một khối, mắt
 * không đọc ra đang chọn cái nào. Chín ô = chín gradient, nên global.css có
 * thêm g-lime và g-orange.
 *
 * Bỏ dòng mô tả: chín ô mô tả dài thì mỗi ô còn ~60px cao, chữ bị cắt. Ở đây
 * con SỐ chính là nội dung.
 */
/* Mặt thú thay hình người nét mảnh (chủ dự án duyệt 18.10.2026): đúng loại mặt làm avatar trong ván,
   trẻ nhìn là hiểu "mỗi bạn một con". Ảnh Noto 3D 128 có sẵn vì nằm trong theme Động vật. */
const MAT_THU = ['🐼', '🦊', '🐯', '🐸'].map((s) => anhEmoji(s, true, 128) ?? '');

const COUNTS = [
  { n: 1, g: 'g-blue' },
  { n: 2, g: 'g-pink' },
  { n: 3, g: 'g-violet' },
  { n: 4, g: 'g-amber' }
];

/** Năm mức của máy. Mô tả nói bằng CẢM GIÁC chơi (và nói cho vui), không nói
 *  "retain 0,72" — trọng số là chuyện của engine.
 *  Ô xếp MỘT CỘT nên thêm mức là mọi ô thấp xuống, KHÔNG làm trang dài ra
 *  (luật KHÔNG SCROLL) — nhưng mỗi ô vẫn phải trên ngưỡng chạm 44px. */
// Màu ô chọn để MẶT MÁY không trùng tông ô (Kẹo: 🐥 vàng → ô hồng, báo đen → ô vàng,
// 🐯 cam → ô xanh lá, rồng vàng → ô đỏ) — mặt nằm thẳng trên ô, không có đĩa trắng.
const BOT_CHOICES = [
  { id: 'easy' as BotLevel,   g: 'g-teal' },
  { id: 'normal' as BotLevel, g: 'g-amber' },
  { id: 'hard' as BotLevel,   g: 'g-blue' },
  { id: 'insane' as BotLevel, g: 'g-violet' },
  { id: 'divine' as BotLevel, g: 'g-red' }
];

function pickBotMode(): void {
  sfx.select();
  emit('update:playerCount', 1);
  emit('update:botLevel', props.botLevel ?? 'normal');
  // Thoát Chiến dịch NGAY TẠI ĐÂY, không đợi tới lúc chọn mức: còn để mode
  // 'campaign' thì `path` là đường của Chiến dịch, không có bước 'bot', nên
  // stepIndex = -1 và nút quay lại biến mất (người chơi báo 13.10.2026).
  if (props.mode === 'campaign') emit('update:mode', 'classic');
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

function pickPlayers(): void {
  sfx.select();
  emit('update:botLevel', null);
  // Chơi nhanh luôn dùng khoá lưu 'classic' — kỷ lục và tiến độ giữ nguyên chỗ
  // cũ, còn luật ván thì do bảng tuỳ chọn quyết định.
  emit('update:mode', 'classic');
  step.value = 'count';
}

function pickCount(n: number): void {
  sfx.select();
  emit('update:playerCount', n);
  if (n < 2) { step.value = 'level'; return; }   // một mình: không có bước tên
  syncNames(n);
  step.value = 'names';
}

/** Lối tắt: chơi tiếp chiến dịch ở màn đang mở, khỏi đi qua bản đồ. */
function tiepChienDich(): void {
  sfx.select();
  emit('update:mode', 'campaign');
  emit('update:playerCount', 1);
  emit('update:botLevel', null);
  emit('start-level', props.manChienDich ?? 1);
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
  const filled = names.value.map((v, i) => v.trim() || t('menu.nguoiN', { n: i + 1 }));
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
const OPTION_ROWS: readonly { key: OptionKey; icon: IconName }[] = [
  { key: 'time', icon: 'time' },
  { key: 'lives', icon: 'lives' },
  { key: 'peek', icon: 'peek' },
  { key: 'shuffle', icon: 'shuffle' },
  { key: 'special', icon: 'special' }
];

/** Giá trị THẬT của từng hàng cho cấp đang chọn — không bắt người chơi đoán
 *  "Nhanh" nghĩa là bao nhiêu giây. */
const optionHints = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const k of OPTION_KEYS) out[k] = dichGoiYTuyChon(optionSummary(k, props.options[k], props.level)) ?? t('menu.tat');
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

/** Bước chọn bàn đổi tên theo chế độ: Chiến dịch chọn CẤP (bản đồ), các chế độ
 *  khác chọn SỐ THẺ. Cùng một bước nhưng hỏi hai thứ khác nhau. */
/** Tên bàn để nhắc lại trong các câu (kỷ lục, cảnh báo thiếu biểu tượng).
 *  Chiến dịch nói "cấp 12", chế độ khác nói "bàn 24 thẻ" — vì ngoài Chiến dịch
 *  số cấp không còn là thứ người chơi từng nhìn thấy trên màn hình. */
const tenBan = computed(() =>
  props.mode === 'campaign' ? t('menu.banCap', { n: props.level }) : t('menu.banThe', { n: pairsNeeded.value * 2 }));

const tieuDe = computed(() =>
  buocHien.value === 'level' && props.mode !== 'campaign' ? t('menu.chonSoThe') : td(`menu.buoc.${buocHien.value}`));

const best = computed(() => store.best(props.mode, props.level));
/** Số cặp mà cấp đang chọn cần — bước theme dùng để cảnh báo thiếu biểu tượng. */
/** Spec của cấp đang chọn. Chiến dịch (màn 1..60) và chế độ thường (khoá cỡ
 *  bàn 1..50) là hai thang — `level` có thể còn giữ số màn Chiến dịch khi người
 *  chơi đổi sang chơi nhanh, nên nhánh thường kẹp về LEVEL_KEYS. */
const spec = computed(() => (props.mode === 'campaign'
  ? campaignSpec(Math.min(props.level, CAMPAIGN_LEVELS))
  : levelSpec(Math.min(props.level, LEVEL_KEYS))));
const pairsNeeded = computed(() => spec.value.pairs);
/** Mốc sao nói bằng "<": ★★★★ không quên · ★★★ quên < N · ★★ quên < M. Bàn nhỏ
 *  mà 3★ cũng đòi không quên thì gộp vào ★★★★, khỏi nói một điều hai lần. */
const mocSao = computed(() => {
  const [max2, max3] = spec.value.starMisses;
  return [
    { sao: 4, txt: t('menu.khongQuen') },
    ...(max3 > 0 ? [{ sao: 3, txt: t('menu.quenDuoi', { n: max3 + 1 }) }] : []),
    { sao: 2, txt: t('menu.quenDuoi', { n: max2 + 1 }) }
  ];
});
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

/* Icon 3D (Noto, cùng bộ với mặt bài) cho bốn ô trang chủ — skin Kẹo hiện chúng thay icon
   nét (keo.css); skin khác vẫn icon nét (`.ico3d` ẩn mặc định). Chủ dự án 17.10.2026: "nút
   phẳng, đơn điệu". */
/* Tải trước hình ô theme lúc rảnh (lib/anh-theme.ts) — tới bước chọn theme là hiện tức thì.
   themes nạp bất đồng bộ nên chờ có dữ liệu. */
watch(() => props.themes.length, (n) => { if (n) taiTruocTheme(props.themes); }, { immediate: true });

const ICO3D = {
  // ⭐ thay 🗺️ (chủ dự án 18.10.2026): bản đồ xanh lá + xanh dương chìm vào ô xanh, lại rối chi tiết;
  // ngôi sao một khối, vàng nổi trên xanh, và khớp sao đánh giá — sao giờ chỉ dành cho Chiến dịch.
  chienDich: anhEmoji('⭐', true, 128) ?? '', choiNhanh: anhEmoji('🚀', true, 128) ?? '',
  // robot TỰ VẼ (public/img/robot.svg) — 🤖 Noto vuông cứng, chủ dự án muốn "đáng yêu hơn"
  dauMay: '/img/robot.svg', online: anhEmoji('🌍', true, 128) ?? ''
};
</script>

<template>
  <section class="panel" :class="{ 'trang-chu': buocHien === 'players' }">
    <header v-if="buocHien !== 'players'" class="wizard-head">
      <button v-if="hienIndex > 0" class="btn back" :aria-label="t('menu.quayLai')" type="button" @click="back"><ChevronLeft :size="22" /></button>
      <h2>{{ tieuDe }}</h2>
      <span class="dots" aria-hidden="true">
        <i v-for="(s, i) in path" :key="s" :class="{ on: i <= hienIndex }" />
      </span>
    </header>
    <h2 v-else class="sr-only">{{ tieuDe }}</h2>

    <Transition name="step" mode="out-in" @before-leave="batDauRoi" @after-leave="xongRoi">
      <!--
        TRANG CHỦ (13.10.2026, mockup B chủ dự án duyệt): quạt lá bài · Chiến
        dịch là ô to riêng · ba ô vuông Chơi nhanh / Đấu máy / Online · dải lối
        tắt dưới đáy. Bỏ dòng mô tả dưới mỗi ô — bốn ô dài chữ là thứ làm trang
        chủ cũ đọc như một biểu mẫu. Quạt lá tự co (flex: 1, min-height: 0) và
        ẩn hẳn khi máy quá thấp, nên KHÔNG SCROLL vẫn giữ.
      -->
      <div v-if="step === 'players'" key="players" class="step-body home">
        <QuatLa :themes="themes" />

        <button class="o-chien-dich neon g-violet" type="button" :title="t('menu.chienDichMo', { n: CAMPAIGN_LEVELS })" @click="pickCampaign()">
          <Map class="opt-icon" :size="34" aria-hidden="true" /><img class="ico3d" :src="ICO3D.chienDich" alt="" aria-hidden="true">
          <strong>{{ t('menu.chienDich') }}</strong>
          <span v-if="(manChienDich ?? 0) > 0" class="man thach">{{ t('menu.man', { n: manChienDich ?? 1 }) }}</span>
        </button>

        <div class="ba-o">
          <!-- Chơi nhanh xanh trời, Online vàng (chủ dự án đổi chỗ 18.10.2026; ở Kẹo g-cyan = trời, g-blue = vàng) -->
          <button class="o-vuong neon g-cyan" type="button" :title="t('menu.choiNhanhMo')" @click="pickPlayers()">
            <Users class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.choiNhanh" alt="" aria-hidden="true"><strong>{{ t('menu.choiNhanh') }}</strong>
          </button>
          <button class="o-vuong neon g-amber" type="button" :title="t('menu.dauMayMo')" @click="pickBotMode()">
            <Bot class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.dauMay" alt="" aria-hidden="true"><strong>{{ t('menu.dauMay') }}</strong>
          </button>
          <button class="o-vuong neon g-blue" type="button" :title="t('menu.onlineMo')" @click="sfx.select(); emit('online')">
            <Globe class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.online" alt="" aria-hidden="true"><strong>{{ t('menu.online') }}</strong>
          </button>
        </div>

        <!-- DẢI LỐI TẮT (11.10.2026): việc hay làm nhất, một chạm -->
        <div v-if="goiY || (chuoiNgay ?? 0) > 1 || (manChienDich ?? 0) > 1" class="loi-tat">
          <span v-if="(chuoiNgay ?? 0) > 1" class="lt-chip lua thach th-vang" :title="t('menu.chuoiNgayTitle', { n: chuoiNgay ?? 0 })">🔥 {{ t('menu.chuoiNgay', { n: chuoiNgay ?? 0 }) }}</span>
          <button v-if="(manChienDich ?? 0) > 1" class="lt-chip thach" type="button" @click="tiepChienDich">
            <Play :size="14" aria-hidden="true" /><span class="ten">{{ t('menu.man', { n: manChienDich ?? 1 }) }}</span>
          </button>
          <button v-if="goiY" class="lt-chip goi-y thach th-do" type="button" :aria-label="t('menu.chinhPhucAria', { ten: goiY.name })" @click="emit('chinh-phuc', goiY.id)">
            <span aria-hidden="true">🎯</span><span class="ten">{{ goiY.name }}</span>
          </button>
        </div>
      </div>

      <!-- BƯỚC (đấu máy): mức của máy -->
      <div v-else-if="step === 'bot'" key="bot" class="step-body options loose">
        <button
          v-for="b in BOT_CHOICES" :key="b.id" class="option wide neon" :class="b.g" type="button"
          @click="pickBotLevel(b.id)"
        >
          <span class="bot-face" aria-hidden="true"><MatBot :mat="BOT_SPECS[b.id].avatar" /></span>
          <span class="text"><strong>{{ tenBot(b.id) }}</strong><small>{{ td(`menu.bot.${b.id}`) }}</small></span>
        </button>
      </div>

      <!-- BƯỚC 2 (nhiều người): số người -->
      <!--
        BỐN THANH NGANG xếp dọc, giống bước mức máy (chủ dự án 12.10.2026: lưới 2×2
        "hơi trống" — bốn ô vuông giữa một màn cao để lại hai dải trắng lớn). Thanh
        ngang trải kín chiều cao như mọi bước wizard (luật KHÔNG SCROLL). Đủ n hình
        người vì tối đa chỉ 4: đếm hình nhanh hơn đọc số.
      -->
      <div v-else-if="step === 'count'" key="count" class="step-body options loose counts">
        <button
          v-for="c in COUNTS" :key="c.n" class="option wide neon" :class="c.g" type="button"
          :aria-label="t('menu.soNguoiAria', { n: c.n })"
          @click="pickCount(c.n)"
        >
          <span class="hinh-nguoi" :class="`n${c.n}`" aria-hidden="true"><img v-for="m in MAT_THU.slice(0, c.n)" :key="m" :src="m" alt=""></span>
          <span class="text">
            <strong>{{ c.n === 1 ? t('menu.soNguoi.1') : t('menu.soNguoi.n', { n: c.n }) }}</strong>
            <small>{{ td(`menu.soNguoiMo.${c.n}`) }}</small>
          </span>
        </button>
      </div>

      <!-- BƯỚC (nhiều người): điền tên từng người -->
      <div v-else-if="step === 'names'" key="names" class="step-body names">
        <p class="hint-multi">{{ t('menu.goiYTen') }}</p>
        <div class="name-list">
          <label v-for="(_, i) in names" :key="i" class="name-row">
            <span class="name-no">{{ i + 1 }}</span>
            <input
              v-model="names[i]"
              type="text" maxlength="12" enterkeyhint="next"
              :placeholder="t('menu.nguoiN', { n: i + 1 })"
              :aria-label="t('menu.tenNguoiAria', { n: i + 1 })"
              @keydown.enter="confirmNames"
            >
          </label>
        </div>
        <button class="btn-primary" type="button" @click="confirmNames">{{ t('menu.tiepTuc') }}</button>
      </div>

      <!-- BƯỚC: chọn chế độ -->
      <!-- BƯỚC: chọn cấp độ. MỌI chế độ đều qua đây — trước kia chỉ Chiến dịch
           có bản đồ, các chế độ khác chọn 1 trong 12 cỡ bàn cố định, nên cùng
           một việc lại có hai kiểu chọn và chỉ Chiến dịch mới chơi tiếp được
           cấp sau. -->
      <div v-else-if="step === 'level'" key="level" class="step-body">
        <!-- Chiến dịch: bản đồ 60 màn, vì ở đó cấp THẬT SỰ là độ khó (sao, mở
             khoá, thời gian siết dần). Chế độ khác: cấp chỉ còn là cỡ bàn nên
             hỏi thẳng số thẻ, độ khó để bước tuỳ chọn lo. -->
        <LevelMap
          v-if="mode === 'campaign'"
          :progress="progress"
          :unlocked="unlockedLevel"
          :symbol-count="maxSymbolCount"
          :show-stars="true"
          @play="pickLevel"
        />
        <SizeGrid v-else :level="level" :symbol-count="maxSymbolCount" @play="pickLevel" />
      </div>

      <!-- BƯỚC: theme (chọn được nhiều) -->
      <div v-else-if="step === 'theme'" key="theme" class="step-body theme-step">
        <p class="hint-multi">{{ t('menu.nhieuTheme') }}</p>
        <ThemePicker :themes="themes" :selected="themeIds" :nhan="t('menu.themeThe')" @toggle="toggleTheme" @dat="(ids) => emit('update:themeIds', ids)" />

        <p v-if="themeWarn" class="warn" role="alert">{{ t('menu.itNhatMotTheme') }}</p>
        <p v-if="themeTooSmall" class="warn" role="alert">
          {{ t('menu.thieuTheme', { ban: tenBan, n: pairsNeeded }) }}
        </p>

        <!-- Chiến dịch vào thẳng màn; chơi nhanh còn một bước đặt luật bàn -->
        <button
          class="btn-primary" :disabled="themeTooSmall" type="button"
          @click="xongTheme()"
        >
          {{ mode === 'campaign' ? t('menu.batDauCap', { n: level }) : t('menu.tiep') }}
        </button>

        <!-- Mốc sao nói TRƯỚC khi chơi (chủ dự án 14.10.2026): 3★ cố ý khó, người
             chơi phải biết đích trước khi vào ván -->
        <p v-if="mode === 'campaign'" class="moc-sao">
          <template v-for="(m, i) in mocSao" :key="m.sao">
            <span v-if="i" class="ngan"> · </span>
            <span class="nhom"><span class="vang">{{ '★'.repeat(Math.min(m.sao, 3)) }}</span><span v-if="m.sao === 4" class="sao4 song">★</span> {{ m.txt }}</span>
          </template>
        </p>
        <p class="best">
          <template v-if="best">
            {{ t('menu.kyLuc', { ban: tenBan }) }}<b>{{ best.score }}</b>{{ t('menu.kyLucSau', { luot: best.moves, gio: clock(best.seconds) }) }}
          </template>
          <template v-else>{{ t('menu.chuaKyLuc', { ban: tenBan }) }}</template>
        </p>
      </div>

      <!--
        BƯỚC: tuỳ chọn bàn chơi — thay cho bước chọn chế độ cũ.
        Mỗi hàng thật sự có trạng thái bật/tắt nên viền "đang chọn" ở đây là
        ĐÚNG (khác các bước bấm-là-đi như số người hay mức bot).
      -->
      <div v-else key="options" class="step-body opt-list">
        <div class="opt-rows">
        <div v-for="row in OPTION_ROWS" :key="row.key" class="opt-row">
          <div class="opt-head">
            <OptionIcon :name="row.icon" :size="24" />
            <span class="opt-name">{{ td(`opt.${row.key}`) }}</span>
            <span class="opt-hint">{{ optionHints[row.key] }}</span>
          </div>
          <div class="seg" role="group" :aria-label="td(`opt.${row.key}`)">
            <button
              v-for="(nhan, muc) in OPTION_LABELS[row.key]" :key="nhan"
              class="seg-btn" type="button"
              :aria-pressed="options[row.key] === muc"
              @click="setOption(row.key, muc as OptLevel)"
            >{{ td(`opt.${row.key}.${muc}`) }}</button>
          </div>
        </div>
        </div>

        <button class="btn-primary" type="button" @click="emit('start-level', level)">
          {{ t('menu.batDau', { ban: tenBan }) }}
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
  color: var(--chon-chu); background: var(--chon-nen);
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

.loi-tat { display: flex; gap: 6px; margin: 0 0 10px; flex: 0 0 auto; min-width: 0; }
.loi-tat .lt-chip {
  /* CHIA ĐỀU BỀ NGANG: số chip đổi theo người chơi (🔥 chỉ khi chuỗi ≥2 ngày,
     "Màn N" chỉ khi đã chơi Chiến dịch), mà chip co theo chữ thì 1 hay 2 chip
     đều lệch hẳn một bên (chủ dự án báo "không cân đối"). Mỗi chip một phần
     bằng nhau, chữ canh giữa, dài thì cắt "…". */
  flex: 1 1 0; justify-content: center;
  /* Tên lớp RIÊNG `lt-chip`: `.chip` toàn cục xếp cột, đẩy icon lên TRÊN chữ (ảnh chủ dự án) */
  position: relative; display: inline-flex; flex-direction: row; align-items: center; gap: 5px; min-width: 0;
  min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--panel-solid); color: var(--fg); font: inherit; font-size: 13px; font-weight: 800; white-space: nowrap;
}
.loi-tat button.lt-chip { cursor: pointer; }
.loi-tat button.lt-chip::after { content: ''; position: absolute; inset: -5px -2px; }
.loi-tat .lt-chip.lua { background: linear-gradient(135deg, #ffd76a, #f0a500); color: #4a2f00; border-color: transparent; }
.loi-tat .lt-chip.goi-y { background: var(--nhan-nen); color: var(--nhan-chu); border-color: transparent; }
.loi-tat .lt-chip .ten { overflow: hidden; text-overflow: ellipsis; }
/* Mặt máy: emoji thay icon lucide, cỡ theo ô như .opt-icon */
.hinh-nguoi {
  /* MỘT hàng trong 96px: càng nhiều mặt càng nhỏ và chồng nhau (chủ dự án: mặt 3/4 người phải nhỏ
     hơn) — 46 · 2×36 · 3×30 · 4×26px, chồng 8/6/5px → rộng nhất 89px. */
  flex: 0 0 auto; width: 96px; display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;
}
.hinh-nguoi img { width: var(--mat); height: var(--mat); flex: none; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .25)); }
.hinh-nguoi img + img { margin-left: calc(var(--chong) * -1); }
.hinh-nguoi.n1 { --mat: 46px; }
.hinh-nguoi.n2 { --mat: 36px; --chong: 8px; }
.hinh-nguoi.n3 { --mat: 30px; --chong: 6px; }
.hinh-nguoi.n4 { --mat: 26px; --chong: 5px; }
.bot-face { font-size: clamp(28px, min(12cqw, 20cqh), 48px); line-height: 1; flex-shrink: 0; }


.theme-step { gap: 0; }
/* Lưới theme dùng CSS chung ở `styles/theme-grid.css` — hai màn (đây và
   OnlineScreen) từng có hai bản riêng và lệch nhau ở đúng chỗ khó thấy. */
.options.grid3 .option { padding: 6px 4px; gap: 2px; }
.options.grid3 strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.grid3 small, .theme-opt small { font-size: clamp(10px, min(12cqw, 15cqh), 14px); }
/* Ô cấu hình được chọn: bùng gradient neon (hướng C) */
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

/* (Số người: bốn thanh ngang, xem template bước 'count' và `.hinh-nguoi`) */
.options.grid3.counts > .option { gap: 2px; padding: 6px 4px; }
.options.grid3.counts .opt-icon { width: clamp(16px, 16cqw, 26px); height: auto; }
.options.grid3.counts strong { font-size: clamp(20px, min(30cqw, 34cqh), 40px); line-height: 1; }

/* Nền tảng của ô lựa chọn nay ở wizard.css (dùng chung cho cả component con,
   xem chú thích ở đó). Dưới đây chỉ còn phần RIÊNG của màn này. */
.option .icon { font-size: 30px; }
.option.big .icon { font-size: 42px; }
/* KHÔNG ghi đè cỡ chữ ở đây: cả wizard dùng chung `.option strong` trong
   wizard.css, ghi đè riêng cho ô .big là nguồn gốc chuyện bước 1 chữ nhỏ hơn
   các bước sau. */

/* Riêng màn này ô ngang có padding hẹp hơn (dáng ô đã cao sẵn) */
.option.wide { padding: 13px 16px; }
.option.wide .icon { font-size: 26px; }

/* Chỉ MỜ DẦN, không trượt ngang — chủ dự án 16.10.2026 chê kiểu "kéo ngang
   như chuyển trang" khó chịu khi đổi bước/chức năng. */
.step-enter-active { transition: opacity .18s ease; }
.step-enter-from { opacity: 0; }
.step-leave-active { transition: opacity .12s ease; }
.step-leave-to { opacity: 0; }

.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.moc-sao { margin: 12px 0 0; text-align: center; font-weight: 700; font-size: 14px; color: var(--fg); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
.moc-sao + .best { margin-top: 4px; }
.moc-sao .nhom { white-space: nowrap; }
.moc-sao .vang { color: var(--gold); }
.moc-sao .ngan { color: var(--muted); }
/* ── BẢNG TUỲ CHỌN BÀN CHƠI ───────────────────────────────────────────────
   Nút "Bắt đầu" nằm NGOÀI khung hàng và luôn ở đáy; các hàng ở `.opt-rows`, thiếu
   chỗ thì cuộn TRONG khung (như lưới theme) — nút chính không bao giờ bị đẩy ra.
   Bản cũ để nút chung khung `overflow: hidden` với hàng: trên iPhone SE (vùng web
   375×553) năm hàng 74px + nút cần 455px mà chỉ có 363px → nút "Bắt đầu" và hàng
   cuối LÒI khỏi màn, ở mọi trình duyệt (bắt bằng `pnpm do:safari`, 15.10.2026).
   Màn thấp thì thu gọn (khối `max-height: 620px` dưới) để SE vẫn vừa đủ 5 hàng
   KHÔNG cuộn; thêm hàng thứ sáu là phải đo lại bằng `pnpm do:safari`. */
.opt-list {
  display: flex; flex-direction: column; gap: 7px;
  min-height: 0;
}
.opt-rows {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 7px;
  scrollbar-width: none;
  /* chỗ cho bóng nút đang chọn ở hàng cuối — khung cuộn cắt mọi thứ tràn ra */
  padding-bottom: 10px; margin-bottom: -10px;
}
.opt-rows::-webkit-scrollbar { display: none; }
.opt-list > .btn-primary { flex: none; }
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
  background: var(--chon-nen);
  border-color: transparent; color: var(--chon-chu);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5), 0 4px 14px var(--card-back-glow);
}
@media (hover: hover) {
  .seg-btn:not([aria-pressed="true"]):hover { border-color: var(--line-strong); color: var(--fg); }
}


/* ---------- TRANG CHỦ (bước players) ---------- */
/* Panel thành trong suốt: trang chủ nằm thẳng trên nền của skin (trời, mặt gỗ…) */
section.panel.trang-chu { background: none; border: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; padding: 4px 4px 8px; }
.step-body.home { display: flex; flex-direction: column; gap: 14px; justify-content: center; }
.home .loi-tat { margin: 0; }
.ico3d { display: none; }

.o-chien-dich, .o-vuong {
  border: 2px solid transparent; border-radius: 20px; color: #fff; cursor: pointer;
  font: inherit; transition: transform .15s ease, box-shadow .15s ease;
}
.o-chien-dich { flex: none; display: flex; align-items: center; gap: 12px; min-height: clamp(84px, 11vh, 120px); padding: 0 18px; text-align: left; }
.o-chien-dich strong { flex: 1; font-family: var(--font-display); font-size: 28px; line-height: 1.1; }
.o-chien-dich .man {
  flex: none; padding: 6px 12px; border-radius: 14px; font-weight: 800; font-size: 14px;
  /* Cặp màu NHẤN của skin (nền + chữ đã chọn để luôn tương phản). Bản cũ nền trắng
     + chữ `--fg`: skin tối (Neon, Đêm Sao) có --fg sáng → chữ trắng trên nền trắng;
     Kẹo Bông ô trắng → viên trắng mất hình (chủ dự án báo, có ảnh). Kẹo giữ viên
     trắng như mockup đã duyệt (keo.css). */
  background: var(--nhan-nen); color: var(--nhan-chu); border: var(--quat-vien, 0);
}
.ba-o { flex: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; height: clamp(88px, 15vh, 150px); }
.o-vuong { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 6px 4px; min-width: 0; }
.o-vuong strong { font-family: var(--font-display); font-size: 15px; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
.o-chien-dich:active, .o-vuong:active { transform: translateY(3px); }
@media (hover: hover) { .o-chien-dich:hover, .o-vuong:hover { transform: translateY(-2px); } }
/* Bảng tuỳ chọn trên màn THẤP (iPhone SE) — ĐỨNG CUỐI file để thắng luật gốc cùng độ đặc hiệu */
@media (max-height: 620px) {
  .opt-list, .opt-rows { gap: 5px; }
  .opt-row { padding: 3px 9px 4px; }
  .opt-head { margin-bottom: 2px; }
  .opt-head .opt-ico { width: 20px; height: 20px; }
  .opt-name { font-size: var(--text-sm); }
  .seg-btn { height: 26px; min-height: 26px; }   /* vùng chạm vẫn 42px nhờ ::after */
}
/* …và chừa thêm chỗ cho cả wizard trên màn thấp (đệm panel 20 → 14, đầu bước 16 → 10) */
@media (max-height: 620px) {
  section.panel:not(.trang-chu) { padding: 14px; }
  .wizard-head { margin-bottom: 10px; }
}
</style>
