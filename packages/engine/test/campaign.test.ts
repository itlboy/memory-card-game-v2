import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZES, CAMPAIGN_LEVELS, CAMPAIGN_REPEAT, CHAPTERS, LEVEL_KEYS, allLevels, campaignSpec, levelConfig,
  levelSpec, perfectScore
} from '../src/campaign.js';
import { starsByMisses } from '../src/scoring.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, clearBoard } from './helpers.js';

describe('Campaign (SP-03)', () => {
  const levels = allLevels();

  it('có đúng CAMPAIGN_LEVELS màn', () => {
    expect(levels).toHaveLength(CAMPAIGN_LEVELS);
  });

  it('cấp 1 là bàn 2×2, cấp cuối là bàn 8×11 (88 thẻ)', () => {
    expect([levels[0]!.cols, levels[0]!.rows]).toEqual([2, 2]);
    expect(levels[0]!.pairs).toBe(2);
    const last = levels.at(-1)!;
    expect([last.cols, last.rows]).toEqual([8, 11]);
    expect(last.pairs).toBe(44);
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

  it('mỗi cỡ bàn đúng CAMPAIGN_REPEAT màn liền nhau, cỡ nào cũng có', () => {
    expect(CAMPAIGN_LEVELS).toBe(BOARD_SIZES.length * CAMPAIGN_REPEAT);
    for (const b of BOARD_SIZES) {
      const ids = levels.filter((l) => l.pairs === b.pairs).map((l) => l.id);
      expect(ids, `${b.pairs * 2} thẻ`).toHaveLength(CAMPAIGN_REPEAT);
      expect(ids.at(-1)! - ids[0]!, `${b.pairs * 2} thẻ liền nhau`).toBe(CAMPAIGN_REPEAT - 1);
    }
  });

  it('giờ là số nguyên giây, giảm dần qua 5 luật của một cỡ, bàn to luôn nhiều giờ hơn bàn nhỏ', () => {
    for (const l of levels) expect(Number.isInteger(l.timeLimit), `màn ${l.id}`).toBe(true);
    // màn đầu mỗi cỡ nhiều giờ hơn màn đầu cỡ trước, màn cuối cũng vậy
    for (let b = 1; b < BOARD_SIZES.length; b++) {
      for (const k of [0, CAMPAIGN_REPEAT - 1]) {
        expect(levels[b * CAMPAIGN_REPEAT + k]!.timeLimit).toBeGreaterThan(levels[(b - 1) * CAMPAIGN_REPEAT + k]!.timeLimit);
      }
    }
    // bàn 4 thẻ không còn thừa giờ (cần ~7 giây)
    expect(levels[0]!.timeLimit).toBeLessThanOrEqual(15);
  });

  it('chặng tròn hàng 5 cột, nối liền, phủ đủ mọi màn', () => {
    expect(CHAPTERS[0]!.from).toBe(1);
    expect(CHAPTERS.at(-1)!.to).toBe(CAMPAIGN_LEVELS);
    for (let i = 0; i < CHAPTERS.length; i++) {
      const c = CHAPTERS[i]!;
      expect((c.to - c.from + 1) % 5).toBe(0);
      if (i > 0) expect(c.from).toBe(CHAPTERS[i - 1]!.to + 1);
    }
  });

  it('thang khoá cỡ bàn ĐÓNG BĂNG: kỷ lục, online và app cũ vẫn đọc đúng cỡ', () => {
    expect(LEVEL_KEYS).toBe(50);
    expect(BOARD_SIZES.map((b) => b.level)).toEqual([1, 2, 3, 6, 10, 15, 21, 28, 37, 46, 49, 50]);
    expect(levelSpec(28).pairs).toBe(18);
    expect(() => levelSpec(51)).toThrow();
  });

  it('mỗi cỡ bàn: trơn · xáo · mạng · đặc biệt · trùm (bàn 4 thẻ: "nhanh" thay đặc biệt)', () => {
    for (let b = 0; b < BOARD_SIZES.length; b++) {
      const hang = levels.slice(b * CAMPAIGN_REPEAT, (b + 1) * CAMPAIGN_REPEAT);
      const dacBiet = hang[0]!.pairs >= 3 ? 'dacBiet' : 'nhanh';
      expect(hang.map((l) => l.luat), `${hang[0]!.pairs * 2} thẻ`).toEqual(['tron', 'xao', 'mang', dacBiet, 'trum']);
      expect(hang[4]!.cacLuat, 'trùm có hai luật').toHaveLength(2);
    }
  });

  it('luật nào thì bật đúng cơ chế đó, không hơn', () => {
    for (const l of levels) {
      expect(l.lives !== null, `màn ${l.id} mạng`).toBe(l.cacLuat.includes('mang'));
      expect(l.shuffleCount > 0, `màn ${l.id} xáo`).toBe(l.cacLuat.includes('xao'));
      expect(l.specialRate > 0, `màn ${l.id} đặc biệt`).toBe(l.cacLuat.includes('dacBiet'));
      if (l.lives !== null) expect(l.lives).toBeGreaterThanOrEqual(2);
      expect(l.specialRate).toBeLessThanOrEqual(0.3 + 1e-9);
    }
    // bàn 2 cặp không gắn được thẻ đặc biệt (buildDeck cần ≥3 cặp) — đừng hứa với người chơi
    expect(levels.filter((l) => l.pairs < 3).every((l) => !l.cacLuat.includes('dacBiet'))).toBe(true);
  });

  it('levelConfig mang luật của màn xuống engine', () => {
    const mang = levels.find((l) => l.luat === 'mang' && l.pairs >= 6)!;
    const xao = levels.find((l) => l.luat === 'xao' && l.pairs >= 6)!;
    expect(levelConfig(mang, SYMBOLS, 1).lives).toBe(mang.lives);
    expect(levelConfig(xao, SYMBOLS, 1).shuffleCount).toBe(xao.shuffleCount);
    expect(levelConfig(levels[0]!, SYMBOLS, 1).lives).toBeNull();
  });

  it('sao theo số lần lật sai: 3★ chặt hơn 2★, mốc tăng theo cỡ bàn', () => {
    for (const l of levels) {
      const [max2, max3] = l.starMisses;
      expect(max3, `màn ${l.id}`).toBeGreaterThanOrEqual(0);
      expect(max2, `màn ${l.id}`).toBeGreaterThan(max3);
      // 3★ không bao giờ cho phép sai nhiều hơn số cặp × 1,2 — luôn là mốc khó
      expect(max3, `màn ${l.id}`).toBeLessThanOrEqual(l.pairs * 1.2);
    }
    // Cùng luật thì bàn to không bao giờ chặt hơn bàn nhỏ (thẻ đặc biệt / trùm được nới mốc nên chỉ so cùng luật)
    for (let i = CAMPAIGN_REPEAT; i < levels.length; i++) {
      expect(levels[i]!.starMisses[1], `màn ${i + 1}`).toBeGreaterThanOrEqual(levels[i - CAMPAIGN_REPEAT]!.starMisses[1]);
    }
  });

  it('một lần sai quá mốc là rớt sao', () => {
    const [max2, max3] = campaignSpec(36).starMisses;
    expect(starsByMisses(max3, [max2, max3])).toBe(3);
    expect(starsByMisses(max3 + 1, [max2, max3])).toBe(2);
    expect(starsByMisses(max2 + 1, [max2, max3])).toBe(1);
  });

  it('chơi hoàn hảo màn 1 và một màn có mạng đều được 3 sao', () => {
    const lm = levels.find((l) => l.luat === 'mang' && l.pairs >= 6)!;
    const gm = new MemoryGame(levelConfig(lm, SYMBOLS, 778));
    gm.start(0);
    clearBoard(gm, 1000);
    expect(gm.summary()!.stars).toBe(3);
    const l = campaignSpec(1);
    const g = new MemoryGame(levelConfig(l, SYMBOLS, 777));
    g.start(0);
    clearBoard(g, 1000);
    const s = g.summary()!;
    expect(s.status).toBe('won');
    expect(s.stars).toBe(3);
  });

  it('màn không tồn tại thì báo lỗi', () => {
    expect(() => campaignSpec(0)).toThrow();
    expect(() => campaignSpec(CAMPAIGN_LEVELS + 1)).toThrow();
  });
});

describe('điểm hoàn hảo', () => {
  it('8 cặp = 1370 điểm', () => expect(perfectScore(8)).toBe(1370));
  it('tăng 200 điểm cho mỗi cặp thêm sau cặp thứ 4', () => {
    expect(perfectScore(9) - perfectScore(8)).toBe(200);
  });
});
