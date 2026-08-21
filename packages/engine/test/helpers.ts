import { MemoryGame } from '../src/game.js';
import type { GameConfig } from '../src/types.js';

export const SYMBOLS = ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐵','🐷','🐸','🐧','🦉','🦋','🐢','🐬','🦄','🐔','🐴','🐝','🐞','🦀','🐙','🦑'];

export const makeGame = (over: Partial<GameConfig> = {}): MemoryGame =>
  new MemoryGame({ mode: 'classic', cols: 4, rows: 4, symbols: SYMBOLS, seed: 12345, ...over });

/** Trả về [chỉ số thẻ 1, chỉ số thẻ 2] cho từng cặp, theo thứ tự pairId. */
export function pairSlots(game: MemoryGame): [number, number][] {
  const map = new Map<number, number[]>();
  for (const c of game.cards) {
    const list = map.get(c.pairId) ?? [];
    list.push(c.index);
    map.set(c.pairId, list);
  }
  return [...map.keys()].sort((a, b) => a - b).map((k) => map.get(k) as [number, number]);
}

/** Ghép đúng một cặp. */
export function matchPair(game: MemoryGame, pairId: number, now = 0): void {
  const [a, b] = pairSlots(game)[pairId]!;
  game.flip(a, now);
  game.flip(b, now);
}

/** Lật sai một lượt: thẻ đầu của cặp x với thẻ đầu của cặp y. */
export function missPair(game: MemoryGame, x: number, y: number, now = 0): void {
  const slots = pairSlots(game);
  game.flip(slots[x]![0], now);
  game.flip(slots[y]![0], now);
  game.tick(now + (game.config.flipBackMs ?? 1000) + 1);
}

/** Giải sạch bàn. */
export function clearBoard(game: MemoryGame, now = 0): void {
  for (let p = 0; p < game.totalPairs; p++) matchPair(game, p, now);
}
