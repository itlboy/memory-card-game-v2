/**
 * ĐO CHIẾN DỊCH "MỖI MÀN MỘT LUẬT" — công cụ đo, KHÔNG phải test thường.
 * Chạy: DO_CD=1 pnpm --filter @mm/engine exec vitest run test/do-chien-dich.test.ts
 *
 * Mô phỏng người chơi một mình (nghĩ 0,9 giây mỗi lá, FLIP_BACK_MS thật) chơi
 * từng cỡ bàn dưới từng luật, KHÔNG đồng hồ, KHÔNG mạng — để đo cái người chơi
 * CẦN: thời gian dọn bàn và số lần quên. So với bàn trơn ra hệ số; bảng `gio`,
 * `sao` trong campaign.ts là bảng của bàn trơn, nhân hệ số đó ra mốc từng luật.
 *
 * Hai mô hình: "giỏi" (ghi 97% lá thấy, nhớ bền) cho mốc 3★ (p30), "khá" (85%,
 * quên nhanh hơn) cho mốc 2★ (trung vị), thời gian cần (trung vị) và số mạng.
 */
import { describe, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { BOARD_SIZES, MAN_PHANG, allLevels, giayXemTruoc, levelConfig, soLanXao, tiLeDacBiet } from '../src/campaign.js';
import { Rng } from '../src/rng.js';
import { MATCH_TIME_BONUS_MS } from '../src/scoring.js';
import type { GameConfig, GameEvent } from '../src/types.js';

const SYMBOLS = Array.from({ length: 60 }, (_, i) => `s${i}`);
const NGHI_MS = Number(process.env.NGHI_MS ?? 900);

interface MoHinh { ten: string; keep: number; retain: number }
const GIOI: MoHinh = { ten: 'giỏi', keep: 0.97, retain: 0.99 };
const KHA: MoHinh = { ten: 'khá', keep: Number(process.env.KHA_KEEP ?? 0.85), retain: Number(process.env.KHA_RETAIN ?? 0.96) };

/** Một ván: trả về giây đã chơi và số lần quên. */
export function choi(cfg: Omit<GameConfig, 'symbols' | 'seed' | 'mode'>, seed: number, m: MoHinh, nghiMs = NGHI_MS): { giay: number; quen: number; thang: boolean } {
  const g = new MemoryGame({ mode: 'campaign', symbols: SYMBOLS, seed, ...cfg });
  const rng = new Rng(seed ^ 0x51ed);
  let t = 0;
  g.start(t);
  const nho = new Map<number, { sym: string; at: number }>();
  const xuLy = (evs: GameEvent[]): void => {
    for (const e of evs) {
      const doiCho = e.type === 'shuffle' ? e.affected
        : e.type === 'power' && e.power === 'swap' ? e.affected : null;
      if (doiCho && doiCho.length === 2) {
        // Thấy hai ô nào đổi chỗ: nửa số lần kịp đổi ký ức theo, nửa còn lại rối luôn
        const [a, b] = doiCho as [number, number];
        const ma = nho.get(a), mb = nho.get(b);
        nho.delete(a); nho.delete(b);
        if (rng.next() < 0.5) { if (ma) nho.set(b, ma); if (mb) nho.set(a, mb); }
      }
      if (e.type === 'power' && e.power === 'bomb') {
        for (const i of e.affected) nho.set(i, { sym: g.cards[i]!.symbol, at: g.moves });
      }
      if (e.type === 'power' && e.power === 'eye') {
        for (const c of g.cards) if (!c.blank && !g.isMatched(c.index) && rng.next() < m.keep * 0.5) nho.set(c.index, { sym: c.symbol, at: g.moves });
      }
    }
  };
  let guard = 0;
  let daXem = false;
  while (!g.finished && guard++ < 20000) {
    t += nghiMs;
    xuLy(g.tick(t));
    if (g.finished) break;
    // Xem trước: một cái nhìn nhanh cả bàn chỉ đọng lại vài lá — trí nhớ ngắn hạn ~7±2 thứ,
    // nên TRẦN 8 lá (người giỏi) dù bàn to cỡ nào; người khá ít hơn theo `keep`.
    if (g.status === 'peeking') {
      if (!daXem) {
        const la = rng.sample(g.cards.filter((c) => !c.blank).map((c) => c.index), Math.round(8 * m.keep));
        for (const i of la) nho.set(i, { sym: g.cards[i]!.symbol, at: 0 });
      }
      daXem = true; continue;
    }
    if (g.locked) continue;
    for (const c of g.cards) if (g.isMatched(c.index)) nho.delete(c.index);
    const up = g.cards.filter((c) => g.isFaceUp(c.index) && !g.isMatched(c.index));
    const down = g.cards.filter((c) => !c.blank && !g.isMatched(c.index) && !g.isFaceUp(c.index)).map((c) => c.index);
    if (!down.length) break;
    const recall = new Map<number, string>();
    for (const [i, v] of nho) if (down.includes(i) && rng.next() < m.retain ** Math.max(0, g.moves - v.at)) recall.set(i, v.sym);
    let pick: number | null = null;
    if (up.length === 1) { for (const [i, s] of recall) if (s === up[0]!.symbol) { pick = i; break; } }
    else {
      const theo = new Map<string, number[]>();
      for (const [i, s] of recall) theo.set(s, [...(theo.get(s) ?? []), i]);
      for (const ds of theo.values()) if (ds.length >= 2) { pick = ds[0]!; break; }
    }
    if (pick === null) {
      const moi = down.filter((i) => !nho.has(i));
      pick = rng.sample(moi.length ? moi : down, 1)[0]!;
    }
    const evs = g.flip(pick, t);
    for (const c of g.cards) if (g.isFaceUp(c.index) && !g.isMatched(c.index) && rng.next() < m.keep) nho.set(c.index, { sym: c.symbol, at: g.moves });
    xuLy(evs);
  }
  const s = g.summary();
  return { giay: g.elapsed(t), quen: g.players[0]!.quen ?? 0, thang: s?.status === 'won' };
}

const pv = (xs: number[], p: number): number => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]!; };

const N = 300;
type Luat = 'tron' | 'xao' | 'dacBiet' | 'xaoDacBiet';
function cauHinh(luat: Luat, b: (typeof BOARD_SIZES)[number], xao: number, rate: number): Omit<GameConfig, 'symbols' | 'seed' | 'mode'> {
  const c: Omit<GameConfig, 'symbols' | 'seed' | 'mode'> = { cols: b.cols, rows: b.rows, pairs: b.pairs };
  if (luat === 'xao' || luat === 'xaoDacBiet') c.shuffleCount = xao;
  if (luat === 'dacBiet' || luat === 'xaoDacBiet') c.specialRate = rate;
  return c;
}

describe.skipIf(!process.env.DO_CD)('đo Chiến dịch mỗi màn một luật', () => {
  /** Mô hình ĐÃ CHỈNH theo bảng gio/sao đo người thật (27.10.2026): nghĩ 1,25 giây/lá. */
  const NGHI_TT = 1250;
  const KHA_TT: MoHinh = { ten: 'khá', keep: 0.8, retain: 0.95 };
  const GIOI_TT: MoHinh = { ten: 'giỏi', keep: 0.95, retain: 0.985 };
  const tron5 = (x: number) => (x > 30 ? Math.ceil(x / 5) * 5 : Math.ceil(x));

  it('sinh bảng DO_MAN', () => {
    const dong: string[] = [];
    MAN_PHANG.forEach(({ bang, cacLuat }, i) => {
      const b = BOARD_SIZES[bang]!;
      const cfg: Omit<GameConfig, 'symbols' | 'seed' | 'mode'> = { cols: b.cols, rows: b.rows, pairs: b.pairs };
      if (cacLuat.includes('xao')) cfg.shuffleCount = soLanXao(b.pairs);
      if (cacLuat.includes('dacBiet')) cfg.specialRate = tiLeDacBiet(bang);
      if (cacLuat.includes('xemTruoc')) cfg.peekMs = giayXemTruoc(b.pairs) * 1000;
      const kha = Array.from({ length: 400 }, (_, k) => choi(cfg, 20000 + i * 1000 + k, KHA_TT, NGHI_TT));
      const gioi = Array.from({ length: 400 }, (_, k) => choi(cfg, 60000 + i * 1000 + k, GIOI_TT, NGHI_TT));
      const g = kha.map((r) => r.giay), q = kha.map((r) => r.quen), qg = gioi.map((r) => r.quen);
      const trum = cacLuat.length >= 2, nhanh = cacLuat.includes('nhanh');
      // Đồng hồ cộng MATCH_TIME_BONUS_MS mỗi cặp ghép — mô phỏng KHÔNG đồng hồ nên không có
      // phần cộng đó; giờ đặt = thời gian cần − phần cộng, không thì giờ thật dư cả phút.
      // Bàn tí hon (≤3 cặp): giờ hết trước khi kịp ghép mà nhận phần cộng — không trừ (đo: 48% qua)
      // Màn trơn cũng không trừ: đó là màn "thở" của mỗi cỡ, phải rộng giờ nhất (test canh)
      const thuong = b.pairs <= 3 || cacLuat.length === 0 ? 0 : (MATCH_TIME_BONUS_MS / 1000) * b.pairs;
      const gio = tron5(Math.max(b.pairs * 2, -thuong + (cacLuat.length === 0 ? pv(g, 0.99) * 1.25
        // Bàn tí hon (≤3 cặp) phương sai lớn: p75 chỉ 9 giây, nửa người chơi trượt màn 3 — p95
        : nhanh ? pv(g, b.pairs <= 3 ? 0.95 : trum ? 0.65 : 0.75)
        // Trùm có tim đã khó vì tim; trùm không tim thì đồng hồ phải gắt hơn mới ra trùm
        : trum ? pv(g, cacLuat.includes('mang') ? 0.85 : 0.75)
        : cacLuat[0] === 'xemTruoc' ? pv(g, 0.9) : pv(g, 0.95) * 1.1)));
      const tim = cacLuat.includes('mang') ? Math.max(2, pv(q, trum ? 0.8 : 0.85) + 1) : null;
      const s3 = pv(qg, 0.25), s2 = Math.max(s3 + 1, pv(q, 0.5));
      dong.push(`  [${gio}, ${tim}, ${s2}, ${s3}],   // ${String(i + 1).padStart(2)} · ${b.pairs * 2} thẻ · ${cacLuat.join('+') || 'trơn'}`);
    });
    console.log('BẢNG\n' + dong.join('\n') + '\nHẾT');
  }, 1_200_000);

  it('kiểm bảng: tỉ lệ qua màn với đồng hồ + tim thật', () => {
    for (const l of allLevels()) {
      const { mode: _m, symbols: _s, seed: _d, ...cfg } = levelConfig(l, SYMBOLS, 1);
      const kha = Array.from({ length: 300 }, (_, k) => choi(cfg, 90000 + l.id * 1000 + k, KHA_TT, NGHI_TT));
      const gioi = Array.from({ length: 300 }, (_, k) => choi(cfg, 95000 + l.id * 1000 + k, GIOI_TT, NGHI_TT));
      const tl = (rs: { thang: boolean }[]) => Math.round(100 * rs.filter((r) => r.thang).length / rs.length);
      console.log(`KIỂM ${l.id}\t${l.pairs * 2} thẻ\t${l.luat}${l.cacLuat.length > 1 ? '(' + l.cacLuat.join('+') + ')' : ''}\t${l.timeLimit}s\ttim ${l.lives ?? '-'}\tsao ${l.starMisses}\tqua: khá ${tl(kha)}% giỏi ${tl(gioi)}%`);
    }
  }, 1_200_000);

  it('bảng 60 màn + tỉ lệ thắng (người khá / giỏi, đồng hồ + mạng thật)', () => {
    for (const l of allLevels()) {
      const { mode: _m, symbols: _s, seed: _d, ...cfg } = levelConfig(l, SYMBOLS, 1);
      const kha = Array.from({ length: 200 }, (_, i) => choi(cfg, 9000 + i, KHA));
      const gioi = Array.from({ length: 200 }, (_, i) => choi(cfg, 9500 + i, GIOI));
      const tl = (rs: { thang: boolean }[]) => Math.round(100 * rs.filter((r) => r.thang).length / rs.length);
      console.log(`${l.id}\t${l.pairs * 2}\t${l.luat}\t${l.timeLimit}s\tsao ${l.starMisses}\tmạng ${l.lives}\txáo ${l.shuffleCount}\tđb ${l.specialRate.toFixed(2)}\tthắng khá ${tl(kha)}% giỏi ${tl(gioi)}%`);
    }
  }, 600_000);

  it('bảng hệ số so với bàn trơn', () => {
    const XAO = (the: number) => Math.max(1, Math.ceil(the / 5));   // shuffleCountFor(the, 3)
    const RATE = 0.2;
    console.log('thẻ | luật | giây khá p50 (×trơn) | quên khá p50/p75/p90 | quên giỏi p30');
    for (const b of BOARD_SIZES) {
      const the = b.pairs * 2;
      let goc = { giay: 1, q2: 0 };
      for (const luat of ['tron', 'xao', 'dacBiet', 'xaoDacBiet'] as Luat[]) {
        const kha = Array.from({ length: N }, (_, i) => choi(cauHinh(luat, b, XAO(the), RATE), 1000 + i, KHA));
        const gioi = Array.from({ length: N }, (_, i) => choi(cauHinh(luat, b, XAO(the), RATE), 5000 + i, GIOI));
        const giay = pv(kha.map((r) => r.giay), 0.5);
        const q = kha.map((r) => r.quen);
        if (luat === 'tron') goc = { giay, q2: pv(q, 0.5) };
        console.log(`${String(the).padStart(3)} | ${luat.padEnd(10)} | ${giay.toFixed(0).padStart(4)} (×${(giay / goc.giay).toFixed(2)}) | ${pv(q, 0.5)}/${pv(q, 0.75)}/${pv(q, 0.9)} | ${pv(gioi.map((r) => r.quen), 0.3)}`);
      }
    }
  }, 600_000);
});
