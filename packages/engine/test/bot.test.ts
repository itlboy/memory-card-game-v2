import { describe, expect, it } from 'vitest';
import { BOT_HALF_LIFE, BOT_SPECS, botPick, botRng, botThinkMs, createBotMemory, halfLifeMoves, observe, specFrom } from '../src/bot.js';
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
    status: 'playing', timeLeft: null, turnTimeLeft: null, peekLeft: null, elapsed: 0,
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

  /* Không còn "nhớ lẫn chỗ": vừa thấy là mức nào cũng dùng được cặp, không có
   * cửa nào tung ra sai. Sai thì phải do QUÊN — một trục độ khó duy nhất. */
  it('vừa thấy thì MỌI mức đều dùng được cặp', () => {
    for (const level of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      expect(recallRate(level, 0), level).toBeGreaterThan(0.94);
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

describe('nhịp nghĩ của bot', () => {
  it('mỗi nước một nhịp khác nhau, luôn nằm trong khoảng của mức', () => {
    const rng = botRng(5);
    const got = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const ms = botThinkMs('normal', rng);
      expect(ms).toBeGreaterThanOrEqual(BOT_SPECS.normal.thinkMinMs);
      expect(ms).toBeLessThanOrEqual(BOT_SPECS.normal.thinkMaxMs);
      got.add(ms);
    }
    expect(got.size, 'nhịp cố định thì nghe ra ngay là máy').toBeGreaterThan(30);
  });

  it('mọi mức nghĩ trong CÙNG một khoảng — độ khó nằm ở trí nhớ, không ở tốc độ', () => {
    // Cho bot giỏi nghĩ nhanh hơn thì ngồi đếm thời gian là đoán ra mức.
    for (const l of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      expect(BOT_SPECS[l].thinkMinMs, l).toBe(400);
      expect(BOT_SPECS[l].thinkMaxMs, l).toBe(3000);
    }
  });

  it('lá thứ hai của lượt nghĩ nhanh — đã cân nhắc ở lá đầu rồi', () => {
    const rng = botRng(11);
    for (let i = 0; i < 30; i++) {
      const ms = botThinkMs('normal', rng, { closing: true });
      expect(ms).toBeGreaterThanOrEqual(250);
      expect(ms).toBeLessThanOrEqual(800);
    }
  });

  it('cùng seed thì cùng nhịp — bot phải tất định', () => {
    const a = Array.from({ length: 10 }, (_, i) => botThinkMs('hard', botRng(9 + i * 0)));
    expect(new Set(a).size).toBe(1);   // cùng rng mới tạo → cùng số đầu tiên
  });
});

describe('nước cuối thì bot không nghĩ', () => {
  it('còn 2 lá thì bấm ngay, dưới 1 giây, mức nào cũng vậy', () => {
    for (const l of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      for (let seed = 1; seed <= 30; seed++) {
        const ms = botThinkMs(l, botRng(seed), { cardsLeft: 2 });
        expect(ms, `${l} seed ${seed}`).toBeLessThan(1000);
      }
    }
  });

  it('còn nhiều lá thì vẫn nghĩ theo khoảng của mức', () => {
    const ms = botThinkMs('easy', botRng(3), { cardsLeft: 20 });
    expect(ms).toBeGreaterThanOrEqual(BOT_SPECS.easy.thinkMinMs);
  });
});

describe('nhiễu do quá tải ký ức', () => {
  /** Tỉ lệ bot dùng được cặp đã biết, khi trong đầu có `load` lá đang úp. */
  function recallWithLoad(level: BotLevel, load: number): number {
    const mem = createBotMemory();
    // Cặp cần nhớ ở ô 0 và 1; các lá còn lại là "hàng nhiễu", biểu tượng khác nhau
    mem.set(0, { symbol: 'A', at: 0 });
    mem.set(1, { symbol: 'A', at: 0 });
    for (let i = 2; i < load; i++) mem.set(i, { symbol: `N${i}`, at: 0 });
    let hits = 0;
    const N = 3000;
    for (let s = 0; s < N; s++) {
      const v = view(Array.from({ length: Math.max(load, 4) }, () => ({ state: 'down' as const })));
      const pick = botPick(v, mem, botRng(s * 31 + 1), level);
      if (pick === 0 || pick === 1) hits++;
    }
    return hits / N;
  }

  /*
   * BỎ CƠ CHẾ QUÁ TẢI (`capacity` + `CROWD`). Nó và `mistake` cùng làm một việc
   * với `retain` — khiến bot quên — chỉ theo đường khác, mà ba thứ tương tác
   * nhau nên chỉnh một cái phải đo lại cả ba. Giờ số lá đang nhớ KHÔNG ảnh
   * hưởng khả năng nhớ; chỉ tuổi ký ức mới ảnh hưởng.
   *
   * Cái mất, ghi lại để đừng ai tưởng là lỗi: độ khó không còn tự giãn theo cỡ
   * bàn. Trước đây bot yếu tệ hẳn trên bàn lớn vì phải nhớ nhiều lá cùng lúc.
   */
  it('số lá đang nhớ KHÔNG còn ảnh hưởng khả năng nhớ', () => {
    for (const l of ['easy', 'insane'] as BotLevel[]) {
      const it_ = recallWithLoad(l, 4);
      const nhieu = recallWithLoad(l, 20);
      expect(Math.abs(it_ - nhieu), `${l}: tải không được ảnh hưởng`).toBeLessThan(0.06);
    }
  });

});

describe('quên hẳn bản ghi quá cũ', () => {
  it('bản ghi cũ hơn 3 lần nửa đời bị XOÁ, không chỉ là "không nhớ ra"', () => {
    const mem = createBotMemory();
    const down = Array.from({ length: 6 }, () => ({ state: 'down' as const }));
    // Thấy lá ở ô 0 tại nước 0
    const v0 = view([{ state: 'up', symbol: 'A' }, ...down.slice(1)]);
    v0.moves = 0;
    observe(mem, v0, 'easy');
    expect(mem.has(0)).toBe(true);

    // Hạn suy ra từ nửa đời, KHÔNG viết số cứng: đổi nửa đời là test đỏ oan
    const limit = 3 * halfLifeMoves('easy');
    const v1 = view(down);
    v1.moves = Math.floor(limit) - 1;
    observe(mem, v1, 'easy');
    expect(mem.has(0), 'chưa tới hạn thì còn giữ').toBe(true);
    const v2 = view(down);
    v2.moves = Math.ceil(limit) + 1;
    observe(mem, v2, 'easy');
    expect(mem.has(0), 'quá hạn thì xoá hẳn, không còn chiếm chỗ trong đầu').toBe(false);
  });

  it('bot giỏi giữ bản ghi lâu hơn bot kém', () => {
    const order: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];
    for (let i = 1; i < order.length; i++) {
      expect(halfLifeMoves(order[i]!)).toBeGreaterThan(halfLifeMoves(order[i - 1]!));
    }
  });

  it('nhờ xoá bản ghi cũ mà TẢI không phình vô hạn — chặn vòng xoáy quên-dồn-quên', () => {
    const mem = createBotMemory();
    // Mô phỏng 200 nước, mỗi nước thấy một lá mới trên bàn 40 lá
    for (let move = 0; move < 200; move++) {
      const cards = Array.from({ length: 40 }, (_, i) => (
        i === move % 40 ? { state: 'up' as const, symbol: `S${i}` } : { state: 'down' as const }
      ));
      const v = view(cards);
      v.moves = move;
      observe(mem, v, 'easy');
    }
    // Cửa sổ = 3 lần nửa đời, nên số bản ghi giữ lại xấp xỉ đó — không phải 40
    const win = 3 * halfLifeMoves('easy');
    expect(mem.size).toBeLessThanOrEqual(Math.ceil(win) + 2);
  });
});

describe('mỗi mức chỉ một con số', () => {
  it('retain suy ra từ nửa đời, không đặt tay', () => {
    for (const l of ['easy', 'normal', 'hard', 'insane'] as BotLevel[]) {
      const s = BOT_SPECS[l];
      expect(s.retain, `${l}`).toBeCloseTo(0.5 ** (1 / s.halfLife), 10);
      expect(s.retain).toBeCloseTo(specFrom(s.halfLife, s.name, s.avatar).retain, 10);
    }
  });

  it('nửa đời dài hơn thì nhớ dai hơn', () => {
    const bac = [3, 6, 9, 12, 20].map((h) => specFrom(h, 'x', 'x'));
    for (let i = 1; i < bac.length; i++) {
      expect(bac[i]!.retain, `nửa đời ${bac[i]!.halfLife}`).toBeGreaterThan(bac[i - 1]!.retain);
    }
  });

  it('nửa đời vô lý bị kẹp về sàn 1 nước', () => {
    expect(specFrom(0, 'x', 'x').halfLife).toBe(1);
    expect(specFrom(-5, 'x', 'x').halfLife).toBe(1);
  });

  /* Siêu đẳng cách Pro tới 8 nước là CÓ CHỦ ĐÍCH: đường tỉ lệ thắng bão hoà ở
   * quãng 12→15, đặt 15 thì hai mức cao nhất bằng nhau ở bàn nhỏ và vừa. */
  it('bốn mức đang dùng nửa đời 3 · 6 · 12 · 20', () => {
    expect([BOT_HALF_LIFE.easy, BOT_HALF_LIFE.normal, BOT_HALF_LIFE.hard, BOT_HALF_LIFE.insane])
      .toEqual([3, 6, 12, 20]);
  });
});
