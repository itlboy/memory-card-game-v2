import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { Card } from '../src/types.js';

const SYMBOLS = Array.from({ length: 12 }, (_, i) => `s${i}`);

/** Dựng ván có ĐÚNG một thẻ swap ở ô cho trước, không thẻ đặc biệt nào khác. */
function gameWithSwapAt(index: number): MemoryGame {
  const g = new MemoryGame({
    mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 7
  });
  for (const c of g.cards) {
    (c as { power?: string }).power = undefined;
    (c as { powerUsed?: boolean }).powerUsed = false;
  }
  (g.cards[index] as { power?: string }).power = 'swap';
  g.start(0);
  return g;
}

const snapshotOf = (cards: readonly Card[]): string[] =>
  cards.map((c) => `${c.index}:${c.pairId}`);

describe('thẻ tráo đổi (swap)', () => {
  it('đổi chỗ đúng hai thẻ, và báo rõ hai ô nào', () => {
    const g = gameWithSwapAt(0);
    const before = snapshotOf(g.cards);
    const events = g.flip(0, 100);
    const power = events.find((e) => e.type === 'power');
    expect(power).toBeDefined();
    expect(power!.type === 'power' && power!.power).toBe('swap');
    const affected = power!.type === 'power' ? power!.affected : [];
    expect(affected).toHaveLength(2);

    const after = snapshotOf(g.cards);
    const moved = before.filter((v, i) => v !== after[i]).length;
    expect(moved).toBe(2);                       // đúng hai ô đổi nội dung
    const [a, b] = affected as [number, number];
    expect(new Set([a, b]).size).toBe(2);        // không tráo một ô với chính nó
  });

  it('index luôn khớp vị trí sau khi tráo — mọi luật tra theo index', () => {
    const g = gameWithSwapAt(0);
    g.flip(0, 100);
    g.cards.forEach((c, i) => expect(c.index, `ô ${i}`).toBe(i));
  });

  it('không tráo thẻ đang mở dở: nội dung nhảy chỗ trước mắt là vô lý', () => {
    const g = gameWithSwapAt(0);
    const events = g.flip(0, 100);
    const power = events.find((e) => e.type === 'power')!;
    const affected = power.type === 'power' ? power.affected : [];
    expect(affected).not.toContain(0);           // ô vừa lật
  });

  it('không tráo thẻ đã ghép', () => {
    const g = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 3 });
    g.start(0);
    // Ghép một cặp trước
    const first = g.cards[0]!;
    const twin = g.cards.find((c) => c.pairId === first.pairId && c.index !== first.index)!;
    g.flip(first.index, 10);
    g.flip(twin.index, 20);
    const matchedIdx = [first.index, twin.index];

    // Rồi bật swap
    for (const c of g.cards) (c as { power?: string }).power = undefined;
    const target = g.cards.find((c) => !matchedIdx.includes(c.index))!;
    (g.cards[target.index] as { power?: string }).power = 'swap';
    const events = g.flip(target.index, 30);
    const power = events.find((e) => e.type === 'power');
    const affected = power?.type === 'power' ? power.affected : [];
    for (const i of matchedIdx) expect(affected).not.toContain(i);
  });

  it('bàn thiếu thẻ úp để tráo thì không nổ lỗi, chỉ không tráo gì', () => {
    const g = new MemoryGame({ mode: 'classic', cols: 2, rows: 2, symbols: SYMBOLS, seed: 5 });
    g.start(0);
    (g.cards[0] as { power?: string }).power = 'swap';
    // Lật ô 0: chỉ còn 3 thẻ úp nên vẫn tráo được; kiểm là không ném lỗi
    expect(() => g.flip(0, 10)).not.toThrow();
  });
});

describe('mặt sau lá bài (online)', () => {
  it('cùng một seed thì cùng một mặt sau — cả phòng thấy giống nhau', async () => {
    const { backForSeed, CARD_BACKS } = await import('../src/online.js');
    for (const seed of [1, 42, 999, 123456]) {
      expect(backForSeed(seed)).toBe(backForSeed(seed));
      expect(CARD_BACKS).toContain(backForSeed(seed));
    }
  });

  it('seed khác nhau thì có đổi mặt sau, không cứng một kiểu', async () => {
    const { backForSeed } = await import('../src/online.js');
    const seen = new Set(Array.from({ length: 60 }, (_, i) => backForSeed(i * 7919)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('publicView mang mặt sau, để client không phải tự bốc', async () => {
    const { publicView } = await import('../src/online.js');
    const g = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 77 });
    g.start(0);
    const { backForSeed } = await import('../src/online.js');
    expect(publicView(g, 0, () => true).back).toBe(backForSeed(77));
  });
});
