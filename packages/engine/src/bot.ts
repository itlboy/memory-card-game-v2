import { Rng } from './rng.js';
import type { GameView } from './online.js';

/**
 * Đối thủ máy.
 *
 * NGUYÊN TẮC QUAN TRỌNG NHẤT: bot chỉ được nhìn `GameView` — đúng thứ mà client
 * online nhận. View đó không bao giờ chứa biểu tượng của thẻ đang úp (NF-04),
 * nên bot KHÔNG THỂ gian lận về mặt kiến trúc: không phải vì nó tự nguyện không
 * xem, mà vì nó không có đường nào lấy được. Đừng bao giờ truyền `MemoryGame`
 * hay `Card[]` vào đây.
 *
 * Độ khó đến từ GIỚI HẠN KÝ ỨC, không phải từ việc cho bot cố tình lật sai. Bot
 * biết hết rồi giả vờ sai thì người chơi cảm nhận ra ngay là giả; bot nhớ kém
 * thì sai một cách tự nhiên, đúng như người thật.
 */

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface BotSpec {
  /** Nhớ được bao nhiêu lá cùng lúc. Vượt quá thì quên lá cũ nhất. */
  memory: number;
  /** Xác suất bỏ qua một cặp đã biết (nhớ lẫn chỗ). */
  mistake: number;
  /** Nghĩ bao lâu trước khi lật, ms — để người chơi thấy nó đang suy nghĩ. */
  thinkMs: number;
  name: string;
  avatar: string;
}

export const BOT_SPECS: Record<BotLevel, BotSpec> = {
  easy:   { memory: 3,        mistake: 0.35, thinkMs: 1100, name: 'Máy (dễ)',   avatar: '🐣' },
  normal: { memory: 8,        mistake: 0.12, thinkMs: 850,  name: 'Máy',        avatar: '🤖' },
  hard:   { memory: Infinity, mistake: 0,    thinkMs: 650,  name: 'Máy (khó)',  avatar: '👾' }
};

/** Ký ức của bot: ô → biểu tượng, theo thứ tự nhìn thấy (cũ nhất trước). */
export type BotMemory = Map<number, string>;

export const createBotMemory = (): BotMemory => new Map();

/**
 * Ghi nhớ những gì ĐANG lộ trên bàn. Gọi mỗi lần view đổi.
 * Thẻ đã ghép thì xoá khỏi ký ức: nó không còn dùng được nữa mà lại chiếm chỗ.
 */
export function observe(memory: BotMemory, view: GameView, level: BotLevel): void {
  const cap = BOT_SPECS[level].memory;
  for (const c of view.cards) {
    if (c.state === 'matched') { memory.delete(c.index); continue; }
    if (c.state === 'up' && c.symbol) {
      // Xoá rồi thêm lại để nó thành "mới nhất" trong thứ tự quên
      memory.delete(c.index);
      memory.set(c.index, c.symbol);
    }
  }
  while (memory.size > cap) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

/** Cặp đã biết chắc: hai ô đang úp, cùng biểu tượng, đều trong ký ức. */
function knownPair(memory: BotMemory, down: Set<number>): [number, number] | null {
  const bySymbol = new Map<string, number[]>();
  for (const [index, symbol] of memory) {
    if (!down.has(index)) continue;
    const list = bySymbol.get(symbol) ?? [];
    list.push(index);
    bySymbol.set(symbol, list);
  }
  for (const list of bySymbol.values()) {
    if (list.length >= 2) return [list[0]!, list[1]!];
  }
  return null;
}

/**
 * Ô bot sẽ lật tiếp. Trả về null nếu không còn gì lật được.
 *
 * Chiến thuật (đúng cách một người chơi giỏi làm):
 * 1. Đang mở dở một lá → tìm lá cùng biểu tượng trong ký ức mà lật nốt
 * 2. Đầu lượt, ký ức có sẵn một cặp → lật cặp đó
 * 3. Không thì lật lá CHƯA TỪNG THẤY — lật lá đã thấy mà không thành cặp thì
 *    chẳng học được gì mới
 */
export function botPick(
  view: GameView, memory: BotMemory, rng: Rng, level: BotLevel
): number | null {
  const spec = BOT_SPECS[level];
  const down = view.cards.filter((c) => c.state === 'down' && !c.blank).map((c) => c.index);
  if (!down.length) return null;
  const downSet = new Set(down);

  // 1. Đang mở dở một lá: cố ghép cho nó
  const openNow = view.cards.find((c) => c.state === 'up' && c.symbol);
  if (openNow?.symbol) {
    for (const [index, symbol] of memory) {
      if (symbol === openNow.symbol && downSet.has(index)) return index;
    }
    // Không nhớ được lá kia: bốc một lá chưa thấy
    const fresh = down.filter((i) => !memory.has(i));
    return (fresh.length ? rng.sample(fresh, 1) : rng.sample(down, 1))[0]!;
  }

  // 2. Ký ức có cặp sẵn — trừ khi nhớ lẫn
  const pair = knownPair(memory, downSet);
  if (pair && rng.next() >= spec.mistake) return pair[0]!;

  // 3. Học lá mới
  const fresh = down.filter((i) => !memory.has(i));
  return (fresh.length ? rng.sample(fresh, 1) : rng.sample(down, 1))[0]!;
}

/** Rng riêng cho bot: dùng chung dòng số với bàn thẻ thì lật một lá là lệch cả deck. */
export const botRng = (seed: number): Rng => new Rng((seed ^ 0x5bf03635) >>> 0);
