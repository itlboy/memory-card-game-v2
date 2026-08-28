import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/deck.js';
import { Rng } from '../src/rng.js';
import { SYMBOLS } from './helpers.js';

const deck = (over = {}) =>
  buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(7), ...over });

describe('dựng bộ thẻ', () => {
  it('mỗi biểu tượng xuất hiện đúng 2 lần', () => {
    const counts = new Map<number, number>();
    for (const c of deck()) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
    expect(counts.size).toBe(8);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });

  it('index khớp vị trí trong mảng', () => {
    deck().forEach((c, i) => expect(c.index).toBe(i));
  });

  it('cùng seed cho cùng bàn thẻ, seed khác thì khác (điều kiện cho ON-06/ON-09)', () => {
    const a = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(99) });
    const b = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(99) });
    const c = buildDeck({ cols: 4, rows: 4, symbols: SYMBOLS, rng: new Rng(100) });
    expect(a.map((x) => x.symbol)).toEqual(b.map((x) => x.symbol));
    expect(a.map((x) => x.symbol)).not.toEqual(c.map((x) => x.symbol));
  });

  it('từ chối lưới dưới 2 ô và theme không đủ biểu tượng', () => {
    expect(() => deck({ cols: 1, rows: 1 })).toThrow(/không hợp lệ/);
    expect(() => deck({ symbols: ['a', 'b'] })).toThrow(/biểu tượng/);
  });

  it('bàn 2 thẻ (màn tập) dựng được', () => {
    const cards = deck({ cols: 2, rows: 1 });
    expect(cards).toHaveLength(2);
    expect(cards[0]!.symbol).toBe(cards[1]!.symbol);
  });

  it('lưới lẻ ô (3×3): ô chính giữa để trống, còn lại 4 cặp đủ đôi', () => {
    const cards = deck({ cols: 3, rows: 3 });
    expect(cards).toHaveLength(9);
    expect(cards[4]!.blank).toBe(true);           // ô giữa lưới 3×3
    const counts = new Map<number, number>();
    for (const c of cards) if (!c.blank) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
    expect(counts.size).toBe(4);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(cards.every((c, i) => c.index === i)).toBe(true);
  });

  it('lưới chẵn ô không có ô trống nào', () => {
    expect(deck().some((c) => c.blank)).toBe(false);
  });

  it('thẻ đặc biệt chỉ gắn trên 1 trong 2 thẻ của cặp', () => {
    const cards = deck({ cols: 6, rows: 6, specialRate: 0.5 });
    const perPair = new Map<number, number>();
    for (const c of cards) if (c.power) perPair.set(c.pairId, (perPair.get(c.pairId) ?? 0) + 1);
    expect(perPair.size).toBeGreaterThan(0);
    expect([...perPair.values()].every((n) => n === 1)).toBe(true);
  });

  it('specialRate = 0 thì không có thẻ đặc biệt nào', () => {
    expect(deck({ cols: 6, rows: 6, specialRate: 0 }).some((c) => c.power)).toBe(false);
  });
});

/*
 * KHÔNG CÒN LUẬT CHỐNG CẶP KỀ. Bàn xáo ngẫu nhiên hoàn toàn (quyết định của chủ
 * dự án). Bộ test này giữ lại nhưng đổi hướng: canh cho bàn ĐÚNG LÀ ngẫu nhiên —
 * ai đó lặng lẽ thêm lại vòng lọc thì số cặp kề tụt về 0 và test đỏ.
 */
describe('xếp thẻ ngẫu nhiên hoàn toàn', () => {
  /** Đếm cặp nằm kề theo hàng/cột — cài lại độc lập với engine để test có giá trị. */
  const adjacent = (cards: readonly { pairId: number }[], cols: number, rows: number): number => {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = cards[r * cols + c]!.pairId;
        if (id < 0) continue;   // ô trống
        if (c + 1 < cols && cards[r * cols + c + 1]!.pairId === id) n++;
        if (r + 1 < rows && cards[(r + 1) * cols + c]!.pairId === id) n++;
      }
    }
    return n;
  };

  // Lưới lớn cần tới 32 cặp — SYMBOLS chỉ có 24, nên dựng pool riêng cho test
  const POOL = Array.from({ length: 32 }, (_, i) => `s${i}`);

  /*
   * Cặp kề PHẢI xuất hiện — và xuất hiện thường xuyên. Ngưỡng lấy rộng tay vì
   * đây là chuyện xác suất: xáo thuần thì ~83% ván có ít nhất một cặp kề, nên
   * đòi trên 50/120 là vẫn cách xa mọi biến động seed, mà bắt ngay được bất kỳ
   * vòng lọc nào bị thêm lại (vòng lọc cho đúng 0/120).
   */
  it.each([[3, 3], [3, 4], [4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [8, 8]])(
    'lưới %ix%i: có cặp kề nhau như một bàn xáo thuần ngẫu nhiên',
    (cols, rows) => {
      let coKe = 0;
      for (let seed = 1; seed <= 120; seed++) {
        if (adjacent(buildDeck({ cols, rows, symbols: POOL, rng: new Rng(seed) }), cols, rows) > 0) coKe++;
      }
      expect(coKe, `${cols}×${rows}: ${coKe}/120 ván có cặp kề`).toBeGreaterThan(50);
    }
  );

  it('lưới 2×2: không phải ván nào cũng xếp chéo', () => {
    let diagonal = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const cards = buildDeck({ cols: 2, rows: 2, symbols: POOL, rng: new Rng(seed) });
      if (cards[0]!.pairId === cards[3]!.pairId) diagonal++;
    }
    // Vòng lọc chống-kề sẽ cho đúng 300/300; phải quanh mức ngẫu nhiên 1/3
    expect(diagonal).toBeGreaterThan(60);
    expect(diagonal).toBeLessThan(160);
  });

  it('vẫn tất định: cùng seed cho cùng bàn', () => {
    const ids = (seed: number): number[] =>
      buildDeck({ cols: 5, rows: 6, symbols: SYMBOLS, rng: new Rng(seed) }).map((c) => c.pairId);
    expect(ids(42)).toEqual(ids(42));
    expect(ids(42)).not.toEqual(ids(43));
  });
});

describe('thẻ đặc biệt: có mặt cả ở bàn nhỏ', () => {
  const build = (pairs: number, rate: number, seed = 5): ReturnType<typeof deck> => {
    const side = Math.ceil(Math.sqrt(pairs * 2));
    return deck({
      cols: side, rows: Math.ceil((pairs * 2) / side), pairs,
      specialRate: rate, allowedPowers: ['x2', 'swap'], rng: new Rng(seed)
    });
  };

  it('tỉ lệ nhỏ trên bàn nhỏ vẫn ra ÍT NHẤT một thẻ đặc biệt', () => {
    // 6 cặp × 7% = 0,42 — làm tròn xuống là 0, nên cấp đầu chiến dịch không bao
    // giờ thấy thẻ đặc biệt nào dù luật nói có
    const cards = build(6, 0.07);
    expect(cards.filter((c) => c.power).length).toBeGreaterThanOrEqual(1);
  });

  it('bàn dưới 3 cặp thì KHÔNG nhồi hiệu ứng', () => {
    expect(build(2, 0.3).filter((c) => c.power).length).toBe(0);
  });

  it('tỉ lệ 0 thì không có thẻ đặc biệt nào', () => {
    expect(build(10, 0).filter((c) => c.power).length).toBe(0);
  });

  /*
   * Thẻ Tráo đổi đã bị bỏ khỏi bộ thẻ đang phát: nó là cái duy nhất trong nhóm
   * làm hại chính người bốc được, mà việc làm khó trí nhớ đã có tuỳ chọn "Xáo
   * thẻ" lo. Trọng số ×2 và trần 2 thẻ/bàn sinh ra chỉ để bù cho sự lạc quẻ đó,
   * nên cũng đi theo. Giờ mọi loại đều bằng nhau.
   */
  it('không loại nào được ưu ái hơn loại nào', () => {
    const dem = new Map<string, number>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const c of build(12, 0.25, seed * 7)) {
        if (c.power) dem.set(c.power, (dem.get(c.power) ?? 0) + 1);
      }
    }
    const so = [...dem.values()];
    expect(so.length, 'phải gặp cả hai loại của chơi đơn').toBeGreaterThanOrEqual(2);
    // Lệch nhau quá 35% là có ai đó đang được ưu ái mà không ghi ra ở đâu
    expect(Math.max(...so) / Math.min(...so)).toBeLessThan(1.35);
  });

  /*
   * ĐỦ NĂM LOẠI và chia ĐỀU NHẤT có thể. Bốc từng cái độc lập thì bàn 4 thẻ đặc
   * biệt hoàn toàn có thể ra bốn quả bom — đúng loại xui khiến người chơi thấy
   * trò chơi bất công, và cũng là lý do bom từng bị tắt hẳn.
   */
  it('không loại nào xuất hiện quá hai lần trong một bàn', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const cards = deck({
        cols: 6, rows: 7, pairs: 21, symbols: SYMBOLS,
        specialRate: 0.9, rng: new Rng(seed * 11)
      });
      const dem = new Map<string, number>();
      for (const c of cards) if (c.power) dem.set(c.power, (dem.get(c.power) ?? 0) + 1);
      for (const [loai, n] of dem) {
        expect(n, `seed ${seed}: ${loai} xuất hiện ${n} lần`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('số lần giữa các loại chênh nhau tối đa MỘT', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const cards = deck({
        cols: 6, rows: 6, pairs: 18, symbols: SYMBOLS,
        specialRate: 0.35, rng: new Rng(seed * 7)
      });
      const dem = new Map<string, number>();
      for (const c of cards) if (c.power) dem.set(c.power, (dem.get(c.power) ?? 0) + 1);
      if (dem.size < 2) continue;
      const so = [...dem.values()];
      expect(Math.max(...so) - Math.min(...so), `seed ${seed}`).toBeLessThanOrEqual(1);
    }
  });

  it('bộ mặc định có đủ các loại đang bật, kể cả bom và tráo đổi', () => {
    const thay = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const c of deck({
        cols: 6, rows: 7, pairs: 21, symbols: SYMBOLS,
        specialRate: 0.5, rng: new Rng(seed * 13)
      })) if (c.power) thay.add(c.power);
    }
    // 'eye' (Mắt thần) tạm tắt: mở cả bàn nhiều lần thì nhìn loạn, mà nó cũng
    // đè lên đúng việc tuỳ chọn "Xem trước" đang làm có kiểm soát hơn.
    expect([...thay].sort()).toEqual(['bomb', 'freeze', 'swap', 'x2']);
  });
});

