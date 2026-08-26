import { describe, expect, it } from 'vitest';
import { duel } from './duel-helper.js';
import { BOT_SPECS } from '../src/bot.js';
import type { BotLevel } from '../src/bot.js';

/**
 * Cân bằng bot phải đo bằng TỈ LỆ THẮNG 1v1, không đo bằng số lần lật khi bot
 * chơi một mình. Bộ số cũ trông rất ổn ở phép đo solo (mức đỉnh 77 lần lật trên
 * bàn 42 thẻ, gần như hoàn hảo) nhưng vào trận thật thì nó thắng 0% — vì trong
 * 1v1, nước của ĐỐI THỦ cũng làm ký ức bot già đi, nửa đời thực tế chỉ còn một
 * nửa. Người dùng phát hiện ra trước khi test phát hiện: "cháu tôi thắng suốt".
 *
 * Đối thủ mô phỏng có hai hạng: KHÁ (ghi 80% những gì thấy, nửa đời ~9,5 nước)
 * và GIỎI (ghi 95%, nửa đời ~69 nước).
 *
 * Bộ số hiện tại (nửa đời 3 · 6 · 12 · 20) đo trước KHÁ trên bàn 6×7, n = 24:
 * 4% → 25% → 75% → 83%. Ngưỡng dưới đây đặt có biên, nhưng seed là CỐ ĐỊNH nên
 * con số không dao động giữa các lần chạy — đổi `BOT_HALF_LIFE` thì đo lại.
 */
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];

function rate(l: BotLevel, cols: number, rows: number, keep: number, hRetain: number, n = 24): number {
  let win = 0;
  for (let i = 0; i < n; i++) if (duel(l, i * 977 + 3, cols, rows, keep, hRetain, i % 2 === 0)) win++;
  return (win / n) * 100;
}
const vsKha = (l: BotLevel, c: number, r: number): number => rate(l, c, r, 0.8, 0.93);

describe('cân bằng trận 1v1 (thước đo thật của bot)', () => {
  it('mức càng cao càng thắng nhiều — trên bàn lớn', () => {
    const r = LEVELS.map((l) => vsKha(l, 6, 7));
    for (let i = 1; i < r.length; i++) {
      expect(r[i]!, `${BOT_SPECS[LEVELS[i]!].name} phải thắng nhiều hơn mức dưới`)
        .toBeGreaterThanOrEqual(r[i - 1]!);
    }
  });

  it('Bot siêu đẳng thắng phần lớn ván trước người chơi KHÁ, kể cả bàn 42 thẻ', () => {
    expect(vsKha('insane', 6, 7)).toBeGreaterThan(70);
  });

  /* Pro nay ở nửa đời 12 nên nó THẮNG NHIỀU HƠN người khá (75%), không còn
   * "ngang ngửa" — nhưng vẫn phải có cửa thua, nếu không thì mức trên vô nghĩa. */
  it('Bot Pro mạnh nhưng KHÔNG bao thắng', () => {
    const r = vsKha('hard', 6, 7);
    expect(r).toBeGreaterThan(45);
    expect(r).toBeLessThan(90);
  });

  it('Bot dễ thua phần lớn ván — đúng vai dành cho trẻ con', () => {
    expect(vsKha('easy', 6, 7)).toBeLessThan(30);
    expect(vsKha('easy', 4, 4)).toBeLessThan(45);
  });
});
