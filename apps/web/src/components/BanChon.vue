<script setup lang="ts">
/*
 * CHỌN BÀN MỘT MÀN — dùng chung cho Chơi nhanh (MenuScreen) và Đổi bàn phòng online
 * (OnlineScreen), 17.11.2026. Một dòng Bộ thẻ, một dòng Luật bàn.
 *
 * SỐ THẺ = DẢI KÉO NGANG (18.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/4EFAvRCBh4jyEUUB8M4UV6): đủ 12 cỡ bàn trên một dải, số đang chọn
 * LUÔN ở giữa (dưới mũi tên vàng), hai bên là cỡ nhỏ hơn / lớn hơn. Kéo hoặc bấm số. Bỏ chữ
 * Dễ/Vừa/Khó và ô "Khác": bản cũ chọn số khác thì số đó chiếm chỗ ô Khác, người chơi mất lối
 * chọn lại. Cỡ cần nhiều biểu tượng hơn bộ thẻ đang có thì mờ + không chọn được. Màn cha lo các bước phụ (SizeGrid/ThemePicker/bảng luật).
 * CSS `.nh-*` ở styles/wizard.css (toàn cục) vì màn cha còn dùng cho hàng số người, dòng tên.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rung } from '@/lib/rung';
import { sfx } from '@/lib/audio';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { BOARD_SIZES, OPTION_KEYS } from '@mm/engine';
import type { BoardOptions } from '@mm/engine';
import { t, td } from '@/lib/i18n';
import { anhEmoji } from '@/lib/emoji';
import { choiDuoc } from '@/lib/premium';
import type { CardTheme } from '@/lib/themes';
import OptionIcon from './OptionIcon.vue';

const props = defineProps<{
  level: number;
  /** Số biểu tượng tối đa có thể dùng — cỡ cần nhiều cặp hơn thì khoá. */
  symbolCount: number;
  themes: CardTheme[];
  themeIds: string[];
  options: BoardOptions;
  /** Kiểu Tìm Thẻ (27.11.2026): chỉ còn dòng Bộ thẻ — số thẻ + độ khó do `ChonTimThe` vẽ phía trên, Tìm Thẻ không
   *  có Luật bàn. Bật lại kiểu Thường thì dải số dựng lại nên phải đưa ô đang chọn về giữa. */
  tim?: boolean;
}>();
/** `cach`: 'cuon' = chốt sau khi cuộn (KHÔNG kêu — chỉ rung từng ô), 'bam' = bấm thẳng vào ô (kêu như nút). */
const emit = defineEmits<{ 'chon-co': [level: number, cach: 'cuon' | 'bam']; mo: [buoc: 'level' | 'theme' | 'options'] }>();

const coCua = (level: number) => BOARD_SIZES.find((s) => s.level === level);
const coDangChon = computed(() => coCua(props.level));
const mo = (c: (typeof BOARD_SIZES)[number]) => c.pairs <= props.symbolCount;

/* ---- Dải kéo ngang ---- */
const dai = ref<HTMLElement | null>(null);
/** Ô đang nằm giữa dải lúc người chơi kéo (tô vàng theo ngón tay, chưa chọn hẳn). */
const giua = ref<number | null>(null);
const sang = computed(() => giua.value ?? coDangChon.value?.level ?? null);

function oCua(level: number): HTMLElement | null {
  return dai.value?.querySelector<HTMLElement>(`[data-level="${level}"]`) ?? null;
}
/** Cuộn để ô `level` vào giữa. jsdom (test) không có scrollTo — bỏ qua êm. */
function veGiua(level: number, muot: boolean): void {
  const d = dai.value, o = oCua(level);
  if (!d || !o) return;
  const left = o.offsetLeft + o.offsetWidth / 2 - d.clientWidth / 2;
  if (typeof d.scrollTo === 'function') d.scrollTo({ left, behavior: muot ? 'smooth' : 'auto' });
  else d.scrollLeft = left;
}
/** Ô gần tâm dải nhất lúc này. */
function oGiua(): number | null {
  const d = dai.value;
  if (!d) return null;
  const tam = d.scrollLeft + d.clientWidth / 2;
  let tot: number | null = null, kc = Infinity;
  for (const o of Array.from(d.querySelectorAll<HTMLElement>('[data-level]'))) {
    const k = Math.abs(o.offsetLeft + o.offsetWidth / 2 - tam);
    if (k < kc) { kc = k; tot = Number(o.dataset.level); }
  }
  return tot;
}
let henDung: ReturnType<typeof setTimeout> | undefined;
/** Cuộn dừng: chốt ô giữa. Ô bị khoá (thiếu biểu tượng) thì trượt về cỡ lớn nhất còn mở. */
function chot(): void {
  // NGÓN CÒN CHẠM thì chưa chốt (20.11.2026, chủ dự án: "bấm giữ một lúc rồi kéo thì mất rung và tiếng tạch") —
  // trước đây đứng yên 140ms là chốt + tắt `keoTay`, kéo tiếp bằng chính ngón đó thì im. Nhấc ngón mới chốt.
  if (ngon) return;
  keoTay = false;
  rung.xongTach();
  const lv = oGiua();
  giua.value = null;
  if (lv == null) return;
  const c = coCua(lv);
  if (c && !mo(c)) {
    const lon = [...BOARD_SIZES].reverse().find(mo);
    if (lon) { veGiua(lon.level, true); if (lon.level !== props.level) emit('chon-co', lon.level, 'cuon'); }
    return;
  }
  if (lv !== props.level) emit('chon-co', lv, 'cuon');
}
function khiCuon(): void {
  lucCuon = Date.now();
  const truoc = giua.value ?? props.level;
  giua.value = oGiua();
  // Mỗi ô MỚI đi qua giữa dải: một cú "tách" (lib/rung.ts) — chỉ khi NGÓN đang kéo/thả trôi, không khi app tự
  // cuộn ô về giữa (veGiua lúc mở / bấm ô)
  if (keoTay && giua.value != null && giua.value !== truoc) { rung.tach(); sfx.tach(); }
  clearTimeout(henDung);
  henDung = setTimeout(chot, 140);   // iOS chưa có `scrollend` ổn định: chờ cuộn đứng yên
}
/*
 * VUỐT KHÔNG PHẢI BẤM (19.11.2026, chủ dự án: "trải nghiệm vuốt của chọn bàn chưa tốt vì nó nhận cả bấm").
 * Ngón đặt lên một ô rồi kéo, hoặc chạm để DỪNG dải đang trôi, trình duyệt vẫn bắn `click` lên ô dưới ngón →
 * nhảy sang cỡ đó + kêu "tách". Nay: ngón đi > `NGUONG_KEO` px, hoặc chạm trong lúc dải còn trôi (`lucCuon`
 * < `CHAM_DUNG_MS`), là VUỐT — nuốt `click` ở pha capture và gắn `data-nosfx` cho dải (App.vue im tiếng bấm).
 */
const NGUONG_KEO = 8;
const CHAM_DUNG_MS = 250;
let x0 = 0, y0 = 0, keo = false, lucCuon = 0;
/** Cuộn do NGƯỜI (chạm vào dải tới khi dải đứng yên) — chỉ lúc này mới rung. */
let keoTay = false;
/**
 * Ngón đang đặt trên dải. Theo `touchstart/touchend` chứ KHÔNG theo pointer: iOS bắn `pointercancel` ngay khi
 * trình duyệt nhận cuộn, rồi im tới hết — pointer không biết ngón còn đó; touch events thì chạy suốt.
 */
let ngon = false;
function ngonXuong(): void { ngon = true; keoTay = true; clearTimeout(henDung); }
function ngonLen(): void {
  ngon = false;
  clearTimeout(henDung);
  henDung = setTimeout(chot, 140);   // còn trôi theo đà thì `khiCuon` hẹn lại; đứng yên thì chốt
}
function khiCham(e: PointerEvent): void {
  keoTay = true;
  x0 = e.clientX; y0 = e.clientY;
  keo = Date.now() - lucCuon < CHAM_DUNG_MS;
  dai.value?.toggleAttribute('data-nosfx', keo);
}
function khiDi(e: PointerEvent): void {
  if (!keo && Math.hypot(e.clientX - x0, e.clientY - y0) > NGUONG_KEO) { keo = true; dai.value?.setAttribute('data-nosfx', ''); }
}
/*
 * MÁY TÍNH KHÔNG CẢM ỨNG (19.11.2026, đo trên WebKit 1280px): lăn chuột DỌC không cuộn dải ngang, kéo chuột cũng
 * không — chỉ trackpad (lăn ngang) và bấm từng ô là dùng được. Nay: lăn dọc → cuộn ngang; giữ chuột kéo → cuộn
 * (dải snap từng ô nên kéo là "nhảy nấc" — đúng cảm giác núm xoay). Cảm ứng KHÔNG đi đường này (trình duyệt tự cuộn).
 */
function khiLan(e: WheelEvent): void {
  const d = dai.value;
  if (!d || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // lăn ngang (trackpad): để trình duyệt tự lo
  e.preventDefault();
  keoTay = true;
  d.scrollLeft += e.deltaY;
}
let keoChuot: { x: number; left: number; id: number } | null = null;
function chuotXuong(e: PointerEvent): void {
  khiCham(e);
  if (e.pointerType !== 'mouse' || e.button !== 0 || !dai.value) return;
  keoChuot = { x: e.clientX, left: dai.value.scrollLeft, id: e.pointerId };
}
function chuotDi(e: PointerEvent): void {
  khiDi(e);
  if (!keoChuot || e.pointerId !== keoChuot.id || !dai.value) return;
  if (keo && !dai.value.hasPointerCapture(e.pointerId)) dai.value.setPointerCapture(e.pointerId);
  if (keo) dai.value.scrollLeft = keoChuot.left - (e.clientX - keoChuot.x);
}
function chuotLen(e: PointerEvent): void {
  if (keoChuot && dai.value?.hasPointerCapture(e.pointerId)) dai.value.releasePointerCapture(e.pointerId);
  keoChuot = null;
}
function nuotBam(e: MouseEvent): void {
  if (!keo) return;
  e.stopPropagation(); e.preventDefault();
  keo = false;
}
/*
 * MŨI TÊN ‹ › CHO MÁY CÓ CHUỘT (19.11.2026, mockup https://claude.ai/artifact/NYkwxUunp3XZpPtGFCRPvg phương án A —
 * chủ dự án: "trên web chọn số thẻ hơi khó vì không có cảm ứng"). Chỉ hiện ở `(hover: hover) and (pointer: fine)`
 * (CSS); điện thoại vẫn chỉ dải kéo. Mỗi lần bấm nhảy một nấc, BỎ QUA cỡ bị khoá (thiếu biểu tượng).
 */
function keBen(buoc: -1 | 1): (typeof BOARD_SIZES)[number] | null {
  const i = BOARD_SIZES.findIndex((c) => c.level === (sang.value ?? props.level));
  for (let k = i + buoc; k >= 0 && k < BOARD_SIZES.length; k += buoc) if (mo(BOARD_SIZES[k]!)) return BOARD_SIZES[k]!;
  return null;
}
const truocDo = computed(() => keBen(-1));
const sauDo = computed(() => keBen(1));
function bamMui(buoc: -1 | 1): void {
  const c = buoc < 0 ? truocDo.value : sauDo.value;
  if (c) bamSo(c.level);
}
function bamSo(level: number): void {
  if (level !== props.level) emit('chon-co', level, 'bam');
  veGiua(level, true);
}
onMounted(() => nextTick(() => veGiua(coDangChon.value?.level ?? 0, false)));
onBeforeUnmount(() => { clearTimeout(henDung); rung.xongTach(); });
// Đổi từ ngoài (lần mở sau, bộ thẻ ít biểu tượng đẩy cỡ xuống…) → đưa ô đó về giữa
watch(() => props.tim, (tim) => { if (!tim) nextTick(() => veGiua(coDangChon.value?.level ?? 0, false)); });
watch(() => props.level, (lv) => { if (giua.value == null) nextTick(() => veGiua(lv, true)); });

/** "Tất cả 12 bộ" hay "Đã chọn 3 bộ" — so với theme CHƠI ĐƯỢC (premium chưa mua không tính). */
const tomTatTheme = computed(() => {
  const chon = props.themes.filter((th) => props.themeIds.includes(th.id));
  return chon.length >= props.themes.filter(choiDuoc).length && chon.length > 0
    ? t('menu.nhanh.tatCaBo', { n: chon.length }) : t('menu.nhanh.soBo', { n: chon.length });
});
const hinhTheme = computed(() => props.themes.filter((th) => props.themeIds.includes(th.id)).slice(0, 3)
  .map((th) => anhEmoji(th.symbols[0], true, 128)).filter((x): x is string => !!x));
/** Tên các tuỳ chọn đang bật, không bật gì thì "Thường". */
const tomTatLuat = computed(() => {
  const bat = OPTION_KEYS.filter((k) => props.options[k] > 0).map((k) => td(`opt.${k}`));
  return bat.length ? bat.join(', ') : t('menu.nhanh.luatThuong');
});
</script>

<template>
  <template v-if="!tim">
  <p class="nh-nhan">{{ t('menu.soThe') }}</p>
  <div class="keo-hang">
  <button
    class="keo-ben thach th-nho" type="button" :disabled="!truocDo"
    :aria-label="truocDo ? t('menu.theN', { n: truocDo.pairs * 2 }) : undefined" @click="bamMui(-1)"
  ><ChevronLeft :size="18" :stroke-width="2.6" aria-hidden="true" /></button>
  <div class="keo-so">
    <span class="keo-mui" aria-hidden="true" />
    <div ref="dai" class="keo-dai" role="radiogroup" :aria-label="t('menu.soThe')" @scroll.passive="khiCuon"
      @pointerdown="chuotXuong" @pointermove="chuotDi" @pointerup="chuotLen" @pointercancel="chuotLen"
      @touchstart.passive="ngonXuong" @touchend.passive="ngonLen" @touchcancel.passive="ngonLen"
      @wheel="khiLan" @click.capture="nuotBam">
      <span class="keo-dem" aria-hidden="true" />
      <button
        v-for="c in BOARD_SIZES" :key="c.level" class="option nh-o keo-o" type="button" role="radio"
        :data-level="c.level" :aria-checked="sang === c.level" :aria-label="t('menu.theN', { n: c.pairs * 2 })"
        :disabled="!mo(c)"
        @click="bamSo(c.level)"
      >
        <strong class="num">{{ c.pairs * 2 }}</strong>
      </button>
      <span class="keo-dem" aria-hidden="true" />
    </div>
  </div>
  <button
    class="keo-ben thach th-nho" type="button" :disabled="!sauDo"
    :aria-label="sauDo ? t('menu.theN', { n: sauDo.pairs * 2 }) : undefined" @click="bamMui(1)"
  ><ChevronRight :size="18" :stroke-width="2.6" aria-hidden="true" /></button>
  </div>
  </template>

  <button class="nh-dong thach" type="button" @click="emit('mo', 'theme')">
    <span class="nh-hinh" aria-hidden="true"><img v-for="h in hinhTheme" :key="h" :src="h" alt=""></span>
    <span class="nh-chu"><strong>{{ t('menu.nhanh.boThe') }}</strong><small>{{ tomTatTheme }}</small></span>
    <ChevronRight class="nh-mui" :size="20" aria-hidden="true" />
  </button>
  <button v-if="!tim" class="nh-dong thach" type="button" @click="emit('mo', 'options')">
    <OptionIcon name="time" :size="30" />
    <span class="nh-chu"><strong>{{ t('menu.nhanh.luat') }}</strong><small>{{ tomTatLuat }}</small></span>
    <ChevronRight class="nh-mui" :size="20" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* Dải số thẻ: chiếm chỗ của hàng ô cũ (.nh-hang: co giãn 48–92px theo màn, luật KHÔNG SCROLL trang) */
/* Hàng [‹] dải [›]: chiếm chỗ của dải cũ trong cột (flex dọc của màn Chơi nhanh) */
.keo-hang { flex: 1 1 72px; min-height: 56px; max-height: 96px; display: flex; gap: 6px; min-width: 0; }
.keo-so { position: relative; flex: 1; display: flex; min-width: 0; }
/* Mũi tên chỉ cho máy có chuột/trackpad — điện thoại vẫn chỉ dải kéo */
.keo-ben { display: none; }
@media (hover: hover) and (pointer: fine) {
  /* NÚT TRÒN NHỎ 34px giữa chiều cao dải (21.11.2026, mockup A duyệt https://claude.ai/artifact/WKTRGnDb2DXZhj1hYVPzwg —
     chủ dự án: cột cao bằng cả dải 96×40 "to quá nhìn xấu") */
  .keo-ben {
    display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; align-self: center;
    padding: 0; border-radius: 50%; color: var(--fg); cursor: pointer;
  }
  .keo-ben:disabled { opacity: .35; cursor: default; }
}
.keo-dai {
  flex: 1; min-width: 0; display: flex; gap: 8px; align-items: stretch;
  overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none;
  padding: 12px 0 6px;   /* trên: chỗ cho mũi tên vàng; dưới: chỗ cho bóng nổi của ô */
  /* hai mép mờ dần → lộ là còn số, kéo được */
  -webkit-mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
  mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
}
.keo-dai::-webkit-scrollbar { display: none; }
/* Chuột: kéo được (khiLan/chuotDi) — con trỏ bàn tay, không bôi đen chữ khi kéo */
@media (hover: hover) and (pointer: fine) { .keo-dai { cursor: grab; user-select: none; -webkit-user-select: none; } .keo-dai:active { cursor: grabbing; } }
/* Đệm hai đầu = nửa dải − nửa ô: ô đầu và ô cuối vẫn kéo vào được chính giữa */
.keo-dem { flex: 0 0 calc(50% - var(--o-rong) / 2 - 8px); }
.keo-so { --o-rong: clamp(62px, 21%, 86px); }
.keo-o { flex: 0 0 var(--o-rong); height: auto; scroll-snap-align: center; transition: transform .15s, opacity .15s; }
.keo-o:not([aria-checked="true"]) { transform: scale(.9); opacity: .8; }
.keo-o:disabled { opacity: .35; }
.keo-mui {
  position: absolute; z-index: 1; left: 50%; top: 0; translate: -50% 0; pointer-events: none;
  border: 7px solid transparent; border-top-color: var(--gold-600, #e6a10f); border-bottom-width: 0;
}
@media (prefers-reduced-motion: reduce) { .keo-o { transition: none; } }
</style>
