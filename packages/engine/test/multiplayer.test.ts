import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import { rankPlayers } from '../src/scoring.js';
import { SYMBOLS, matchPair, missPair } from './helpers.js';

const four = (over = {}) => new MemoryGame({
  mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 2024, shufflePlayers: false,
  players: [
    { id: 'a', name: 'An' }, { id: 'b', name: 'Bình' },
    { id: 'c', name: 'Chi' }, { id: 'd', name: 'Dũng' }
  ],
  ...over
});

describe('Local multiplayer (MP-01…MP-04)', () => {
  it('ghép đúng thì giữ lượt, ghép sai thì chuyển lượt', () => {
    const g = four();
    expect(g.current.id).toBe('a');
    matchPair(g, 0);
    expect(g.current.id).toBe('a');       // MP-02: đúng → lật tiếp
    missPair(g, 1, 2);
    expect(g.current.id).toBe('b');       // sai → chuyển lượt
  });

  it('lượt chạy vòng qua đủ 4 người', () => {
    const g = four();
    const seen = [g.current.id];
    for (let i = 0; i < 4; i++) { missPair(g, 0, 1); seen.push(g.current.id); }
    expect(seen).toEqual(['a', 'b', 'c', 'd', 'a']);
  });

  it('điểm tính riêng cho từng người', () => {
    const g = four();
    matchPair(g, 0);        // An +100
    missPair(g, 1, 2);      // An -10 → 90, sang Bình
    matchPair(g, 1);        // Bình +100
    expect(g.players[0]!.score).toBe(90);
    expect(g.players[1]!.score).toBe(100);
  });

  it('hoà điểm thì người có chuỗi đúng dài nhất thắng (MP-04)', () => {
    const tie = [
      { id: 'x', score: 300, bestStreak: 1, pairs: 3 },
      { id: 'y', score: 300, bestStreak: 4, pairs: 3 },
      { id: 'z', score: 500, bestStreak: 1, pairs: 4 }
    ];
    expect(rankPlayers(tie).map((p) => p.id)).toEqual(['z', 'y', 'x']);
    // hoà cả điểm và chuỗi thì xét tiếp số cặp
    expect(rankPlayers([
      { id: 'm', score: 100, bestStreak: 2, pairs: 1 },
      { id: 'n', score: 100, bestStreak: 2, pairs: 2 }
    ]).map((p) => p.id)).toEqual(['n', 'm']);
  });

  it('người dẫn đầu bảng xếp hạng là người điểm cao nhất', () => {
    const g = four();
    matchPair(g, 0); matchPair(g, 1);          // An dẫn trước
    missPair(g, 2, 3);
    for (let p = 2; p < g.totalPairs; p++) matchPair(g, p);
    const ranking = g.summary()!.ranking;
    expect(ranking[0]!.score).toBe(Math.max(...g.players.map((p) => p.score)));
    expect(ranking.map((p) => p.score)).toEqual([...ranking.map((p) => p.score)].sort((a, b) => b - a));
  });

  it('multiplayer không cộng thưởng thời gian cho riêng ai', () => {
    const g = four({ timeLimit: 200 });
    g.start(0);
    for (let p = 0; p < g.totalPairs; p++) matchPair(g, p, 5000);
    expect(g.summary()!.timeBonus).toBe(0);
  });
});

describe('thẻ đóng băng (SRS 3.4)', () => {
  it('khoá đúng 1 lượt của người kế tiếp rồi trả lại lượt bình thường', () => {
    const g = four();
    g.players[1]!.frozenTurns = 1;         // Bình bị đóng băng
    missPair(g, 0, 1);                     // An sai → lẽ ra tới Bình
    expect(g.current.id).toBe('c');        // Bình bị bỏ lượt
    expect(g.players[1]!.frozenTurns).toBe(0);
    missPair(g, 0, 1);
    expect(g.current.id).toBe('d');
    missPair(g, 0, 1);
    expect(g.current.id).toBe('a');
    missPair(g, 0, 1);
    expect(g.current.id).toBe('b');        // lần này Bình được chơi
  });
});

describe('thứ tự đi ngẫu nhiên', () => {
  const players = [
    { id: 'host', name: 'Chủ phòng' }, { id: 'p2', name: 'B' },
    { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
  ];
  const withSeed = (seed: number) => new MemoryGame({
    mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed, players
  });

  it('chủ phòng không mặc nhiên đi trước — có seed cho người khác mở màn', () => {
    const starters = new Set(Array.from({ length: 30 }, (_, i) => withSeed(i + 1).current.id));
    expect(starters.size).toBeGreaterThan(1);           // không phải luôn một người
    expect([...starters].some((id) => id !== 'host')).toBe(true);
  });

  it('xáo là hoán vị: đủ người, không mất ai', () => {
    const g = withSeed(99);
    expect(g.players.map((p) => p.id).sort()).toEqual(['host', 'p2', 'p3', 'p4']);
  });

  it('cùng seed cho cùng thứ tự (tất định — server và client khớp nhau)', () => {
    expect(withSeed(7).players.map((p) => p.id)).toEqual(withSeed(7).players.map((p) => p.id));
  });

  it('shufflePlayers: false giữ nguyên thứ tự đưa vào', () => {
    const g = new MemoryGame({
      mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 3, shufflePlayers: false, players
    });
    expect(g.players.map((p) => p.id)).toEqual(['host', 'p2', 'p3', 'p4']);
  });
});
