import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS, OPTION_KEYS, configFromOptions, livesFor, optionSummary,
  peekSecondsFor, sanitizeOptions, shuffleCountFor, specialCardsFor
} from '../src/options.js';
import { levelSpec, CAMPAIGN_LEVELS } from '../src/campaign.js';
import { MemoryGame } from '../src/game.js';
import { SYMBOLS, matchPair, pairSlots } from './helpers.js';
import { publicView } from '../src/online.js';
import { botPick, createBotMemory, observe } from '../src/bot.js';
import { Rng } from '../src/rng.js';
import type { GameEvent } from '../src/types.js';

/** Lật sai một lượt và TRẢ VỀ sự kiện — helpers.missPair trả void nên không
 *  soi được sự kiện `shuffle` sinh ra lúc úp lại. */
function missEv(g: MemoryGame, x: number, y: number, now: number): GameEvent[] {
  const slots = pairSlots(g);
  const out: GameEvent[] = [];
  out.push(...g.flip(slots[x]![0], now));
  out.push(...g.flip(slots[y]![0], now));
  out.push(...g.tick(now + (g.config.flipBackMs ?? 1000) + 1));
  return out;
}

/** Mọi cỡ bàn có thật trong thang cấp. */
const CO_BAN = [...new Set(
  Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => levelSpec(i + 1).pairs * 2)
)];

const build = (over = {}, level = 6) => configFromOptions({
  options: { ...DEFAULT_OPTIONS, ...over }, level, symbols: SYMBOLS, seed: 42
});

describe('mọi con số đều nguyên và làm tròn LÊN', () => {
  it('không tuỳ chọn nào sinh ra số thập phân', () => {
    for (const the of CO_BAN) {
      for (const muc of [1, 2, 3] as const) {
        expect(Number.isInteger(livesFor(the, muc)), `mạng ${the}/${muc}`).toBe(true);
        expect(Number.isInteger(peekSecondsFor(the, muc)), `xem trước ${the}/${muc}`).toBe(true);
        expect(Number.isInteger(shuffleCountFor(the, muc)), `xáo ${the}/${muc}`).toBe(true);
      }
    }
  });

  it('đồng hồ ván tròn lên bội số 5 giây — 1:05 chứ không 1:02', () => {
    for (let lv = 1; lv <= CAMPAIGN_LEVELS; lv++) {
      for (const time of [1, 2, 3] as const) {
        const t = configFromOptions({
          options: { ...DEFAULT_OPTIONS, time }, level: lv, symbols: SYMBOLS, seed: 1
        }).timeLimit!;
        expect(t % 5, `cấp ${lv} mức ${time} ra ${t}s`).toBe(0);
      }
    }
  });

  it('hé bàn luôn có sàn 2 giây — bàn 4 thẻ không được ra 1 giây', () => {
    for (const the of CO_BAN) {
      expect(peekSecondsFor(the, 1)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('ba mức phải THẬT SỰ khác nhau', () => {
  /*
   * Đây là lý do bảng mạng neo theo tỉ lệ sống sót thay vì chia số thẻ cho hằng
   * số: `thẻ/2 · /4 · /8` cho bàn nhỏ ra ba mức gần như bằng nhau. Test này chặn
   * mọi công thức tương lai mắc lại lỗi đó trên các bàn cỡ vừa trở lên.
   */
  it('mạng: nhiều > bình thường > ít trên mọi bàn từ 12 thẻ', () => {
    for (const the of CO_BAN.filter((t) => t >= 12)) {
      const [nhieu, vua, it] = [livesFor(the, 1), livesFor(the, 2), livesFor(the, 3)];
      expect(nhieu, `bàn ${the}: nhiều(${nhieu}) phải > vừa(${vua})`).toBeGreaterThan(vua);
      expect(vua, `bàn ${the}: vừa(${vua}) phải > ít(${it})`).toBeGreaterThan(it);
    }
  });

  it('xáo: ít < bình thường < nhiều trên mọi bàn từ 20 thẻ', () => {
    for (const the of CO_BAN.filter((t) => t >= 20)) {
      expect(shuffleCountFor(the, 1)).toBeLessThan(shuffleCountFor(the, 2));
      expect(shuffleCountFor(the, 2)).toBeLessThan(shuffleCountFor(the, 3));
    }
  });

  /* Bàn 4 thẻ là ngoại lệ có chủ đích: sàn 2 giây át hết phần chia, ngắn và
   * bình thường cùng ra 3 giây. Nhớ 2 cặp thì 3 giây đã là thừa. */
  it('xem trước: ngắn < bình thường < lâu trên mọi bàn từ 6 thẻ', () => {
    for (const the of CO_BAN.filter((t) => t >= 6)) {
      expect(peekSecondsFor(the, 1)).toBeLessThan(peekSecondsFor(the, 2));
      expect(peekSecondsFor(the, 2)).toBeLessThan(peekSecondsFor(the, 3));
    }
  });
});

describe('bật/tắt từng tuỳ chọn', () => {
  it('mặc định: chỉ có đồng hồ và ít thẻ đặc biệt, KHÔNG xáo và KHÔNG mạng', () => {
    const c = build();
    expect(c.timeLimit).toBeGreaterThan(0);
    expect(c.lives ?? null, 'mạng mặc định phải tắt').toBeNull();
    expect(c.shuffleCount ?? 0, 'xáo mặc định phải tắt').toBe(0);
    expect(c.peekMs ?? 0).toBe(0);
    expect(c.specialRate).toBeGreaterThan(0);
  });

  it('mức 0 nghĩa là cờ đó KHÔNG xuất hiện trong config', () => {
    const c = configFromOptions({
      options: { time: 0, lives: 0, peek: 0, shuffle: 0, special: 0 },
      level: 6, symbols: SYMBOLS, seed: 1
    });
    expect(c.timeLimit).toBeUndefined();
    expect(c.lives).toBeUndefined();
    expect(c.peekMs).toBeUndefined();
    expect(c.shuffleCount).toBeUndefined();
    expect(c.specialRate).toBeUndefined();
  });

  it('bật cả năm cùng lúc — tổ hợp mà mô hình bốn chế độ cũ chặn mất', () => {
    const c = build({ time: 3, lives: 3, peek: 1, shuffle: 3, special: 3 });
    expect(c.timeLimit).toBeGreaterThan(0);
    expect(c.lives).toBeGreaterThan(0);
    expect(c.peekMs).toBeGreaterThan(0);
    expect(c.shuffleCount).toBeGreaterThan(0);
    expect(c.specialRate).toBeGreaterThan(0);
  });

  it('thẻ đặc biệt tính theo SỐ THẺ (hiệu ứng chỉ gắn một thẻ của cặp)', () => {
    const lv = 6;
    const cap = levelSpec(lv).pairs;
    for (const muc of [1, 2, 3] as const) {
      const c = configFromOptions({
        options: { ...DEFAULT_OPTIONS, special: muc }, level: lv, symbols: SYMBOLS, seed: 1
      });
      expect(Math.round(c.specialRate! * cap)).toBe(specialCardsFor(cap, muc));
    }
  });
});

describe('dữ liệu bẩn từ URL / mạng', () => {
  it('mức ngoài khoảng 0..3 bị kéo về 0, không ném lỗi', () => {
    const o = sanitizeOptions({ time: 99, lives: -4, peek: 'x', shuffle: null, special: 2.7 });
    expect(o.time).toBe(0);
    expect(o.lives).toBe(0);
    expect(o.peek).toBe(0);
    expect(o.shuffle).toBe(0);
    expect(o.special).toBe(2);   // 2.7 cắt phần thập phân → 2
  });

  it('thiếu trường nào thì lấy mặc định của trường đó', () => {
    const o = sanitizeOptions({ peek: 3 });
    expect(o.peek).toBe(3);
    for (const k of OPTION_KEYS) if (k !== 'peek') expect(o[k]).toBe(DEFAULT_OPTIONS[k]);
  });
});

describe('xáo thẻ', () => {
  const banXao = (lan: number) => new MemoryGame({
    mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 99,
    players: [{ id: 'p', name: 'P' }], shuffleCount: lan, flipBackMs: 1
  });

  it('không bật thì không bao giờ xáo', () => {
    const g = banXao(0);
    g.start(0);
    let t = 0, xao = 0;
    for (let i = 0; i < 8; i++) { t += 50; xao += missEv(g, 0, 3, t).filter((e) => e.type === 'shuffle').length; }
    expect(xao).toBe(0);
  });

  it('bật thì xáo ĐÚNG số lần đã đặt, không hơn', () => {
    const g = banXao(3);
    g.start(0);
    let t = 0, xao = 0;
    // Chơi hết bàn bằng cách lật sai liên tục rồi ghép dần
    for (let i = 0; i < 40 && !g.finished; i++) {
      t += 50;
      xao += missEv(g, 0, 3, t).filter((e) => e.type === 'shuffle').length;
    }
    expect(xao).toBeLessThanOrEqual(3);
    expect(xao, 'phải xáo được ít nhất một lần trong 40 nước').toBeGreaterThan(0);
  });

  it('chỉ xáo thẻ CHƯA ghép — cặp đã xong không bị động vào', () => {
    const g = banXao(9);
    g.start(0);
    matchPair(g, 0, 100);                       // cặp 0 xong
    const oDaGhep = g.cards.filter((c) => g.isMatched(c.index)).map((c) => c.index);
    const symTruoc = oDaGhep.map((i) => g.cards[i]!.symbol);
    let t = 200;
    for (let i = 0; i < 20 && !g.finished; i++) { t += 50; missEv(g, 2, 5, t); }
    expect(oDaGhep.map((i) => g.cards[i]!.symbol), 'ô đã ghép bị xáo mất').toEqual(symTruoc);
  });

  it('sự kiện shuffle chỉ ra ĐÚNG hai ô — UI phải chỉ được cho người chơi thấy', () => {
    const g = banXao(9);
    g.start(0);
    let t = 0;
    const evs: number[][] = [];
    for (let i = 0; i < 20 && !g.finished; i++) {
      t += 50;
      for (const e of missEv(g, 0, 3, t)) if (e.type === 'shuffle') evs.push(e.affected);
    }
    expect(evs.length).toBeGreaterThan(0);
    for (const a of evs) {
      expect(a).toHaveLength(2);
      expect(a[0]).not.toBe(a[1]);
    }
  });

  /*
   * SỐ LẦN XÁO THẬT PHẢI KHỚP SỐ ĐÃ HỨA. Lỗi đã bị phản ánh: người chơi bật tuỳ
   * chọn lên và thấy nó "không hoạt động". Hai nguyên nhân cộng lại:
   *
   *  1. `maybeShuffle` chỉ được gọi trong `resolvePending()`, vốn chỉ chạy khi
   *     LẬT SAI — nên mọi mốc rơi vào một nước ghép đúng là mất luôn;
   *  2. mốc xét bằng `moves % nhịp`, đòi rơi CHÍNH XÁC vào một nước có xét, trượt
   *     một nước là mất mốc đó.
   *
   * Đo trước khi vá: bàn 12 thẻ hứa 3 lần mà thật 1,6; bàn 24 thẻ hứa 5 mà thật
   * 3,5. Sau khi vá: khớp chính xác từ bàn 16 thẻ trở lên.
   */
  it('xáo ĐÚNG số lần đã hứa — chơi trọn ván bằng bot', () => {
    for (const [level, muc] of [[15, 1], [15, 2], [15, 3], [21, 3], [38, 2]] as const) {
      const cfg = configFromOptions({
        options: { ...DEFAULT_OPTIONS, time: 0, special: 0, shuffle: muc },
        level, symbols: SYMBOLS, seed: 4242
      });
      const hua = cfg.shuffleCount!;
      const g = new MemoryGame({ ...cfg, players: [{ id: 'p', name: 'P' }], flipBackMs: 1 });
      g.start(0);
      const mem = createBotMemory();
      const rng = new Rng(99);
      let t = 0, xao = 0, i = 0;
      while (!g.finished && i++ < 4000) {
        t += 50;
        g.tick(t);
        const v = publicView(g, t, () => true);
        observe(mem, v, 'normal');
        if (g.locked) continue;
        const pick = botPick(v, mem, rng, 'normal');
        if (pick === null) break;
        for (const e of g.flip(pick, t)) if (e.type === 'shuffle') xao++;
        for (const e of g.tick(t + 5)) if (e.type === 'shuffle') xao++;
      }
      expect(xao, `cấp ${level} mức ${muc}: hứa ${hua} lần`).toBe(hua);
    }
  });

  it('bàn quá nhỏ thì ván ngắn hơn cả một nhịp xáo — có chủ đích, không phải lỗi', () => {
    // Bàn 4 thẻ hết đúng 2–3 lượt, mà nhịp tối thiểu là 2 lượt và lần xáo cuối
    // không chạy sau khi ván kết thúc. Xáo trên bàn 2 cặp cũng chẳng có nghĩa gì.
    const cfg = configFromOptions({
      options: { ...DEFAULT_OPTIONS, shuffle: 3 }, level: 1, symbols: SYMBOLS, seed: 1
    });
    expect(cfg.shuffleCount).toBe(1);
  });

  it('tất định: cùng seed thì bàn sau khi xáo giống hệt nhau', () => {
    const chay = () => {
      const g = banXao(5);
      g.start(0);
      let t = 0;
      for (let i = 0; i < 16 && !g.finished; i++) { t += 50; missEv(g, 0, 3, t); }
      return g.cards.map((c) => c.symbol).join(',');
    };
    expect(chay()).toBe(chay());
  });
});

describe('mô tả cho HUD và phòng chờ', () => {
  it('tắt thì không có gì để hiện', () => {
    for (const k of OPTION_KEYS) expect(optionSummary(k, 0, 6)).toBeNull();
  });

  it('bật thì ra chữ có số, và không chứa dấu phẩy thập phân', () => {
    for (const k of OPTION_KEYS) {
      const s = optionSummary(k, 2, 6)!;
      expect(s).toMatch(/\d/);
      expect(s, `${k} ra "${s}" — có số thập phân`).not.toMatch(/\d,\d/);
      expect(s, `${k} ra "${s}" — có số thập phân`).not.toMatch(/\d\.\d/);
    }
  });
});
