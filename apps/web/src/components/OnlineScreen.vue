<script setup lang="ts">
import {
  CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, OPTION_KEYS, OPTION_LABELS, ROOM_LIMITS, levelSpec, optionSummary
} from '@mm/engine';
import {
  Brain, Check, ChevronLeft, ChevronRight, Copy, Crown, Eye, Globe, Hash, Heart, LayoutGrid,
  Link2, Lock, Plus, RefreshCw, Settings2, Timer, Users
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiUrl } from '@/lib/appUrl';
import ConfirmDialog from './ConfirmDialog.vue';
import SizeGrid from './SizeGrid.vue';
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
/*
 * Lời mời đã HẾT DÙNG ĐƯỢC: bật khi cú nối theo link mời báo lỗi (phòng đã chết,
 * mã sai). Từ lúc đó màn này thôi coi mình là "được mời" và hiện lại ô nhập mã —
 * nhánh được mời cố tình ẩn ô đó, nên không có cờ này thì người chơi bị kẹt ở một
 * màn báo lỗi không có đường nào đi tiếp.
 */
const loiMoiHong = ref(false);
watch(() => o.error.value, (e) => {
  if (!e || !props.joinCode) return;
  loiMoiHong.value = true;
  // Lau ?room= khỏi URL: giữ lại thì F5 lại lao vào đúng cái phòng chết đó.
  if (location.search.includes('room=')) ghiUrl(location.pathname);
});

/** Vào bằng link mời VÀ lời mời còn dùng được. */
const invited = computed(() => !!props.joinCode && !loiMoiHong.value);

/*
 * ĐANG VÀO LẠI PHÒNG CŨ (F5 giữa phòng), khác hẳn với ĐƯỢC MỜI.
 *
 * Đọc sessionStorage NGAY ở nhịp dựng đầu tiên, trước khung hình đầu tiên —
 * `onMounted` là quá muộn: tới đó màn "🎉 Bạn được mời vào phòng" đã vẽ xong và
 * loé lên một cái trước khi nhảy vào phòng. Người đang ngồi trong phòng mà bị
 * mời vào chính phòng đó thì đọc chẳng ra gì.
 *
 * Tự tắt khi phòng đã về (o.room có) hoặc khi vào lại hỏng (phase 'error' /
 * 'idle') — lúc đó mới rơi về màn nhập tên bình thường.
 */
const dangVaoLai = ref(o.coPhienLuu(props.joinCode));
watch(() => o.phase.value, (p) => {
  if (p === 'error' || p === 'idle') dangVaoLai.value = false;
});
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

/**
 * Bấm một phòng trong danh sách: vào thẳng, không hỏi mã.
 *
 * Vẫn cần TÊN — nếu chưa có tên đã nhớ thì rẽ sang form nhập (mã điền sẵn) chứ
 * không nhảy vào phòng với một cái tên rỗng.
 */
/** Phòng đang bấm vào — để chính DÒNG ĐÓ báo là đang vào. */
const dangVaoPhong = ref('');
watch(() => o.phase.value, (p) => {
  // Vào xong (lobby/playing) hay hỏng (error/idle) thì thôi quay
  if (p !== 'connecting') dangVaoPhong.value = '';
});

function vaoPhongCongKhai(code: string): void {
  if (dangVaoPhong.value) return;          // đang vào rồi, đừng bấm chồng
  sfx.select();                            // bấm là kêu NGAY, đừng đợi server
  codeInput.value = code;
  if (!name.value.trim()) { entryStep.value = 'join'; return; }
  dangVaoPhong.value = code;
  remember();
  o.join(code, name.value.trim());
}

onMounted(() => {
  // Vào bằng link mời / F5 khi đang trong phòng: ưu tiên resume đúng phòng đó
  if (invited.value) {
    if (o.resumeStored(props.joinCode)) return;   // F5: vào lại bằng token, giữ danh tính
    if (name.value.trim()) join();                // link mời + đã nhớ tên: vào luôn
    return;
  }
  if (!o.resumeStored()) void o.taiPhongCongKhai();
});

/*
 * Quay lại bước chọn (thoát khỏi form, hoặc vừa rời một phòng) thì làm mới danh
 * sách: phòng vừa nãy có thể đã đầy hoặc đã vào ván.
 */
watch(entryStep, (b) => { if (b === 'choose') { void o.taiPhongCongKhai(); datLaiDem(); } });

// Đang trong phòng thì URL luôn mang ?room=CODE để F5 quay lại đúng chỗ
watch(() => o.room.value?.code, (code) => {
  if (code) ghiUrl(`${location.pathname}?room=${code}`);
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
  sfx.select();   // bấm là kêu NGAY, đừng đợi server — vòng đi-về có thể tới vài giây
  remember();
  o.join(codeInput.value, name.value.trim());
}
/** Nội dung popup xác nhận; null = không hiện. */
const confirm = ref<{ title: string; body: string; label: string; action: () => void } | null>(null);

function exit(): void {
  o.leave();
  ghiUrl(location.pathname);
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

/**
 * Tên phòng = TÊN CHỦ PHÒNG, trần trụi. Thêm "Phòng của" vào chỉ tốn chỗ mà
 * không nói thêm gì — đang đứng trong phòng thì ai cũng biết đó là phòng.
 * Chủ phòng có thể đổi giữa chừng (người
 * cũ rời đi), nên đọc từ danh sách người chơi mỗi lần chứ không nhớ lại.
 */
const tenPhong = computed(() => {
  const r = o.room.value;
  const chu = r?.players.find((p) => p.id === r.hostId) ?? r?.players[0];
  return chu ? chu.name : 'Phòng chờ';
});

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

/**
 * Lời mời đem đi dán: CÂU MỜI + mã phòng + link, đúng như bảng chia sẻ của hệ
 * điều hành từng gửi đi. Dán một phát vào Zalo/Messenger là bạn bè hiểu ngay,
 * chứ một cái link trần thì người nhận không biết là gì.
 */
const inviteText = computed(() =>
  `Vào chơi Lật Thẻ với mình — mã phòng ${o.room.value?.code ?? ''}\n${inviteLink.value}`);

/** Copy lời mời. KHÔNG dùng `navigator.share` nữa: bảng chia sẻ của hệ điều
 *  hành đòi thêm 2–3 chạm mới tới được app muốn gửi, mà thứ người chơi cần chỉ
 *  là nội dung nằm sẵn trong clipboard để dán vào chỗ họ đang chat. */
async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteText.value);
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

/* ---------- TỰ LÀM MỚI DANH SÁCH PHÒNG ----------
 *
 * Danh sách phòng cũ đứng im cho tới khi người chơi tự bấm nút xoay: bạn tạo
 * phòng ở máy bên cạnh mà người kia ngồi nhìn màn hình trống, không biết là
 * phải bấm gì.
 *
 * Mỗi nhịp là một lần đánh thức Durable Object sổ phòng cho MỌI người đang mở
 * màn này, nên hai chốt phải giữ:
 *   - CHỈ chạy ở bước 'choose'. Đang điền form hay đang trong phòng thì danh
 *     sách không ai nhìn, đếm tiếp là trả tiền cho cái không ai đọc.
 *   - DỪNG HẲN khi tab xuống nền. Không có chốt này thì mỗi tab bị bỏ quên là
 *     một cái máy gõ cửa DO mãi mãi — mà trên điện thoại tab nền là chuyện
 *     thường xuyên nhất.
 * Quay lại tab thì làm mới NGAY: đó đúng là lúc người ta muốn thấy danh sách
 * mới nhất, và cũng bù cho quãng vừa nằm im.
 */
const CHU_KY_S = 10;
const demNguoc = ref(CHU_KY_S);
let nhip: ReturnType<typeof setInterval> | undefined;

function datLaiDem(): void { demNguoc.value = CHU_KY_S; }

/** Bấm tay: làm mới ngay và đếm lại từ đầu — không thì vừa bấm xong một giây
 *  sau nó tự làm mới lần nữa. */
function lamMoiNgay(): void {
  datLaiDem();
  void o.taiPhongCongKhai();
}

function chay(): void {
  if (nhip) return;
  datLaiDem();
  nhip = setInterval(() => {
    if (demNguoc.value > 1) { demNguoc.value -= 1; return; }
    datLaiDem();
    void o.taiPhongCongKhai();
  }, 1000);
}

function dung(): void {
  clearInterval(nhip);
  nhip = undefined;
}

/** Chỉ đếm khi danh sách đang thật sự hiện ra trước mắt ai đó. */
const dangXemDanhSach = computed(() =>
  entryStep.value === 'choose' && !wizard.value
  && (o.phase.value === 'idle' || o.phase.value === 'error'));

function theoDoiHienThi(): void {
  if (document.visibilityState === 'visible' && dangXemDanhSach.value) {
    void o.taiPhongCongKhai();   // vừa quay lại: đưa ngay bản mới nhất
    chay();
  } else {
    dung();
  }
}

watch(dangXemDanhSach, (co) => { if (co) chay(); else dung(); }, { immediate: true });
onMounted(() => { document.addEventListener('visibilitychange', theoDoiHienThi); });
onUnmounted(() => { dung(); document.removeEventListener('visibilitychange', theoDoiHienThi); });
const cfg = ref<RoomConfig>({ ...DEFAULT_ROOM_CONFIG, themeIds: [] });
const editingInLobby = computed(() => o.phase.value === 'lobby');
const WIZ_STEPS = ['level', 'theme', 'options'] as const;
const WIZ_TITLES = { level: 'Chọn số thẻ', theme: 'Chọn theme thẻ', options: 'Bàn chơi' } as const;

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

/*
 * NÚT BACK CỦA TRÌNH DUYỆT trong màn online. Độ sâu gộp hai thứ xếp chồng nhau:
 * bước của màn vào (chọn việc → điền form) và bước của wizard chọn bàn. Vào
 * bằng link mời thì màn vào chỉ có đúng một bước, nên không tính thêm.
 *
 * Không tính phòng chờ: rời phòng là việc phải HỎI (đầu hàng / huỷ phòng), và
 * App đã gắn một lớp cho cả màn online lo việc đó.
 */
useBackCloser(15, () => !!wizard.value || (entryStep.value !== 'choose' && !invited.value), () => {
  if (wizard.value) { wizBack(); return; }
  entryStep.value = 'choose';
  o.error.value = '';
});

/**
 * ĐANG Ở PHÒNG CHỜ: Back lùi về màn online, KHÔNG văng ra trang chủ.
 *
 * Ưu tiên 25 để thắng lớp 20 của App (`screen !== 'menu'` → `goHome`). Lớp đó
 * gọi `quit()`, mà `quit()` ở phòng chờ thì `exit()` → `emit('back')` → App về
 * menu. Tức một cú Back nhảy luôn HAI bậc: mất phòng VÀ mất luôn màn online,
 * trong khi thứ người chơi muốn lùi chỉ là bậc trên cùng.
 *
 * Vẫn rời phòng thật (không có chuyện đứng ngoài mà còn giữ chỗ), nhưng ở lại
 * màn online để vào phòng khác ngay. Chủ phòng còn người khác trong phòng thì
 * vẫn HỎI trước — huỷ phòng là đá cả nhóm ra, không phải việc lùi một bậc.
 */
useBackCloser(25, () => o.phase.value === 'lobby', () => {
  const veEntry = (): void => {
    o.leave();
    ghiUrl(location.pathname);
    entryStep.value = 'choose';
    o.error.value = '';
  };
  if (o.isHost.value && (o.room.value?.players.length ?? 0) > 1) {
    confirm.value = {
      title: 'Huỷ phòng?',
      body: 'Phòng sẽ đóng và mọi người bị đưa ra ngoài.',
      label: 'Huỷ phòng',
      action: () => { o.cancelRoom(); veEntry(); }
    };
    return;
  }
  o.surrender();
  veEntry();
});

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
      <!-- Phòng online chọn SỐ THẺ, không đi theo thang cấp: thang cấp chỉ có
           nghĩa khi chơi một mình (mỗi máy mở tới một cấp khác nhau, khoá lại
           thành ra tranh cãi chọn bàn nào), mà độ khó thì đã nằm ở bước tuỳ
           chọn ngay sau đây. -->
      <SizeGrid :level="cfg.level" :symbol-count="allSymbols" @play="wizPickLevel" />
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
        Chưa đủ biểu tượng cho bàn {{ levelSpec(cfg.level).pairs * 2 }} thẻ. Hãy chọn thêm theme.
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

    <!--
      BƯỚC 1: nút tạo phòng + DANH SÁCH PHÒNG ĐANG CHỜ.

      Trước đây đây là hai ô "Tạo phòng mới" / "Vào phòng có sẵn", tức là ai
      muốn chơi cũng phải có sẵn một cái mã ai đó gửi cho. Giờ mở màn này ra là
      thấy ngay phòng nào đang chờ người, bấm một cái là vào — nhập mã tụt xuống
      thành một dòng ở dưới, dành cho phòng riêng tư.
    -->
    <template v-if="entryStep === 'choose'">
      <button class="btn-primary tao-phong" type="button" @click="entryStep = 'create'">
        <Plus :size="22" /> Tạo phòng mới
      </button>

      <div class="list-head">
        <h3>Phòng đang chờ</h3>
        <span v-if="o.phongCongKhai.value.length" class="count">{{ o.phongCongKhai.value.length }}</span>
        <!-- Đếm ngược tới lần tự làm mới sau. Con số nằm TRONG nút, thay chỗ
             cái mũi tên xoay: người chơi vẫn bấm được bất cứ lúc nào, mà không
             phải đoán bao giờ danh sách tự mới. Lúc đang tải thì mũi tên quay
             trở lại — đó mới là thứ cần nói tại thời điểm đó. -->
        <button
          class="icon-btn dem" type="button"
          :aria-label="o.dangTaiPhong.value ? 'Đang làm mới danh sách' : `Làm mới danh sách — tự làm mới sau ${demNguoc} giây`"
          :disabled="o.dangTaiPhong.value" @click="lamMoiNgay()"
        >
          <RefreshCw v-if="o.dangTaiPhong.value" :size="18" class="quay" />
          <template v-else>
            <svg class="vong" viewBox="0 0 32 32" aria-hidden="true">
              <circle class="ray" cx="16" cy="16" r="14" />
              <circle
                class="chay" cx="16" cy="16" r="14"
                :stroke-dasharray="87.96"
                :stroke-dashoffset="87.96 * (1 - demNguoc / 10)"
              />
            </svg>
            <span class="so">{{ demNguoc }}</span>
          </template>
        </button>
      </div>

      <!-- Đang tải LẦN ĐẦU: khung xám thay vì chữ "đang tải" — người chơi thấy
           ngay danh sách sắp có mấy dòng, và không bị nhấp nháy khi nó hiện ra. -->
      <ul v-if="o.dangTaiPhong.value" class="rooms" aria-busy="true">
        <li v-for="i in 4" :key="i" class="room sk">
          <span class="av-sk"></span>
          <span class="body"><span class="bar w1"></span><span class="bar w2"></span></span>
        </li>
      </ul>

      <ul v-else-if="o.phongCongKhai.value.length" class="rooms">
        <li v-for="r in o.phongCongKhai.value" :key="r.code">
          <!-- Dòng ĐANG VÀO tự báo lấy: mũi tên thành vòng quay, chữ đổi theo.
               Báo ở chính chỗ ngón tay vừa chạm thì không phải đi tìm xem
               chuyện gì đang xảy ra. Các dòng khác mờ đi để khỏi bấm nhầm. -->
          <button
            class="room" type="button"
            :class="{ vao: dangVaoPhong === r.code, mo: dangVaoPhong && dangVaoPhong !== r.code }"
            :disabled="!!dangVaoPhong"
            @click="vaoPhongCongKhai(r.code)"
          >
            <span class="av">{{ r.avatar }}</span>
            <span class="body">
              <span class="rname">{{ r.chuPhong }}</span>
              <span class="meta">
                <template v-if="dangVaoPhong === r.code">Đang vào phòng…</template>
                <template v-else>
                  <i><LayoutGrid :size="14" /> {{ r.the }} thẻ</i>
                  <i><Users :size="14" /> {{ r.nguoi }}/{{ r.toiDa }}</i>
                </template>
              </span>
            </span>
            <span v-if="dangVaoPhong !== r.code" class="slots" :class="{ tight: r.toiDa - r.nguoi <= 1 }">
              <b>{{ r.toiDa - r.nguoi }}</b><small>CHỖ</small>
            </span>
            <RefreshCw v-if="dangVaoPhong === r.code" :size="18" class="go quay" />
            <ChevronRight v-else :size="18" class="go" />
          </button>
        </li>
      </ul>

      <!-- Trống vì LỖI ≠ trống vì không có phòng nào: nói khác nhau, vì cách xử
           lý của người chơi cũng khác (bấm thử lại / tự tạo phòng). -->
      <div v-else class="empty">
        <span class="art"><Globe :size="36" :stroke-width="1.9" /></span>
        <template v-if="o.loiTaiPhong.value">
          <h4>Không xem được danh sách</h4>
          <p>Mạng đang trục trặc. Bạn vẫn tạo phòng mới hoặc vào bằng mã được.</p>
          <button class="btn" type="button" @click="o.taiPhongCongKhai()">Thử lại</button>
        </template>
        <template v-else>
          <h4>Chưa có phòng nào đang chờ</h4>
          <p>Bạn tạo phòng đầu tiên đi — phòng của bạn sẽ hiện ở đây cho người khác vào chơi.</p>
        </template>
      </div>

      <button class="link-row" type="button" @click="entryStep = 'join'">
        <Hash :size="18" /> Có mã phòng? Nhập mã 6 số
      </button>
    </template>

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
      <!-- F5 giữa phòng: nói đúng việc đang xảy ra, đừng mời người ta vào chính
           cái phòng họ đang ngồi. -->
      <div v-if="dangVaoLai" class="vao-lai" role="status">
        <RefreshCw :size="26" class="quay" />
        <p class="vl-t">Đang vào lại phòng<b v-if="codeInput"> {{ codeInput }}</b>…</p>
        <p class="vl-s">Giữ nguyên tên và chỗ ngồi của bạn.</p>
      </div>
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
    </template>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
    <!-- Mất kết nối mà phòng vẫn còn (token còn trong sessionStorage): cho bấm
         thử lại tại chỗ, đừng bắt người ta gõ lại mã phòng. -->
    <button v-if="o.phase.value === 'error' && o.coThuLai.value" class="btn primary" type="button" @click="o.retry()">
      Thử lại
    </button>
  </section>

  <!-- LOBBY -->
  <section v-else-if="o.phase.value === 'lobby'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Rời phòng" type="button" @click="quit"><ChevronLeft :size="22" /></button>
      <!-- Tên phòng LÀ tên chủ phòng — đúng cái người khác thấy trong danh sách
           công khai. Không có ô gõ tên phòng: một cái tên nữa để nghĩ ra là một
           bước nữa trước khi được chơi. -->
      <h2>{{ tenPhong }}</h2>
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
        <button class="btn invite-btn primary" type="button" :title="inviteText" @click="copyLink">
          <Check v-if="copied" :size="17" /><Link2 v-else :size="17" />
          {{ copied ? 'Đã copy link' : 'Copy link' }}
        </button>
      </div>
    </div>

    <!--
      Công khai hay riêng tư. Chỉ CHỦ PHÒNG bấm được, nhưng ai cũng ĐỌC được:
      người vào phòng cần biết phòng mình đang ngồi có hiện cho người lạ không.
    -->
    <div class="sophong" :class="{ ro: !o.isHost.value }">
      <div class="sp-seg" role="radiogroup" aria-label="Ai vào được phòng này">
        <button
          class="sp-opt" :class="{ sel: o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'true' : 'false'"
          :disabled="!o.isHost.value"
          @click="o.datCongKhai(true)"
        >
          <Globe :size="19" />
          <span>Công khai</span>
        </button>
        <button
          class="sp-opt priv" :class="{ sel: !o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'false' : 'true'"
          :disabled="!o.isHost.value"
          @click="o.datCongKhai(false)"
        >
          <Lock :size="19" />
          <span>Riêng tư</span>
        </button>
      </div>
      <p class="sp-hint" :class="{ priv: !o.room.value?.congKhai }">
        <span class="dot" aria-hidden="true"></span>
        <span>{{
          o.room.value?.congKhai
            ? 'Đang hiện trong danh sách phòng — ai cũng vào được.'
            : 'Không hiện trong danh sách — chỉ ai có mã 6 số mới vào được.'
        }}</span>
      </p>
      <p v-if="!o.isHost.value" class="sp-rotag"><Lock :size="13" /> Chỉ chủ phòng đổi được</p>
    </div>

    <ul class="lobby-list">
      <li v-for="p in o.room.value?.players" :key="p.id" :data-chip-for="p.id" :class="{ off: !p.connected }">
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
      <!-- Trần phòng đọc từ ROOM_LIMITS, đừng ghi cứng: đã từng ghi 4 ở đây và
           lệch với server khi đổi trần. -->
      <li v-if="(o.room.value?.players.length ?? 0) < ROOM_LIMITS.maxPlayers" class="empty">
        Còn {{ ROOM_LIMITS.maxPlayers - (o.room.value?.players.length ?? 0) }} chỗ trống
      </li>
    </ul>

    <template v-if="o.isHost.value">
      <!-- Tóm tắt bàn chơi + nút chỉnh (mở lại wizard) — không còn hàng cuộn ngang che mất theme -->
      <div class="cfg-summary">
        <span>
          <b>{{ cardCount }} thẻ</b>
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
        {{ cardCount }} thẻ · {{ themeSummary(o.room.value?.config.themeIds ?? []) }}
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
/* ---------- DANH SÁCH PHÒNG CÔNG KHAI (ON-10) ---------- */

/* `.btn-primary` toàn cục KHÔNG phải flex — chữ nằm theo dòng bình thường.
   Nút này là nút primary duy nhất có icon, mà SVG inline thì canh theo baseline
   của chữ nên dấu + tụt xuống lệch hẳn. Cho riêng nút này thành flex. */
.tao-phong {
  margin-top: 0;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.list-head { display: flex; align-items: center; gap: 8px; margin: 18px 0 10px; }
.list-head h3 { flex: 1; margin: 0; font-family: var(--font-display); font-size: var(--text-md); }
.list-head .count {
  font-size: var(--text-xs); font-weight: 800; color: var(--accent);
  background: var(--accent-soft); padding: 3px 9px; border-radius: var(--r-full);
}
/* Nút làm mới nhỏ mà vùng chạm vẫn 44px: nới bằng ::after, đừng phình nút —
   phình là hàng tiêu đề cao thêm và danh sách ngắn đi một dòng. Ghi đè cả
   min-width/min-height vì `.btn` toàn cục đặt 44px. */
.icon-btn {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; min-width: 0; min-height: 0; padding: 0;
  border: 1px solid var(--line); border-radius: 12px;
  background: var(--panel-solid); color: var(--muted); box-shadow: var(--elev-1);
}
.icon-btn::after { content: ''; position: absolute; inset: -4px; }
.icon-btn:disabled { opacity: .5; }
.quay { animation: quay 1s linear infinite; }
@keyframes quay { to { transform: rotate(360deg); } }

/* F5 giữa phòng: một khung chờ yên tĩnh thay cho lời mời loé lên. Canh giữa
   chỗ trống còn lại nên nó không nhảy chỗ khi phòng về. */
.vao-lai {
  display: flex; flex: 1; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: var(--muted); text-align: center;
}
.vao-lai .vl-t { margin: 0; font-family: var(--font-display); font-size: var(--text-md); color: var(--fg); }
.vao-lai .vl-s { margin: 0; font-size: var(--text-xs); }

/* Vòng đếm ngược tới lần tự làm mới sau: viền chạy vơi dần quanh con số, nằm
   TRONG cái nút 36px sẵn có nên hàng tiêu đề không cao thêm chút nào. */
.icon-btn.dem .vong {
  position: absolute; inset: 0; width: 100%; height: 100%;
  transform: rotate(-90deg);   /* bắt đầu vơi từ 12 giờ */
}
.icon-btn.dem .ray {
  fill: none; stroke: var(--line); stroke-width: 2.5;
}
.icon-btn.dem .chay {
  fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round;
  /* Vơi từng giây MỘT NHỊP, khớp đúng con số bên trong. Không transition mượt:
     nhìn vòng chạy trơn mà số nhảy từng bậc thì hai thứ đá nhau. */
  transition: none;
}
.icon-btn.dem .so {
  position: relative;   /* nổi trên vòng */
  font-family: var(--font-display); font-size: var(--text-sm); font-weight: 700;
  font-variant-numeric: tabular-nums;   /* số không nhảy ngang khi 10 → 9 */
  color: var(--muted);
}

/* Danh sách KHÔNG cuộn cả trang (luật KHÔNG SCROLL): nó chiếm chỗ còn lại và tự
   cuộn BÊN TRONG khi có nhiều phòng. */
.rooms {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  list-style: none; margin: 0; padding: 0;
}
.rooms > li { flex-shrink: 0; }
.room {
  width: 100%; display: flex; align-items: center; gap: 11px;
  min-height: 64px; padding: 9px 11px; text-align: left;
  border: 2px solid var(--line); border-radius: var(--r-md); background: var(--panel-soft);
  color: var(--fg); font: inherit;
}
.room .av {
  display: flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; font-size: 22px;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
}
.room .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.room .rname {
  font-family: var(--font-display); font-size: var(--text-md); font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.room .meta {
  display: flex; align-items: center; gap: 10px;
  color: var(--muted); font-size: var(--text-xs); font-weight: 600;
}
.room .meta i { display: inline-flex; align-items: center; gap: 3px; font-style: normal; }

/* ĐANG VÀO PHÒNG NÀY: viền tím + chữ đổi màu, ngay tại dòng vừa chạm. Không
   transition — trạng thái đổi tức thì như mọi ô chọn khác. */
.room.vao {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.room.vao .meta { color: var(--accent); font-weight: 700; }
/* Các dòng còn lại lùi ra sau, để không ai bấm chồng lên nhau */
.room.mo { opacity: .45; }
.room:disabled { cursor: default; }
/* Số CHỖ TRỐNG, không phải số người: người chơi quét danh sách để tìm chỗ vào,
   nên con số to nhất phải trả lời đúng câu hỏi đó. Sắp đầy thì đổi sang vàng. */
.room .slots {
  display: flex; flex-direction: column; align-items: center; gap: 1px; flex-shrink: 0;
  padding: 4px 9px; border-radius: 12px;
  background: color-mix(in srgb, var(--ok) 14%, transparent); color: var(--ok);
}
.room .slots b { font-family: var(--font-display); font-size: var(--text-md); font-weight: 800; line-height: 1; }
.room .slots small { font-size: 9.5px; font-weight: 700; letter-spacing: .02em; }
.room .slots.tight { background: color-mix(in srgb, var(--gold) 18%, transparent); color: var(--gold); }
.room .go { color: var(--muted); flex-shrink: 0; }
@media (hover: hover) {
  .room:hover { border-color: var(--accent); background: var(--accent-soft); }
}

/* Khung xám lúc tải: đúng dáng một dòng phòng, để danh sách hiện ra không nhảy */
.room.sk { pointer-events: none; }
.room.sk .av-sk, .room.sk .bar {
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--line-strong) 55%, transparent),
    color-mix(in srgb, var(--line-strong) 100%, transparent),
    color-mix(in srgb, var(--line-strong) 55%, transparent));
  background-size: 200% 100%; animation: lap 1.3s linear infinite;
}
.room.sk .av-sk { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; }
.room.sk .bar { height: 12px; border-radius: var(--r-full); }
.room.sk .bar.w1 { width: 58%; }
.room.sk .bar.w2 { width: 42%; height: 10px; margin-top: 7px; }
@keyframes lap { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 24px 18px; text-align: center;
  border: 2px dashed var(--line-strong); border-radius: var(--r-md); background: var(--panel-soft);
}
.empty .art {
  display: flex; align-items: center; justify-content: center;
  width: 74px; height: 74px; border-radius: 22px; color: #fff;
  background: linear-gradient(150deg, #6a5cff, #8b5cf6);
  box-shadow: 0 10px 26px var(--card-back-glow), inset 0 1px 0 rgba(255, 255, 255, .32);
}
.empty h4 { margin: 0; font-family: var(--font-display); font-size: var(--text-lg); }
.empty p { margin: 0; max-width: 250px; color: var(--muted); font-size: var(--text-sm); line-height: 1.45; }

.link-row {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  width: 100%; min-height: 44px; margin-top: 14px; padding-top: 13px;
  border: 0; border-top: 1px solid var(--line); background: none;
  color: var(--accent); font: inherit; font-size: var(--text-sm); font-weight: 700;
}

/* ---------- CÔNG KHAI / RIÊNG TƯ ---------- */

/*
 * HAI Ô CẠNH NHAU, không phải công tắc. Bản cũ là một switch có nhãn TỰ ĐỔI
 * theo trạng thái ("Phòng công khai" ↔ "Phòng riêng tư") — đọc dòng chữ đó
 * không biết được nó đang tả trạng thái HIỆN TẠI hay thứ sẽ thành sau khi bấm.
 * Bày cả hai lựa chọn ra thì không còn gì phải suy: ô sáng là chỗ mình đang
 * đứng, ô kia là chỗ bấm sang.
 */
.sophong { margin: 10px 0 0; }
.sp-seg {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;
  padding: 5px; border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-soft);
}
.sp-seg .sp-opt {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-height: 52px; padding: 7px 8px;
  border: 2px solid transparent; border-radius: var(--r-sm);
  background: transparent; color: var(--muted);
  font-family: var(--font-display); font-size: var(--text-sm); font-weight: 700;
}
/* Ô ĐANG CHỌN bùng gradient — cyan cho công khai, tím cho riêng tư. Hai màu
   khác nhau để liếc một cái là biết đang ở nhánh nào, không phải đọc chữ. */
.sp-seg .sp-opt.sel {
  color: #fff; background: linear-gradient(150deg, #109edb, #1aa793);
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
}
.sp-seg .sp-opt.priv.sel { background: linear-gradient(150deg, #6f5bd6, #8f4fd0); }
.sp-hint {
  display: flex; align-items: flex-start; gap: 7px; margin: 9px 0 0;
  font-size: var(--text-xs); line-height: 1.45; color: var(--muted);
}
.sp-hint .dot {
  flex-shrink: 0; width: 7px; height: 7px; margin-top: 5px;
  border-radius: var(--r-full); background: #109edb;
}
.sp-hint.priv .dot { background: #8f4fd0; }
/* Khách (không phải chủ phòng): chỉ ĐỌC. Ô đang chọn giữ nguyên màu — họ vẫn
   cần biết phòng mình đang ở là công khai hay riêng tư; chỉ ô KHÔNG chọn mờ đi
   để thấy nó không bấm được. */
.sophong.ro .sp-opt:not(.sel) { opacity: .42; }
.sp-seg .sp-opt:disabled { cursor: default; }
.sp-rotag {
  display: inline-flex; align-items: center; gap: 5px; margin: 9px 0 0;
  padding: 3px 9px; border-radius: var(--r-full); background: var(--accent-soft);
  font-size: var(--text-xs); font-weight: 700; color: var(--accent);
}

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
/* Ô cấu hình được chọn: gradient neon — quy tắc chung ở wizard.css */
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
.options.wiz-themes { grid-template-columns: repeat(3, 1fr); }   /* 15 theme = 3×5 */
.options.wiz-grids .option { padding: 6px 4px; gap: 2px; }
.options.wiz-grids strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.wiz-grids small, .theme-opt small { font-size: clamp(11.5px, 12cqw, 14px); }
/* Đủ specificity để thắng `.option { padding: 24px 16px }` viết bên dưới */
.options.wiz-themes .option.theme-opt { padding: 8px 5px; gap: 4px; position: relative; }
/* NGƯỠNG ĐO TRÊN CONTENT BOX, KHÔNG PHẢI CHIỀU CAO Ô — `.option` có
   `container-type: size` nên truy vấn nhận chiều cao PHẦN NỘI DUNG (ô trừ
   padding 8+8 và viền 2+2).

   Phải KHỚP với ngưỡng bên `MenuScreen.vue`: hai màn cùng vẽ một lưới theme,
   để lệch là một màn mất emoji còn màn kia không, và không test nào đỏ. Đúng
   lỗi đã xảy ra: MenuScreen sửa xuống 45px còn chỗ này vẫn 74px, nên phòng
   online mất emoji trên iPhone.

   Đo thật bằng CDP ở 430 rộng, dpr3, mobile (display của .theme-sample ·
   contentBox của .theme-opt), với ngưỡng cũ 74px:
     932 ô 116.8 content 96.8 hiện · 800 ô 90.4 content 70.4 ẨN · 740 ô 78.4
     content 58.4 ẩn · 720 ô 74.4 content 54.4 ẩn · 667 ô 63.8 content 43.8 ẩn
   Safari trên iPhone 15 Pro Max còn ~740px cao → ô 78px, thừa chỗ mà vẫn ẩn. */
@container (max-height: 45px) {
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
/* Nền tảng của ô lựa chọn nay ở wizard.css. Màn này ô cao hơn nên chỉ nới
   padding, phần còn lại dùng chung. */
.option { padding: 24px 16px; }
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
