import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { Rng } from '../src/rng.js';
import { bacTriNho, chiSoTriNho } from '../src/scoring.js';

/*
 * MÔ PHỎNG CHỈ SỐ TRÍ NHỚ (25.11.2026) — căn cứ của `DIEM_CHANG` và việc trừ ăn may ở scoring.ts.
 * Người chơi giả thấy lá nào cũng ghi, rồi quên dần theo NỬA ĐỜI `h` (tính bằng lượt), chơi một mình `VAN` ván.
 * Test canh ba điều chủ dự án cần: nhớ tốt hơn thì điểm cao hơn; cùng sức nhớ thì bàn 24–88 thẻ ra cùng điểm;
 * năm bậc đều có người rơi vào.
 */
const SYM = Array.from({ length: 50 }, (_, i) => `s${i}`);

/** Người chơi giả: thấy lá nào cũng ghi, mỗi nước quên dần theo nửa đời `h`. Chơi MỘT MÌNH. */
function van(h: number, seed: number, cols: number, rows: number): { nho: number[]; quen: number[]; may: number[] } {
  const g = new MemoryGame({ mode: 'classic', cols, rows, symbols: SYM, seed });
  g.start(0);
  const giu = 0.5 ** (1 / h);
  const mem = new Map<number, { sym: string; at: number }>();
  const r = new Rng(seed ^ 0x51ed);
  let t = 0, guard = 0;
  while (!g.finished && guard++ < 20000) {
    t += 3000; g.tick(t);
    for (const c of g.cards) {
      if (g.isMatched(c.index)) mem.delete(c.index);
      else if (g.isFaceUp(c.index)) mem.set(c.index, { sym: c.symbol, at: g.moves });
    }
    if (g.locked) continue;
    const down = g.cards.filter((c) => !c.blank && !g.isMatched(c.index) && !g.isFaceUp(c.index)).map((c) => c.index);
    if (!down.length) break;
    const nhoRa = new Map<number, string>();
    for (const [i, v] of mem) if (down.includes(i) && r.next() < giu ** Math.max(0, g.moves - v.at)) nhoRa.set(i, v.sym);
    const mo = g.cards.find((c) => g.isFaceUp(c.index) && !g.isMatched(c.index));
    let pick: number | null = null;
    if (mo) { for (const [i, s] of nhoRa) if (s === mo.symbol) { pick = i; break; } }
    else {
      const theo = new Map<string, number[]>();
      for (const [i, s] of nhoRa) theo.set(s, [...(theo.get(s) ?? []), i]);
      for (const l of theo.values()) if (l.length >= 2) { pick = l[0]!; break; }
    }
    if (pick === null) { const moi = down.filter((i) => !mem.has(i)); pick = (moi.length ? r.sample(moi, 1) : r.sample(down, 1))[0]!; }
    g.flip(pick, t);
    // Ghi NGAY lá vừa lật: nước lật sai úp lại ở lần tick kế, không ghi lúc này là không bao giờ thấy lá thứ hai
    for (const c of g.cards) if (!g.isMatched(c.index) && g.isFaceUp(c.index)) mem.set(c.index, { sym: c.symbol, at: g.moves });
  }
  const p = g.players[0]!;
  const r5 = (x?: number[]): number[] => [0, 1, 2, 3, 4].map((i) => x?.[i] ?? 0);
  return { nho: r5(p.nhoTheo), quen: r5(p.quenTheo), may: r5(p.mayTheo) };
}

/** Điểm của một "tuần" `soVan` ván cùng cỡ bàn. */
function tuan(h: number, cols: number, rows: number, hat: number, soVan = 20): number {
  const nho = [0, 0, 0, 0, 0], quen = [0, 0, 0, 0, 0], may = [0, 0, 0, 0, 0];
  for (let v = 0; v < soVan; v++) {
    const k = van(h, hat + 31 * v + 1009 * h + cols * 7 + rows, cols, rows);
    k.nho.forEach((x, i) => { nho[i]! += x; }); k.quen.forEach((x, i) => { quen[i]! += x; }); k.may.forEach((x, i) => { may[i]! += x; });
  }
  return chiSoTriNho(nho, quen, may).diem ?? 0;
}
const tb = (h: number, cols: number, rows: number, lap = 4): number =>
  Math.round(Array.from({ length: lap }, (_, l) => tuan(h, cols, rows, 7919 * (l + 1))).reduce((a, b) => a + b, 0) / lap);

describe('mô phỏng chỉ số trí nhớ', () => {
  it('nhớ tốt hơn thì điểm cao hơn; năm bậc đều có người', () => {
    const d = [1, 3, 8, 20, 999].map((h) => tb(h, 6, 6));
    for (let i = 1; i < d.length; i++) expect(d[i]!, `nửa đời tăng mà điểm không tăng: ${d.join(' · ')}`).toBeGreaterThan(d[i - 1]! + 60);
    expect(d.map(bacTriNho), d.join(' · ')).toEqual([0, 1, 2, 3, 4]);   // Đồng · Bạc · Vàng · Bạch kim · Kim cương
    expect(d[4]!).toBeGreaterThan(950);                                  // nhớ hoàn hảo ≈ 1000
  }, 120_000);

  it('cùng sức nhớ thì bàn 24 · 36 · 60 · 88 thẻ ra gần cùng điểm (đã trừ ăn may)', () => {
    for (const h of [1, 5, 20]) {
      const d = ([[4, 6], [6, 6], [6, 10], [8, 11]] as const).map(([c, r]) => tb(h, c, r));
      expect(Math.max(...d) - Math.min(...d), `h=${h}: ${d.join(' · ')}`).toBeLessThan(70);
    }
  }, 240_000);

  it('bàn 16 thẻ: nhớ hoàn hảo cũng không có chặng 16+ lượt → trần 675', () => {
    const d = tb(999, 4, 4);
    expect(d).toBeGreaterThan(600);
    expect(d).toBeLessThanOrEqual(675);
  }, 60_000);
});
