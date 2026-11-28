<script setup lang="ts">
/**
 * BÀN VÒNG TRÒN của Tìm Thẻ — dùng CHUNG cho chơi đơn (TimThe) và online/người xem (OnlineTimThe).
 * Mockup chủ dự án duyệt 27.11.2026: https://claude.ai/artifact/84a1NKjn98ViN2Koj51K7U
 *
 *  · Thẻ cần tìm ở TÂM, BẰNG lá thường; khác ở lưng vàng, khung vàng đôi, quầng sáng. Lá khác xếp vòng (lib `bayVong`).
 *  · Nhịp: `cho` tất cả úp → `xem` vòng ngoài ngửa → `up` úp lại → `noi`/`hoi` thẻ giữa ngửa tới hết giờ → `dap-an` lật bàn.
 *  · KHÔNG chữ nào trên bàn. Giờ chọn = VẠCH quanh cạnh thẻ giữa, hao từ 12 giờ theo chiều kim đồng hồ, xanh → vàng → đỏ.
 *  · QUẦNG SÁNG chạy vòng theo chiều kim đồng hồ (~1 giây một vòng) CHỈ khi các lá đang úp; không nhích, không phóng to lá.
 *    Bấm một lá: quầng dừng ở đó, lá có viền TRẮNG (chưa nói đúng/sai), nhún nhẹ + vòng sóng. Lá đã chọn KHÔNG đổi cỡ
 *    (chủ dự án: "sao chọn thẻ rồi kích thước lại thay đổi").
 *  · Hết giờ mà chưa chọn (hoặc người xem): quầng chậm dần ~1 giây rồi dừng ở THẺ ĐÁP ÁN (quầng vàng nhấp nháy chỉ đáp án
 *    mới có), rồi mới lật bàn — `lat` báo cho màn cha phát tiếng/điểm.
 *  · Lật bàn: đúng nảy + viền xanh + ✓, chọn sai mờ .55 + viền đỏ + ✕, lá khác mờ .28.
 *  · Nhạc trống "thình-thịch" lúc chọn (nhanh dần khi vạch vàng/đỏ), tắt ngay khi mình đã chọn — `veGio` lo.
 * Phần riêng của từng màn (số giây, "+điểm" bay, mặt người chọn) cắm vào khe `#the="{ i, lat }"`.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Check, X } from 'lucide-vue-next';
import { anhEmoji, chonCoAnh, laKyTuChu } from '@/lib/emoji';
import { bayVong, type BanVong } from '@/lib/tim-the';
import type { MeoBan } from '@/lib/meo-tim-the';
import { sfx } from '@/lib/audio';
import { t } from '@/lib/i18n';

export type NhipVong = 'cho' | 'xem' | 'up' | 'noi' | 'hoi' | 'dap-an' | 'xong';
const props = defineProps<{
  soThe: number;
  hinh: readonly string[];
  hinhDich: string | null;
  /** Vị trí đáp án — chỉ cần từ `dap-an`. */
  dich: number | null;
  nhip: NhipVong;
  /** Lá MÌNH đã chọn trong lượt này. */
  chon: number | null;
  /** Được chạm không (người xem: không bao giờ). */
  choCham: boolean;
  /** Tạm dừng: quầng đứng yên. */
  dung?: boolean;
  /** Mẹo lần đầu (lib/meo-tim-the): bong bóng trên lá cao nhất, `vien` = viền vàng quanh thẻ giữa. Không chặn chạm. */
  meo?: MeoBan | null;
}>();
const emit = defineEmits<{ cham: [i: number]; lat: [] }>();

const goc = ref<HTMLElement | null>(null);
const bv = ref<BanVong>({ w: 60, h: 80, tam: [0, 0], vi: [] });
function doBan(): void {
  const el = goc.value;
  if (el && el.clientWidth > 0) bv.value = bayVong(props.soThe, el.clientWidth, el.clientHeight);
}
watch(() => props.soThe, doBan);
const coAnh = computed(() => chonCoAnh(bv.value.w * 0.62));
const GIAM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- lật bàn ở đáp án (chờ vòng quay dừng nếu mình chưa chọn) ---------- */
const daLat = ref(false);
const quayDich = ref(false);
const ngua = computed(() => props.nhip === 'xem' || props.nhip === 'xong' || (props.nhip === 'dap-an' && daLat.value));
const giuaNgua = computed(() => !!props.hinhDich && (props.nhip === 'noi' || props.nhip === 'hoi' || props.nhip === 'dap-an' || props.nhip === 'xong'));
const hinhGiua = ref('');
watch(() => props.hinhDich, (h) => { if (h) hinhGiua.value = h; }, { immediate: true });

/* ---------- quầng sáng chạy vòng ---------- */
const sang = ref(-1);
let henVong: ReturnType<typeof setInterval> | undefined;
let henQuay: ReturnType<typeof setTimeout>[] = [];
const chayVong = computed(() => !GIAM && !props.dung && props.chon === null && (props.nhip === 'up' || props.nhip === 'noi' || props.nhip === 'hoi'));
watch(chayVong, (bat) => {
  clearInterval(henVong);
  if (!bat) return;
  henVong = setInterval(() => { sang.value = (sang.value + 1) % props.soThe; }, 1000 / props.soThe);
}, { immediate: true });
watch(() => props.chon, (c) => { if (c !== null) sang.value = c; });

watch(() => props.nhip, (n, cu) => {
  if (n === 'dap-an' && cu !== 'dap-an') {
    henQuay.forEach(clearTimeout); henQuay = [];
    if (props.chon !== null || props.dich === null) { daLat.value = true; emit('lat'); return; }
    quayVe(props.dich);
  } else if (n !== 'dap-an' && n !== 'xong') { daLat.value = false; quayDich.value = false; if (n === 'cho') sang.value = -1; }
});
/** Hết giờ chưa chọn: quầng chậm dần (~1 giây) rồi dừng ở thẻ đáp án, rồi mới lật. */
function quayVe(dich: number): void {
  const n = props.soThe;
  const xong = (): void => {
    sang.value = dich; quayDich.value = true; sfx.timDich();
    henQuay.push(setTimeout(() => { quayDich.value = false; daLat.value = true; emit('lat'); }, 550));
  };
  if (GIAM || sang.value < 0) { xong(); return; }
  let con = ((dich - sang.value + n) % n) || n;
  const tong = con;
  const buoc = (): void => {
    sang.value = (sang.value + 1) % n; sfx.timQuay(1 - con / tong); con--;
    if (con <= 0) { xong(); return; }
    const k = 1 - con / tong;
    henQuay.push(setTimeout(buoc, 60 + k * k * 160));
  };
  henQuay.push(setTimeout(buoc, 60));
}

/* ---------- chạm: nhún + vòng sóng ---------- */
const song = ref<{ i: number; k: number } | null>(null);
function cham(i: number): void {
  if (!props.choCham || props.nhip !== 'hoi' || props.chon !== null) return;
  song.value = { i, k: (song.value?.k ?? 0) + 1 };
  emit('cham', i);
}

/* ---------- vạch giờ + nhạc trống (màn cha gọi mỗi khung hình) ---------- */
const gioEl = ref<SVGSVGElement | null>(null);
const mauGio = ref<'' | 'vang' | 'do'>('');
let nhipSau = 0;
/**
 * `conLai` 0..1 = phần giờ chọn còn lại (null = không đếm: ẩn vạch). `trong` = còn chờ mình chọn (gõ trống).
 * Ghi thẳng thuộc tính SVG, Vue chỉ vẽ lại khi đổi màu.
 */
function veGio(conLai: number | null, trong: boolean): void {
  const g = gioEl.value;
  if (!g) return;
  if (conLai === null) { g.style.opacity = '0'; nhipSau = 0; return; }
  g.style.opacity = '1';
  const off = String(-(100 - Math.max(0, conLai) * 100));
  for (const p of g.querySelectorAll('path')) p.setAttribute('stroke-dashoffset', off);
  mauGio.value = conLai < 0.25 ? 'do' : conLai < 0.5 ? 'vang' : '';
  const now = performance.now();
  if (!trong) { nhipSau = 0; return; }
  if (!nhipSau) nhipSau = now + 350;
  if (now >= nhipSau && conLai > 0.03) { sfx.timTrong(conLai < 0.25); nhipSau = now + (conLai > 0.5 ? 1000 : conLai > 0.25 ? 700 : 450); }
}
defineExpose({ veGio });

const D = 'M62 2.5 H105.5 A16 16 0 0 1 121.5 18.5 V138.5 A16 16 0 0 1 105.5 154.5 H18.5 A16 16 0 0 1 2.5 138.5 V18.5 A16 16 0 0 1 18.5 2.5 Z';
const ketQua = computed(() => props.nhip === 'dap-an' || props.nhip === 'xong');
/** Mép trên của lá CAO NHẤT — bong bóng mẹo đứng ngay trên đó, đuôi chỉ xuống tâm bàn. */
const dinhVong = computed(() => Math.min(...bv.value.vi.map((v) => v[1]), bv.value.tam[1]) - bv.value.h / 2);

let ro: ResizeObserver | undefined;
onMounted(() => { ro = new ResizeObserver(doBan); if (goc.value) ro.observe(goc.value); doBan(); });
onBeforeUnmount(() => { ro?.disconnect(); clearInterval(henVong); henQuay.forEach(clearTimeout); });
</script>

<template>
  <div ref="goc" class="vong-tim" :class="{ 'da-chon': chon !== null && nhip === 'hoi' }">
    <div
      v-for="(_, i) in soThe" :key="i" class="o"
      :class="{
        sang: sang === i && !ngua && (chayVong || chon === i || quayDich),
        dich: quayDich && i === dich,
        dung: ketQua && daLat && i === dich,
        sai: ketQua && daLat && i === chon && i !== dich,
        mo: ketQua && daLat && i !== dich && i !== chon
      }"
      :style="{ left: `${bv.vi[i]?.[0] ?? 0}px`, top: `${bv.vi[i]?.[1] ?? 0}px`, width: `${bv.w}px`, height: `${bv.h}px` }"
    >
      <button
        class="card" type="button" data-nosfx data-phang
        :class="{ lat: ngua, chon: chon === i && !(ketQua && daLat) }"
        :aria-label="ngua ? (hinh[i] ?? '') : t('tt.theSo', { n: i + 1 })"
        :aria-disabled="!choCham || nhip !== 'hoi' || chon !== null"
        @pointerdown.prevent="cham(i)" @keydown.enter.prevent="cham(i)" @keydown.space.prevent="cham(i)"
      >
        <span class="inner">
          <span class="face back" aria-hidden="true" />
          <span class="face front" :class="{ chu: laKyTuChu(hinh[i] ?? '') }" aria-hidden="true">
            <img v-if="hinh[i] && anhEmoji(hinh[i]!, undefined, coAnh)" class="emoji" :src="anhEmoji(hinh[i]!, undefined, coAnh)!" alt="" draggable="false">
            <span v-else class="emoji chu">{{ hinh[i] }}</span>
          </span>
        </span>
      </button>
      <span v-if="song && song.i === i" :key="song.k" class="song" aria-hidden="true" />
      <span v-if="ketQua && daLat && i === dich" class="dau dung" aria-hidden="true"><Check :size="15" :stroke-width="3.4" /></span>
      <span v-else-if="ketQua && daLat && i === chon" class="dau sai" aria-hidden="true"><X :size="14" :stroke-width="3.4" /></span>
      <slot name="the" :i="i" :lat="daLat || nhip === 'xong'" />
    </div>

    <!-- THẺ CẦN TÌM ở tâm: markup RIÊNG (không `.card`) để skin không đè lưng vàng -->
    <div class="giua" :class="{ ngua: giuaNgua, 'meo-vien': meo?.vien }" :style="{ left: `${bv.tam[0]}px`, top: `${bv.tam[1]}px`, width: `${bv.w}px`, height: `${bv.h}px` }" aria-hidden="true">
      <svg ref="gioEl" class="gio" viewBox="0 0 124 157" preserveAspectRatio="none" style="opacity: 0">
        <path class="nen" :d="D" pathLength="100" stroke-dasharray="100 100" />
        <path class="chay" :class="mauGio" :d="D" pathLength="100" stroke-dasharray="100 100" />
      </svg>
      <span class="inner">
        <span class="mat lung" />
        <span class="mat truoc" :class="{ chu: laKyTuChu(hinhGiua) }">
          <img v-if="hinhGiua && anhEmoji(hinhGiua, undefined, coAnh)" class="emoji" :src="anhEmoji(hinhGiua, undefined, coAnh)!" alt="" draggable="false">
          <span v-else class="emoji chu">{{ hinhGiua }}</span>
        </span>
      </span>
    </div>

    <div v-if="meo" :key="meo.tieuDe" class="meo-bong" role="status" :style="{ left: `${bv.tam[0]}px`, top: `${dinhVong - 14}px` }">
      <b>{{ meo.tieuDe }}</b>{{ meo.mo }}
    </div>
  </div>
</template>

<style scoped>
.vong-tim { position: relative; width: 100%; height: 100%; }
/* MẸO LẦN ĐẦU — cùng chất bong bóng chỉ Premium ở trang chủ (MenuScreen `.chi-bong`): nền panel, viền vàng, bóng đổ */
.meo-bong {
  --vien: color-mix(in srgb, #f0b400 70%, transparent);
  position: absolute; z-index: 8; transform: translate(-50%, -100%); width: min(280px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 11px 14px; border-radius: 16px; border: 2px solid var(--vien); background: var(--panel-solid, #fff); color: var(--fg);
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .35)); font: 700 13.5px/1.45 var(--font-body); text-align: center;
  pointer-events: none; animation: meo-vao .3s ease-out both;
}
.meo-bong b { display: block; margin-bottom: 2px; font: 800 16px/1.25 var(--font-display); }
.meo-bong::after {
  content: ''; position: absolute; left: 50%; bottom: -9px; width: 14px; height: 14px; margin-left: -8px; background: inherit;
  border-right: 2px solid var(--vien); border-bottom: 2px solid var(--vien); transform: rotate(45deg);
}
@keyframes meo-vao { from { opacity: 0; transform: translate(-50%, calc(-100% + 8px)); } }
.giua.meo-vien::after {
  content: ''; position: absolute; inset: -4px; border-radius: 16px; pointer-events: none; z-index: 3;
  box-shadow: 0 0 0 4px #ffd34d, 0 0 24px 6px rgba(255, 211, 77, .8); animation: meo-nhip 1.4s ease-in-out infinite;
}
@keyframes meo-nhip { 50% { box-shadow: 0 0 0 6px #ffd34d, 0 0 32px 10px rgba(255, 211, 77, .9); } }
/* Màn thấp (SE): bong bóng gọn lại để ít đè hàng xu / "Lượt" phía trên */
@media (max-height: 620px) { .meo-bong { padding: 7px 12px; font-size: 12.5px; line-height: 1.35; } .meo-bong b { font-size: 14.5px; } }
@media (prefers-reduced-motion: reduce) { .meo-bong, .giua.meo-vien::after { animation: none; } }
.o { position: absolute; transform: translate(-50%, -50%); transition: opacity .3s, filter .3s; }
.card {
  position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; border-radius: 12px;
  perspective: 600px; container-type: size; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.card[aria-disabled='true'] { cursor: default; }
.inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .45s cubic-bezier(.3, 1.25, .5, 1); border-radius: inherit; }
.card.lat .inner { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; box-sizing: border-box; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.face.front { transform: rotateY(180deg); }
.emoji { width: 62%; height: 62%; object-fit: contain; pointer-events: none; }
.emoji.chu { width: auto; height: auto; font-size: min(48cqw, 58cqh); line-height: 1; }
.front.chu { font-family: var(--font-display); font-weight: 800; color: #1d2a5a; }

/* QUẦNG SÁNG (lớp ::before của ô, không đụng skin của `.card`) */
.o::before {
  content: ''; position: absolute; inset: -5px; border-radius: 16px; pointer-events: none; opacity: 0; transition: opacity .12s; z-index: 0;
  box-shadow: 0 0 0 3px rgba(255, 236, 150, .95), 0 0 20px 7px rgba(255, 214, 90, .75);
}
.o.sang::before { opacity: 1; }
/* Quầng vàng NHẤP NHÁY chỉ dành cho THẺ ĐÁP ÁN (vòng quay hết giờ dừng ở đó) */
.o.dich::before { opacity: 1; box-shadow: 0 0 0 4px #ffe066, 0 0 30px 12px rgba(255, 214, 90, .95); animation: nhip-dich .5s ease-in-out infinite alternate; }
@keyframes nhip-dich { to { box-shadow: 0 0 0 6px #ffe066, 0 0 40px 16px rgba(255, 214, 90, 1); } }
/* VÒNG BÁO là lớp ::after của `.card` (skin Kẹo đặt box-shadow !important trên `.card`) */
.card::after { content: ''; position: absolute; inset: -5px; border-radius: 16px; pointer-events: none; z-index: 3; border: 4px solid transparent; }
/* Lá MÌNH chọn: viền TRẮNG trung tính + nhún rồi về ĐÚNG cỡ cũ */
.card.chon::after { border-color: #fff; box-shadow: 0 0 0 3px rgba(29, 42, 90, .55), 0 8px 16px rgba(10, 20, 70, .35); }
.card.chon { animation: nhun .38s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes nhun { 35% { scale: .9; } 70% { scale: 1.04; } }
.song { position: absolute; inset: -4px; border-radius: 16px; pointer-events: none; box-shadow: 0 0 0 3px #fff; animation: song .55s ease-out forwards; }
@keyframes song { from { opacity: .95; transform: scale(1); } to { opacity: 0; transform: scale(1.45); } }
/* Đã chốt, chờ người khác: lá khác mờ nhẹ */
.da-chon .o:not(.sang) { opacity: .7; }

/* KẾT QUẢ */
.o.dung { z-index: 3; animation: dung-nay .7s cubic-bezier(.3, 1.6, .5, 1) both; }
@keyframes dung-nay { 30% { scale: 1.28; } 100% { scale: 1.12; } }
.o.dung .card::after { border-color: #2fb57a; box-shadow: 0 0 26px 8px rgba(47, 181, 122, .85); }
.o.sai { opacity: .55; filter: grayscale(.35); animation: lac .45s; }
.o.sai .card::after { border-color: #e0533a; box-shadow: 0 0 18px 4px rgba(224, 83, 58, .7); }
@keyframes lac { 20% { rotate: -4deg; translate: -6px 0; } 40% { rotate: 4deg; translate: 6px 0; } 60% { translate: -4px 0; } 80% { translate: 3px 0; } }
.o.mo { opacity: .28; filter: grayscale(.75); }
/* ✓ / ✕ — không chỉ dựa vào màu */
.dau {
  position: absolute; z-index: 5; top: -9px; right: -9px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  color: #fff; box-shadow: 0 0 0 2.5px #fff, 0 3px 6px rgba(0, 0, 0, .25); animation: hien .3s cubic-bezier(.3, 1.6, .5, 1);
}
.dau.dung { background: #1f9e6a; } .dau.sai { background: #d6453a; }
@keyframes hien { from { scale: .3; } }

/* THẺ GIỮA — bằng lá thường; lưng vàng, khung vàng đôi, quầng sáng */
.giua { position: absolute; z-index: 2; transform: translate(-50%, -50%); perspective: 600px; container-type: size; }
.giua .inner { border-radius: 12px; }
.giua.ngua .inner { transform: rotateY(180deg); }
.mat { position: absolute; inset: 0; border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.mat.lung { background: linear-gradient(155deg, #ffcf4d, #e08a00); box-shadow: inset 0 0 0 4px #fff3c4, 0 0 0 3px #b86a00, 0 6px 0 #8a4f00; }
.mat.lung::after { content: ''; width: 34%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #ffe9a6 60%, #ffc533); }
.mat.truoc {
  transform: rotateY(180deg); background: radial-gradient(circle at 50% 35%, #fffdf2, #fff1c9 80%);
  box-shadow: inset 0 0 0 4px #ffd34d, 0 0 0 4px #e0a000, 0 0 26px 7px rgba(255, 200, 60, .7);
}
.mat.truoc.chu { font-family: var(--font-display); font-weight: 800; color: #1d2a5a; }
.mat.truoc .emoji.chu { font-size: min(52cqw, 62cqh); }
/* VẠCH GIỜ sát mép thẻ giữa, có viền tương phản cho nền sáng */
.gio { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px); pointer-events: none; overflow: visible; z-index: 1; transition: opacity .2s; }
.gio path { fill: none; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.gio .nen { stroke: rgba(255, 255, 255, .95); stroke-width: 7; }
.gio .chay { stroke: #0f9b55; stroke-width: 4; transition: stroke .3s; }
.gio .chay.vang { stroke: #f0a800; } .gio .chay.do { stroke: #e5402f; }
:root[data-theme='dark'] .gio .nen { stroke: rgba(10, 20, 50, .6); }
:root[data-theme='dark'] .gio .chay:not(.vang):not(.do) { stroke: #3ddc84; }

@media (prefers-reduced-motion: reduce) {
  .inner, .o::before { transition-duration: .01s; }
  .o.dung, .o.sai, .card.chon, .o.dich::before, .song, .dau { animation: none; }
}
</style>
