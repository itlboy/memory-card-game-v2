import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { publicEvents, publicView } from '../src/online.js';
import { SYMBOLS, matchPair, missPair, pairSlots } from './helpers.js';

const twoP = (over = {}) => new MemoryGame({
  mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 777, shufflePlayers: false,
  players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }], ...over
});
const allOn = () => true;

describe('snapshot / restore (DO hibernation)', () => {
  it('khôi phục giữa ván rồi chơi tiếp cho kết quả y hệt bản gốc', () => {
    const a = twoP();
    a.start(0);
    matchPair(a, 0, 100);
    missPair(a, 1, 2, 200);

    const b = MemoryGame.restore(a.snapshot());
    // Hai bản chơi tiếp cùng một chuỗi nước đi
    for (const g of [a, b]) {
      matchPair(g, 1, 3000);
      missPair(g, 2, 3, 3500);
    }
    expect(b.snapshot()).toBe(a.snapshot());
    expect(b.players.map((p) => p.score)).toEqual(a.players.map((p) => p.score));
    expect(b.current.id).toBe(a.current.id);
  });

  it('khôi phục giữ nguyên trạng thái ngẫu nhiên (thẻ xáo trộn giống nhau)', () => {
    const a = twoP({ shuffleAfterMisses: 1 });
    a.start(0);
    const b = MemoryGame.restore(a.snapshot());
    missPair(a, 0, 1, 100);   // kích hoạt xáo trộn ở cả hai bản
    missPair(b, 0, 1, 100);
    expect(b.cards.map((c) => c.symbol)).toEqual(a.cards.map((c) => c.symbol));
  });

  it('khôi phục ván có mạng (Infinity đi qua JSON an toàn)', () => {
    const a = twoP({ lives: 3 });
    missPair(a, 0, 1);
    const b = MemoryGame.restore(a.snapshot());
    expect(b.players[0]!.lives).toBe(2);
    const c = MemoryGame.restore(twoP().snapshot());
    expect(c.players[0]!.lives).toBe(Infinity);
  });

  it('khôi phục ván đã kết thúc giữ nguyên summary', () => {
    const a = twoP();
    for (let p = 0; p < a.totalPairs; p++) matchPair(a, p);
    const b = MemoryGame.restore(a.snapshot());
    expect(b.summary()).toEqual(a.summary());
    expect(b.finished).toBe(true);
  });
});

describe('forfeit (ON-07)', () => {
  it('2 người: một người bỏ cuộc thì người còn lại thắng ngay', () => {
    const g = twoP();
    matchPair(g, 0);
    const evs = g.forfeit('b', 5000);
    expect(evs.some((e) => e.type === 'end')).toBe(true);
    expect(g.summary()!.reason).toBe('forfeit');
    expect(g.summary()!.ranking[0]!.id).toBe('a');
  });

  it('3 người: người bỏ cuộc bị loại khỏi vòng lượt, ván tiếp tục', () => {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 5, shufflePlayers: false,
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]
    });
    g.forfeit('b', 0);
    expect(g.finished).toBe(false);
    missPair(g, 0, 1);            // a sai → lượt phải nhảy qua b tới c
    expect(g.current.id).toBe('c');
    missPair(g, 0, 2);
    expect(g.current.id).toBe('a');
  });

  it('đang tới lượt người bỏ cuộc thì huỷ thẻ đang mở và chuyển lượt', () => {
    const g = twoP();
    const g3 = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 5, shufflePlayers: false,
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]
    });
    g3.flip(pairSlots(g3)[0]![0], 0);       // a mở 1 thẻ rồi rớt mạng
    g3.forfeit('a', 1000);
    expect(g3.selection).toEqual([]);
    expect(g3.current.id).toBe('b');
    expect(g.finished).toBe(false);
  });

  it('forfeit hai lần hoặc sau khi ván kết thúc không có tác dụng', () => {
    const g = twoP();
    g.forfeit('b', 0);
    expect(g.forfeit('b', 1)).toEqual([]);
    expect(g.forfeit('a', 2)).toEqual([]);
  });
});

describe('view công khai (NF-04, ON-09)', () => {
  it('thẻ úp không kèm symbol lẫn power', () => {
    const g = twoP({ specialRate: 0.5 });
    g.flip(pairSlots(g)[0]![0], 0);
    const view = publicView(g, 0, allOn);
    for (const c of view.cards) {
      if (c.state === 'down') {
        expect(c.symbol).toBeUndefined();
        expect(c.power).toBeUndefined();
      } else {
        expect(c.symbol).toBeTruthy();
      }
    }
    // JSON gửi đi tuyệt đối không chứa symbol của thẻ úp
    const payload = JSON.stringify(view);
    const hidden = g.cards.filter((c) => !g.isFaceUp(c.index) && !c.blank);
    const revealed = new Set(view.cards.filter((c) => c.symbol).map((c) => c.symbol));
    for (const c of hidden) {
      if (!revealed.has(c.symbol)) expect(payload).not.toContain(c.symbol);
    }
  });

  it('thẻ đã ghép hiện symbol, đúng số cặp và lượt hiện tại', () => {
    const g = twoP();
    matchPair(g, 0);
    const view = publicView(g, 0, allOn);
    expect(view.cards.filter((c) => c.state === 'matched')).toHaveLength(2);
    expect(view.matchedPairs).toBe(1);
    expect(view.currentId).toBe('a');
    expect(view.players[0]!.score).toBe(100);
  });

  it('trạng thái kết nối đi vào view', () => {
    const g = twoP();
    const view = publicView(g, 0, (id) => id === 'a');
    expect(view.players.find((p) => p.id === 'a')!.connected).toBe(true);
    expect(view.players.find((p) => p.id === 'b')!.connected).toBe(false);
  });

  it('sự kiện flip phát cho client được gắn symbol của thẻ vừa lật', () => {
    const g = twoP();
    const slot = pairSlots(g)[0]![0];
    const evs = g.flip(slot, 0);
    const pub = publicEvents(g, evs);
    const flip = pub.find((e) => e.type === 'flip')!;
    expect('symbol' in flip && flip.symbol).toBe(g.cards[slot]!.symbol);
  });
});
