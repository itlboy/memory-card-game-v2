import { MemoryGame } from '../src/game.js';
import { publicView } from '../src/online.js';
import { BOT_SPECS, botPick, botRng, createBotMemory, observe } from '../src/bot.js';
import type { BotLevel } from '../src/bot.js';
import { Rng } from '../src/rng.js';
const SYMBOLS = Array.from({ length: 30 }, (_, i) => `s${i}`);

/** Đối thủ người: ghi được `keep` phần các lá thấy, và quên dần theo `hRetain`. */
export function duel(
  level: BotLevel, seed: number, cols: number, rows: number,
  keep: number, hRetain: number, botFirst: boolean
): boolean {
  const g = new MemoryGame({
    mode: 'classic', cols, rows, symbols: SYMBOLS, seed,
    players: botFirst
      ? [{ id: 'bot', name: 'Bot' }, { id: 'p1', name: 'Người' }]
      : [{ id: 'p1', name: 'Người' }, { id: 'bot', name: 'Bot' }]
  });
  g.start(0);
  const mem = createBotMemory(); const rng = botRng(seed);
  const human = new Map<number, { sym: string; at: number }>();
  const hrng = new Rng(seed ^ 0x9e37);
  let t = 0, guard = 0;
  while (!g.finished && guard++ < 8000) {
    t += 300; g.tick(t);
    const view = publicView(g, t, () => true);
    observe(mem, view, level);
    for (const c of view.cards) {
      if (c.state === 'matched') human.delete(c.index);
      else if (c.state === 'up' && c.symbol && hrng.next() < keep) human.set(c.index, { sym: c.symbol, at: view.moves });
    }
    if (g.locked) continue;
    if (g.current.id === 'bot') {
      const pick = botPick(view, mem, rng, level);
      if (pick === null) break;
      g.flip(pick, t);
    } else {
      const down = g.cards.filter((c) => !c.blank && !g.isMatched(c.index) && !g.isFaceUp(c.index)).map((c) => c.index);
      if (!down.length) break;
      const recall = new Map<number, string>();
      for (const [i, v] of human) {
        if (!down.includes(i)) continue;
        if (hrng.next() < hRetain ** Math.max(0, view.moves - v.at)) recall.set(i, v.sym);
      }
      const open = g.cards.find((c) => g.isFaceUp(c.index) && !g.isMatched(c.index));
      let pick: number | null = null;
      if (open) { for (const [i, sym] of recall) if (sym === open.symbol) { pick = i; break; } }
      else {
        const bySym = new Map<string, number[]>();
        for (const [i, sym] of recall) bySym.set(sym, [...(bySym.get(sym) ?? []), i]);
        for (const list of bySym.values()) if (list.length >= 2) { pick = list[0]!; break; }
      }
      if (pick === null) {
        const fresh = down.filter((i) => !human.has(i));
        pick = (fresh.length ? hrng.sample(fresh, 1) : hrng.sample(down, 1))[0]!;
      }
      g.flip(pick, t);
    }
  }
  const bot = g.players.find((p) => p.id === 'bot')!;
  const man = g.players.find((p) => p.id === 'p1')!;
  return bot.score >= man.score;
}
export { BOT_SPECS, SYMBOLS };
