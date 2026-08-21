import { describe, expect, it } from 'vitest';
import { Rng, seedFrom } from '../src/rng.js';

describe('Rng', () => {
  it('next() luôn nằm trong [0, 1)', () => {
    const r = new Rng(1);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) luôn nằm trong [0, n) và phủ hết các giá trị', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('cùng seed cho cùng dãy số', () => {
    const a = new Rng(42), b = new Rng(42);
    const seq = (r: Rng) => Array.from({ length: 20 }, () => r.next());
    expect(seq(a)).toEqual(seq(b));
  });

  it('seed 0 vẫn sinh số hợp lệ (không rơi vào dãy toàn 0)', () => {
    const r = new Rng(0);
    const values = Array.from({ length: 10 }, () => r.next());
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('seed âm và seed thực được chuẩn hoá về uint32', () => {
    for (const seed of [-1, -99999, 3.7, 2 ** 33]) {
      const values = Array.from({ length: 5 }, () => new Rng(seed).next());
      expect(values.every((v) => Number.isFinite(v) && v >= 0 && v < 1)).toBe(true);
    }
  });

  it('shuffle giữ nguyên các phần tử và không sửa mảng gốc', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = new Rng(5).shuffle(input);
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('shuffle thực sự đảo thứ tự với mảng đủ dài', () => {
    const input = Array.from({ length: 30 }, (_, i) => i);
    expect(new Rng(11).shuffle(input)).not.toEqual(input);
  });

  it('shuffle mảng rỗng và 1 phần tử không lỗi', () => {
    expect(new Rng(1).shuffle([])).toEqual([]);
    expect(new Rng(1).shuffle(['x'])).toEqual(['x']);
  });

  it('sample lấy đúng số lượng, không lặp phần tử', () => {
    const out = new Rng(3).sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(out).toHaveLength(4);
    expect(new Set(out).size).toBe(4);
  });

  it('sample nhiều hơn số phần tử có thì trả về tất cả', () => {
    expect(new Rng(3).sample([1, 2], 10).sort()).toEqual([1, 2]);
  });

  it('seedFrom chuẩn hoá về uint32 khác 0', () => {
    expect(seedFrom(0)).toBe(1);
    expect(seedFrom(5.9)).toBe(5);
    expect(seedFrom(-1)).toBeGreaterThan(0);
  });
});
