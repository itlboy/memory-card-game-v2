import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { GameConfig } from '../src/types.js';
import { publicView } from '../src/online.js';
import { SYMBOLS, matchPair, missPair, pairSlots } from './helpers.js';

/*
 * ĐỘI THEO LƯỢT (`teamTurn`, 15.11.2026 — thay "mỗi người một lá"): mỗi lượt của đội do MỘT thành
 * viên lật cả hai lá; lượt sau của đội tới thành viên kế. A+B đấu C: A → C → B → C.
 */
const van = (over: Partial<GameConfig> = {}): MemoryGame => new MemoryGame({
  mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 2024, shufflePlayers: false,
  teamTurn: true,
  players: [
    { id: 'doi-1', name: 'An & Bình', thanhVien: ['an', 'binh'] },
    { id: 'doi-2', name: 'Chi', thanhVien: ['chi'] }
  ],
  ...over
});
const GAP = 1001;

describe('Đội theo lượt', () => {
  it('A lật cả hai lá → C → B → C → A', () => {
    const g = van();
    g.start(0);
    expect(g.nguoiLat()).toBe('an');
    g.flip(pairSlots(g)[0]![0], 0);
    expect(g.nguoiLat()).toBe('an');          // lá 2 vẫn là An
    g.flip(pairSlots(g)[1]![0], 0);
    g.tick(1501);
    expect(g.current.id).toBe('doi-2');
    expect(g.nguoiLat()).toBe('chi');
    missPair(g, 0, 1, GAP * 2);
    expect(g.nguoiLat()).toBe('binh');
    missPair(g, 0, 1, GAP * 4);
    expect(g.nguoiLat()).toBe('chi');
    missPair(g, 0, 1, GAP * 6);
    expect(g.nguoiLat()).toBe('an');
  });

  it('ghép đúng → CHÍNH người đó đi tiếp; cặp ghi cho từng người, điểm cho đội', () => {
    const g = van();
    g.start(0);
    matchPair(g, 0);
    matchPair(g, 1);
    expect(g.nguoiLat()).toBe('an');
    const d = g.players.find((p) => p.id === 'doi-1')!;
    expect(d.pairs).toBe(2);
    expect(d.capTV).toEqual({ an: 2 });
    const v = publicView(g, 0, () => true);
    expect(v.players.find((p) => p.id === 'doi-1')!.capTV).toEqual({ an: 2 });
    expect(v.nguoiLat).toBe('an');
  });

  it('đồng hồ lượt y ván thường: ghép đúng cộng giờ, không đặt lại theo lá', () => {
    const g = van({ turnLimit: 10 });
    g.start(0);
    const [a, b] = pairSlots(g)[0]!;
    g.flip(a, 4000);
    expect(g.turnTimeLeft(4000)).toBe(6);     // lá 1 KHÔNG đặt lại đồng hồ
    const ev = g.flip(b, 5000);
    expect(ev.some((e) => e.type === 'time-bonus')).toBe(true);
  });

  it('ba đội 2+1+1 và đội 3 người đều xoay đúng', () => {
    const g = van({ players: [
      { id: 'doi-1', name: 'x', thanhVien: ['a', 'b', 'c'] },
      { id: 'doi-2', name: 'y', thanhVien: ['d'] }
    ] });
    g.start(0);
    const thu: string[] = [];
    for (let i = 0; i < 6; i++) { thu.push(g.nguoiLat()!); missPair(g, 0, 1, GAP * 2 * i); }
    expect(thu).toEqual(['a', 'd', 'b', 'd', 'c', 'd']);
  });

  it('một người rời → đồng đội đi mọi lượt; cả đội rời → xử thua', () => {
    const g = van();
    g.start(0);
    expect(g.roiDoi('an', 0)).toEqual([]);
    expect(g.nguoiLat()).toBe('binh');
    const ev = g.roiDoi('binh', 0);
    expect(ev.some((e) => e.type === 'end')).toBe(true);
  });

  it('snapshot giữ cặp từng người và người đang lật', () => {
    const g = van();
    g.start(0);
    matchPair(g, 0);
    missPair(g, 1, 2, GAP);
    const r = MemoryGame.restore(g.snapshot());
    expect(r.config.teamTurn).toBe(true);
    expect(r.nguoiLat()).toBe(g.nguoiLat());
    expect(r.players.map((p) => p.capTV)).toEqual(g.players.map((p) => p.capTV));
  });
});
