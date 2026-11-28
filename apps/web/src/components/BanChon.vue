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
import { computed } from 'vue';
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
  /** Kiểu Tìm Thẻ (27.11.2026): chỉ còn dòng Bộ thẻ — số thẻ + độ khó do `ChonTimThe` vẽ phía trên, Tìm Thẻ không
   *  có Luật bàn. Bật lại kiểu Thường thì dải số dựng lại nên phải đưa ô đang chọn về giữa. */
  tim?: boolean;
}>();
/** `cach`: 'cuon' = chốt sau khi cuộn (KHÔNG kêu — chỉ rung từng ô), 'bam' = bấm thẳng vào ô (kêu như nút). */
const emit = defineEmits<{ 'chon-co': [level: number, cach: 'cuon' | 'bam']; mo: [buoc: 'level' | 'theme' | 'options'] }>();

const coCua = (level: number) => BOARD_SIZES.find((s) => s.level === level);
const mo = (c: (typeof BOARD_SIZES)[number]) => c.pairs <= props.symbolCount;

/** Bấm một cỡ bàn: chọn luôn (cỡ bị khoá thì nút đã tắt). */
function bamSo(level: number): void {
  if (level !== props.level) emit('chon-co', level, 'bam');
}

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
  <!-- 12 CỠ BÀN = 2 HÀNG × 6 VIÊN trong một rãnh (28.11.2026, mockup A duyệt https://claude.ai/artifact/1cdWS68mgEE7sR5YT5X3N3 —
       cùng kiểu Số thẻ của Tìm Thẻ; thay dải kéo ngang 18.11.2026). Thấy hết, bấm là chọn, không phải vuốt. -->
  <span class="ranh c6" role="radiogroup" :aria-label="t('menu.soThe')">
    <button
      v-for="c in BOARD_SIZES" :key="c.level" class="nut-o keo-o thach th-nho th-chon" type="button" role="radio"
      :data-level="c.level" :aria-checked="level === c.level" :aria-label="t('menu.theN', { n: c.pairs * 2 })"
      :disabled="!mo(c)" @click="bamSo(c.level)"
    ><b>{{ c.pairs * 2 }}</b></button>
  </span>
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
.keo-o:disabled { opacity: .35; cursor: default; }
</style>
