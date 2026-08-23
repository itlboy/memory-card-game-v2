import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/deck.js';
import { Rng } from '../src/rng.js';
import { SYMBOLS } from './helpers.js';

const deck = (over = {}) =>
  buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(7), ...over });

describe('dựng bộ thẻ', () => {
  it('mỗi biểu tượng xuất hiện đúng 2 lần', () => {
    const counts = new Map<number, number>();
    for (const c of deck()) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
    expect(counts.size).toBe(8);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });

  it('index khớp vị trí trong mảng', () => {
    deck().forEach((c, i) => expect(c.index).toBe(i));
  });

  it('cùng seed cho cùng bàn thẻ, seed khác thì khác (điều kiện cho ON-06/ON-09)', () => {
    const a = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(99) });
    const b = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(99) });
    const c = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(100) });
    expect(a.map((x) => x.symbol)).toEqual(b.map((x) => x.symbol));
    expect(a.map((x) => x.symbol)).not.toEqual(c.map((x) => x.symbol));
  });

  it('từ chối lưới dưới 2 ô và theme không đủ biểu tượng', () => {
    expect(() => deck({ cols: 1, rows: 1 })).toThrow(/không hợp lệ/);
    expect(() => deck({ symbols: ['a', 'b'] })).toThrow(/biểu tượng/);
  });

  it('bàn 2 thẻ (màn tập) dựng được', () => {
    const cards = deck({ cols: 2, rows: 1 });
    expect(cards).toHaveLength(2);
    expect(cards[0]!.symbol).toBe(cards[1]!.symbol);
  });

  it('lưới lẻ ô (3×3): ô chính giữa để trống, còn lại 4 cặp đủ đôi', () => {
    const cards = deck({ cols: 3, rows: 3 });
    expect(cards).toHaveLength(9);
    expect(cards[4]!.blank).toBe(true);           // ô giữa lưới 3×3
    const counts = new Map<number, number>();
    for (const c of cards) if (!c.blank) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
    expect(counts.size).toBe(4);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(cards.every((c, i) => c.index === i)).toBe(true);
  });

  it('lưới chẵn ô không có ô trống nào', () => {
    expect(deck().some((c) => c.blank)).toBe(false);
  });

  it('thẻ đặc biệt chỉ gắn trên 1 trong 2 thẻ của cặp', () => {
    const cards = deck({ cols: 6, rows: 6, specialRate: 0.5 });
    const perPair = new Map<number, number>();
    for (const c of cards) if (c.power) perPair.set(c.pairId, (perPair.get(c.pairId) ?? 0) + 1);
    expect(perPair.size).toBeGreaterThan(0);
    expect([...perPair.values()].every((n) => n === 1)).toBe(true);
  });

  it('specialRate = 0 thì không có thẻ đặc biệt nào', () => {
    expect(deck({ cols: 6, rows: 6, specialRate: 0 }).some((c) => c.power)).toBe(false);
  });
});

describe('không xếp hai thẻ cùng cặp sát nhau', () => {
  /** Đếm cặp nằm kề theo hàng/cột — cài lại độc lập với engine để test có giá trị. */
  const adjacent = (cards: readonly { pairId: number }[], cols: number, rows: number): number => {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = cards[r * cols + c]!.pairId;
        if (id < 0) continue;   // ô trống
        if (c + 1 < cols && cards[r * cols + c + 1]!.pairId === id) n++;
        if (r + 1 < rows && cards[(r + 1) * cols + c]!.pairId === id) n++;
      }
    }
    return n;
  };

  // Lưới lớn cần tới 32 cặp — SYMBOLS chỉ có 24, nên dựng pool riêng cho test
  const POOL = Array.from({ length: 32 }, (_, i) => `s${i}`);

  // 2×2 nằm ngoài luật (xem chú thích trong deck.ts): chỉ có một cách xếp không
  // kề nhau nên áp luật vào đó là ván nào cũng giống ván nào
  it.each([[3, 3], [3, 4], [4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [8, 8]])(
    'lưới %ix%i: không seed nào còn cặp kề nhau',
    (cols, rows) => {
      for (let seed = 1; seed <= 120; seed++) {
        expect(adjacent(buildDeck({ cols, rows, symbols: POOL, rng: new Rng(seed) }), cols, rows)).toBe(0);
      }
    }
  );

  it('lưới 2×2 được miễn: không phải ván nào cũng xếp chéo', () => {
    let diagonal = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const cards = buildDeck({ cols: 2, rows: 2, symbols: POOL, rng: new Rng(seed) });
      if (cards[0]!.pairId === cards[3]!.pairId) diagonal++;
    }
    // Áp luật chống-kề vào 2×2 sẽ cho đúng 300/300; phải quanh mức ngẫu nhiên 1/3
    expect(diagonal).toBeGreaterThan(60);
    expect(diagonal).toBeLessThan(160);
  });

  it('vẫn tất định: cùng seed cho cùng bàn', () => {
    const ids = (seed: number): number[] =>
      buildDeck({ cols: 5, rows: 6, symbols: SYMBOLS, rng: new Rng(seed) }).map((c) => c.pairId);
    expect(ids(42)).toEqual(ids(42));
    expect(ids(42)).not.toEqual(ids(43));
  });
});
