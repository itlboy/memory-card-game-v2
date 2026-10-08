import { BOARD_SIZES } from '@mm/engine';
import type { BoardOptions, BotLevel, Summary } from '@mm/engine';

/**
 * SỔ DANH HIỆU.
 *
 * Mỗi danh hiệu có `chinhPhuc`: cách MỞ NGAY một bàn đúng điều kiện để người
 * chơi bấm vào danh hiệu chưa có là đi chinh phục luôn (màn Tài khoản). Thiếu
 * `chinhPhuc` là danh hiệu không dựng bàn được từ menu (ví dụ cần nhiều ván).
 *
 * Xét ở `earned()` SAU MỖI VÁN, thuần theo ngữ cảnh ván đó — không có bộ đếm
 * "đã thắng N ván", vì bộ đếm cục bộ và bộ đếm tài khoản sẽ lệch nhau giữa các
 * máy. Muốn thêm loại đếm thì đếm ở server, không đếm ở đây.
 */

export interface ChinhPhuc {
  /** Số thẻ của bàn (một trong BOARD_SIZES). */
  cells?: number;
  /** Tuỳ chọn bàn cần bật (phần còn lại về 0). */
  options?: Partial<BoardOptions>;
  /** Đấu máy ở mức này. */
  bot?: BotLevel;
  /** Chiến dịch: mở màn đang được mở (không nhảy cóc). */
  campaign?: true;
  /** Mở màn Chơi online. */
  online?: true;
}

export interface Achievement { id: string; name: string; hint: string; chinhPhuc?: ChinhPhuc }

export const ACHIEVEMENTS: Achievement[] = [
  // --- nhập môn ---
  { id: 'first-win', name: 'Khởi đầu', hint: 'Thắng ván đầu tiên', chinhPhuc: { cells: 8 } },
  { id: 'flawless', name: 'Trí nhớ siêu phàm', hint: 'Thắng một ván không lật sai lần nào', chinhPhuc: { cells: 8 } },
  { id: 'lightspeed', name: 'Tốc độ ánh sáng', hint: 'Hoàn thành lưới 4×4 dưới 30 giây', chinhPhuc: { cells: 16 } },
  { id: 'combo-master', name: 'Bậc thầy combo', hint: 'Đạt chuỗi 6 cặp đúng liên tiếp', chinhPhuc: { cells: 24 } },
  { id: 'combo-10', name: 'Chuỗi bất tận', hint: 'Đạt chuỗi 10 cặp đúng liên tiếp', chinhPhuc: { cells: 36 } },
  // --- cỡ bàn ---
  { id: 'board-36', name: 'Bàn lớn', hint: 'Dọn sạch bàn 36 thẻ', chinhPhuc: { cells: 36 } },
  { id: 'board-56', name: 'Bàn khổng lồ', hint: 'Dọn sạch bàn 56 thẻ', chinhPhuc: { cells: 56 } },
  { id: 'board-88', name: 'Đỉnh cao trí nhớ', hint: 'Dọn sạch bàn 88 thẻ — cỡ lớn nhất', chinhPhuc: { cells: 88 } },
  // --- luật bàn ---
  { id: 'survivor', name: 'Người sống sót', hint: 'Thắng một ván có bật mạng mà không mất mạng nào', chinhPhuc: { cells: 16, options: { lives: 2 } } },
  { id: 'blind-seer', name: 'Thần nhãn', hint: 'Thắng một ván có bật xem trước', chinhPhuc: { cells: 16, options: { peek: 2 } } },
  { id: 'time-rush', name: 'Chạy đua với giờ', hint: 'Thắng một ván đồng hồ mức Nhanh', chinhPhuc: { cells: 16, options: { time: 3 } } },
  { id: 'shuffle-master', name: 'Bậc thầy xáo bài', hint: 'Thắng một ván xáo thẻ mức Nhiều', chinhPhuc: { cells: 16, options: { shuffle: 3 } } },
  { id: 'special-win', name: 'Phù thuỷ thẻ', hint: 'Thắng một ván có thẻ đặc biệt từ mức Bình thường', chinhPhuc: { cells: 24, options: { special: 2 } } },
  { id: 'iron-man', name: 'Người sắt', hint: 'Thắng một ván bật CẢ NĂM tuỳ chọn ở mức 2 trở lên', chinhPhuc: { cells: 24, options: { time: 2, lives: 2, peek: 2, shuffle: 2, special: 2 } } },
  // --- đấu máy ---
  { id: 'bot-normal', name: 'Hạ gà cứng', hint: 'Thắng máy mức Gà cứng', chinhPhuc: { cells: 16, bot: 'normal' } },
  { id: 'bot-hard', name: 'Hạ báo đen', hint: 'Thắng máy mức Báo đen', chinhPhuc: { cells: 24, bot: 'hard' } },
  { id: 'bot-insane', name: 'Hạ mãnh hổ', hint: 'Thắng máy mức Mãnh hổ', chinhPhuc: { cells: 24, bot: 'insane' } },
  { id: 'bot-divine', name: 'Hạ rồng thần', hint: 'Thắng máy mức Rồng thần', chinhPhuc: { cells: 36, bot: 'divine' } },
  // --- online ---
  { id: 'online-win', name: 'Vô địch phòng', hint: 'Thắng một ván online', chinhPhuc: { online: true } },
  // --- chiến dịch ---
  { id: 'campaign-10', name: 'Nửa đường chiến dịch', hint: 'Qua màn 10 của Chiến dịch', chinhPhuc: { campaign: true } },
  { id: 'campaign-25', name: 'Nửa chặng', hint: 'Qua màn 25 của Chiến dịch', chinhPhuc: { campaign: true } },
  { id: 'campaign-50', name: 'Hết chiến dịch', hint: 'Qua màn cuối của Chiến dịch', chinhPhuc: { campaign: true } },
  { id: 'three-star', name: 'Hoàn hảo', hint: 'Đạt 3 sao ở một màn Chiến dịch', chinhPhuc: { campaign: true } }
];

export interface AchievementContext {
  summary: Summary;
  mode: string;
  cells: number;
  /** Số lần lật sai của người chơi; online không biết → bỏ qua "flawless". */
  misses?: number;
  livesLeft?: number;
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
  /** Năm tuỳ chọn của bàn (ngoài Chiến dịch); null nếu không có. */
  options?: BoardOptions | null;
  /** Đấu máy: mức máy. */
  botLevel?: BotLevel | null;
  /** Ván online. */
  online?: boolean;
  /**
   * KẾT CỤC CỦA TÔI. `summary.status === 'won'` chỉ là "bàn đã sạch" — thua
   * máy vẫn 'won' (xem CLAUDE.md). Có `ketQua` thì xét theo nó.
   */
  ketQua?: 'thang' | 'thua' | 'hoa';
}

/** Xét thành tích đạt được sau một ván (mục 3.5). */
export function earned(ctx: AchievementContext): string[] {
  const { summary: s, mode, cells } = ctx;
  const out: string[] = [];
  const thang = ctx.ketQua ? ctx.ketQua === 'thang' : s.status === 'won';
  if (!thang) return out;

  out.push('first-win');
  if (ctx.misses === 0) out.push('flawless');
  if (cells === 16 && s.seconds < 30) out.push('lightspeed');
  if (s.bestStreak >= 6) out.push('combo-master');
  if (s.bestStreak >= 10) out.push('combo-10');
  if (cells >= 36) out.push('board-36');
  if (cells >= 56) out.push('board-56');
  if (cells >= 88) out.push('board-88');
  // Bàn có bật mạng và đi hết ván mà KHÔNG mất mạng nào. So với `lives` ban đầu
  // chứ không so với hằng số 5: số mạng giờ tuỳ cỡ bàn (bàn 42 thẻ có tới 56).
  if (ctx.lives != null && ctx.lives > 0 && ctx.livesLeft != null && ctx.livesLeft >= ctx.lives) out.push('survivor');
  if (ctx.peekMs > 0) out.push('blind-seer');
  const o = ctx.options;
  if (o) {
    if (o.time >= 3) out.push('time-rush');
    if (o.shuffle >= 3) out.push('shuffle-master');
    if (o.special >= 2) out.push('special-win');
    if (o.time >= 2 && o.lives >= 2 && o.peek >= 2 && o.shuffle >= 2 && o.special >= 2) out.push('iron-man');
  }
  const bot = ctx.botLevel;
  if (bot) {
    const thu = ['easy', 'normal', 'hard', 'insane', 'divine'].indexOf(bot);
    if (thu >= 1) out.push('bot-normal');
    if (thu >= 2) out.push('bot-hard');
    if (thu >= 3) out.push('bot-insane');
    if (thu >= 4) out.push('bot-divine');
  }
  if (ctx.online) out.push('online-win');
  if (mode === 'campaign') {
    const id = ctx.levelId ?? 0;
    if (id >= 10) out.push('campaign-10');
    if (id >= 25) out.push('campaign-25');
    if (id >= 50) out.push('campaign-50');
    if (s.stars === 3) out.push('three-star');
  }
  return out;
}

export const byId = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);

/** Cấp (level) đầu tiên của cỡ bàn có `cells` thẻ — để mở bàn đúng cỡ. */
export function levelChoCells(cells: number): number {
  return BOARD_SIZES.find((b) => b.cols * b.rows === cells)?.level ?? 1;
}
