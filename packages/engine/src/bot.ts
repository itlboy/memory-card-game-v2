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
   * Giữ được bao nhiêu lá trong đầu mà chưa bị nhiễu. Vượt số này thì mỗi lá
   * thêm làm khả năng nhớ MỌI lá giảm đi một nhịp (`CROWD`) — đúng như người
   * thật: nhớ 3 lá thì chắc, nhớ 20 lá thì lẫn lộn hết.
   *
   * Đây là loại quên KHÁC hai loại kia: `retain` là phai theo thời gian,
   * `mistake` là lỡ tay ở nước đang đi, còn đây là nhiễu do quá tải.
   */
  capacity: number;
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
 *   | mức             | nửa đời | retain | nhớ lẫn chỗ | sức chứa |
 *   | Bot dễ          |  5 nước | 0,8706 | 60%         |  3 lá    |
 *   | Bot bình thường | 17 nước | 0,9600 | 40%         |  5 lá    |
 *   | Bot Pro         | 26 nước | 0,9737 | 20%         |  8 lá    |
 *   | Bot siêu đẳng   | 38 nước | 0,9819 | 10%         | 14 lá    |
 *
 * NỬA ĐỜI TÍNH THEO NƯỚC CỦA CẢ VÁN, KHÔNG PHẢI LƯỢT CỦA BOT. Bot chỉ tồn tại
 * trong trận 1v1, nên nước của đối thủ cũng làm ký ức nó già đi: nửa đời 38 nước
 * chỉ là ~19 lượt của chính nó. Đây là lý do bộ số cũ (2-4-8-12) đo trên ván
 * chơi MỘT MÌNH thì trông ổn (77 lần lật, gần hoàn hảo) nhưng vào trận thật thì
 * mức đỉnh thắng 0% — thước đo sai. Cân bằng bot PHẢI đo bằng tỉ lệ thắng 1v1
 * (xem test/duel.test.ts), không đo bằng số lần lật khi chơi một mình.
 *
 * NHỊP NGHĨ GIỐNG NHAU Ở MỌI MỨC (400–3000ms) — có chủ đích. Cho bot giỏi nghĩ
 * nhanh hơn thì đếm thời gian là đoán ra mình đang đấu mức nào, mà độ khó vốn
 * nằm ở TRÍ NHỚ chứ không ở tốc độ. Bot dễ nghĩ lâu cũng chỉ làm người chơi chờ.
 */
export const THINK_MIN_MS = 400;
export const THINK_MAX_MS = 3000;

export const BOT_SPECS: Record<BotLevel, BotSpec> = {
  easy:   { retain: 0.8706, mistake: 0.60, capacity: 3, thinkMinMs: THINK_MIN_MS, thinkMaxMs: THINK_MAX_MS, name: 'Bot dễ',         avatar: '🐣' },
  normal: { retain: 0.9600, mistake: 0.40, capacity: 5, thinkMinMs: THINK_MIN_MS, thinkMaxMs: THINK_MAX_MS, name: 'Bot bình thường', avatar: '🤖' },
  hard:   { retain: 0.9737, mistake: 0.20, capacity: 8, thinkMinMs: THINK_MIN_MS, thinkMaxMs: THINK_MAX_MS, name: 'Bot Pro',         avatar: '👾' },
  insane: { retain: 0.9819, mistake: 0.10, capacity: 14, thinkMinMs: THINK_MIN_MS, thinkMaxMs: THINK_MAX_MS, name: 'Bot siêu đẳng',   avatar: '🦾' }
};

/**
 * Lần nghĩ này lâu bao nhiêu ms. Rút từ `rng` của bot nên vẫn TẤT ĐỊNH: cùng
 * seed thì cùng nhịp, test và replay không lệch.
 */
export function botThinkMs(
  level: BotLevel,
  rng: Rng,
  opts: { cardsLeft?: number; closing?: boolean } = {}
): number {
  const { cardsLeft = Infinity, closing = false } = opts;
  // Còn đúng một cặp thì không có gì để nghĩ — hai lá đó chắc chắn khớp nhau.
  // Ngồi "suy nghĩ" 3 giây trước một nước không thể sai là giả tạo lộ liễu.
  if (cardsLeft <= 2) return LAST_PAIR_MS;
  // Lá THỨ HAI của lượt: đã cân nhắc ở lá đầu rồi, lá này chỉ là hệ quả. Người
  // thật cũng vậy — đắn đo chỗ mở đầu, rồi lật lá kia rất nhanh. Nghĩ lâu cả
  // hai lá làm một lượt của bot dài tới 6 giây, người chơi ngồi không.
  if (closing) return Math.round(FOLLOW_MIN_MS + rng.next() * (FOLLOW_MAX_MS - FOLLOW_MIN_MS));
  const { thinkMinMs, thinkMaxMs } = BOT_SPECS[level];
  return Math.round(thinkMinMs + rng.next() * (thinkMaxMs - thinkMinMs));
}

/** Nước cuối: chỉ đủ để mắt kịp thấy con trỏ chuyển, không phải để "nghĩ". */
export const LAST_PAIR_MS = 300;
/** Lá thứ hai trong cùng một lượt. */
export const FOLLOW_MIN_MS = 250;
export const FOLLOW_MAX_MS = 800;

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
export function observe(memory: BotMemory, view: GameView, level: BotLevel): void {
  for (const c of view.cards) {
    if (c.state === 'matched') { memory.delete(c.index); continue; }
    if (c.state === 'up' && c.symbol) memory.set(c.index, { symbol: c.symbol, at: view.moves });
  }
  // Quên hẳn thứ quá cũ: xem FORGET_HALF_LIVES. Phải làm ở đây chứ không ở
  // recalls(), vì recalls() chỉ TRẢ LỜI có nhớ hay không, còn cái chiếm chỗ
  // trong đầu là bản ghi.
  const limit = FORGET_HALF_LIVES * halfLifeMoves(level);
  for (const [index, seen] of memory) {
    if (view.moves - seen.at > limit) memory.delete(index);
  }
}

/**
 * Mỗi lá phải nhớ VƯỢT sức chứa thì khả năng nhớ nhân thêm hệ số này. 0,96
 * nghĩa là quá tải 10 lá thì chỉ còn nhớ được 0,96^10 ≈ 66% so với lúc rảnh.
 *
 * Dùng CHUNG cho mọi mức, khác biệt nằm ở `capacity`: thêm một con số cho mỗi
 * mức là mỗi lần cân bằng phải nghĩ bốn số thay vì một.
 */
export const CROWD = 0.96;

/**
 * Bản ghi cũ hơn bấy nhiêu LẦN nửa đời thì bị xoá khỏi ký ức.
 *
 * Vì sao phải xoá chứ không để nguyên: cú "quên" ở `recalls()` chỉ tính cho nước
 * đang đi, bản ghi vẫn nằm đó và vẫn tính vào TẢI. Thành ra bot kém rơi vào vòng
 * xoáy — quên trước khi kịp ghép, bản ghi dồn lại, tải cao nên càng quên, càng
 * quên thì càng không ghép được. Người thật không thế: thứ đã quên hẳn thì rơi
 * khỏi đầu luôn, không làm mình nhiễu nữa.
 *
 * 3 lần nửa đời = khả năng nhớ còn 1/8, coi như đã mất hẳn.
 */
export const FORGET_HALF_LIVES = 3;

/** Nửa đời ký ức của một mức, tính bằng SỐ NƯỚC đi. */
export const halfLifeMoves = (level: BotLevel): number =>
  Math.log(0.5) / Math.log(BOT_SPECS[level].retain);

/**
 * Bot có còn nhớ lá này không. Ba thứ cùng làm nó quên:
 *  - thấy lâu rồi (`retain ** tuổi`) — phai dần theo diễn biến ván;
 *  - đang phải giữ quá nhiều lá (`CROWD ** quá tải`) — nhiễu do quá tải;
 *  - và bot giỏi thì cả hai đều nhẹ hơn.
 *
 * `load` là số lá đang phải nhớ (thẻ đã ghép bị xoá khỏi ký ức nên không tính).
 */
function recalls(
  seen: BotSeen, clock: number, level: BotLevel, rng: Rng, load: number
): boolean {
  const spec = BOT_SPECS[level];
  const age = Math.max(0, clock - seen.at);
  const crowd = Math.max(0, load - spec.capacity);
  return rng.next() < spec.retain ** age * CROWD ** crowd;
}

/** Những lá bot CÒN nhớ, trong số các ô đang úp. */
function recalled(
  memory: BotMemory, downSet: Set<number>, clock: number, level: BotLevel, rng: Rng
): Map<number, string> {
  const out = new Map<number, string>();
  // Tải tính trên các lá CÒN ÚP mà bot đang nhớ: lá đã ghép không còn chiếm
  // đầu nó nữa (observe() xoá), mà lá đang mở thì nhìn thấy chứ không phải nhớ.
  const load = [...memory.keys()].filter((i) => downSet.has(i)).length;
  for (const [index, seen] of memory) {
    if (!downSet.has(index)) continue;
    if (recalls(seen, clock, level, rng, load)) out.set(index, seen.symbol);
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
