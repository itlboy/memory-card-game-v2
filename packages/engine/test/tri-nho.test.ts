import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { CO_HOI_NHO_TOI_THIEU, coHoiNho, diemTriNho, nhomTuoi, tiLeNho, tranBan } from '../src/scoring.js';
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

  it('tỉ lệ nhớ: chưa đủ cơ hội thì chưa chấm; toàn nhớ = 1; toàn quên = 0', () => {
    expect(tiLeNho(undefined, undefined)).toBeNull();
    expect(tiLeNho([CO_HOI_NHO_TOI_THIEU - 1], [])).toBeNull();
    expect(tiLeNho([3, 0, 0, 0, 0], undefined)).toBe(1);
    expect(tiLeNho(undefined, [0, 3, 0, 0, 0])).toBe(0);
    expect(coHoiNho([1, 2], [3])).toBe(6);
  });

  it('độ lâu: nhớ lá cũ đáng giá hơn, quên lá vừa thấy nặng hơn', () => {
    expect(tiLeNho([0, 0, 0, 0, 3], [0, 0, 1, 0, 0])!).toBeGreaterThan(tiLeNho([3, 0, 0, 0, 0], [0, 0, 1, 0, 0])!);
    expect(tiLeNho([0, 0, 3, 0, 0], [0, 0, 0, 0, 1])!).toBeGreaterThan(tiLeNho([0, 0, 3, 0, 0], [1, 0, 0, 0, 0])!);
  });

  it('trần của bàn: đúng bảng đã chốt, bàn lớn nhất = 1000, không vượt trần', () => {
    expect([4, 8, 18, 30, 44].map(tranBan)).toEqual([300, 425, 640, 825, 1000]);
    expect(tranBan(60)).toBe(1000);
    for (let c = 2; c <= 44; c++) expect(tranBan(c)).toBeGreaterThanOrEqual(tranBan(c - 1));
  });

  it('điểm = tỉ lệ nhớ × trần: ví dụ đã chốt (12 nhớ, 3 quên → 86%)', () => {
    const nho = [4, 0, 5, 3, 0], quen = [1, 0, 2, 0, 0];
    expect(Math.round(tiLeNho(nho, quen)! * 100)).toBe(86);
    expect(diemTriNho(nho, quen, 18)).toBe(550);
    expect(diemTriNho(nho, quen, 6)).toBe(318);
    expect(diemTriNho([1], [1], 18)).toBeNull();
    expect(diemTriNho([5], undefined, 44)).toBe(1000);
  });
});
