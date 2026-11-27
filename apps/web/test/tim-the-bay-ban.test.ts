/**
 * BÀN VÒNG TRÒN của Tìm Thẻ (27.11.2026): mọi lá (kể cả thẻ giữa) không chồng nhau, nằm trọn trong khung, ở mọi số thẻ
 * 3–9 và mọi khung hay gặp (điện thoại dọc nhỏ/to, màn ngang).
 */
import { describe, expect, it } from 'vitest';
import { bayVong } from '../src/lib/tim-the';

function soat(n: number, W: number, H: number): { khe: number; tran: number } {
  const b = bayVong(n, W, H);
  const o = [b.tam, ...b.vi];
  let khe = Infinity, tran = 0;
  for (let i = 0; i < o.length; i++) {
    const [x, y] = o[i]!;
    if (x - b.w / 2 < -0.5 || x + b.w / 2 > W + 0.5 || y - b.h / 2 < -0.5 || y + b.h / 2 > H + 0.5) tran++;
    for (let j = i + 1; j < o.length; j++) {
      const [x2, y2] = o[j]!;
      khe = Math.min(khe, Math.max(Math.abs(x - x2) - b.w, Math.abs(y - y2) - b.h));
    }
  }
  return { khe, tran };
}

describe('bayVong — bàn vòng tròn', () => {
  const KHUNG = [[365, 520], [360, 570], [300, 470], [345, 430], [700, 360], [844, 330], [768, 820]] as const;
  it('không lá nào tràn khung, khe ≥ 8px ở mọi số thẻ 3–9', () => {
    for (const n of [3, 4, 5, 6, 7, 8, 9]) for (const [w, h] of KHUNG) {
      const r = soat(n, w, h);
      expect(r.tran, `${n} thẻ, ${w}×${h}`).toBe(0);
      expect(r.khe, `${n} thẻ, ${w}×${h}`).toBeGreaterThanOrEqual(8);
    }
  });
  it('lá đầu ở 12 giờ, rồi theo chiều kim đồng hồ', () => {
    const b = bayVong(6, 365, 520);
    expect(Math.abs(b.vi[0]![0] - b.tam[0])).toBeLessThan(0.5);
    expect(b.vi[0]![1]).toBeLessThan(b.tam[1]);
    expect(b.vi[1]![0]).toBeGreaterThan(b.tam[0]);
  });
  it('màn ngang: elip nằm ngang', () => {
    const b = bayVong(8, 844, 330);
    const xs = b.vi.map((p) => p[0]), ys = b.vi.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });
});
