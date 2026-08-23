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

export type BotLevel = 'easy' | 'normal' | 'hard' | 'insane';

export interface BotSpec {
  /**
   * Tỉ lệ CÒN NHỚ sau mỗi nước đi. 0,9 nghĩa là qua mỗi nước, khả năng nhớ một
   * lá còn 90% so với trước — nhớ mờ dần đúng như người thật, chứ không phải
   * nhớ tuyệt đối rồi đột ngột quên hẳn.
   */
  retain: number;
  /** Xác suất nhớ lẫn chỗ ngay lúc vừa thấy (lỗi ghi nhớ, không phải lỗi phai). */
  mistake: number;
  /**
   * Khoảng thời gian nghĩ trước khi lật, ms — để người chơi thấy nó đang suy
   * nghĩ. Là KHOẢNG chứ không phải một số: nhịp cố định nghe ra ngay là máy,
   * mỗi nước một nhịp khác thì giống người đang cân nhắc.
   */
  thinkMinMs: number;
  thinkMaxMs: number;
  name: string;
  avatar: string;
}

/**
 * Bốn mức khác nhau ở chỗ NHỚ ĐƯỢC BAO LÂU. "Nửa đời" là số nước đi sau đó khả
 * năng nhớ một lá còn 50%; `retain` suy ra từ đó: `retain = 0,5 ** (1 / nửa đời)`.
 * Sửa nửa đời thì phải TÍNH LẠI retain, đừng đoán — quan hệ là hàm số mũ nên
 * nhích retain một chút không tương ứng với nhớ dai thêm một chút.
 *
 *   | mức             | nửa đời | retain | nhớ lẫn chỗ | nghĩ      |
 *   | Bot dễ         |  2 nước | 0,7071 | 30%         | 2–5s      |
 *   | Bot bình thường |  4 nước | 0,8409 | 20%         | 1–4s      |
 *   | Bot Pro         |  8 nước | 0,9170 | 10%         | 0,7–3,5s  |
 *   | Bot siêu đẳng   | 12 nước | 0,9439 |  5%         | 0,5–2s    |
 *
 * Bot càng giỏi càng nghĩ nhanh, và khoảng nghĩ của các mức CHỒNG NHAU: nếu mỗi
 * mức một nhịp riêng biệt thì đếm thời gian là đoán được mình đang đấu mức nào.
 */
export const BOT_SPECS: Record<BotLevel, BotSpec> = {
  easy:   { retain: 0.7071, mistake: 0.30, thinkMinMs: 2000, thinkMaxMs: 5000, name: 'Bot dễ',         avatar: '🐣' },
  normal: { retain: 0.8409, mistake: 0.20, thinkMinMs: 1000, thinkMaxMs: 4000, name: 'Bot bình thường', avatar: '🤖' },
  hard:   { retain: 0.9170, mistake: 0.10, thinkMinMs: 700,  thinkMaxMs: 3500, name: 'Bot Pro',         avatar: '👾' },
  insane: { retain: 0.9439, mistake: 0.05, thinkMinMs: 500,  thinkMaxMs: 2000, name: 'Bot siêu đẳng',   avatar: '🦾' }
};

/**
 * Lần nghĩ này lâu bao nhiêu ms. Rút từ `rng` của bot nên vẫn TẤT ĐỊNH: cùng
 * seed thì cùng nhịp, test và replay không lệch.
 */
export function botThinkMs(level: BotLevel, rng: Rng): number {
  const { thinkMinMs, thinkMaxMs } = BOT_SPECS[level];
  return Math.round(thinkMinMs + rng.next() * (thinkMaxMs - thinkMinMs));
}

/** Một lá trong ký ức: biểu tượng và nước đi lúc nhìn thấy. */
export interface BotSeen { symbol: string; at: number }

/** Ký ức của bot: ô → thứ đã thấy. */
export type BotMemory = Map<number, BotSeen>;

export const createBotMemory = (): BotMemory => new Map();

/**
 * Ghi nhớ những gì ĐANG lộ trên bàn. Gọi mỗi lần view đổi.
 *
 * `clock` là số nước đã đi (dùng `view.moves`): tuổi của ký ức tính theo đó, nên
 * bot quên dần theo diễn biến ván chứ không theo thời gian thực — người chơi
 * ngồi nghĩ lâu không làm bot quên thêm.
 *
 * Thẻ đã ghép thì xoá: nó không còn dùng được nữa mà lại chiếm chỗ.
 */
export function observe(memory: BotMemory, view: GameView, _level: BotLevel): void {
  for (const c of view.cards) {
    if (c.state === 'matched') { memory.delete(c.index); continue; }
    if (c.state === 'up' && c.symbol) memory.set(c.index, { symbol: c.symbol, at: view.moves });
  }
}

/**
 * Bot có còn nhớ lá này không. Càng thấy lâu rồi càng dễ quên, và bot giỏi thì
 * quên chậm hơn — đúng như trí nhớ người.
 */
function recalls(seen: BotSeen, clock: number, level: BotLevel, rng: Rng): boolean {
  const spec = BOT_SPECS[level];
  const age = Math.max(0, clock - seen.at);
  return rng.next() < spec.retain ** age;
}

/** Những lá bot CÒN nhớ, trong số các ô đang úp. */
function recalled(
  memory: BotMemory, downSet: Set<number>, clock: number, level: BotLevel, rng: Rng
): Map<number, string> {
  const out = new Map<number, string>();
  for (const [index, seen] of memory) {
    if (!downSet.has(index)) continue;
    if (recalls(seen, clock, level, rng)) out.set(index, seen.symbol);
  }
  return out;
}

/** Cặp đã biết chắc: hai ô đang úp, cùng biểu tượng, đều trong ký ức. */
function knownPair(known: Map<number, string>): [number, number] | null {
  const bySymbol = new Map<string, number[]>();
  for (const [index, symbol] of known) {
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
  // Chốt danh sách "còn nhớ" MỘT LẦN cho cả lượt suy nghĩ này: gọi recalls()
  // nhiều lần cho cùng một lá sẽ ra kết quả khác nhau, thành ra bot nhớ rồi
  // quên rồi nhớ lại trong cùng một nước — vô lý.
  const known = recalled(memory, downSet, view.moves, level, rng);

  // 1. Đang mở dở một lá: cố ghép cho nó
  const openNow = view.cards.find((c) => c.state === 'up' && c.symbol);
  if (openNow?.symbol) {
    for (const [index, symbol] of known) if (symbol === openNow.symbol) return index;
    // Không nhớ được lá kia: bốc một lá chưa thấy
    const fresh = down.filter((i) => !memory.has(i));
    return (fresh.length ? rng.sample(fresh, 1) : rng.sample(down, 1))[0]!;
  }

  // 2. Ký ức có cặp sẵn — trừ khi nhớ lẫn chỗ
  const pair = knownPair(known);
  if (pair && rng.next() >= spec.mistake) return pair[0]!;

  // 3. Học lá mới
  const fresh = down.filter((i) => !memory.has(i));
  return (fresh.length ? rng.sample(fresh, 1) : rng.sample(down, 1))[0]!;
}

/** Rng riêng cho bot: dùng chung dòng số với bàn thẻ thì lật một lá là lệch cả deck. */
export const botRng = (seed: number): Rng => new Rng((seed ^ 0x5bf03635) >>> 0);
