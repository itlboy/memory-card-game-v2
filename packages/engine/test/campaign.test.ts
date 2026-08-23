import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, allLevels, levelConfig, levelSpec, perfectScore } from '../src/campaign.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, clearBoard } from './helpers.js';

describe('Campaign (SP-03)', () => {
  const levels = allLevels();

  it('có đúng CAMPAIGN_LEVELS màn', () => {
    expect(levels).toHaveLength(CAMPAIGN_LEVELS);
  });

  it('cấp 1 là cấp tập 2 thẻ, bàn to nhất là 5×10 kín 50 thẻ', () => {
    expect([levels[0]!.cols, levels[0]!.rows]).toEqual([2, 1]);
    expect(levels[0]!.pairs).toBe(1);
    const last = levels.at(-1)!;
    expect([last.cols, last.rows]).toEqual([5, 10]);
    expect(last.pairs).toBe(25);                       // bàn kín, không ô trống
  });

  it('mỗi cấp thêm 1 cặp cho tới trần 25 cặp, bàn luôn đủ chỗ', () => {
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i]!;
      expect(l.pairs).toBe(Math.min(25, i + 1));
      const total = l.cols * l.rows;
      expect(total).toBeGreaterThanOrEqual(l.pairs * 2);
      if (l.pairs === 1) continue;                     // cấp tập 2×1 là ngoại lệ
      // Ô trống phải gọn trong một hàng, không thì bàn nhìn khuyết
      expect(total - l.pairs * 2).toBeLessThanOrEqual(l.cols - 1);
      expect(l.rows / l.cols).toBeLessThanOrEqual(2);
    }
  });

  it('quá trần thì bàn giữ nguyên, độ khó lên bằng thời gian và thẻ đặc biệt', () => {
    const at25 = levels[24]!, at50 = levels[49]!;
    expect([at50.cols, at50.rows]).toEqual([at25.cols, at25.rows]);   // cùng bàn
    expect(at50.timeLimit).toBeLessThan(at25.timeLimit);              // siết giờ
    expect(at50.specialRate).toBeGreaterThan(at25.specialRate);       // nhiều thẻ đặc biệt
  });

  it('lưới không bao giờ nhỏ lại và thời gian mỗi cặp siết dần', () => {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!, cur = levels[i]!;
      expect(cur.cols * cur.rows).toBeGreaterThanOrEqual(prev.cols * prev.rows);
      expect(cur.timeLimit / cur.pairs).toBeLessThan(prev.timeLimit / prev.pairs);
    }
  });

  it('thẻ đặc biệt bật từ cấp 3, trần 20% khi bàn còn to lên và 30% sau đó', () => {
    expect(levels[0]!.specialRate).toBe(0);
    expect(levels[1]!.specialRate).toBe(0);
    expect(levels[2]!.specialRate).toBeGreaterThan(0);
    for (const l of levels) {
      // Quá cấp 25 bàn hết to thêm được, nên nới trần để còn chỗ tăng độ khó
      expect(l.specialRate, `cấp ${l.id}`).toBeLessThanOrEqual((l.id <= 25 ? 0.2 : 0.3) + 1e-9);
    }
  });

  it('nửa sau chiến dịch siết mốc sao chặt hơn nửa đầu', () => {
    const early = levels.find((l) => l.id === 5)!;
    const late = levels.find((l) => l.id === CAMPAIGN_LEVELS)!;
    const ratio = (l: typeof early): number => l.starThresholds[1] / perfectScore(Math.floor((l.cols * l.rows) / 2));
    expect(ratio(late)).toBeGreaterThan(ratio(early));
  });

  it('mốc sao nằm dưới điểm hoàn hảo nên 3 sao là đạt được', () => {
    for (const l of levels) {
      const perfect = perfectScore(Math.floor((l.cols * l.rows) / 2));
      const [two, three] = l.starThresholds;
      expect(two).toBeLessThan(three);
      expect(three).toBeLessThan(perfect);
    }
  });

  it('chơi hoàn hảo màn 1 được 3 sao', () => {
    const l = levelSpec(1);
    const g = new MemoryGame(levelConfig(l, SYMBOLS, 777));
    g.start(0);
    clearBoard(g, 1000);
    const s = g.summary()!;
    expect(s.status).toBe('won');
    expect(s.stars).toBe(3);
  });

  it('màn không tồn tại thì báo lỗi', () => {
    expect(() => levelSpec(0)).toThrow();
    expect(() => levelSpec(CAMPAIGN_LEVELS + 1)).toThrow();
  });
});

describe('điểm hoàn hảo', () => {
  it('8 cặp = 1370 điểm', () => expect(perfectScore(8)).toBe(1370));
  it('tăng 200 điểm cho mỗi cặp thêm sau cặp thứ 4', () => {
    expect(perfectScore(9) - perfectScore(8)).toBe(200);
  });
});
