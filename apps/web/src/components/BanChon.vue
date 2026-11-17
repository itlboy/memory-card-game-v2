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
import { ChevronRight } from 'lucide-vue-next';
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
}>();
const emit = defineEmits<{ 'chon-co': [level: number]; mo: [buoc: 'level' | 'theme' | 'options'] }>();

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
  const lv = oGiua();
  giua.value = null;
  if (lv == null) return;
  const c = coCua(lv);
  if (c && !mo(c)) {
    const lon = [...BOARD_SIZES].reverse().find(mo);
    if (lon) { veGiua(lon.level, true); if (lon.level !== props.level) emit('chon-co', lon.level); }
    return;
  }
  if (lv !== props.level) emit('chon-co', lv);
}
function khiCuon(): void {
  giua.value = oGiua();
  clearTimeout(henDung);
  henDung = setTimeout(chot, 140);   // iOS chưa có `scrollend` ổn định: chờ cuộn đứng yên
}
function bamSo(level: number): void {
  if (level !== props.level) emit('chon-co', level);
  veGiua(level, true);
}
onMounted(() => nextTick(() => veGiua(coDangChon.value?.level ?? 0, false)));
onBeforeUnmount(() => clearTimeout(henDung));
// Đổi từ ngoài (lần mở sau, bộ thẻ ít biểu tượng đẩy cỡ xuống…) → đưa ô đó về giữa
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
  <p class="nh-nhan">{{ t('menu.soThe') }}</p>
  <div class="keo-so">
    <span class="keo-mui" aria-hidden="true" />
    <div ref="dai" class="keo-dai" role="radiogroup" :aria-label="t('menu.soThe')" @scroll.passive="khiCuon">
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

  <button class="nh-dong thach" type="button" @click="emit('mo', 'theme')">
    <span class="nh-hinh" aria-hidden="true"><img v-for="h in hinhTheme" :key="h" :src="h" alt=""></span>
    <span class="nh-chu"><strong>{{ t('menu.nhanh.boThe') }}</strong><small>{{ tomTatTheme }}</small></span>
    <ChevronRight class="nh-mui" :size="20" aria-hidden="true" />
  </button>
  <button class="nh-dong thach" type="button" @click="emit('mo', 'options')">
    <OptionIcon name="time" :size="30" />
    <span class="nh-chu"><strong>{{ t('menu.nhanh.luat') }}</strong><small>{{ tomTatLuat }}</small></span>
    <ChevronRight class="nh-mui" :size="20" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* Dải số thẻ: chiếm chỗ của hàng ô cũ (.nh-hang: co giãn 48–92px theo màn, luật KHÔNG SCROLL trang) */
.keo-so { position: relative; flex: 1 1 72px; min-height: 56px; max-height: 96px; display: flex; min-width: 0; }
.keo-dai {
  flex: 1; min-width: 0; display: flex; gap: 8px; align-items: stretch;
  overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none;
  padding: 12px 0 6px;   /* trên: chỗ cho mũi tên vàng; dưới: chỗ cho bóng nổi của ô */
  /* hai mép mờ dần → lộ là còn số, kéo được */
  -webkit-mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
  mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
}
.keo-dai::-webkit-scrollbar { display: none; }
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
