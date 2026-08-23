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
  /**
   * Lộ ra hai thẻ KHÔNG thành cặp rồi để chúng úp lại — sau bước này chúng nằm
   * trong tập `seen`, tức là "người chơi đã thấy". Thẻ tráo chỉ được phép tráo
   * loại này: tráo thẻ chưa ai mở thì người chơi không có ký ức nào để bị phá.
   */
  function revealTwo(g: MemoryGame): number[] {
    const first = g.cards[0]!;
    const other = g.cards.find((c) => c.pairId !== first.pairId)!;
    g.flip(first.index, 10);
    g.flip(other.index, 20);
    g.tick(20 + 3000);                       // hết flipBackMs, hai thẻ úp lại
    return [first.index, other.index];
  }

  it('chỉ tráo thẻ ĐÃ TỪNG LỘ RA', () => {
    const g = gameWithSwapAt(15);
    const seen = revealTwo(g);
    const before = snapshotOf(g.cards);
    const events = g.flip(15, 100);
    const power = events.find((e) => e.type === 'power');
    expect(power, 'phải kích hoạt thẻ tráo').toBeDefined();
    const affected = power!.type === 'power' ? power!.affected : [];
    expect(affected).toHaveLength(2);
    // Hai ô bị tráo PHẢI nằm trong số đã lộ
    for (const i of affected) expect(seen).toContain(i);

    const after = snapshotOf(g.cards);
    expect(before.filter((v, i) => v !== after[i]).length).toBe(2);
  });

  it('chưa thẻ nào lộ ra thì KHÔNG tráo, và để dành thẻ cho lần sau', () => {
    const g = gameWithSwapAt(0);
    const before = snapshotOf(g.cards);
    const events = g.flip(0, 100);
    expect(events.find((e) => e.type === 'power')).toBeUndefined();
    expect(snapshotOf(g.cards)).toEqual(before);      // bàn y nguyên
    expect(g.cards[0]!.powerUsed).toBe(false);        // chưa tiêu, còn dùng được
  });

  it('index luôn khớp vị trí sau khi tráo — mọi luật tra theo index', () => {
    const g = gameWithSwapAt(15);
    revealTwo(g);
    g.flip(15, 100);
    g.cards.forEach((c, i) => expect(c.index, `ô ${i}`).toBe(i));
  });

  it('không tráo thẻ đang mở dở: nội dung nhảy chỗ trước mắt là vô lý', () => {
    const g = gameWithSwapAt(15);
    revealTwo(g);
    const events = g.flip(15, 100);
    const power = events.find((e) => e.type === 'power')!;
    const affected = power.type === 'power' ? power.affected : [];
    expect(affected).not.toContain(15);
  });

  it('không tráo thẻ đã ghép', () => {
    const g = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 3 });
    g.start(0);
    // Ghép một cặp — nó vào `seen` nhưng đã matched nên phải bị loại
    const first = g.cards[0]!;
    const twin = g.cards.find((c) => c.pairId === first.pairId && c.index !== first.index)!;
    g.flip(first.index, 10);
    g.flip(twin.index, 20);
    const matchedIdx = [first.index, twin.index];

    // Rồi lộ thêm hai thẻ khác để có cái mà tráo
    const rest = g.cards.filter((c) => !matchedIdx.includes(c.index));
    const a = rest[0]!, b = rest.find((c) => c.pairId !== a.pairId)!;
    g.flip(a.index, 30);
    g.flip(b.index, 40);
    g.tick(40 + 3000);

    for (const c of g.cards) (c as { power?: string }).power = undefined;
    const target = rest.find((c) => c.index !== a.index && c.index !== b.index)!;
    (g.cards[target.index] as { power?: string }).power = 'swap';
    const events = g.flip(target.index, 50);
    const power = events.find((e) => e.type === 'power');
    const affected = power?.type === 'power' ? power.affected : [];
    for (const i of matchedIdx) expect(affected).not.toContain(i);
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
