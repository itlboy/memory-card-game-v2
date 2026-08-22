import { pairScore } from './scoring.js';
import type { GameConfig } from './types.js';

export interface Level {
  /** Số màn, bắt đầu từ 1. */
  id: number;
  cols: number;
  rows: number;
  timeLimit: number;
  /** Tỉ lệ cặp đặc biệt (0 nếu màn chưa bật). */
  specialRate: number;
  starThresholds: [number, number];
}

/** Kích thước lưới tăng dần qua các màn — vào ván từ 2×2 cho người mới (mục 3.1).
 *  Lưới lẻ ô (3×3) có ô trống ở giữa. */
const GRID_LADDER: readonly [number, number][] = [
  [2, 2], [3, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 6], [6, 8]
];

export const CAMPAIGN_LEVELS = 20;

/** Điểm tối đa lý thuyết: ghép đúng liên tiếp toàn bộ, không lật sai. */
export function perfectScore(pairs: number): number {
  let total = 0;
  for (let s = 1; s <= pairs; s++) total += pairScore(s, false);
  return total;
}

export function levelSpec(id: number): Level {
  if (id < 1 || id > CAMPAIGN_LEVELS) throw new Error(`Màn ${id} không tồn tại`);

  // Trải 20 màn lên 6 bậc lưới, mỗi bậc giữ vài màn
  const step = Math.min(GRID_LADDER.length - 1, Math.floor(((id - 1) * GRID_LADDER.length) / CAMPAIGN_LEVELS));
  const [cols, rows] = GRID_LADDER[step]!;
  const pairs = Math.floor((cols * rows) / 2);

  // Thời gian nới theo số cặp nhưng siết theo bước nguyên 2 giây mỗi màn,
  // để hai màn cùng bậc lưới không bao giờ có cùng giới hạn (làm tròn dễ gây trùng)
  const timeLimit = Math.max(pairs * 4, pairs * 9 - (id - 1) * 2);

  const perfect = perfectScore(pairs);
  return {
    id, cols, rows, timeLimit,
    specialRate: id >= 3 ? Math.min(0.15, 0.1 + (id - 3) * 0.005) : 0,   // bật từ màn 3 (mục 3.4)
    starThresholds: [Math.round(perfect * 0.55), Math.round(perfect * 0.8)]
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
    symbols,
    seed,
    timeLimit: level.timeLimit,
    specialRate: level.specialRate,
    starThresholds: level.starThresholds
  };
}
