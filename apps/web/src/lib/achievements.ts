import type { Summary } from '@mm/engine';

export interface Achievement { id: string; name: string; hint: string }

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'flawless', name: 'Trí nhớ siêu phàm', hint: 'Thắng một ván không lật sai lần nào' },
  { id: 'lightspeed', name: 'Tốc độ ánh sáng', hint: 'Hoàn thành lưới 4×4 dưới 30 giây' },
  { id: 'combo-master', name: 'Bậc thầy combo', hint: 'Đạt chuỗi 6 cặp đúng liên tiếp' },
  { id: 'survivor', name: 'Người sống sót', hint: 'Thắng chế độ Sinh tồn mà không mất mạng nào' },
  { id: 'blind-seer', name: 'Thần nhãn', hint: 'Thắng chế độ Chớp nhoáng' },
  { id: 'campaign-10', name: 'Nửa đường chiến dịch', hint: 'Qua màn 10 của Chiến dịch' },
  { id: 'three-star', name: 'Hoàn hảo', hint: 'Đạt 3 sao ở một màn Chiến dịch' }
];

export interface AchievementContext {
  summary: Summary;
  mode: string;
  cells: number;
  misses: number;
  livesLeft: number;
  levelId?: number;
}

/** Xét thành tích đạt được sau một ván (mục 3.5). */
export function earned(ctx: AchievementContext): string[] {
  const { summary: s, mode, cells } = ctx;
  const out: string[] = [];
  if (s.status !== 'won') return out;

  if (ctx.misses === 0) out.push('flawless');
  if (cells === 16 && s.seconds < 30) out.push('lightspeed');
  if (s.bestStreak >= 6) out.push('combo-master');
  if (mode === 'survival' && ctx.livesLeft >= 5) out.push('survivor');
  if (mode === 'peek') out.push('blind-seer');
  if (mode === 'campaign') {
    if ((ctx.levelId ?? 0) >= 10) out.push('campaign-10');
    if (s.stars === 3) out.push('three-star');
  }
  return out;
}

export const byId = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);
