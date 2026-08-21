import { describe, expect, it } from 'vitest';
import { clearBoard, makeGame, matchPair, missPair, pairSlots } from './helpers.js';

describe('luật chơi cốt lõi (SRS mục 2)', () => {
  it('ghép đúng thì 2 thẻ giữ trạng thái mở và được lật tiếp', () => {
    const g = makeGame();
    matchPair(g, 0);
    const [a, b] = pairSlots(g)[0]!;
    expect(g.isFaceUp(a) && g.isFaceUp(b)).toBe(true);
    expect(g.selection).toEqual([]);       // không bị khoá → lật tiếp được ngay
    expect(g.locked).toBe(false);
  });

  it('ghép sai thì khoá bàn rồi úp lại sau flipBackMs', () => {
    const g = makeGame();
    const slots = pairSlots(g);
    g.flip(slots[0]![0], 0);
    g.flip(slots[1]![0], 0);
    expect(g.locked).toBe(true);
    g.tick(500);
    expect(g.locked).toBe(true);           // chưa tới hạn thì vẫn mở
    g.tick(1001);
    expect(g.locked).toBe(false);
    expect(g.isFaceUp(slots[0]![0])).toBe(false);
  });

  it('bỏ qua hành động không hợp lệ: thẻ đã mở, đang khoá, ngoài phạm vi', () => {
    const g = makeGame();
    const slots = pairSlots(g);
    expect(g.flip(slots[0]![0], 0)).toHaveLength(1);
    expect(g.flip(slots[0]![0], 0)).toEqual([]);   // lật lại cùng thẻ
    expect(g.flip(999, 0)).toEqual([]);
    expect(g.flip(-1, 0)).toEqual([]);
    g.flip(slots[1]![0], 0);                        // sai → khoá
    expect(g.flip(slots[2]![0], 0)).toEqual([]);
  });

  it('ván kết thúc khi mở hết các cặp', () => {
    const g = makeGame();
    clearBoard(g);
    expect(g.status).toBe('won');
    expect(g.summary()!.reason).toBe('cleared');
    expect(g.moves).toBe(8);
  });
});

describe('Classic (SP-01)', () => {
  it('ván hoàn hảo 4×4 = 100+120+150+200×5 = 1370 điểm', () => {
    const g = makeGame();
    clearBoard(g);
    expect(g.summary()!.score).toBe(1370);
    expect(g.summary()!.bestStreak).toBe(8);
  });

  it('lật sai bị trừ 10 điểm và reset combo', () => {
    const g = makeGame();
    matchPair(g, 0);                 // +100, streak 1
    matchPair(g, 1);                 // +120, streak 2
    expect(g.players[0]!.score).toBe(220);
    missPair(g, 2, 3);               // -10, streak về 0
    expect(g.players[0]!.score).toBe(210);
    expect(g.players[0]!.streak).toBe(0);
    matchPair(g, 2);                 // combo khởi động lại từ x1
    expect(g.players[0]!.score).toBe(310);
    expect(g.summary()).toBeNull();
  });

  it('điểm không xuống dưới 0', () => {
    const g = makeGame();
    for (let i = 0; i < 5; i++) missPair(g, 0, 1);
    expect(g.players[0]!.score).toBe(0);
  });

  it('Classic không giới hạn thời gian', () => {
    const g = makeGame();
    g.start(0);
    expect(g.timeLeft(0)).toBeNull();
    g.tick(9_999_999);
    expect(g.status).toBe('playing');
  });
});

describe('Time Attack (SP-02)', () => {
  it('cộng 5 điểm cho mỗi giây còn lại khi thắng', () => {
    const g = makeGame({ mode: 'time', timeLimit: 70 });
    g.start(0);
    for (let p = 0; p < g.totalPairs; p++) matchPair(g, p, 20_000);   // xong ở giây thứ 20
    const s = g.summary()!;
    expect(s.seconds).toBe(20);
    expect(s.timeBonus).toBe(50 * 5);
    expect(s.score).toBe(1370 + 250);
  });

  it('hết thời gian là thua, không có thưởng thời gian', () => {
    const g = makeGame({ mode: 'time', timeLimit: 30 });
    g.start(0);
    matchPair(g, 0, 1000);
    g.tick(31_000);
    expect(g.status).toBe('lost');
    expect(g.summary()!.reason).toBe('timeout');
    expect(g.summary()!.timeBonus).toBe(0);
    expect(g.summary()!.stars).toBe(0);
  });

  it('Time Attack không trừ điểm khi lật sai (chỉ Classic mới trừ)', () => {
    const g = makeGame({ mode: 'time', timeLimit: 70 });
    matchPair(g, 0);
    missPair(g, 1, 2);
    expect(g.players[0]!.score).toBe(100);
  });
});

describe('Survival (SP-04)', () => {
  it('mỗi lượt sai mất 1 mạng, hết mạng là thua', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    missPair(g, 0, 1);
    expect(g.players[0]!.lives).toBe(2);
    missPair(g, 0, 2);
    expect(g.players[0]!.lives).toBe(1);
    missPair(g, 0, 3);
    expect(g.players[0]!.lives).toBe(0);
    expect(g.status).toBe('lost');
    expect(g.summary()!.reason).toBe('no-lives');
  });

  it('ghép đúng không mất mạng', () => {
    const g = makeGame({ mode: 'survival', lives: 5 });
    clearBoard(g);
    expect(g.players[0]!.lives).toBe(5);
    expect(g.status).toBe('won');
  });
});

describe('Peek (SP-05)', () => {
  it('mở toàn bàn rồi úp lại, đồng hồ chỉ chạy sau khi úp', () => {
    const g = makeGame({ mode: 'peek', peekMs: 4000, timeLimit: 60 });
    g.start(0);
    expect(g.status).toBe('peeking');
    expect(g.revealingAll).toBe(true);
    expect(g.flip(0, 1000)).toEqual([]);           // chưa được lật khi đang hé mở
    const evs = g.tick(4001);
    expect(evs.some((e) => e.type === 'peek-end')).toBe(true);
    expect(g.status).toBe('playing');
    expect(g.revealingAll).toBe(false);
    expect(g.elapsed(4001)).toBeCloseTo(0, 1);     // thời gian tính từ lúc úp lại
  });
});

describe('giới hạn lượt lật (Campaign)', () => {
  it('hết lượt mà chưa xong bàn là thua', () => {
    const g = makeGame({ moveLimit: 2 });
    missPair(g, 0, 1);
    missPair(g, 0, 2);
    expect(g.status).toBe('lost');
    expect(g.summary()!.reason).toBe('no-moves');
  });

  it('dùng đúng lượt cuối để hoàn thành bàn thì vẫn thắng', () => {
    const g = makeGame({ cols: 2, rows: 1, moveLimit: 1 });   // 1 cặp duy nhất
    matchPair(g, 0);
    expect(g.status).toBe('won');
  });
});

describe('thẻ xáo trộn', () => {
  it('sau N lượt sai thì các thẻ chưa mở đổi chỗ', () => {
    const g = makeGame({ shuffleAfterMisses: 2 });
    matchPair(g, 0);
    const before = g.cards.map((c) => c.symbol);
    missPair(g, 1, 2);
    expect(g.cards.map((c) => c.symbol)).toEqual(before);   // chưa đủ 2 lượt sai
    missPair(g, 1, 3);
    const after = g.cards.map((c) => c.symbol);
    expect(after).not.toEqual(before);
    // Cặp đã ghép không bị dịch chuyển
    for (const i of pairSlots(g)[0]!) expect(after[i]).toBe(before[i]);
  });
});
