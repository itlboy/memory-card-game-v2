import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, allLevels, levelConfig, levelSpec, perfectScore } from '../src/campaign.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, clearBoard } from './helpers.js';

describe('Campaign (SP-03)', () => {
  const levels = allLevels();

  it('có đúng 20 màn, mọi lưới đều chẵn ô', () => {
    expect(levels).toHaveLength(CAMPAIGN_LEVELS);
    for (const l of levels) expect((l.cols * l.rows) % 2).toBe(0);
  });

  it('lưới không bao giờ nhỏ lại và thời gian mỗi cặp siết dần', () => {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!, cur = levels[i]!;
      expect(cur.cols * cur.rows).toBeGreaterThanOrEqual(prev.cols * prev.rows);
      const perPair = (l: typeof cur) => l.timeLimit / ((l.cols * l.rows) / 2);
      if (cur.cols === prev.cols && cur.rows === prev.rows) {
        expect(perPair(cur)).toBeLessThan(perPair(prev));
      }
    }
  });

  it('thẻ đặc biệt chỉ bật từ màn 3 và không vượt 15%', () => {
    expect(levels[0]!.specialRate).toBe(0);
    expect(levels[1]!.specialRate).toBe(0);
    expect(levels[2]!.specialRate).toBeGreaterThan(0);
    for (const l of levels) expect(l.specialRate).toBeLessThanOrEqual(0.15);
  });

  it('mốc sao nằm dưới điểm hoàn hảo nên 3 sao là đạt được', () => {
    for (const l of levels) {
      const perfect = perfectScore((l.cols * l.rows) / 2);
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
    expect(() => levelSpec(21)).toThrow();
  });
});

describe('điểm hoàn hảo', () => {
  it('8 cặp = 1370 điểm', () => expect(perfectScore(8)).toBe(1370));
  it('tăng 200 điểm cho mỗi cặp thêm sau cặp thứ 4', () => {
    expect(perfectScore(9) - perfectScore(8)).toBe(200);
  });
});
