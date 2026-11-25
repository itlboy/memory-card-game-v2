import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { DIEM_CHANG, LAN_MO_CHANG, MOC_BAC_TRI_NHO, bacTriNho, chiSoTriNho, coHoiNho, nhomTuoi } from '../src/scoring.js';
import { makeGame, pairSlots } from './helpers.js';

/**
 * ĐIỂM TRÍ NHỚ (23.11.2026): chấm trên lượt của CHÍNH MÌNH — lá đôi đã từng lộ mà ghép
 * trúng = nhớ, ghép trật = quên; ghép trúng do may không tính. Engine giữ số đếm thô theo
 * độ lâu, công thức ở scoring.ts.
 */
describe('điểm trí nhớ', () => {
  const ve = (g: MemoryGame, t: number) => g.tick(t + 2000);
  const sai = (g: MemoryGame, a: number, b: number, t: number) => { g.flip(a, t); g.flip(b, t + 1); ve(g, t + 1); };

  it('nhóm độ lâu: 1 · 2–3 · 4–7 · 8–15 · 16+', () => {
    expect([1, 2, 3, 4, 7, 8, 15, 16, 99].map(nhomTuoi)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(nhomTuoi(0)).toBe(0);
  });

  it('ghép trúng hai lá chưa từng lộ là MAY: không tính nhớ', () => {
    const g = makeGame(); g.start(0);
    const s = pairSlots(g);
    g.flip(s[0]![0], 10); g.flip(s[0]![1], 20);
    expect(g.players[0]!.nhoTheo).toBeUndefined();
    expect(g.players[0]!.tamNho).toBeUndefined();
  });

  it('lá đôi đã lộ rồi ghép trúng: một lần nhớ, đúng nhóm độ lâu', () => {
    const g = makeGame(); g.start(0);
    const s = pairSlots(g);
    sai(g, s[0]![0], s[1]![0], 10);            // nước 1: lộ A1, B1
    g.flip(s[0]![1], 5000); g.flip(s[0]![0], 5001); // nước 2: A2 rồi A1 — A1 lộ cách 1 nước
    expect(g.players[0]!.nhoTheo).toEqual([1, 0, 0, 0, 0]);
    expect(g.players[0]!.tamNho).toBe(1);
    sai(g, s[2]![0], s[3]![0], 9000);          // nước 3
    sai(g, s[4]![0], s[5]![0], 13000);         // nước 4
    g.flip(s[1]![1], 17000); g.flip(s[1]![0], 17001); // nước 5: B1 lộ từ nước 1 → cách 4 nước
    expect(g.players[0]!.nhoTheo).toEqual([1, 0, 1, 0, 0]);
    expect(g.players[0]!.tamNho).toBe(4);
  });

  it('lá đôi đã lộ mà ghép trật: một lần quên, tổng nhóm luôn bằng `quen`', () => {
    const g = makeGame(); g.start(0);
    const s = pairSlots(g);
    sai(g, s[0]![0], s[1]![0], 10);
    sai(g, s[0]![1], s[2]![0], 5000);          // A2 mà A1 đã lộ ở nước trước → quên, độ lâu 1
    const p = g.players[0]!;
    expect(p.quenTheo).toEqual([1, 0, 0, 0, 0]);
    expect(p.quenTheo!.reduce((a, b) => a + b, 0)).toBe(p.quen);
  });

  it('nhiều người: chấm riêng từng người, lá người khác lật cũng tính là đã thấy', () => {
    const g = makeGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }); g.start(0);
    const s = pairSlots(g);
    sai(g, s[0]![0], s[1]![0], 10);            // A dò, lộ A1 B1 → sang lượt B
    g.flip(s[0]![1], 5000); g.flip(s[0]![0], 5001); // B nhớ lá do A lật
    expect(g.players[1]!.nhoTheo).toEqual([1, 0, 0, 0, 0]);
    expect(g.players[0]!.nhoTheo).toBeUndefined();
  });

  it('mốc lộ lá sống qua snapshot/restore', () => {
    const g = makeGame(); g.start(0);
    const s = pairSlots(g);
    sai(g, s[0]![0], s[1]![0], 10);
    sai(g, s[2]![0], s[3]![0], 5000);
    const h = MemoryGame.restore(g.snapshot());
    h.flip(s[0]![1], 9000); h.flip(s[0]![0], 9001);  // nước 3, A1 lộ ở nước 1 → cách 2
    expect(h.players[0]!.nhoTheo).toEqual([0, 1, 0, 0, 0]);
  });

  it('ăn may: mỗi cơ hội cộng 1/số lá còn úp lúc lật lá thứ hai — cả lúc nhớ lẫn lúc quên', () => {
    const g = makeGame(); g.start(0);
    const s = pairSlots(g);
    const tong = g.cards.filter((c) => !c.blank).length;
    sai(g, s[0]![0], s[1]![0], 10);
    sai(g, s[0]![1], s[2]![0], 5000);          // QUÊN: chưa ghép cặp nào, lá thứ hai chọn trong tong − 1 lá
    expect(g.players[0]!.mayTheo![0]).toBeCloseTo(1 / (tong - 1), 10);
    g.flip(s[1]![1], 9000); g.flip(s[1]![0], 9001);  // NHỚ: B1 lộ ở nước 1, giờ là nước 3 → nhóm 2–3 lượt; vẫn tong − 1 lá
    expect(g.players[0]!.mayTheo![1]).toBeCloseTo(1 / (tong - 1), 10);
    expect(coHoiNho(g.players[0]!.nhoTheo, g.players[0]!.quenTheo)).toBe(2);
  });

  it('5 chặng: điểm 50·150·200·275·325 (tổng 1000), bậc mỗi 200 điểm', () => {
    expect([...DIEM_CHANG]).toEqual([50, 150, 200, 275, 325]);
    expect(DIEM_CHANG.reduce((a, b) => a + b, 0)).toBe(1000);
    expect([...MOC_BAC_TRI_NHO]).toEqual([0, 200, 400, 600, 800]);
    expect([0, 199, 200, 399, 400, 599, 600, 799, 800, 1000].map(bacTriNho)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('chặng chưa đủ lần gặp thì CHƯA MỞ; chưa chặng nào mở thì chưa có điểm', () => {
    expect(chiSoTriNho(undefined, undefined).diem).toBeNull();
    expect(chiSoTriNho([LAN_MO_CHANG - 1], []).diem).toBeNull();
    const k = chiSoTriNho([LAN_MO_CHANG, 4, 0, 0, 0], [0, 0, 0, 0, 0]);
    expect(k.chang.map((c) => c.mo)).toEqual([true, false, false, false, false]);
    expect(k.diem).toBe(50);
    expect(k.chang[1]).toMatchObject({ n: 4, tiLe: null, diem: 0, toiDa: 150 });
  });

  it('điểm chặng = tỉ lệ nhớ × điểm của chặng; nhớ hết cả 5 chặng = 1000', () => {
    expect(chiSoTriNho([5, 5, 5, 5, 5], undefined).diem).toBe(1000);
    const k = chiSoTriNho([10, 8, 5, 0, 0], [0, 2, 5, 5, 0]);     // 100% · 80% · 50% · 0% · chưa mở
    expect(k.chang.map((c) => c.diem)).toEqual([50, 120, 100, 0, 0]);
    expect(k.diem).toBe(270);
  });

  it('trừ ăn may: tỉ lệ = (nhớ − may) / (số lần − may), không âm, không quá 1', () => {
    // 10 lần, trúng 6, trong đó kỳ vọng 2 lần là đoán bừa → (6 − 2) / (10 − 2) = 50%
    expect(chiSoTriNho([0, 6], [0, 4], [0, 2]).chang[1]!.tiLe).toBeCloseTo(0.5, 10);
    // trúng ÍT hơn cả mức đoán bừa → 0, không âm
    expect(chiSoTriNho([0, 1], [0, 9], [0, 3]).chang[1]!.tiLe).toBe(0);
    // toàn trúng → 1 dù may bao nhiêu; may ≥ số lần (số liệu hỏng) cũng không chia cho 0
    expect(chiSoTriNho([8], [], [3]).chang[0]!.tiLe).toBe(1);
    expect(chiSoTriNho([6], [2], [99]).chang[0]!.tiLe).toBeGreaterThanOrEqual(0);
    // thiếu `may` (ván chấm bằng engine cũ) = không trừ
    expect(chiSoTriNho([0, 6], [0, 4]).chang[1]!.tiLe).toBeCloseTo(0.6, 10);
  });
});

describe('chiSoVan — chỉ số riêng của một ván', () => {
  it('dưới 4 cơ hội thì chưa chấm', async () => {
    const { chiSoVan } = await import('../src/scoring.js');
    expect(chiSoVan([2, 1, 0, 0, 0], [0, 0, 0, 0, 0])).toBeNull();
    expect(chiSoVan(undefined, undefined)).toBeNull();
  });
  it('nhớ hết = 1000 kể cả bàn nhỏ chỉ có chặng gần; quên hết = 0', async () => {
    const { chiSoVan } = await import('../src/scoring.js');
    expect(chiSoVan([3, 3, 0, 0, 0], [0, 0, 0, 0, 0])).toBe(1000);
    expect(chiSoVan([0, 0, 0, 0, 0], [3, 3, 0, 0, 0])).toBe(0);
  });
  it('nhớ xa nặng hơn nhớ gần, và ăn may bị trừ', async () => {
    const { chiSoVan } = await import('../src/scoring.js');
    const xa = chiSoVan([0, 0, 0, 0, 4], [4, 0, 0, 0, 0])!;
    const gan = chiSoVan([4, 0, 0, 0, 0], [0, 0, 0, 0, 4])!;
    expect(xa).toBeGreaterThan(gan);
    expect(chiSoVan([4, 0, 0, 0, 0], [4, 0, 0, 0, 0], [2, 0, 0, 0, 0])!).toBeLessThan(chiSoVan([4, 0, 0, 0, 0], [4, 0, 0, 0, 0])!);
  });
});
