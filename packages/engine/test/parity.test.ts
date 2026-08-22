import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { GameConfig } from '../src/types.js';
import { SYMBOLS } from './helpers.js';

/**
 * Mô phỏng mô hình online của v2.0: server (Durable Object) và client chạy hai
 * instance engine riêng biệt, chỉ trao đổi `(seed, chỉ số thẻ, mốc thời gian)`.
 * Nếu hai bên bao giờ cũng cho cùng trạng thái thì client dự đoán được kết quả để
 * vẽ animation tức thì, còn server vẫn là bên phán quyết (ON-04, ON-09).
 */
type Action = { index: number; at: number };

const CONFIG: GameConfig = {
  mode: 'classic', cols: 6, rows: 6, symbols: SYMBOLS, seed: 987654,
  specialRate: 0.15, flipBackMs: 800,
  players: [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }]
};

/** Ảnh chụp toàn bộ trạng thái quan sát được — dùng để so khớp hai bên. */
function snapshot(g: MemoryGame, at: number) {
  return JSON.stringify({
    status: g.status,
    cards: g.cards.map((c) => [c.index, c.pairId, c.symbol, c.power ?? null, !!c.powerUsed]),
    matched: [...g.matched].sort((x, y) => x - y),
    selection: [...g.selection].sort((x, y) => x - y),
    turnIndex: g.turnIndex,
    moves: g.moves,
    locked: g.locked,
    players: g.players.map((p) => [p.id, p.score, p.pairs, p.streak, p.bestStreak, p.misses, p.frozenTurns, p.doubleNext]),
    timeLeft: g.timeLeft(at),
    summary: g.summary()
  });
}

/** Chạy lại một danh sách hành động trên instance mới. */
function replay(actions: Action[], config: GameConfig = CONFIG): MemoryGame {
  const g = new MemoryGame(config);
  g.start(0);
  for (const a of actions) {
    g.tick(a.at);
    g.flip(a.index, a.at);
  }
  return g;
}

/** Sinh chuỗi hành động "như người chơi thật": lật ô hợp lệ đầu tiên tìm được. */
function playthrough(config: GameConfig = CONFIG, steps = 200): Action[] {
  const g = new MemoryGame(config);
  g.start(0);
  const actions: Action[] = [];
  let at = 0;
  for (let i = 0; i < steps && !g.finished; i++) {
    at += 350;
    g.tick(at);
    // Chọn ô theo quy tắc tất định, không dùng Math.random
    const target = g.cards.find((c) => !g.isMatched(c.index) && !g.selection.includes(c.index));
    if (!target) break;
    const before = g.moves;
    g.flip(target.index, at);
    actions.push({ index: target.index, at });
    if (g.moves === before && g.locked) at += config.flipBackMs ?? 1000;
  }
  return actions;
}

describe('parity server ↔ client (nền cho v2.0)', () => {
  const actions = playthrough();

  it('chuỗi hành động sinh ra đủ dài để có ý nghĩa', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  it('hai instance chạy song song luôn khớp trạng thái sau từng hành động', () => {
    const server = new MemoryGame(CONFIG);
    const client = new MemoryGame(CONFIG);
    server.start(0);
    client.start(0);

    for (const a of actions) {
      server.tick(a.at);
      client.tick(a.at);
      server.flip(a.index, a.at);
      client.flip(a.index, a.at);
      expect(snapshot(client, a.at), `lệch tại ô ${a.index} lúc ${a.at}ms`)
        .toBe(snapshot(server, a.at));
    }
  });

  it('phát lại toàn bộ log cho ra đúng trạng thái cuối (khôi phục sau khi mất kết nối, ON-07)', () => {
    const original = replay(actions);
    const restored = replay(actions);
    const at = actions.at(-1)!.at;
    expect(snapshot(restored, at)).toBe(snapshot(original, at));
  });

  it('phát lại một phần rồi tiếp tục cho kết quả giống chạy liền một mạch', () => {
    const cut = Math.floor(actions.length / 2);
    const resumed = replay(actions.slice(0, cut));
    for (const a of actions.slice(cut)) {
      resumed.tick(a.at);
      resumed.flip(a.index, a.at);
    }
    const at = actions.at(-1)!.at;
    expect(snapshot(resumed, at)).toBe(snapshot(replay(actions), at));
  });

  it('hành động không hợp lệ do client gửi lên không làm lệch trạng thái server', () => {
    const server = replay(actions);
    const at = actions.at(-1)!.at;
    const before = snapshot(server, at);
    // Các kiểu gian lận / lỗi mạng thường gặp
    for (const bogus of [-1, 999, actions[0]!.index, server.cards.length]) {
      server.flip(bogus, at);
    }
    expect(snapshot(server, at)).toBe(before);
  });

  it('client không thể biết thẻ chưa lật nếu server chỉ gửi chỉ số (NF-04)', () => {
    // Payload an toàn để gửi cho client: chỉ những gì đã công khai
    const server = replay(actions.slice(0, 6));
    const at = actions[5]!.at;
    const payload = JSON.stringify({
      revealed: server.cards
        .filter((c) => server.isFaceUp(c.index))
        .map((c) => ({ index: c.index, symbol: c.symbol })),
      matched: [...server.matched],
      turnIndex: server.turnIndex,
      scores: server.players.map((p) => p.score),
      timeLeft: server.timeLeft(at)
    });
    const hidden = server.cards.filter((c) => !server.isFaceUp(c.index));
    expect(hidden.length).toBeGreaterThan(0);
    for (const c of hidden) {
      expect(payload, `payload không được chứa vị trí thẻ chưa lật ${c.index}`)
        .not.toContain(`"index":${c.index}`);
    }
  });

  it('mỗi người chơi trong chế độ Race nhận bàn giống hệt nhau (ON-06)', () => {
    const solo = { ...CONFIG, players: undefined };
    const boards = [1, 2, 3, 4].map(() => new MemoryGame(solo).cards.map((c) => c.symbol));
    for (const b of boards) expect(b).toEqual(boards[0]);
  });
});
