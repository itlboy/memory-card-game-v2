import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { Power } from '../src/types.js';
import { SYMBOLS, makeGame, matchPair, missPair, pairSlots } from './helpers.js';

describe('các nhánh biên', () => {
  it('ghép đúng ở lượt cuối cùng nhưng chưa xong bàn thì vẫn thua vì hết lượt', () => {
    const g = makeGame({ moveLimit: 2 });
    missPair(g, 0, 1);            // lượt 1: sai
    matchPair(g, 2);              // lượt 2: đúng, nhưng hết lượt và bàn chưa xong
    expect(g.status).toBe('lost');
    expect(g.summary()!.reason).toBe('no-moves');
    expect(g.matched.size).toBe(1);
  });

  it('flip sau khi ván kết thúc bị bỏ qua', () => {
    const g = makeGame({ cols: 2, rows: 1 });
    matchPair(g, 0);
    expect(g.status).toBe('won');
    expect(g.flip(0, 100)).toEqual([]);
    expect(g.moves).toBe(1);
  });

  it('tick sau khi kết thúc không phát thêm sự kiện', () => {
    const g = makeGame({ cols: 2, rows: 1, timeLimit: 5 });
    g.start(0);
    matchPair(g, 0, 1000);
    expect(g.tick(999_999)).toEqual([]);
  });

  it('start gọi lần thứ hai không reset đồng hồ', () => {
    const g = makeGame();
    g.start(1000);
    expect(g.start(5000)).toEqual([]);
    expect(g.startedAt).toBe(1000);
  });

  it('flip tự động bắt đầu ván nếu chưa gọi start', () => {
    const g = makeGame();
    expect(g.status).toBe('idle');
    g.flip(0, 700);
    expect(g.status).toBe('playing');
    expect(g.startedAt).toBe(700);
  });

  it('resolvePending khi không có gì chờ thì không làm gì', () => {
    const g = makeGame();
    matchPair(g, 0);
    expect(g.resolvePending(100)).toEqual([]);
    expect(g.matched.size).toBe(1);
  });

  it('không lật được thẻ thứ ba trong cùng một lượt', () => {
    const g = makeGame();
    const slots = pairSlots(g);
    g.flip(slots[0]![0], 0);
    g.flip(slots[0]![1], 0);       // ghép đúng, selection đã trống
    g.flip(slots[1]![0], 0);
    expect(g.selection).toHaveLength(1);
    g.flip(slots[1]![1], 0);       // đúng tiếp
    expect(g.selection).toHaveLength(0);
  });

  it('summary() trả về null trước khi ván kết thúc', () => {
    const g = makeGame();
    matchPair(g, 0);
    expect(g.summary()).toBeNull();
  });

  it('thời gian đóng băng sau khi ván kết thúc', () => {
    const g = makeGame({ cols: 2, rows: 1 });
    g.start(0);
    matchPair(g, 0, 3000);
    expect(g.elapsed(999_999)).toBe(3);
  });

  it('elapsed = 0 khi chưa bắt đầu', () => {
    expect(makeGame().elapsed(9999)).toBe(0);
  });

  it('không tạo được bàn từ theme thiếu biểu tượng', () => {
    expect(() => new MemoryGame({
      mode: 'classic', cols: 6, rows: 6, symbols: SYMBOLS.slice(0, 4), seed: 1
    })).toThrow(/biểu tượng/);
  });
});

describe('thẻ đóng băng — các nhánh còn lại', () => {
  const twoPlayer = () => new MemoryGame({
    mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 8,
    players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }]
  });

  /** Gán cứng hiệu ứng để test tất định. */
  const plant = (g: MemoryGame, power: Power, pairId: number): number => {
    for (const c of g.cards) { (c as { power?: Power }).power = undefined; c.powerUsed = false; }
    const slot = pairSlots(g)[pairId]![0];
    (g.cards[slot] as { power?: Power }).power = power;
    return slot;
  };

  it('lật thẻ đóng băng thì đối thủ mất lượt kế tiếp', () => {
    const g = twoPlayer();
    const slot = plant(g, 'freeze', 3);
    const evs = g.flip(slot, 0);
    expect(evs.some((e) => e.type === 'power' && e.power === 'freeze')).toBe(true);
    expect(g.players[1]!.frozenTurns).toBe(1);

    missPair(g, 0, 1);                        // An sai → lẽ ra tới Bình
    expect(g.current.id).toBe('a');           // Bình bị bỏ lượt, quay lại An
    expect(g.players[1]!.frozenTurns).toBe(0);
  });

  it('chơi đơn lật thẻ đóng băng thì không tự đóng băng chính mình', () => {
    const g = makeGame();
    const slot = plant(g, 'freeze', 2);
    g.flip(slot, 0);
    expect(g.players[0]!.frozenTurns).toBe(0);
  });

  it('mọi người đều bị đóng băng thì lượt vẫn tiến, không treo vòng lặp', () => {
    const g = twoPlayer();
    g.players[0]!.frozenTurns = 1;
    g.players[1]!.frozenTurns = 1;
    missPair(g, 0, 1);
    expect(g.finished).toBe(false);
    expect(g.players.some((p) => p.frozenTurns === 0)).toBe(true);
  });

  it('tất cả đều bị đóng băng nhiều lượt thì vòng tìm lượt vẫn dừng, không treo', () => {
    const g = twoPlayer();
    g.players[0]!.frozenTurns = 2;
    g.players[1]!.frozenTurns = 2;
    missPair(g, 0, 1);                        // vòng tìm lượt cạn số lần thử
    expect(g.finished).toBe(false);
    // Trò chơi vẫn tiếp tục được: người đang tới lượt lật được thẻ
    expect(g.flip(pairSlots(g)[2]![0], 5000)).not.toEqual([]);
  });

  it('thẻ mắt thần cho biết toàn bộ thẻ bị ảnh hưởng', () => {
    const g = makeGame();
    const slot = plant(g, 'eye', 1);
    const ev = g.flip(slot, 0).find((e) => e.type === 'power');
    expect(ev).toMatchObject({ power: 'eye' });
    if (ev?.type !== 'power') throw new Error('thiếu sự kiện power');
    expect(ev.affected).toHaveLength(g.cards.length);
  });
});
