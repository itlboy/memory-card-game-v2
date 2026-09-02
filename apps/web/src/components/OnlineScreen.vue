<script setup lang="ts">
import {
  CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, OPTION_KEYS, OPTION_LABELS, ROOM_LIMITS, levelSpec, optionSummary
} from '@mm/engine';
import {
  Brain, Check, ChevronLeft, ChevronRight, Copy, Crown, Eye, Globe, Hash, Heart, LayoutGrid,
  Link2, Lock, Pencil, Plus, RefreshCw, Settings2, Timer, UserMinus, Users, X
} from 'lucide-vue-next';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { ghiUrl } from '@/lib/appUrl';
import ConfirmDialog from './ConfirmDialog.vue';
/*
 * Nạp KHI CẦN, không nằm trong gói chính: hộp này kéo theo thư viện vẽ QR
 * (~47KB chưa nén) mà cả ván chỉ mở đúng một lần lúc mời bạn — có người còn
 * không mở lần nào. Bắt mọi người tải nó ngay từ khung hình đầu là trả giá cho
 * thứ hầu hết không dùng tới.
 */
const ChiaSeDialog = defineAsyncComponent(() => import('./ChiaSeDialog.vue'));
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
watch(() => o.phase.value, (p, truoc) => {
  if (p === 'error' || p === 'idle') dangVaoLai.value = false;
  /*
   * Vừa bị đưa ra khỏi phòng (chủ phòng huỷ, hoặc mình bị mời ra): về đúng màn
   * DANH SÁCH PHÒNG, không để lại ở form nhập mã của phòng vừa mất. Dòng báo
   * lý do vẫn hiện ngay dưới, nên không ai phải đoán chuyện gì xảy ra.
   */
  if (p === 'idle' && (truoc === 'lobby' || truoc === 'playing' || truoc === 'ended')) {
    entryStep.value = 'choose';
    void o.taiPhongCongKhai();
  }
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

/**
 * Bấm "Tạo phòng mới": ĐÃ CÓ TÊN thì đi thẳng vào chọn bàn.
 *
 * Tên được nhớ từ lần trước (`store.playerNames`), nên bắt gõ lại mỗi lần là
 * một bước thừa hoàn toàn — người chơi nhìn thấy đúng cái tên mình vẫn dùng,
 * điền sẵn, rồi phải bấm "Tiếp tục" để xác nhận nó vẫn là nó. Đổi tên thì làm
 * ngay trong phòng chờ được (nút cạnh tên mình), nên không mất đường nào.
 */
/* ---------- ĐỔI TÊN NGAY TRONG PHÒNG CHỜ ----------
 * Tên được nhớ từ lần trước và bước nhập tên đã bỏ đi, nên đây là chỗ DUY NHẤT
 * sửa được — phải luôn có, cho mọi người, không riêng chủ phòng.
 */
/* Hai khối bung ra từ dải mỏng. Mở cái này thì đóng cái kia — hai khối cùng
   bung là dải trên cùng cao bằng khối cũ, mất sạch chỗ vừa tiết kiệm được. */
const moMoi = ref(false);
const moChonCK = ref(false);

const suaTen = ref(false);
const tenMoi = ref('');
const oTen = ref<HTMLInputElement | null>(null);

function moSuaTen(hienTai: string): void {
  tenMoi.value = hienTai;
  suaTen.value = true;
  sfx.select();
  // Chờ ô hiện ra rồi mới chọn hết chữ: mở ra là gõ đè được ngay
  void nextTick(() => { oTen.value?.select(); });
}

/** Bỏ dở việc đổi tên, giữ nguyên tên cũ. */
function huySuaTen(): void {
  suaTen.value = false;
  tenMoi.value = '';
}

function luuTen(): void {
  if (!suaTen.value) return;
  suaTen.value = false;
  const t = tenMoi.value.trim();
  if (!t || t === name.value) return;
  name.value = t;
  o.doiTen(t);
}

/**
 * Hỏi trước khi mời một người ra — không có đường hoàn tác, mà bấm nhầm thì
 * người kia bị văng ra thật.
 *
 * Người đang RỚT MẠNG nói khác: đó là lý do hay dùng tính năng này nhất (cả
 * phòng phải chờ hết hạn giữ chỗ mới đi tiếp được), nên nói thẳng ra là mời ra
 * thì đi tiếp được ngay.
 */
function hoiMoiRa(id: string, ten: string, dangKetNoi: boolean): void {
  sfx.select();
  confirm.value = {
    title: `Mời ${ten} ra khỏi phòng?`,
    body: dangKetNoi
      ? 'Họ bị đưa ra ngoài ngay và không tự vào lại được — vẫn vào lại được nếu bạn cho họ mã phòng.'
      : `${ten} đang rớt mạng. Mời ra thì phòng khỏi phải chờ họ nối lại.`,
    label: 'Mời ra',
    action: () => o.moiRa(id)
  };
}

function batDauTao(): void {
  if (name.value.trim()) { create(); return; }
  sfx.select();
  entryStep.value = 'create';
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

/**
 * Bấm nút xác nhận: chạy việc RỒI ĐÓNG HỘP.
 *
 * Trước đây chỉ gọi `action()` và không đóng gì. Các việc khác (rời phòng, huỷ
 * phòng) đều chuyển màn nên hộp biến mất theo — che mất chuyện nó chưa bao giờ
 * tự đóng. Đến "mời ra" thì lộ: việc đó xong vẫn ở nguyên màn phòng chờ, nên
 * hộp nằm lại giữa màn hình.
 */
function xacNhan(): void {
  const viec = confirm.value?.action;
  confirm.value = null;
  viec?.();
}

function exit(): void {
  o.leave();
  ghiUrl(location.pathname);
  emit('back');
}

/**
 * Hỏi rời phòng chờ, rồi đi tới `sau`.
 *
 * Tách ra vì có BA đường cùng rời phòng chờ và chúng phải hỏi GIỐNG NHAU, chỉ
 * khác đích đến: nút ‹ và nút Back của trình duyệt lùi về danh sách phòng, còn
 * nút logo thì về trang chủ. Trước đây mỗi đường tự viết một kiểu, nên nút ‹
 * lại nhảy thẳng về trang chủ — bỏ qua mất màn danh sách phòng mà người chơi
 * vừa đi qua để vào đây.
 */
function hoiRoiPhong(sau: () => void): void {
  if (o.isHost.value && (o.room.value?.players.length ?? 0) > 1) {
    confirm.value = {
      title: 'Huỷ phòng?',
      body: 'Phòng sẽ đóng và mọi người bị đưa ra ngoài.',
      label: 'Huỷ phòng',
      action: () => { o.cancelRoom(); sau(); }
    };
    return;
  }
  const motMinh = (o.room.value?.players.length ?? 0) <= 1;
  confirm.value = {
    title: 'Rời phòng?',
    body: motMinh
      ? 'Mã phòng còn sống thêm 10 phút — bạn hoặc bạn bè vẫn vào lại được bằng mã đó.'
      : 'Bạn rời khỏi phòng này; những người còn lại vẫn chơi tiếp được.',
    label: 'Rời phòng',
    action: () => { o.surrender(); sau(); }
  };
}

/** Về màn DANH SÁCH PHÒNG — lùi đúng một bậc, không văng ra trang chủ. */
function veDanhSachPhong(): void {
  o.leave();
  ghiUrl(location.pathname);
  entryStep.value = 'choose';
  o.error.value = '';
  void o.taiPhongCongKhai();
}

/** Nút ‹ ở phòng chờ: lùi về danh sách phòng, KHÔNG về trang chủ. Đường đi là
 *  trang chủ → danh sách phòng → phòng chờ, nên lùi một bậc là danh sách. */
function backLobby(): void { hoiRoiPhong(veDanhSachPhong); }

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
  // Ở phòng chờ CŨNG phải hỏi, kể cả khi đang một mình: vừa tạo phòng xong,
  // chưa ai vào, lỡ chạm là mất phòng cùng cái mã vừa gửi cho bạn bè. Đích ở
  // đây là TRANG CHỦ vì đó đúng là việc của nút logo.
  if (phase === 'lobby') { hoiRoiPhong(exit); return; }
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
/**
 * Đã bấm "Bắt đầu" và đang chờ server mở ván.
 *
 * Bấm xong mà nút đứng im như chưa bấm thì người ta bấm tiếp — nhất là khi
 * mạng chậm, đúng lúc phản hồi lâu nhất. Cần cả TIẾNG (biết là máy đã nhận) và
 * HÌNH (biết là đang chờ ai đó, không phải mình bấm hụt).
 *
 * Tự tắt khi `room.status` rời khỏi 'lobby' (server đã mở đếm ngược), hoặc sau
 * `HAN_MO_VAN` — treo cái spinner vĩnh viễn khi tin rơi mất còn tệ hơn không có.
 */
const dangMoVan = ref(false);
const HAN_MO_VAN = 6000;
let moVanTimer: ReturnType<typeof setTimeout> | undefined;

function batDauVan(): void {
  if (dangMoVan.value || !canStart.value) return;
  sfx.go();                                  // kêu NGAY, đừng đợi server
  dangMoVan.value = true;
  clearTimeout(moVanTimer);
  moVanTimer = setTimeout(() => { dangMoVan.value = false; }, HAN_MO_VAN);
  o.start();
}

watch(() => o.room.value?.status, (st) => {
  if (st && st !== 'lobby') { clearTimeout(moVanTimer); dangMoVan.value = false; }
});
onBeforeUnmount(() => clearTimeout(moVanTimer));

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
  /*
   * RỖNG NGHĨA LÀ TẤT CẢ, không phải "không có theme nào": server hiểu
   * `themeIds: []` là dùng mọi theme nó có (xem DEFAULT_ROOM_CONFIG trong
   * engine) — đó là cấu hình của phòng tạo nhanh, chưa qua wizard.
   *
   * Thiếu nhánh này thì hàm trả chuỗi RỖNG và dòng tóm tắt hiện ra
   * "16 thẻ · — chờ chủ phòng bắt đầu…", cụt lủn giữa hai dấu câu.
   */
  if (!ids.length) {
    return allThemes.value.length ? `tất cả ${allThemes.value.length} theme` : 'tất cả theme';
  }
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
/* Hộp chia sẻ đóng TRƯỚC mọi thứ: đang mở hộp mà bấm Back thì thứ người ta
   muốn đóng là cái hộp, không phải rời phòng. */
useBackCloser(35, () => moMoi.value, () => { moMoi.value = false; });
useBackCloser(35, () => moChonCK.value, () => { moChonCK.value = false; });

useBackCloser(25, () => o.phase.value === 'lobby', () => hoiRoiPhong(veDanhSachPhong));

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
      <button class="btn-primary tao-phong" type="button" @click="batDauTao()">
        <Plus :size="22" /> Tạo phòng mới
      </button>

      <div class="list-head">
        <h3>Phòng đang chờ</h3>
        <span v-if="o.phongCongKhai.value.length" class="count">{{ o.phongCongKhai.value.length }}</span>
        <!-- Nhịp tự làm mới: một vòng tròn NHỎ vơi dần, không số, không viền.
             Đây là thứ liếc qua chứ không phải thứ để bấm — cái đáng bấm ở màn
             này là "Tạo phòng mới" và các dòng phòng. Bấm vào vẫn làm mới ngay
             được, nhưng nó không xin ai chú ý. -->
        <button
          class="nhip" type="button"
          :aria-label="o.dangTaiPhong.value ? 'Đang làm mới danh sách' : `Tự làm mới sau ${demNguoc} giây — bấm để làm mới ngay`"
          :disabled="o.dangTaiPhong.value" @click="lamMoiNgay()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ quay: o.dangTaiPhong.value }">
            <circle class="ray" cx="12" cy="12" r="9" />
            <circle
              class="chay" cx="12" cy="12" r="9"
              :stroke-dasharray="56.55"
              :stroke-dashoffset="o.dangTaiPhong.value ? 42 : 56.55 * (1 - demNguoc / 10)"
            />
          </svg>
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
        <!-- `&nbsp;` chứ KHÔNG phải dấu cách thường: trình biên dịch template của
             Vue chạy `whitespace: 'condense'`, nó cắt khoảng trắng đầu/cuối trong
             con của một thẻ — nên " {{ code }}" viết trong <b> ra thành dính liền
             "phòngABC123". Khoảng trắng không ngắt là ký tự thật, không bị cắt. -->
        <p class="vl-t">Đang vào lại phòng<b v-if="codeInput">&nbsp;{{ codeInput }}</b>…</p>
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
    <!-- Mất kết nối mà phòng vẫn còn (token còn trong localStorage): cho bấm
         thử lại tại chỗ, đừng bắt người ta gõ lại mã phòng. -->
    <button v-if="o.phase.value === 'error' && o.coThuLai.value" class="btn primary" type="button" @click="o.retry()">
      Thử lại
    </button>
  </section>

  <!-- LOBBY -->
  <section v-else-if="o.phase.value === 'lobby'" class="panel">
    <div class="head">
      <button class="btn back" aria-label="Rời phòng" type="button" @click="backLobby"><ChevronLeft :size="22" /></button>
      <!-- Tên phòng LÀ tên chủ phòng — đúng cái người khác thấy trong danh sách
           công khai. Không có ô gõ tên phòng: một cái tên nữa để nghĩ ra là một
           bước nữa trước khi được chơi. -->
      <h2>{{ tenPhong }}</h2>
    </div>

    <!--
      DẢI MỎNG: mã phòng + hai chip. Cả hai thứ ở đây (mời bạn, đổi công khai)
      chỉ dùng MỘT LẦN lúc mở phòng rồi nằm không cả ván, nên chúng không được
      chiếm chỗ thường trực của danh sách người chơi — phòng chứa tới 10 người.
      Đo bản cũ: 107px + 72px = 179px, tức hơn ba dòng người chơi.
    -->
    <div class="dai-mong">
      <b class="ma-nho">{{ o.room.value?.code }}</b>
      <span class="grow"></span>
      <!-- Chip trạng thái: mở ra hai ô chọn chứ KHÔNG đổi ngay. Đổi ngay thì
           lại rơi vào chỗ mơ hồ của công tắc cũ — không biết chữ đang hiện là
           trạng thái hiện tại hay thứ sẽ thành sau khi bấm. -->
      <button
        class="pill ck" :class="{ priv: !o.room.value?.congKhai, doc: !o.isHost.value }"
        type="button" :disabled="!o.isHost.value" :aria-expanded="moChonCK"
        :aria-label="o.room.value?.congKhai ? 'Phòng công khai — chạm để đổi' : 'Phòng riêng tư — chạm để đổi'"
        @click="moChonCK = !moChonCK; moMoi = false"
      >
        <Globe v-if="o.room.value?.congKhai" :size="15" /><Lock v-else :size="15" />
        {{ o.room.value?.congKhai ? 'Công khai' : 'Riêng tư' }}
      </button>
      <button
        class="pill moi" type="button" :aria-haspopup="true"
        @click="moMoi = true; moChonCK = false"
      ><Link2 :size="15" /> Mời bạn</button>
    </div>

    <!--
      Công khai hay riêng tư — bung ra khi chạm chip. Chỉ CHỦ PHÒNG mở được,
      nhưng ai cũng ĐỌC được trạng thái ngay trên chip: người vào phòng cần biết
      phòng mình đang ngồi có hiện cho người lạ không.
    -->
    <div v-if="moChonCK" class="sophong">
      <div class="sp-seg" role="radiogroup" aria-label="Ai vào được phòng này">
        <button
          class="sp-opt" :class="{ sel: o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'true' : 'false'"
          @click="o.datCongKhai(true); moChonCK = false"
        >
          <Globe :size="19" />
          <span>Công khai</span>
        </button>
        <button
          class="sp-opt priv" :class="{ sel: !o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'false' : 'true'"
          @click="o.datCongKhai(false); moChonCK = false"
        >
          <Lock :size="19" />
          <span>Riêng tư</span>
        </button>
      </div>
    </div>

    <ul class="lobby-list">
      <li v-for="p in o.room.value?.players" :key="p.id" :data-chip-for="p.id" :class="{ off: !p.connected }">
        <span class="avatar">{{ p.avatar }}</span>
        <!-- Dòng CỦA MÌNH: tên sửa được tại chỗ. Ai cũng đổi được tên mình,
             không ai đổi được tên người khác. -->
        <template v-if="p.id === o.myId.value && suaTen">
          <input
            ref="oTen" v-model="tenMoi" class="sua-ten" maxlength="16"
            aria-label="Tên của bạn"
            @keydown.enter="luuTen()" @keydown.esc="huySuaTen()"
          >
          <!-- NÚT LƯU rõ ràng. Trước đây chỉ có Enter và blur — Enter thì trên
               điện thoại phải mở bàn phím rồi tìm nút xanh, còn blur thì không
               ai biết là bấm ra ngoài sẽ lưu. Không có gì trên màn hình nói
               rằng đã xong hay chưa. -->
          <button
            class="nut-luu" type="button" aria-label="Lưu tên"
            :disabled="!tenMoi.trim()" @click="luuTen()"
          ><Check :size="16" /></button>
          <button
            class="nut-huy" type="button" aria-label="Huỷ đổi tên" @click="huySuaTen()"
          ><X :size="16" /></button>
        </template>
        <template v-else>
          <b>{{ p.name }}</b>
          <button
            v-if="p.id === o.myId.value" class="nut-sua" type="button"
            aria-label="Đổi tên" title="Đổi tên"
            @click="moSuaTen(p.name)"
          ><Pencil :size="14" /></button>
        </template>
        <small v-if="p.id === o.room.value?.hostId">chủ phòng</small>
        <small v-if="p.id === o.myId.value && !suaTen">(bạn)</small>
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
        <!-- Mời ra: chỉ CHỦ PHÒNG thấy, và không bao giờ hiện ở dòng của chính
             mình — muốn đi thì có nút rời phòng, đi đường đó mới chuyển quyền
             chủ phòng cho người khác. Nhạt và nhỏ: đây là việc hiếm làm, không
             được tranh chỗ với thứ người ta nhìn hàng ngày. -->
        <button
          v-if="o.isHost.value && p.id !== o.myId.value" class="nut-moi-ra" type="button"
          :aria-label="`Mời ${p.name} ra khỏi phòng`" :title="`Mời ${p.name} ra khỏi phòng`"
          @click="hoiMoiRa(p.id, p.name, p.connected)"
        ><UserMinus :size="15" /></button>
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
        :class="{ dangMo: dangMoVan }"
        :disabled="!canStart || dangMoVan"
        @click="batDauVan()"
      ><span v-if="dangMoVan" class="quay" aria-hidden="true" />{{ dangMoVan ? 'Đang mở ván…' : startLabel }}</button>
    </template>
    <template v-else>
      <!-- Bàn chơi ĐỌC TRƯỚC KHI BẤM: đây là thứ người ta cần biết để quyết
           định có sẵn sàng hay không, nên nó phải nằm TRÊN nút. Ở dưới thì đọc
           xong mới thấy, mà lúc đó đã bấm rồi. -->
      <div v-if="optionChips(o.room.value?.config).length" class="cfg-chips">
        <span v-for="c in optionChips(o.room.value?.config)" :key="c.key" class="cfg-chip">
          <OptionIcon :name="c.icon" :size="17" />{{ c.text }}
        </span>
      </div>
      <p class="hint">
        {{ cardCount }} thẻ · {{ themeSummary(o.room.value?.config.themeIds ?? []) }}
        — chờ chủ phòng bắt đầu…
      </p>
      <button
        class="btn-primary" :class="{ 'is-ready': meReady }" type="button"
        @click="o.setReady(!meReady)"
      >
        {{ meReady ? '✅ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng!' }}
      </button>
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

  <!-- Hộp chia sẻ: mã QR + mã 6 số + hai nút copy. Có nút đóng, bấm nền hay
       Esc cũng đóng, và nút Back của trình duyệt đóng nó trước tiên. -->
  <ChiaSeDialog
    v-if="moMoi && o.room.value"
    :code="o.room.value.code" :link="inviteLink" :invite-text="inviteText"
    @close="moMoi = false"
  />

  <ConfirmDialog
    v-if="confirm"
    :title="confirm.title" :body="confirm.body" :confirm-label="confirm.label"
    @confirm="xacNhan()"
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

/*
 * Nhịp tự làm mới — CHỈ LÀ MỘT BIỂU TƯỢNG, không phải nút.
 *
 * Bản trước là một nút có viền, có nền, có con số đếm ngược to bằng chữ thường:
 * nó hút mắt ngang với "Tạo phòng mới" trong khi chẳng có việc gì đáng làm ở
 * đó. Nay bỏ hết trang trí, còn một vòng tròn mảnh vơi dần — biết là danh sách
 * đang tự cập nhật là đủ, không cần biết còn mấy giây.
 */
.nhip {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; min-width: 0; min-height: 0; padding: 0;
  border: 0; background: none; color: var(--muted); opacity: .75;
}
/* Vùng chạm vẫn 44px dù hình chỉ 20px (NF-07) — nới bằng ::after, không phình
   cái biểu tượng lên. */
.nhip::after { content: ''; position: absolute; inset: -12px; }
.nhip svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.nhip .ray { fill: none; stroke: currentColor; stroke-width: 1.6; opacity: .3; }
.nhip .chay {
  fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round;
  /* Vơi từng giây một nhịp; không transition để khỏi lệch với nhịp đếm. */
  transition: none;
}
.nhip svg.quay { animation: quay 1s linear infinite; }
.nhip:disabled { cursor: default; }

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
/* Khối chọn công khai chỉ hiện khi chạm chip — nằm ngay dưới dải mỏng. */
.sophong { margin: 0 0 8px; }
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
.sophong.ro .sp-opt:not(.sel) { opacity: .42; }
.sp-seg .sp-opt:disabled { cursor: default; }

.head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.head h2 { flex: 1; margin: 0; font-size: 19px; }
.back { font-size: 22px; line-height: 1; padding: 4px 12px; }
.code {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-display); font-weight: 700; letter-spacing: .12em;
  color: var(--accent);
}
.crown { color: var(--gold); }
.edit { display: inline-flex; align-items: center; gap: 5px; }
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

/* ---------- DẢI MỎNG: mã phòng + hai chip ----------
 * Mời bạn và đổi công khai đều là việc làm MỘT LẦN lúc mở phòng rồi thôi, nên
 * chúng không được chiếm chỗ thường trực của danh sách người chơi — phòng chứa
 * tới 10 người, mỗi dòng 54px. Bản cũ tốn 179px cho hai khối này, tức hơn ba
 * dòng người chơi. Nay 40px, phần còn lại chỉ hiện khi chạm.
 */
.dai-mong {
  display: flex; align-items: center; gap: 10px;
  min-height: 40px; margin: 0 0 8px; padding: 0 12px;
  border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel-soft);
}
.ma-nho {
  font-family: var(--font-display); font-weight: 800; font-size: 17px;
  letter-spacing: .09em; color: var(--accent); font-variant-numeric: tabular-nums;
}
.dai-mong .grow { flex: 1; }
.pill {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; min-height: 0; min-width: 0; padding: 0 10px;
  border: 0; border-radius: var(--r-full);
  font-size: var(--text-xs); font-weight: 700;
}
/* Vùng chạm 44px mà chip vẫn 26px (NF-07) — nới bằng ::after, đừng phình chip
   lên, phình là cả dải cao lại như cũ. */
.pill::after { content: ''; position: absolute; inset: -9px; }
.pill.ck { color: #fff; background: linear-gradient(150deg, #109edb, #1aa793); }
.pill.ck.priv { background: linear-gradient(150deg, #6f5bd6, #8f4fd0); }
/* Khách: chip vẫn ĐỌC được trạng thái, chỉ không bấm được */
.pill.ck.doc { opacity: .85; }
.pill.ck:disabled { cursor: default; }
.pill.moi { color: var(--accent); background: var(--accent-soft); }

/* Bung ra khi chạm "Mời bạn" */
.bung { display: flex; gap: 8px; margin: 0 0 8px; }
.bung-btn { flex: 1; gap: 6px; font-size: var(--text-sm); font-weight: 700; }
.bung-btn.primary {
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

/* Đổi tên tại chỗ: nút bút chì nhỏ cạnh tên mình, và ô nhập thay đúng chỗ cái
   tên — không mở hộp thoại, không đẩy dòng nào nhảy chỗ. */
.nut-sua {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; min-width: 0; min-height: 0; padding: 0; margin-left: -2px;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
}
/* Vùng chạm 44px mà KHÔNG phình cái nút — phình là hàng người chơi cao thêm và
   danh sách ngắn đi một dòng (xem luật ở CLAUDE.md). */
.nut-sua::after { content: ''; position: absolute; inset: -9px; }
@media (hover: hover) {
  .nut-sua:hover { background: var(--accent-soft); color: var(--accent); }
}
/* Hai nút Lưu / Huỷ: hình 28px nhưng vùng chạm 44px (NF-07), nới bằng ::after
   chứ không phình nút — phình là dòng người chơi cao thêm và danh sách ngắn đi. */
.nut-luu, .nut-huy {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; min-width: 0; min-height: 0; padding: 0;
  border: 0; border-radius: 9px;
}
.nut-luu::after, .nut-huy::after { content: ''; position: absolute; inset: -8px; }
.nut-luu { background: var(--accent); color: #fff; }
.nut-luu:disabled { opacity: .45; cursor: default; }
.nut-huy { background: var(--panel-soft); color: var(--muted); }

.sua-ten {
  flex: 1; min-width: 0; max-width: 140px;
  padding: 4px 8px; border: 2px solid var(--accent); border-radius: 9px;
  background: var(--panel-solid); color: var(--fg);
  font-family: var(--font-display); font-size: var(--text-md); font-weight: 700;
}

/* Mời ra: mờ và nhỏ, chỉ đậm lên khi rê vào — việc hiếm làm thì đừng tranh chỗ
   với thứ người ta nhìn hàng ngày. Vùng chạm vẫn 44px qua ::after. */
.nut-moi-ra {
  position: relative; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; min-width: 0; min-height: 0; padding: 0;
  border: 0; border-radius: 8px; background: transparent;
  color: var(--muted); opacity: .5;
}
.nut-moi-ra::after { content: ''; position: absolute; inset: -9px; }
@media (hover: hover) {
  .nut-moi-ra:hover { opacity: 1; color: var(--bad); background: color-mix(in srgb, var(--bad) 12%, transparent); }
}

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
.ready-tag {
  display: inline-flex; align-items: center; gap: 4px; margin-left: auto;
  font-size: var(--text-xs); color: var(--muted); white-space: nowrap;
}
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


/* Vòng quay của nút "Bắt đầu" — bấm xong phải thấy máy ĐANG LÀM GÌ ĐÓ, không
   thì người ta tưởng bấm hụt và bấm tiếp, đúng lúc mạng chậm nhất. */
.btn-primary .quay {
  display: inline-block;
  width: 16px; height: 16px;
  margin-right: 8px;
  vertical-align: -2px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: quay-tron 0.7s linear infinite;
}
.btn-primary.dangMo { opacity: 0.85; }
@keyframes quay-tron { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .btn-primary .quay { animation-duration: 2.4s; }
}
</style>
