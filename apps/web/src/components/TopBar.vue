<script setup lang="ts">
import { Bell, Bug, ChevronLeft, ChevronRight, Crown, HelpCircle, Info, Languages, MailPlus, Menu, Music, Palette, RefreshCw, Settings2, Smartphone, SmartphoneNfc, Swords, Trophy, UserRound, Volume1, Volume2, VolumeX, X } from 'lucide-vue-next';
import { laApp } from '@/lib/native';
import { datNhanLoiMoi, nhanLoiMoi } from '@/lib/sanh';
import { coThiDau, datGoiYThiDau, goiYThiDau } from '@/lib/thidau';
import { batChuong, coChuong, dangBat, tatChuong } from '@/lib/thong-bao';
import { moCai, nenMoiCai } from '@/lib/cai-app';
import { coNenToi, skin } from '@/lib/skin';
import { ICON_BAI, baiChoiDuoc, baiHien, type BaiNhac } from '@/lib/nhac';
import { NGON_NGU, ngonNgu, t, td } from '@/lib/i18n';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { num, numShort } from '@/lib/format';
import DongXu from './DongXu.vue';
import { sfx } from '@/lib/audio';
import { daXemMeoXu, doiHangCho, hangXu, hoiLanDau, hoiSauDiem, tatMeoXu, type KieuDoiHang } from '@/lib/hang-xu';
import type { SoundLevel } from '@/lib/storage';

/** `account`: server có tài khoản không — không có (bản Cloudflare) thì giấu nút.
 *  `avatar`: ảnh Google của người đang đăng nhập, null là chưa đăng nhập. */
const props = defineProps<{
  nen: 'tu' | 'sang' | 'toi'; soundLevel: SoundLevel; totalScore: number;
  account?: boolean; avatar?: string | null; signedIn?: boolean;
  /** Nhạc nền đang bật. */
  nhac?: boolean;
  /** Rung đang bật; `coRung`: máy có đường rung không (web trên iPhone thì không). */
  rung?: boolean; coRung?: boolean;
  /** Bài nhạc nền đang chọn (lib/nhac.ts). */
  baiNhac?: BaiNhac;
  /** Tên tài khoản Google đang đăng nhập — hiện ở khối tài khoản của menu. */
  tenTk?: string | null;
  /** Danh hiệu: đã có / tổng — viên 🏅 cạnh điểm, bấm mở màn Danh hiệu. */
  danhHieu?: { co: number; tong: number };
  /** Đang trong ván (offline hay online): lá bài trên viên danh hiệu đứng yên. */
  dungYen?: boolean;
  /** Chế độ debug đang bật — đèn nháy vàng/đỏ ở góc logo để không quên tắt. */
  debug?: boolean;
  /** Bảng xếp hạng đang mở — hiệu ứng lên hạng chờ bảng đóng mới diễn. */
  bxhMo?: boolean;
}>();
const emit = defineEmits<{ 'set-nen': ['tu' | 'sang' | 'toi']; 'cycle-sound': []; 'set-sound': [SoundLevel]; 'set-nhac': ['off' | BaiNhac]; 'toggle-rung': []; home: []; rules: []; account: []; 'danh-hieu': []; 'xep-hang': [];
  'update:debug': [boolean]; 'mo-debug': [] }>();

/*
 * CỬA VÀO CHẾ ĐỘ DEBUG: chạm 7 LẦN LIÊN TIẾP vào chữ "Cài đặt" HOẶC dòng "Giao diện" trong
 * menu (chủ dự án 16.10.2026 — chữ "Cài đặt" nhỏ, hay chạm trượt; đường cũ qua Luật chơi
 * vẫn giữ). Ngắt quá 1,5 giây là đếm lại; chạm lẫn hai chỗ vẫn cộng chung.
 * `pointerup` chứ không `click`: Safari iOS không phát click trên <p> không bấm được.
 */
const SO_CHAM_DEBUG = 7;
let soChamDebug = 0;
let hetChamDebug: ReturnType<typeof setTimeout> | undefined;
function chamCaiDat(): void {
  clearTimeout(hetChamDebug);
  soChamDebug += 1;
  if (soChamDebug >= SO_CHAM_DEBUG) { soChamDebug = 0; if (!props.debug) emit('update:debug', true); return; }
  hetChamDebug = setTimeout(() => { soChamDebug = 0; }, 1500);
}

/*
 * MỘT NÚT MENU thay cho bốn nút rời. Bốn nút × 44px + khoảng cách là 208px —
 * trên iPhone 15 Pro Max (430px) viên điểm đã chờm lên chữ "Lật Thẻ" (ảnh người
 * chơi gửi 08.10.2026). Hàng trên giờ chỉ còn logo · điểm · menu; thứ hiếm bấm
 * (luật, nền, âm thanh, tài khoản) nằm trong menu thả xuống. Nút menu mang
 * AVATAR khi đã đăng nhập để nhìn là biết mình đang là ai.
 */
/*
 * TÊN APP KHÔNG VỪA THÌ CHỈ GIỮ BIỂU TƯỢNG. Viên điểm rộng ra sau mỗi ván và tên
 * mỗi ngôn ngữ dài khác nhau ("Lật Thẻ" vừa, "Flip Match" thì không) — trên iPhone
 * SE chữ logo từng lòi đè lên viên điểm (tools/do-ngon-ngu.mjs bắt được, 11 ngôn
 * ngữ). Ngưỡng phụ thuộc độ dài tên nên ĐO THẬT chứ không đặt cứng một con số.
 */
const h1El = ref<HTMLElement | null>(null);
const tenEl = ref<HTMLElement | null>(null);
const anTen = ref(false);
/** Hệ số cỡ chữ của tên (1 = cỡ gốc). Thiếu chỗ thì THU NHỎ trước, chỉ ẩn khi nhỏ
 *  tới TEN_NHO_NHAT vẫn không vừa — máy Android 360px với điểm "15k" từng mất hẳn
 *  tên trong khi chỉ thiếu vài px (chủ dự án báo 14.10.2026). */
const tenCo = ref(1);
const TEN_NHO_NHAT = 0.72;
/** Chỗ cho đèn debug sau tên: gap 8px của .brand − 3px lề âm + chấm 10px (khớp `.den-debug`). */
const DEN_RONG = 15;
function doTen(): void {
  const h = h1El.value, ten = tenEl.value;
  if (!h || !ten) return;
  // Bề rộng CẦN = logo + khoảng cách + chữ (đo cả khi đang ẩn: scrollWidth của span vẫn đúng)
  const logo = h.querySelector('.logo')?.getBoundingClientRect().width ?? 30;
  const goc = ten.scrollWidth / tenCo.value;          // bề rộng ở cỡ gốc
  const den = props.debug ? DEN_RONG : 0;               // chấm debug đứng sau tên
  const co = (h.clientWidth - logo - 8 - den) / goc;
  tenCo.value = Math.min(1, Math.max(TEN_NHO_NHAT, Math.floor(co * 100) / 100));
  anTen.value = co < TEN_NHO_NHAT;
}
let ro: ResizeObserver | undefined;
onMounted(() => {
  if (typeof ResizeObserver === 'function' && h1El.value) { ro = new ResizeObserver(doTen); ro.observe(h1El.value); }
  doTen();
  // Font chữ (woff2 đóng gói sẵn) vẫn tới SAU lần đo đầu: đo bằng font dự phòng rộng hơn là
  // tên bị ẩn oan, mà bề rộng h1 không đổi nên ResizeObserver không gọi lại.
  document.fonts?.ready.then(doTen).catch(() => { /* không có Font Loading API */ });
});
onUnmounted(() => ro?.disconnect());
watch(ngonNgu, () => nextTick(doTen));

let henBao: ReturnType<typeof setTimeout> | undefined;
/** Bài nhạc premium chưa mua: báo "sắp ra mắt" một lúc thay vì đổi. */
const baoPlusNhac = ref(false);
function chonNhac(b: 'off' | BaiNhac): void {
  if (b !== 'off' && !baiChoiDuoc(b)) {
    baoPlusNhac.value = true; clearTimeout(henBao); henBao = setTimeout(() => { baoPlusNhac.value = false; }, 2500);
    return;
  }
  emit('set-nhac', b);
}
const open = ref(false);
const menuEl = ref<HTMLElement | null>(null);
function dong(): void { open.value = false; }
/** Menu đang hiện bảng chọn ngôn ngữ thay cho danh sách cài đặt; đóng menu là về danh sách. */
const chonNN = ref(false);
watch(open, (v) => { if (!v) chonNN.value = false; else if (kiemCN.value !== 'dang') kiemCN.value = ''; });

/*
 * KIỂM TRA CẬP NHẬT (mockup duyệt 16.11.2026): chỉ app (web luôn là bản mới khi tải lại). Menu ở
 * lại trong lúc kiểm, kết quả ghi ngay bên phải dòng; có bản mới thì đóng menu, lib/ota phủ
 * "Đang cập nhật" và khởi động lại — ở bất kỳ màn nào, vì người dùng tự bấm.
 */
const banHien = __APP_VERSION__;
const kiemCN = ref<'' | 'dang' | 'moiNhat' | 'matMang' | 'cuQua'>('');
async function kiemCapNhat(): Promise<void> {
  if (kiemCN.value === 'dang') return;
  kiemCN.value = 'dang';
  const { kiemTraThuCong } = await import('@/lib/ota');
  const kq = await kiemTraThuCong();
  if (kq === 'coBan') { kiemCN.value = ''; dong(); trangCd.value = false; return; }
  kiemCN.value = kq === 'web' ? 'moiNhat' : kq;
}
const tenNN = computed(() => NGON_NGU.find((l) => l.id === ngonNgu.value)?.ten ?? '');
/* Hộp mọc NGAY DƯỚI nút Ngôn ngữ, mép phải thẳng nút (chủ dự án: "đúng vị trí bấm, không xa quá");
   không đủ chỗ phía dưới thì đẩy lên cho lọt cột game. Toạ độ tính theo #app (nơi teleport tới). */
const nnHop = ref<HTMLElement | null>(null);
const viTriNN = ref<Record<string, string>>({});
function moNN(e: MouseEvent): void {
  const app = document.getElementById('app');
  const nut = (e.currentTarget as HTMLElement).getBoundingClientRect();
  if (!app) { chonNN.value = true; return; }
  const a = app.getBoundingClientRect();
  const rong = Math.min(340, a.width - 16);
  const phai = Math.min(Math.max(8, a.right - nut.right), a.width - rong - 8);
  viTriNN.value = { top: `${nut.bottom - a.top + 6}px`, right: `${phai}px`, width: `${rong}px` };
  chonNN.value = true;
  void nextTick(() => {
    const h = nnHop.value?.offsetHeight ?? 0;
    const top = nut.bottom - a.top + 6;
    const tran = a.height - h - 8;
    if (top > tran) viTriNN.value = { ...viTriNN.value, top: `${Math.max(8, tran)}px` };
  });
}
const nnEl = ref<HTMLElement | null>(null);
function ngoai(e: PointerEvent): void {
  // Bấm trong hộp chọn ngôn ngữ (nằm ngoài menu vì teleport) KHÔNG phải bấm ra ngoài menu
  if (nnEl.value?.contains(e.target as Node)) return;
  if (open.value && menuEl.value && !menuEl.value.contains(e.target as Node)) dong();
}
onMounted(() => document.addEventListener('pointerdown', ngoai, true));
onUnmounted(() => document.removeEventListener('pointerdown', ngoai, true));
// Nút Back của máy đóng menu trước mọi thứ khác (cùng mức với hộp thoại)
useBackCloser(31, () => chonNN.value, () => { chonNN.value = false; });
useBackCloser(30, () => open.value, dong);

/* ---------- TRANG CÀI ĐẶT (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 5) ---------- */
const trangCd = ref(false);
function moTrangCd(): void {
  dong();
  if (kiemCN.value !== 'dang') kiemCN.value = '';
  tbKq.value = '';
  trangCd.value = true;
}
useBackCloser(30, () => trangCd.value && !chonNN.value, () => { trangCd.value = false; });
/** Chuông "Báo khi có phòng" — cùng lib với chuông ở màn Online; kết quả hiện ngay dưới dòng. */
const tbDangLam = ref(false);
const tbKq = ref<'' | 'bat' | 'chan' | 'loi' | 'tat'>('');
async function bamChuong(): Promise<void> {
  if (tbDangLam.value) return;
  tbDangLam.value = true;
  try {
    if (dangBat.value) { await tatChuong(); tbKq.value = 'tat'; return; }
    tbKq.value = await batChuong();
  } finally { tbDangLam.value = false; }
}

const soundIcon = computed(() =>
  props.soundLevel === 'off' ? VolumeX : props.soundLevel === 'low' ? Volume1 : Volume2);

/** Số đang hiển thị — chạy dần lên số thật để người chơi THẤY điểm được cộng. */
const shown = ref(props.totalScore);
/** Bong bóng "+N" bay lên mỗi lần điểm tăng. */
const gain = ref<{ amount: number; key: number } | null>(null);
const bump = ref(0);
let raf = 0;
let gainTimer: ReturnType<typeof setTimeout> | undefined;

// Bật/tắt debug đổi chỗ cần cho tên (đèn sau tên) mà bề rộng h1 không đổi → đo lại tay
watch(() => props.debug, () => nextTick(doTen));
watch(() => props.totalScore, (to, from) => {
  const delta = to - from;
  if (delta > 0) {
    gain.value = { amount: delta, key: (gain.value?.key ?? 0) + 1 };
    bump.value++;
    clearTimeout(gainTimer);
    gainTimer = setTimeout(() => { gain.value = null; }, 1500);
  }
  // Điểm nhảy thẳng sang số mới thì không ai kịp nhận ra là mình vừa được cộng
  cancelAnimationFrame(raf);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || delta <= 0) { shown.value = to; return; }
  const dur = Math.min(1200, 380 + Math.abs(delta) * 1.6);
  const t0 = performance.now();
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);            // chậm dần về cuối
    shown.value = Math.round(from + delta * eased);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
});

/*
 * HẠNG TUẦN TRÊN VIÊN XU (20.11.2026, mockup duyệt https://claude.ai/artifact/4GKeTS7QbeoLB2XV3phdne) — lib/hang-xu.ts.
 * Ít gọi server: khởi động app một lần (`hoiLanDau`); điểm mình vừa tăng → một lần khi đã ra khỏi ván (`diemDoi` gom mọi
 * lần cộng trong ván, 1,5 giây cho điểm khách kịp lên server); mở bảng xếp hạng. Hạng ĐỔI (`doiHangCho`) thì khi BẢNG
 * ĐÓNG (`bxhMo` false) và đang ngoài ván (`dungYen`) mới diễn — diễn sau lớp phủ là không ai thấy:
 *  · lên hạng: chip nảy + loé vàng + sóng sáng, số chạy từ hạng cũ tới mới, ▲N xanh bay lên, "tưng" (sfx.lenHang);
 *  · bị vượt: chip lắc nhẹ, ▼N đỏ, "tạch" buồn xíu (sfx.xuongHang) — chủ dự án: không phạt;
 *  · lần đầu có hạng tuần này: cúp trống → có số, nảy + sóng sáng, ba nốt (sfx.coHang). KHÔNG chữ (chủ dự án bỏ "Có hạng!").
 * Bỏ bóng chữ "Lên hạng #129 (↑8)" cũ. Mẹo "bấm vào đây…" một lần đời máy, sau khi đã có xu.
 */
const doiHang = ref<{ kieu: KieuDoiHang; n: number; key: number } | null>(null);
/** Số đang hiện trên chip — chạy từ hạng cũ tới hạng mới khi diễn. */
const hangHien = ref<number | null>(hangXu.value);
watch(hangXu, (v) => { if (!doiHang.value) hangHien.value = v; });
const meo = ref(false);
let doiTimer: ReturnType<typeof setTimeout> | undefined;
let doiRaf = 0;
function dien(): void {
  const c = doiHangCho.value;
  if (!c || props.dungYen || props.bxhMo) return;
  doiHangCho.value = null;
  doiHang.value = { kieu: c.kieu, n: c.tu ? Math.abs(c.tu - c.den) : 0, key: (doiHang.value?.key ?? 0) + 1 };
  meo.value = false;
  if (c.kieu === 'len') sfx.lenHang(); else if (c.kieu === 'xuong') sfx.xuongHang(); else sfx.coHang();
  // Số chạy từ hạng cũ (lần đầu: từ hạng mới luôn) tới hạng mới trong 0,6 giây
  cancelAnimationFrame(doiRaf);
  const tu = c.tu ?? c.den, bd = performance.now();
  const chay = (t: number): void => {
    const k = Math.min(1, (t - bd) / 600);
    hangHien.value = Math.round(tu + (c.den - tu) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) doiRaf = requestAnimationFrame(chay);
  };
  doiRaf = requestAnimationFrame(chay);
  clearTimeout(doiTimer);
  doiTimer = setTimeout(() => { doiHang.value = null; hangHien.value = hangXu.value; }, 2400);
}
function xemMeo(): void {
  if (props.account && !props.dungYen && !props.bxhMo && props.totalScore > 0 && !daXemMeoXu() && !doiHang.value) meo.value = true;
}
onMounted(() => { xemMeo(); if (props.account) void hoiLanDau(); });
watch(() => props.account, (co) => { if (co) void hoiLanDau(); });   // tài khoản sẵn sàng sau khi dựng
let diemDoi = false;
let hoiTimer: ReturnType<typeof setTimeout> | undefined;
function hoiNeuDiemDoi(): void {
  if (!diemDoi || !props.account || props.dungYen) return;
  diemDoi = false;
  clearTimeout(hoiTimer);
  hoiTimer = setTimeout(() => { void hoiSauDiem(); }, 1500);
}
watch(() => props.totalScore, (to, from) => { if (to > from) { diemDoi = true; hoiNeuDiemDoi(); } });
watch(() => props.dungYen, hoiNeuDiemDoi);
watch(() => [doiHangCho.value, props.dungYen, props.bxhMo, props.totalScore, props.account], () => { dien(); xemMeo(); });
onUnmounted(() => { clearTimeout(doiTimer); clearTimeout(hoiTimer); cancelAnimationFrame(doiRaf); });
function moBxh(): void {
  if (meo.value) { meo.value = false; tatMeoXu(); }
  emit('xep-hang');
}
function hieuMeo(): void { meo.value = false; tatMeoXu(); }
</script>

<template>
  <header class="topbar">
    <h1 ref="h1El" :class="{ 'an-ten': anTen }" :style="{ '--ten-co': tenCo }">
      <button data-phang class="brand" type="button" :aria-label="`${t('tb.thuongHieu')} — ${t('tb.veTrangChu')}`" @click="$emit('home')">
        <!-- Hai lá bài chồng nghiêng — emoji 🃏 mỗi máy vẽ một kiểu, không dùng
             được làm dấu hiệu thương hiệu. Khung CỐ ĐỊNH 30×30 để không giãn
             kín header khi nằm trong flex. -->
        <span class="logo" aria-hidden="true">
          <i class="card-l" /><i class="card-r" />
        </span><span ref="tenEl" class="name">{{ t('tb.thuongHieu') }}</span><b v-if="debug" class="den-debug" />
      </button>
    </h1>

    <!-- BẤM ĐƯỢC (19.11.2026): mở Bảng xếp hạng — mockup https://claude.ai/artifact/CYPTEG9edvmDEgEGFuEnzy -->
    <div class="xu-wrap">
    <button class="total thach" :class="{ pop: bump, len: doiHang && doiHang.kieu !== 'xuong' }" :key="bump" type="button"
      :title="t('tb.tongDiem', { n: num(totalScore) })"
      :aria-label="t('tb.moBxh', { n: num(totalScore) }) + (account && hangXu ? ` · ${t('tb.hangTuan', { n: num(hangXu) })}` : '')" @click="moBxh">
      <!-- Đồng xu = ĐIỂM, cùng hình với HUD (sao chỉ là đánh giá Chiến dịch) -->
      <DongXu :size="16" />
      <b>{{ numShort(shown) }}</b>
      <!-- Huy hiệu HẠNG TUẦN: cúp + SỐ (không "#"). Chưa có hạng tuần này → chỉ cúp. Hiệu ứng theo `doiHang`. -->
      <span v-if="account" :key="doiHang?.key" class="hg" :class="doiHang?.kieu" aria-hidden="true"><Trophy :size="11" :stroke-width="2.6" />{{ hangHien ? numShort(hangHien) : '' }}<i v-if="doiHang && doiHang.n" class="mui">{{ doiHang.kieu === 'xuong' ? '▼' : '▲' }}{{ numShort(doiHang.n) }}</i></span>
      <i v-if="doiHang && doiHang.kieu !== 'xuong'" :key="`t${doiHang.key}`" class="tia" aria-hidden="true" />
      <Transition name="gain">
        <i v-if="gain" :key="gain.key" class="gain" aria-hidden="true">+{{ num(gain.amount) }}</i>
      </Transition>
    </button>
    <Transition name="nhac-xu">
      <div v-if="meo && !doiHang" class="nhac-xu meo-xu" role="note">
        {{ t('tb.meoXu') }}
        <button type="button" class="ok thach th-vang th-nho" @click="hieuMeo">{{ t('tb.daHieu') }}</button>
      </div>
    </Transition>
    </div>
    <!-- Viên danh hiệu RIÊNG, không ghép vào viên điểm: hai thước đo khác nhau,
         ghép chung thì "536k · 10/103" đọc thành một con số khó hiểu. -->
    <button
      v-if="danhHieu" class="dh thach th-do" type="button"
      :aria-label="`${danhHieu.co}/${danhHieu.tong} — ${t('tb.danhHieuAria', { co: danhHieu.co, tong: danhHieu.tong })}`"
      @click="$emit('danh-hieu')"
    >
      <!-- Lá bài nhỏ thay huy chương 🏅 (chủ dự án duyệt 19.10.2026, kiểu "vệt sáng quét"): đúng mặt lưng
           của game + sao 3D. Chỉ động ngoài ván (`dungYen`) — trong ván đừng kéo mắt khỏi bàn thẻ. -->
      <span class="the-mini" :class="{ dong: !dungYen }" aria-hidden="true"><i /></span><b>{{ danhHieu.co }}/{{ danhHieu.tong }}</b>
    </button>
    <div ref="menuEl" class="menu-wrap">
      <button
        class="btn menu-btn" :class="{ in: signedIn }"
        :aria-label="t('tb.menu')" aria-haspopup="menu" :aria-expanded="open"
        type="button" @click="open = !open"
      >
        <img v-if="avatar" :src="avatar" alt="" referrerpolicy="no-referrer">
        <Menu v-else :size="22" />
      </button>
      <!--
        HAI KHỐI (duyệt 11.10.2026): trên là TÀI KHOẢN (ai đang chơi), dưới là
        CÀI ĐẶT dạng công tắc — người chơi thấy trạng thái cả ba thứ một lúc
        thay vì phải bấm xoay vòng để đoán. Bấm công tắc thì menu ở lại.
      -->
      <div v-if="open" class="menu" role="menu" @keydown.esc="dong">
        <button
          v-if="account" class="item tk thach" role="menuitem" type="button"
          :aria-label="signedIn ? t('tb.tkCuaBan') : t('tb.dangNhap')"
          @click="dong(); $emit('account')"
        >
          <img v-if="avatar" :src="avatar" alt="" referrerpolicy="no-referrer">
          <UserRound v-else :size="20" />
          <span class="tk-chu"><b>{{ signedIn ? (tenTk || t('tb.taiKhoan')) : t('tb.dangNhap') }}</b>
            <small>{{ signedIn ? t('tb.hoSoXepHang') : t('tb.giuDiem') }}</small></span>
        </button>

        <div class="nhom-hang">
          <p class="nhom" role="presentation" @pointerup="chamCaiDat">{{ t('tb.caiDat') }}</p>
          <!-- Debug đang bật: nút vào TRANG debug riêng (DebugDialog) — menu không chứa công cụ debug -->
          <button data-phang v-if="debug" class="nut-debug" role="menuitem" type="button" @click="dong(); emit('mo-debug')"><Bug :size="14" :stroke-width="2.5" aria-hidden="true" /> Debug</button>
        </div>
        <!-- Giao diện = Sáng/Tối của Kẹo (chủ dự án 17.10.2026: chỉ còn Kẹo cho người chơi; skin
             khác chọn ở trang Debug). Skin không có nền tối (Gỗ…) thì chỉ còn dòng chữ. -->
        <div class="item am" role="group" :aria-label="t('tb.giaoDien')">
          <!-- Cũng là cửa bật debug (7 chạm) — chữ "Cài đặt" nhỏ quá, hay chạm trượt (16.10.2026) -->
          <Palette :size="20" /><span class="cham-debug" @pointerup="chamCaiDat">{{ t('tb.giaoDien') }}</span>
          <span v-if="coNenToi(skin)" class="nac">
            <button data-phang
              v-for="n in (['tu', 'sang', 'toi'] as const)" :key="n" type="button" role="menuitemradio"
              :aria-checked="nen === n" :aria-label="`${t('tb.nen')}: ${td(`tb.nenNgan.${n}`)}`"
              @click="$emit('set-nen', n)"
            >{{ td(`tb.nenNgan.${n}`) }}</button>
          </span>
        </div>
        <div class="item am" role="group" :aria-label="t('tb.amThanh')">
          <component :is="soundIcon" :size="20" /><span>{{ t('tb.amThanh') }}</span>
          <span class="nac">
            <button data-phang
              v-for="l in (['off', 'low', 'high'] as const)" :key="l" type="button" role="menuitemradio"
              :aria-checked="soundLevel === l" :aria-label="td(`tb.am.${l}`)"
              @click="$emit('set-sound', l)"
            >{{ td(`tb.amNgan.${l}`) }}</button>
          </span>
        </div>
        <!-- Nhạc nền: Tắt · từng bài (lib/nhac.ts), cùng dạng nút chia đoạn với Âm thanh.
             Nhãn bài là biểu tượng — khỏi dịch, khỏi tràn menu; tên đầy đủ ở aria-label.
             MỘT HÀNG như Âm thanh khi ≤ 3 bài (chủ dự án 15.10.2026); nhiều hơn (bày cả bài
             Premium) thì HAI TẦNG — chữ trên, dải nút chia đều dưới: một hàng 6 nút làm menu
             phình 371px và lòi khỏi iPhone SE (do:safari bắt, 15.10.2026). -->
        <div class="item am nhac" :class="{ 'hai-tang': baiHien.length > 3 }" role="group" :aria-label="t('tb.nhacNen')">
          <Music :size="20" /><span>{{ t('tb.nhacNen') }}</span>
          <span class="nac ds-nhac">
            <button data-phang
              type="button" role="menuitemradio" :aria-checked="!nhac"
              :aria-label="td('tb.nhacBai.off')" @click="chonNhac('off')"
            >{{ td('tb.amNgan.off') }}</button>
            <button data-phang
              v-for="b in baiHien" :key="b" type="button" role="menuitemradio" class="bai"
              :class="{ khoa: !baiChoiDuoc(b) }"
              :aria-checked="!!nhac && baiNhac === b"
              :aria-label="baiChoiDuoc(b) ? td(`tb.nhacBai.${b}`) : `${td(`tb.nhacBai.${b}`)} — ${t('tb.skinPlus')}`"
              @click="chonNhac(b)"
            >
              <component :is="ICON_BAI[b]" :size="16" :stroke-width="2.4" aria-hidden="true" /><Crown v-if="!baiChoiDuoc(b)" class="o-khoa" :size="10" aria-hidden="true" /></button>
          </span>
        </div>
        <p v-if="baoPlusNhac" class="bao-plus" role="status">{{ t('tb.skinPlus') }}</p>
        <hr class="ke" />
        <!-- TRANG CÀI ĐẶT (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU mục 5 — chủ dự án:
             "cài đặt bắt đầu nhiều rồi"): menu chỉ giữ 3 thứ hay đổi (Giao diện, Âm thanh, Nhạc); Rung, Ngôn ngữ,
             Nhận lời mời, Báo khi có phòng, Cập nhật, Cài app vào trang riêng chia nhóm. -->
        <button class="item thach" role="menuitem" type="button" @click="moTrangCd">
          <Settings2 :size="20" /><span class="tk-chu"><b>{{ t('tb.caiDat') }}</b><small>{{ t('cd.moTa') }}</small></span><ChevronRight :size="18" aria-hidden="true" />
        </button>
        <button class="item thach" role="menuitem" :aria-label="t('tb.luatChoi')" type="button" @click="dong(); $emit('rules')">
          <HelpCircle :size="20" /><span>{{ t('tb.luatChoi') }}</span>
        </button>
      </div>
    </div>
  </header>
  <!-- TRANG CÀI ĐẶT — mở từ dòng "Cài đặt ›" của menu. Nằm trong #app như bảng ngôn ngữ (bảng đó nổi ĐÈ lên trang này). -->
  <Teleport to="#app">
    <div v-if="trangCd" class="cd-phu" @click.self="trangCd = false">
      <section class="cd-trang khay" role="dialog" aria-modal="true" :aria-label="t('tb.caiDat')">
        <header class="cd-dau">
          <button class="nn-dong thach" type="button" :aria-label="t('dhd.dong')" @click="trangCd = false"><ChevronLeft :size="20" /></button>
          <h2>{{ t('tb.caiDat') }}</h2>
        </header>
        <div class="cd-than">
          <p class="nhom">{{ t('tb.amThanh') }}</p>
          <div class="cd-the">
            <div class="item am thach" role="group" :aria-label="t('tb.amThanh')">
              <span class="cd-o cd-troi" aria-hidden="true"><component :is="soundIcon" :size="18" /></span><span>{{ t('tb.amThanh') }}</span>
              <span class="nac">
                <button data-phang
                  v-for="l in (['off', 'low', 'high'] as const)" :key="l" type="button" role="menuitemradio"
                  :aria-checked="soundLevel === l" :aria-label="td(`tb.am.${l}`)"
                  @click="$emit('set-sound', l)"
                >{{ td(`tb.amNgan.${l}`) }}</button>
              </span>
            </div>
            <!-- Nhạc nền: Tắt · từng bài (lib/nhac.ts), cùng dạng nút chia đoạn với Âm thanh.
                 Nhãn bài là biểu tượng — khỏi dịch, khỏi tràn menu; tên đầy đủ ở aria-label.
                 MỘT HÀNG như Âm thanh khi ≤ 3 bài (chủ dự án 15.10.2026); nhiều hơn (bày cả bài
                 Premium) thì HAI TẦNG — chữ trên, dải nút chia đều dưới: một hàng 6 nút làm menu
                 phình 371px và lòi khỏi iPhone SE (do:safari bắt, 15.10.2026). -->
            <div class="item am nhac thach" :class="{ 'hai-tang': baiHien.length > 3 }" role="group" :aria-label="t('tb.nhacNen')">
              <span class="cd-o cd-tim" aria-hidden="true"><Music :size="18" /></span><span>{{ t('tb.nhacNen') }}</span>
              <span class="nac ds-nhac">
                <button data-phang
                  type="button" role="menuitemradio" :aria-checked="!nhac"
                  :aria-label="td('tb.nhacBai.off')" @click="chonNhac('off')"
                >{{ td('tb.amNgan.off') }}</button>
                <button data-phang
                  v-for="b in baiHien" :key="b" type="button" role="menuitemradio" class="bai"
                  :class="{ khoa: !baiChoiDuoc(b) }"
                  :aria-checked="!!nhac && baiNhac === b"
                  :aria-label="baiChoiDuoc(b) ? td(`tb.nhacBai.${b}`) : `${td(`tb.nhacBai.${b}`)} — ${t('tb.skinPlus')}`"
                  @click="chonNhac(b)"
                >
                  <component :is="ICON_BAI[b]" :size="16" :stroke-width="2.4" aria-hidden="true" /><Crown v-if="!baiChoiDuoc(b)" class="o-khoa" :size="10" aria-hidden="true" /></button>
              </span>
            </div>
            <p v-if="baoPlusNhac" class="bao-plus" role="status">{{ t('tb.skinPlus') }}</p>
            <!-- Rung: công tắc trở lại 17.10.2026. Giấu khi máy không rung được (web trên
                 iPhone): công tắc không làm gì là công tắc nói dối. -->
            <button
              v-if="coRung" class="item cong-tac thach" role="menuitemcheckbox" type="button"
              :aria-checked="!!rung" :aria-label="rung ? t('tb.rungBat') : t('tb.rungTat')"
              @click="$emit('toggle-rung')"
            >
              <span class="cd-o cd-cam" aria-hidden="true"><SmartphoneNfc :size="18" /></span><span>{{ t('tb.rung') }}</span><i class="sw" :class="{ bat: rung }" aria-hidden="true" />
            </button>

          </div>
          <p class="nhom">{{ t('cd.hienThi') }}</p>
          <div class="cd-the">
            <!-- Giao diện = Sáng/Tối của Kẹo (chủ dự án 17.10.2026: chỉ còn Kẹo cho người chơi; skin
                 khác chọn ở trang Debug). Skin không có nền tối (Gỗ…) thì chỉ còn dòng chữ. -->
            <div class="item am thach" role="group" :aria-label="t('tb.giaoDien')">
              <!-- Cũng là cửa bật debug (7 chạm) — chữ "Cài đặt" nhỏ quá, hay chạm trượt (16.10.2026) -->
              <span class="cd-o cd-hong" aria-hidden="true"><Palette :size="18" /></span><span class="cham-debug" @pointerup="chamCaiDat">{{ t('tb.giaoDien') }}</span>
              <span v-if="coNenToi(skin)" class="nac">
                <button data-phang
                  v-for="n in (['tu', 'sang', 'toi'] as const)" :key="n" type="button" role="menuitemradio"
                  :aria-checked="nen === n" :aria-label="`${t('tb.nen')}: ${td(`tb.nenNgan.${n}`)}`"
                  @click="$emit('set-nen', n)"
                >{{ td(`tb.nenNgan.${n}`) }}</button>
              </span>
            </div>
            <!-- Ngôn ngữ: đổi TỨC THÌ, menu ở lại — lựa chọn nhớ ở localStorage (lib/i18n.ts) -->
            <div class="item am thach" role="group" :aria-label="t('tb.ngonNgu')">
              <span class="cd-o cd-ngoc" aria-hidden="true"><Languages :size="18" /></span><span>{{ t('tb.ngonNgu') }}</span>
              <button class="chon-nn thach" type="button" :aria-label="`${t('tb.ngonNgu')}: ${tenNN}`" @click="moNN($event)">
                <span :lang="ngonNgu">{{ tenNN }}</span><ChevronRight :size="16" aria-hidden="true" />
              </button>
            </div>

          </div>
          <p class="nhom">{{ t('cd.online') }}</p>
          <div class="cd-the">
            <!-- Nhận lời mời chơi (lib/sanh.ts) — tắt là app thôi giữ kết nối sảnh, không ai thấy mình để mời -->
            <button class="item cong-tac thach" role="switch" type="button" :aria-checked="nhanLoiMoi" @click="datNhanLoiMoi(!nhanLoiMoi)">
              <span class="cd-o cd-tim" aria-hidden="true"><MailPlus :size="18" /></span><span class="tk-chu"><b>{{ t('cd.nhanMoi') }}</b><small>{{ t('cd.nhanMoiMo') }}</small></span><i class="sw" :class="{ bat: nhanLoiMoi }" aria-hidden="true" />
            </button>
            <!-- Gợi ý thi đấu (lib/thidau.ts, 22.11.2026) — tắt là không nhận thẻ hỏi "Thi đấu online?" lẫn tin đẩy thi đấu -->
            <button v-if="coThiDau" class="item cong-tac thach" role="switch" type="button" :aria-checked="goiYThiDau" @click="datGoiYThiDau(!goiYThiDau)">
              <span class="cd-o cd-do" aria-hidden="true"><Swords :size="18" /></span><span class="tk-chu"><b>{{ t('cd.goiYTd') }} <i class="cd-moi">{{ t('cd.moi') }}</i></b><small>{{ t('cd.goiYTdMo') }}</small></span><i class="sw" :class="{ bat: goiYThiDau }" aria-hidden="true" />
            </button>
            <!-- Báo khi có phòng: CÙNG công tắc với chuông ở màn Online (lib/thong-bao.ts) — chỉ app có push -->
            <button v-if="coChuong" class="item cong-tac thach" role="switch" type="button" :aria-checked="dangBat" :disabled="tbDangLam" @click="bamChuong">
              <span class="cd-o cd-vang" aria-hidden="true"><Bell :size="18" /></span><span class="tk-chu"><b>{{ t('cd.baoPhong') }}</b><small :class="{ loi: tbKq === 'chan' || tbKq === 'loi' }">{{ tbKq ? t(tbKq === 'bat' ? 'on.tb.daBat' : tbKq === 'chan' ? 'on.tb.biChan' : tbKq === 'tat' ? 'on.tb.daTat' : 'on.tb.loi') : t('cd.baoPhongMo') }}</small></span><i class="sw" :class="{ bat: dangBat }" aria-hidden="true" />
            </button>
          </div>
          <p class="nhom">{{ t('cd.ungDung') }}</p>
          <div class="cd-the">
            <button v-if="laApp" class="item kiem-cn thach" type="button" :aria-busy="kiemCN === 'dang'" @click="kiemCapNhat">
              <span class="cd-o cd-xanh" aria-hidden="true"><RefreshCw :size="18" /></span><span>{{ t('tb.kiemCapNhat') }}</span>
              <small class="kq-cn" :class="kiemCN" role="status">
                <span v-if="kiemCN === 'dang'" class="cham" :aria-label="t('tb.dangKiem')"><i /><i /><i /></span>
                <template v-else-if="kiemCN === 'moiNhat'">{{ t('tb.moiNhat') }}</template>
                <template v-else-if="kiemCN === 'matMang'">{{ t('tb.matMang') }}</template>
                <template v-else-if="kiemCN === 'cuQua'">{{ t('tb.canBanStore') }}</template>
                <template v-else>{{ banHien }}</template>
              </small>
            </button>
            <div v-if="!laApp" class="item am thach"><span class="cd-o cd-xam" aria-hidden="true"><Info :size="18" /></span><span>{{ t('cd.phienBan') }}</span><small class="kq-ban">{{ banHien }}</small></div>
            <button v-if="nenMoiCai" class="item thach" type="button" @click="trangCd = false; moCai()">
              <span class="cd-o cd-troi" aria-hidden="true"><Smartphone :size="18" /></span><span>{{ t('cai.menu') }}</span><ChevronRight :size="18" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
  <!-- BẢNG CHỌN NGÔN NGỮ (17.10.2026, chủ dự án: <select> gốc mở danh sách hệ điều hành "dài quá";
       bản đổi ruột menu thì "ẩn menu dưới không hợp lý" + ô hẹp vỡ chữ). Hộp RIÊNG nổi giữa cột,
       menu vẫn mở phía sau. Lưới 3×5 = đúng 15 ngôn ngữ, tròn hàng, không cuộn. Tên viết bằng CHÍNH
       ngôn ngữ đó; KHÔNG cờ (cờ Đài Loan cho zh-TW bị luật 4+ cấm). Teleport vào #app: header có
       backdrop-filter nên `fixed` bên trong bị nhốt theo header. role=dialog + aria-modal để cập
       nhật nóng không tải lại giữa lúc đang chọn (lib/ota.ts). -->
  <Teleport to="#app">
    <div v-if="chonNN" ref="nnEl" class="nn-phu" role="dialog" aria-modal="true" :aria-label="t('tb.ngonNgu')"
      @click.self="chonNN = false" @keydown.esc.stop="chonNN = false">
      <div ref="nnHop" class="nn-hop khay" :style="viTriNN">
        <div class="nn-dau">
          <Languages :size="22" /><span>{{ t('tb.ngonNgu') }}</span>
          <button class="nn-dong thach" type="button" :aria-label="t('dhd.dong')" @click="chonNN = false"><X :size="20" /></button>
        </div>
        <div class="bang-nn">
          <button
            v-for="l in NGON_NGU" :key="l.id" type="button" role="radio" class="o-nn thach th-chon"
            :aria-checked="ngonNgu === l.id" :lang="l.id"
            @click="ngonNgu = l.id; chonNN = false"
          >{{ l.ten }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.topbar {
  /* backdrop-filter biến header thành stacking context riêng; không có z-index
     thì <main> đứng sau trong DOM vẽ ĐÈ lên menu thả xuống dù menu đặt z-index
     bao nhiêu (đã xảy ra thật trên iPhone). 15: trên bàn thẻ, dưới hộp thoại 20.
     tools/do-menu-tren.mjs đo elementFromPoint để canh. */
  position: relative; z-index: 15;
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
/* Wordmark co cỡ chữ theo bề rộng máy: máy hẹp (320px) không xuống 2 dòng
   làm TopBar cao gấp đôi, cũng không bị cắt chữ */
h1 { flex: 1; min-width: 0; margin: 0; font-size: clamp(17px, 5.2vw, var(--text-xl)); font-weight: 800; }
.brand {
  position: relative;
  display: flex; align-items: center; gap: var(--sp-2);
  border: 0; background: none; padding: 0;
  font: inherit; cursor: pointer;
  min-width: 0; max-width: 100%;
}
/* Logo cao 30px nhưng là nút VỀ TRANG CHỦ, nên vùng chạm phải đủ 44px (NF-07).
   Nới bằng ::after chứ đừng phình cái logo lên — header cao thêm là bàn thẻ hụt
   đi đúng chừng ấy. 30 + 7×2 = 44. */
.brand::after { content: ''; position: absolute; inset: -7px -4px; }
/* Khung cố định — bắt buộc tường minh, để tự do trong flex là nó giãn kín header */
.logo {
  position: relative; flex-shrink: 0;
  width: 30px; height: 30px;
  display: inline-block;
}
.logo i {
  position: absolute; top: 4px;
  width: 17px; height: 23px; border-radius: 5px;
  box-shadow: 0 2px 6px rgba(30, 27, 75, .25);
}
/* Đèn chế độ debug: chấm nhỏ NGAY SAU tên (chủ dự án 14.10.2026), nháy vàng ↔
   xanh mỗi 1 giây. Phép đo ẩn tên (doTen) trừ sẵn DEN_RONG cho nó; tên bị ẩn thì
   chấm đứng cạnh logo, vẫn thấy. */
.den-debug {
  flex: 0 0 auto; width: 10px; height: 10px; margin-left: -3px; border-radius: 50%;
  border: 1.5px solid #fff; background: #ffcc00; box-sizing: border-box;
  animation: den-debug 2s steps(1, end) infinite;
}
@keyframes den-debug { 50% { background: #34c759; } }
@media (prefers-reduced-motion: reduce) { .den-debug { animation: none; } }
.logo .card-l {
  left: 0; transform: rotate(-14deg);
  background: var(--chon-nen);
}
.logo .card-r {
  right: 0; transform: rotate(12deg);
  background: linear-gradient(150deg, #c44cf0, #ff5099);
}
/* Tên game KHÔNG được co: nó là dấu hiệu thương hiệu, cắt mất một chữ còn tệ
   hơn là huy hiệu điểm phải gọn lại (xem numShort). */
.an-ten .name { position: absolute; visibility: hidden; pointer-events: none; }
.name {
  flex-shrink: 0;
  font-size: calc(1em * var(--ten-co, 1));   /* thu cả chữ đều tay — không cắt chữ nào */
  background: linear-gradient(100deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  white-space: nowrap;
}
/* Huy hiệu điểm không bao giờ bị flex nén hay ngắt dòng */
/* Viên điểm nền PANEL (trắng ở skin sáng): nền vàng cũ nuốt mất đồng xu vàng —
   chủ dự án chọn trắng 17.10.2026. Cặp token panel/fg nên skin tối tự lật. */
.total {
  position: relative;
  flex-shrink: 0; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px 4px 8px; border-radius: var(--r-full);
  color: var(--fg);
  background: var(--panel-solid);
  box-shadow: var(--elev-1);
  font: inherit; cursor: pointer;
}
.total b {
  font-family: var(--font-display); font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: var(--text-md); color: inherit;
}
.total .dong-xu { flex-shrink: 0; }
/* Điểm vừa tăng: viên nảy một nhịp */
.total.pop { animation: total-pop .3s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes total-pop { 45% { transform: scale(1.12); } }
/* Bong bóng "+N" trôi XUỐNG dưới huy hiệu — bay lên thì tràn khỏi đỉnh
   viewport (và bị cột desktop overflow:hidden cắt mất) */
.gain {
  position: absolute; left: 50%; top: calc(100% + 2px);
  transform: translateX(-50%);
  font-style: normal; font-family: var(--font-display); font-weight: 800;
  font-size: var(--text-md); color: #f0a500;
  text-shadow: 0 2px 8px rgba(240, 165, 0, .55);
  pointer-events: none;
}
.gain-enter-active { animation: gain-fly 1.5s ease-out forwards; }
.gain-leave-active { display: none; }
@keyframes gain-fly {
  0% { opacity: 0; transform: translate(-50%, -8px) scale(.7); }
  18% { opacity: 1; transform: translate(-50%, 0) scale(1.15); }
  70% { opacity: 1; transform: translate(-50%, 8px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, 20px) scale(.95); }
}
/* Huy hiệu hạng + hiệu ứng lên hạng + lời nhắc (19.11.2026) */
.xu-wrap { position: relative; flex-shrink: 0; display: flex; }
.hg {
  display: inline-flex; align-items: center; gap: 2px; margin-left: 1px; padding: 1px 6px 1px 4px;
  border-radius: var(--r-full); background: #fff1c7; color: #8a5a00;
  font: 800 12px var(--font-display); font-variant-numeric: tabular-nums;
}
.hg:has(svg:only-child) { padding: 2px 4px; }
.total.len { animation: total-pop .6s cubic-bezier(.2, 1.5, .4, 1); }
.hg { position: relative; }
.hg.len, .hg.moi { animation: hg-loe 1.6s ease-out; }
.hg.xuong { animation: hg-lac .5s ease-in-out; }
/* ▲N / ▼N bay lên trên chip rồi mờ */
.hg .mui { position: absolute; bottom: calc(100% + 2px); right: -4px; font: 800 11px var(--font-display); font-style: normal; white-space: nowrap; pointer-events: none; animation: mui-bay 2.2s ease-out forwards; text-shadow: 0 1px 0 var(--panel-solid); }
.hg.len .mui { color: #1f9a46; }
.hg.xuong .mui { color: #c2513f; }
@keyframes hg-lac { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
@keyframes mui-bay { 0% { opacity: 0; transform: translateY(6px); } 15%, 75% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-8px); } }
.tia { position: absolute; inset: -3px; border-radius: var(--r-full); pointer-events: none; animation: tia-song 1.3s ease-out 2; }
@keyframes hg-loe { 20%, 60% { background: #ffd84d; transform: scale(1.12); } }
@keyframes tia-song { 0% { box-shadow: 0 0 0 0 rgba(255, 200, 40, .75); } 100% { box-shadow: 0 0 0 14px rgba(255, 200, 40, 0); } }
.nhac-xu {
  /* Căn GIỮA theo viên xu: canh phải thì tràn mép trái màn 390px (đo 19.11.2026). Dưới "+N" bay xuống. */
  position: absolute; top: calc(100% + 30px); left: 50%; translate: -50% 0; z-index: 6; margin: 0;
  width: max-content; max-width: min(280px, 80vw); padding: 8px 12px; border-radius: 14px;
  background: var(--panel-solid); color: var(--fg); border: 2px solid #f0c64a; box-shadow: 0 4px 0 #e2b13a;
  font: 700 13px/1.35 var(--font-body); cursor: pointer;
}
.meo-xu { top: calc(100% + 12px); background: #1d2a5a; color: #fff; border-color: #1d2a5a; box-shadow: 0 8px 18px rgba(0, 0, 0, .25); cursor: default; }
.meo-xu::before {
  content: ''; position: absolute; left: calc(50% - 8px); top: -9px;
  border: 8px solid transparent; border-top: 0; border-bottom-color: #1d2a5a;
}
.meo-xu .ok { display: block; margin-top: 8px; min-height: 30px; padding: 0 14px; border-radius: 10px; font: 800 13px var(--font-body); cursor: pointer; }
.nhac-xu-enter-active { transition: opacity .2s ease, translate .2s ease; transition-delay: .9s; }
.nhac-xu-leave-active { transition: opacity .25s ease; }
.nhac-xu-enter-from { opacity: 0; }
.nhac-xu-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .total.len, .hg.len, .hg.moi, .hg.xuong, .hg .mui, .tia { animation: none; }
  .nhac-xu-enter-active { transition: none; }
}
/* Máy rất hẹp (320px): nới chỗ cho wordmark bằng cách thu padding/gap,
   không thu chữ thêm nữa — dưới 17px là khó đọc */
@media (max-width: 359px) {
  .topbar { gap: 6px; padding: var(--sp-2); }
  .total { padding: 4px 8px; }
}
/* Máy Android phổ biến 360–400px: hai viên điểm gọn lại một nấc để TÊN game còn
   chỗ (đo: 360px với "15k" + "16/103" thì tên thu tới 72% vẫn không vừa). */
@media (max-width: 400px) {
  .topbar { gap: 6px; }
  .total { padding-inline: 7px 8px; gap: 3px; }
  .dh { padding-inline: 5px 7px; gap: 2px; }
  .total b, .dh b { font-size: calc(var(--text-md) * .88); }
}
.menu-wrap { position: relative; flex-shrink: 0; }
/* Cùng dáng viên điểm nhưng tím: nhìn là biết hai viên, hai thứ khác nhau */
.dh {
  position: relative; flex-shrink: 0; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 0; min-width: 0; padding: 4px 9px 4px 6px; border: 0; border-radius: var(--r-full);
  background: var(--nhan-nen); color: var(--nhan-chu);
  font: inherit; cursor: pointer;
}
/* Lá bài nhỏ trên viên danh hiệu: mặt lưng xanh viền giấy trắng + sao 3D, nghiêng nhẹ. */
.the-mini {
  position: relative; flex: none; width: 15px; height: 20px; margin-block: -2px; border-radius: 3.5px;
  background: linear-gradient(#3d63c9, #1a3172); border: 1.5px solid #fdfdfb; box-shadow: 0 1.5px 0 rgba(0, 0, 0, .28);
  transform: rotate(-10deg); overflow: hidden;
}
.the-mini i { position: absolute; inset: 3px 1px; background: var(--sao-3d, url('/img/sao-3d.svg')) center / contain no-repeat; }
/* Vệt sáng chéo quét qua mỗi 3,5 giây + lá nhún một nhịp — bắt mắt mà không nhấp nháy liên tục */
.the-mini.dong { animation: the-nhun 3.5s ease-in-out infinite; }
.the-mini.dong::after {
  content: ''; position: absolute; inset: -30% -60%;
  background: linear-gradient(110deg, transparent 42%, rgba(255, 255, 255, .9) 50%, transparent 58%);
  transform: translateX(-70%); animation: the-quet 3.5s ease-in-out infinite;
}
@keyframes the-quet { 0%, 62% { transform: translateX(-70%); } 100% { transform: translateX(70%); } }
@keyframes the-nhun { 0%, 60%, 100% { transform: rotate(-10deg); } 75% { transform: rotate(-4deg) scale(1.12); } }
@media (prefers-reduced-motion: reduce) { .the-mini.dong, .the-mini.dong::after { animation: none; } }
.dh b { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; font-size: var(--text-md); }
/* Viên cao ~30px; vùng chạm phải đủ 44px (NF-07) */
.dh::after { content: ''; position: absolute; inset: -7px -3px; }
.menu-btn img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
.menu-btn.in { border-color: var(--accent); }
/* Thả xuống dưới nút, canh phải; z trên bàn thẻ và dưới hộp thoại (20) */
.menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 15;
  min-width: 200px; padding: 6px; border-radius: 14px;
  background: var(--panel-solid); border: 1px solid var(--line);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .28);
  display: grid; gap: 2px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px;
  background: none; color: var(--fg); font: inherit; font-weight: 700; text-align: left;
  cursor: pointer; white-space: nowrap;
}
.menu { min-width: 236px; }
/* Nhãn dài (tiếng Nga "Оформление · Светлый · Тёмный") làm menu nở quá mép trái màn SE (lố 5px, do:ngon-ngu
   18.10.2026): trần bề ngang = màn trừ lề hai bên. */
.menu { max-width: calc(100vw - 24px); }
/* Khối debug làm menu dài ra: cuộn TRONG menu, không bao giờ lòi khỏi màn */
.menu { max-height: calc(var(--app-h, 100dvh) - 90px); overflow-y: auto; overscroll-behavior: contain; }
.nhom, .cham-debug { touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.nhom-hang { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.nhom-hang .nhom { flex: 1; }
/* Nút vào trang debug: viên nhỏ viền đứt màu đỏ — công cụ soi lỗi, không phải tính năng */
.nut-debug {
  position: relative; margin: 4px 8px 0 0; padding: 2px 8px; min-height: 0; min-width: 0;
  border: 1px dashed var(--bad); border-radius: 999px; background: none; color: var(--bad);
  font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap;
}
.nut-debug::after { content: ''; position: absolute; inset: -10px -6px; }
.item.tk { min-height: 52px; }
/* NỔI KHỐI (11.11.2026): dòng BẤM ĐƯỢC của menu (tài khoản, cài app, luật chơi) là phím thạch
   trắng; dòng cài đặt có công tắc/nấc giữ nền phẳng — chính công tắc/nấc đã nổi khối. */
.item.thach { border-radius: 14px; margin: 2px 0 6px; }
.kiem-cn .kq-cn { margin-left: auto; font-size: 12px; font-weight: 700; opacity: .7; white-space: nowrap; font-variant-numeric: tabular-nums; }
.kiem-cn .kq-cn.moiNhat { color: #15803d; opacity: 1; }
.kiem-cn .cham { display: inline-flex; gap: 3px; }
.kiem-cn .cham i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: cham-nhay 1s ease-in-out infinite; }
.kiem-cn .cham i:nth-child(2) { animation-delay: .15s; } .kiem-cn .cham i:nth-child(3) { animation-delay: .3s; }
@keyframes cham-nhay { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .kiem-cn .cham i { animation: none; } }
.tk-chu { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.tk-chu small { font-weight: 600; font-size: 12px; color: var(--muted); }
.nhom { margin: 6px 12px 2px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.ke { border: 0; border-top: 1px solid var(--line); margin: 4px 6px; }
.item > span:not(.nac):not(.tk-chu) { flex: 1; }
/* Công tắc: đổi màu TỨC THÌ (luật thiết kế: trạng thái chọn không transition màu) */
.sw { position: relative; flex: 0 0 auto; width: 38px; height: 22px; border-radius: 999px; background: var(--line); }
.sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); }
.sw.bat { background: var(--nhan-nen); }
.sw.bat::after { left: 19px; }
.item.am { cursor: default; }
.chon-nn {
  display: inline-flex; align-items: center; gap: 4px; max-width: 150px; min-height: 36px; padding: 0 8px 0 12px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel-soft); color: var(--fg);
  font: inherit; font-size: 13px; font-weight: 800; cursor: pointer;
}
.chon-nn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nn-phu { position: absolute; inset: 0; z-index: 20; background: rgba(6, 9, 18, .3); }
.nn-hop {
  position: absolute; padding: 14px 14px 16px; border-radius: 22px;
  background: var(--panel-solid); color: var(--fg); box-shadow: var(--elev-3);
}
.nn-dau { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 18px; font-weight: 800; }
.nn-dau > span { flex: 1; }
.nn-dong {
  position: relative; display: grid; place-items: center; width: 38px; height: 38px; padding: 0;
  border: 1px solid var(--line); border-radius: 50%; background: var(--panel-soft); color: var(--fg); cursor: pointer;
}
.nn-dong::after { content: ''; position: absolute; inset: -4px; }
.bang-nn { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.o-nn {
  min-height: 46px; padding: 3px 4px; border: 1px solid var(--line); border-radius: 14px;
  background: var(--panel-soft); color: var(--fg); font: inherit; font-size: 14px; font-weight: 800;
  /* chỉ xuống dòng ở KHOẢNG TRẮNG — bẻ giữa từ ra "Françai-s" (đã chụp thấy) */
  line-height: 1.15; text-align: center; overflow-wrap: normal; word-break: keep-all; hyphens: none; cursor: pointer;
}
.o-nn[aria-checked='true'] { background: var(--chon-nen); color: var(--chon-chu); border-color: transparent; }
.o-khoa { position: absolute; top: 3px; right: 3px; color: var(--gold); }
.bao-plus { margin: -2px 10px 8px; font-size: 12px; font-weight: 800; color: var(--accent); text-align: center; }
.nac { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; flex: 0 0 auto; }
.nac button {
  position: relative; min-height: 30px; min-width: 38px; padding: 0 8px; border: 0; background: transparent;
  color: var(--muted); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
}
.nac button::after { content: ''; position: absolute; inset: -7px 0; }
/* Máy hẹp (Android 360px) + nhãn dài (tiếng Nga): nút chọn co đệm, không để khung menu cắt mất nút cuối */
@media (max-width: 380px) {
  .item.am { gap: 8px; }
  .nac { flex: 0 1 auto; min-width: 0; }
  .nac button { padding: 0 5px; min-width: 30px; white-space: nowrap; }
}
.nac button[aria-checked='true'] { background: var(--nhan-nen); color: var(--nhan-chu); }
.nac button.bai { font-size: 15px; }
.item.nhac.hai-tang { flex-wrap: wrap; row-gap: 6px; padding-block: 8px; }
.item.nhac.hai-tang .nac.ds-nhac { flex: 1 0 100%; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.item.nhac.hai-tang .ds-nhac button { min-width: 0; padding: 0 4px; }
/* Một hàng: nút bài (biểu tượng) hẹp hơn nút chữ để cả dải vừa bằng dải Âm thanh */
.item.nhac:not(.hai-tang) .ds-nhac button.bai { min-width: 34px; padding: 0 6px; }
.item.nhac:not(.hai-tang) > span:not(.nac) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
@media (hover: hover) { .item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); } }
.item:active { background: color-mix(in srgb, var(--accent) 18%, transparent); }

/* ---------- TRANG CÀI ĐẶT (21.11.2026) — dưới bảng ngôn ngữ (.nn-phu z 20) để chọn ngôn ngữ nổi đè lên ---------- */
.cd-phu { position: absolute; inset: 0; z-index: 19; background: rgba(6, 9, 18, .35); display: flex; justify-content: center; align-items: stretch; }
.cd-trang {
  width: 100%; max-width: 520px; display: flex; flex-direction: column; min-height: 0; box-sizing: border-box;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px calc(env(safe-area-inset-bottom, 0px) + 14px);
  background: var(--bg); color: var(--fg);
}
.cd-dau { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.cd-dau h2 { margin: 0; font: 800 21px var(--font-display); }
.cd-than { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 2px; padding-bottom: 8px; }
/* NỔI KHỐI (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 1): mỗi dòng là một khối thạch
   như dòng "Bộ thẻ"/"Luật bàn" ở màn chọn bàn, icon trong ô màu, công tắc + dải chọn có độ lõm/nổi. Luật chỉ áp trong
   .cd-trang — menu ☰ dùng chung .item/.sw/.nac vẫn giữ dáng cũ. */
.cd-the { display: grid; gap: 7px; }
.cd-the .item.thach { white-space: normal; min-height: 54px; padding: 7px 12px 9px; border-radius: 16px; margin: 0; gap: 11px; width: 100%; box-sizing: border-box; }
.cd-the .item.am.thach { cursor: default; }
.cd-the .item > span:not(.nac):not(.tk-chu):not(.cd-o) { font: 800 16px var(--font-display); }
.cd-the .tk-chu small { white-space: normal; }
.cd-the .tk-chu small.loi { color: var(--bad); }
.cd-the .item.cong-tac .tk-chu { flex: 1; }
.cd-than .nhom { margin: 12px 6px 5px; }
.cd-o {
  flex: none; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: #fff; margin-bottom: 3px;
  background: linear-gradient(var(--o-a), var(--o-b)); box-shadow: 0 3px 0 var(--o-c), inset 0 1px 0 rgba(255, 255, 255, .4);
}
/* thắng luật chung `.item > span:not(.nac):not(.tk-chu) { flex: 1 }` — không thì ô icon giãn hết dòng */
.cd-the .item.thach > span.cd-o { flex: 0 0 34px; }
.cd-troi { --o-a: #6cc4ff; --o-b: #2f8fe6; --o-c: #1f6fc0; } .cd-tim { --o-a: #9d8fff; --o-b: #6a5cff; --o-c: #4b3fd1; }
.cd-cam { --o-a: #ffb25e; --o-b: #f5861f; --o-c: #c96510; } .cd-hong { --o-a: #ff8fb3; --o-b: #ef4f86; --o-c: #c23566; }
.cd-ngoc { --o-a: #5fd8c4; --o-b: #1fa893; --o-c: #168574; } .cd-xam { --o-a: #aab3cc; --o-b: #7d88a8; --o-c: #646f8f; }
.cd-do { --o-a: #ff8f70; --o-b: #e0533a; --o-c: #b13c27; } .cd-xanh { --o-a: #5fd27f; --o-b: #2f9e57; --o-c: #227a41; }
.cd-vang { --o-a: #ffd35a; --o-b: #f0a816; --o-c: #c0820b; color: #5a3d00; }
.cd-the .sw { width: 48px; height: 28px; background: #c5cde6; box-shadow: inset 0 2px 3px rgba(20, 30, 70, .22); }
.cd-the .sw::after { width: 22px; height: 22px; top: 2px; left: 3px; box-shadow: 0 2px 0 #aeb6d0, 0 3px 5px rgba(0, 0, 0, .2); }
.cd-the .sw.bat { background: linear-gradient(#5fd27f, #2f9e57); box-shadow: inset 0 2px 3px rgba(0, 60, 20, .3); }
.cd-the .sw.bat::after { left: 23px; box-shadow: 0 2px 0 #cfe9d6, 0 3px 5px rgba(0, 0, 0, .2); }
:global([data-theme='dark'] .cd-the .sw:not(.bat)) { background: #2a3566; box-shadow: inset 0 2px 3px rgba(0, 0, 0, .45); }
:global([data-theme='dark'] .cd-the .sw:not(.bat)::after) { background: #dfe5ff; box-shadow: 0 2px 0 #8d97c4; }
.cd-the .nac { border: 0; padding: 3px; gap: 2px; background: rgba(30, 45, 110, .1); box-shadow: inset 0 2px 3px rgba(20, 30, 70, .18); overflow: visible; }
:global([data-theme='dark'] .cd-the .nac) { background: rgba(0, 0, 0, .28); box-shadow: inset 0 2px 3px rgba(0, 0, 0, .4); }
.cd-the .nac button { border-radius: 999px; min-height: 28px; }
.cd-the .nac button[aria-checked='true'] { background: linear-gradient(#5fd27f, #2f9e57); color: #fff; box-shadow: 0 2px 0 #227a41, inset 0 1px 0 rgba(255, 255, 255, .4); }
.cd-the .item.nhac.hai-tang .nac.ds-nhac { margin-left: 45px; flex-basis: calc(100% - 45px); }
.cd-moi { font: 800 9.5px var(--font-body); font-style: normal; letter-spacing: .4px; padding: 2px 6px; border-radius: 999px; background: #ff5c7a; color: #fff; vertical-align: 2px; }
.kq-ban { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.item:disabled { opacity: .6; cursor: default; }
</style>
