import { describe, expect, it } from 'vitest';
import { duongBong } from '../src/lib/duong-bong';

/*
 * Bong bóng chat phải LIỀN MỘT NÉT (chủ dự án 18.11.2026, sau hai lần đuôi ghép lộ mối nối):
 * thân + đuôi là một đường khép kín duy nhất. Đường có hơn một `M` = có hình thứ hai ghép vào.
 */
describe('duongBong — viền bong bóng một nét', () => {
  const ca = [
    [60, 48, 2.5, 18, 'duoi'], [44, 38, 2.5, 16, 'trai'], [150, 34, 2, 14, 'tren'],
    [40, 30, 2, 14, undefined], [300, 40, 2.5, 18, 'duoi'],
  ] as const;
  for (const [w, h, day, r, canh] of ca) {
    it(`${w}×${h} đuôi ${canh ?? 'không'}: một đường khép kín, số hữu hạn`, () => {
      const d = duongBong(w, h, day, r, canh);
      expect(d.match(/M/g)).toHaveLength(1);
      expect(d.trim().endsWith('Z')).toBe(true);
      expect(d).not.toMatch(/NaN|Infinity/);
    });
  }

  it('đuôi mọc ra NGOÀI khung đúng cạnh', () => {
    const so = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const xs = (d: string) => so(d.replace(/A[^A-Z]*?(?= [LCZ])/g, '')).filter((_, i) => i % 2 === 0);
    const ys = (d: string) => so(d.replace(/A[^A-Z]*?(?= [LCZ])/g, '')).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys(duongBong(60, 48, 2.5, 18, 'duoi')))).toBeGreaterThan(48);
    expect(Math.min(...ys(duongBong(150, 34, 2, 14, 'tren')))).toBeLessThan(0);
    expect(Math.min(...xs(duongBong(44, 38, 2.5, 16, 'trai')))).toBeLessThan(0);
  });
});
