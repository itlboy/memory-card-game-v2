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
  /** Nửa đời ký ức, tính bằng SỐ NƯỚC ĐI — con số duy nhất quyết định độ khó. */
  halfLife: number;
  /**
   * Tỉ lệ CÒN NHỚ sau mỗi nước đi, suy từ `halfLife`. 0,9 nghĩa là qua mỗi nước,
   * khả năng nhớ một lá còn 90% so với trước — nhớ mờ dần đúng như người thật,
   * chứ không phải nhớ tuyệt đối rồi đột ngột quên hẳn.
   */
  retain: number;
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
 * MỖI MỨC CHỈ MỘT CON SỐ: nửa đời ký ức, tính bằng số nước đi.
 *
 * Trước đây có ba tham số: `retain` (phai theo thời gian), `mistake` (nhớ lẫn
 * chỗ ngay lúc vừa thấy) và `capacity` + `CROWD` (nhiễu do quá tải). Chúng
 * TƯƠNG TÁC nhau nên chỉnh một cái là phải đo lại cả ba — và hai cái sau chỉ
 * làm cùng một việc theo đường khác: khiến bot quên. Bỏ chúng đi thì độ khó chỉ
 * còn một trục, đọc ra ngay từ con số.
 *
 * Cái mất: `capacity` từng làm độ khó GIÃN THEO CỠ BÀN (bot yếu tệ hẳn trên bàn
 * lớn vì phải nhớ nhiều). Không có nó, chênh lệch giữa các mức trên bàn nhỏ hẹp
 * lại — đo được ở duel.test.ts.
 *
 * Đổi bảng này thì PHẢI đo lại bằng `duel-helper`, đừng đoán: tỉ lệ thắng không
 * tuyến tính theo trí nhớ, có một ngưỡng ở quãng nửa đời 8→13 nước (chỗ ký ức
 * bắt đầu sống sót qua một lượt quét hết bàn 42 thẻ) — dưới ngưỡng bot thắng
 * ~43%, trên ngưỡng vọt lên ~68%.
 *
 * SIÊU ĐẲNG LÀ 20, KHÔNG PHẢI 15: đo được nửa đời 15 cho 55/53/75 (bàn 12/24/42
 * thẻ) trong khi Pro ở nửa đời 12 cho 55/53/70 — hai mức cao nhất BẰNG NHAU ở
 * bàn nhỏ và vừa, chỉ chênh 5 điểm ở bàn lớn, tức người chơi không phân biệt
 * được. Đường tỉ lệ thắng bão hoà ở quãng 12→15 rồi mới dựng lại từ 18. Nới lên
 * 20 thì ra 57/63/88, tách rõ ở cả ba cỡ bàn.
 */
export const BOT_HALF_LIFE: Record<BotLevel, number> = {
  easy: 3,
  normal: 6,
  hard: 12,
  insane: 20
};

/** Dựng tham số đầy đủ từ MỘT con số. */
export function specFrom(halfLife: number, name: string, avatar: string): BotSpec {
  const h = Math.max(1, halfLife);
  return {
    halfLife: h,
    retain: 0.5 ** (1 / h),
    thinkMinMs: THINK_MIN_MS,
    thinkMaxMs: THINK_MAX_MS,
    name,
    avatar
  };
}

export const THINK_MIN_MS = 400;
export const THINK_MAX_MS = 3000;

export const BOT_SPECS: Record<BotLevel, BotSpec> = {
  easy: specFrom(BOT_HALF_LIFE.easy, 'Bot dễ', '🐣'),
  normal: specFrom(BOT_HALF_LIFE.normal, 'Bot bình thường', '🤖'),
  hard: specFrom(BOT_HALF_LIFE.hard, 'Bot Pro', '👾'),
  insane: specFrom(BOT_HALF_LIFE.insane, 'Bot siêu đẳng', '🦾')
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
export const halfLifeMoves = (level: BotLevel): number => BOT_SPECS[level].halfLife;

/**
 * Bot có còn nhớ lá này không — chỉ một thứ làm nó quên: thấy lâu rồi.
 * `retain ** tuổi`, tuổi tính bằng số nước đi kể từ lúc nhìn thấy.
 */
function recalls(seen: BotSeen, clock: number, level: BotLevel, rng: Rng): boolean {
  const age = Math.max(0, clock - seen.at);
  return rng.next() < BOT_SPECS[level].retain ** age;
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

  // 2. Ký ức có cặp sẵn thì lật cặp đó. Không còn cửa "nhớ lẫn chỗ": nhớ được
  // là ghép đúng, còn sai thì phải do QUÊN — một trục độ khó duy nhất.
  const pair = knownPair(known);
  if (pair) return pair[0]!;

  // 3. Học lá mới
  const fresh = down.filter((i) => !memory.has(i));
  return (fresh.length ? rng.sample(fresh, 1) : rng.sample(down, 1))[0]!;
}

/** Rng riêng cho bot: dùng chung dòng số với bàn thẻ thì lật một lá là lệch cả deck. */
export const botRng = (seed: number): Rng => new Rng((seed ^ 0x5bf03635) >>> 0);
