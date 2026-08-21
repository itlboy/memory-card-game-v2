/** Công thức điểm — mục 3.5 của SRS. Tách riêng để test khoá được hành vi. */

export const BASE_POINTS = 100;
export const MISS_PENALTY = 10;
export const TIME_BONUS_PER_SEC = 5;
export const FLIP_BACK_MS = 1000;
/** Ghép đúng được cộng thêm vào đồng hồ lượt (multiplayer), không vượt trần TURN_LIMIT. */
export const TURN_BONUS_MS = 5_000;

/** Hệ số combo theo chuỗi ghép đúng liên tiếp: cặp 1 = x1, 2 = x1.2, 3 = x1.5, 4+ = x2. */
const COMBO_STEPS = [1, 1.2, 1.5, 2] as const;

export function comboMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  return COMBO_STEPS[Math.min(streak, COMBO_STEPS.length) - 1]!;
}

/** Điểm cho một cặp đúng. `streak` là chuỗi SAU khi tính cặp này. */
export function pairScore(streak: number, doubled: boolean): number {
  return Math.round(BASE_POINTS * comboMultiplier(streak) * (doubled ? 2 : 1));
}

export function timeBonus(secondsLeft: number): number {
  return Math.max(0, Math.round(secondsLeft) * TIME_BONUS_PER_SEC);
}

/** Đánh giá 1–3 sao theo mốc điểm của màn (Campaign). */
export function starsFor(score: number, thresholds?: readonly [number, number]): 0 | 1 | 2 | 3 {
  if (!thresholds) return 3;
  const [two, three] = thresholds;
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}

/**
 * Xếp hạng người chơi: điểm cao trước; hoà điểm thì so chuỗi đúng liên tiếp
 * dài nhất, rồi số cặp mở được (MP-04).
 */
export function rankPlayers<T extends { score: number; bestStreak: number; pairs: number }>(
  players: readonly T[]
): T[] {
  return [...players].sort(
    (x, y) => y.score - x.score || y.bestStreak - x.bestStreak || y.pairs - x.pairs
  );
}
