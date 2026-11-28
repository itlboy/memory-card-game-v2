<script setup lang="ts">
import { dichGoiYTuyChon } from '@/lib/goi-y-tuy-chon';
import { SITE_URL } from '@/lib/native';
import { laCong } from '@/lib/nen-fb';
import MatNguoi from './MatNguoi.vue';
import DauPremium from './DauPremium.vue';
import {
  BOARD_SIZES, CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, OPTION_KEYS, OPTION_LABELS, ROOM_LIMITS, levelSpec, optionSummary
} from '@mm/engine';
import { Bell, BellRing, Brain, Check, ChevronLeft, ChevronRight, Copy, Crown, Eye, Flame, Globe, Hand, Hash, Heart, LayoutGrid, Link2, Lock, Pencil, Plus, RefreshCw, Settings2, Swords, Timer, Users, WifiOff, X } from 'lucide-vue-next';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { batChuong, coChuong, dangBat, tatChuong } from '@/lib/thong-bao';
import { ghiUrl } from '@/lib/appUrl';
import { CACH_MOI_LAI_MS, coSanh, soNguoiOnline, dsOnline, ghiDaThach, moiNguoi, thachCho, type NguoiOnline } from '@/lib/sanh';
import { gioVang } from '@/lib/gio-vang';
import MoiOnline from './MoiOnline.vue';
import { t, td, ngonNgu } from '@/lib/i18n';
import { tenTheme } from '@/lib/achievements';
/** Bí danh của `t` cho chỗ đã đặt tên biến cục bộ là `t`. */
const tr = t;

/**
 * Gợi ý số thật của tuỳ chọn do ENGINE sinh bằng tiếng Việt — cùng mẫu với
 * `dichGoiYTuyChon` ở MenuScreen (chưa tách ra lib chung).
 */
// dichGoiYTuyChon: lib/goi-y-tuy-chon.ts (dùng chung với MenuScreen)
import ConfirmDialog from './ConfirmDialog.vue';
import BaoPhongDong from './BaoPhongDong.vue';
import ChonMucMay from './ChonMucMay.vue';
import ChonDoi from './ChonDoi.vue';
import { tenNguoi } from '@/lib/ten';
import { pingSo } from '@/lib/ping-so';
/*
 * Nạp KHI CẦN, không nằm trong gói chính: hộp này kéo theo thư viện vẽ QR
 * (~47KB chưa nén) mà cả ván chỉ mở đúng một lần lúc mời bạn — có người còn
 * không mở lần nào. Bắt mọi người tải nó ngay từ khung hình đầu là trả giá cho
 * thứ hầu hết không dùng tới.
 */
const ChiaSeDialog = defineAsyncComponent(() => import('./ChiaSeDialog.vue'));
import SizeGrid from './SizeGrid.vue';
import BanChon from './BanChon.vue';
import OnlineGame from './OnlineGame.vue';
import DaiBao from './DaiBao.vue';
import NhacSanSang from './NhacSanSang.vue';
import BongNgo from './BongNgo.vue';
import ChonSoThe from './ChonSoThe.vue';
import ChonTimThe from './ChonTimThe.vue';
import OnlineTimThe from './OnlineTimThe.vue';
import { dangDebug } from '@/lib/debug';
import { TIM_THE_MO, TIM_THE_SO_THE, docChon, luuChon } from '@/lib/tim-the';
import { useBaoPhong } from '@/composables/useBaoPhong';
import { baoNoi, boBao } from '@/lib/dai-bao';
import { NHAC_CACH_MS, TIM_THE_ONLINE_SO_THE } from '@mm/engine';
import EmojiDock from './EmojiDock.vue';
import EmojiBlast from './EmojiBlast.vue';
import LoiNoi from './LoiNoi.vue';
import type { DoiId, OptLevel, OptionKey, RoomConfig } from '@mm/engine';
import OptionIcon from './OptionIcon.vue';
import type { IconName } from './OptionIcon.vue';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { moChucNang, suKien, thamSoVanDau } from '@/lib/phan-tich';
import { store } from '@/lib/storage';
import { sfx } from '@/lib/audio';
import { anhEmoji } from '@/lib/emoji';
/** Quả địa cầu Noto 3D ở ô trống danh sách phòng (phong cách 3D nổi khối, 18.10.2026). */
const anhDiaCau = anhEmoji('🌍', true, 128);
import { loadThemes, type CardTheme } from '@/lib/themes';
import { choiDuoc } from '@/lib/premium';
import ThemePicker from './ThemePicker.vue';

const props = defineProps<{ joinCode?: string }>();
const emit = defineEmits<{ back: [] }>();

const o = useOnlineRoom();
// Dải báo chung (vào/rời/sẵn sàng/nhắc/chơi lại/mất kết nối/đang xem) — một chỗ, một kiểu
useBaoPhong(o);
const name = ref(store.playerNames()[0] ?? '');
/** Tên gợi ý trong ô nhập. Đặt tên vui thì bạn bè trong phòng dễ nhớ nhau hơn
 *  là "Người 1", "Người 2" — nên gợi ý bằng biệt danh thay vì một tên khô. */
const SO_BIET_DANH = 12;   // khoá on.bietDanh.0 … on.bietDanh.11
const bietDanhChon = Math.floor(Math.random() * SO_BIET_DANH);
const namePlaceholder = computed(() => t('on.viDu', { ten: td(`on.bietDanh.${bietDanhChon}`) }));
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
  // Chỉ khi cú vào phòng HỎNG — lời từ chối lúc đã ở trong phòng (bấm Bắt đầu
  // khi chưa đủ người…) không có nghĩa là lời mời hết dùng được.
  if (!e || !props.joinCode || (o.phase.value !== 'idle' && o.phase.value !== 'error')) return;
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
/* PHÂN TÍCH (13.11.2026): ván online bắt đầu / kết thúc, cùng tên sự kiện với ván offline
 * (`che_do: online`) để so được trong một bảng. Khán giả không tính. */
watch(() => o.phase.value, (p, truoc) => {
  if (o.spectator.value) return;
  const soNguoi = o.room.value?.players?.length;
  // Tìm Thẻ online: `che_do` riêng; `van_ket_thuc` do OnlineTimThe gửi (có điểm, kết quả, số thẻ, độ khó)
  const tim = o.room.value?.config.kieu === 'tim';
  if (p === 'playing' && truoc !== 'playing') suKien('van_bat_dau', { ...thamSoVanDau(), che_do: tim ? 'tim_the_online' : 'online', so_nguoi: soNguoi, ...(tim ? { so_the: o.room.value?.config.timSoThe, tuy_chon: o.room.value?.config.timDoKho } : {}) });
  if (p === 'ended' && truoc === 'playing' && !tim) suKien('van_ket_thuc', { che_do: 'online', so_nguoi: soNguoi });
});

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
  moChucNang('online_vao_phong_ds');
  remember();
  o.join(code, name.value.trim());
}

onMounted(() => {
  if (gioVang.value.dang) moChucNang('gio_vang_vao', {}, true);   // giờ vàng: vào sảnh trong 20:00–21:00 giờ máy
  // Bấm "Thách" ở bảng xếp hạng: tạo phòng ngay (chưa có tên thì qua form tạo phòng, tạo xong vẫn mời)
  if (thachCho.value && !invited.value) {
    if (name.value.trim()) create(); else entryStep.value = 'create';
    return;
  }
  // Vào bằng link mời / F5 khi đang trong phòng: ưu tiên resume đúng phòng đó
  if (invited.value) {
    if (o.resumeStored(props.joinCode)) return;   // F5: vào lại bằng token, giữ danh tính
    if (name.value.trim()) join();                // link mời + đã nhớ tên: vào luôn
    return;
  }
  // Báo bù lời rời phòng chưa tới server TRƯỚC khi tải danh sách — không thì phòng ma của chính
  // mình còn nằm đó (lỗi chủ dự án báo 18.10.2026)
  if (!o.resumeStored()) void o.guiRoiCho().then(() => o.taiPhongCongKhai());
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
/*
 * TẠO PHÒNG LÀ CÓ PHÒNG NGAY (17.11.2026, mockup duyệt https://claude.ai/artifact/VXsNaR3xGo9fgPBqQAAoy1):
 * trước đây đi Số thẻ → Bộ thẻ → Bàn chơi rồi mới có mã — bạn bè chờ suốt ba màn mà hầu hết để
 * mặc định. Nay dùng bàn của phòng mình làm chủ lần trước (Prefs.banOnline), lần đầu là Dễ 12 thẻ
 * + mọi bộ chơi được; đổi bàn thì làm trong phòng chờ (dòng "Bàn … Đổi", một màn BanChon).
 */
const LEVEL_DE = BOARD_SIZES.find((s) => s.pairs === 6)!.level;
function banMacDinh(): RoomConfig {
  const cu = store.prefs().banOnline;
  const choiDuocIds = allThemes.value.filter(choiDuoc).map((x) => x.id);
  if (cu) {
    // Bộ premium đã hết hạn / theme đã bỏ thì lọc đi; lọc hết thì [] = server trộn mọi bộ miễn phí
    const ids = choiDuocIds.length ? cu.themeIds.filter((id) => choiDuocIds.includes(id)) : cu.themeIds;
    return { level: cu.level, themeIds: ids, options: { ...cu.options } };
  }
  return { ...DEFAULT_ROOM_CONFIG, level: LEVEL_DE, themeIds: choiDuocIds, options: { ...DEFAULT_ROOM_CONFIG.options } };
}
function create(): void {
  if (!name.value.trim() || creatingRoom.value) return;
  sfx.select();
  moChucNang('online_tao_phong');
  cfg.value = banMacDinh();
  remember();
  creatingRoom.value = true;
  void o.createRoom(name.value.trim(), { ...cfg.value });
}
// Bàn của phòng mình làm chủ = bàn cho lần "Tạo phòng" sau
watch(() => (o.isHost.value ? o.room.value?.config : undefined), (c) => {
  if (c) store.savePrefs({ banOnline: { level: c.level, themeIds: [...c.themeIds], options: { ...c.options } } });
}, { deep: true });

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
watch(moMoi, (v) => { if (v) moChucNang('online_moi_ban'); });   // hộp mời bạn (QR + mã)
const moChonCK = ref(false);

const suaTen = ref(false);
const tenMoi = ref('');
// Ô nằm trong `v-for` nên `ref="oTen"` của Vue 3 là MẢNG, không phải phần tử — từng gây
// "oTen.value?.select is not a function" (GA `loi_js`, 18–19.11.2026). Dùng function ref.
let oTen: HTMLInputElement | null = null;
const ganOTen = (el: unknown): void => { oTen = el instanceof HTMLInputElement ? el : null; };

function moSuaTen(hienTai: string): void {
  tenMoi.value = hienTai;
  suaTen.value = true;
  sfx.select();
  // Chờ ô hiện ra rồi mới chọn hết chữ: mở ra là gõ đè được ngay
  void nextTick(() => { oTen?.select(); });
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
/** Số ô chỗ trống cần vẽ ở cuối danh sách. */
/** Danh sách công khai tách hai nhóm (19.11.2026): phòng ĐANG CHỜ (vào chơi) và ĐANG CHƠI (vào xem). */
const phongCho = computed(() => o.phongCongKhai.value.filter((r) => !r.dangChoi));
const phongXem = computed(() => o.phongCongKhai.value.filter((r) => r.dangChoi));
const conCho = computed(() => Math.max(0, ROOM_LIMITS.maxPlayers - (o.room.value?.players.length ?? 0)));

/*
 * MỜI NGƯỜI ĐANG ONLINE (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 3A/B;
 * lib/sanh.ts). Chỉ CHỦ PHÒNG, phòng đang CHỜ và CÒN CHỖ. Danh sách hỏi mỗi `HOI_DS_MS` (bảng mở: `HOI_DS_MO_MS`)
 * để số trên nút còn đúng; `dsMoi === null` = server không có sảnh (bản Cloudflare) → giấu nút.
 */
const HOI_DS_MS = 15_000;
const HOI_DS_MO_MS = 5_000;
// Biết server có sảnh thì nút hiện NGAY (danh sách rỗng, số người điền sau lượt hỏi đầu) — không chờ mạng
const dsMoi = ref<NguoiOnline[] | null>(coSanh.value ? [] : null);
const moMoiOnline = ref(false);
const coTheMoi = computed(() => o.isHost.value && o.room.value?.status === 'lobby' && conCho.value > 0 && !!o.room.value?.code);
const soMoiDuoc = computed(() => (dsMoi.value ?? []).filter((n) => !n.tuChoi).length);
let henDs: ReturnType<typeof setTimeout> | undefined;
async function taiDsMoi(): Promise<void> {
  clearTimeout(henDs);
  if (!coTheMoi.value) { moMoiOnline.value = false; return; }
  if (document.visibilityState === 'visible') dsMoi.value = await dsOnline(o.room.value!.code, o.layToken());
  if (coTheMoi.value) henDs = setTimeout(() => { void taiDsMoi(); }, moMoiOnline.value ? HOI_DS_MO_MS : HOI_DS_MS);
}
watch(coTheMoi, (co) => { if (co) void taiDsMoi(); else { clearTimeout(henDs); moMoiOnline.value = false; } }, { immediate: true });
watch(moMoiOnline, (mo) => { if (mo) void taiDsMoi(); });
onUnmounted(() => clearTimeout(henDs));

/*
 * THÁCH ĐẤU TỪ BẢNG XẾP HẠNG (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1b):
 * App.vue đặt `thachCho` rồi mở màn này → tạo phòng (bàn lần trước) và mời đúng người đó. Phòng GIỮ CÔNG KHAI như
 * phòng thường (chủ dự án 22.11.2026: "cứ để phòng công khai, không cần riêng tư"). Ghế trống ghi "Đang mời X…" +
 * vạch 20 giây.
 */
const LOI_THACH: Record<string, string> = { day: 'moi.loi.day', vuaMoi: 'moi.loi.vuaMoi', banMoi: 'moi.loi.banMoi', nhieuQua: 'moi.loi.nhieuQua', tuChoi: 'moi.tuChoi', banPhong: 'moi.loi.banPhong' };
const dangThach = ref<{ ten: string; han: number } | null>(null);
let henThach: ReturnType<typeof setTimeout> | undefined;
watch(() => (o.isHost.value && o.room.value?.status === 'lobby' ? o.room.value.code : ''), async (ma) => {
  const n = thachCho.value;
  if (!ma || !n) return;
  thachCho.value = null;
  const kq = await moiNguoi(ma, o.layToken(), n.sid, true);
  if ('ok' in kq) {
    ghiDaThach(n.ten, Date.now() + (kq.cach ?? CACH_MOI_LAI_MS));
    dangThach.value = { ten: n.ten, han: kq.han };
    clearTimeout(henThach);
    henThach = setTimeout(() => { dangThach.value = null; }, kq.han);
  } else {
    baoNoi({ loai: 'roi', ic: 'loiMoi', chu: `${n.ten} · ${t((LOI_THACH[kq.loi] ?? 'moi.loi.chung') as 'moi.loi.chung')}` });
  }
}, { immediate: true });
// Có người vào (thường là đúng người được thách) → thôi "Đang mời"
watch(() => o.room.value?.players.length ?? 0, (n, truoc) => { if (n > truoc) dangThach.value = null; });
onUnmounted(() => { clearTimeout(henThach); thachCho.value = null; });
/**
 * ĐỘI THEO SỐ (15.11.2026): ai cũng có một ô "Đội N", mặc định mỗi người một số (= ván thường);
 * chọn CÙNG SỐ là cùng đội. Không còn nút Thường / Đồng đội.
 */
const doiDangChon = ref<string | null>(null);
/** Số đội khác nhau trong phòng — dưới 2 thì chưa có đối thủ, chưa mở ván được. */
const soDoi = computed(() => new Set((o.room.value?.players ?? []).map((p) => p.doiSo ?? p.id)).size);
/** Đội có từ 2 người trở lên → tô vạch màu cho thấy ai chung đội với ai. */
const doiGhep = (d: DoiId | undefined): boolean =>
  !!d && (o.room.value?.players.filter((p) => p.doiSo === d).length ?? 0) > 1;

/** Máy đang mở bảng chọn mức (mã người chơi), null = đóng. */
const mayDangChon = ref<string | null>(null);

function hoiMoiRa(id: string, ten: string, dangKetNoi: boolean): void {
  sfx.select();
  confirm.value = {
    title: t('on.moiRa.tieuDe', { ten }),
    body: dangKetNoi ? t('on.moiRa.conNoi') : t('on.moiRa.rotMang', { ten }),
    label: t('on.moiRa.nut'),
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
  moChucNang(invited.value ? 'online_vao_link_moi' : 'online_vao_ma');
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

/** Nút "Cập nhật" ngay tại lỗi "bạn cần cập nhật app" — y như nút trong menu (lib/ota). */
async function capNhatNgay(): Promise<void> {
  const { kiemTraThuCong } = await import('@/lib/ota');
  const kq = await kiemTraThuCong();
  if (kq === 'matMang') o.error.value = t('chung.chuaCapNhat');
}

function exit(): void {
  o.thoatPhong();   // còn phiên ở phòng sống → báo rời (hoặc ghi để báo bù), không xoá phiên trơn
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
  /*
   * CHỦ PHÒNG CHỦ ĐỘNG THOÁT = ĐÓNG PHÒNG (chủ dự án 15.10.2026), kể cả khi đang
   * một mình. Bản cũ để phòng một mình sống thêm 10 phút — nhưng người bấm thoát
   * đã nói rõ là thôi, còn phòng thì nằm lại trong danh sách công khai như một
   * phòng chết. Thoát APP (về màn hình chính, khoá máy) là chuyện khác: không
   * qua đây, phòng được giữ EMPTY_LOBBY_MS ở server.
   */
  const motMinh = (o.room.value?.players.length ?? 0) <= 1;
  if (o.isHost.value && motMinh) {
    confirm.value = {
      title: t('on.roiPhong.tieuDe'),
      body: t('on.roiPhong.motMinh'),
      label: t('on.roiPhong.nut'),
      action: () => { o.cancelRoom(); sau(); }
    };
    return;
  }
  if (o.isHost.value) {
    confirm.value = {
      title: t('on.huyPhong.tieuDe'),
      body: t('on.huyPhong.than'),
      label: t('on.huyPhong.nut'),
      action: () => { o.cancelRoom(); sau(); }
    };
    return;
  }
  confirm.value = {
    title: t('on.roiPhong.tieuDe'),
    body: t('on.roiPhong.conNguoi'),
    label: t('on.roiPhong.nut'),
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

/**
 * THOÁT KHỎI VÁN → VỀ MÀN ONLINE (chỗ tạo/vào phòng), không văng ra trang chủ (16.11.2026, chủ
 * dự án). Rời phòng THẬT qua `thoatPhong` (báo server, như `exit`), chỉ khác đích đến.
 */
function veManOnline(): void {
  o.thoatPhong();
  ghiUrl(location.pathname);
  entryStep.value = 'choose';
  o.error.value = '';
  void o.taiPhongCongKhai();
}
/** Nút ✕ / "Thoát phòng" trong ván và màn kết quả: hỏi như `quit` nhưng đích là màn online. */
function quitVeOnline(): void { quit(veManOnline); }

/** Thoát có xác nhận — dùng cho nút ✕ trong ván và khi bấm logo. `sau`: đích sau khi rời
 *  (mặc định trang chủ — việc của nút logo). */
function quit(sau: () => void = exit): void {
  const phase = o.phase.value;
  if (phase === 'playing' && !o.spectator.value) {
    confirm.value = {
      title: t('on.dauHang.tieuDe'),
      body: t('on.dauHang.than'),
      label: t('on.dauHang.nut'),
      action: () => { o.surrender(); sau(); }
    };
    return;
  }
  // Ở phòng chờ CŨNG phải hỏi, kể cả khi đang một mình: vừa tạo phòng xong,
  // chưa ai vào, lỡ chạm là mất phòng cùng cái mã vừa gửi cho bạn bè. Đích ở
  // đây là TRANG CHỦ vì đó đúng là việc của nút logo.
  if (phase === 'lobby') { hoiRoiPhong(sau); return; }
  /*
   * HẾT VÁN → "Thoát phòng" CŨNG HỎI (07.11.2026, chủ dự án duyệt mockup): một chạm
   * nhầm là mất phòng lẫn tỷ số cả loạt. "Về phòng chờ" thì không hỏi — vẫn ở trong phòng.
   */
  if (phase === 'ended' && !o.spectator.value) {
    const khac = (o.room.value?.players ?? []).filter((p) => p.id !== o.myId.value);
    confirm.value = {
      title: t('on.thoat.tieuDe'),
      body: khac.length === 1 ? t('on.thoat.than1', { ten: tenNguoi(khac[0]!) }) : t('on.thoat.than'),
      label: t('on.thoat.nut'),
      action: sau
    };
    return;
  }
  sau();
}

/*
 * THÔNG BÁO ĐỔI BÀN (07.11.2026): chủ phòng chỉnh bàn (ở phòng chờ hay sau ván) thì
 * người khác thấy MỘT DÒNG NHỎ nổi trên đầu màn, tự ẩn — chủ dự án chê ô thông báo
 * chèn vào bảng kết quả "trông xấu quá". Chỉ ghi giá trị MỚI của những gì đổi.
 */

/*
 * CHUÔNG "BÁO TÔI KHI CÓ PHÒNG MỚI" (18.11.2026, lib/thong-bao.ts). Một nút bật/tắt cạnh tiêu đề
 * danh sách — bấm lần nữa là TẮT (chủ dự án: "nhớ có nút tắt thông báo"), và dòng báo lúc bật
 * nói rõ điều đó. Kết quả hiện bằng cùng dòng nổi với thông báo đổi bàn.
 */
const tbDangLam = ref(false);
/** Kết quả bấm chuông → DẢI BÁO CHUNG (19.11.2026; trước là dòng nổi riêng). */
function baoTb(chu: string, loai: 'tot' | 'roi' | 'can' = 'tot'): void {
  baoNoi({ loai, ic: 'nhac', chu });
}
async function bamChuong(): Promise<void> {
  if (tbDangLam.value) return;
  tbDangLam.value = true;
  try {
    if (dangBat.value) { await tatChuong(); baoTb(t('on.tb.daTat'), 'roi'); return; }
    const kq = await batChuong();
    baoTb(t(kq === 'bat' ? 'on.tb.daBat' : kq === 'chan' ? 'on.tb.biChan' : 'on.tb.loi'), kq === 'bat' ? 'tot' : 'can');
  } finally { tbDangLam.value = false; }
}
function khacBiet(a: RoomConfig, b: RoomConfig, boSoThe = false): string[] {
  const ra: string[] = [];
  if (a.level !== b.level && !boSoThe) ra.push(t('on.soThe', { n: levelSpec(b.level).pairs * 2 }));
  if ([...a.themeIds].sort().join() !== [...b.themeIds].sort().join()) ra.push(themeSummary(b.themeIds));
  for (const k of OPTION_KEYS) {
    if (a.options[k] === b.options[k]) continue;
    ra.push(dichGoiYTuyChon(optionSummary(k, b.options[k], b.level)) ?? `${t(`opt.${k}`)}: ${t('menu.tat')}`);
  }
  return ra;
}
/*
 * Số thẻ đổi NGAY SAU LƯỢT CHỌN SỐ THẺ (`room.chon` vừa đóng — server đặt `config.level` trong cùng gói tin,
 * xem `vaoVanSauChot`) là kết quả cả phòng bỏ phiếu, KHÔNG phải chủ phòng đổi bàn: không báo (chủ dự án 25.11.2026).
 */
watch(() => [o.room.value?.code, o.room.value?.config, !!o.room.value?.chon] as const, ([code, c], [codeCu, cu, dangChonCu]) => {
  if (!c || !cu || code !== codeCu || o.isHost.value) return;
  const ds = khacBiet(cu, c, dangChonCu);
  if (!ds.length) return;
  const ten = o.room.value?.players.find((p) => p.id === o.room.value?.hostId)?.name ?? '';
  // Chủ phòng đổi bàn → DẢI BÁO CHUNG (vàng: "để ý", vì nó đổi thứ mình vừa đồng ý chơi)
  baoNoi({ loai: 'can', ic: 'doiBan', chu: t('on.doiBan', { ten, ds: ds.join(' · ') }), khoa: 'doiBan' });
});

/** Đang dở việc (wizard tạo phòng / trong phòng / trong ván) — App hỏi confirm trước khi rời trang. */
function isBusy(): boolean {
  if (wizard.value !== null) return true;
  return (o.phase.value === 'lobby' || o.phase.value === 'playing') && !o.spectator.value;
}

/** Đang trong ván online (App tắt nhạc nền khi vào ván). */
const dangChoi = computed(() => o.phase.value === 'playing');
/** Đang ở trong một phòng online (chờ / chơi / xem / đang nối) — lib/sanh.ts: lúc này KHÔNG nhận lời mời. */
const trongPhong = computed(() => o.phase.value !== 'idle' && o.phase.value !== 'error');
/**
 * CỬ CHỈ / NÚT BACK CỦA MÁY khi đang trong ván online (đang chơi, bảng kết quả, đang xem): hỏi như cũ nhưng đích là MÀN
 * ONLINE (danh sách phòng), không phải trang chủ — 23.11.2026, chủ dự án: "khi thoát một màn chơi online thì ra trang
 * lobby, đừng ra trang chủ". Nút ✕ trong ván đã vậy từ 16.11 (`quitVeOnline`); đường Back của App gọi `requestHome` nên
 * vuốt Back giữa ván văng thẳng ra trang chủ. Nút LOGO (`requestHome`) vẫn về trang chủ — đó đúng là việc của logo.
 * Ở phòng chờ Back đã có chốt riêng (useBackCloser 25); ở màn chọn phòng thì lùi một bậc = trang chủ.
 */
function requestBack(): void {
  const trongVan = o.phase.value === 'playing' || o.phase.value === 'ended';
  quit(trongVan ? veManOnline : exit);
}
defineExpose({ requestHome: () => quit(), requestBack, isBusy, dangChoi, trongPhong });

/** Link mời mang TÊN người mời + ngôn ngữ: Worker dựng thẻ chia sẻ riêng ("Kiên mời bạn đấu
 *  Lật Thẻ! · Phòng 482193") từ hai tham số này — apps/server/src/index.ts `theMoi`. */
const inviteLink = computed(() => {
  if (laCong) return '';   // cổng game: không đưa link về web của mình — mời bằng mã 6 số
  const q = new URLSearchParams({ room: o.room.value?.code ?? '' });
  const toi = o.room.value?.players.find((p) => p.id === o.myId.value)?.name.trim();
  if (toi) q.set('tu', toi.slice(0, 16));
  q.set('l', ngonNgu.value);
  // Nguồn cho GA (17.11.2026): người mới tới từ lời mời bạn bè hiện ở Báo cáo → Thu nạp, không cần sự kiện
  q.set('utm_source', 'moi_ban'); q.set('utm_medium', 'link_moi');
  return `${SITE_URL}/?${q.toString()}`;
});

/** Copy riêng mã 6 số — bạn bè đọc mã qua điện thoại thì cần đúng phần này. */
async function copyCode(): Promise<void> {
  const code = o.room.value?.code ?? '';
  try {
    await navigator.clipboard.writeText(code);
    moChucNang('online_chep_ma');
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
  `${t('on.loiMoi', { code: o.room.value?.code ?? '' })}${inviteLink.value ? `\n${inviteLink.value}` : ''}`);

/** Copy lời mời. KHÔNG dùng `navigator.share` nữa: bảng chia sẻ của hệ điều
 *  hành đòi thêm 2–3 chạm mới tới được app muốn gửi, mà thứ người chơi cần chỉ
 *  là nội dung nằm sẵn trong clipboard để dán vào chỗ họ đang chat. */
async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteText.value);
    moChucNang('online_chep_loi_moi');
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
  // Chỉ người ĐANG KẾT NỐI — khớp server (người đang trong hạn giữ chỗ không
  // bấm được Sẵn sàng; chờ họ là nút Bắt đầu khoá tới 30 giây vô cớ).
  const others = r.players.filter((p) => p.id !== r.hostId && p.connected);
  return { ok: others.filter((p) => p.ready).length, need: others.length };
});
const canStart = computed(() => {
  const r = o.room.value;
  return !!r && r.players.filter((p) => p.connected).length >= 2 && soDoi.value >= 2
    && readyCount.value.ok === readyCount.value.need;
});
/**
 * NÚT BẮT ĐẦU LUÔN BẤM ĐƯỢC khi đủ người + đủ đội (19.11.2026, mockup duyệt). Còn ai chưa sẵn sàng thì
 * nút xám xanh ghi rõ đang chờ ai; bấm → bảng Nhắc (KHÔNG có "bắt đầu luôn"). Đủ hết → xanh lá sáng.
 */
const coTheBam = computed(() => {
  const r = o.room.value;
  return !!r && r.players.filter((p) => p.connected).length >= 2 && soDoi.value >= 2;
});
/** Người (thật, đang kết nối, không phải chủ phòng) chưa bấm Sẵn sàng. */
const chuaSan = computed(() => {
  const r = o.room.value;
  return r ? r.players.filter((p) => p.id !== r.hostId && p.connected && !p.ready && !p.may) : [];
});
const moNhac = ref(false);
const nhacLuc = ref(0);
const conGiayNhac = computed(() => Math.max(0, Math.ceil((nhacLuc.value + NHAC_CACH_MS - clockNhac.value) / 1000)));
const clockNhac = ref(Date.now());
let nhacTimer: ReturnType<typeof setInterval> | undefined;
watch(moNhac, (m) => {
  clearInterval(nhacTimer);
  if (m) { clockNhac.value = Date.now(); nhacTimer = setInterval(() => { clockNhac.value = Date.now(); }, 500); }
});
onBeforeUnmount(() => clearInterval(nhacTimer));
/** Bấm Bắt đầu khi còn người chưa sẵn sàng: ô ⏳ của họ NHÁY vài giây (chủ dự án 19.11.2026: "nháy những ai
 *  chưa sẵn sàng") + bảng Nhắc. Bỏ "Sẵn sàng x/y" và dòng "Còn chờ X" dưới nút — "nhìn rối quá". */
const nhayChua = ref(false);
let nhayChuaTimer: ReturnType<typeof setTimeout> | undefined;
function bamBatDau(): void {
  if (canStart.value) { batDauVan(); return; }
  sfx.select();
  nhayChua.value = true;
  clearTimeout(nhayChuaTimer);
  nhayChuaTimer = setTimeout(() => { nhayChua.value = false; }, 2600);
  moNhac.value = true;
}
onBeforeUnmount(() => clearTimeout(nhayChuaTimer));
function guiNhac(): void {
  if (conGiayNhac.value > 0) return;
  const ten = chuaSan.value.length === 1 ? tenNguoi(chuaSan.value[0]!) : '';
  o.nhac();
  nhacLuc.value = Date.now();
  moNhac.value = false;
  baoNoi({ loai: 'tot', ic: 'nhac', chu: ten ? t('bao.daNhac', { ten }) : t('bao.daNhacTatCa') });
}
/** Người chơi vừa bị nhắc: nút Sẵn sàng nhịp sáng vài giây. */
const nutNhay = ref(false);
let nhayTimer: ReturnType<typeof setTimeout> | undefined;
// Đã bấm Sẵn sàng thì lời nhắc hết nghĩa — gỡ khỏi dải báo
watch(meReady, (r) => { if (r) { boBao('nhac'); nutNhay.value = false; } });
watch(() => o.nhacTu.value?.so, () => {
  nutNhay.value = true;
  clearTimeout(nhayTimer);
  nhayTimer = setTimeout(() => { nutNhay.value = false; }, 4000);
});
onBeforeUnmount(() => clearTimeout(nhayTimer));
const tenChu = computed(() => {
  const r = o.room.value;
  const c = r?.players.find((p) => p.id === r.hostId);
  return c ? tenNguoi(c) : '';
});
/** Trạng thái dưới tên mỗi dòng ở phòng chờ — CÙNG chữ với dải báo. */
function trangThai(p: { id: string; ready?: boolean; connected: boolean; may?: unknown }): { chu: string; loai: string } {
  const r = o.room.value;
  if (!p.connected) return { chu: t('on.tt.matKetNoi'), loai: 'mang' };
  if (p.id === r?.hostId) return { chu: t('on.tt.chuPhong'), loai: 'chu' };
  const toi = p.id === o.myId.value;
  // Máy luôn sẵn sàng (server đặt ready: true)
  if (p.ready || p.may) return { chu: toi ? t('on.tt.banSan') : t('on.tt.san'), loai: 'ok' };
  return { chu: toi ? t('on.tt.banChua') : t('on.tt.chua'), loai: 'cho' };
}
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
  moNhac.value = false;
  sfx.go();                                  // kêu NGAY, đừng đợi server
  dangMoVan.value = true;
  clearTimeout(moVanTimer);
  moVanTimer = setTimeout(() => {
    dangMoVan.value = false;
    /*
     * HẾT HẠN MÀ VÁN KHÔNG MỞ THÌ PHẢI NÓI. Bản trước chỉ tắt cái spinner, nên
     * người chơi thấy nút nhá lên rồi quay về mà không biết vì sao — đúng cảnh
     * đã bị báo (lúc đó server vừa được thay ảnh nên tin `start` rơi mất). Chỉ
     * nói khi CHƯA có lỗi nào từ server: lời của server luôn cụ thể hơn.
     */
    if (!o.error.value) o.error.value = t('on.moVanLoi');
  }, HAN_MO_VAN);
  o.start();
}

watch(() => o.room.value?.status, (st) => {
  if (st && st !== 'lobby') { clearTimeout(moVanTimer); dangMoVan.value = false; }
});
/*
 * SERVER ĐÃ MỞ LƯỢT CHỌN SỐ THẺ = đã nhận lệnh Bắt đầu → thôi canh `HAN_MO_VAN` (24.11.2026). Lượt chọn 10 giây + hiệu ứng
 * chốt vài giây dài hơn hạn 6 giây, nên bản 1.9.37 hiện "Chưa mở được ván — mạng vừa chập" ngay sau popup dù ván vẫn mở
 * (ảnh chụp thật). Lượt chọn bị huỷ (thiếu người) mà phòng vẫn ở phòng chờ thì tắt vòng quay.
 */
watch(() => o.room.value?.chon?.id, (id) => {
  if (!dangMoVan.value) return;
  if (id !== undefined) clearTimeout(moVanTimer);
  else if (o.room.value?.status === 'lobby') dangMoVan.value = false;
});
// Server TỪ CHỐI mở ván (báo lỗi) thì tắt vòng quay ngay — trước đây nút kẹt "Đang mở ván…"
// suốt 6 giây ngay trên dòng lỗi (ảnh chủ dự án gửi 15.11.2026).
watch(() => o.error.value, (e) => { if (e && dangMoVan.value) { clearTimeout(moVanTimer); dangMoVan.value = false; } });
onBeforeUnmount(() => clearTimeout(moVanTimer));

const startLabel = computed(() => {
  const r = o.room.value;
  if (!r || r.players.length < 2) return t('on.canHaiNguoi');
  if (soDoi.value < 2) return t('dd.thieu');
  return canStart.value ? `▶ ${t('on.batDau')}!` : t('on.batDau');
});


/** Năm hàng tuỳ chọn — giống hệt wizard chơi đơn, để hai chỗ đọc ra là một. */
/*  Tên hàng đọc từ từ điển (`opt.<key>`), cùng khoá với MenuScreen. */
const OPTION_ROWS: readonly { key: OptionKey; icon: IconName }[] = [
  { key: 'time',    icon: 'time' },
  { key: 'lives',   icon: 'lives' },
  { key: 'peek',    icon: 'peek' },
  { key: 'shuffle', icon: 'shuffle' },
  { key: 'special', icon: 'special' }
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
  // Phòng online mặc định bật TẤT CẢ theme CHƠI ĐƯỢC (premium chỉ khi đã mua):
  // bàn thẻ trộn nhiều bộ biểu tượng nên khó đoán hơn, và chủ phòng không phải
  // đi chọn từng cái.
  if (!cfg.value.themeIds.length) cfg.value = { ...cfg.value, themeIds: list.filter(choiDuoc).map((t) => t.id) };
});
const themeName = (id: string): string => tenTheme(id, allThemes.value.find((x) => x.id === id)?.name ?? id);
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
    .map((k) => ({ key: k, icon: OPTION_ICONS[k], text: dichGoiYTuyChon(optionSummary(k, c.options[k], c.level)) ?? '' }))
    .filter((x) => x.text !== '');
}
/** Dòng "Bàn" ở phòng chờ: luật đang bật (tên ngắn), không bật gì thì "luật thường". */
const luatBan = computed(() => {
  const c = o.room.value?.config;
  const bat = c ? OPTION_KEYS.filter((k) => c.options[k] > 0).map((k) => td(`opt.${k}`)) : [];
  return bat.length ? bat.join(', ') : t('on.luatThuong');
});
/** "Tất cả 12 bộ" / "Đã chọn 3 bộ" — cùng chữ với màn Bàn chơi (BanChon). Rỗng = mọi bộ miễn phí. */
const boBan = computed(() => {
  const ids = o.room.value?.config.themeIds ?? [];
  const mienPhi = allThemes.value.filter((x) => !x.premium).length;
  if (!ids.length) return t('menu.nhanh.tatCaBo', { n: mienPhi });
  return ids.length >= allThemes.value.filter(choiDuoc).length ? t('menu.nhanh.tatCaBo', { n: ids.length }) : t('menu.nhanh.soBo', { n: ids.length });
});
/** Hình mẫu tối đa 3 bộ của phòng; rỗng = mọi bộ miễn phí. */
const hinhBan = computed(() => {
  const ids = o.room.value?.config.themeIds ?? [];
  const ds = ids.length ? allThemes.value.filter((x) => ids.includes(x.id)) : allThemes.value.filter((x) => !x.premium);
  return ds.slice(0, 3).map((x) => anhEmoji(x.symbols[0], true, 128)).filter((x): x is string => !!x);
});
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
  // Rỗng = server trộn mọi theme MIỄN PHÍ (premium phải tự chọn) — đếm đúng số đó,
  // không phải cả 48 (ảnh phòng chờ 14.10.2026 ghi "tất cả 48 theme" sai)
  const mienPhi = allThemes.value.filter((x) => !x.premium).length;
  if (!ids.length) {
    return mienPhi ? t('on.tatCaTheme', { n: mienPhi }) : t('on.tatCaThemeTron');
  }
  if (ids.length >= allThemes.value.length && allThemes.value.length) return t('on.tatCaTheme', { n: ids.length });
  if (ids.length > 3) return t('on.soTheme', { n: ids.length });
  return ids.map(themeName).join(', ');
}

/** Wizard chọn bàn chơi — dùng cả trước khi tạo phòng lẫn khi chỉnh trong lobby. */
// Cùng thứ tự với wizard chơi đơn: chế độ → cấp độ → theme.
const wizard = ref<null | 'ban' | 'level' | 'theme' | 'options'>(null);

/* ---------- TỰ LÀM MỚI DANH SÁCH PHÒNG ----------
 *
 * IM LẶNG từ 14.10.2026: không còn vòng tròn đếm ngược hay nút làm mới tay —
 * chủ dự án bỏ. Danh sách vẫn tự tải lại mỗi CHU_KY_S giây.
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
// 5 giây (14.10.2026, trước là 10): server CHÍNH nay là Node — sổ phòng là một Map
// trong RAM, hỏi dày không tốn gì; Cloudflare (mỗi nhịp đánh thức SoPhongDO) chỉ còn dự phòng.
const CHU_KY_S = 5;
const demNguoc = ref(CHU_KY_S);
let nhip: ReturnType<typeof setInterval> | undefined;

function datLaiDem(): void { demNguoc.value = CHU_KY_S; }

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
// Chỉnh bàn của phòng đang có: ở lobby, hoặc từ nút "Chỉnh bàn" ở màn kết quả (07.11.2026)
const editingInLobby = computed(() => o.phase.value === 'lobby' || o.phase.value === 'ended');
const WIZ_TITLES = computed(() => ({ ban: t('menu.buoc.options'), level: t('menu.chonSoThe'), theme: t('menu.buoc.theme'), options: t('menu.nhanh.luat') }));

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

/** Bước phụ (lưới cỡ, bộ thẻ, luật) lùi về màn Bàn chơi; màn Bàn chơi lùi về phòng — KHÔNG lưu. */
function wizBack(): void {
  if (wizard.value && wizard.value !== 'ban') {
    if (wizard.value === 'theme' && wizTooSmall.value) return;   // thiếu biểu tượng: ở lại, cảnh báo đang hiện
    wizard.value = 'ban'; return;
  }
  wizard.value = null;
}
function chonCoBan(level: number, cach: 'cuon' | 'bam' = 'bam'): void {
  if (level === cfg.value.level) return;
  // Cuộn dải số thẻ: KHÔNG kêu, dải đã rung từng ô (như MenuScreen.chonCo — 19.11.2026 sót chỗ này)
  if (cach !== 'cuon') sfx.select();
  cfg.value = { ...cfg.value, level };
}
function moBuocBan(b: 'level' | 'theme' | 'options'): void { sfx.select(); wizard.value = b; }

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
/** TÌM THẺ ONLINE (27.11.2026): chủ phòng chọn kiểu chơi ngay ở phòng chờ — hiện khi Tìm Thẻ mở / đang bật debug. */
const hienTim = computed(() => TIM_THE_MO || dangDebug.value);
const laTimPhong = computed(() => o.room.value?.config.kieu === 'tim');
/** Số thẻ còn hợp lệ (mức 8, 9, 12, 16 đã bỏ → undefined). */
const timSoTheHop = (n: number | undefined): number | undefined => ((TIM_THE_SO_THE as readonly number[]).includes(n ?? -1) ? n : undefined);
function doiKieuPhong(k: 'thuong' | 'tim'): void {
  if ((k === 'tim') === laTimPhong.value) return;
  sfx.select();
  moChucNang('phong_kieu_choi', { kieu: k });
  // Chuyển sang Tìm Thẻ: số thẻ + độ khó = lựa chọn NHỚ từ lần trước (chung với chơi đơn — chủ dự án 27.11.2026)
  const nho = docChon(), c = o.room.value?.config;
  o.setConfig(k === 'tim' ? { kieu: k, timSoThe: timSoTheHop(c?.timSoThe) ?? nho.soThe, timDoKho: c?.timDoKho ?? nho.doKho } : { kieu: k });
}

const cardCount = computed(() => {
  const lv = o.room.value?.config.level;
  return lv ? levelSpec(lv).pairs * 2 : 0;
});

function wizPickLevel(id: number): void {
  sfx.select();
  cfg.value = { ...cfg.value, level: id };
  wizard.value = 'ban';
}

/** Bộ theme đang chọn đủ biểu tượng cho cấp đã chọn chưa? */
const wizTooSmall = computed(() =>
  wizPool.value > 0 && wizPool.value < levelSpec(cfg.value.level).pairs);

const creatingRoom = ref(false);
// Tạo hỏng (mất mạng…) thì thôi cờ đang tạo — nút "Tạo phòng" bấm lại được
watch(o.phase, (ph) => { if (creatingRoom.value && (ph === 'error' || ph === 'idle')) creatingRoom.value = false; });

function wizFinish(): void {
  if (wizTooSmall.value) { wizard.value = 'theme'; return; }
  sfx.select();
  if (editingInLobby.value) o.setConfig({ ...cfg.value });
  // Nhớ số thẻ + độ khó Tìm Thẻ cho lần sau (chung với chơi đơn)
  if (laTimPhong.value && cfg.value.timSoThe) luuChon({ ...docChon(), soThe: cfg.value.timSoThe, doKho: cfg.value.timDoKho ?? docChon().doKho });
  wizard.value = null;
}

// Đang "Chỉnh bàn" sau ván mà phòng đi tiếp nơi khác (ai đó vào ván, phòng đóng…) thì
// đóng wizard — về lobby thì giữ, vì ở đó nó vẫn đúng là bảng chỉnh bàn.
watch(o.phase, (ph, cu) => {
  if (cu === 'ended' && wizard.value && ph !== 'lobby' && ph !== 'ended' && !creatingRoom.value) wizard.value = null;
});
// Tạo phòng xong (vào lobby) thì đóng wizard
watch(o.phase, (ph) => {
  if (creatingRoom.value && ph !== 'connecting' && ph !== 'idle') {
    creatingRoom.value = false;
    wizard.value = null;
  }
});

function openCfgWizard(): void {
  const c = o.room.value?.config;
  // themeIds rỗng = server trộn mọi bộ miễn phí: hiện đúng như thế (đủ các bộ chơi được) để màn Bộ thẻ khớp
  if (c) cfg.value = { level: c.level, themeIds: c.themeIds.length ? [...c.themeIds] : allThemes.value.filter((x) => !x.premium).map((x) => x.id), options: { ...c.options }, timSoThe: timSoTheHop(c.timSoThe) ?? docChon().soThe, timDoKho: c.timDoKho ?? docChon().doKho };
  wizard.value = 'ban';
}
</script>

<template>
  <!-- Một root duy nhất: component này nằm trong <Transition> của App,
       nhiều root sẽ làm Transition render trắng trang -->
  <div class="online">
  <!-- WIZARD CHỌN BÀN CHƠI: dùng khi tạo phòng và khi chỉnh trong lobby -->
  <section v-if="wizard" class="panel" :class="{ 'wiz-phu': o.phase.value === 'ended' }">
    <div class="head">
      <button class="btn back" :aria-label="t('menu.quayLai')" type="button" @click="wizBack"><ChevronLeft :size="22" /></button>
      <h2>{{ WIZ_TITLES[wizard!] }}</h2>
    </div>

    <!-- ĐỔI BÀN MỘT MÀN (17.11.2026): như màn Chơi nhanh — bước phụ xong là quay về đây -->
    <div v-if="wizard === 'ban'" class="step-body nhanh">
      <p class="hint-multi">{{ t('on.banChung') }}</p>
      <!-- TÌM THẺ (27.11.2026): chủ phòng đặt số thẻ + độ khó ở đây; lúc Bắt đầu cả phòng chỉ biểu quyết số thẻ ±1 bậc -->
      <ChonTimThe
        v-if="laTimPhong"
        :chon="{ soThe: cfg.timSoThe ?? TIM_THE_ONLINE_SO_THE, doKho: cfg.timDoKho ?? 'vua', doiThu: 'mot' }"
        @doi="(c) => { cfg = { ...cfg, timSoThe: c.soThe, timDoKho: c.doKho }; }"
      />
      <BanChon
        :level="cfg.level" :symbol-count="allSymbols" :themes="allThemes" :theme-ids="cfg.themeIds" :options="cfg.options" :tim="laTimPhong"
        @chon-co="chonCoBan" @mo="moBuocBan"
      />
      <p v-if="wizTooSmall" class="warn" role="alert">
        {{ t('on.thieuBieuTuong', { n: levelSpec(cfg.level).pairs * 2 }) }}
      </p>
      <button class="btn-primary nh-bat-dau" type="button" @click="wizFinish">{{ t('menu.nhanh.xong') }}</button>
    </div>

    <div v-else-if="wizard === 'level'" class="step-body">
      <!-- Phòng online chọn SỐ THẺ, không đi theo thang cấp: thang cấp chỉ có
           nghĩa khi chơi một mình (mỗi máy mở tới một cấp khác nhau, khoá lại
           thành ra tranh cãi chọn bàn nào), mà độ khó thì đã nằm ở bước tuỳ
           chọn ngay sau đây. -->
      <SizeGrid :level="cfg.level" :symbol-count="allSymbols" @play="wizPickLevel" />
    </div>

    <div v-else-if="wizard === 'theme'" class="step-body">
      <p class="hint-multi">{{ t('on.nhieuTheme') }}</p>
      <ThemePicker :themes="allThemes" :selected="cfg.themeIds" :nhan="tr('on.themeAria')" @toggle="wizToggleTheme" @dat="(ids) => { cfg = { ...cfg, themeIds: ids }; }" />

      <p v-if="themeWarn" class="warn" role="alert">{{ t('menu.itNhatMotTheme') }}</p>
      <p v-if="wizTooSmall" class="warn" role="alert">
        {{ t('on.thieuBieuTuong', { n: levelSpec(cfg.level).pairs * 2 }) }}
      </p>

      <button
        class="btn-primary" type="button"
        :disabled="wizTooSmall"
        @click="sfx.select(); wizard = 'ban'"
      >
        {{ t('menu.nhanh.xong') }}
      </button>
    </div>

    <!-- BƯỚC CUỐI: tuỳ chọn bàn chơi, giống hệt wizard chơi đơn. Cả phòng chơi
         chung một bàn nên đây là luật của tất cả mọi người. -->
    <div v-else class="step-body opt-list">
      <div class="opt-rows">
      <div v-for="row in OPTION_ROWS" :key="row.key" class="opt-row">
        <div class="opt-head">
          <OptionIcon :name="row.icon" :size="24" />
          <span class="opt-name">{{ td(`opt.${row.key}`) }}</span>
          <span class="opt-hint">{{ dichGoiYTuyChon(optionSummary(row.key, cfg.options[row.key], cfg.level)) ?? t('menu.tat') }}</span>
        </div>
        <div class="seg" role="group" :aria-label="td(`opt.${row.key}`)">
          <button
            v-for="(nhan, muc) in OPTION_LABELS[row.key]" :key="nhan"
            class="seg-btn" type="button"
            :aria-pressed="cfg.options[row.key] === muc"
            @click="setWizOption(row.key, muc as OptLevel)"
          >{{ td(`opt.${row.key}.${muc}`) }}</button>
        </div>
      </div>
      </div>

      <button class="btn-primary" type="button" @click="sfx.select(); wizard = 'ban'">
        {{ t('menu.nhanh.xong') }}
      </button>
    </div>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
    <button v-if="o.canCapNhat.value" class="nut-cap-nhat thach th-tim" type="button" @click="capNhatNgay">{{ t('chung.capNhat') }}</button>
  </section>

  <!-- VÀO ONLINE: bước 1 chọn việc, bước 2 điền form -->
  <section v-if="!wizard && (o.phase.value === 'idle' || o.phase.value === 'error' || o.phase.value === 'connecting')" class="panel">
    <div class="head">
      <button class="btn back" :aria-label="t('menu.quayLai')" type="button" @click="backEntry"><ChevronLeft :size="22" /></button>
      <h2>{{ entryStep === 'choose' ? t('menu.online') : entryStep === 'create' ? t('on.taoPhongMoi') : t('on.vaoPhong') }}</h2>
    </div>

    <!--
      BƯỚC 1: nút tạo phòng + DANH SÁCH PHÒNG ĐANG CHỜ.

      Trước đây đây là hai ô "Tạo phòng mới" / "Vào phòng có sẵn", tức là ai
      muốn chơi cũng phải có sẵn một cái mã ai đó gửi cho. Giờ mở màn này ra là
      thấy ngay phòng nào đang chờ người, bấm một cái là vào — nhập mã tụt xuống
      thành một dòng ở dưới, dành cho phòng riêng tư.
    -->
    <template v-if="entryStep === 'choose'">
      <!-- 23.11.2026: số người đang online — thấy có người là chủ động tạo phòng rồi "Mời người online" -->
      <!-- GIỜ VÀNG (28.11.2026, mockup duyệt https://claude.ai/artifact/TdLTzxW8Hc61MU3F23cvkk): 20:00–21:00 giờ máy — dải vàng thay
           dòng số người online (số người chuyển vào dòng phụ), đồng hồ phút còn lại. Ngoài giờ: như cũ. -->
      <div v-if="gioVang.dang" class="dai-gv" role="status">
        <Flame :size="20" :stroke-width="2.6" aria-hidden="true" />
        <div><b>{{ t('gv.daiTieuDe') }}</b><small>{{ t('gv.daiPhu') }}<template v-if="soNguoiOnline > 0"> · {{ t('bxh.dangOnline', { n: soNguoiOnline }) }}</template></small></div>
        <span class="gio" :aria-label="t('gv.conPhut', { n: gioVang.conPhut })">{{ t('gv.conPhut', { n: gioVang.conPhut }) }}</span>
      </div>
      <p v-else-if="soNguoiOnline > 0" class="on-so-ol"><i aria-hidden="true" />{{ t('bxh.dangOnline', { n: soNguoiOnline }) }}</p>
      <button class="btn-primary tao-phong" type="button" :disabled="creatingRoom" @click="batDauTao()">
        <template v-if="creatingRoom">{{ t('on.dangTao') }}</template>
        <template v-else><Plus :size="22" /> {{ t('on.taoPhong') }}</template>
      </button>

      <div class="list-head">
        <h3>{{ t('on.phongDangCho') }}</h3>
        <span v-if="phongCho.length" class="count">{{ phongCho.length }}</span>
        <button
          v-if="coChuong" class="chuong thach th-nho" :class="{ bat: dangBat, 'th-xanh': dangBat }" type="button"
          :disabled="tbDangLam" :aria-pressed="dangBat" @click="bamChuong()"
        >
          <BellRing v-if="dangBat" :size="16" aria-hidden="true" /><Bell v-else :size="16" aria-hidden="true" />
          <span>{{ dangBat ? t('on.tb.dangBao') : t('on.tb.baoToi') }}</span>
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

      <ul v-else-if="phongCho.length" class="rooms">
        <li v-for="r in phongCho" :key="r.code">
          <!-- Dòng ĐANG VÀO tự báo lấy: mũi tên thành vòng quay, chữ đổi theo.
               Báo ở chính chỗ ngón tay vừa chạm thì không phải đi tìm xem
               chuyện gì đang xảy ra. Các dòng khác mờ đi để khỏi bấm nhầm. -->
          <button
            class="room thach" type="button"
            :class="{ vao: dangVaoPhong === r.code, mo: dangVaoPhong && dangVaoPhong !== r.code }"
            :disabled="!!dangVaoPhong"
            @click="vaoPhongCongKhai(r.code)"
          >
            <span class="av" :class="{ 'vong-mau': !!r.mau }" :style="r.mau ? { '--m': r.mau } : undefined"><MatNguoi :mat="r.avatar" :anh="r.anh" /></span>
            <span class="body">
              <span class="rname">{{ r.chuPhong }}</span>
              <span class="meta">
                <template v-if="dangVaoPhong === r.code">{{ t('on.dangVaoPhong') }}</template>
                <template v-else>
                  <i><LayoutGrid :size="14" /> {{ t('on.soThe', { n: r.the }) }}</i>
                  <i><Users :size="14" /> {{ r.nguoi }}/{{ r.toiDa }}</i>
                </template>
              </span>
            </span>
            <span v-if="dangVaoPhong !== r.code" class="slots" :class="{ tight: r.toiDa - r.nguoi <= 1 }">
              <b>{{ r.toiDa - r.nguoi }}</b><small>{{ t('on.cho') }}</small>
            </span>
            <RefreshCw v-if="dangVaoPhong === r.code" :size="18" class="go quay" />
            <ChevronRight v-else :size="18" class="go" />
          </button>
        </li>
      </ul>

      <!-- Trống vì LỖI ≠ trống vì không có phòng nào: nói khác nhau, vì cách xử
           lý của người chơi cũng khác (bấm thử lại / tự tạo phòng). -->
      <div v-else class="empty">
        <span class="art th-vang"><img v-if="anhDiaCau" :src="anhDiaCau" alt="" /><Globe v-else :size="36" :stroke-width="1.9" /></span>
        <template v-if="o.loiTaiPhong.value">
          <h4>{{ t('on.loiDs.tieuDe') }}</h4>
          <p>{{ t('on.loiDs.than') }}</p>
          <button class="btn" type="button" @click="o.taiPhongCongKhai()">{{ t('on.thuLai') }}</button>
        </template>
        <template v-else>
          <h4>{{ t('on.trong.tieuDe') }}</h4>
          <p>{{ t('on.trong.than') }}</p>
        </template>
      </div>

      <!-- ĐANG CHƠI — VÀO XEM (19.11.2026, chủ dự án: "phòng đã bắt đầu vẫn ở danh sách, cho người khác vào
           xem"). Dòng ghi tên người đang chơi + chấm đỏ "Đang chơi"; nút Xem vào thẳng làm người xem. -->
      <template v-if="phongXem.length && !o.dangTaiPhong.value">
        <div class="list-head xem-head"><h3>{{ t('on.dangChoiXem') }}</h3><span class="count">{{ phongXem.length }}</span></div>
        <ul class="rooms">
          <li v-for="r in phongXem" :key="r.code">
            <button
              class="room thach dang-choi" type="button"
              :class="{ vao: dangVaoPhong === r.code, mo: dangVaoPhong && dangVaoPhong !== r.code }"
              :disabled="!!dangVaoPhong" @click="vaoPhongCongKhai(r.code)"
            >
              <span class="av" :class="{ 'vong-mau': !!r.mau }" :style="r.mau ? { '--m': r.mau } : undefined"><MatNguoi :mat="r.avatar" :anh="r.anh" /></span>
              <span class="body">
                <span class="rname">{{ r.ten?.length ? r.ten.join(', ') : r.chuPhong }}</span>
                <span class="meta">
                  <template v-if="dangVaoPhong === r.code">{{ t('on.dangVaoPhong') }}</template>
                  <template v-else>
                    <i class="live"><span class="cham-do" aria-hidden="true" />{{ t('on.dangChoi') }}</i>
                    <i><LayoutGrid :size="14" /> {{ t('on.soThe', { n: r.the }) }}</i>
                  </template>
                </span>
              </span>
              <RefreshCw v-if="dangVaoPhong === r.code" :size="18" class="go quay" />
              <span v-else class="nut-xem thach th-troi th-nho"><BongNgo :size="18" />{{ t('on.xem') }}</span>
            </button>
          </li>
        </ul>
      </template>

      <button class="link-row thach th-nho" type="button" @click="entryStep = 'join'">
        <Hash :size="18" /> {{ t('on.nhapMa') }}
      </button>
    </template>

    <!-- BƯỚC 2a: tạo phòng — chỉ cần tên -->
    <template v-else-if="entryStep === 'create'">
      <label class="field">
        <span>{{ t('on.tenBan') }}</span>
        <input v-model="name" maxlength="16" :placeholder="namePlaceholder" @keydown.enter="create">
      </label>
      <button class="btn-primary" :disabled="!name.trim() || creatingRoom" type="button" @click="create">
        {{ creatingRoom ? t('on.dangTao') : t('on.taoPhong') }}
      </button>
    </template>

    <!-- BƯỚC 2b: vào phòng — tên + mã (link mời thì mã điền sẵn, giấu ô mã) -->
    <template v-else>
      <!-- F5 giữa phòng: nói đúng việc đang xảy ra, đừng mời người ta vào chính
           cái phòng họ đang ngồi. -->
      <!-- Đang vào lại phòng cũ mà chưa có ảnh phòng để vẽ (phiên của bản cũ):
           để TRỐNG, không spinner, không chữ — vài trăm ms là phòng hiện ra. Chủ
           dự án 15.10.2026: nối lại là việc ngầm, không hiện "đang tải". -->
      <div v-if="dangVaoLai" class="vao-lai" aria-busy="true" />
      <template v-else>
      <p v-if="invited" class="invite">
        {{ t('on.duocMoi') }} <b class="invite-code">{{ codeInput }}</b>
      </p>
      <label class="field">
        <span>{{ t('on.tenBan') }}</span>
        <input v-model="name" maxlength="16" :placeholder="namePlaceholder" @keydown.enter="join">
      </label>
      <label v-if="!invited" class="field">
        <span>{{ t('on.maPhong') }}</span>
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
        {{ o.phase.value === 'connecting' ? t('on.dangVaoPhong') : t('on.vaoPhongChoi') }}
      </button>
      </template>
    </template>

    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
    <button v-if="o.canCapNhat.value" class="nut-cap-nhat thach th-tim" type="button" @click="capNhatNgay">{{ t('chung.capNhat') }}</button>
    <!-- Mất kết nối mà phòng vẫn còn (token còn trong localStorage): cho bấm
         thử lại tại chỗ, đừng bắt người ta gõ lại mã phòng. -->
    <button v-if="o.phase.value === 'error' && o.coThuLai.value" class="btn primary" type="button" @click="o.retry()">
      {{ t('on.thuLai') }}
    </button>
  </section>

  <!-- PHÒNG THI ĐẤU (22.11.2026): không chủ phòng, đủ người là server tự đếm ngược — chỉ hiện ai đã vào bàn -->
  <section v-else-if="!wizard && o.phase.value === 'lobby' && o.room.value?.thiDau" class="panel td-vao" role="status">
    <h2>{{ t('td.dangVao') }}</h2>
    <ul class="td-vao-ds">
      <li v-for="p in o.room.value.players" :key="p.id"><span class="avatar" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /><DauPremium :loai="p.hh" /></span><b>{{ tenNguoi(p) }}</b></li>
    </ul>
    <div class="eb-cho" aria-hidden="true" />
  </section>

  <!-- LOBBY -->
  <section v-else-if="!wizard && o.phase.value === 'lobby'" class="panel">
    <!--
      ĐẦU PHÒNG GỌN (14.11.2026, mockup duyệt https://claude.ai/artifact/5WCU919WRXPLyPVS51VErS):
      tiêu đề "Phòng <mã>" (trước là tên chủ phòng — đọc như tên màn), dòng nhỏ dưới là chip
      Công khai/Riêng tư; MỘT nút Mời bên phải. Bỏ hàng "mã + hai chip" riêng — tiết kiệm ~50px
      để 4 dòng người chơi + ô chỗ trống vừa khung (nút "Thêm máy" từng bị khuất ở 1.6.0).
    -->
    <div class="head dau-phong">
      <button class="btn back" :aria-label="t('on.roiPhong.nut')" type="button" @click="backLobby"><ChevronLeft :size="22" /></button>
      <div class="dp-chu">
        <h2>{{ t('on.phongMa', { ma: o.room.value?.code ?? '' }) }}</h2>
        <!-- Chip trạng thái: mở ra hai ô chọn chứ KHÔNG đổi ngay (xem khối .sophong dưới) -->
        <button
          class="ck-nho thach th-nho" :class="{ doc: !o.isHost.value }"
          type="button" :disabled="!o.isHost.value" :aria-expanded="moChonCK"
          :aria-label="o.room.value?.congKhai ? t('on.ckAria') : t('on.rtAria')"
          @click="moChonCK = !moChonCK; moMoi = false"
        >
          <Globe v-if="o.room.value?.congKhai" :size="13" /><Lock v-else :size="13" />
          {{ o.room.value?.congKhai ? t('on.congKhai') : t('on.riengTu') }}
        </button>
      </div>
      <button
        class="moi-nut thach th-nho th-xanh" type="button" :aria-haspopup="true"
        @click="moMoi = true; moChonCK = false"
      ><Link2 :size="16" /> {{ t('on.moiBan') }}</button>
    </div>

    <!--
      Công khai hay riêng tư — bung ra khi chạm chip. Chỉ CHỦ PHÒNG mở được,
      nhưng ai cũng ĐỌC được trạng thái ngay trên chip: người vào phòng cần biết
      phòng mình đang ngồi có hiện cho người lạ không.
    -->
    <div v-if="moChonCK" class="sophong">
      <div class="sp-seg" role="radiogroup" :aria-label="t('on.aiVao')">
        <button
          class="sp-opt thach th-nho th-chon" :class="{ sel: o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'true' : 'false'"
          @click="o.datCongKhai(true); moChonCK = false"
        >
          <Globe :size="19" />
          <span>{{ t('on.congKhai') }}</span>
        </button>
        <button
          class="sp-opt priv thach th-nho th-chon" :class="{ sel: !o.room.value?.congKhai }" type="button"
          role="radio" :aria-checked="o.room.value?.congKhai ? 'false' : 'true'"
          @click="o.datCongKhai(false); moChonCK = false"
        >
          <Lock :size="19" />
          <span>{{ t('on.riengTu') }}</span>
        </button>
      </div>
    </div>

    <div class="ds-dau">
      <span>{{ t('on.nguoiChoiN', { n: o.room.value?.players.length ?? 0, max: ROOM_LIMITS.maxPlayers }) }}</span>
    </div>

    <!-- Mỗi dòng có ô "Đội N": ai cũng tự đổi đội mình (chủ phòng đổi được cả máy và người khác);
         cùng số là cùng đội, mỗi người một số là ván thường. -->
    <ul class="lobby-list">
      <li
        v-for="p in o.room.value?.players" :key="p.id" :data-chip-for="p.id"
        :class="[{ off: !p.connected, toi: p.id === o.myId.value, may: !!p.may, san: p.ready && p.connected && p.id !== o.room.value?.hostId && !p.may }, doiGhep(p.doiSo) ? `vd-${p.doiSo}` : '']"
      >
        <span class="avatar" :class="{ 'vong-mau': !!p.mau }" :style="p.mau ? { '--m': p.mau } : undefined"><MatNguoi :mat="p.avatar" :anh="p.anh" /><DauPremium :loai="p.hh" /></span>
        <!-- Dòng CỦA MÌNH: tên sửa được tại chỗ. Ai cũng đổi được tên mình,
             không ai đổi được tên người khác. -->
        <template v-if="p.id === o.myId.value && suaTen">
          <input
            :ref="ganOTen" v-model="tenMoi" class="sua-ten" maxlength="16"
            :aria-label="t('on.tenBan')"
            @keydown.enter="luuTen()" @keydown.esc="huySuaTen()"
          >
          <!-- NÚT LƯU rõ ràng. Trước đây chỉ có Enter và blur — Enter thì trên
               điện thoại phải mở bàn phím rồi tìm nút xanh, còn blur thì không
               ai biết là bấm ra ngoài sẽ lưu. Không có gì trên màn hình nói
               rằng đã xong hay chưa. -->
          <button
            class="nut-luu thach th-nho th-xanh" type="button" :aria-label="t('on.luuTen')"
            :disabled="!tenMoi.trim()" @click="luuTen()"
          ><Check :size="16" /></button>
          <button
            class="nut-huy thach th-nho" type="button" :aria-label="t('on.huyDoiTen')" @click="huySuaTen()"
          ><X :size="16" /></button>
        </template>
        <!-- Tên + DÒNG TRẠNG THÁI dưới tên (19.11.2026): "✓ Sẵn sàng" / "⏳ Chưa sẵn sàng" / "👑 Chủ phòng" —
             thay dấu "…/✓" xám nhỏ cạnh ô Đội mà chủ phòng không đọc ra (mockup duyệt). -->
        <span v-else class="ten-cot">
          <!-- MÁY (1.6.0): chủ phòng chạm tên máy để đổi mức -->
          <button
            v-if="p.may && o.isHost.value" class="ten-may thach th-nho" type="button"
            :aria-label="t('on.chonMucMay')" @click="sfx.select(); mayDangChon = p.id"
          ><b>{{ tenNguoi(p) }}</b></button>
          <!-- Tên CỦA MÌNH là nút đổi tên (bút nhỏ trong nút) — bỏ nút bút riêng cho dòng gọn -->
          <button
            v-else-if="p.id === o.myId.value" class="nut-sua ten-toi thach th-nho" type="button"
            :aria-label="t('on.doiTen')" :title="t('on.doiTen')"
            @click="moSuaTen(p.name)"
          ><b>{{ tenNguoi(p) }}</b><Pencil :size="12" /></button>
          <b v-else>{{ tenNguoi(p) }}</b>
        </span>
        <!-- CỘT SẴN SÀNG (19.11.2026, chủ dự án: "cho cột sẵn sàng, ai sẵn sàng thì … xanh, không thì biểu tượng
             khác"): ✋ trên nền xanh lá — cùng bàn tay của nút "✋ Sẵn sàng!" (tick xanh dễ đọc thành "đã xong") — thay dòng chữ dưới tên. Chủ phòng không cần (vương miện ở cột ngoài cùng): ô trống giữ thẳng cột. -->
        <span
          v-if="p.id !== o.room.value?.hostId" class="cot-san" :class="[`cs-${trangThai(p).loai}`, { nhay: nhayChua && trangThai(p).loai === 'cho' }]"
          role="img" :aria-label="trangThai(p).chu" :title="trangThai(p).chu"
        ><Hand v-if="trangThai(p).loai === 'ok'" :size="16" :stroke-width="2.6" /><WifiOff v-else-if="trangThai(p).loai === 'mang'" :size="15" :stroke-width="2.6" /><span v-else class="cham" aria-hidden="true"><i /><i /><i /></span></span>
        <span v-else class="cot-san trong" aria-hidden="true" />
        <!-- Ping: chỉ khi mạng YẾU (hoặc bật "ping bằng số" ở Debug) — mạng tốt không ai cần con số -->
        <span
          v-if="p.id === o.myId.value && p.connected && (pingSo || o.netHien.value === 'bad' || o.netHien.value === 'lost')"
          class="ping" :class="o.netHien.value"
          :title="o.pingHien.value === null ? t('on.doTreDangDo') : t('on.doTre', { ms: o.pingHien.value })"
        >{{ o.pingHien.value === null ? '···' : `${o.pingHien.value}ms` }}</span>
        <!-- Không có ô đội (server cũ): vương miện ở đây; có ô đội thì nó ở CỘT NGOÀI CÙNG, thẳng cột nút ✕ -->
        <Crown v-if="p.id === o.room.value?.hostId && !p.doiSo" :size="15" class="crown" />
        <!-- ĐỒNG ĐỘI: ô đội. Của MÌNH thì ai cũng bấm đổi được; của người khác / máy chỉ chủ phòng. -->
        <button
          v-if="p.doiSo" class="chip-doi thach th-nho" :class="`d-${p.doiSo}`" type="button"
          :disabled="!(o.isHost.value || p.id === o.myId.value)"
          :aria-label="t('dd.chonDoi')"
          @click="sfx.select(); doiDangChon = p.id"
        >{{ t('dd.doiN', { n: p.doiSo }) }}</button>
        <!-- Mời ra: chỉ CHỦ PHÒNG thấy, không bao giờ ở dòng của chính mình. Dấu X tròn (chủ dự
             án chọn 11.10.2026) — từ 14.11.2026 nhỏ, màu nhạt (đỏ to trông như báo lỗi); bấm vẫn
             hỏi xác nhận trước khi mời ra. -->
        <button
          v-if="o.isHost.value && p.id !== o.myId.value" class="nut-moi-ra thach th-nho" type="button"
          :aria-label="t('on.moiRaAria', { ten: tenNguoi(p) })" :title="t('on.moiRaAria', { ten: tenNguoi(p) })"
          @click="p.may ? (sfx.miss(), o.boMay(p.id)) : hoiMoiRa(p.id, p.name, p.connected)"
        ><X :size="14" :stroke-width="2.6" /></button>
        <!-- CỘT NGOÀI CÙNG luôn rộng bằng nút ✕ để ô đội mọi dòng thẳng hàng: dòng chủ phòng đặt
             vương miện ở đây (chủ dự án 15.11.2026); dòng không có gì thì để trống. -->
        <span v-else-if="p.doiSo" class="cho-moi-ra" aria-hidden="true">
          <Crown v-if="p.id === o.room.value?.hostId" :size="17" class="crown" />
        </span>
      </li>
      <!-- Ô chỗ trống + Thêm máy (chủ phòng). Trần phòng đọc từ ROOM_LIMITS, đừng ghi cứng. -->
      <li v-if="conCho > 0" class="empty">
        <span v-if="dangThach" class="cho-chu dang-thach" role="status">
          <Swords :size="14" :stroke-width="2.6" aria-hidden="true" /><span class="dt-chu">{{ t('moi.dangMoiTen', { ten: dangThach.ten }) }}</span>
          <i class="dt-vach" aria-hidden="true"><b :style="{ animationDuration: `${dangThach.han}ms` }" /></i>
        </span>
        <span v-else class="cho-chu">{{ t('on.conCho', { n: conCho }) }}</span>
        <button
          v-if="o.isHost.value && o.room.value?.status === 'lobby'" class="them-may thach th-nho th-tim" type="button"
          @click="sfx.select(); o.themMay()"
        ><Plus :size="15" :stroke-width="2.8" /> {{ t('on.themMay') }}</button>
        <!-- Mời người đang online (lib/sanh.ts) — số = người đang rảnh có thể mời -->
        <button
          v-if="coTheMoi && dsMoi !== null" class="them-may moi-online thach th-nho th-xanh" type="button"
          @click="sfx.select(); moMoiOnline = true"
        ><i class="song" aria-hidden="true" /><span class="chu">{{ t('moi.nut') }}</span><b v-if="soMoiDuoc" class="so">{{ soMoiDuoc > 9 ? '9+' : soMoiDuoc }}</b></button>
      </li>
    </ul>

    <template v-if="o.isHost.value">
      <!-- KIỂU CHƠI (27.11.2026, mockup duyệt https://claude.ai/artifact/5rwkt1SVgamVqoED4nEWz6 màn ①): cùng hàng hai viên như
           màn Chơi nhanh / Đấu với máy. Tìm Thẻ: số thẻ + độ khó do cả phòng biểu quyết lúc Bắt đầu, dòng Bàn chỉ còn Bộ thẻ. -->
      <!-- KHU CÀI ĐẶT VÁN tách khỏi khu người chơi bằng vạch + nhãn (27.11.2026, chủ dự án: "chỗ chọn loại chơi với cấu hình
           sát nhau quá… tách riêng khu vực người chơi ra cho nó gọn") -->
      <div class="cai-van">
      <div v-if="hienTim" class="ds-dau"><span>{{ t('menu.kieuChoi') }}</span></div>
      <span v-if="hienTim" class="kieu-seg" role="radiogroup" :aria-label="t('menu.kieuChoi')">
        <button v-for="k in (['thuong', 'tim'] as const)" :key="k" class="nut-kieu thach th-nho th-chon" type="button" role="radio" :aria-checked="(k === 'tim') === laTimPhong" @click="doiKieuPhong(k)">
          {{ k === 'tim' ? t('tt.ten') : t('menu.kieu.thuong') }}
        </button>
      </span>
      <!-- Một dòng "Bàn: 12 thẻ (Dễ) — bộ · luật — Đổi ›" (17.11.2026) thay tóm tắt + nút Chỉnh + chip -->
      <button class="nh-dong ban-dong thach" type="button" @click="openCfgWizard">
        <span class="nh-hinh" aria-hidden="true"><img v-for="h in hinhBan" :key="h" :src="h" alt=""></span>
        <span class="nh-chu">
          <strong>{{ laTimPhong ? `${t('tt.ten')} · ${t('tt.the', { n: timSoTheHop(o.room.value?.config.timSoThe) ?? TIM_THE_ONLINE_SO_THE })}` : t('on.ban', { n: cardCount }) }}</strong>
          <small>{{ laTimPhong ? `${td(`tt.${o.room.value?.config.timDoKho ?? 'vua'}`)} · ${boBan}` : `${boBan} · ${luatBan}` }}</small>
        </span>
        <span class="nh-sua">{{ t('menu.nhanh.doi') }} ›</span>
      </button>
      </div>
      <!-- Chưa đủ sẵn sàng: nút XÁM XANH vẫn bấm được (→ bảng Nhắc); đủ: XANH LÁ sáng (mockup duyệt 19.11.2026) -->
      <button
        class="btn-primary nut-bat-dau" type="button"
        :class="{ dangMo: dangMoVan, 'cho-nguoi': coTheBam && !canStart, sang: canStart && !dangMoVan }"
        :disabled="!coTheBam || dangMoVan"
        @click="bamBatDau()"
      ><span v-if="dangMoVan" class="quay" aria-hidden="true" />{{ dangMoVan ? t('on.dangMoVan') : startLabel }}</button>
    </template>
    <template v-else>
      <!-- Bàn chơi ĐỌC TRƯỚC KHI BẤM: đây là thứ người ta cần biết để quyết
           định có sẵn sàng hay không, nên nó phải nằm TRÊN nút. Ở dưới thì đọc
           xong mới thấy, mà lúc đó đã bấm rồi. -->
      <div v-if="!laTimPhong && optionChips(o.room.value?.config).length" class="cfg-chips">
        <span v-for="c in optionChips(o.room.value?.config)" :key="c.key" class="cfg-chip">
          <OptionIcon :name="c.icon" :size="17" />{{ c.text }}
        </span>
      </div>
      <p class="hint">
        {{ laTimPhong ? `${t('tt.ten')} · ${t('tt.the', { n: timSoTheHop(o.room.value?.config.timSoThe) ?? TIM_THE_ONLINE_SO_THE })} · ${td(`tt.${o.room.value?.config.timDoKho ?? 'vua'}`)}` : t('on.soThe', { n: cardCount }) }} · {{ themeSummary(o.room.value?.config.themeIds ?? []) }}
        — {{ t('on.choChuPhong') }}
      </p>
      <!-- NGƯỜI XEM Ở PHÒNG CHỜ (23.11.2026): giữ vai xem, tự bấm mới thành người chơi — không còn tự bị kéo vào ghế trống -->
      <template v-if="o.spectator.value">
        <div class="the-san the-xem" role="status">
          <span class="the-tick" aria-hidden="true"><BongNgo :size="28" /></span>
          <span><b>{{ t('on.banDangXem') }}</b><small>{{ conCho > 0 ? t('on.banDangXemNho') : t('on.hetCho') }}</small></span>
        </div>
        <button v-if="conCho > 0" class="btn-primary nut-san" type="button" @click="sfx.select(); o.vaoChoi()">{{ t('on.vaoChoi') }}</button>
      </template>
      <!-- ĐÃ SẴN SÀNG: thẻ trạng thái xanh lá + nút nhỏ "Huỷ sẵn sàng" RIÊNG — bản cũ gộp vào nút lớn
           ("Đã sẵn sàng — bấm để huỷ") nên dễ lỡ tay huỷ (mockup duyệt 19.11.2026). -->
      <template v-else-if="meReady">
        <div class="the-san" role="status">
          <span class="the-tick" aria-hidden="true"><Check :size="26" :stroke-width="3.4" /></span>
          <span><b>{{ t('on.banDaSan') }}</b><small>{{ readyCount.ok === readyCount.need ? t('on.duChoChu', { ten: tenChu }) : t('on.choChuSan', { ten: tenChu, ok: readyCount.ok, need: readyCount.need }) }}</small></span>
        </div>
        <div class="hang-nho">
          <button class="huy-san thach th-nho" type="button" @click="o.setReady(false)">{{ t('on.huySan') }}</button>
          <button class="huy-san chi-xem thach th-nho" type="button" @click="sfx.select(); o.chuyenXem()"><BongNgo :size="17" aria-hidden="true" />{{ t('on.chiXem') }}</button>
        </div>
      </template>
      <!-- CHƯA SẴN SÀNG: nút VÀNG CAM (việc cần làm) — nhịp sáng khi chủ phòng vừa nhắc -->
      <template v-else>
        <p v-if="tenChu" class="cho-ban">{{ t('on.dangChoBan', { ten: tenChu }) }}</p>
        <button class="btn-primary th-vang nut-san" :class="{ nhay: nutNhay }" type="button" @click="o.setReady(true)">
          <Hand :size="20" :stroke-width="2.6" aria-hidden="true" class="ic-san" /> {{ t('on.sanSangNut') }}
        </button>
        <!-- CHỈ XEM (23.11.2026): trả ghế, ở lại phòng làm người xem — ván bắt đầu không cần chờ mình sẵn sàng -->
        <button class="huy-san chi-xem thach th-nho" type="button" @click="sfx.select(); o.chuyenXem()"><BongNgo :size="17" aria-hidden="true" />{{ t('on.chiXem') }}</button>
      </template>
    </template>
    <!-- Chat ngay ở phòng chờ: lúc ngồi đợi nhau mới là lúc cần nói chuyện
         nhất. Server không hề chặn emoji theo trạng thái phòng, nên đây chỉ là
         chuyện thêm giao diện. -->
    <EmojiDock :o="o" />
    <div class="eb-cho" aria-hidden="true" />
    <p v-if="o.error.value" class="warn" role="alert">{{ o.error.value }}</p>
    <button v-if="o.canCapNhat.value" class="nut-cap-nhat thach th-tim" type="button" @click="capNhatNgay">{{ t('chung.capNhat') }}</button>
  </section>

  <!-- TRONG VÁN — xem OnlineGame.vue (nó tự mount EmojiBlast) -->
  <!-- TÌM THẺ ONLINE: màn riêng (server gửi `t:'tim'`), cùng chỗ với OnlineGame -->
  <OnlineTimThe v-else-if="laTimPhong && (!wizard || o.phase.value === 'ended')" :o="o" @quit="quitVeOnline" @chinh="openCfgWizard" />
  <!-- Không có phòng thì KHÔNG dựng màn ván (tránh màn trống đồng hồ 0:00 khi trạng thái tới muộn sau khi đã rời) -->
  <OnlineGame v-else-if="o.room.value && (!wizard || o.phase.value === 'ended')" :o="o" @quit="quitVeOnline" @chinh="openCfgWizard" />

  <!-- Emoji người kia gửi, cho các màn NGOÀI ván. Teleport ra <body> nên chỉ
       được mount một bản: trong ván đã có bản của OnlineGame. -->
  <EmojiBlast v-if="o.phase.value !== 'playing' && o.phase.value !== 'ended'" :o="o" />
  <LoiNoi v-if="o.phase.value !== 'playing' && o.phase.value !== 'ended'" :o="o" />
  <!-- POPUP CHỌN SỐ THẺ (23.11.2026): server mở lượt chọn khi bấm Bắt đầu / Chơi lại — nổi trên phòng chờ lẫn bảng kết quả -->
  <ChonSoThe :o="o" />

  <!-- Hộp chia sẻ: mã QR + mã 6 số + hai nút copy. Có nút đóng, bấm nền hay
       Esc cũng đóng, và nút Back của trình duyệt đóng nó trước tiên. -->
  <ChiaSeDialog
    v-if="moMoi && o.room.value"
    :code="o.room.value.code" :link="inviteLink" :invite-text="inviteText"
    @close="moMoi = false"
  />

  <!-- DẢI BÁO CHUNG — mọi thông báo về người trong phòng, một chỗ một kiểu (lib/dai-bao.ts) -->
  <DaiBao />
  <MoiOnline
    v-if="moMoiOnline && coTheMoi && dsMoi !== null" :ds="dsMoi" :ma="o.room.value?.code ?? ''" :token="o.layToken()"
    @dong="moMoiOnline = false" @tai-lai="taiDsMoi()"
  />

  <ChonDoi
      v-if="doiDangChon" :players="o.room.value?.players ?? []" :bo-qua="doiDangChon"
      :doi="o.room.value?.players.find((x) => x.id === doiDangChon)?.doiSo"
      @chon="(d) => { if (doiDangChon) o.doiDoi(doiDangChon, d); doiDangChon = null; }"
      @dong="doiDangChon = null"
    />
  <ChonMucMay
      v-if="mayDangChon" :tieu-de="t('on.chonMucMay')"
      :muc="o.room.value?.players.find((x) => x.id === mayDangChon)?.may ?? null"
      @chon="(l) => { if (mayDangChon) o.doiMucMay(mayDangChon, l); mayDangChon = null; }"
      @dong="mayDangChon = null"
    />
    <NhacSanSang v-if="moNhac && o.isHost.value" :chua="chuaSan" :con-giay="conGiayNhac" @nhac="guiNhac()" @dong="moNhac = false" />
    <ConfirmDialog
    v-if="confirm"
    :title="confirm.title" :body="confirm.body" :confirm-label="confirm.label"
    @confirm="xacNhan()"
    @cancel="confirm = null"
  />
    <BaoPhongDong
      v-if="o.phongDong.value" :code="o.phongDong.value.code" :ma="o.phongDong.value.ma"
      @dong="o.phongDong.value = null"
    />
  </div>
</template>

<style scoped>
/* GIỜ VÀNG (28.11.2026) — dải vàng nổi khối như viên thạch, đứng chỗ dòng "N người đang online" */
.dai-gv { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border-radius: 14px; color: #5a2d00;
  background: linear-gradient(#ffe27a, #ffbf2e); border: 2px solid #fff; box-shadow: 0 4px 0 #c98400; }
.dai-gv svg { flex: none; color: #7a3a00; }
.dai-gv b { display: block; font: 800 14px/1.2 var(--font-display, inherit); }
.dai-gv small { display: block; font: 700 12px/1.25 var(--font-body, inherit); opacity: .85; }
.dai-gv .gio { margin-left: auto; flex: none; padding: 2px 8px; border-radius: 9px; background: #fff6d6; font: 800 12.5px var(--font-display, inherit); font-variant-numeric: tabular-nums; white-space: nowrap; }

.online { display: flex; flex-direction: column; height: 100%; position: relative; }
/* "Chỉnh bàn" từ màn kết quả: wizard là LỚP PHỦ, ván + bảng kết quả vẫn sống bên dưới
   (gỡ OnlineGame ra là đóng xong bàn lại diễn lại hiệu ứng kết ván từ đầu). Trên
   bảng kết quả (z 17), dưới hộp xác nhận (z 20). */
.panel.wiz-phu { position: absolute; inset: 0; z-index: 18; margin: 0; }
/* Một dòng nhỏ nổi trên đầu màn — xem chú thích "THÔNG BÁO ĐỔI BÀN" trong script.
   pointer-events: none: nó không được che nút nào trong 6 giây nó hiện. */
.doi-ban-toast {
  position: fixed; z-index: 25; left: 50%; top: calc(62px + env(safe-area-inset-top, 0px));
  transform: translateX(-50%); max-width: calc(100% - 32px); width: max-content;
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 14px;
  border-radius: var(--r-full); pointer-events: none;
  background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
  border: 2px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  box-shadow: 0 8px 28px rgba(0, 0, 0, .25); backdrop-filter: blur(6px);
  font-family: var(--font-display); font-weight: 700; font-size: 14.5px; line-height: 1.25; color: var(--fg);
}
.doi-ban-toast svg { flex: none; color: var(--accent); }
.doi-ban-enter-active, .doi-ban-leave-active { transition: opacity .25s ease, transform .25s ease; }
.doi-ban-enter-from, .doi-ban-leave-to { opacity: 0; transform: translate(-50%, -8px); }
/* ---------- DANH SÁCH PHÒNG CÔNG KHAI (ON-10) ---------- */

/* `.btn-primary` toàn cục KHÔNG phải flex — chữ nằm theo dòng bình thường.
   Nút này là nút primary duy nhất có icon, mà SVG inline thì canh theo baseline
   của chữ nên dấu + tụt xuống lệch hẳn. Cho riêng nút này thành flex. */
.tao-phong {
  margin-top: 0;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.list-head { display: flex; align-items: center; gap: 8px; margin: 18px 0 10px; }
/* Nhóm ĐANG CHƠI — vào xem (19.11.2026) */
.xem-head { margin-top: 22px; }
.room.dang-choi .live { color: #c8102e; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; }
.cham-do { width: 8px; height: 8px; border-radius: 50%; background: #e5243b; display: inline-block; animation: cham-nhay 1.6s ease-in-out infinite; }
@keyframes cham-nhay { 50% { opacity: .35; } }
.nut-xem { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 14px; font: 800 15px var(--font-display); }
@media (prefers-reduced-motion: reduce) { .cham-do { animation: none; } }
.list-head h3 { flex: 1; margin: 0; font-family: var(--font-display); font-size: var(--text-md); }
.list-head .chuong {
  display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px;
  border-radius: var(--r-full); border: 2px solid var(--line); background: var(--panel-solid);
  font-family: var(--font-display); font-weight: 700; font-size: var(--text-xs); color: var(--muted);
  position: relative; cursor: pointer; flex: none; white-space: nowrap;
}
/* Chữ nút dài (de, ru) thì TIÊU ĐỀ nhường chỗ, không xuống dòng làm cao hàng */
.list-head h3 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Vùng chạm 44px mà không phình nút (luật "Vùng chạm ≠ HÌNH của nút") */
.list-head .chuong::after { content: ''; position: absolute; inset: -5px -2px; }
.list-head .chuong.bat { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: var(--accent-soft); }
.list-head .chuong:disabled { opacity: .6; }
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

/* Nhịp tự làm mới KHÔNG CÒN HIỆN gì trên màn (chủ dự án bỏ vòng tròn đếm ngược
   14.10.2026): danh sách vẫn tự cập nhật mỗi CHU_KY_S giây, phòng mới tự hiện ra. */

/* Danh sách KHÔNG cuộn cả trang (luật KHÔNG SCROLL): tự cuộn BÊN TRONG khi có nhiều phòng.
   CAO VỪA NỘI DUNG (`0 1 auto`), KHÔNG giãn: có hai danh sách (Phòng đang chờ + Đang chơi) mà mỗi cái `flex: 1` thì chúng
   chia đôi chỗ trống → hở một khoảng lớn giữa hai danh sách (chủ dự án gửi ảnh 26.11.2026). Chỗ thừa dồn xuống dưới. */
.rooms {
  flex: 0 1 auto; min-height: 0; overflow-y: auto;
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
  background: var(--chon-nen);
  box-shadow: var(--elev-1), inset 0 1px 0 rgba(255, 255, 255, .32);
}
/* Chủ phòng có màu hồ sơ: chính ô này tô màu đó (không chồng thêm ô ::before của `.vong-mau`) */
.room .av.vong-mau { background: var(--m); box-shadow: none; }
.room .av.vong-mau::before { display: none; }
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

/* Ô "chưa có phòng nào đang chờ" GỌN MỘT DẢI (26.11.2026, chủ dự án: "chỗ phòng chờ trống kia tốn diện tích quá, cho nó bé lại"):
   trước là khối dọc cao ~360px (biểu tượng 74px, chữ giữa, `flex: 1` kéo giãn) đẩy danh sách "Đang chơi — vào xem" xuống
   dưới màn. Nay biểu tượng nhỏ bên trái, tiêu đề + một dòng chữ bên phải, cao theo nội dung. */
.empty {
  display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 12px; row-gap: 2px;
  padding: 10px 14px; text-align: left;
  border: 2px dashed var(--line-strong); border-radius: var(--r-md); background: var(--panel-soft);
}
.empty .art {
  grid-row: 1 / span 2;
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 14px; color: var(--chon-chu);
  background: var(--chon-nen);
  /* Ô THẠCH NỔI KHỐI: đế dày tối hơn ở đáy + vệt sáng trên (phong cách 3D, 18.10.2026) — thu theo cỡ ô */
  /* --b3 = màu đế của thạch vàng (keo-thach.css, có nhờ lớp th-vang) */
  box-shadow: 0 4px 0 var(--b3, rgba(0, 0, 0, .2)), inset 0 2px 0 rgba(255, 255, 255, .55), inset 0 -3px 0 rgba(0, 0, 0, .1);
  margin-bottom: 4px;
}
.empty .art img { width: 30px; height: 30px; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .25)); }
.empty .art svg { width: 24px; height: 24px; }
.empty h4 { margin: 0; align-self: end; font-family: var(--font-display); font-size: var(--text-md, 16px); line-height: 1.2; }
.empty p { margin: 0; align-self: start; color: var(--muted); font-size: var(--text-sm); line-height: 1.35; }
/* trạng thái lỗi có nút "Thử lại": nút xuống dòng riêng, chạy hết bề ngang phần chữ */
.empty .btn { grid-column: 2; justify-self: start; margin-top: 6px; }

.link-row {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  width: 100%; min-height: 44px; margin-top: 14px; padding-top: 13px;
  border: 0; border-top: 1px solid var(--line); background: none;
  color: var(--accent); font: inherit; font-size: var(--text-sm); font-weight: 700;
}
/* Kẹo: "Nhập mã phòng" là phím thạch (1.5.5) — bỏ kiểu link (kẻ trên + đệm trên lệch) và bo góc,
   không thì góc VUÔNG, chữ lệch xuống (chủ dự án báo 13.11.2026). */
:root[data-skin='keo'] .link-row { padding: 0 14px; border-radius: 14px; }
/* Danh sách phòng giờ cao vừa nội dung (`.rooms`) → chỗ thừa dồn vào TRÊN nút này, nút vẫn nằm đáy khung như trước */
.panel > .link-row { margin-top: auto; }
.rooms { padding-bottom: 4px; }   /* chừa chỗ cho đế thạch của dòng cuối khi danh sách tự cuộn */

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
/* Lưới theme: CSS chung ở `styles/theme-grid.css`, đừng viết lại ở đây. */
.options.wiz-grids .option { padding: 6px 4px; gap: 2px; }
.options.wiz-grids strong { font-size: clamp(15.5px, 19cqw, 24px); }
.options.wiz-grids small, .theme-opt small { font-size: clamp(11.5px, 12cqw, 14px); }
/* Tên theme: MỘT dòng duy nhất, cỡ chữ co theo bề rộng ô (container query)
   — không bao giờ cắt mất từ như line-clamp trong ô grid nén */
.hint-multi { margin: 0 0 12px; color: var(--muted); font-size: var(--text-sm); }
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

/* ---------- ĐẦU PHÒNG GỌN (14.11.2026) ----------
 * Thay "dải mỏng" mã + hai chip: tiêu đề "Phòng <mã>", chip Công khai nhỏ ngay dưới, MỘT nút Mời
 * bên phải. Tiết kiệm một hàng (~50px) để 4 dòng người chơi + ô chỗ trống vừa khung.
 */
.dau-phong { margin-bottom: 8px; }
.on-so-ol { display: flex; align-items: center; gap: 7px; margin: -2px 2px 10px; font: 800 13.5px var(--font-body); color: var(--muted); }
.on-so-ol i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #2fb85f; box-shadow: 0 0 0 3px rgba(47, 184, 95, .25); }
.td-vao { text-align: center; }
.td-vao h2 { margin: 18px 0 14px; font: 800 20px var(--font-display); }
.td-vao-ds { list-style: none; margin: 0 0 18px; padding: 0; display: flex; justify-content: center; gap: 18px; }
.td-vao-ds li { display: grid; justify-items: center; gap: 4px; min-width: 0; }
.td-vao-ds .avatar { width: 56px; height: 56px; font-size: 34px; display: grid; place-items: center; }
.td-vao-ds b { max-width: 96px; font: 800 13px var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-chu { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.dp-chu h2 { flex: none; font-variant-numeric: tabular-nums; }
.ck-nho {
  position: relative; display: inline-flex; align-items: center; gap: 4px;
  min-height: 0; min-width: 0; height: 24px; padding: 0 9px;
  font-size: var(--text-xs); font-weight: 700;
}
/* Vùng chạm 44px mà chip vẫn 24px (NF-07) */
.ck-nho::after { content: ''; position: absolute; inset: -10px -4px; }
/* Khách: vẫn ĐỌC được trạng thái, chỉ không bấm được */
.ck-nho.doc { opacity: .85; }
.ck-nho:disabled { cursor: default; }
.moi-nut {
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  min-height: 38px; padding: 0 12px; position: relative;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
}
.moi-nut::after { content: ''; position: absolute; inset: -3px 0; }
/* Đầu danh sách: "Người chơi 3/4" + Thường/Đồng đội */
.ds-dau {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 2px 6px;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm); color: var(--muted);
}
/* Vạch màu bên trái CHỈ khi đội có từ 2 người — nhìn là biết ai chung đội với ai */
.lobby-list li.vd-1, .lobby-list li.toi.vd-1 { border-left: 6px solid #ff8a3d; }
.lobby-list li.vd-2, .lobby-list li.toi.vd-2 { border-left: 6px solid #3d9bff; }
.lobby-list li.vd-3, .lobby-list li.toi.vd-3 { border-left: 6px solid #3fbf6b; }
.lobby-list li.vd-4, .lobby-list li.toi.vd-4 { border-left: 6px solid #a66bff; }
.chip-doi {
  position: relative; flex: none; min-height: 30px; min-width: 0; padding: 0 9px;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-xs); white-space: nowrap;
}
.chip-doi::after { content: ''; position: absolute; inset: -7px -2px; }
.chip-doi { min-width: 66px; justify-content: center; }   /* "Đội 1" và "Đội 3" rộng bằng nhau → thẳng cột */
/* Chấm màu đội trước chữ — nền thạch nuốt mất màu viền nên phải có dấu riêng */
.chip-doi::before { content: ''; display: inline-block; width: 9px; height: 9px; margin-right: 5px; border-radius: 50%; background: var(--mau); }
.chip-doi.d-1 { --mau: #ff8a3d; } .chip-doi.d-2 { --mau: #3d9bff; }
.chip-doi.d-3 { --mau: #3fbf6b; } .chip-doi.d-4 { --mau: #a66bff; }
.chip-doi:disabled { cursor: default; opacity: 1; }

/* Bung ra khi chạm "Mời bạn" */
.bung { display: flex; gap: 8px; margin: 0 0 8px; }
.bung-btn { flex: 1; gap: 6px; font-size: var(--text-sm); font-weight: 700; }
.bung-btn.primary {
  border: 0; color: var(--nhan-chu);
  background: var(--nhan-nen);
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
/* Tên của mình LÀ nút đổi tên (14.11.2026) — rộng theo chữ, bút nhỏ bên trong */
.nut-sua.ten-toi {
  width: auto; height: 32px; min-width: 0; max-width: 100%; margin-left: 0; padding: 0 8px; gap: 5px;
  color: var(--fg); font-size: inherit;
}
.nut-sua.ten-toi b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nut-sua.ten-toi::after { inset: -6px 0; }
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
  border: 0; border-radius: 50%;
  color: color-mix(in srgb, var(--bad) 70%, var(--muted));
}
.nut-moi-ra::after { content: ''; position: absolute; inset: -9px; }
.cho-moi-ra { flex: none; width: 26px; display: inline-flex; align-items: center; justify-content: center; }
@media (hover: hover) {
  .nut-moi-ra:hover { background: var(--bad-solid); color: #fff; }
}

.lobby-list {
  list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 8px;
  /* Cột = đúng bề ngang khung: cột `auto` nở theo nội dung không xuống dòng (2 nút ở ô trống, 360px) làm mọi dòng lòi ra */
  grid-template-columns: minmax(0, 1fr);
  /* Co được: thêm thanh chat bên dưới thì danh sách nhường chỗ, KHÔNG đẩy nút
     chính ra khỏi màn hình (quy tắc không-scroll). */
  min-height: 0; overflow-y: auto;
}
.lobby-list li {
  /* 46px (14.11.2026): 58px cũ làm 4 dòng không vừa khung — "Thêm máy" bị khuất */
  display: flex; align-items: center; gap: 8px; padding: 4px 10px; min-height: 46px; box-sizing: border-box;
  border: 2px solid var(--line); border-radius: var(--r-md); background: var(--panel-soft);
}
.lobby-list li.off { opacity: .55; }
/* Dòng CỦA MÌNH: tô vàng nhạt — thay chữ "(bạn)" */
.lobby-list li.toi { background: color-mix(in srgb, #ffc83d 16%, var(--panel-soft)); border-color: color-mix(in srgb, #ffc83d 55%, var(--line)); }
.lobby-list li.may { background: color-mix(in srgb, #9b6cf0 10%, var(--panel-soft)); }
.lobby-list li.empty {
  /* `.empty` TRÙNG TÊN với ô "chưa có phòng" của màn danh sách (xếp DỌC, đệm 24px) — phải ghi
     đè về một hàng, không thì ô chỗ trống cao gấp đôi và đẩy "Thêm máy" khuất (lỗi 1.6.0). */
  display: flex; flex: none; flex-direction: row; gap: 8px; padding: 4px 10px;   /* `display` ghi rõ: `.empty` gốc giờ là grid */
  border-style: dashed; color: var(--muted); font-size: var(--text-sm); justify-content: center; text-align: center;
}
.lobby-list .avatar { font-size: 20px; }
/* Máy chơi cùng (1.6.0) */
.lobby-list li.empty:has(.them-may) { justify-content: space-between; padding-block: 6px; }
.them-may {
  display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 12px; position: relative;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
}
.them-may::after { content: ''; position: absolute; inset: -6px 0; }
/* Mời người online (21.11.2026): chấm xanh "đang sống" + số người rảnh */
.lobby-list li.empty:has(.moi-online) {
  /* Có nút mời: chữ "Còn N chỗ" một dòng trên, HAI NÚT chia đôi hàng dưới (đúng mockup A) — bản đầu để flex
     wrap thì "Mời người online" rơi xuống một mình, lệch trái (chủ dự án chụp 21.11.2026) */
  display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 8px; padding-block: 8px;
  /* min-width 0: chữ nowrap của nút KHÔNG được nới cả danh sách (360px từng đẩy mọi dòng lòi khỏi khung) */
  min-width: 0;
}
/* Máy hẹp: bỏ chấm "đang sống" — còn số người là đủ — để chữ "Mời người online" không bị cắt */
@media (max-width: 380px) { .lobby-list li.empty:has(.moi-online) .moi-online .song { display: none; } }
.lobby-list li.empty:has(.moi-online) .cho-chu { grid-column: 1 / -1; order: -2; }
.lobby-list li.empty:has(.moi-online) .them-may { justify-content: center; min-width: 0; white-space: nowrap; }
.lobby-list li.empty:has(.moi-online) .moi-online { order: -1; padding: 0 8px; gap: 5px; }
.lobby-list li.empty:has(.moi-online) .moi-online .chu { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* "Đang mời X…" sau khi thách từ bảng xếp hạng: chữ tím + vạch 20 giây chạy hết */
.cho-chu.dang-thach { display: flex; align-items: center; gap: 6px; min-width: 0; color: #5a48d8; font-weight: 800; }
:global([data-theme='dark'] .cho-chu.dang-thach) { color: #c4b9ff; }
.dang-thach .dt-chu { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-vach { flex: none; width: 54px; height: 4px; border-radius: 4px; margin-left: auto; background: rgba(106, 92, 255, .2); overflow: hidden; }
.dt-vach b { display: block; height: 100%; width: 100%; border-radius: 4px; background: #6a5cff; animation: dt-can linear forwards; }
@keyframes dt-can { to { width: 0; } }
@media (prefers-reduced-motion: reduce) { .dt-vach b { animation: none; } }
.moi-online { gap: 6px; }
.moi-online .song { width: 8px; height: 8px; border-radius: 50%; background: #b8ffcb; box-shadow: 0 0 0 3px rgba(184, 255, 203, .3); flex: none; }
.moi-online .so { font-size: 12px; min-width: 18px; padding: 0 5px; border-radius: 999px; background: rgba(255, 255, 255, .28); text-align: center; }
.lobby-list li:has(.ten-may) { padding-block: 6px; }
.ten-may {
  min-width: 0; min-height: 32px; padding: 0 10px; position: relative;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
}
.ten-may b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ten-may::after { content: ''; position: absolute; inset: -6px 0; }
.lobby-list li > b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lobby-list small { color: var(--muted); font-size: var(--text-xs); }
/*
 * PHÒNG CHỜ RÕ TRẠNG THÁI (19.11.2026, mockup duyệt https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH).
 * Tên + dòng trạng thái dưới tên; dòng đã sẵn sàng viền/nền xanh lá. Màu nút theo trạng thái:
 * chưa sẵn sàng = VÀNG CAM · đã sẵn sàng = thẻ XANH LÁ · chủ phòng còn chờ = XÁM XANH · đủ = XANH LÁ sáng.
 */
.ten-cot { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.ten-cot > b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cot-san {
  flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  font-size: 15px; line-height: 1; border: 2px solid;
}
.cot-san.cs-ok { background: linear-gradient(#8fe06c, #4bb033); border-color: #3c9a26; box-shadow: 0 2px 0 #348a20; font-size: 16px; color: #fff; }
.cot-san.cs-cho { background: #fff3e2; border-color: #f0b46a; color: #d27a12; }
/* Đang chờ: ba chấm nhảy Y HỆT hàng chơi lại cuối ván (ResultDialog .cham) — 20.11.2026 thay ⏳, chủ dự án: "icon chờ hai màn khác nhau" */
.cham { display: flex; gap: 2.5px; }
.cham i { width: 4.5px; height: 4.5px; border-radius: 50%; background: currentColor; animation: cham-nay 1.2s infinite ease-in-out; }
.cham i:nth-child(2) { animation-delay: .15s; }
.cham i:nth-child(3) { animation-delay: .3s; }
@keyframes cham-nay { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .cham i { animation: none; opacity: .8; } }
.cot-san.cs-mang { background: #ffe9e2; border-color: #f19a7c; color: #c2452b; }
/* Màn tối: vòng chờ/mạng không còn mảng kem sáng (21.11.2026, cùng đợt dải báo tối) */
:global([data-theme='dark'] .lobby-list .cot-san.cs-cho) { background: #33290f; border-color: #a9851f; color: #ffcf6b; }
:global([data-theme='dark'] .lobby-list .cot-san.cs-mang) { background: #3a1d17; border-color: #b0563f; color: #ff9f86; }
.ic-san { vertical-align: -4px; }
.cot-san.trong { border: 0; }
.cot-san.nhay { animation: cs-nhay .5s ease-in-out 5; }
@keyframes cs-nhay { 50% { transform: scale(1.35); background: #ffc56b; box-shadow: 0 0 0 5px rgba(240, 160, 50, .35); } }
@media (prefers-reduced-motion: reduce) { .cot-san.nhay { animation: none; background: #ffc56b; } }
.lobby-list li.san {
  background: color-mix(in srgb, #4bb033 13%, var(--panel-soft));
  border-color: color-mix(in srgb, #4bb033 60%, var(--line));
}
.nut-bat-dau { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.15; }
.nut-bat-dau.cho-nguoi { --nhan-nen: #dde5f2; --nhan-chu: #2d3c66; box-shadow: none; }
:root[data-skin='keo'] .nut-bat-dau.cho-nguoi {
  --b1: #f4f7fc; --b2: #dde5f2; --b3: #a9b6d2; --b4: #f4f7fc; --bc: #2d3c66; --th-chu: none;
}
.nut-bat-dau.sang { outline: 5px solid rgba(120, 211, 90, .35); outline-offset: 3px; }
.nut-san { --nhan-nen: linear-gradient(#ffd45c, #f5a823); --nhan-chu: #3b2a00; }
.nut-san.nhay { animation: nut-nhay 1s ease-in-out 4; }
@keyframes nut-nhay { 50% { outline: 6px solid rgba(245, 168, 35, .45); outline-offset: 4px; transform: scale(1.03); } }
.cho-ban { margin: 12px 0 -10px; text-align: center; font-weight: 800; font-size: var(--text-sm); color: #b0560a; }
.the-san {
  margin-top: var(--sp-5); display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 20px;
  background: #e9f8e3; border: 2px solid #7cc65f; box-shadow: 0 5px 0 #9fd487; color: #185c2a;
}
.the-san .the-tick {
  flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(#78d35a, #4bb033); color: #fff; box-shadow: 0 3px 0 #348a20;
}
.the-san b { display: block; font-family: var(--font-display); font-size: 20px; line-height: 1.1; }
.the-san small { display: block; font-size: 13.5px; font-weight: 700; color: #2e6b3c; }
.hang-nho { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.hang-nho .huy-san { margin: 12px 0 0; }
.chi-xem { display: flex; align-items: center; gap: 6px; }
/* Thẻ "Bạn đang xem": cùng khuôn thẻ "Bạn đã sẵn sàng" nhưng màu trời (xem ≠ sẵn sàng) */
.the-xem { background: #e6f1ff; border-color: #7fb0ee; box-shadow: 0 5px 0 #a9c9f2; color: #1c3f73; }
.the-xem .the-tick { background: linear-gradient(#fff, #e8f1ff); box-shadow: 0 3px 0 #9dbfe9; }
.the-xem small { color: #2f568f; }
:global([data-theme='dark'] .the-xem) { background: #1b2c52; border-color: #4f78c2; box-shadow: 0 5px 0 #0f1b38; color: #dbe8ff; }
:global([data-theme='dark'] .the-xem small) { color: #a9c3f0; }
:global([data-theme='dark'] .the-xem .the-tick) { background: linear-gradient(#34508c, #263d70); box-shadow: 0 3px 0 #162446; }
.huy-san { display: block; margin: 12px auto 0; min-height: 40px; padding: 0 18px; font: 700 15px var(--font-display); border-radius: 14px; }
@media (prefers-reduced-motion: reduce) { .nut-san.nhay { animation: none; outline: 5px solid rgba(245, 168, 35, .45); } }
.hint { color: var(--muted); font-size: var(--text-sm); margin: 14px 0 0; }
/* Thanh chat lobby: dán xuống đáy panel (margin-top: auto) để nó không chen vào
   giữa danh sách người chơi và nút chính. KHÔNG SCROLL: nó chỉ cao 40px và
   .lobby-list được phép co lại, nên nút "Bắt đầu" vẫn nằm trong màn hình. */
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
/* Nút ở NGOÀI khung hàng, hàng cuộn trong `.opt-rows` khi thiếu chỗ; màn thấp thu gọn —
   lý do và số đo ở MenuScreen (khối "BẢNG TUỲ CHỌN BÀN CHƠI"). */
.opt-list { display: flex; flex-direction: column; gap: 7px; min-height: 0; }
.opt-rows {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 7px; scrollbar-width: none;
  /* chỗ cho bóng nút đang chọn ở hàng cuối — khung cuộn cắt mọi thứ tràn ra */
  padding-bottom: 10px; margin-bottom: -10px;
}
.opt-rows::-webkit-scrollbar { display: none; }
.opt-list > .btn-primary { flex: none; }
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
  background: var(--chon-nen);
  border-color: transparent; color: var(--chon-chu);
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
/* Bảng tuỳ chọn trên màn THẤP (iPhone SE) — ĐỨNG CUỐI file để thắng luật gốc cùng độ đặc hiệu */
@media (max-height: 620px) {
  .opt-list, .opt-rows { gap: 5px; }
  .opt-row { padding: 3px 9px 4px; }
  .opt-head { margin-bottom: 2px; }
  .opt-head .opt-ico { width: 20px; height: 20px; }
  .opt-name { font-size: var(--text-sm); }
  .seg-btn { height: 26px; min-height: 26px; }   /* vùng chạm vẫn 42px nhờ ::after */
}
.nut-cap-nhat { display: block; margin: 8px auto 0; min-height: 44px; padding: 0 22px; font-weight: 800; }
/* Hàng KIỂU CHƠI ở phòng chờ — cùng chất hàng ở màn Chơi nhanh (MenuScreen `.kieu-seg`) */
.kieu-seg {
  flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 999px;
  background: var(--k-mem, var(--panel-soft)); border: 2px solid var(--t3, var(--line)); box-shadow: inset 0 2px 4px rgba(29, 42, 90, .14);
}
.nut-kieu { position: relative; min-height: 42px; border: 1.5px solid transparent; border-radius: 999px; background: none; color: var(--fg); font-family: var(--font-display); font-size: 16px; font-weight: 800; cursor: pointer; }
.cai-van {
  flex: none; display: flex; flex-direction: column; gap: 12px;
  margin-top: 6px; padding-top: 14px; border-top: 2px solid color-mix(in srgb, var(--line) 80%, transparent);
}
.cai-van .ds-dau { margin: 0 0 -4px; }
/* Màn thấp (iPhone SE) đủ 4 người: phòng chờ KHÔNG được cuộn — bỏ nhãn, gọn khoảng cách, viên thấp hơn */
@media (max-height: 700px) {
  .cai-van { gap: 7px; margin-top: 0; padding-top: 8px; }
  .cai-van .ds-dau { display: none; }
  .cai-van .nut-kieu { min-height: 36px; }
  .lobby-list { gap: 5px; }
  .lobby-list li { padding: 1px 10px; min-height: 42px; }
}
</style>
