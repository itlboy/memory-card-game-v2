import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, allLevels, levelConfig, levelSpec, perfectScore } from '../src/campaign.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, clearBoard } from './helpers.js';

describe('Campaign (SP-03)', () => {
  const levels = allLevels();

  it('có đúng CAMPAIGN_LEVELS màn, mọi màn có ít nhất 2 cặp', () => {
    expect(levels).toHaveLength(CAMPAIGN_LEVELS);
    for (const l of levels) expect(Math.floor((l.cols * l.rows) / 2)).toBeGreaterThanOrEqual(2);
  });

  it('vào ván từ dễ: màn 1 là 2×2, kết ở 10×10', () => {
    expect([levels[0]!.cols, levels[0]!.rows]).toEqual([2, 2]);
    expect(levels[0]!.pairs).toBe(2);
    const last = levels.at(-1)!;
    expect([last.cols, last.rows]).toEqual([10, 10]);
  });

  it('mỗi màn thêm đúng 1 cặp (2 thẻ) và bàn luôn đủ chỗ', () => {
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i]!;
      expect(l.pairs).toBe(i + 2);
      const total = l.cols * l.rows;
      expect(total).toBeGreaterThanOrEqual(l.pairs * 2);
      // Ô trống phải gọn trong một hàng, không thì bàn nhìn khuyết
      expect(total - l.pairs * 2).toBeLessThanOrEqual(l.cols - 1);
      expect(l.rows / l.cols).toBeLessThanOrEqual(1.75);
    }
  });

  it('lưới không bao giờ nhỏ lại và thời gian mỗi cặp siết dần', () => {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!, cur = levels[i]!;
      expect(cur.cols * cur.rows).toBeGreaterThanOrEqual(prev.cols * prev.rows);
      expect(cur.timeLimit / cur.pairs).toBeLessThan(prev.timeLimit / prev.pairs);
    }
  });

  it('thẻ đặc biệt chỉ bật từ màn 3 và không vượt 20%', () => {
    expect(levels[0]!.specialRate).toBe(0);
    expect(levels[1]!.specialRate).toBe(0);
    expect(levels[2]!.specialRate).toBeGreaterThan(0);
    // 0.2 chứ không phải 0.15: chiến dịch dài hơn nên trần cũng nới
    for (const l of levels) expect(l.specialRate).toBeLessThanOrEqual(0.2 + 1e-9);
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
