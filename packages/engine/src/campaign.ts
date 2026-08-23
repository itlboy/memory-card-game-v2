import { pairScore } from './scoring.js';
import type { GameConfig } from './types.js';

export interface Level {
  /** Số màn, bắt đầu từ 1. */
  id: number;
  cols: number;
  rows: number;
  /** Số cặp thật của màn. KHÔNG suy ra từ cols×rows/2 được: bàn có thể chừa
   *  vài ô trống để số thẻ tăng đúng 2 mỗi màn. */
  pairs: number;
  timeLimit: number;
  /** Tỉ lệ cặp đặc biệt (0 nếu màn chưa bật). */
  specialRate: number;
  starThresholds: [number, number];
}

/**
 * Thang cấp dựng từ một BẢNG BÀN cố định, không tính ra từ số cặp nữa.
 *
 * Ba điều kiện phải cùng đúng, và chỉ một tập bàn hữu hạn thoả được cả ba:
 *
 * 1. Bàn ĐẦY — không ô trống nào. Nghĩa là cols × rows phải đúng bằng số thẻ.
 *    Đây là chỗ luật "mỗi cấp +2 thẻ" chết: 10 thẻ chỉ chia được thành 2×5,
 *    14 thẻ chỉ 2×7, 22 thẻ chỉ 2×11… vì số thẻ là 2 lần một số nguyên tố.
 *    Nên 8 mức cặp KHÔNG tồn tại bàn đầy nào dùng được, và thang cấp bỏ chúng.
 * 2. Tỷ lệ cân — rows/cols ≤ 2. Bàn 2×5 là một dải dài ngoẵng, nhớ vị trí gần
 *    như bất khả trên khung dọc.
 * 3. Lá bài không dưới 44px (NF-07) trên máy NHỎ NHẤT. Đo thật trên iPhone SE
 *    (chỗ trống của bàn 351×510): bàn 42 thẻ cho lá 51px, 48 thẻ chỉ còn 44px
 *    sát đáy, còn 50 thẻ (5×10) tụt xuống 34px — dưới ngưỡng chạm. Vì vậy trần
 *    là 42 thẻ, không phải 50.
 * 4. Bàn phải LẤP được chỗ trống, không hở hai bên. Bàn cao hơn vùng bàn thì
 *    chiều cao chạm trần trước và bề rộng thừa ra thành hai dải trống. Đo thật
 *    trên iPhone SE: bàn 2×4 chỉ dùng 72% diện tích, bàn 4×7 dùng 82% — nên hai
 *    cỡ đó bị loại dù thoả ba điều kiện trên. Chín cỡ còn lại dùng 99,6% diện
 *    tích, tệ nhất 96%. Đổi lại: số thẻ nhảy 6→12 và 24→30 chứ không tăng đều.
 *
 * `levels` là số cấp mỗi cỡ bàn giữ. Cỡ nhỏ giữ ít cấp để mở đầu đi nhanh, cỡ
 * lớn giữ nhiều cấp để phần cuối có chiều sâu. Trong cùng một cỡ bàn, cấp sau
 * vẫn khó hơn cấp trước vì thời gian siết dần (xem timeLimit).
 */
const BOARDS: readonly { cols: number; rows: number; levels: number }[] = [
  { cols: 2, rows: 2, levels: 1 },    //  4 thẻ
  { cols: 2, rows: 3, levels: 1 },    //  6 thẻ
  { cols: 3, rows: 4, levels: 3 },    // 12 thẻ
  { cols: 4, rows: 4, levels: 4 },    // 16 thẻ
  { cols: 4, rows: 5, levels: 5 },    // 20 thẻ
  { cols: 4, rows: 6, levels: 6 },    // 24 thẻ
  { cols: 5, rows: 6, levels: 7 },    // 30 thẻ
  { cols: 6, rows: 6, levels: 10 },   // 36 thẻ
  { cols: 6, rows: 7, levels: 13 }    // 42 thẻ
];

/** Bàn của từng cấp, trải phẳng từ BOARDS. Cấp 1 nằm ở chỉ số 0. */
const LADDER: readonly { cols: number; rows: number; pairs: number }[] =
  BOARDS.flatMap((b) =>
    Array.from({ length: b.levels }, () => ({
      cols: b.cols, rows: b.rows, pairs: (b.cols * b.rows) / 2
    }))
  );

export const CAMPAIGN_LEVELS = LADDER.length;

/** Số cặp của một cấp. */
export const pairsForLevel = (id: number): number => boardForLevel(id).pairs;

/** Số cặp lớn nhất chiến dịch đòi (cấp cuối) — UI dùng để cảnh báo trước khi
 *  người chơi lao vào cấp mà bộ theme đang chọn không đủ biểu tượng. */
export const CAMPAIGN_MAX_PAIRS = Math.max(...LADDER.map((l) => l.pairs));

/** Bàn của một cấp. Ném lỗi với số cấp rác — số cấp đến từ CLIENT (ON-09). */
export function boardForLevel(id: number): { cols: number; rows: number; pairs: number } {
  if (!Number.isInteger(id) || id < 1 || id > LADDER.length) {
    throw new Error(`Màn ${id} không tồn tại`);
  }
  return LADDER[id - 1]!;
}

/** Điểm tối đa lý thuyết: ghép đúng liên tiếp toàn bộ, không lật sai. */
export function perfectScore(pairs: number): number {
  let total = 0;
  for (let s = 1; s <= pairs; s++) total += pairScore(s, false);
  return total;
}

/**
 * Bốn chặng của thang cấp. Chia chặng để bản đồ 50 cấp không còn là một lưới
 * 50 ô giống nhau: mỗi chặng là một thẻ có tên, có tiến độ riêng, cuộn ngắn
 * hẳn và người chơi thấy mình đang đi qua từng chương.
 *
 * Cỡ chặng đều là bội của 5 để lưới 5 cột luôn TRÒN HÀNG (không ô lẻ ở hàng
 * cuối). Ranh chặng 2 đặt đúng ở cấp 25 — chỗ bàn cán trần 50 thẻ, từ đó độ
 * khó chuyển sang siết thời gian.
 */
export interface Chapter { id: number; name: string; from: number; to: number }
export const CHAPTERS: readonly Chapter[] = [
  { id: 1, name: 'Nhập môn',   from: 1,  to: 10 },
  { id: 2, name: 'Tăng tốc',   from: 11, to: 25 },
  { id: 3, name: 'Thử thách',  from: 26, to: 35 },
  { id: 4, name: 'Bậc thầy',   from: 36, to: 50 }
];

export function levelSpec(id: number): Level {
  const { cols, rows, pairs } = boardForLevel(id);

  // Mốc 9 giây mỗi cặp, siết ĐÚNG 2 giây mỗi cấp, sàn 3 giây mỗi cặp. Bước phải
  // là số nguyên giây: siết theo tỷ lệ (0,1 giây mỗi cặp) thì ở bàn nhỏ mỗi cấp
  // chỉ giảm 0,4 giây, làm tròn xong hai cấp liền nhau ra cùng một con số —
  // cấp sau không khó hơn cấp trước nữa. Đây là thứ DUY NHẤT phân biệt các cấp
  // dùng chung một cỡ bàn (xem BOARDS).
  const timeLimit = Math.max(pairs * 3, pairs * 9 - (id - 1) * 2);

  // Nửa sau chiến dịch siết sao: cùng một bàn nhưng đòi chơi sạch hơn mới đủ sao
  const hard = id > CAMPAIGN_LEVELS / 2;
  const perfect = perfectScore(pairs);
  // Thẻ đặc biệt bật từ cấp 3 (mục 3.4), dày dần tới trần 30%.
  const specialRate = id < 3 ? 0 : Math.min(0.3, 0.1 + (id - 3) * 0.0045);
  return {
    id, cols, rows, pairs, timeLimit, specialRate,
    starThresholds: hard
      ? [Math.round(perfect * 0.62), Math.round(perfect * 0.85)]
      : [Math.round(perfect * 0.55), Math.round(perfect * 0.8)]
  };
}

export const allLevels = (): Level[] =>
  Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => levelSpec(i + 1));

/** Dựng cấu hình ván từ một màn Campaign. */
export function levelConfig(level: Level, symbols: readonly string[], seed: number): GameConfig {
  return {
    mode: 'campaign',
    cols: level.cols,
    rows: level.rows,
    pairs: level.pairs,
    symbols,
    seed,
    timeLimit: level.timeLimit,
    specialRate: level.specialRate,
    starThresholds: level.starThresholds
  };
}
