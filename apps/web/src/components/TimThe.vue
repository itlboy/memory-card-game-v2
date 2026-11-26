<script setup lang="ts">
/**
 * MÀN TÌM THẺ — kiểu chơi không ghép cặp (26.11.2026, bản chơi thử chủ dự án duyệt:
 * https://claude.ai/artifact/ESzywRX1pBqhx72tD1u1tz). Luật ở engine (`tim-the.ts`, `VanTimThe`).
 *
 * Một lượt đi qua năm NHỊP: `xem` (cả bàn ngửa) → `up` (úp, nghỉ một nhịp — chỉ của màn hình) →
 * `noi` (thẻ cần tìm hiện TO CHÍNH GIỮA BÀN trên lớp mờ, chưa chạm được, KHÔNG tính giờ chọn) →
 * `hoi` (chạm một lần) → `dap-an` (cả bàn ngửa: thẻ đúng viền xanh, chọn sai viền đỏ).
 * Nhịp `noi` (27.11.2026, chủ dự án duyệt https://claude.ai/artifact/45faUe94GByb1Qp2Q7C6fy): thẻ cần tìm chỉ ở bảng
 * trên cùng làm mắt rời khỏi bàn, mất tập trung — giờ nó hiện đúng chỗ mắt đang nhìn rồi tan tại chỗ.
 * Đồng hồ tự cộng `dt` trong vòng rAF nên TẠM DỪNG là đứng hẳn (không dùng setTimeout cho nhịp ván).
 * Thanh giờ ghi thẳng `transform` — Vue chỉ vẽ lại khi nhịp / lựa chọn đổi (`rev`).
 */
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  BOT_SPECS, TIM_THE_DAP_AN_MS, TIM_THE_NOI_MS, TIM_THE_SO_LUOT, TIM_THE_UP_MS, VanTimThe, timTheSoCot,
  type TimTheKetQua
} from '@mm/engine';
import {
  bayBan, docChon, docKyLuc, ghiKyLuc,
  type TimTheBoDo, type TimTheChon, type TimTheKetVan
} from '@/lib/tim-the';
import { anhEmoji, chonCoAnh, laKyTuChu, taiTruocAnh } from '@/lib/emoji';
import { hoSo, mauKhac, tenToi } from '@/lib/ho-so';
import { tenBot } from '@/lib/ten';
import { sfx } from '@/lib/audio';
import { moChucNang } from '@/lib/phan-tich';
import { rung } from '@/lib/rung';
import { bcp, t, td } from '@/lib/i18n';
import { num } from '@/lib/format';
import DongXu from './DongXu.vue';
import MatBot from './MatBot.vue';
import TamDung from './TamDung.vue';
import { Check, Ellipsis, Pause, TimerOff, Trophy, X, Zap } from 'lucide-vue-next';

const props = defineProps<{
  /** Hình của bộ thẻ người chơi đang chọn (đã loại trùng). Thiếu thì dùng bộ dự phòng. */
  hinh: string[];
}>();
const emit = defineEmits<{
  thoat: [];
  'bat-dau': [chon: TimTheChon];
  'ket-thuc': [kq: TimTheKetVan];
}>();

const TOI = 'p1';
const MAY = 'bot';
const DU_PHONG = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐷', '🐰', '🐨', '🐯', '🐮', '🐙', '🦄', '🐻', '🐔', '🦉', '🐢'];

const chon = ref<TimTheChon>(docChon());
const kyLuc = ref(docKyLuc(chon.value.soThe, chon.value.doKho));

const giayGon = (ms: number): string => (ms / 1000).toLocaleString(bcp(), { maximumFractionDigits: 1 });
/** Giây CHỌN: dưới 1 giây hiện 2 chữ số, sàn 0,01 — "0s" là vô lý (chủ dự án 27.11.2026: "Làm gì có 0 giây"). */
const giayChon = (ms: number): string => (Math.max(10, ms) / 1000).toLocaleString(bcp(), { maximumFractionDigits: ms < 1000 ? 2 : 1, minimumFractionDigits: ms < 1000 ? 2 : 0 });
const tenDoiThu = computed(() => (chon.value.doiThu === 'mot' ? t('tt.motMinh') : tenBot(chon.value.doiThu)));

/* ---------- ván ---------- */
const van = shallowRef<VanTimThe | null>(null);
const rev = ref(0);
/** KHÔNG còn màn cấu hình riêng (27.11.2026): số thẻ / độ khó / đối thủ chọn ở màn Chơi nhanh / Đấu với máy
 *  (ChonTimThe) — vào màn này là vào ván ngay; `dau` chỉ là nhịp trước khi `onMounted` chia bàn. */
const buoc = ref<'dau' | 'choi' | 'dung' | 'cuoi'>('dau');
type Nhip = 'xem' | 'up' | 'noi' | 'hoi' | 'dap-an';
const nhip = ref<Nhip>('xem');
const chonCuaToi = ref<number | null>(null);
const ketToi = ref<TimTheKetQua | null>(null);
const ketVan = ref<TimTheKetVan | null>(null);
/** ms đã trôi trong nhịp hiện tại / trong cả ván — KHÔNG tính lúc tạm dừng. */
let tNhip = 0;
let tVan = 0;
let soDaChon = 0;
let giayCu = -1;

const dsThe = computed(() => { void rev.value; return van.value ? [...van.value.the] : []; });
const soCot = ref(timTheSoCot(chon.value.soThe));
const ngua = computed(() => nhip.value === 'xem' || nhip.value === 'dap-an');
const toi = computed(() => { void rev.value; return van.value?.nguoi.find((p) => p.id === TOI) ?? null; });
const heSo = computed(() => { void rev.value; return van.value?.heSoKe(TOI) ?? 1; });
const nhieu = computed(() => !!van.value?.nhieuNguoi);

interface NguoiHien { id: string; ten: string; mat: string; mau: string; diem: number; tt: '' | 'da' | 'dung' | 'nhanh' | 'sai' | 'het'; cong: number; giay: string }
const nguoiHien = computed((): NguoiHien[] => {
  void rev.value;
  const v = van.value;
  if (!v) return [];
  return v.nguoi.map((p) => {
    const kq = nhip.value === 'dap-an' ? v.ketLuot?.ketQua.find((k) => k.id === p.id) : undefined;
    const tt = kq
      ? (kq.ketCuc === 'dung' ? (kq.nhanhNhat ? 'nhanh' : 'dung') : kq.ketCuc === 'sai' ? 'sai' : 'het')
      : nhip.value === 'hoi' && v.daChon(p.id, tNhip) ? 'da' : '';
    return {
      id: p.id, ten: p.id === TOI ? (tenToi.value || t('tt.ban')) : p.ten, diem: p.diem, tt, cong: kq?.diem ?? 0, giay: kq && kq.ms !== null ? giayChon(kq.ms) : '',
      mat: p.may ? BOT_SPECS[p.may].avatar : hoSo.value.mat, mau: p.may ? mauKhac(0) : hoSo.value.mau
    };
  });
});
const ICON_TT = { da: Ellipsis, dung: Check, nhanh: Zap, sai: X, het: TimerOff } as const;

const bangKq = computed(() => {
  const k = ketToi.value;
  if (!k) return null;
  if (k.ketCuc !== 'dung') return { ic: k.ketCuc === 'sai' ? 'saiRoi' : 'hetGio', chu: t(k.ketCuc === 'sai' ? 'tt.sai' : 'tt.hetGio'), phu: t('tt.xemDapAn') } as const;
  const s = giayChon(k.ms ?? 0);
  const dau = k.nhanhNhat ? t('tt.nhanhNhat', { s }) : t('tt.chonTrong', { s });
  return {
    ic: k.nhanhNhat ? 'nhanhNhat' : 'dungRoi', chu: t('tt.dung', { n: num(k.diem) }),
    phu: k.heSo > 1 ? `${dau} · ${t('tt.chuoi', { n: k.chuoi, hs: k.heSo.toLocaleString(bcp()) })}` : dau
  } as const;
});

/* ---------- kích thước bàn (luật KHÔNG CUỘN: thẻ co theo chỗ trống) ---------- */
const ban = ref<HTMLElement | null>(null);
const laW = ref(72);
const KHE = 10;
let ro: ResizeObserver | undefined;
function doBan(): void {
  const el = ban.value;
  if (!el) return;
  const b = bayBan(van.value?.cfg.soThe ?? chon.value.soThe, el.clientWidth, el.clientHeight, KHE);
  soCot.value = b.cot; laW.value = b.w;
}
const coAnh = computed(() => chonCoAnh(laW.value * 0.62));

/* ---------- vòng lặp ---------- */
let raf = 0;
let truoc = 0;
let hen: ReturnType<typeof setTimeout>[] = [];

function vaoNhip(n: Nhip): void { nhip.value = n; tNhip = 0; giayCu = -1; rev.value++; }

function khung(ms: number): void {
  const dt = Math.min(100, ms - truoc);
  truoc = ms;
  const v = van.value;
  if (v && buoc.value === 'choi') {
    tNhip += dt; tVan += dt;
    if (nhip.value === 'xem' && tNhip >= v.xemMs) { vaoNhip('up'); sfx.swap(); }
    else if (nhip.value === 'up' && tNhip >= TIM_THE_UP_MS) { vaoNhip('noi'); sfx.turn(); }
    else if (nhip.value === 'noi' && tNhip >= TIM_THE_NOI_MS) { v.moHoi(); soDaChon = 0; vaoNhip('hoi'); }
    else if (nhip.value === 'hoi') {
      const k = v.nguoi.filter((p) => v.daChon(p.id, tNhip)).length;
      if (k !== soDaChon) { soDaChon = k; rev.value++; }
      if (tNhip >= v.chotLuc) chot(v);
    } else if (nhip.value === 'dap-an' && tNhip >= TIM_THE_DAP_AN_MS) {
      if (v.tiep()) luotMoi(v); else ketThuc(v);
    }
    veGio(v);
  }
  raf = requestAnimationFrame(khung);
}

/** Không có thanh giờ trên màn (27.11.2026) — giờ chỉ báo bằng tiếng tích ba giây cuối của nhịp hỏi. */
function veGio(v: VanTimThe): void {
  const dai = nhip.value === 'hoi' ? v.chonMs : 0;
  if (!dai) return;
  const s = Math.ceil((dai - tNhip) / 1000);
  if (s !== giayCu) {
    if (giayCu !== -1 && nhip.value === 'hoi' && s <= 3 && s > 0 && chonCuaToi.value === null) sfx.tick();
    giayCu = s;
  }
}

/*
 * ĐIỂM BAY (27.11.2026, chủ dự án: "hiện ngay chỗ lá bài được mở… cho nó bay về phía điểm như việc lật hai thẻ
 * trùng"): chọn đúng thì số giây nằm trên lá vừa chọn, "+điểm" bật lên ở tâm lá rồi bị hút về ô Điểm — CÙNG
 * đường cong `gain-suck` của GameScreen. Ô Điểm chỉ nhảy số khi điểm CẬP BẾN (850ms), như bàn chính.
 */
const gain = ref<{ key: number; i: number; diem: number; s: string } | null>(null);
let gainEl: HTMLElement | null = null;
function datGain(el: unknown): void { gainEl = el instanceof HTMLElement ? el : null; }
const diemHien = ref(0);
const nay = ref(0);
let henBay: ReturnType<typeof setTimeout> | undefined;
async function bayDiem(i: number, diem: number, ms: number): Promise<void> {
  clearTimeout(henBay);
  gain.value = { key: (gain.value?.key ?? 0) + 1, i, diem, s: giayChon(ms) };
  await nextTick();
  const dich = document.querySelector('.tim-the .vien.diem b');
  if (gainEl && dich) {
    const a = gainEl.getBoundingClientRect(), b = dich.getBoundingClientRect();
    gainEl.style.setProperty('--to-x', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
    gainEl.style.setProperty('--to-y', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
  }
  henBay = setTimeout(() => { diemHien.value = toi.value?.diem ?? 0; nay.value++; }, 850);
}

function luotMoi(v: VanTimThe): void {
  chonCuaToi.value = null; ketToi.value = null; gain.value = null;
  taiTruocAnh(v.the, coAnh.value);
  vaoNhip('xem');
  sfx.flip();
}

function batDau(): void {
  hen.forEach(clearTimeout); hen = [];
  const c = chon.value;
  const khac = [...new Set(props.hinh)];
  const hinh = khac.length >= c.soThe ? khac : DU_PHONG;
  const nguoi = [{ id: TOI, ten: tenToi.value || t('tt.ban') }, ...(c.doiThu === 'mot' ? [] : [{ id: MAY, ten: tenBot(c.doiThu), may: c.doiThu }])];
  const v = new VanTimThe({ soThe: c.soThe, doKho: c.doKho }, nguoi, hinh, Math.floor(Math.random() * 0xffffffff));
  van.value = v;
  tVan = 0; ketVan.value = null; diemHien.value = 0; clearTimeout(henBay);
  buoc.value = 'choi';
  doBan();
  luotMoi(v);
  emit('bat-dau', { ...c });
}

function cham(i: number): void {
  const v = van.value;
  if (!v || buoc.value !== 'choi' || nhip.value !== 'hoi' || chonCuaToi.value !== null) return;
  // `tNhip` chỉ cộng theo KHUNG HÌNH — chạm ngay khung đầu của nhịp hỏi thì nó còn 0. Cộng thêm phần đã trôi
  // từ khung trước tới lúc chạm (không quá một khung, như `dt` trong vòng lặp) để ra đúng thời gian thật.
  const them = Math.min(100, Math.max(0, performance.now() - truoc));
  if (!v.chon(TOI, i, Math.min(tNhip + them, v.chonMs))) return;
  chonCuaToi.value = i;
  sfx.select();
  rung.tach();
  rev.value++;
}

function chot(v: VanTimThe): void {
  const kq = v.chot().ketQua.find((k) => k.id === TOI) ?? null;
  ketToi.value = kq;
  if (kq?.ketCuc === 'dung' && kq.viTri != null) void bayDiem(kq.viTri, kq.diem, kq.ms ?? 0);
  vaoNhip('dap-an');
  if (kq?.ketCuc === 'dung') { sfx.match(kq.chuoi); rung.ghep(kq.chuoi); } else { sfx.miss(); rung.sai(); }
}

function ketThuc(v: VanTimThe): void {
  const c = chon.value;
  const p = v.nguoi.find((x) => x.id === TOI)!;
  const may = v.nguoi.find((x) => x.id === MAY);
  const ketQua = !may ? 'xong' : p.diem > may.diem ? 'thang' : p.diem < may.diem ? 'thua' : 'hoa';
  const kyLucMoi = !may && p.diem > 0 && ghiKyLuc(c.soThe, c.doKho, p.diem);
  if (kyLucMoi) kyLuc.value = p.diem;
  const kq: TimTheKetVan = {
    ...c, diem: p.diem, dung: p.dung, soLuot: v.cfg.soLuot, chuoiDai: p.chuoiDai, ketQua, kyLucMoi, giay: Math.round(tVan / 1000)
  };
  ketVan.value = kq;
  buoc.value = 'cuoi';
  rev.value++;
  if (ketQua === 'thua') sfx.defeat(); else if (kyLucMoi) { sfx.win(); sfx.kyLuc(0.6); } else sfx.win();
  emit('ket-thuc', kq);
}

const tieuDeCuoi = computed(() => {
  const k = ketVan.value;
  if (!k) return '';
  if (k.ketQua === 'xong') return k.kyLucMoi ? t('mt.kyLucMoi') : t('tt.xong');
  return t(k.ketQua === 'thang' ? 'tt.thang' : k.ketQua === 'thua' ? 'tt.thua' : 'tt.hoa');
});
const xepHang = computed(() => { void rev.value; return van.value?.xepHang() ?? []; });

function tamDung(): void { if (buoc.value === 'choi') buoc.value = 'dung'; }
function anTrang(): void { if (document.hidden) tamDung(); }

onMounted(() => {
  ro = new ResizeObserver(doBan);
  if (ban.value) ro.observe(ban.value);
  document.addEventListener('visibilitychange', anTrang);
  raf = requestAnimationFrame((ms) => { truoc = ms; raf = requestAnimationFrame(khung); });
  batDau();
});
onUnmounted(() => {
  clearTimeout(henBay);
  ro?.disconnect();
  cancelAnimationFrame(raf);
  hen.forEach(clearTimeout);
  document.removeEventListener('visibilitychange', anTrang);
});

/** Back của máy / nút thoát: đang chơi thì dừng trước, đứng ở lớp phủ thì ra hẳn. */
defineExpose({
  veLai: () => { if (buoc.value === 'choi') tamDung(); else emit('thoat'); },
  /** Ván đang dở (đang chơi hoặc tạm dừng) — bấm logo / đóng tab phải HỎI trước. */
  dangDo: (): boolean => buoc.value === 'choi' || buoc.value === 'dung',
  tamDung,
  /** Số liệu ván đang dở, cho GA `van_bo_do`; không dở thì `null`. */
  boDo: (): TimTheBoDo | null => {
    const v = van.value;
    if (!v || (buoc.value !== 'choi' && buoc.value !== 'dung')) return null;
    return { ...chon.value, luot: v.luot, soLuot: v.cfg.soLuot, giay: Math.round(tVan / 1000) };
  }
});
</script>

<template>
  <section class="tim-the">
    <div class="tt-hud">
      <div :key="nay" class="vien diem" :class="{ nay: nay > 0 }" :title="t('mt.diem')"><DongXu :size="22" /><b>{{ num(diemHien) }}</b></div>
      <div v-if="heSo > 1 && buoc === 'choi'" :key="heSo" class="vien combo" :title="t('tt.heSo')">×{{ heSo.toLocaleString(bcp()) }}</div>
      <span class="gian" />
      <div class="vien luot">{{ t('tt.luot', { n: Math.min((van?.luot ?? 0) + 1, van?.cfg.soLuot ?? TIM_THE_SO_LUOT), tong: van?.cfg.soLuot ?? TIM_THE_SO_LUOT }) }}</div>
      <button class="tron thach nut-dung" type="button" :aria-label="t('hud.tamDung')" :disabled="buoc !== 'choi'" @click="tamDung"><Pause :size="18" /></button>
    </div>

    <div v-if="nhieu" class="tt-nguoi">
      <div v-for="p in nguoiHien" :key="p.id" class="khay-nho ng" :class="{ toi: p.id === TOI }">
        <span class="av" :style="{ background: p.mau }">
          <MatBot :mat="p.mat" />
          <span v-if="p.tt" :key="p.tt" class="huy" :class="p.tt" :aria-label="p.tt === 'da' ? t('tt.daChon') : undefined"><component :is="ICON_TT[p.tt]" :size="11" :stroke-width="3.2" aria-hidden="true" /></span>
        </span>
        <span class="ten">{{ p.ten }}</span>
        <b class="d">{{ num(p.diem) }}</b>
        <span v-if="p.cong" :key="`c${van?.luot}`" class="cong">+{{ num(p.cong) }}</span>
        <span v-if="p.giay" :key="`g${van?.luot}`" class="giay-chip" :class="{ sai: p.tt === 'sai' }">{{ p.giay }}s</span>
      </div>
    </div>

    <!-- KHÔNG có bảng thông báo, KHÔNG thanh giờ (27.11.2026, chủ dự án: "Cứ nháy nháy mất tập trung lắm", "Ng chơi
         hiểu mà", "thanh ghi nhớ thời gian cũng bỏ đi"). Màn chơi CHỈ có bàn thẻ; giờ báo bằng tiếng tích 3 giây cuối.
         Dòng dưới chỉ cho trình đọc màn hình. -->
    <p class="an-di" aria-live="polite">{{ nhip === 'hoi' && van ? `${t('tt.hoi')} ${van.hinhDich}` : bangKq?.chu ?? '' }}</p>
    <div ref="ban" class="tt-ban">
      <div class="luoi" :style="{ gridTemplateColumns: `repeat(${soCot}, ${laW}px)` }">
        <div v-for="(sym, i) in dsThe" :key="`${van?.luot}-${i}`" class="o" :class="{ 'co-gain': gain?.i === i }">
          <button
            class="card" type="button" data-nosfx data-phang
            :class="{
              lat: ngua,
              dung: nhip === 'dap-an' && i === van?.dich,
              sai: nhip === 'dap-an' && i === chonCuaToi && i !== van?.dich,
              cho: nhip === 'hoi' && i === chonCuaToi
            }"
            :aria-label="ngua ? sym : t('tt.theSo', { n: i + 1 })"
            :aria-disabled="nhip !== 'hoi' || chonCuaToi !== null"
            @pointerdown.prevent="cham(i)" @keydown.enter.prevent="cham(i)" @keydown.space.prevent="cham(i)"
          >
            <span class="inner">
              <span class="face back" aria-hidden="true" />
              <span class="face front" :class="{ chu: laKyTuChu(sym) }" aria-hidden="true">
                <img v-if="anhEmoji(sym, undefined, coAnh)" class="emoji" :src="anhEmoji(sym, undefined, coAnh)!" alt="" draggable="false">
                <span v-else class="emoji chu">{{ sym }}</span>
              </span>
            </span>
          </button>
          <template v-if="gain && gain.i === i && nhip === 'dap-an'">
            <span :key="`s${gain.key}`" class="tt-giay" aria-hidden="true">{{ gain.s }}s</span>
            <span :key="`g${gain.key}`" :ref="datGain" class="tt-gain" aria-hidden="true">+{{ num(gain.diem) }}</span>
          </template>
        </div>
      </div>

      <!-- THẺ CẦN TÌM giữa bàn: lớp mờ + thẻ to, tan tại chỗ khi sang nhịp hỏi (không chạm được bàn lúc này) -->
      <Transition name="tt-noi">
        <div v-if="nhip === 'noi' && van && buoc !== 'dau'" :key="van.luot" class="tt-noi" aria-hidden="true">
          <span class="lon">
            <img v-if="anhEmoji(van.hinhDich, undefined, chonCoAnh(108))" :src="anhEmoji(van.hinhDich, undefined, chonCoAnh(108))!" alt="" draggable="false">
            <template v-else>{{ van.hinhDich }}</template>
          </span>
          <b class="nhan-noi">{{ t('tt.timTheNay') }}</b>
        </div>
      </Transition>

      <!-- KẾT QUẢ: phủ trong khung bàn — bàn cuối đã ngửa vẫn thấy phía sau -->
      <div v-if="buoc === 'cuoi' && ketVan" class="tt-phu ket" role="dialog" aria-modal="true" aria-labelledby="ttCuoi">
        <div class="hop khay">
          <h2 id="ttCuoi">{{ tieuDeCuoi }}</h2>
          <ol v-if="ketVan.ketQua !== 'xong'" class="hang">
            <li v-for="p in xepHang" :key="p.id" class="khay-nho" :class="{ toi: p.id === TOI }">
              <span class="so">{{ p.hang }}</span>
              <span class="av" :style="{ background: p.may ? mauKhac(0) : hoSo.mau }"><MatBot :mat="p.may ? BOT_SPECS[p.may].avatar : hoSo.mat" /></span>
              <span class="ten">{{ p.id === TOI ? (tenToi || t('tt.ban')) : p.ten }}</span>
              <b class="d">{{ num(p.diem) }}</b>
            </li>
          </ol>
          <p v-else class="so-to"><DongXu :size="40" />{{ num(ketVan.diem) }}</p>
          <p class="phu-chu">{{ t('tt.ketQua', { n: ketVan.dung, tong: ketVan.soLuot, c: ketVan.chuoiDai }) }}</p>
          <p v-if="ketVan.ketQua === 'xong'" class="phu-chu"><Trophy :size="15" :stroke-width="2.5" class="ic-n" aria-hidden="true" /> {{ t('mt.kyLuc') }}: <b>{{ num(kyLuc) }}</b></p>
          <p v-else-if="ketVan.doiThu === 'easy'" class="phu-chu">{{ t('tt.khongXu', { ten: tenDoiThu }) }}</p>
          <p v-else class="phu-chu xu"><DongXu :size="18" /> <b>+{{ num(ketVan.diem) }}</b></p>
          <button class="btn btn-primary nut-to" type="button" @click="moChucNang('tim_the_choi_lai'); batDau()">{{ t('hud.choiLai') }}</button>
          <!-- Đổi cấu hình = về màn Chơi nhanh / Đấu với máy (nơi chọn số thẻ, độ khó) — cũng là chỗ Thoát về -->
          <button class="btn" type="button" @click="moChucNang('tim_the_doi_cau_hinh'); emit('thoat')">{{ t('tt.doiCauHinh') }}</button>
        </div>
      </div>
    </div>

    <!-- TẠM DỪNG: CÙNG màn với ván thường (TamDung.vue) -->
    <TamDung
      v-if="buoc === 'dung'"
      :so-lieu="[
        { nhan: t('mt.diem'), gt: num(toi?.diem ?? 0) },
        { nhan: t('tt.luotNhan'), gt: `${(van?.luot ?? 0) + 1}/${van?.cfg.soLuot ?? TIM_THE_SO_LUOT}` },
        { nhan: t('tt.dungNhan'), gt: String(toi?.dung ?? 0) }
      ]"
      :tien-do="(van?.luot ?? 0) / (van?.cfg.soLuot ?? TIM_THE_SO_LUOT)"
      @tiep="buoc = 'choi'" @thoat="emit('thoat')"
    />
  </section>
</template>

<style scoped>
.tim-the {
  /* KHÔNG `height: 100%`: <main> không có chiều cao xác định nên % rơi về chiều cao nội dung — màn cấu hình (bàn còn
     trống) co về 0 và mất hẳn (bắt được ở ảnh chụp 26.11.2026). Kéo giãn theo trục chéo của <main> thì luôn đủ cao. */
  position: relative; display: flex; flex-direction: column; gap: 10px; min-height: 0; align-self: stretch; box-sizing: border-box;
}
.tt-hud { display: flex; align-items: center; gap: 6px; flex: none; }
/* Viên số: cùng chất với Mưa Thẻ — thạch trắng (điểm, lượt), thạch hồng (hệ số chuỗi) */
.vien {
  display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 999px;
  font-family: var(--font-display); font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums;
  background: linear-gradient(#fff 20%, #e9effc); color: #1d2a5a;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, .8), 0 3px 0 #b9c6e6, 0 6px 10px rgba(20, 30, 70, .15);
}
.vien.luot { font-size: 15px; padding: 0 12px; }
.vien.combo { background: linear-gradient(#ff9cb2, #ee3a5e); color: #fff; box-shadow: 0 3px 0 #c21f42, 0 6px 10px rgba(20, 30, 70, .15); animation: nay .3s; }
@keyframes nay { 40% { transform: scale(1.25); } }
.vien.diem.nay { animation: nay .3s; }
/* Điểm bay: cùng đường cong `gain-suck` của GameScreen (bàn chính) */
.o.co-gain { z-index: 8; }
.tt-gain {
  --to-x: 0px; --to-y: -120px;
  position: absolute; left: 50%; top: 50%; z-index: 9; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap;
  font-family: var(--font-display); font-weight: 800; font-size: clamp(22px, 6vw, 30px); color: #ffd23a;
  -webkit-text-stroke: 4px #8a5a00; paint-order: stroke; text-shadow: 0 3px 10px rgba(217, 158, 0, .5);
  animation: gain-suck 1.05s cubic-bezier(.35, .05, .3, 1) forwards;
}
@keyframes gain-suck {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); }
  45% { opacity: 1; transform: translate(calc(-50% + var(--to-x) * .18), calc(-50% + var(--to-y) * .18)) scale(1.2); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--to-x)), calc(-50% + var(--to-y))) scale(.45); }
}
/* Số giây chọn: viên nhỏ dính đáy lá vừa chọn, ở lại tới bàn sau */
.tt-giay {
  position: absolute; left: 0; right: 0; bottom: -10px; z-index: 9; width: fit-content; margin: 0 auto; pointer-events: none; white-space: nowrap;
  padding: 2px 10px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 15px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}
.gian { flex: 1; }
.nut-dung { flex: none; width: 44px; height: 44px; min-width: 0; min-height: 0; padding: 0; display: grid; place-items: center; border-radius: 50%; }

/* hai người (bạn + máy): ô nhỏ, mặt trong ô vuông tô đặc màu hồ sơ (phẳng, như bảng xếp hạng) */
.tt-nguoi { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ng { position: relative; display: flex; align-items: center; gap: 8px; padding: 6px 10px; min-width: 0; }
.ng.toi { border-color: #ffc21a; }
.av { position: relative; flex: none; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-size: 19px; }
.ten { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 14px; }
.d { font-family: var(--font-display); font-weight: 800; font-size: 17px; font-variant-numeric: tabular-nums; }
.huy {
  position: absolute; right: -6px; bottom: -5px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
  color: #fff; border: 2px solid var(--k-nen, #fff); box-sizing: border-box; animation: no .25s both;
}
.huy.da { background: #7d88a8; } .huy.dung { background: #2f9e57; } .huy.nhanh { background: #f0a816; color: #5a3d00; }
.huy.sai, .huy.het { background: #e0533a; }
/* GIÂY CHỌN trên khung điểm (27.11.2026, chủ dự án: "hiện cả thời gian chọn… cho người xem cũng thấy"): mỗi người đã chọn
   có viên số giây ở góc dưới khung tới hết đáp án — xanh nếu đúng, xám nếu sai */
.giay-chip {
  position: absolute; right: 6px; bottom: -9px; z-index: 2; pointer-events: none; white-space: nowrap;
  padding: 1px 7px; border-radius: 999px; background: #2f9e57; color: #fff; font-family: var(--font-display); font-weight: 800;
  font-size: 11.5px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 0 #1f7a3e; animation: no .25s both;
}
.giay-chip.sai { background: #7d88a8; box-shadow: 0 2px 0 #5b6688; }
.cong {
  position: absolute; right: 8px; top: -8px; font-family: var(--font-display); font-weight: 800; font-size: 14px; color: #fff;
  -webkit-text-stroke: 3px #2f9e57; paint-order: stroke; pointer-events: none; animation: bay 1s both;
}
@keyframes bay { from { transform: translateY(8px); opacity: 0; } 25% { opacity: 1; } to { transform: translateY(-6px); opacity: 1; } }
@keyframes no { from { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.12); } to { transform: none; opacity: 1; } }


/* Nhịp `noi`: lớp mờ phủ cả bàn + thẻ cần tìm to ở giữa (mockup duyệt 27.11.2026) */
.tt-noi {
  position: absolute; inset: -6px; z-index: 6; border-radius: 22px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; pointer-events: auto;
  background: rgba(13, 24, 56, .38); -webkit-backdrop-filter: blur(7px); backdrop-filter: blur(7px);
}
.tt-noi .lon {
  width: min(108px, 30%); aspect-ratio: 3 / 4; border-radius: 15px; display: grid; place-items: center; font-size: 60px; line-height: 1;
  font-family: var(--font-display); font-weight: 800; color: #1d2a5a;
  background: radial-gradient(110% 80% at 50% 35%, #fff, #f1f5ff 90%); border: 4px solid #ffc21a;
  box-shadow: 0 6px 0 #c98f00, 0 14px 30px rgba(10, 20, 60, .35); animation: bat .38s cubic-bezier(.3, 1.5, .5, 1) both;
}
.tt-noi .lon img { width: 66%; height: auto; object-fit: contain; }
.nhan-noi {
  font-family: var(--font-display); font-weight: 900; font-size: 18px; color: #fff; padding: 5px 14px; border-radius: 999px;
  background: #2f4fa6; box-shadow: 0 3px 0 #1f3577; animation: bat .38s .08s both;
}
@keyframes bat { from { transform: scale(.3); opacity: 0; } to { transform: none; opacity: 1; } }
.tt-noi-enter-active { transition: opacity .25s; }
/* Lúc tan: KHÔNG chặn chạm + tan nhanh — đồng hồ chọn đã chạy, lớp mờ còn đón chạm thì cú bấm đầu bị nuốt
   (chủ dự án 27.11.2026: "bấm rất nhanh mà vẫn lâu"). */
.tt-noi-leave-active { transition: opacity .12s; pointer-events: none; }
.tt-noi-leave-active .lon { transition: transform .12s; transform: scale(.8); }
.tt-noi-enter-from, .tt-noi-leave-to { opacity: 0; }


.an-di { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); margin: 0; }
.tt-ban { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; }
.luoi { display: grid; gap: 10px; justify-content: center; align-content: center; }
.o { position: relative; aspect-ratio: 3 / 4; }
.card {
  position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; border-radius: 12px;
  perspective: 600px; container-type: size; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.card[aria-disabled='true'] { cursor: default; }
.inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .32s cubic-bezier(.3, .9, .3, 1.15); border-radius: inherit; }
.card.lat .inner { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; box-sizing: border-box; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.face.front { transform: rotateY(180deg); }
.emoji { width: 62%; height: 62%; object-fit: contain; pointer-events: none; }
.emoji.chu { width: auto; height: auto; font-size: min(48cqw, 58cqh); line-height: 1; }
/* Chữ/số: phông hiển thị nét đậm, màu mực — CÙNG thẻ chữ ở bàn chính (CardTile `.front.chu`) */
.front.chu { font-family: var(--font-display); font-weight: 800; color: #1d2a5a; }
/* VÒNG BÁO là lớp RIÊNG (::after) chứ không phải box-shadow của `.card`: skin Kẹo đặt box-shadow !important trên
   `.card` nên vòng xanh/đỏ bị đè mất — nhất là màn tối (ảnh chụp 26.11.2026). */
.card::after {
  content: ''; position: absolute; inset: -5px; border-radius: 16px; pointer-events: none; z-index: 3;
  border: 4px solid transparent; transition: border-color .15s;
}
.card.cho::after { border-color: #ffc21a; box-shadow: 0 0 16px 3px rgba(255, 194, 26, .7); }
/* Chọn một lá: lá LẮC nhẹ (chủ dự án 27.11.2026) — `rotate` riêng, không đụng `transform` lật của `.inner` */
.card.cho { animation: lac-chon .42s ease; }
@keyframes lac-chon { 15% { rotate: -7deg; scale: 1.06; } 35% { rotate: 6deg; } 55% { rotate: -4deg; } 75% { rotate: 2deg; } 100% { rotate: 0deg; scale: 1; } }
.card.dung::after { border-color: #3fbf5f; box-shadow: 0 0 18px 5px rgba(63, 191, 95, .7); }
.card.sai::after { border-color: #ff4d6d; box-shadow: 0 0 14px 3px rgba(255, 77, 109, .6); }
.card.dung { animation: nay-the .45s; z-index: 2; }
.card.sai .inner { animation: lac .45s; }
@keyframes nay-the { 40% { scale: 1.1; } }
@keyframes lac {
  20% { transform: rotateY(180deg) translateX(-6px); } 40% { transform: rotateY(180deg) translateX(6px); }
  60% { transform: rotateY(180deg) translateX(-4px); } 80% { transform: rotateY(180deg) translateX(3px); }
}

/* màn mở đầu: HUD + bàn vẫn dựng (để đo) nhưng ẩn */
.tt-phu { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 6px; }
.tt-phu.ket { border-radius: 22px; background: color-mix(in srgb, #0d1838 35%, transparent); }
/* FONT: nút HÀNH ĐỘNG dùng `btn`/`btn-primary` (Kẹo cho font tiêu đề) — `thach` trần KHÔNG đặt font. Số và nhãn
   to đặt `--font-display`. test/tim-the-font.test.ts canh (cùng luật với Mưa Thẻ). */
.hop {
  width: 100%; max-width: 380px; max-height: 100%; overflow: hidden; box-sizing: border-box;
  display: flex; flex-direction: column; gap: clamp(6px, 1.5vh, 12px); padding: 18px 18px 16px; text-align: center;
}
.hop h2 { margin: 0; font-size: 30px; line-height: 1.1; text-wrap: balance; }
.hop .btn { min-height: 48px; }
.hop .nut-to { min-height: 56px; font-size: 22px; }

.so-to { margin: 0; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: var(--font-display); font-size: 52px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.phu-chu { margin: 0; font-family: var(--font-display); font-weight: 700; color: var(--muted); }
.phu-chu b { color: var(--fg); }
.phu-chu.xu { display: flex; align-items: center; justify-content: center; gap: 6px; }
.hang { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.hang li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; text-align: start; }
.hang li.toi { border-color: #ffc21a; }
.hang .so { flex: none; width: 1.2em; font-family: var(--font-display); font-weight: 800; font-size: 18px; text-align: center; }
.ic-n { vertical-align: -2px; }
@media (prefers-reduced-motion: reduce) {
  .inner { transition-duration: .01s; }
  .o .card.dung, .card.cho, .card.sai .inner, .huy, .cong, .vien.combo, .tt-noi .lon, .nhan-noi, .tt-giay, .vien.diem.nay { animation: none; }
}
</style>
