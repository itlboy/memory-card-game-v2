<script setup lang="ts">
import { ChevronRight, Crown, HelpCircle, Languages, Menu, Music, Palette, SmartphoneNfc, UserRound, Volume1, Volume2, VolumeX, X } from 'lucide-vue-next';
import { coNenToi, skin } from '@/lib/skin';
import { ICON_BAI, baiChoiDuoc, baiHien, type BaiNhac } from '@/lib/nhac';
import { NGON_NGU, ngonNgu, t, td } from '@/lib/i18n';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackCloser } from '@/composables/useBackGuard';
import { num, numShort } from '@/lib/format';
import DongXu from './DongXu.vue';
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
  /** Chế độ debug đang bật — đèn nháy vàng/đỏ ở góc logo để không quên tắt. */
  debug?: boolean;
}>();
const emit = defineEmits<{ 'set-nen': ['tu' | 'sang' | 'toi']; 'cycle-sound': []; 'set-sound': [SoundLevel]; 'set-nhac': ['off' | BaiNhac]; 'toggle-rung': []; home: []; rules: []; account: []; 'danh-hieu': [];
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
watch(open, (v) => { if (!v) chonNN.value = false; });
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

    <span class="total thach" :class="{ pop: bump }" :key="bump" :title="t('tb.tongDiem', { n: num(totalScore) })">
      <!-- Đồng xu = ĐIỂM, cùng hình với HUD (sao chỉ là đánh giá Chiến dịch) -->
      <DongXu :size="16" />
      <b>{{ numShort(shown) }}</b>
      <Transition name="gain">
        <i v-if="gain" :key="gain.key" class="gain" aria-hidden="true">+{{ num(gain.amount) }}</i>
      </Transition>
    </span>
    <!-- Viên danh hiệu RIÊNG, không ghép vào viên điểm: hai thước đo khác nhau,
         ghép chung thì "536k · 10/103" đọc thành một con số khó hiểu. -->
    <button
      v-if="danhHieu" class="dh thach th-do" type="button"
      :aria-label="`${danhHieu.co}/${danhHieu.tong} — ${t('tb.danhHieuAria', { co: danhHieu.co, tong: danhHieu.tong })}`"
      @click="$emit('danh-hieu')"
    >
      <span aria-hidden="true">🏅</span><b>{{ danhHieu.co }}/{{ danhHieu.tong }}</b>
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
        <button data-phang
          v-if="account" class="item tk" role="menuitem" type="button"
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
          <button data-phang v-if="debug" class="nut-debug" role="menuitem" type="button" @click="dong(); emit('mo-debug')">🐞 Debug</button>
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
            >{{ ICON_BAI[b] }}<Crown v-if="!baiChoiDuoc(b)" class="o-khoa" :size="10" aria-hidden="true" /></button>
          </span>
        </div>
        <p v-if="baoPlusNhac" class="bao-plus" role="status">{{ t('tb.skinPlus') }}</p>
        <!-- Rung: công tắc trở lại 17.10.2026. Giấu khi máy không rung được (web trên
             iPhone): công tắc không làm gì là công tắc nói dối. -->
        <button data-phang
          v-if="coRung" class="item cong-tac" role="menuitemcheckbox" type="button"
          :aria-checked="!!rung" :aria-label="rung ? t('tb.rungBat') : t('tb.rungTat')"
          @click="$emit('toggle-rung')"
        >
          <SmartphoneNfc :size="20" /><span>{{ t('tb.rung') }}</span><i class="sw" :class="{ bat: rung }" aria-hidden="true" />
        </button>

        <!-- Ngôn ngữ: đổi TỨC THÌ, menu ở lại — lựa chọn nhớ ở localStorage (lib/i18n.ts) -->
        <div class="item am" role="group" :aria-label="t('tb.ngonNgu')">
          <Languages :size="20" /><span>{{ t('tb.ngonNgu') }}</span>
          <button class="chon-nn thach" type="button" :aria-label="`${t('tb.ngonNgu')}: ${tenNN}`" @click="moNN($event)">
            <span :lang="ngonNgu">{{ tenNN }}</span><ChevronRight :size="16" aria-hidden="true" />
          </button>
        </div>

        <hr class="ke" />
        <button data-phang class="item" role="menuitem" :aria-label="t('tb.luatChoi')" type="button" @click="dong(); $emit('rules')">
          <HelpCircle :size="20" /><span>{{ t('tb.luatChoi') }}</span>
        </button>
      </div>
    </div>
  </header>
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
.dh span { font-size: 14px; line-height: 1; }
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
</style>
