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
    mem.set(4, { symbol: 'A', at: 0 });   // đã thấy lá A ở ô 4
    expect(botPick(v, mem, botRng(1), 'hard')).toBe(4);
  });

  it('đầu lượt, ký ức có sẵn một cặp thì lật cặp đó', () => {
    const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
    const mem = createBotMemory();
    mem.set(1, { symbol: 'B', at: 0 }); mem.set(5, { symbol: 'B', at: 0 });
    const pick = botPick(v, mem, botRng(1), 'hard');
    expect([1, 5]).toContain(pick);
  });

  it('không nhớ gì thì lật lá CHƯA TỪNG THẤY, không lật lại lá cũ vô ích', () => {
    const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
    const mem = createBotMemory();
    mem.set(0, { symbol: 'X', at: 0 }); mem.set(1, { symbol: 'Y', at: 0 });
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

describe('bot: quên dần theo thời gian', () => {
  /** Sau `age` nước, bot còn nhớ một lá bao nhiêu phần trăm (đo 2000 lần). */
  function recallRate(level: BotLevel, age: number): number {
    const mem = createBotMemory();
    mem.set(0, { symbol: 'A', at: 0 });
    mem.set(5, { symbol: 'A', at: 0 });
    let hits = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const v = view(Array.from({ length: 6 }, () => ({ state: 'down' as const })));
      v.moves = age;
      // Nhớ được cặp thì nó lật ô 0 hoặc 5; quên thì bốc lá khác
      const pick = botPick(v, mem, botRng(i * 31 + 1), level);
      if (pick === 0 || pick === 5) hits++;
    }
    return hits / N;
  }

  it('vừa thấy thì mức nào cũng nhớ', () => {
    for (const level of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      expect(recallRate(level, 0), level).toBeGreaterThan(0.7);
    }
  });

  it('càng lâu càng dễ quên', () => {
    for (const level of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      const fresh = recallRate(level, 0);
      const old = recallRate(level, 20);
      expect(old, `${level}: nhớ sau 20 nước phải kém lúc vừa thấy`).toBeLessThan(fresh);
    }
  });

  it('bot giỏi quên CHẬM hơn bot kém — ở cùng độ tuổi ký ức', () => {
    const age = 8;
    const rates = (['easy', 'normal', 'hard', 'insane'] as BotLevel[]).map((l) => recallRate(l, age));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!, `mức ${i} phải nhớ dai hơn mức ${i - 1}`).toBeGreaterThan(rates[i - 1]!);
    }
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
   * Số nước cần để một bot dọn sạch bàn MỘT MÌNH. Đây là thước đo trung thực
   * của trí nhớ; bàn 4×4 tối thiểu là 16 lượt lật.
   *
   * KHÔNG dùng đối đầu bot-với-bot để so độ khó: đo thử thì bot khó đi 1096 nước
   * còn bot dễ chỉ 514, và bot dễ lại ghi nhiều cặp hơn. Không phải bot khó dở —
   * đó là lợi thế đi sau có thật trong game trí nhớ, ai lộ hai lá mới ra thì
   * người kế tiếp dùng được ngay thông tin đó. Đối đầu đo lượt chơi, không đo
   * trí nhớ.
   */
  function flipsToClear(level: BotLevel, seed: number): number {
    const g = new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed });
    g.start(0);
    const mem = createBotMemory();
    const rng = botRng(seed);
    let now = 0;
    let flips = 0;
    for (let step = 0; step < 800 && !g.finished; step++) {
      const v = publicView(g, now, () => true);
      observe(mem, v, level);
      if (v.cards.filter((c) => c.state === 'up').length >= 2) { now += 1200; g.tick(now); continue; }
      const pick = botPick(v, mem, rng, level);
      if (pick === null) break;
      g.flip(pick, now);
      flips++;
      observe(mem, publicView(g, now, () => true), level);
      now += 60;
      g.tick(now);
    }
    return g.finished ? flips : Infinity;
  }

  const average = (level: BotLevel): number => {
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) total += flipsToClear(level, seed * 37);
    return total / 60;
  };

  it('bot giỏi dọn bàn bằng ít nước hơn — và ai cũng dọn xong', () => {
    const easy = average('easy');
    const normal = average('normal');
    const hard = average('hard');
    expect(easy).toBeLessThan(Infinity);
    // Tối thiểu lý thuyết là 16 lượt lật cho 8 cặp
    expect(hard).toBeGreaterThanOrEqual(16);
    expect(hard, 'khó phải hơn thường').toBeLessThan(normal);
    expect(normal, 'thường phải hơn dễ').toBeLessThan(easy);
  });
});

describe('bot nhớ cả thẻ ĐỐI THỦ mở', () => {
  it('người chơi lật một cặp không khớp rồi úp lại — bot vẫn biết hai lá đó', () => {
    const mem = createBotMemory();
    // Lượt của người chơi: hai lá đang lộ, bot chỉ đứng nhìn
    observe(mem, view([
      { state: 'up', symbol: 'A' }, { state: 'up', symbol: 'B' },
      { state: 'down' }, { state: 'down' }
    ]), 'hard');
    // Úp lại, tới lượt bot
    observe(mem, view([
      { state: 'down' }, { state: 'down' }, { state: 'down' }, { state: 'down' }
    ]), 'hard');
    expect([...mem.keys()].sort()).toEqual([0, 1]);
    expect(mem.get(0)?.symbol).toBe('A');
  });
});
