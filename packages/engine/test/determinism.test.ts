import { describe, expect, it } from 'vitest';
import { MemoryGame } from '../src/game.js';
import type { GameEvent } from '../src/types.js';
import { SYMBOLS } from './helpers.js';

/**
 * Engine phải tất định: cùng (seed, chuỗi hành động, mốc thời gian) → cùng kết quả.
 * Đây là điều kiện để server (Durable Object) và client chạy cùng một engine mà
 * không lệch trạng thái, và để chế độ Race (ON-06) phát bàn giống hệt cho mọi người.
 */
const run = (seed: number, actions: [number, number][]): { events: GameEvent[]; score: number } => {
  const g = new MemoryGame({
    mode: 'survival', cols: 6, rows: 6, symbols: SYMBOLS, seed,
    specialRate: 0.15, shuffleAfterMisses: 3, lives: 99
  });
  g.start(0);
  const events: GameEvent[] = [];
  for (const [index, now] of actions) {
    events.push(...g.tick(now));
    events.push(...g.flip(index, now));
  }
  return { events, score: g.players[0]!.score };
};

const script: [number, number][] = Array.from({ length: 60 }, (_, i) => [(i * 7) % 36, i * 400]);

describe('tính tất định', () => {
  it('hai lần chạy cùng seed cho chuỗi sự kiện y hệt', () => {
    const a = run(31337, script);
    const b = run(31337, script);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.score).toBe(b.score);
  });

  it('seed khác cho kết quả khác', () => {
    const a = run(31337, script);
    const c = run(31338, script);
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(c.events));
  });

  it('engine không gọi Date.now/Math.random ở bất kỳ đâu trong src', async () => {
    const fs = await import('node:fs/promises');
    const files = await fs.readdir('src');
    for (const f of files) {
      const code = await fs.readFile(`src/${f}`, 'utf8');
      // Bỏ dòng chú thích trước khi soát
      const stripped = code.split('\n').filter((l: string) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
      expect(stripped, `${f} dùng Math.random`).not.toMatch(/Math\.random/);
      expect(stripped, `${f} dùng Date.now`).not.toMatch(/Date\.now/);
    }
  });
});
