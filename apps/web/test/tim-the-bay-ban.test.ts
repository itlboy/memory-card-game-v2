import { describe, expect, it } from 'vitest';
import { bayBan } from '../src/lib/tim-the';

/** Khung bàn thật (đo ở màn Tìm Thẻ, iPhone 15 dọc): ~365 × ~520. */
const W = 365, H = 520;

describe('bayBan — bàn phủ đều màn dọc (27.11.2026)', () => {
  it('màn dọc: 6 thẻ 2×3, 12 thẻ 3×4, 9 thẻ 3×3, 16 thẻ 4×4', () => {
    expect(bayBan(6, W, H).cot).toBe(2);
    expect(bayBan(12, W, H).cot).toBe(3);
    expect(bayBan(9, W, H).cot).toBe(3);
    expect(bayBan(16, W, H).cot).toBe(4);
  });
  it('lá luôn vừa khung (không tràn ngang lẫn dọc)', () => {
    for (const n of [3, 4, 6, 9, 12, 16]) for (const [w, h] of [[365, 520], [345, 430], [700, 400]]) {
      const b = bayBan(n, w, h);
      const hang = Math.ceil(n / b.cot);
      expect(b.cot * b.w + 10 * (b.cot - 1)).toBeLessThanOrEqual(w);
      expect(hang * b.w * 4 / 3 + 10 * (hang - 1)).toBeLessThanOrEqual(h + 1);
    }
  });
  it('bàn nhỏ giữ cách bày quen: 3 lá một hàng, 4 lá 2×2', () => {
    expect(bayBan(3, W, H).cot).toBe(3);
    expect(bayBan(4, W, H).cot).toBe(2);
  });
  it('màn ngang (máy tính bảng xoay ngang): nhiều cột hơn', () => {
    expect(bayBan(6, 700, 400).cot).toBeGreaterThanOrEqual(3);
  });
});
