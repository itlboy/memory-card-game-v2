import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { clearBoard, makeGame, matchPair, missKnown, missPair, pairSlots } from './helpers.js';

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

  /*
   * Lật sai KHÔNG còn trừ điểm. Trước đây chỉ chế độ Cổ điển trừ 10, và đó là
   * chỗ cuối cùng trong engine đọc `config.mode`; bỏ chế độ thì bỏ luôn phạt.
   * Cái giá của lật sai giờ nằm ở chỗ khác: mất combo, mất thời gian, và mất
   * mạng nếu bàn có bật tuỳ chọn mạng.
   */
  it('lật sai KHÔNG trừ điểm, nhưng reset combo', () => {
    const g = makeGame();
    matchPair(g, 0);                 // +100, streak 1
    matchPair(g, 1);                 // +120, streak 2
    expect(g.players[0]!.score).toBe(220);
    missPair(g, 2, 3);               // điểm giữ nguyên, streak về 0
    expect(g.players[0]!.score, 'không còn phạt điểm').toBe(220);
    expect(g.players[0]!.streak).toBe(0);
    matchPair(g, 2);                 // combo khởi động lại từ x1
    expect(g.players[0]!.score).toBe(320);
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

  it('ghép đúng được cộng 2 giây vào đồng hồ chung', () => {
    const g = makeGame({ mode: 'time', timeLimit: 30 });
    g.start(0);
    const before = g.timeLeft(1000)!;
    matchPair(g, 0, 1000);
    // +2s bonus, cùng mốc thời gian nên chênh lệch đúng bằng phần thưởng
    expect(g.timeLeft(1000)! - before).toBeCloseTo(2, 3);
    // Thời gian ĐÃ CHƠI không được đổi, nếu không kỷ lục sẽ sai
    expect(g.elapsed(1000)).toBeCloseTo(1, 3);
  });

  it('hết thời gian là thua, không có thưởng thời gian', () => {
    const g = makeGame({ mode: 'time', timeLimit: 30 });
    g.start(0);
    matchPair(g, 0, 1000);
    g.tick(33_100);   // 30s + 2s vừa được cộng nhờ ghép đúng
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
  it('lật hai thẻ chưa ai từng thấy thì KHÔNG mất mạng — đó là dò bài', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    missPair(g, 0, 1);
    expect(g.players[0]!.lives).toBe(3);
    expect(g.players[0]!.misses).toBe(1);   // vẫn tính là lượt sai
  });

  it('trượt khi thẻ trùng đã lộ thì mất mạng, hết mạng là thua', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    missKnown(g, 0, 1);
    expect(g.players[0]!.lives).toBe(2);
    missKnown(g, 2, 3);
    expect(g.players[0]!.lives).toBe(1);
    missKnown(g, 4, 5);
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
    const g = makeGame({ cols: 2, rows: 2, moveLimit: 2 });   // 2 cặp, đúng 2 lượt
    matchPair(g, 0);
    matchPair(g, 1);
    expect(g.status).toBe('won');
  });
});

describe('avatar người chơi', () => {
  const two = (seed: number): MemoryGame => makeGame({
    seed, players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]
  });

  it('cùng seed cho cùng bộ avatar — F5 giữa ván không đổi mặt', () => {
    expect(two(7).players.map((p) => p.avatar)).toEqual(two(7).players.map((p) => p.avatar));
    expect(MemoryGame.restore(two(7).snapshot()).players.map((p) => p.avatar))
      .toEqual(two(7).players.map((p) => p.avatar));
  });

  it('seed khác cho bộ khác — ván mới là bộ mặt mới', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) sets.add(two(seed).players.map((p) => p.avatar).join());
    expect(sets.size).toBeGreaterThan(10);
  });

  it('trong một ván không ai trùng avatar', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = two(seed).players.map((p) => p.avatar);
      expect(new Set(a).size).toBe(a.length);
    }
  });

  it('avatar do bên ngoài đặt (online) được giữ nguyên', () => {
    const g = makeGame({ players: [{ id: 'p1', name: 'A', avatar: '🐙' }, { id: 'p2', name: 'B' }] });
    // Thứ tự đi được xáo theo seed nên phải tra theo id, không theo vị trí
    expect(g.players.find((p) => p.id === 'p1')!.avatar).toBe('🐙');
    expect(g.players.find((p) => p.id === 'p2')!.avatar).toBeTruthy();
  });
});

describe('Sinh tồn: hồi mạng khi đang nguy', () => {
  /** Ghép đúng n cặp liên tiếp cho cùng một người (chơi đơn nên không đổi lượt). */
  const matchStreak = (g: MemoryGame, n: number): void => {
    for (let i = 0; i < n; i++) matchPair(g, i, i * 100);
  };

  it('dưới 2 mạng, ghép đúng 2 lần liên tiếp thì được +1 mạng', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    missKnown(g, 0, 1);          // 3 -> 2
    missKnown(g, 2, 3);          // 2 -> 1, giờ đang nguy
    expect(g.players[0]!.lives).toBe(1);
    matchStreak(g, 2);
    expect(g.players[0]!.lives).toBe(2);
  });

  it('đủ 2 mạng trở lên thì KHÔNG hồi thêm', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    matchStreak(g, 4);           // chuỗi 4 nhưng mạng vẫn đầy
    expect(g.players[0]!.lives).toBe(3);
  });

  it('chế độ không dùng mạng thì không có gì xảy ra', () => {
    const g = makeGame({ mode: 'classic' });
    matchStreak(g, 2);
    expect(g.players[0]!.lives).toBe(Infinity);
  });

  it('phát sự kiện life-gain để UI báo cho người chơi', () => {
    const g = makeGame({ mode: 'survival', lives: 3 });
    missKnown(g, 0, 1);
    missKnown(g, 2, 3);
    const slots = pairSlots(g);
    g.flip(slots[4]![0], 0); g.flip(slots[4]![1], 0);
    const ev = g.flip(slots[5]![0], 10);
    const out = [...ev, ...g.flip(slots[5]![1], 20)];
    expect(out.some((e) => e.type === 'life-gain')).toBe(true);
  });
});
