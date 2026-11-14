import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { GameConfig } from '../src/types.js';
import { SYMBOLS, matchPair, missPair, missKnown, pairSlots } from './helpers.js';

/*
 * CHẾ ĐỘ ĐỒNG ĐỘI "mỗi người một lá" (docs/che-do-dong-doi.md). Mỗi players[i] là một ĐỘI có
 * `thanhVien`; engine chỉ nói AI được lật lá kế (`nguoiLat`), tầng phòng chặn người sai.
 */
const doi = (over: Partial<GameConfig> = {}): MemoryGame => new MemoryGame({
  mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 2024, shufflePlayers: false,
  teamFlip: true,
  players: [
    { id: 'doi-A', name: 'An & Bình', thanhVien: ['an', 'binh'] },
    { id: 'doi-B', name: 'Chi & Dũng', thanhVien: ['chi', 'dung'] }
  ],
  ...over
});
const GAP = 1001;

describe('Đồng đội: ai lật lá nào', () => {
  it('lá 1 người lật trước, lá 2 người kia', () => {
    const g = doi();
    g.start(0);
    expect(g.current.id).toBe('doi-A');
    expect(g.nguoiLat()).toBe('an');
    g.flip(pairSlots(g)[0]![0], 0);
    expect(g.nguoiLat()).toBe('binh');
  });

  it('luân phiên người lật trước MỖI LƯỢT của đội (sai → sang đội kia → quay lại thì đổi người)', () => {
    const g = doi();
    g.start(0);
    missPair(g, 0, 1);                       // đội A lượt 0 (an lật trước), sai
    expect(g.current.id).toBe('doi-B');
    expect(g.nguoiLat()).toBe('chi');        // đội B lượt đầu: thành viên [0]
    missPair(g, 0, 1, GAP);
    expect(g.current.id).toBe('doi-A');
    expect(g.nguoiLat()).toBe('binh');       // đội A lượt 1: đổi sang bình
    missPair(g, 0, 1, GAP * 2);
    expect(g.nguoiLat()).toBe('dung');
    missPair(g, 0, 1, GAP * 3);
    expect(g.nguoiLat()).toBe('an');         // vòng lại
  });

  it('ghép đúng → đội đi tiếp, GIỮ NGUYÊN người lật lá đầu trong lượt', () => {
    const g = doi();
    g.start(0);
    matchPair(g, 0);
    expect(g.current.id).toBe('doi-A');
    expect(g.nguoiLat()).toBe('an');
    matchPair(g, 1);
    expect(g.nguoiLat()).toBe('an');
  });

  it('điểm, cặp, chuỗi tính theo ĐỘI', () => {
    const g = doi();
    g.start(0);
    matchPair(g, 0);
    matchPair(g, 1);
    const a = g.players.find((p) => p.id === 'doi-A')!;
    expect(a.pairs).toBe(2);
    expect(a.streak).toBe(2);
    expect(a.score).toBeGreaterThan(0);
  });

  it('thắng/thua xếp theo đội', () => {
    const g = doi();
    g.start(0);
    for (let p = 0; p < g.totalPairs; p++) matchPair(g, p);
    expect(g.finished).toBe(true);
    expect(g.summary()!.ranking[0]!.id).toBe('doi-A');
    expect(g.summary()!.ranking.map((p) => p.id)).toEqual(['doi-A', 'doi-B']);
  });
});

describe('Đồng đội: đồng hồ theo TỪNG LÁ', () => {
  it('lá 2 có trọn turnLimit tính từ lúc lá 1 lật', () => {
    const g = doi({ turnLimit: 8 });
    g.start(0);
    expect(g.turnTimeLeft(0)).toBe(8);
    g.flip(pairSlots(g)[0]![0], 5000);       // an lật lá 1 ở giây thứ 5
    expect(g.turnTimeLeft(5000)).toBe(8);    // bình có đủ 8 giây
    const ev = g.tick(5000 + 8001);
    expect(ev.some((e) => e.type === 'turn-timeout')).toBe(true);
    expect(g.current.id).toBe('doi-B');      // hết giờ lá → cả đội mất lượt
  });

  it('ghép đúng → lá đầu cặp sau có trọn giờ một lá (không cộng dồn +5s)', () => {
    const g = doi({ turnLimit: 8 });
    g.start(0);
    const [a, b] = pairSlots(g)[0]!;
    g.flip(a, 1000);
    g.flip(b, 3000);
    expect(g.turnTimeLeft(3000)).toBe(8);
  });
});

describe('Đồng đội: kết hợp luật có sẵn', () => {
  it('sinh tồn: đội dùng CHUNG mạng — ai lật sai cũng trừ mạng đội', () => {
    const g = doi({ lives: 3 });
    g.start(0);
    missKnown(g, 0, 1);                      // lượt 1 dò, lượt 2 (đội B) lỗi nhớ
    const b = g.players.find((p) => p.id === 'doi-B')!;
    const a = g.players.find((p) => p.id === 'doi-A')!;
    expect(a.lives + b.lives).toBe(5);       // đúng một đội mất 1 mạng chung
  });

  it('❄️ đóng băng khoá CẢ ĐỘI kia một lượt', () => {
    const g = doi();
    g.start(0);
    const B = g.players.find((p) => p.id === 'doi-B')!;
    B.frozenTurns = 1;                       // như vừa trúng thẻ đóng băng
    missPair(g, 0, 1);
    expect(g.current.id).toBe('doi-A');      // đội B bị bỏ qua
    expect(B.luotDoi).toBeUndefined();       // lượt bị bỏ qua không tính vào luân phiên
    missPair(g, 0, 1, GAP);
    expect(g.current.id).toBe('doi-B');
    expect(g.nguoiLat()).toBe('chi');        // lượt THẬT đầu tiên của B vẫn là thành viên [0]
  });
});

describe('Đồng đội: rời phòng', () => {
  it('một người rời → người còn lại lật cả hai lá, đội không bị xử thua', () => {
    const g = doi();
    g.start(0);
    expect(g.roiDoi('binh', 0)).toEqual([]);
    expect(g.nguoiLat()).toBe('an');
    g.flip(pairSlots(g)[0]![0], 0);
    expect(g.nguoiLat()).toBe('an');
    expect(g.finished).toBe(false);
  });

  it('cả đội rời → xử thua cả đội, đội kia thắng', () => {
    const g = doi();
    g.start(0);
    g.roiDoi('chi', 0);
    const ev = g.roiDoi('dung', 0);
    expect(ev.some((e) => e.type === 'end')).toBe(true);
    expect(g.players.find((p) => p.id === 'doi-B')!.forfeited).toBe(true);
  });
});

describe('Đồng đội: 2 người đấu MÁY (máy là đội một thành viên)', () => {
  it('đội một thành viên lật CẢ HAI lá; đội người vẫn luân phiên', () => {
    const g = doi({ players: [
      { id: 'doi-A', name: 'An & Bình', thanhVien: ['an', 'binh'] },
      { id: 'doi-B', name: 'Bot gà cứng', thanhVien: ['bot'] }
    ] });
    g.start(0);
    missPair(g, 0, 1);
    expect(g.current.id).toBe('doi-B');
    expect(g.nguoiLat()).toBe('bot');
    g.flip(pairSlots(g)[0]![0], GAP);
    expect(g.nguoiLat()).toBe('bot');        // lá 2 vẫn là máy
    g.flip(pairSlots(g)[1]![0], GAP);
    g.tick(GAP + 1501);                      // úp lại sau flipBackMs (1500ms mặc định)
    expect(g.current.id).toBe('doi-A');
    expect(g.nguoiLat()).toBe('binh');       // lượt 2 của đội người: đổi người lật trước
  });
});

describe('Đồng đội: snapshot vòng tròn', () => {
  it('khôi phục giữ đội, luân phiên, người vắng', () => {
    const g = doi({ turnLimit: 8 });
    g.start(0);
    missPair(g, 0, 1);
    missPair(g, 0, 1, GAP);
    g.roiDoi('dung', GAP * 2);
    const r = MemoryGame.restore(g.snapshot());
    expect(r.config.teamFlip).toBe(true);
    expect(r.nguoiLat()).toBe(g.nguoiLat());
    expect(r.players.map((p) => [p.id, p.thanhVien, p.luotDoi, p.vang]))
      .toEqual(g.players.map((p) => [p.id, p.thanhVien, p.luotDoi, p.vang]));
  });
});

describe('Không bật cờ → y như cũ', () => {
  it('nguoiLat() là null, không có trường đội', () => {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 2024, shufflePlayers: false,
      players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }]
    });
    g.start(0);
    missPair(g, 0, 1);
    expect(g.nguoiLat()).toBeNull();
    expect(g.players.every((p) => p.luotDoi === undefined && p.thanhVien === undefined)).toBe(true);
  });
});
