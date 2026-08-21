import { describe, expect, it } from 'vitest';
import { comboMultiplier, pairScore, starsFor, timeBonus } from '../src/scoring.js';

describe('công thức điểm (SRS 3.5)', () => {
  it('combo: cặp đầu x1, rồi x1.2, x1.5, và trần x2', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1.2);
    expect(comboMultiplier(3)).toBe(1.5);
    expect(comboMultiplier(4)).toBe(2);
    expect(comboMultiplier(99)).toBe(2);
  });

  it('điểm cặp = 100 × combo, thẻ x2 thì nhân đôi', () => {
    expect(pairScore(1, false)).toBe(100);
    expect(pairScore(2, false)).toBe(120);
    expect(pairScore(3, false)).toBe(150);
    expect(pairScore(4, false)).toBe(200);
    expect(pairScore(4, true)).toBe(400);
  });

  it('thưởng thời gian = 5 điểm mỗi giây còn lại, không âm', () => {
    expect(timeBonus(10)).toBe(50);
    expect(timeBonus(0)).toBe(0);
    expect(timeBonus(-30)).toBe(0);
  });

  it('sao theo mốc điểm của màn', () => {
    expect(starsFor(500, [400, 700])).toBe(2);
    expect(starsFor(399, [400, 700])).toBe(1);
    expect(starsFor(700, [400, 700])).toBe(3);
    expect(starsFor(0, undefined)).toBe(3); // chế độ không xếp sao
  });
});
