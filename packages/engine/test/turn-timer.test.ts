import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { presetConfig } from '../src/presets.js';
import { SYMBOLS, matchPair, missPair, pairSlots } from './helpers.js';

const timed = (over = {}) => new MemoryGame({
  mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 42, turnLimit: 15,
  players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }], ...over
});

describe('đồng hồ lượt 15 giây (multiplayer)', () => {
  it('bắt đầu ván thì người đi đầu có 15 giây', () => {
    const g = timed();
    g.start(0);
    expect(g.turnTimeLeft(0)).toBe(15);
    expect(g.turnTimeLeft(12_000)).toBe(3);
  });

  it('hết 15 giây: mất lượt, huỷ thẻ mở dở, mất combo', () => {
    const g = timed();
    g.start(0);
    matchPair(g, 0, 1000);                       // An giữ lượt, streak 1
    g.flip(pairSlots(g)[1]![0], 2000);           // mở dở 1 thẻ rồi... ngồi im
    const evs = g.tick(60_000);
    expect(evs.some((e) => e.type === 'turn-timeout' && e.playerId === 'a')).toBe(true);
    expect(evs.some((e) => e.type === 'turn' && e.playerId === 'b')).toBe(true);
    expect(g.current.id).toBe('b');
    expect(g.selection).toEqual([]);
    expect(g.players[0]!.streak).toBe(0);
    expect(g.turnTimeLeft(60_000)).toBe(15);     // Bình được 15 giây mới
  });

  it('ghép đúng được cộng 5 giây', () => {
    const g = timed();
    g.start(0);
    const evs = [
      ...g.flip(pairSlots(g)[0]![0], 8000),
      ...g.flip(pairSlots(g)[0]![1], 8000)
    ];
    const bonus = evs.find((e) => e.type === 'time-bonus');
    expect(bonus).toMatchObject({ playerId: 'a', ms: 5_000 });
    // 15 - 8 đã trôi = 7, +5 thưởng = 12 giây còn lại (dưới trần)
    expect(g.turnTimeLeft(8000)).toBe(12);
  });

  it('cộng giờ không vượt trần 15 giây', () => {
    const g = timed();
    g.start(0);
    matchPair(g, 0, 1000);                       // còn 14 + 5 → chạm trần 15
    expect(g.turnTimeLeft(1000)).toBe(15);
    matchPair(g, 1, 1000);                       // vẫn không vượt 15
    expect(g.turnTimeLeft(1000)).toBe(15);
  });

  it('chuyển lượt do lật sai thì người mới có nguyên 15 giây', () => {
    const g = timed();
    g.start(0);
    missPair(g, 0, 1, 10_000);                   // An dùng 10s rồi trượt
    expect(g.current.id).toBe('b');
    expect(g.turnTimeLeft(11_001)).toBe(15);
  });

  it('không kích hoạt khi đang khoá chờ úp thẻ', () => {
    const g = timed();
    g.start(0);
    const slots = pairSlots(g);
    g.flip(slots[0]![0], 14_500);
    g.flip(slots[1]![0], 14_800);                // trượt sát nút → khoá
    const evs = g.tick(15_500);                  // quá hạn nhưng đang khoá
    expect(evs.some((e) => e.type === 'turn-timeout')).toBe(false);
    g.tick(15_900);                              // hết khoá → chuyển lượt bình thường
    expect(g.current.id).toBe('b');
  });

  it('chơi đơn không có đồng hồ lượt dù config bật', () => {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 1, turnLimit: 15
    });
    g.start(0);
    expect(g.turnTimeLeft(0)).toBeNull();
    expect(g.tick(99_000).some((e) => e.type === 'turn-timeout')).toBe(false);
  });

  it('presetConfig: multiplayer tự bật 30s, chơi đơn thì không', () => {
    const mp = presetConfig({
      mode: 'classic', grid: '4x4', symbols: SYMBOLS, seed: 1,
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    });
    expect(mp.turnLimit).toBe(15);
    const solo = presetConfig({ mode: 'classic', grid: '4x4', symbols: SYMBOLS, seed: 1 });
    expect(solo.turnLimit).toBeUndefined();
  });

  it('ván kết thúc thì đồng hồ lượt tắt', () => {
    const g = timed({ cols: 2, rows: 2 });
    g.start(0);
    matchPair(g, 0, 100);
    matchPair(g, 1, 200);
    expect(g.finished).toBe(true);
    expect(g.turnTimeLeft(300)).toBeNull();
  });

  it('snapshot/restore giữ nguyên hạn chót lượt', () => {
    const g = timed();
    g.start(0);
    matchPair(g, 0, 5000);                       // còn 10 + 5 = 15 (chạm trần)
    const r = MemoryGame.restore(g.snapshot());
    expect(r.turnTimeLeft(5000)).toBe(g.turnTimeLeft(5000));
    const evs = r.tick(21_000);
    expect(evs.some((e) => e.type === 'turn-timeout')).toBe(true);
  });
});
