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

/** Mỗi màn thêm ĐÚNG 2 thẻ: màn 1 có 2 cặp, màn cuối có 50 cặp. Tăng đều như
 *  vậy thì độ khó lên từ tốn và người chơi luôn thấy màn sau khác màn trước —
 *  thang cũ gộp ba màn liền vào cùng một cỡ bàn nên chơi thấy lặp. */
export const CAMPAIGN_LEVELS = 50;
/** Cạnh bàn lớn nhất. 10×10 = 100 thẻ; hơn nữa thì trên điện thoại mỗi thẻ
 *  không còn đủ 44px để bấm. */
const MAX_SIDE = 10;
/** Bàn không dài quá mức này (rows/cols) — dài hơn thì thành một dải, khó nhớ
 *  vị trí và cũng khó nhìn trên cột app dọc. */
const MAX_RATIO = 1.75;

/** Màn N có đúng N cặp: màn 1 là màn tập 2 thẻ (dạy động tác lật), màn 50 là
 *  bàn 10×10 kín 100 thẻ. Nhờ vậy tròn 50 màn mà vẫn đúng "mỗi màn +2 thẻ". */
export const pairsForLevel = (id: number): number => id;
/** Số cặp lớn nhất chiến dịch đòi (màn cuối) — UI dùng để cảnh báo trước khi
 *  người chơi lao vào màn mà bộ theme đang chọn không đủ biểu tượng. */
export const CAMPAIGN_MAX_PAIRS = pairsForLevel(CAMPAIGN_LEVELS);

/**
 * Chọn bàn cho một số cặp cho trước. Số thẻ chẵn nhưng không phải số nào cũng
 * chia thành lưới chữ nhật đầy, nên bàn được phép có vài Ô TRỐNG — miễn chúng
 * nằm gọn trong một hàng để bố cục vẫn cân.
 *
 * Ưu tiên: ít ô trống nhất → tỷ lệ gần 1,3 (dáng khung dọc) → bàn nhỏ hơn.
 */
export function gridForPairs(pairs: number): { cols: number; rows: number } {
  // Màn tập: hai thẻ cạnh nhau. Vòng lặp dưới đòi cols >= 2 và cols <= rows nên
  // không sinh được bàn 1 cặp nào coi được (2×2 thì hai ô trống trên bốn ô).
  if (pairs === 1) return { cols: 2, rows: 1 };
  let best: { cols: number; rows: number; key: [number, number, number] } | null = null;
  const need = pairs * 2;
  for (let cols = 2; cols <= MAX_SIDE; cols++) {
    for (let rows = cols; rows <= MAX_SIDE; rows++) {
      const total = cols * rows;
      if (total < need) continue;
      const waste = total - need;
      if (waste > cols - 1) continue;          // ô trống phải gọn trong một hàng
      if (rows / cols > MAX_RATIO) continue;
      const key: [number, number, number] = [waste, Math.abs(rows / cols - 1.3), total];
      if (!best || key < best.key) best = { cols, rows, key };
    }
  }
  if (!best) throw new Error(`Không xếp được bàn cho ${pairs} cặp`);
  return { cols: best.cols, rows: best.rows };
}

/** Điểm tối đa lý thuyết: ghép đúng liên tiếp toàn bộ, không lật sai. */
export function perfectScore(pairs: number): number {
  let total = 0;
  for (let s = 1; s <= pairs; s++) total += pairScore(s, false);
  return total;
}

export function levelSpec(id: number): Level {
  // Phải chặn cả số lẻ và NaN: số màn giờ do CLIENT gửi lên (mọi chế độ đều
  // chọn màn), mà client không đáng tin — ON-09.
  if (!Number.isInteger(id) || id < 1 || id > CAMPAIGN_LEVELS) {
    throw new Error(`Màn ${id} không tồn tại`);
  }

  const pairs = pairsForLevel(id);
  const { cols, rows } = gridForPairs(pairs);

  // Thời gian nới theo số cặp nhưng siết theo bước nguyên 2 giây mỗi màn,
  // để hai màn cùng bậc lưới không bao giờ có cùng giới hạn (làm tròn dễ gây trùng)
  const timeLimit = Math.max(pairs * 4, pairs * 9 - (id - 1) * 2);

  // Nửa sau chiến dịch siết sao: cùng một bàn nhưng đòi chơi sạch hơn mới đủ sao
  const hard = id > CAMPAIGN_LEVELS / 2;
  const perfect = perfectScore(pairs);
  return {
    id, cols, rows, pairs, timeLimit,
    specialRate: id >= 3 ? Math.min(0.2, 0.1 + (id - 3) * 0.005) : 0,   // bật từ màn 3 (mục 3.4)
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
