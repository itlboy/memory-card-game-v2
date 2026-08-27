import { levelSpec } from './campaign.js';
import type { GameConfig } from './types.js';

/**
 * TUỲ CHỌN BÀN CHƠI — thay cho bốn "chế độ" cũ.
 *
 * Bốn chế độ trước đây không phải bốn trò chơi khác nhau, chúng chỉ là bốn tổ
 * hợp cờ trong cùng một engine (`presetConfig` mỗi chế độ đúng một dòng). Gộp
 * lại thành năm công tắc thì bật cái nào cũng được, kể cả cả năm cùng lúc — và
 * mở ra những tổ hợp mô hình cũ chặn mất, ví dụ xem trước 3 giây + ít mạng +
 * đồng hồ gắt.
 *
 * MỌI con số ở đây LÀM TRÒN LÊN số nguyên: người chơi không bao giờ phải đọc
 * "6,4 giây". Thời gian còn tròn lên bội số 5 giây cho ra số chẵn trên đồng hồ.
 */

/** Mức của một tuỳ chọn: 0 = tắt, 1..3 = tăng dần. */
export type OptLevel = 0 | 1 | 2 | 3;

export interface BoardOptions {
  /** Đồng hồ ván: 0 vô hạn · 1 thong thả · 2 bình thường · 3 nhanh. */
  time: OptLevel;
  /** Số mạng: 0 vô hạn · 1 nhiều · 2 bình thường · 3 ít. */
  lives: OptLevel;
  /** Hé cả bàn đầu ván: 0 không · 1 ngắn · 2 bình thường · 3 lâu. */
  peek: OptLevel;
  /** Xáo thẻ giữa ván: 0 không · 1 ít · 2 bình thường · 3 nhiều. */
  shuffle: OptLevel;
  /** Thẻ đặc biệt: 0 không · 1 ít · 2 bình thường · 3 nhiều. */
  special: OptLevel;
}

export const OPTION_KEYS = ['time', 'lives', 'peek', 'shuffle', 'special'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/**
 * Mặc định = MỨC 1 ở cả năm hàng: mọi tính năng đều BẬT nhưng ở nấc nhẹ nhất.
 *
 * Chọn đồng đều mức 1 chứ không phải "tắt hết" hay "mỗi hàng một kiểu": bật
 * nhẹ thì người chơi lần đầu GẶP được cả năm luật (kể cả xáo thẻ và thẻ đặc
 * biệt — trước đây mặc định tắt nên gần như không ai thấy chúng tồn tại), mà
 * vẫn là nấc dễ thở nhất. Ai không thích hàng nào thì hạ về 0, và lựa chọn đó
 * được LƯU lại cho lần sau (xem `prefs` trong apps/web/src/lib/storage.ts) —
 * mặc định này chỉ áp cho người chơi mới.
 */
export const DEFAULT_OPTIONS: BoardOptions = {
  time: 1, lives: 1, peek: 1, shuffle: 1, special: 1
};

/**
 * Nhãn trên nút, theo thứ tự 0..3.
 *
 * Mức giữa là "Vừa" chứ không phải "Bình thường": đo trên iPhone SE (375px) thì
 * bốn nút chia nhau 73px mỗi cái, mà "Bình thường" ở cỡ chữ 11px cần 74px — bị
 * cắt thành "Bình thườ…". Nghĩa vẫn y nguyên, chỉ ngắn hơn một chữ.
 */
export const OPTION_LABELS: Record<OptionKey, readonly [string, string, string, string]> = {
  time: ['Vô hạn', 'Thong thả', 'Vừa', 'Nhanh'],
  lives: ['Vô hạn', 'Nhiều', 'Vừa', 'Ít'],
  peek: ['Không', 'Ngắn', 'Vừa', 'Lâu'],
  shuffle: ['Không', 'Ít', 'Vừa', 'Nhiều'],
  special: ['Không', 'Ít', 'Vừa', 'Nhiều']
} as const;

const ceilTo = (x: number, buoc: number): number => Math.ceil(x / buoc) * buoc;

/**
 * Thời gian gốc của một bàn NGOÀI Chiến dịch: 9 giây mỗi cặp, không hơn không
 * kém.
 *
 * Không dùng `levelSpec().timeLimit` nữa vì con số đó còn trừ 2 giây mỗi cấp —
 * đó là cách Chiến dịch làm khó dần trong cùng một cỡ bàn. Ngoài Chiến dịch,
 * cấp không còn là độ khó (chỉ là cỡ bàn), nên mang phần siết đó theo thì hai
 * bàn cùng số thẻ lại có đồng hồ khác nhau mà không gì trên màn hình giải thích.
 */
export const baseTimeLimit = (pairs: number): number => pairs * 9;

/**
 * BẢNG MẠNG — neo theo TỈ LỆ SỐNG SÓT, không phải chia số thẻ cho một hằng số.
 *
 * Vì sao không dùng công thức: cho bot mức "thường" chơi trọn ván 120 lần mỗi cỡ
 * bàn rồi đếm số lần lật sai đáng trách, ra kết quả số lần trượt tăng theo BÌNH
 * PHƯƠNG số thẻ chứ không tuyến tính — bàn 12 thẻ trượt 2 lần, bàn 42 thẻ trượt
 * 40 lần. Chia `thẻ/2 · /4 · /8` thì bàn 4–6 thẻ mức nào cũng không chết nổi,
 * còn bàn 42 thẻ mức nào cũng chết chắc: ba mức thôi không còn là ba mức.
 *
 * Ba cột dưới là số mạng để người chơi mức "thường" đi hết bàn với xác suất
 * 90% · 60% · 30%. Đo lại khi đổi luật mất mạng hoặc đổi bot.
 */
const BANG_MANG: readonly { the: number; mang: readonly [number, number, number] }[] = [
  { the: 4,  mang: [1, 1, 1] },
  { the: 6,  mang: [1, 1, 1] },
  { the: 12, mang: [4, 2, 1] },
  { the: 16, mang: [5, 3, 2] },
  { the: 20, mang: [10, 5, 4] },
  { the: 24, mang: [15, 8, 6] },
  { the: 30, mang: [23, 14, 10] },
  { the: 36, mang: [39, 25, 17] },
  { the: 42, mang: [56, 40, 28] }
];

/**
 * Số mạng cho một cỡ bàn. Cỡ bàn nào cũng nằm trong bảng (thang cấp chỉ có 9 cỡ),
 * nhưng vẫn có đường lui: bàn lạ thì suy từ `thẻ²/45` — công thức khớp gần đúng
 * cột giữa của bảng đo.
 */
export function livesFor(the: number, muc: 1 | 2 | 3): number {
  const hang = BANG_MANG.find((r) => r.the === the);
  if (hang) return hang.mang[muc - 1]!;
  const vua = Math.ceil((the * the) / 45);
  const heSo = muc === 1 ? 1.5 : muc === 2 ? 1 : 0.7;
  return Math.max(1, Math.ceil(vua * heSo));
}

/**
 * Giây hé bàn đầu ván. `2 + thẻ/k`: 2 giây cố định là phần "nhìn thấy cả bàn",
 * phần chia là phần "đọc từng thẻ". Thiếu 2 giây đó thì bàn 4 thẻ chỉ được 1
 * giây — mắt chưa kịp quét xong.
 */
export function peekSecondsFor(the: number, muc: 1 | 2 | 3): number {
  const chia = muc === 1 ? 6 : muc === 2 ? 4 : 2.5;
  return Math.ceil(2 + the / chia);
}

/**
 * Số lần xáo thẻ trong cả ván, trải đều.
 *
 * `thẻ/16 · /9 · /5` chứ không phải `/12 · /8 · /5`: bảng cũ cho bàn 16 thẻ ra
 * 2 · 2 · 4 — "ít" và "bình thường" bằng nhau, mất một mức.
 */
export function shuffleCountFor(the: number, muc: 1 | 2 | 3): number {
  const chia = muc === 1 ? 16 : muc === 2 ? 9 : 5;
  return Math.max(1, Math.ceil(the / chia));
}

/**
 * Số THẺ mang hiệu ứng đặc biệt.
 *
 * Đơn vị là THẺ chứ không phải cặp: hiệu ứng chỉ gắn trên MỘT thẻ của cặp (xem
 * `carrier` trong deck.ts), nên một "cặp đặc biệt" thật ra là đúng một thẻ có
 * huy hiệu trên bàn. Nói "1 cặp" là nói sai với thứ người chơi đếm được.
 *
 * Trần thật nằm ở deck.ts: mỗi loại tối đa 2 lần, nên nhiều nhất 10 thẻ (chơi
 * đơn 8 vì không có Đóng băng).
 */
export function specialCardsFor(cap: number, muc: 1 | 2 | 3): number {
  const chia = muc === 1 ? 8 : muc === 2 ? 5 : 3;
  return Math.max(1, Math.ceil(cap / chia));
}

/** Đọc một tuỳ chọn về đúng khoảng 0..3 — dữ liệu từ URL/mạng không đáng tin. */
export const clampOpt = (v: unknown): OptLevel => {
  const n = Math.trunc(Number(v));
  return (Number.isFinite(n) && n >= 0 && n <= 3 ? n : 0) as OptLevel;
};

/** Lọc cả bộ tuỳ chọn về khoảng hợp lệ; thiếu trường nào thì lấy mặc định. */
export function sanitizeOptions(raw: Partial<Record<OptionKey, unknown>> | null | undefined): BoardOptions {
  const out = { ...DEFAULT_OPTIONS };
  if (!raw) return out;
  for (const k of OPTION_KEYS) if (raw[k] !== undefined) out[k] = clampOpt(raw[k]);
  return out;
}

export interface BuildInput {
  options: BoardOptions;
  /** Cấp (1..CAMPAIGN_LEVELS) — quyết định cỡ bàn và mốc thời gian gốc. */
  level: number;
  symbols: readonly string[];
  seed: number;
  players?: GameConfig['players'];
}

/**
 * Dựng cấu hình một ván từ (tuỳ chọn, cấp). Đây là chỗ DUY NHẤT biến năm mức
 * 0..3 thành con số thật, nên client, server và test đều đọc cùng một luật.
 */
export function configFromOptions({ options, level, symbols, seed, players }: BuildInput): GameConfig {
  const spec = levelSpec(level);
  const the = spec.pairs * 2;
  const goc = baseTimeLimit(spec.pairs);

  const cfg: GameConfig = {
    // `mode` chỉ còn là KHOÁ LƯU (kỷ lục, thành tích, tiến độ) — không còn luật
    // chơi nào đọc nó nữa kể từ khi bỏ phạt điểm lật sai.
    mode: 'classic',
    cols: spec.cols, rows: spec.rows, pairs: spec.pairs,
    symbols, seed, players
  };
  if ((players?.length ?? 1) > 1) cfg.turnLimit = 15;

  if (options.time > 0) {
    const heSo = options.time === 1 ? 1.5 : options.time === 2 ? 1 : 0.7;
    // Tròn lên bội số 5 giây: 1:05 dễ đọc hơn 1:02, mà chênh lệch không đáng kể
    cfg.timeLimit = ceilTo(goc * heSo, 5);
  }
  if (options.lives > 0) cfg.lives = livesFor(the, options.lives as 1 | 2 | 3);
  if (options.peek > 0) cfg.peekMs = peekSecondsFor(the, options.peek as 1 | 2 | 3) * 1000;
  if (options.shuffle > 0) cfg.shuffleCount = shuffleCountFor(the, options.shuffle as 1 | 2 | 3);
  if (options.special > 0) {
    cfg.specialRate = specialCardsFor(spec.pairs, options.special as 1 | 2 | 3) / spec.pairs;
  }
  return cfg;
}

/** Mô tả một tuỳ chọn thành chữ cho HUD/lobby: `null` = đang tắt, không hiện. */
export function optionSummary(key: OptionKey, muc: OptLevel, level: number): string | null {
  if (muc === 0) return null;
  const spec = levelSpec(level);
  const the = spec.pairs * 2;
  switch (key) {
    case 'time': {
      const heSo = muc === 1 ? 1.5 : muc === 2 ? 1 : 0.7;
      const giay = ceilTo(baseTimeLimit(spec.pairs) * heSo, 5);
      return `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, '0')}`;
    }
    case 'lives':   return `${livesFor(the, muc as 1 | 2 | 3)} mạng`;
    case 'peek':    return `${peekSecondsFor(the, muc as 1 | 2 | 3)} giây`;
    case 'shuffle': return `xáo ${shuffleCountFor(the, muc as 1 | 2 | 3)} lần`;
    case 'special': return `${specialCardsFor(spec.pairs, muc as 1 | 2 | 3)} thẻ`;
  }
}
