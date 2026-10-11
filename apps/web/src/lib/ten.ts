import { BOT_SPECS } from '@mm/engine';
import type { BotLevel } from '@mm/engine';
import { t, td } from './i18n';

/**
 * TÊN HIỂN THỊ THEO NGÔN NGỮ cho những tên do APP đặt (không phải người chơi gõ).
 *
 * Dữ liệu ván giữ nguyên chữ gốc ("Bot báo đen", "Bạn") — engine, server và bản
 * lưu đều dùng nó; chỉ lúc VẼ mới dịch. Tên người chơi tự gõ thì giữ nguyên.
 */
const MUC_THEO_MAT: Record<string, BotLevel> = Object.fromEntries(
  (Object.entries(BOT_SPECS) as [BotLevel, { avatar: string }][]).map(([muc, s]) => [s.avatar, muc])
);

export const tenBot = (muc: BotLevel): string => td(`bot.${muc}`);

export function tenNguoi(p: { id: string; name: string; avatar?: string } | null | undefined): string {
  if (!p) return '';
  if (p.id === 'bot' && p.avatar && MUC_THEO_MAT[p.avatar]) return tenBot(MUC_THEO_MAT[p.avatar]!);
  // Ván đấu máy: App đặt người chơi là "Bạn" (id p1) — chữ của app, không phải tên tự gõ
  if (p.id === 'p1' && p.name === 'Bạn') return t('chung.ban'); // i18n-bo-qua
  return p.name;
}
