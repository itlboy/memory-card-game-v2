<script setup lang="ts">
import { dichGoiYTuyChon } from '@/lib/goi-y-tuy-chon';
import { anhEmoji } from '@/lib/emoji';
import { tn } from '@/lib/nen-fb';
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
// dichGoiYTuyChon: lib/goi-y-tuy-chon.ts (dùng chung với OnlineScreen)
import { BOARD_SIZES, BOT_SPECS, CAMPAIGN_LEVELS, LEVEL_KEYS, OPTION_KEYS, OPTION_LABELS, campaignSpec, levelSpec, optionSummary } from '@mm/engine';
import { Bot, ChartColumn, ChevronLeft, Crown, Flame, Globe, Map, Play, Target, Users, X } from 'lucide-vue-next';
import { dangDebug } from '@/lib/debug';
/** Tìm Thẻ hiện trong luồng chơi khi đã mở cho mọi người, hoặc với người đang bật DEBUG (chủ dự án 26.11.2026:
 *  "chỉ có debuger mới chơi được", "ghép vào trong màn chơi luôn" — không chơi riêng ở trang Debug). */
const hienTim = computed(() => TIM_THE_MO || dangDebug.value);
/** Bước Thể loại chỉ còn cho Mưa Thẻ. Tìm Thẻ chọn NGAY TRONG màn Chơi nhanh / Đấu với máy (hàng Kiểu chơi,
 *  27.11.2026 — chủ dự án: "trong setup màn thì cho chọn loại thay vì cho hẳn đường đi khác bên ngoài"). */
const coKieu = computed(() => MUA_THE_MO);
import { chiNutPremium, conQuaTang, daMuaPremium, goiDangCo, hienVienPremium, moPremium, ngayConLai, xongChiNutPremium } from '@/lib/premium';
import KhungBong from './KhungBong.vue';
import { anGoiYApp, storeGoiY, tatGoiYApp } from '@/lib/goi-y-app';
import { moChucNang, suKien } from '@/lib/phan-tich';
import type { BoardOptions, BotLevel, Mode, OptLevel, OptionKey } from '@mm/engine';
import { computed, ref, watch } from 'vue';
import MatBot from './MatBot.vue';
import ChonMucMay from './ChonMucMay.vue';
import Sao3D from './Sao3D.vue';
import { dangLuiBack, useBackCloser } from '@/composables/useBackGuard';
import { ghiQuery } from '@/lib/appUrl';
import { sfx } from '@/lib/audio';
import { skin } from '@/lib/skin';
/** #app có thật mới gắn nút mặt trời (test dựng component trần, không có #app → Teleport hỏng). */
const coKhungApp = typeof document !== 'undefined' && !!document.getElementById('app');
import type { CardTheme } from '@/lib/themes';
import { store } from '@/lib/storage';
import { clock } from '@/lib/format';
import { chiSoHomNay, hienTriNho, phienTriNho, tienDoCoDiem, vanConThieu } from '@/lib/tri-nho';
import LevelMap from './LevelMap.vue';
import LevelMapTim from './LevelMapTim.vue';
import { docKieuCD, luuKieuCD, moToiTim } from '@/lib/chien-dich-tim';
import SizeGrid from './SizeGrid.vue';
import ThemePicker from './ThemePicker.vue';
import QuatLa from './QuatLa.vue';
import OptionIcon from './OptionIcon.vue';
import BanChon from './BanChon.vue';
import type { IconName } from './OptionIcon.vue';
import { MUA_THE_MO } from '@/lib/mua-the';
import { TIM_THE_MO, docChon, docKieu, luuChon, luuKieu, type KieuChoi, type TimTheChon } from '@/lib/tim-the';
import ChonTimThe from './ChonTimThe.vue';
import { nhanSoPhong, soPhongXem, useSoPhongCho } from '@/lib/so-phong-cho';
import { soNguoiOnline } from '@/lib/sanh';
import { ICON_LUAT, moTaLuat, tenLuatMan } from '@/lib/luat-man';

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
  /** Máy chơi cùng ở ván nhiều người: chỗ i là máy mức nào (null = người). Chỗ 0 luôn người. */
  mayCung?: (BotLevel | null)[];
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
  'update:mayCung': [(BotLevel | null)[]];
  'start-level': [number];
  'mua-the': [];
  'tim-the': [];
  /** Chiến dịch Tìm Thẻ: vào màn `id` (App mở TimThe với màn đó). */
  'tim-man': [id: number];
  'update:options': [BoardOptions];
  online: [];
  'chinh-phuc': [string];
  /** Mở Sổ trí nhớ (thử nghiệm — viên chỉ hiện khi debug bật). */
  'so-tri-nho': [];
  /** Chạm mặt trời/trăng ở trang chủ — tính năng ẨN đổi sáng ↔ tối (18.10.2026). */
  'doi-nen': [];
}>();
/** Số phòng công khai đang chờ — chấm trên ô Online (lib/so-phong-cho.ts). */
const soPhongCho = useSoPhongCho();

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
/** Chữ trên viên Premium: còn quà → "1 tháng miễn phí" · có gói có hạn → "Còn N ngày" · có Premium không hạn → "Đang dùng" · hết quà chưa mua → "Nâng cấp". */
/** NHẮC trước khi hết quà (bảng Premium hứa "nhắc bạn trước khi hết quà", 26.11.2026): quà còn ≤ 3 ngày thì viên Premium đeo
 * chấm đỏ, chữ "Còn N ngày" — chấm đỏ cũng là thứ đã mời nhận quà, người chơi quen bấm vào. */
const sapHetQua = computed(() => !!goiDangCo.value?.tang && ngayConLai() > 0 && ngayConLai() <= 3);
const chuVienPremium = computed(() => {
  if (conQuaTang.value) return t('pm.vien.tang');
  if (!daMuaPremium.value) return t('pm.nangCap');
  const n = goiDangCo.value ? ngayConLai() : 0;
  return n > 0 ? t('pm.vien.con', { n }) : t('pm.vien.dangCo');
});
/** Nút Chỉ số trí nhớ ở trang chủ: điểm + bậc + tiến độ, và có gì MỚI so với lần xem cuối không. */
/* Soi sáng viên Premium: đo chỗ viên đang nằm (tính theo #app vì lớp soi Teleport vào đó) */
const vienPmEl = ref<HTMLElement | null>(null);
const coApp = typeof document !== 'undefined' && !!document.getElementById('app');
const khungPm = ref<{ x: number; y: number; w: number; h: number; phai: number; duoi: number; tren: number; duoiVien: boolean; vt: number } | null>(null);
const BONG_W = 260;
function doKhungPm(): void {
  const el = vienPmEl.value, app = document.getElementById('app');
  if (!el || !app) { khungPm.value = null; return; }
  const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
  const phai = Math.max(12, a.right - r.right);
  const traiBong = a.width - phai - Math.min(BONG_W, a.width - 24);
  // Trên viên không đủ chỗ cho bong bóng (máy xoay ngang, màn thấp) → đặt bong bóng DƯỚI viên, đuôi chỉ lên
  const duoiVien = r.top - a.top < 190;
  khungPm.value = { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, phai, duoi: a.bottom - r.top, tren: r.bottom - a.top, duoiVien, vt: Math.round(r.left - a.left + r.width * 0.72 - traiBong) };
}
watch(chiNutPremium, (c) => { if (c) { moChucNang('premium_chi_nut_hien'); requestAnimationFrame(doKhungPm); } }, { immediate: true });
function xongChi(): void { moChucNang('premium_chi_nut_xong'); xongChiNutPremium(); }
/** Chu vi vòng tiến độ quanh huy chương (r = 21). */
const VONG = 2 * Math.PI * 21;
const tnNut = computed(() => {
  void phienTriNho.value;   // nhật ký ở localStorage không tự phản ứng — ghi ván / mở màn chỉ số là tăng số này
  if (!hienTriNho.value) return null;
  const k = chiSoHomNay();
  const xem = store.prefs().triNhoXem;
  const moi = k.diem !== null && xem !== k.diem;
  return {
    diem: k.diem, bac: k.bac, moi, conVan: vanConThieu(k), nhom: k.duNhom,
    // Viền: có điểm = đã đi bao nhiêu % của bậc; chưa có = số liệu đã gom so với mốc
    pt: Math.round((k.diem === null ? tienDoCoDiem(k) : k.tienBac) * 100),
    lech: moi && xem !== undefined ? k.diem! - xem : 0,
    nhan: k.diem === null ? t('tn.ten') : `${t('tn.ten')}: ${k.diem}`
  };
});

type Step = 'players' | 'kieu' | 'bot' | 'count' | 'nhanh' | 'names' | 'level' | 'theme' | 'options';
const STEPS: readonly Step[] = ['players', 'kieu', 'bot', 'count', 'nhanh', 'names', 'level', 'theme', 'options'];
/**
 * CHƠI NHANH MỘT MÀN (16.11.2026, mockup duyệt https://claude.ai/artifact/VXsNaR3xGo9fgPBqQAAoy1).
 * Bản cũ đi 4 bước (số người → số thẻ → theme → bàn chơi) và GA4 thấy rơi một nửa người ở giữa,
 * trong khi theme và bàn chơi để mặc định hầu như không ai đổi. Nay bước `nhanh` gom hết vào một
 * màn có nút Bắt đầu; tên, lưới 12 cỡ bàn, theme và bàn chơi thành BƯỚC PHỤ mở từ đó và quay về đó.
 */
const BUOC_PHU: readonly Step[] = ['names', 'level', 'theme', 'options'];

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
  // "Chơi nhanh": (Thể loại nếu Mưa Thẻ mở — lib/mua-the.ts) → màn `nhanh`, cộng bước phụ đang mở.
  // Bước phụ lấy theo `step` HOẶC `buocHien`: lúc đang rời bước phụ về `nhanh`, phần đầu vẫn vẽ bước
  // phụ thêm một nhịp — bỏ nó khỏi path sớm là nút quay lại nháy mất.
  const kieu: Step[] = coKieu.value ? ['kieu'] : [];
  // Đấu máy cũng qua Thể loại khi có Tìm Thẻ (Mưa Thẻ không có máy nên trước đây không cần)
  const goc: Step[] = props.botLevel ? ['players', 'bot'] : ['players', ...kieu, 'nhanh'];
  const phu = BUOC_PHU.includes(step.value) ? step.value : BUOC_PHU.includes(buocHien.value) ? buocHien.value : null;
  return phu ? [...goc, phu] : goc;
});
/** Đang ở nhánh Chơi nhanh (không Chiến dịch, không đấu máy) — bước phụ quay về màn `nhanh`. */
const laNhanh = computed(() => props.mode !== 'campaign');
/** Màn một-trang mà bước phụ quay về: `bot` (đấu máy) hoặc `nhanh` (chơi nhanh). */
const veMan = computed<Step>(() => (props.botLevel ? 'bot' : 'nhanh'));
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
/** PHÂN TÍCH (13.11.2026): mỗi bước menu được vào một lần là một sự kiện — xếp theo bước là ra PHỄU,
 *  thấy người chơi bỏ đi ở bước nào. `nhanh` = đang đi đường nào (chiến dịch · đấu máy · chơi nhanh). */
watch(step, (b) => {
  suKien('buoc_menu', {
    buoc: b,
    // Trang chủ là bước CHUNG — trước 16.11.2026 nó bị tính vào 'choi_nhanh' nên phễu Chơi nhanh phồng ra
    nhanh: b === 'players' ? 'trang_chu' : props.mode === 'campaign' ? 'chien_dich' : props.botLevel ? 'dau_may' : 'choi_nhanh',
    so_nguoi: props.playerCount
  });
}, { immediate: true, flush: 'post' });   // post: đợi mode/botLevel vừa emit về tới props
const hienIndex = computed(() => path.value.indexOf(buocHien.value));
let dangRoi = false;
/**
 * KHUNG MỜ CÙNG NỘI DUNG khi đi VỀ / RA KHỎI trang chủ (28.10.2026, chủ dự án: "back ra trang chủ bị nháy").
 * Trang chủ không có khung trắng, các bước thì có — bản trước chỉ mờ THÂN bước, còn khung trắng thì
 * biến mất / bật ra ĐỘT NGỘT đúng khung hình đổi bước (đo từng khung bằng WebKit). Nay cả khung mờ đi
 * theo nhịp rời (.12s) rồi hiện lại theo nhịp vào (.18s). Giữa hai bước thường thì khung đứng yên như cũ.
 */
const khungMo = ref<'' | 'roi' | 'vao'>('');
let henKhung: ReturnType<typeof setTimeout> | undefined;
function batDauRoi(): void {
  dangRoi = true;
  if (dangLuiBack.value) return;   // lùi bằng Back/vuốt: đổi ngay, không mờ khung
  if ((buocHien.value === 'players') !== (step.value === 'players')) khungMo.value = 'roi';
}
function xongRoi(): void {
  dangRoi = false; buocHien.value = step.value;
  if (khungMo.value === 'roi') {
    khungMo.value = 'vao';
    clearTimeout(henKhung);
    henKhung = setTimeout(() => { khungMo.value = ''; }, 200);
  }
}
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
  // Rồng thần TÍM (g-pink = thạch tím ở Kẹo): g-red ra đỏ, gần như trùng hồng của Gà cứng (g-amber) — chủ dự án báo 18.10.2026
  { id: 'divine' as BotLevel, g: 'g-pink' }
];

function pickBotMode(): void {
  sfx.select();
  moChucNang('dau_may');
  emit('update:playerCount', 1);
  // Máy + cỡ bàn của ván đấu máy trước (Prefs.dauMay); chưa có thì Gà cứng, bàn "Dễ"
  const cu = store.prefs().dauMay;
  const may = cu && cu.bot in BOT_SPECS ? (cu.bot as BotLevel) : null;
  emit('update:botLevel', props.botLevel ?? may ?? 'normal');
  // Thoát Chiến dịch NGAY TẠI ĐÂY, không đợi tới lúc chọn mức: còn để mode
  // 'campaign' thì `path` là đường của Chiến dịch, không có bước 'bot', nên
  // stepIndex = -1 và nút quay lại biến mất (người chơi báo 13.10.2026).
  if (props.mode === 'campaign') emit('update:mode', 'classic');
  // Cỡ bàn: giữ cỡ đang có nếu hợp lệ (không phải số màn Chiến dịch), không thì bàn "Dễ" như Chơi nhanh
  const lv = cu?.level && coCua(cu.level) ? cu.level
    : props.mode !== 'campaign' && props.level > 1 && coCua(props.level) ? props.level : MUC_NHANH[0]!.level;
  emit('update:level', lv);
  step.value = 'bot';
}

function pickBotLevel(l: BotLevel): void {
  if (l === props.botLevel) return;
  sfx.select();
  emit('update:botLevel', l);
}

/** Chiến dịch: một mình, không bot, và KHÔNG qua bảng tuỳ chọn. */
function pickCampaign(): void {
  sfx.select();
  moChucNang('chien_dich');
  emit('update:mode', 'campaign');
  emit('update:playerCount', 1);
  emit('update:botLevel', null);
  step.value = 'level';
}

/** Ván chơi nhanh gần nhất (Prefs.nhanh) — đọc một lần: MenuScreen dựng lại mỗi lần về menu. */
const nhanhCu = store.prefs().nhanh ?? null;
const coCua = (level: number) => BOARD_SIZES.find((s) => s.level === level);
/** Cỡ bàn mặc định (lần đầu chơi nhanh: 12 thẻ). Chọn cỡ ở dải kéo ngang của BanChon (18.11.2026). */
const MUC_NHANH = ([['de', 6], ['vua', 12], ['kho', 21]] as const).map(([k, pairs]) => ({
  k, pairs, level: BOARD_SIZES.find((s) => s.pairs === pairs)!.level
}));

/** Vào màn Chơi nhanh: dựng lại cỡ bàn + số người của ván trước (Chiến dịch/Đấu máy có thể đã ghi đè). */
function vaoNhanh(): void {
  emit('update:botLevel', null);
  // Chơi nhanh luôn dùng khoá lưu 'classic' — kỷ lục và tiến độ giữ nguyên chỗ
  // cũ, còn luật ván thì do bảng tuỳ chọn quyết định.
  emit('update:mode', 'classic');
  emit('update:playerCount', nhanhCu?.playerCount ?? (props.mode === 'classic' ? props.playerCount : 1));
  // Chưa chơi nhanh lần nào: bàn "Dễ" (12 thẻ). `level` mặc định 1 = bàn 4 thẻ quá nhỏ để làm gợi ý,
  // mà nó còn có thể giữ số màn Chiến dịch — không phải khoá cỡ bàn.
  const lv = nhanhCu?.level ?? (props.level > 1 && coCua(props.level) ? props.level : MUC_NHANH[0]!.level);
  emit('update:level', coCua(lv) ? lv : MUC_NHANH[0]!.level);
  step.value = coKieu.value ? 'kieu' : 'nhanh';
}

/**
 * Ô CHƠI NHANH Ở TRANG CHỦ: LUÔN mở màn `nhanh` (cấu hình + nút Bắt đầu), điền sẵn cỡ bàn + số người
 * của ván nhanh trước (`Prefs.nhanh`). 17.11.2026 chủ dự án bỏ kiểu "vào ván ngay" của 1.8.9 ("vẫn cần
 * một màn để cấu hình và nút start") và bỏ dải "Chơi nhanh: … — Đổi" dưới ba ô ("rối trang chủ").
 */
function pickPlayers(): void {
  sfx.select();
  moChucNang('choi_nhanh');
  vaoNhanh();
}

/* ---------- màn Chơi nhanh ---------- */
function chonSoNguoi(n: number): void {
  if (n === props.playerCount) return;
  sfx.select();
  emit('update:playerCount', n);
  if (n > 1) syncNames(n);
}
function chonCo(level: number, cach: 'cuon' | 'bam' = 'bam'): void {
  if (level === props.level) return;
  // Cuộn dải số thẻ: KHÔNG kêu (chủ dự án 19.11.2026: tiếng chọn "hợp với bấm thôi") — dải đã rung từng ô
  if (cach !== 'cuon') sfx.select();
  emit('update:level', level);
}
function moBuocPhu(b: Step): void {
  sfx.select();
  if (b === 'names') syncNames(props.playerCount);
  step.value = b;
}
/** Tên trên dòng "Tên" — tên đã lưu, trống thì "Người i". */
const tenDangDung = computed(() => {
  const saved = store.playerNames();
  return Array.from({ length: props.playerCount }, (_, i) =>
    (mayO(i) ? tenBot(mayO(i)!) : (names.value[i] || saved[i] || '').trim() || t('menu.nguoiN', { n: i + 1 }))).join(', ');
});
/** Kiểu chơi đang chọn ở màn Chơi nhanh / Đấu với máy — chỉ khi Tìm Thẻ đang hiện, không thì luôn Thường. */
const kieuNho = ref<KieuChoi>(docKieu());
const kieu = computed<KieuChoi>(() => (hienTim.value ? kieuNho.value : 'thuong'));
function chonKieu(k: KieuChoi): void {
  if (k === kieuNho.value) return;
  sfx.select();
  kieuNho.value = k;
  luuKieu(k);
  moChucNang('kieu_choi', { kieu: k, man: props.botLevel ? 'dau_may' : 'choi_nhanh' });
}
/** Số thẻ + độ khó của Tìm Thẻ (đối thủ lấy theo màn: một mình / mức máy đang chọn). */
const timChon = ref<TimTheChon>(docChon());
const laTim = computed(() => kieu.value === 'tim');
/** CHIẾN DỊCH: thanh "Lật cặp | Tìm Thẻ" trên bản đồ (28.11.2026) — nhớ riêng, không dính Kiểu chơi ở Chơi nhanh. */
const kieuCD = ref<KieuChoi>(hienTim.value ? docKieuCD() : 'thuong');
function chonKieuCD(k: KieuChoi): void {
  if (k === kieuCD.value) return;
  sfx.select();
  kieuCD.value = k;
  luuKieuCD(k);
  moChucNang('kieu_choi', { kieu: k, man: 'chien_dich' });
}
const tienDoTim = store.timCD();
const moToiTimCD = moToiTim(tienDoTim);
function choiManTim(id: number): void { sfx.select(); emit('tim-man', id); }
function doiTim(c: TimTheChon): void { timChon.value = c; luuChon(c); }

function batDauNhanh(): void {
  if (laTim.value) {
    luuChon({ ...timChon.value, doiThu: props.botLevel ?? 'mot' });
    emit('tim-the');
    return;
  }
  if (themeTooSmall.value) { moBuocPhu('theme'); return; }
  emit('start-level', props.level);
}

/** Bước THỂ LOẠI của Chơi nhanh: Thường đi tiếp wizard; Mưa Thẻ là màn riêng (App). */
function pickKieu(k: 'thuong' | 'mua'): void {
  sfx.select();
  if (k === 'mua') { emit('mua-the'); return; }
  step.value = props.botLevel ? 'bot' : 'nhanh';
}

function pickCount(n: number): void {
  sfx.select();
  emit('update:playerCount', n);
  if (n < 2) { step.value = 'level'; return; }   // một mình: không có bước tên
  syncNames(n);
  step.value = 'names';
  // (bước `count` không còn trong đường Chơi nhanh từ 16.11.2026 — giữ cho ?w=count cũ không gãy)
}

/** Lối tắt: chơi tiếp chiến dịch ở màn đang mở, khỏi đi qua bản đồ. */
function tiepChienDich(): void {
  sfx.select();
  moChucNang('chien_dich_choi_tiep');
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

/* ---------- máy chơi cùng (14.11.2026, mockup https://claude.ai/artifact/DY6HdqawWBH9uD7ew2gcEB) ---------- */
const mayO = (i: number): BotLevel | null => (i > 0 ? props.mayCung?.[i] ?? null : null);
function datMay(i: number, l: BotLevel | null): void {
  const ds = Array.from({ length: 4 }, (_, k) => props.mayCung?.[k] ?? null);
  ds[i] = l;
  emit('update:mayCung', ds);
}
/** Chỗ đang mở bảng chọn mức (null = đóng). */
const chonMucCho = ref<number | null>(null);
function chuyenLoai(i: number, may: boolean): void {
  sfx.select();
  datMay(i, may ? (mayO(i) ?? 'normal') : null);
}
function chonMuc(l: BotLevel): void {
  if (chonMucCho.value === null) return;
  datMay(chonMucCho.value, l);
  chonMucCho.value = null;
}

/** Tên bỏ trống thì lấy "Người i" — không ép người chơi phải điền. Lưu TRỐNG chứ không lưu "Người i":
 *  lưu chữ mặc định là đổi ngôn ngữ xong nó vẫn hiện tiếng cũ ("Người 1" trong bản English, 16.11.2026). */
function confirmNames(): void {
  store.savePlayerNames(names.value.map((v) => v.trim()));
  names.value = names.value.map((v) => v.trim());
  sfx.select();
  step.value = veMan.value;
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
  step.value = laNhanh.value ? veMan.value : 'options';
}

function pickLevel(id: number): void {
  sfx.select();
  emit('update:level', id);
  step.value = laNhanh.value ? veMan.value : 'theme';
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
  buocHien.value === 'level' && props.mode !== 'campaign' ? t('menu.chonSoThe')
    : buocHien.value === 'bot' ? t('menu.dauMay') : td(`menu.buoc.${buocHien.value}`));

const best = computed(() => store.best(props.mode, props.level));
/** Số cặp mà cấp đang chọn cần — bước theme dùng để cảnh báo thiếu biểu tượng. */
/** Spec của cấp đang chọn. Chiến dịch (màn 1..60) và chế độ thường (khoá cỡ
 *  bàn 1..50) là hai thang — `level` có thể còn giữ số màn Chiến dịch khi người
 *  chơi đổi sang chơi nhanh, nên nhánh thường kẹp về LEVEL_KEYS. */
const spec = computed(() => (props.mode === 'campaign'
  ? campaignSpec(Math.min(props.level, CAMPAIGN_LEVELS))
  : levelSpec(Math.min(props.level, LEVEL_KEYS))));
const pairsNeeded = computed(() => spec.value.pairs);
/** Luật của màn Chiến dịch đang chọn — nói TRƯỚC khi vào ván, như mốc sao (27.10.2026). */
const luatMan = computed(() => (props.mode === 'campaign' && spec.value.luat !== 'tron'
  ? { ten: tenLuatMan(spec.value), moTa: moTaLuat(spec.value), trum: spec.value.luat === 'trum',
      icon: ICON_LUAT[spec.value.cacLuat[0]!] }
  : null));
const VUONG_MIEN = anhEmoji('👑', true, 128);
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

/** Nhãn có TỪ dài (≥10 ký tự, vd. tiếng Nga "компьютера") — ô hẹp thì chữ nhỏ lại thay vì bẻ giữa từ. */
const tuDai = (s: string): boolean => s.split(/[\s-]+/).some((w) => [...w].length >= 10);

const ICO3D = {
  // ⭐ thay 🗺️ (chủ dự án 18.10.2026): bản đồ xanh lá + xanh dương chìm vào ô xanh, lại rối chi tiết;
  // ngôi sao một khối, vàng nổi trên xanh, và khớp sao đánh giá — sao giờ chỉ dành cho Chiến dịch.
  chienDich: anhEmoji('⭐', true, 128) ?? '', choiNhanh: anhEmoji('🚀', true, 128) ?? '',
  // robot TỰ VẼ (public/img/robot.svg) — 🤖 Noto vuông cứng, chủ dự án muốn "đáng yêu hơn"
  dauMay: tn('/img/robot.svg'), online: anhEmoji('🌍', true, 128) ?? '',
  thuong: anhEmoji('🧠', true, 128) ?? '', muaThe: anhEmoji('🌧️', true, 128) ?? ''
};
</script>

<template>
  <!--
    TÍNH NĂNG ẨN (chủ dự án 18.10.2026): chạm MẶT TRỜI / MẶT TRĂNG trên nền Kẹo là đổi sáng ↔ tối.
    Mặt trời/trăng chỉ là ảnh nền (`--canh` của #app) nên đặt một nút VÔ HÌNH trùng tâm — cùng mốc
    `87%` / `--tam-troi` với keo.css (tự đúng cả trong app có vùng an toàn). Chỉ ở TRANG CHỦ: bước
    khác panel phủ lên chỗ đó, nút nằm trên sẽ cướp cú chạm. Teleport ra #app để toạ độ khớp nền.
    `data-nosfx`: chạm KHÔNG kêu, chỉ đổi giao diện (chủ dự án 18.10.2026).
  -->
  <Teleport to="#app" :disabled="!coKhungApp">
    <button
      v-if="coKhungApp && buocHien === 'players' && skin === 'keo'" data-phang data-nosfx class="nut-troi" type="button"
      :aria-label="t('menu.doiNen')" :title="t('menu.doiNen')" @click="emit('doi-nen')"
    />
  </Teleport>
  <section class="panel" :class="{ 'trang-chu': buocHien === 'players', 'khung-roi': khungMo === 'roi', 'khung-vao': khungMo === 'vao' }">
    <header v-if="buocHien !== 'players'" class="wizard-head">
      <button v-if="hienIndex > 0" class="btn back" :aria-label="t('menu.quayLai')" type="button" @click="back"><ChevronLeft :size="22" /></button>
      <h2>{{ tieuDe }}</h2>
      <!-- Chơi nhanh chỉ còn một màn (+ bước phụ quay về) — chấm tiến độ không còn nghĩa gì -->
      <span v-if="!laNhanh" class="dots" aria-hidden="true">
        <i v-for="(s, i) in path" :key="s" :class="{ on: i <= hienIndex }" />
      </span>
    </header>
    <h2 v-else class="sr-only">{{ tieuDe }}</h2>

    <!-- Lùi bằng Back/vuốt: KHÔNG hiệu ứng (`dangLuiBack` ở useBackGuard — Safari vuốt lùi nháy ảnh chụp) -->
    <Transition :name="dangLuiBack ? 'tuc-thi' : 'step'" mode="out-in" @before-leave="batDauRoi" @after-leave="xongRoi">
      <!--
        TRANG CHỦ (13.10.2026, mockup B chủ dự án duyệt): quạt lá bài · Chiến
        dịch là ô to riêng · ba ô vuông Chơi nhanh / Đấu máy / Online · dải lối
        tắt dưới đáy. Bỏ dòng mô tả dưới mỗi ô — bốn ô dài chữ là thứ làm trang
        chủ cũ đọc như một biểu mẫu. Quạt lá tự co (flex: 1, min-height: 0) và
        ẩn hẳn khi máy quá thấp, nên KHÔNG SCROLL vẫn giữ.
      -->
      <div v-if="step === 'players'" key="players" class="step-body home">
        <QuatLa :themes="themes" />

        <div class="cd-khung">
          <!-- CHỈ SỐ TRÍ NHỚ — nút tròn nổi NGAY TRÊN nút Chiến dịch, bên trái, chữ nằm ngang bên phải nút (25.11.2026, chủ dự án:
               "nút ở trang chủ cho xuống dưới, bên trên chiến dịch"; trước đó ở góc trái trên trời — mockup B 24.11). Bản 3 (25.11.2026,
               https://claude.ai/artifact/D1HPHCCMsVXdgzoFwRjjsu): nút HIỆN LUÔN CON SỐ, viền vàng = tiến độ tới bậc kế, góc có
               huy chương bậc; CHỈ nhấp nháy + bong bóng ▲▼ khi điểm khác lần xem cuối (bản cũ nhấp nháy mãi, chỉ có biểu
               tượng → không có lý do bấm). Chưa đủ số liệu: biểu tượng biểu đồ (không bao giờ cái não) + "Còn N ván".
               Khối bám vào khung của nút Chiến dịch (`.cd-khung`) nên máy cao thấp gì cũng nằm sát trên nút. Mở cho mọi người từ 1.9.66. -->
          <button v-if="tnNut" class="vien-tn thach" type="button" :aria-label="tnNut.nhan" @click="sfx.select(); emit('so-tri-nho')">
            <!-- HUY CHƯƠNG NỔI BẬT (27.11.2026, mockup duyệt https://claude.ai/artifact/48nT343yMfAkhQhJ5uYySc — thay quyết định 25.11 "không
                 vành tiến độ"): xu màu bậc khắc biểu tượng biểu đồ + quầng sáng + vệt sáng lướt + vòng tiến độ tới bậc kế; chưa có điểm
                 thì xu xanh ngọc, vòng chia 3 đoạn Nhỏ/Vừa/Lớn. Tên bậc nhỏ cạnh điểm. -->
            <span class="vtn-hc" :class="tnNut.bac === null ? 'khoa' : `b${tnNut.bac}`" aria-hidden="true">
              <svg class="vtn-vong" viewBox="0 0 46 46">
                <template v-if="tnNut.bac !== null">
                  <circle cx="23" cy="23" r="21" class="nen" />
                  <circle cx="23" cy="23" r="21" class="chay" :stroke-dasharray="`${VONG * tnNut.pt / 100} ${VONG}`" />
                </template>
                <circle v-for="(d, i) in tnNut.nhom" v-else :key="i" cx="23" cy="23" r="21" :class="d ? 'du' : 'nen'"
                  :stroke-dasharray="`${VONG / 3 - 6} ${VONG}`" :stroke-dashoffset="-(VONG / 3) * i - 3" />
              </svg>
              <span class="xu"><ChartColumn :size="tnNut.bac === null ? 18 : 19" :stroke-width="3" /></span>
            </span>
            <span class="vtn-chu"><small>{{ t('tn.ten') }}</small><b>{{ tnNut.diem !== null ? tnNut.diem : t('tn.conVan', { n: tnNut.conVan }) }}<span v-if="tnNut.bac !== null" class="vtn-bac">{{ td(`tn.bac.${tnNut.bac}`) }}</span></b></span>
            <span v-if="tnNut.lech" class="vtn-len" :class="{ giam: tnNut.lech < 0 }" aria-hidden="true">{{ tnNut.lech > 0 ? '▲' : '▼' }} {{ Math.abs(tnNut.lech) }}</span>
          </button>
          <!-- VIÊN PREMIUM đối diện viên Chỉ số trí nhớ (26.11.2026, mockup duyệt https://claude.ai/artifact/5y6jdDcExegghTLJbfWKUc).
               Bấm mở bảng Premium: quyền lợi, cài đặt Premium, ngày hết hạn, nút nhận 1 tháng miễn phí. CHỈ HIỆN KHI DEBUG — chủ dự
               án: "vẫn chờ tôi chốt đã, hiện tại vẫn cho chế độ debug thôi". Chấm đỏ = còn quà chưa nhận. -->
          <!-- CHỈ CHỖ CÀI ĐẶT PREMIUM (27.11.2026): sau khi được tặng, một lần — soi sáng viên Premium + bong bóng chỉ vào -->
          <Teleport to="#app" :disabled="!coApp">
            <!-- CHỈ tắt bằng nút "Đã hiểu" (chủ dự án 27.11.2026: "bấm ra ngoài cũng bị tắt… chỉ bấm Đã hiểu mới tắt") — lớp phủ nuốt mọi chạm khác -->
            <div v-if="chiNutPremium && khungPm" class="chi-pm" role="dialog" aria-modal="true" :aria-label="t('pm.chi.tieuDe')">
              <span class="chi-lo" :style="{ left: `${khungPm.x - 5}px`, top: `${khungPm.y - 5}px`, width: `${khungPm.w + 10}px`, height: `${khungPm.h + 10}px` }" aria-hidden="true" />
              <div class="chi-bong" :style="khungPm.duoiVien ? { right: `${khungPm.phai}px`, top: `${khungPm.tren + 18}px` } : { right: `${khungPm.phai}px`, bottom: `${khungPm.duoi + 18}px` }">
                <KhungBong :canh="khungPm.duoiVien ? 'tren' : 'duoi'" :day="2" :r="16" :vt="khungPm.vt" />
                <b>{{ t('pm.chi.tieuDe') }}</b>
                <span>{{ t('pm.chi.mo') }}</span>
                <button class="thach th-xanh th-nho" type="button" @click="xongChi">{{ t('pm.chi.ok') }}</button>
              </div>
            </div>
          </Teleport>
          <button v-if="hienVienPremium" ref="vienPmEl" class="vien-pm thach" type="button" :aria-label="`${t('tp.premium')} — ${chuVienPremium}`" @click="sfx.select(); moPremium('trang-chu')">
            <span class="vtn-chu"><small>{{ t('tp.premium') }}</small><b>{{ chuVienPremium }}</b></span>
            <!-- VƯƠNG MIỆN LÚC LẮC (27.11.2026, chủ dự án: "nút premium không gây được sự chú ý… nút vương miện lúc lắc chút"):
                 LUÔN lắc một nhịp mỗi vài giây + loé sáng (27.11.2026: chủ dự án đã nhận quà nên không thấy hiệu ứng → "còn nút premium động thì sao") -->
            <span class="vpm-vm lac" aria-hidden="true"><Crown :size="18" :stroke-width="2.6" /></span>
            <i v-if="conQuaTang || sapHetQua" class="vpm-cham" aria-hidden="true" />
          </button>
          <button class="o-chien-dich neon g-violet" type="button" :title="t('menu.chienDichMo', { n: CAMPAIGN_LEVELS })" @click="pickCampaign()">
            <Map class="opt-icon" :size="34" aria-hidden="true" /><img class="ico3d" :src="ICO3D.chienDich" alt="" aria-hidden="true">
            <strong>{{ t('menu.chienDich') }}</strong>
            <span v-if="(manChienDich ?? 0) > 0" class="man thach">{{ t('menu.man', { n: manChienDich ?? 1 }) }}</span>
          </button>
        </div>

        <div class="ba-o">
          <!-- Chơi nhanh xanh trời, Online vàng (chủ dự án đổi chỗ 18.10.2026; ở Kẹo g-cyan = trời, g-blue = vàng) -->
          <!-- nhãn "Mới": trong Chơi nhanh có thể loại mới (Mưa Thẻ, 27.10.2026) -->
          <button class="o-vuong o-moi neon g-cyan" type="button" :title="t('menu.choiNhanhMo')" @click="pickPlayers()">
            <Users class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.choiNhanh" alt="" aria-hidden="true"><strong :class="{ 'tu-dai': tuDai(t('menu.choiNhanh')) }">{{ t('menu.choiNhanh') }}</strong>
            <span v-if="MUA_THE_MO" class="moi-dan thach th-vang th-nho">{{ t('mt.moi') }}</span>
          </button>
          <button class="o-vuong neon g-amber" type="button" :title="t('menu.dauMayMo')" @click="pickBotMode()">
            <Bot class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.dauMay" alt="" aria-hidden="true"><strong :class="{ 'tu-dai': tuDai(t('menu.dauMay')) }">{{ t('menu.dauMay') }}</strong>
          </button>
          <button class="o-vuong o-co-so neon g-blue" type="button" :title="t('menu.onlineMo')" @click="sfx.select(); emit('online')">
            <Globe class="opt-icon" :size="30" aria-hidden="true" /><img class="ico3d" :src="ICO3D.online" alt="" aria-hidden="true"><strong :class="{ 'tu-dai': tuDai(t('menu.online')) }">{{ t('menu.online') }}</strong>
            <!-- NHÃN "● N online" (26.11.2026, mockup B duyệt https://claude.ai/artifact/FbPTdLUCEZMaZhfMcKsKs2 — chủ dự án chê viên ba con
                 số nền xám mờ "xấu quá"): một nhãn trắng nổi khối DÁN LỆCH mép trên, nghiêng nhẹ, CÙNG KIỂU nhãn "Màn N" của nút Chiến
                 dịch. Chỉ một con số (người đang online, kể cả mình); chấm xanh NHỊP khi có phòng đang chờ vào được, đứng yên khi không.
                 Số phòng chờ / phòng đang chơi xem ở trong màn Chơi online. Đọc màn hình vẫn nghe đủ ba con số (aria-label). -->
            <span
              class="nhan-online" :class="{ 'co-phong': soPhongCho > 0 }"
              :aria-label="[t('bxh.dangOnline', { n: soNguoiOnline }), soPhongCho > 0 ? t('menu.soPhongCho', { n: soPhongCho }) : '', soPhongXem > 0 ? t('menu.soPhongXem', { n: soPhongXem }) : ''].filter(Boolean).join(' · ')"
            ><i aria-hidden="true" />{{ t('menu.nOnline', { n: soNguoiOnline > 99 ? '99+' : soNguoiOnline }) }}</span>
          </button>
        </div>

        <!-- DẢI LỐI TẮT (11.10.2026): việc hay làm nhất, một chạm -->
        <!-- Viên Sổ trí nhớ ghi TÊN TRANG, không kèm điểm: "Trí nhớ 639" bị chê "rất tối nghĩa" (23.11.2026) -->
        <div v-if="goiY || (chuoiNgay ?? 0) > 1 || (manChienDich ?? 0) > 1" class="loi-tat">
          <span v-if="(chuoiNgay ?? 0) > 1" class="lt-chip lua thach th-vang" :title="t('menu.chuoiNgayTitle', { n: chuoiNgay ?? 0 })"><Flame :size="14" :stroke-width="2.6" aria-hidden="true" /> {{ t('menu.chuoiNgay', { n: chuoiNgay ?? 0 }) }}</span>
          <button v-if="(manChienDich ?? 0) > 1" class="lt-chip thach" type="button" @click="tiepChienDich">
            <Play :size="14" aria-hidden="true" /><span class="ten">{{ t('menu.man', { n: manChienDich ?? 1 }) }}</span>
          </button>
          <button v-if="goiY" class="lt-chip goi-y thach th-do" type="button" :aria-label="t('menu.chinhPhucAria', { ten: goiY.name })" @click="emit('chinh-phuc', goiY.id)">
            <Target :size="14" :stroke-width="2.6" aria-hidden="true" /><span class="ten">{{ goiY.name }}</span>
          </button>
        </div>

        <!-- GỢI Ý CÀI APP STORE (lib/goi-y-app.ts, mockup A duyệt 07.11.2026): web điện thoại, không phải
             Safari iOS (Safari có Smart App Banner riêng). Thay viên "Cài như app" cũ. -->
        <div v-if="storeGoiY && !anGoiYApp" class="goi-y-app">
          <img src="/icon-192.png" alt="" aria-hidden="true" width="44" height="44">
          <div class="gya-chu">
            <strong>{{ t('app.coApp') }}</strong>
            <span>{{ t('app.phu', { store: storeGoiY.ten }) }}</span>
          </div>
          <a class="gya-cai" :href="storeGoiY.url" target="_blank" rel="noopener" @click="suKien('goi_y_app_cai', { store: storeGoiY.ten })">{{ t('app.cai') }}</a>
          <button class="gya-an thach th-nho" type="button" :aria-label="t('cai.an')" @click="suKien('goi_y_app_an'); tatGoiYApp()"><X :size="18" /></button>
        </div>
      </div>

      <!--
        MÀN CHƠI NHANH (16.11.2026, mockup A duyệt): số người · số thẻ · theme · bàn chơi trên MỘT màn,
        Bắt đầu ở đáy. Hai hàng ô theo kiểu SizeGrid (số to, chữ nhỏ); theme và bàn chơi là dòng tóm
        tắt mở bước phụ. KHÔNG SCROLL: hàng ô và dòng co theo chỗ còn lại (min 44px vùng chạm).
      -->
      <div v-else-if="step === 'nhanh'" key="nhanh" class="step-body nhanh">
        <template v-if="hienTim">
          <p class="nh-nhan">{{ t('menu.kieuChoi') }}</p>
          <span class="kieu-seg" role="radiogroup" :aria-label="t('menu.kieuChoi')">
            <button v-for="k in (['thuong', 'tim'] as const)" :key="k" class="nut-kieu thach th-nho th-chon" type="button" role="radio" :aria-checked="kieu === k" @click="chonKieu(k)">
              {{ k === 'tim' ? t('tt.ten') : t('menu.kieu.thuong') }}<span v-if="k === 'tim'" class="moi-dan thach th-vang th-nho">{{ t('mt.moi') }}</span>
            </button>
          </span>
        </template>
        <template v-if="!laTim">
        <p class="nh-nhan">{{ t('menu.buoc.count') }}</p>
        <span class="ranh so-nguoi" role="radiogroup" :aria-label="t('menu.buoc.count')">
          <button
            v-for="c in COUNTS" :key="c.n" class="nut-o nh-o thach th-nho th-chon" type="button" role="radio"
            :aria-checked="playerCount === c.n" :aria-label="t('menu.soNguoiAria', { n: c.n })"
            @click="chonSoNguoi(c.n)"
          ><b>{{ c.n === 1 ? t('menu.soNguoi.1') : c.n }}</b></button>
        </span>
        <button v-if="isMulti" class="nh-dong nh-ten thach" type="button" @click="moBuocPhu('names')">
          <span class="nh-chu"><strong>{{ t('menu.nhanh.ten') }}</strong><small>{{ tenDangDung }}</small></span>
          <span class="nh-sua">{{ t('menu.nhanh.sua') }}</span>
        </button>
        </template>
        <ChonTimThe v-else :chon="{ ...timChon, doiThu: 'mot' }" @doi="doiTim" />

        <BanChon
          :level="level" :symbol-count="maxSymbolCount" :themes="themes" :theme-ids="themeIds" :options="options" :tim="laTim"
          @chon-co="chonCo" @mo="moBuocPhu"
        />

        <p v-if="themeTooSmall && !laTim" class="warn" role="alert">{{ t('menu.thieuTheme', { ban: tenBan, n: pairsNeeded }) }}</p>
        <button class="btn-primary nh-bat-dau" type="button" @click="batDauNhanh">
          {{ laTim ? t('tt.batDau', { n: timChon.soThe }) : t('menu.batDau', { ban: tenBan }) }}
        </button>
      </div>

      <!-- ĐẤU MÁY MỘT MÀN (mockup 17.11.2026): đối thủ + bàn (BanChon dùng chung với Chơi nhanh) + Bắt đầu -->
      <div v-else-if="step === 'bot'" key="bot" class="step-body nhanh">
        <template v-if="hienTim">
          <p class="nh-nhan">{{ t('menu.kieuChoi') }}</p>
          <span class="kieu-seg" role="radiogroup" :aria-label="t('menu.kieuChoi')">
            <button v-for="k in (['thuong', 'tim'] as const)" :key="k" class="nut-kieu thach th-nho th-chon" type="button" role="radio" :aria-checked="kieu === k" @click="chonKieu(k)">
              {{ k === 'tim' ? t('tt.ten') : t('menu.kieu.thuong') }}<span v-if="k === 'tim'" class="moi-dan thach th-vang th-nho">{{ t('mt.moi') }}</span>
            </button>
          </span>
        </template>
        <p class="nh-nhan">{{ t('menu.doiThu') }}</p>
        <div class="nh-hang may-hang" role="radiogroup" :aria-label="t('menu.doiThu')">
          <button
            v-for="b in BOT_CHOICES" :key="b.id" class="option nh-o may-o" type="button" role="radio"
            :aria-checked="botLevel === b.id" :aria-label="tenBot(b.id)" :title="tenBot(b.id)"
            @click="pickBotLevel(b.id)"
          ><span class="bot-face" aria-hidden="true"><MatBot :mat="BOT_SPECS[b.id].avatar" /></span></button>
        </div>
        <p v-if="botLevel" class="may-mo" :class="{ 'an-thap': laTim }" aria-live="polite"><b>{{ tenBot(botLevel) }}</b> — {{ td(`menu.bot.${botLevel}`) }}</p>

        <ChonTimThe v-if="laTim" :chon="{ ...timChon, doiThu: botLevel ?? 'mot' }" @doi="doiTim" />
        <BanChon
          :level="level" :symbol-count="maxSymbolCount" :themes="themes" :theme-ids="themeIds" :options="options" :tim="laTim"
          @chon-co="chonCo" @mo="moBuocPhu"
        />

        <p v-if="themeTooSmall && !laTim" class="warn" role="alert">{{ t('menu.thieuTheme', { ban: tenBan, n: pairsNeeded }) }}</p>
        <button class="btn-primary nh-bat-dau" type="button" @click="batDauNhanh">
          {{ laTim ? t('tt.batDau', { n: timChon.soThe }) : t('menu.batDau', { ban: tenBan }) }}
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

      <!-- BƯỚC THỂ LOẠI (Chơi nhanh, 27.10.2026): Thường / Mưa Thẻ — bấm là đi luôn, không viền "đang chọn" -->
      <div v-else-if="step === 'kieu'" key="kieu" class="step-body options loose kieu">
        <button class="option wide neon g-cyan" type="button" @click="pickKieu('thuong')">
          <img class="kieu-ic" :src="ICO3D.thuong" alt="" aria-hidden="true">
          <span class="text"><strong>{{ t('menu.kieu.thuong') }}</strong><small>{{ t('menu.kieu.thuongMo') }}</small></span>
        </button>
        <button v-if="MUA_THE_MO" class="option wide neon g-pink o-moi" type="button" @click="pickKieu('mua')">
          <img class="kieu-ic" :src="ICO3D.muaThe" alt="" aria-hidden="true">
          <span class="text"><strong>{{ t('mt.ten') }}</strong><small>{{ t('mt.moTa') }}</small></span>
          <span class="moi-dan thach th-vang th-nho">{{ t('mt.moi') }}</span>
        </button>
      </div>

      <!-- BƯỚC (nhiều người): điền tên từng người -->
      <div v-else-if="step === 'names'" key="names" class="step-body names">
        <p class="hint-multi">{{ t('menu.goiYTen') }}</p>
        <div class="name-list">
          <div v-for="(_, i) in names" :key="i" class="name-row" :class="{ 'la-may': mayO(i) }">
            <span class="name-no">{{ i + 1 }}</span>
            <button
              v-if="mayO(i)" class="may-ten thach th-nho" type="button"
              :aria-label="t('menu.mucMayN', { n: i + 1 })" @click="sfx.select(); chonMucCho = i"
            >
              <span class="may-mat" aria-hidden="true"><MatBot :mat="BOT_SPECS[mayO(i)!].avatar" /></span>
              <span class="may-chu"><strong>{{ tenBot(mayO(i)!) }}</strong><small>{{ t('menu.chamDoiMuc') }}</small></span>
            </button>
            <input
              v-else
              v-model="names[i]"
              type="text" maxlength="12" enterkeyhint="next"
              :placeholder="t('menu.nguoiN', { n: i + 1 })"
              :aria-label="t('menu.tenNguoiAria', { n: i + 1 })"
              @keydown.enter="confirmNames"
            >
            <span v-if="i > 0" class="loai" role="group">
              <button
                class="thach th-nho th-chon" type="button" :aria-pressed="!mayO(i)"
                @click="chuyenLoai(i, false)"
              >{{ t('menu.laNguoi') }}</button>
              <button
                class="thach th-nho th-chon" type="button" :aria-pressed="!!mayO(i)"
                @click="chuyenLoai(i, true)"
              >{{ t('menu.laMay') }}</button>
            </span>
          </div>
        </div>
        <button class="btn-primary" type="button" @click="confirmNames">{{ t('menu.tiepTuc') }}</button>
        <ChonMucMay
          v-if="chonMucCho !== null" :tieu-de="t('menu.mucMayN', { n: chonMucCho + 1 })" :muc="mayO(chonMucCho)"
          @chon="chonMuc" @dong="chonMucCho = null"
        />
      </div>

      <!-- BƯỚC: chọn chế độ -->
      <!-- BƯỚC: chọn cấp độ. MỌI chế độ đều qua đây — trước kia chỉ Chiến dịch
           có bản đồ, các chế độ khác chọn 1 trong 12 cỡ bàn cố định, nên cùng
           một việc lại có hai kiểu chọn và chỉ Chiến dịch mới chơi tiếp được
           cấp sau. -->
      <div v-else-if="step === 'level'" key="level" class="step-body">
        <!-- Chiến dịch: bản đồ 60 màn, vì ở đó cấp THẬT SỰ là độ khó (sao, mở
             khoá, mỗi màn một luật). Chế độ khác: cấp chỉ còn là cỡ bàn nên
             hỏi thẳng số thẻ, độ khó để bước tuỳ chọn lo. -->
        <span v-if="mode === 'campaign' && hienTim" class="kieu-seg kieu-cd" role="radiogroup" :aria-label="t('menu.kieuChoi')">
          <button v-for="k in (['thuong', 'tim'] as const)" :key="k" class="nut-kieu thach th-nho th-chon" type="button" role="radio" :aria-checked="kieuCD === k" @click="chonKieuCD(k)">
            {{ k === 'tim' ? t('tt.ten') : t('ctd.latCap') }}<span v-if="k === 'tim'" class="moi-dan thach th-vang th-nho">{{ t('mt.moi') }}</span>
          </button>
        </span>
        <LevelMapTim
          v-if="mode === 'campaign' && hienTim && kieuCD === 'tim'"
          :progress="tienDoTim" :unlocked="moToiTimCD" @play="choiManTim"
        />
        <LevelMap
          v-else-if="mode === 'campaign'"
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

        <!-- Luật màn này (Chiến dịch): ngay trên nút Bắt đầu — người chơi phải biết bàn
             sẽ xáo / có mạng / có thẻ đặc biệt TRƯỚC khi bấm, không phải giữa ván -->
        <div v-if="luatMan" class="luat-man" :class="{ trum: luatMan.trum }">
          <img v-if="luatMan.trum && VUONG_MIEN" class="vm" :src="VUONG_MIEN" alt="" />
          <span v-else-if="luatMan.trum" class="vm" aria-hidden="true">👑</span>
          <OptionIcon v-else :name="luatMan.icon" :size="34" />
          <span><b>{{ t('cd.luatTieuDe', { ten: luatMan.ten }) }}</b>{{ luatMan.moTa }}</span>
        </div>

        <!-- Chiến dịch vào thẳng màn; chơi nhanh còn một bước đặt luật bàn -->
        <button
          class="btn-primary" :disabled="themeTooSmall" type="button"
          @click="xongTheme()"
        >
          {{ mode === 'campaign' ? t('menu.batDauCap', { n: level }) : laNhanh ? t('menu.nhanh.xong') : t('menu.tiep') }}
        </button>

        <!-- Mốc sao nói TRƯỚC khi chơi (chủ dự án 14.10.2026): 3★ cố ý khó, người
             chơi phải biết đích trước khi vào ván -->
        <p v-if="mode === 'campaign'" class="moc-sao">
          <template v-for="(m, i) in mocSao" :key="m.sao">
            <span v-if="i" class="ngan"> · </span>
            <span class="nhom"><Sao3D v-for="k in Math.min(m.sao, 3)" :key="k" /><Sao3D v-if="m.sao === 4" loai="sao4" song /> {{ m.txt }}</span>
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

        <!-- Chơi nhanh: bàn chơi là bước phụ — Xong quay về màn `nhanh`; đấu máy thì vào ván -->
        <button v-if="laNhanh" class="btn-primary" type="button" @click="sfx.select(); step = veMan">
          {{ t('menu.nhanh.xong') }}
        </button>
        <button v-else class="btn-primary" type="button" @click="emit('start-level', level)">
          {{ t('menu.batDau', { ban: tenBan }) }}
        </button>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
/* Đấu máy một màn: hàng 5 mặt máy (cùng ô với số người/số thẻ), dòng tên + lời của máy đang chọn */
.may-hang { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.may-o .bot-face { font-size: clamp(30px, 11vw, 46px); line-height: 1; display: grid; place-items: center; }
.may-mo { margin: -2px 0 0; min-height: 2.6em; font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--muted); flex: none; }
.may-mo b { color: var(--fg); font-weight: 800; }

/* Nút vô hình trùng mặt trời/trăng (tính năng ẩn đổi sáng/tối) — dưới thanh trên (z 15) */
.nut-troi {
  position: absolute; z-index: 14; left: calc(87% - 32px); top: calc(var(--tam-troi) - 32px);
  width: 64px; height: 64px; padding: 0; border: 0; border-radius: 50%; background: none;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.nut-troi:focus-visible { outline: 3px solid var(--fg); outline-offset: 2px; }

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
/* Máy chơi cùng: dòng máy thay ô tên bằng mặt + tên mức (chạm để đổi mức) */
.name-row.la-may { border-color: var(--accent); }
.may-ten {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
  padding: 4px 10px 4px 6px; text-align: left; min-height: 44px; border-radius: 14px;
}
.may-mat { width: 32px; height: 32px; flex: none; display: grid; place-items: center; font-size: 24px; }
.may-mat :deep(img), .may-mat :deep(svg) { width: 100%; height: 100%; }
.may-chu { min-width: 0; display: flex; flex-direction: column; }
.may-chu strong { font-family: var(--font-display); font-size: var(--text-md); line-height: 1.1; }
.may-chu small { font-size: var(--text-xs); color: var(--muted); font-weight: 600; white-space: nowrap; }
/* Máy hẹp (SE): bỏ dòng gợi ý, tên máy được xuống hai dòng — cắt "Bot gà…" là không biết mức nào */
@media (max-width: 400px) {
  .may-chu small { display: none; }
  .loai .thach { padding: 0 8px; }
}
.loai { display: flex; gap: 4px; flex: none; }
.loai .thach {
  min-height: 34px; min-width: 0; padding: 0 10px; position: relative;
  font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm);
}
.loai .thach::after { content: ''; position: absolute; inset: -5px -2px; }


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
  /* Mặt thú CÓ KHOẢNG CÁCH, xếp theo hình (chủ dự án 18.10.2026): 1 · 2 cạnh nhau · 3 tam giác
     (1 trên, 2 dưới) · 4 = 2 trên 2 dưới. Hai hàng cao 2×30 + 4 = 64px, vừa ô thấp nhất (SE). */
  flex: 0 0 auto; width: 96px; display: grid; justify-content: center; align-content: center; gap: 4px 6px;
}
.hinh-nguoi img { width: var(--mat); height: var(--mat); filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .25)); }
.hinh-nguoi.n1 { --mat: 46px; }
.hinh-nguoi.n2 { --mat: 36px; grid-template-columns: repeat(2, var(--mat)); }
.hinh-nguoi:is(.n3, .n4) { --mat: 30px; grid-template-columns: repeat(2, var(--mat)); }
.hinh-nguoi.n3 img:first-child { grid-column: 1 / -1; justify-self: center; }
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
/* NHANH HƠN (27.11.2026, chủ dự án: "tối ưu tốc độ… render"): bước cũ RỜI NGAY (trước mờ .12s rồi bước mới mới dựng — ~0,3s
   chỉ để chờ hiệu ứng, đo được là phần chậm nhất của chuyển bước menu), bước mới mờ vào .14s. `out-in` giữ nguyên nên
   hai bước không bao giờ chồng nhau; leave 0 giây thì Vue đổi ngay trong cùng nhịp. */
.step-enter-active { transition: opacity .14s ease; }
.step-enter-from { opacity: 0; }
.step-leave-active { transition: none; }
/* lùi bằng Back/vuốt: KHÔNG chuyển động — `:css="false"` bật/tắt giữa chừng làm Vue vỡ khi vá DOM (đo được),
   nên đổi TÊN hiệu ứng sang một tên không có transition: Vue đo ra 0 giây và đổi ngay */
.tuc-thi-enter-active, .tuc-thi-leave-active { transition: none; }
/* cả khung mờ theo khi đi về / ra khỏi trang chủ — xem `khungMo` */
section.panel.khung-roi { opacity: 0; }
section.panel.khung-vao { animation: khung-vao .14s ease; }
@keyframes khung-vao { from { opacity: 0; } }

.chip.compact { flex: 0 1 auto; min-width: 96px; }
.warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
  background: color-mix(in srgb, var(--bad) 14%, transparent); }
.luat-man {
  display: flex; align-items: center; gap: 10px; margin: 0 0 10px; padding: 9px 12px;
  border-radius: var(--r-md); border: 2px solid color-mix(in srgb, var(--accent) 30%, var(--line));
  background: color-mix(in srgb, var(--accent) 9%, var(--panel-solid)); color: var(--fg);
  font-size: var(--text-sm); line-height: 1.35; text-align: left;
}
.luat-man.trum { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); background: color-mix(in srgb, var(--gold) 12%, var(--panel-solid)); }
.luat-man b { display: block; font-family: var(--font-display); font-weight: 800; }
.luat-man .vm { width: 34px; height: 34px; flex: none; font-size: 28px; line-height: 34px; text-align: center; }
.luat-man :deep(.opt-ico) { flex: none; }
.moc-sao { margin: 12px 0 0; text-align: center; font-weight: 700; font-size: 14px; color: var(--fg); }
.best { margin: 14px 0 0; color: var(--muted); font-size: 13px; }
.moc-sao + .best { margin-top: 4px; }
.moc-sao .nhom { white-space: nowrap; }
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
.step-body.home { display: flex; flex-direction: column; gap: 14px; justify-content: center; position: relative; }
/* Khung của nút Chiến dịch: chỉ để nút Chỉ số trí nhớ bám vào mép TRÊN của nó; bản thân nút Chiến dịch giãn như cũ */
.cd-khung { position: relative; flex: none; display: flex; flex-direction: column; }
/* VIÊN THẠCH (25.11.2026, mockup 1 duyệt https://claude.ai/artifact/BP9qMdSyxbwSW4y664efvs; chủ dự án chê nút tròn có vành
   "xấu và không tương hợp với giao diện"): cùng kiểu viên xu ở thanh đầu — huy chương bậc · tên nhỏ trên · điểm to dưới.
   Bong bóng ▲▼ chỉ khi điểm khác lần xem cuối. Không vành tiến độ, không nhấp nháy. */
.vien-tn {
  /* +22px chứ không +12px: nhãn "Màn N" dán lệch LÊN TRÊN mép nút Chiến dịch 12px (keo-thach.css) — viên Premium ở bên phải
     từng đè lên nó (chủ dự án báo kèm ảnh 26.11.2026). Hai viên cùng một mốc cho thẳng hàng. */
  position: absolute; left: 4px; bottom: calc(100% + 22px); z-index: 2; display: flex; align-items: center; gap: 8px;
  min-height: 0; padding: 5px 14px 5px 6px; border-radius: 999px; text-align: left; cursor: pointer; overflow: visible;
}
/* Viên Premium: soi gương của viên trí nhớ — bám mép PHẢI, chữ canh phải, vương miện vàng ở cuối. `max-width` để hai viên
   không bao giờ đè nhau trên máy hẹp (SE 375) hay ngôn ngữ chữ dài: chữ dài thì cắt bằng dấu ba chấm. */
.vien-pm {
  position: absolute; right: 4px; bottom: calc(100% + 22px); z-index: 2; display: flex; align-items: center; gap: 8px;
  max-width: 52%; min-height: 0; padding: 5px 6px 5px 14px; border-radius: 999px; text-align: right; cursor: pointer; overflow: visible;
}
.vien-pm .vtn-chu { align-items: flex-end; }
/* KHÔNG LÀM DỊU Ở MÀN TỐI (28.11.2026, chủ dự án: "vàng ở chỉ số trí nhớ trông rất tối, không sáng như vàng ở Premium"):
   keo-thach.css hạ `brightness(.86) saturate(.9)` cho MỌI nút thạch ở màn tối → huy chương xỉn hẳn. Viên Premium thoát nhờ
   animation quầng sáng ghi đè `filter` (tắt chuyển động thì cũng bị dịu) — hai viên huy hiệu ở đây phải sáng ngang nhau. */
:root[data-skin='keo'][data-theme='dark'] .vien-tn, :root[data-skin='keo'][data-theme='dark'] .vien-pm { filter: none; }
.vien-pm .vtn-chu b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; font-size: 14px; line-height: 1.25; }
.chi-pm { position: absolute; inset: 0; z-index: 70; }
.chi-lo { position: absolute; border-radius: 999px; box-shadow: 0 0 0 4px #ffd34d, 0 0 0 9999px rgba(8, 10, 30, .6), 0 0 24px 6px rgba(255, 211, 77, .8); animation: chi-nhip 1.4s ease-in-out infinite; }
@keyframes chi-nhip { 50% { box-shadow: 0 0 0 7px #ffd34d, 0 0 0 9999px rgba(8, 10, 30, .6), 0 0 34px 10px rgba(255, 211, 77, .9); } }
.chi-bong { position: absolute; width: min(260px, calc(100% - 24px)); box-sizing: border-box; display: grid; gap: 4px; padding: 13px 14px 12px; text-align: left; isolation: isolate;
  --nen: var(--panel-solid, #fff); --vien: color-mix(in srgb, #f0b400 70%, transparent); color: var(--fg); filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .35)); font: 700 13.5px/1.45 var(--font-body); }
.chi-bong b { font: 800 16px/1.25 var(--font-display); }
.chi-bong button { justify-self: end; margin-top: 6px; min-height: 36px; padding: 0 18px; }
@media (prefers-reduced-motion: reduce) { .chi-lo { animation: none; } }
.vpm-vm { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(180deg, #ffe08a, #f5b324); color: #5b3d00; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35); }
/* LẮC NGAY TỪ LÚC MỞ APP (27.11.2026, chủ dự án: "mở app một lúc mới lắc, người dùng có khi chưa kịp nhìn"): nhịp lắc nằm ĐẦU
   chu kỳ (2.6 s), cả viên Premium toả quầng vàng nhấp nháy liên tục cho nổi trên nền */
.vpm-vm.lac { animation: vpm-lac 2s ease-in-out infinite; transform-origin: 50% 85%; }
/* Mockup A2 duyệt 27.11.2026 (https://claude.ai/artifact/CGe7j2CZG5nt1VEXBGgTGh, "lắc cao hơn và nhanh hơn"): nhảy 7px, ±24°, nhịp 0,5 s, lặp 2 s */
@keyframes vpm-lac {
  0% { transform: none; }
  4% { transform: translateY(-7px) rotate(-24deg) scale(1.22); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35), 0 0 18px 5px rgba(255, 205, 60, .85); }
  8% { transform: translateY(-7px) rotate(22deg) scale(1.22); }
  12% { transform: translateY(-4px) rotate(-16deg) scale(1.15); }
  16% { transform: translateY(-2px) rotate(10deg) scale(1.08); }
  20% { transform: rotate(-4deg); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35), 0 0 8px 1px rgba(255, 205, 60, .4); }
  25%, 100% { transform: none; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35); }
}
.vien-pm { animation: vpm-quang 2s ease-in-out infinite; }
@keyframes vpm-quang {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 196, 40, 0)); }
  10% { filter: drop-shadow(0 0 10px rgba(255, 196, 40, .85)); }
  45% { filter: drop-shadow(0 0 3px rgba(255, 196, 40, .35)); }
}
@media (prefers-reduced-motion: reduce) { .vpm-vm.lac, .vien-pm { animation: none; } }
.vpm-cham { position: absolute; top: -2px; right: -2px; width: 13px; height: 13px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 2px var(--panel-solid, #fff); }
.vtn-hc { position: relative; flex: none; width: 46px; height: 46px; margin: -6px 0 -6px -4px; }
.vtn-hc.b0 { --h1: #f6d0aa; --h2: #c98345; --h3: #8a4a18; --hc: #45220a; --glow: #ff9d4d; }
.vtn-hc.b1 { --h1: #ffffff; --h2: #b3bccd; --h3: #6f7a90; --hc: #2b3346; --glow: #c9d3ea; }
.vtn-hc.b2 { --h1: #fff0a8; --h2: #f0b400; --h3: #a87400; --hc: #4a3600; --glow: #ffcf3a; }
.vtn-hc.b3 { --h1: #f0fbff; --h2: #86c9ea; --h3: #3f84ad; --hc: #0d3b57; --glow: #7fd8ff; }
.vtn-hc.b4 { --h1: #e9e0ff; --h2: #8a6df2; --h3: #4a34b0; --hc: #ffffff; --glow: #b59cff; }
.vtn-vong { position: absolute; inset: 0; transform: rotate(-90deg); }
.vtn-vong circle { fill: none; stroke-width: 3.5; stroke-linecap: round; }
.vtn-vong .nen { stroke: color-mix(in srgb, var(--muted) 18%, transparent); }
.vtn-vong .chay { stroke: var(--h2); }
.vtn-vong .du { stroke: #2fb57a; }
.vtn-hc .xu { position: absolute; inset: 5px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: var(--hc);
  /* CÙNG CÔNG THỨC với huy chương trong bảng Chỉ số (sáng giữa, viền màu bậc) — bản cũ tô dần về --h3 nên xu nhỏ trông TỐI
     (chủ dự án 27.11.2026: "icon bạc ở đây hơi bị tối… không sáng như bên trong") */
  background: radial-gradient(circle at 34% 28%, var(--h1), var(--h2) 78%); border: 2px solid color-mix(in srgb, var(--h3) 55%, #fff); box-sizing: border-box;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .5), 0 0 12px 1px color-mix(in srgb, var(--glow) 70%, transparent); }
.vtn-hc .xu svg { filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .6)); }
.vtn-hc .xu::after { content: ""; position: absolute; top: -40%; bottom: -40%; left: -60%; width: 40%; transform: rotate(25deg); background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .75), transparent); animation: vtn-loe 3.6s ease-in-out infinite; }
@keyframes vtn-loe { 0%, 60% { left: -60%; } 85%, 100% { left: 130%; } }
@media (prefers-reduced-motion: reduce) { .vtn-hc .xu::after { animation: none; display: none; } }
.vtn-hc.khoa .xu { background: linear-gradient(#3fd0bd, #149384 70%); color: #fff; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .35), 0 0 10px rgba(63, 208, 189, .55); }
.vtn-hc.khoa .xu svg { filter: none; }
.vtn-hc.khoa .xu::after { display: none; }
.vtn-bac { margin-left: 5px; font: 800 11px/1 var(--font-body); color: var(--muted); }
.vtn-chu { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.vtn-chu small { font-size: 10.5px; font-weight: 800; line-height: 1.1; color: var(--muted); white-space: nowrap; }
.vtn-chu b { font: 800 19px/1 var(--font-display); font-variant-numeric: tabular-nums; white-space: nowrap; }
.vtn-hc.khoa + .vtn-chu b { font-size: 14px; line-height: 1.25; }
/* Bong bóng nằm TRONG viên, sau chữ (bản đầu dán ở góc trên phải thì đè lên chữ "nhớ" — soát ảnh 25.11.2026) */
.vtn-len { flex: none; align-self: center; margin-left: 2px; white-space: nowrap; padding: 4px 7px 3px; border-radius: 999px;
  font: 800 11.5px/1 var(--font-display); color: #fff; background: #1f9a3a; }
.vtn-len.giam { background: #5c6187; }
.home .loi-tat { margin: 0; }
.ico3d { display: none; }

/* Thẻ gợi ý cài app (mockup A): mặt trắng viền navy như nút store trang giới thiệu — màu CỨNG cả
   thẻ (không trộn token), vì thẻ là một mặt riêng, đọc được trên mọi skin sáng/tối. */
.goi-y-app {
  flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 6px 8px 10px;
  background: #fff; color: #1f2a5c; border: 3px solid #1f2a5c; border-radius: 18px; box-shadow: 0 4px 0 #1f2a5c;
}
.goi-y-app img { flex: none; width: 44px; height: 44px; border-radius: 11px; }
.gya-chu { flex: 1; min-width: 0; display: grid; line-height: 1.25; }
.gya-chu strong { font-weight: 800; font-size: 15px; color: #1f2a5c; overflow-wrap: anywhere; }
.gya-chu span { font-weight: 600; font-size: 12.5px; color: #4a557f; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gya-cai {
  flex: none; padding: 9px 14px; border-radius: 14px; background: #278210; color: #fff;
  font-weight: 800; font-size: 15px; text-decoration: none; box-shadow: 0 3px 0 #175008;
}
/* Hình 32px, vùng chạm 44px (NF-07) */
.gya-an { position: relative; flex: none; width: 32px; height: 32px; min-width: 0; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: none; color: #4a557f; display: grid; place-items: center; cursor: pointer; }
.gya-an::after { content: ''; position: absolute; inset: -6px; }
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
.o-moi { position: relative; overflow: visible; }
.kieu-ic { flex: none; width: clamp(44px, 9vh, 64px); height: auto; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, .25)); }
.moi-dan { position: absolute; top: -10px; right: -4px; z-index: 1; padding: 2px 8px; min-height: 0; border-radius: 999px; font-size: 11.5px; font-weight: 900; rotate: 6deg; }
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

/* ---------- MÀN CHƠI NHANH (16.11.2026) ---------- */
.nh-bat-dau { flex: none; margin-top: auto; }

.o-co-so { position: relative; }
.o-co-so { overflow: visible; }
/* Nhãn dán "● N online" — cùng kiểu nhãn "Màn N" (keo-thach.css: lệch lên mép trên, nghiêng 4°), nền trắng nổi khối */
.nhan-online {
  position: absolute; top: -11px; right: 6px; z-index: 2; display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px 3px 8px; border-radius: 11px; rotate: 4deg; pointer-events: none; white-space: nowrap;
  background: #fff; color: #1b2452; font: 800 13px/1.2 var(--font-display, inherit); font-variant-numeric: tabular-nums;
  box-shadow: 0 3px 0 #c6cfe6, 0 6px 10px rgba(10, 20, 60, .18);
}
:global([data-theme='dark'] .nhan-online) { background: #2a3470; color: #eef1ff; box-shadow: 0 3px 0 #151b46, 0 6px 10px rgba(0, 0, 0, .3); }
.nhan-online i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; }
.nhan-online.co-phong i { animation: so-phong-song 1.6s infinite; }
@keyframes so-phong-song { 0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, .6); } 70%, 100% { box-shadow: 0 0 0 6px rgba(46, 204, 113, 0); } }
@media (prefers-reduced-motion: reduce) { .nhan-online.co-phong i { animation: none; } }
/* HÀNG KIỂU CHƠI (27.11.2026, mockup https://claude.ai/artifact/VSDue1KpVaC8WXysMR7iHR): rãnh hai viên Thường / Tìm Thẻ */
.kieu-seg {
  flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 999px;
  background: var(--k-mem, var(--panel-soft)); border: 2px solid var(--t3, var(--line)); box-shadow: inset 0 2px 4px rgba(29, 42, 90, .14);
}
.nut-kieu {
  position: relative; min-height: 44px; border: 1.5px solid transparent; border-radius: 999px; background: none; color: var(--fg);
  font-family: var(--font-display); font-size: 17px; font-weight: 800; cursor: pointer;
}
.nut-kieu[aria-checked='true'] {
  border-color: #33861a; color: #fff; background: linear-gradient(#a3ec72 -40%, #46ad22 70%); text-shadow: 0 1px 0 #23600f;
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .45), 0 2px 0 #33861a, 0 3px 5px rgba(10, 20, 60, .18);
}
@media (max-height: 700px) {
  .nut-kieu { min-height: 38px; }
  /* Đấu với máy + Tìm Thẻ trên màn thấp: bỏ câu giới thiệu máy (tên máy vẫn ở aria-label từng ô) */
  .may-mo.an-thap { display: none; }
}
.kieu-cd { margin: 0 0 10px; }
.nut-kieu .moi-dan { position: absolute; top: -9px; right: 6px; font-size: 10.5px; padding: 1px 7px; text-shadow: none; }
</style>
