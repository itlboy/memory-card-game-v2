import { describe, expect, it } from 'vitest';
import { buildDeck, reshuffleHidden } from '../src/deck.js';
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

  it('từ chối lưới dưới 4 ô và theme không đủ biểu tượng', () => {
    expect(() => deck({ cols: 1, rows: 2 })).toThrow(/không hợp lệ/);
    expect(() => deck({ symbols: ['a', 'b'] })).toThrow(/biểu tượng/);
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

  it('xáo trộn chỉ đảo các ô chưa mở và giữ nguyên đủ số thẻ', () => {
    const cards = deck();
    const hidden = [2, 3, 5, 8, 11];
    const before = cards.map((c) => c.symbol);
    reshuffleHidden(cards, hidden, new Rng(42));
    // Ô ngoài danh sách không đổi
    for (let i = 0; i < cards.length; i++) {
      if (!hidden.includes(i)) expect(cards[i]!.symbol).toBe(before[i]);
    }
    // Tập biểu tượng trong các ô chưa mở được bảo toàn
    expect(hidden.map((i) => cards[i]!.symbol).sort()).toEqual(hidden.map((i) => before[i]!).sort());
    expect(cards.every((c, i) => c.index === i)).toBe(true);
  });
});
