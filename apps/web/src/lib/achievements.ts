import type { Summary } from '@mm/engine';

export interface Achievement { id: string; name: string; hint: string }

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'flawless', name: 'Trí nhớ siêu phàm', hint: 'Thắng một ván không lật sai lần nào' },
  { id: 'lightspeed', name: 'Tốc độ ánh sáng', hint: 'Hoàn thành lưới 4×4 dưới 30 giây' },
  { id: 'combo-master', name: 'Bậc thầy combo', hint: 'Đạt chuỗi 6 cặp đúng liên tiếp' },
  { id: 'survivor', name: 'Người sống sót', hint: 'Thắng một ván có bật mạng mà không mất mạng nào' },
  { id: 'blind-seer', name: 'Thần nhãn', hint: 'Thắng một ván có bật xem trước' },
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
  /**
   * LUẬT THẬT của bàn vừa chơi, đọc từ config chứ không từ tên chế độ.
   *
   * Vì sao: bỏ chế độ thì `mode` luôn là 'classic' ở chơi nhanh, nên hai thành
   * tích cũ xét theo `mode === 'survival'` / `'peek'` thành BẤT KHẢ THI — không
   * ai đạt được nữa mà cũng không có gì báo đỏ. Xét theo luật thì chúng sống
   * lại, và còn đúng hơn: cái đáng thưởng là chơi bàn có mạng / có hé bài, chứ
   * không phải chọn đúng một cái tên trong menu.
   */
  lives: number | null;
  peekMs: number;
}

/** Xét thành tích đạt được sau một ván (mục 3.5). */
export function earned(ctx: AchievementContext): string[] {
  const { summary: s, mode, cells } = ctx;
  const out: string[] = [];
  if (s.status !== 'won') return out;

  if (ctx.misses === 0) out.push('flawless');
  if (cells === 16 && s.seconds < 30) out.push('lightspeed');
  if (s.bestStreak >= 6) out.push('combo-master');
  // Bàn có bật mạng và đi hết ván mà KHÔNG mất mạng nào. So với `lives` ban đầu
  // chứ không so với hằng số 5: số mạng giờ tuỳ cỡ bàn (bàn 42 thẻ có tới 56).
  if (ctx.lives != null && ctx.lives > 0 && ctx.livesLeft >= ctx.lives) out.push('survivor');
  if (ctx.peekMs > 0) out.push('blind-seer');
  if (mode === 'campaign') {
    if ((ctx.levelId ?? 0) >= 10) out.push('campaign-10');
    if (s.stars === 3) out.push('three-star');
  }
  return out;
}

export const byId = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);
