import { describe, expect, it } from 'vitest';
import { BOT_SPECS, botPick, botRng, createBotMemory, observe } from '../src/bot.js';
import type { BotLevel } from '../src/bot.js';
import { MemoryGame } from '../src/game.js';
import { publicView } from '../src/online.js';
import { Rng } from '../src/rng.js';
import type { GameView } from '../src/online.js';

const SYMBOLS = Array.from({ length: 30 }, (_, i) => `s${i}`);

/** View dựng tay: 6 ô, chỉ định trạng thái từng ô. */
function view(cards: { state: 'down' | 'up' | 'matched'; symbol?: string }[]): GameView {
  return {
    cols: 3, rows: 2,
    cards: cards.map((c, index) => ({ index, ...c })),
    players: [], currentId: 'bot', moves: 0, matchedPairs: 0, totalPairs: 3,
    status: 'playing', timeLeft: null, turnTimeLeft: null, elapsed: 0,
    summary: null, back: 'stars'
  };
}

describe('bot: không thể gian lận', () => {
  it('hai bàn thẻ KHÁC NHAU mà view giống nhau thì bot chọn giống nhau', () => {
    // Nếu bot có đường nào đọc được thẻ úp, hai bàn khác nhau sẽ cho hai lựa
    // chọn khác nhau. Giống nhau = nó chỉ đọc view.
    const a = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 11 });
    const b = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 999 });
    a.start(0); b.start(0);
    const va = publicView(a, 0, () => true);
    const vb = publicView(b, 0, () => true);
    // Hai view phải thật sự giống nhau (mọi thẻ đều úp, không symbol)
    expect(JSON.stringify(va.cards)).toBe(JSON.stringify(vb.cards));
    expect(botPick(va, createBotMemory(), botRng(7), 'hard'))
      .toBe(botPick(vb, createBotMemory(), botRng(7), 'hard'));
  });

  it('view của thẻ úp không hề mang symbol — nguồn gốc của bảo đảm trên', () => {
    const g = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 5 });
    g.start(0);
    for (const c of publicView(g, 0, () => true).cards) {
      if (c.state === 'down') expect(c.symbol).toBeUndefined();
    }
  });
});

describe('bot: chiến thuật', () => {
  it('đang mở dở một lá thì lật lá cùng biểu tượng đã nhớ', () => {
    const v = view([
      { state: 'up', symbol: 'A' }, { state: 'down' },
      { state: 'down' }, { state: 'down' }, { state: 'down' }, { state: 'down' }
    ]);
    const mem = createBotMemory();
    mem.set(4, 'A');            // đã thấy lá A ở ô 4
    expect(botPick(v, mem, botRng(1), 'hard')).toBe(4);
  });

  it('đầu lượt, ký ức có sẵn một cặp thì lật cặp đó', () => {
    const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
    const mem = createBotMemory();
    mem.set(1, 'B'); mem.set(5, 'B');
    const pick = botPick(v, mem, botRng(1), 'hard');
    expect([1, 5]).toContain(pick);
  });

  it('không nhớ gì thì lật lá CHƯA TỪNG THẤY, không lật lại lá cũ vô ích', () => {
    const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
    const mem = createBotMemory();
    mem.set(0, 'X'); mem.set(1, 'Y');   // hai lá đã thấy, không thành cặp
    for (let seed = 1; seed < 30; seed++) {
      expect([0, 1]).not.toContain(botPick(v, mem, botRng(seed), 'hard'));
    }
  });

  it('không bao giờ chọn ô đã ghép hay ô đang mở', () => {
    const v = view([
      { state: 'matched', symbol: 'A' }, { state: 'matched', symbol: 'A' },
      { state: 'up', symbol: 'B' }, { state: 'down' }, { state: 'down' }, { state: 'down' }
    ]);
    for (let seed = 1; seed < 40; seed++) {
      const pick = botPick(v, createBotMemory(), botRng(seed), 'hard');
      expect([3, 4, 5]).toContain(pick);
    }
  });

  it('cùng seed và cùng view thì luôn chọn y hệt (tất định)', () => {
    const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
    const a = botPick(v, createBotMemory(), botRng(42), 'normal');
    const b = botPick(v, createBotMemory(), botRng(42), 'normal');
    expect(a).toBe(b);
  });
});

describe('bot: ký ức theo độ khó', () => {
  it('mức dễ quên lá cũ khi vượt hạn, mức khó nhớ hết', () => {
    const mk = (level: BotLevel): number => {
      const mem = createBotMemory();
      // Lộ 6 lá lần lượt, mỗi lần một lá
      for (let i = 0; i < 6; i++) {
        const cards = Array.from({ length: 6 }, (_, j) => (
          j === i ? { state: 'up' as const, symbol: `s${j}` } : { state: 'down' as const }
        ));
        observe(mem, view(cards), level);
      }
      return mem.size;
    };
    expect(mk('easy')).toBe(BOT_SPECS.easy.memory);
    expect(mk('normal')).toBe(6);       // hạn 8, thấy 6 nên nhớ hết
    expect(mk('hard')).toBe(6);
  });

  it('thẻ đã ghép bị xoá khỏi ký ức — nó chiếm chỗ mà không dùng được nữa', () => {
    const mem = createBotMemory();
    observe(mem, view([{ state: 'up', symbol: 'A' }, { state: 'down' }, { state: 'down' },
      { state: 'down' }, { state: 'down' }, { state: 'down' }]), 'hard');
    expect(mem.has(0)).toBe(true);
    observe(mem, view([{ state: 'matched', symbol: 'A' }, { state: 'matched', symbol: 'A' },
      { state: 'down' }, { state: 'down' }, { state: 'down' }, { state: 'down' }]), 'hard');
    expect(mem.has(0)).toBe(false);
  });
});

describe('bot: độ khó có thật sự khác nhau', () => {
  /**
   * Cho hai bot đánh nhau trọn ván, trả về số cặp mỗi bên ghép được.
   *
   * PHẢI observe NGAY SAU mỗi lần lật, trước khi tick. Lần đầu tôi viết harness
   * này theo thứ tự tick-rồi-observe, và thế là bot nhớ được 0 lá: tick đã úp
   * hai thẻ lại nên view không còn symbol nào. Ký ức thành vô nghĩa, ba mức độ
   * khó chơi y như nhau, và chênh lệch đo được chỉ là nhiễu. Client thật cũng
   * phải observe mỗi lần view đổi, kể cả view ngay sau lá thứ hai.
   */
  function duel(levelA: BotLevel, levelB: BotLevel, seed: number): [number, number] {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed,
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    });
    g.start(0);
    const mem = { a: createBotMemory(), b: createBotMemory() };
    const rng = { a: botRng(seed), b: botRng(seed + 1) };
    const level = { a: levelA, b: levelB };
    const look = (now: number): GameView => {
      const v = publicView(g, now, () => true);
      observe(mem.a, v, level.a);
      observe(mem.b, v, level.b);
      return v;
    };
    let now = 0;
    for (let step = 0; step < 600 && !g.finished; step++) {
      const v = look(now);
      // Bàn đang KHOÁ (hai thẻ đã mở, chờ úp lại): không hỏi bot nước nào, vì
      // engine bỏ qua nước thứ ba. Bỏ bước này thì bot mất lượt liên tục, cả hai
      // bên thành chơi ngẫu nhiên và ký ức không còn tác dụng — đúng cái đã che
      // mất khác biệt giữa các mức độ khó trong lần đo đầu.
      if (v.cards.filter((c) => c.state === 'up').length >= 2) {
        now += 1200;
        g.tick(now);
        continue;
      }
      const pick = botPick(v, mem[g.current.id as 'a' | 'b'], rng[g.current.id as 'a' | 'b'],
        level[g.current.id as 'a' | 'b']);
      if (pick === null) break;
      g.flip(pick, now);
      look(now);              // nhìn NGAY sau khi lật, lúc symbol còn hiện
      now += 60;
      g.tick(now);
    }
    const pa = g.players.find((p) => p.id === 'a')!.pairs;
    const pb = g.players.find((p) => p.id === 'b')!.pairs;
    return [pa, pb];
  }

  it('bot khó ghép được nhiều cặp hơn bot dễ trên nhiều ván', () => {
    let hard = 0, easy = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const [h, e] = duel('hard', 'easy', seed * 37);
      hard += h; easy += e;
    }
    // Đòi hơn HẲN, không phải hơn sát sao: sát sao thì chỉ là nhiễu ngẫu nhiên,
    // và đúng cái đó đã che mất lỗi "bot nhớ 0 lá" trong lần viết đầu.
    expect(hard).toBeGreaterThan(easy * 1.3);
  });

  it('ván bot đấu bot luôn kết thúc, không treo', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const [a, b] = duel('normal', 'normal', seed * 91);
      expect(a + b).toBe(8);          // 4×4 = 8 cặp, ghép hết
    }
  });
});
