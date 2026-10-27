import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZES, CAMPAIGN_LEVELS, CHAPTERS, LEVEL_KEYS, LUAT_THEO_CO, allLevels, campaignSpec, levelConfig,
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





  it('số màn theo ĐỘ SÂU: bàn nhỏ ít màn, bàn to nhiều màn, cỡ nào cũng có, tổng 60', () => {
    expect(CAMPAIGN_LEVELS).toBe(60);
    expect(LUAT_THEO_CO).toHaveLength(BOARD_SIZES.length);
    const soMan = BOARD_SIZES.map((b) => levels.filter((l) => l.pairs === b.pairs).length);
    expect(soMan[0], 'bàn 4 thẻ chỉ một màn — không quên nổi lần nào, lặp là vô nghĩa').toBe(1);
    for (let i = 1; i < soMan.length; i++) expect(soMan[i]!).toBeGreaterThanOrEqual(soMan[i - 1]!);
    for (const n of soMan) expect(n).toBeGreaterThan(0);
  });

  it('mỗi cỡ bàn mở đầu bằng màn trơn; màn trùm có từ hai luật; không hai màn liền nhau trùng luật', () => {
    for (const ds of LUAT_THEO_CO) {
      expect(ds[0]).toEqual([]);
      for (let i = 1; i < ds.length; i++) expect(ds[i]!.join('+')).not.toBe(ds[i - 1]!.join('+'));
    }
    for (const l of levels) expect(l.luat === 'trum').toBe(l.cacLuat.length >= 2);
  });

  it('tim CHỈ ở bàn 16–42 thẻ, và ít: không quá 12 tim (nhiều tim = luật trang trí)', () => {
    for (const l of levels.filter((x) => x.lives !== null)) {
      expect(l.pairs * 2, `màn ${l.id}`).toBeGreaterThanOrEqual(16);
      expect(l.pairs * 2, `màn ${l.id}`).toBeLessThanOrEqual(42);
      expect(l.lives!, `màn ${l.id}`).toBeLessThanOrEqual(12);
      expect(l.lives!).toBeGreaterThanOrEqual(2);
    }
  });

  it('cùng cỡ bàn: màn trơn nhiều giờ nhất; giờ là số nguyên giây', () => {
    for (const b of BOARD_SIZES) {
      const ds = levels.filter((l) => l.pairs === b.pairs);
      for (const l of ds) expect(Number.isInteger(l.timeLimit)).toBe(true);
      for (const l of ds.slice(1)) expect(l.timeLimit, `màn ${l.id}`).toBeLessThan(ds[0]!.timeLimit);
    }
  });

  it('bàn to luôn nhiều giờ hơn bàn nhỏ (so màn trơn)', () => {
    const tron = levels.filter((l) => l.luat === 'tron');
    for (let i = 1; i < tron.length; i++) expect(tron[i]!.timeLimit).toBeGreaterThan(tron[i - 1]!.timeLimit);
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


  it('luật nào thì bật đúng cơ chế đó, không hơn', () => {
    for (const l of levels) {
      expect(l.lives !== null, `màn ${l.id} mạng`).toBe(l.cacLuat.includes('mang'));
      expect(l.shuffleCount > 0, `màn ${l.id} xáo`).toBe(l.cacLuat.includes('xao'));
      expect(l.peekMs > 0, `màn ${l.id} xem trước`).toBe(l.cacLuat.includes('xemTruoc'));
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
    // Màn trơn: bàn to không bao giờ chặt hơn bàn nhỏ
    const tron = levels.filter((l) => l.luat === 'tron');
    for (let i = 1; i < tron.length; i++) expect(tron[i]!.starMisses[0]).toBeGreaterThanOrEqual(tron[i - 1]!.starMisses[0]);
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
