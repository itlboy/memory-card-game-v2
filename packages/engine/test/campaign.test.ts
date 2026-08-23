import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, allLevels, levelConfig, levelSpec, perfectScore } from '../src/campaign.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, clearBoard } from './helpers.js';

describe('Campaign (SP-03)', () => {
  const levels = allLevels();

  it('có đúng CAMPAIGN_LEVELS màn', () => {
    expect(levels).toHaveLength(CAMPAIGN_LEVELS);
  });

  it('cấp 1 là bàn 2×2, cấp cuối là bàn 6×7 (42 thẻ)', () => {
    expect([levels[0]!.cols, levels[0]!.rows]).toEqual([2, 2]);
    expect(levels[0]!.pairs).toBe(2);
    const last = levels.at(-1)!;
    expect([last.cols, last.rows]).toEqual([6, 7]);
    expect(last.pairs).toBe(21);
  });

  it('bàn không bao giờ nhỏ lại qua các cấp', () => {
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!.pairs, `cấp ${i + 1}`).toBeGreaterThanOrEqual(levels[i - 1]!.pairs);
    }
  });

  it('cấp sau luôn khó hơn cấp trước: bàn to hơn, hoặc cùng bàn mà ít giờ hơn', () => {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!, cur = levels[i]!;
      const harder = cur.pairs > prev.pairs || cur.timeLimit < prev.timeLimit;
      expect(harder, `cấp ${cur.id} không khó hơn cấp ${prev.id}`).toBe(true);
    }
  });

  it('nhiều cấp liền nhau dùng chung một cỡ bàn, và cấp sau ít giờ hơn', () => {
    const same = levels.filter((l, i) => i > 0 && l.pairs === levels[i - 1]!.pairs);
    expect(same.length).toBeGreaterThan(0);        // có thật, không phải giả định
    for (const l of same) {
      const prev = levels[l.id - 2]!;
      expect(l.timeLimit, `cấp ${l.id}`).toBeLessThan(prev.timeLimit);
    }
  });

  it('thẻ đặc biệt bật từ cấp 3, dày dần tới trần 30%', () => {
    expect(levels[0]!.specialRate).toBe(0);
    expect(levels[1]!.specialRate).toBe(0);
    expect(levels[2]!.specialRate).toBeGreaterThan(0);
    for (const l of levels) expect(l.specialRate, `cấp ${l.id}`).toBeLessThanOrEqual(0.3 + 1e-9);
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
