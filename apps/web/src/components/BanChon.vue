<script setup lang="ts">
/*
 * CHỌN BÀN MỘT MÀN — dùng chung cho Chơi nhanh (MenuScreen) và Đổi bàn phòng online
 * (OnlineScreen), 17.11.2026. Ba cỡ gợi ý Dễ/Vừa/Khó + "Khác" (mở lưới đủ cỡ), một dòng
 * Bộ thẻ, một dòng Luật bàn. Màn cha lo các bước phụ (SizeGrid/ThemePicker/bảng luật).
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
}>();
const emit = defineEmits<{ 'chon-co': [level: number]; mo: [buoc: 'level' | 'theme' | 'options'] }>();

const coCua = (level: number) => BOARD_SIZES.find((s) => s.level === level);
const MUC = ([['de', 6], ['vua', 12], ['kho', 21]] as const).map(([k, pairs]) => ({
  k, pairs, level: BOARD_SIZES.find((s) => s.pairs === pairs)!.level
}));
const coDangChon = computed(() => coCua(props.level));
const laCoKhac = computed(() => !MUC.some((m) => m.level === props.level) && !!coDangChon.value);

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
  <div class="nh-hang" role="radiogroup" :aria-label="t('menu.soThe')">
    <button
      v-for="m in MUC" :key="m.k" class="option nh-o" type="button" role="radio"
      :aria-checked="level === m.level" :aria-label="t('menu.theN', { n: m.pairs * 2 })"
      :disabled="m.pairs > symbolCount"
      @click="emit('chon-co', m.level)"
    >
      <strong class="num">{{ m.pairs * 2 }}</strong>
      <small>{{ t(`menu.nhanh.${m.k}`) }}</small>
    </button>
    <button class="option nh-o" type="button" role="radio" :aria-checked="laCoKhac" @click="emit('mo', 'level')">
      <strong class="num">{{ laCoKhac && coDangChon ? coDangChon.pairs * 2 : '…' }}</strong>
      <small>{{ t('menu.nhanh.khac') }}</small>
    </button>
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
