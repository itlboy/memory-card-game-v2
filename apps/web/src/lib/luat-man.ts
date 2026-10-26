/**
 * LUẬT CỦA MÀN CHIẾN DỊCH → icon + chữ (mỗi màn một luật, 27.10.2026).
 *
 * Engine (`campaignSpec`) quyết luật; file này chỉ nói luật đó bằng hình và chữ,
 * dùng CHUNG cho bản đồ (`LevelMap`) và bước Bắt đầu (`MenuScreen`). Icon là
 * CÙNG bộ với năm tuỳ chọn bàn chơi và Luật chơi — đọc luật xong nhận ra ngay.
 */
import type { Level, LuatDon } from '@mm/engine';
import type { IconName } from '@/components/OptionIcon.vue';
import { t, td } from './i18n';

export const ICON_LUAT: Record<LuatDon, IconName> = {
  xao: 'shuffle', mang: 'lives', dacBiet: 'special', nhanh: 'time'
};

/** Tên ngắn của một luật đơn — trùng tên tuỳ chọn bàn chơi tương ứng. */
export const tenLuat = (l: LuatDon): string =>
  l === 'nhanh' ? t('cd.ten.nhanh') : td(`opt.${l === 'xao' ? 'shuffle' : l === 'mang' ? 'lives' : 'special'}`);

/** Tên luật của cả màn: "Trùm" cho màn trùm, tên luật đơn cho màn còn lại. */
export const tenLuatMan = (lv: Level): string =>
  lv.luat === 'trum' ? t('cd.trum') : lv.luat === 'tron' ? t('cd.tron') : tenLuat(lv.cacLuat[0]!);

/** Một câu kể luật của màn, kèm con số thật (số mạng). */
export function moTaLuat(lv: Level): string {
  if (lv.luat === 'trum') return t('cd.luat.trum', { luat: lv.cacLuat.map(tenLuat).join(' + ') });
  if (lv.luat === 'xao') return t('cd.luat.xao');
  if (lv.luat === 'mang') return t('cd.luat.mang', { n: lv.lives ?? 0 });
  if (lv.luat === 'dacBiet') return t('cd.luat.dacBiet');
  if (lv.luat === 'nhanh') return t('cd.luat.nhanh');
  return '';
}
