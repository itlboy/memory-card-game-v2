import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { Power } from '../src/types.js';
import { SYMBOLS, matchPair, pairSlots } from './helpers.js';

/** Dựng ván rồi gán cứng hiệu ứng lên 1 thẻ của cặp `pairId` để test tất định. */
function withPower(power: Power, pairId: number, over = {}) {
  const g = new MemoryGame({
    mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 555, shufflePlayers: false, ...over
  });
  for (const c of g.cards) {
    (c as { power?: Power }).power = undefined;
    c.powerUsed = false;
  }
  const slot = pairSlots(g)[pairId]![0];
  (g.cards[slot] as { power?: Power }).power = power;
  return { g, slot };
}

describe('thẻ đặc biệt (SRS 3.4)', () => {
  it('thẻ bom úp lại 2 cặp đã mở', () => {
    const { g, slot } = withPower('bomb', 5);
    matchPair(g, 0); matchPair(g, 1); matchPair(g, 2);
    expect(g.matched.size).toBe(3);
    const evs = g.flip(slot, 0);
    const power = evs.find((e) => e.type === 'power');
    expect(power).toMatchObject({ power: 'bomb' });
    expect(g.matched.size).toBe(1);
    expect(g.players[0]!.pairs).toBe(1);
  });

  it('thẻ bom chỉ úp được số cặp thực có', () => {
    const { g, slot } = withPower('bomb', 5);
    matchPair(g, 0);
    g.flip(slot, 0);
    expect(g.matched.size).toBe(0);
  });

  it('thẻ x2 nhân đôi điểm của cặp tiếp theo, chỉ một lần', () => {
    const { g, slot } = withPower('x2', 3);
    matchPair(g, 0);                                  // +100
    expect(g.players[0]!.score).toBe(100);
    const [a, b] = pairSlots(g)[3]!;
    expect(slot).toBe(a);
    g.flip(a, 0);                                     // kích hoạt x2
    expect(g.players[0]!.doubleNext).toBe(true);
    g.flip(b, 0);                                     // cặp này: 100×1.2×2 = 240
    expect(g.players[0]!.score).toBe(340);
    expect(g.players[0]!.doubleNext).toBe(false);
    matchPair(g, 1);                                  // trở lại bình thường: ×1.5
    expect(g.players[0]!.score).toBe(340 + 150);
  });

  it('thẻ mắt thần hé mở toàn bàn 5 giây', () => {
    const { g, slot } = withPower('eye', 4);
    g.start(0);
    g.flip(slot, 1000);
    expect(g.revealingAll).toBe(true);
    g.tick(5500);
    expect(g.revealingAll).toBe(true);
    g.tick(6001);
    expect(g.revealingAll).toBe(false);
  });

  it('hiệu ứng chỉ kích hoạt một lần cho mỗi thẻ', () => {
    const { g, slot } = withPower('bomb', 5);
    matchPair(g, 0); matchPair(g, 1);
    expect(g.matched.size).toBe(2);
    g.flip(slot, 0);                     // nổ lần đầu → mất cả 2 cặp
    expect(g.matched.size).toBe(0);

    g.flip(pairSlots(g)[7]![0], 0);      // ghép sai để úp thẻ bom xuống lại
    g.tick(1001);
    expect(g.isFaceUp(slot)).toBe(false);

    matchPair(g, 0, 2000);               // mở lại 1 cặp
    g.flip(slot, 3000);                  // lật lại thẻ bom
    expect(g.matched.size).toBe(1);      // không nổ lần hai
  });

  it('chơi đơn không sinh thẻ đóng băng', () => {
    const g = new MemoryGame({
      mode: 'survival', cols: 6, rows: 6, symbols: SYMBOLS, seed: 1, specialRate: 1
    });
    expect(g.cards.some((c) => c.power === 'freeze')).toBe(false);
    expect(g.cards.some((c) => c.power)).toBe(true);
  });
});
