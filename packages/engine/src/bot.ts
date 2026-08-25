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
  /** Điểm trình độ 1..10 — nguồn của mọi tham số bên dưới. */
  skill: number;
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
 * MỖI MỨC CHỈ MỘT CON SỐ: `skill` từ 1 tới 10. Mọi tham số khác suy ra từ nó.
 *
 * Vì sao: trước đây mỗi mức có 3 con số rời (nửa đời, nhớ lẫn chỗ, sức chứa) và
 * chúng tương tác nhau, nên chỉnh một cái là phải đo lại cả ba — thêm một mức
 * mới thì phải cân từ đầu. Giờ thêm mức chỉ cần chọn một số.
 *
 * Thang `skill` neo theo TỈ LỆ THẮNG trước người chơi khá trên bàn 42 thẻ, vì đó
 * là thứ người chơi cảm nhận được: skill 1 ≈ thắng 1/10 ván, skill 10 ≈ thắng 9/10.
 * Ba hằng số dưới đây được DÒ bằng `duel-helper`, không phải đặt cho đẹp.
 */
export const SKILL_MIN = 1;
export const SKILL_MAX = 10;

/**
 * Nửa đời ký ức (số nước) cho skill 1..10 — BẢNG NEO, không phải công thức.
 *
 * Vì sao bảng: tỉ lệ thắng KHÔNG tuyến tính theo trí nhớ. Có một ngưỡng ở quãng
 * 14→17 nước, chỗ ký ức bắt đầu sống sót qua một lượt quét hết bàn 42 thẻ — dưới
 * ngưỡng bot thắng ~20%, trên ngưỡng vọt lên ~63%. Công thức trơn nào cũng đi
 * qua ngưỡng đó một cách khó kiểm soát; bảng thì đặt được từng bậc đúng chỗ.
 *
 * Đo bằng `duel-helper`, 40 ván mỗi điểm, đối thủ KHÁ, bàn 6×7:
 *   skill 1 → 5%   ·  2 → 10%  ·  4 → 20%  ·  6 → 63%  ·  8 → 78%  ·  10 → 88%
 * Sửa bảng thì PHẢI đo lại, đừng đoán.
 */
const HALF_LIFE_BY_SKILL = [3, 9, 12, 14, 15, 17, 20, 24, 29, 34] as const;

const halfLifeFor = (skill: number): number => {
  const i = Math.round(skill) - SKILL_MIN;
  return HALF_LIFE_BY_SKILL[Math.min(HALF_LIFE_BY_SKILL.length - 1, Math.max(0, i))]!;
};
/** Nhớ lẫn chỗ: giảm thẳng từ 45% ở skill 1 xuống 0 ở skill 10. */
const mistakeFor = (skill: number): number =>
  Math.max(0, 0.45 * (1 - (skill - SKILL_MIN) / (SKILL_MAX - SKILL_MIN)));
/** Sức chứa (số lá giữ được mà chưa bị nhiễu) theo skill. */
const capacityFor = (skill: number): number => Math.round(2 + skill * 1.2);

/** Dựng tham số đầy đủ từ MỘT con số. */
export function specFrom(skill: number, name: string, avatar: string): BotSpec {
  const s = Math.min(SKILL_MAX, Math.max(SKILL_MIN, skill));
  return {
    skill: s,
    retain: 0.5 ** (1 / halfLifeFor(s)),
    mistake: mistakeFor(s),
    capacity: capacityFor(s),
    thinkMinMs: THINK_MIN_MS,
    thinkMaxMs: THINK_MAX_MS,
    name,
    avatar
  };
}

export const THINK_MIN_MS = 400;
export const THINK_MAX_MS = 3000;

/** Điểm trình độ của bốn mức — CHỖ DUY NHẤT cần sửa khi muốn bot mạnh/yếu đi. */
export const BOT_SKILL: Record<BotLevel, number> = {
  easy: 1,
  normal: 2,
  hard: 6,
  insane: 10
};

export const BOT_SPECS: Record<BotLevel, BotSpec> = {
  easy: specFrom(BOT_SKILL.easy, 'Bot dễ', '🐣'),
  normal: specFrom(BOT_SKILL.normal, 'Bot bình thường', '🤖'),
  hard: specFrom(BOT_SKILL.hard, 'Bot Pro', '👾'),
  insane: specFrom(BOT_SKILL.insane, 'Bot siêu đẳng', '🦾')
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
