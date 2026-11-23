/** Công thức điểm — mục 3.5 của SRS. Tách riêng để test khoá được hành vi. */

export const BASE_POINTS = 100;
export const MISS_PENALTY = 10;
export const TIME_BONUS_PER_SEC = 5;
/**
 * Hai lá KHÔNG khớp thì nằm ngửa bấy nhiêu ms rồi mới úp lại.
 *
 * 1 giây là quá ngắn: đó là toàn bộ thời gian người chơi có để NHỚ hai lá vừa
 * mở, mà trên bàn 56–88 thẻ thì mắt còn phải đi tìm chúng trong hàng chục ô.
 * 1,5 giây đủ để đọc cả hai mà vẫn không thành ra chờ đợi. Server và client
 * dùng chung con số này (`config.flipBackMs`), nên ván online cũng đổi theo.
 */
export const FLIP_BACK_MS = 1500;
/** Ghép đúng được cộng thêm vào đồng hồ lượt (multiplayer), không vượt trần TURN_LIMIT. */
export const TURN_BONUS_MS = 5_000;

/** Đua thời gian: ghép đúng được cộng thêm giây vào đồng hồ CHUNG của ván —
 *  ghép nhanh thì được chơi lâu hơn, thành ra càng đua càng có đà. */
export const MATCH_TIME_BONUS_MS = 2_000;

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

/** Sao theo SỐ LẦN LẬT SAI (Chiến dịch): sai ≤ max3 → 3★, ≤ max2 → 2★, còn lại 1★. */
export function starsByMisses(misses: number, [max2, max3]: readonly [number, number]): 1 | 2 | 3 {
  if (misses <= max3) return 3;
  if (misses <= max2) return 2;
  return 1;
}

/**
 * Xếp hạng người chơi: người bỏ cuộc LUÔN đứng cuối (đầu hàng thì không thể
 * thắng dù đang dẫn điểm); còn lại điểm cao trước, hoà thì so chuỗi đúng
 * liên tiếp dài nhất, rồi số cặp mở được (MP-04).
 */
/** Hai người dẫn đầu có CÙNG điểm, cùng chuỗi, cùng số cặp → hoà thật sự.
 *  Không có hàm này thì UI cứ lấy người đầu danh sách và tuyên bố thắng, dù
 *  thứ tự đó chỉ do sort ngẫu nhiên quyết định. */
export function isDraw<T extends {
  score: number; bestStreak: number; pairs: number; forfeited?: boolean;
}>(ranking: readonly T[]): boolean {
  const alive = ranking.filter((p) => !p.forfeited);
  if (alive.length < 2) return false;
  const [a, b] = alive as [T, T];
  return a.score === b.score && a.bestStreak === b.bestStreak && a.pairs === b.pairs;
}

export function rankPlayers<T extends {
  score: number; bestStreak: number; pairs: number; forfeited?: boolean;
}>(players: readonly T[]): T[] {
  return [...players].sort(
    (x, y) =>
      Number(!!x.forfeited) - Number(!!y.forfeited)
      || y.score - x.score
      || y.bestStreak - x.bestStreak
      || y.pairs - x.pairs
  );
}

/* ───────────── ĐIỂM TRÍ NHỚ ─────────────
 * Đo trên LƯỢT CỦA CHÍNH MÌNH nên chấm được ở mọi chế độ (một mình, đấu máy, online):
 * mỗi lần lật lá đầu mà lá đôi của nó đã từng lộ là một "cơ hội nhớ" — ghép trúng = nhớ,
 * ghép trật = quên. Engine chỉ giữ SỐ ĐẾM THÔ theo nhóm độ lâu; công thức nằm cả ở đây,
 * đổi hệ số là điểm của mọi ngày đã lưu tự tính lại.
 */

/** Số nhóm độ lâu: 1 · 2–3 · 4–7 · 8–15 · 16+ nước. */
export const SO_NHOM_TUOI = 5;
export const rongNhomTuoi = (): number[] => new Array<number>(SO_NHOM_TUOI).fill(0);
/** Nhóm của một độ lâu (số nước từ lúc lá đôi lộ lần cuối, ≥ 1). */
export function nhomTuoi(tuoi: number): number {
  return Math.min(SO_NHOM_TUOI - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, tuoi)))));
}
/** Nhớ lá thấy từ lâu thì ĐÁNG GIÁ hơn nhớ lá vừa thấy. */
export const NANG_NHO: readonly number[] = [1, 1.5, 2, 2.5, 3];
/** Quên lá VỪA thấy thì nặng tội hơn quên lá thấy từ lâu. */
export const NANG_QUEN: readonly number[] = [1.5, 1.25, 1, 0.75, 0.5];
/** Dưới ngần này cơ hội nhớ thì chưa đủ để chấm (bàn 2–3 cặp phần lớn là may rủi). */
export const CO_HOI_NHO_TOI_THIEU = 3;

const tong = (a: readonly number[] | undefined): number => (a ?? []).reduce((s, n) => s + (n || 0), 0);
const tongNang = (a: readonly number[] | undefined, nang: readonly number[]): number =>
  (a ?? []).reduce((s, n, i) => s + (n || 0) * (nang[Math.min(i, nang.length - 1)] ?? 1), 0);

/** Số cơ hội nhớ = lần nhớ đúng + lần quên. */
export function coHoiNho(nho: readonly number[] | undefined, quen: readonly number[] | undefined): number {
  return tong(nho) + tong(quen);
}

/**
 * Tỉ lệ nhớ 0..1 CÓ TÍNH ĐỘ LÂU, `null` khi chưa đủ `CO_HOI_NHO_TOI_THIEU` cơ hội.
 * Dùng chung cho một ván lẫn số cộng dồn nhiều ván CÙNG cỡ bàn.
 */
export function tiLeNho(nho: readonly number[] | undefined, quen: readonly number[] | undefined): number | null {
  if (coHoiNho(nho, quen) < CO_HOI_NHO_TOI_THIEU) return null;
  const n = tongNang(nho, NANG_NHO), q = tongNang(quen, NANG_QUEN);
  return n / (n + q);
}

/** Bàn lớn nhất của game (88 thẻ) — trần điểm trí nhớ của nó là `TRAN_TRI_NHO`. */
export const CAP_TRAN_TRI_NHO = 44;
export const TRAN_TRI_NHO = 1000;
/**
 * TRẦN CỦA BÀN: điểm trí nhớ tối đa một bàn `soCap` cặp cho được. Tăng theo CĂN BẬC HAI số cặp
 * (4 cặp ≈ 300 · 8 ≈ 425 · 18 ≈ 640 · 30 ≈ 825 · 44 = 1000): tăng thẳng thì bàn 4 cặp chỉ còn 90
 * điểm, người mới thấy mình gần như bằng không. Làm tròn tới 5 cho dễ đọc.
 */
export function tranBan(soCap: number): number {
  const c = Math.min(CAP_TRAN_TRI_NHO, Math.max(1, soCap));
  return Math.round((TRAN_TRI_NHO * Math.sqrt(c / CAP_TRAN_TRI_NHO)) / 5) * 5;
}

/**
 * ĐIỂM TRÍ NHỚ = tỉ lệ nhớ × trần của bàn (chủ dự án chốt 23.11.2026: độ lâu VÀ cỡ bàn đều phải
 * vào điểm — "nếu không bàn nhỏ bàn to là như nhau"). Nhân tỉ lệ chứ không cộng dồn từng lần nhớ:
 * ván 4 người mỗi người chỉ có một phần tư số lượt, cộng dồn là thiệt. `null` = chưa đủ để chấm.
 */
export function diemTriNho(
  nho: readonly number[] | undefined, quen: readonly number[] | undefined, soCap: number
): number | null {
  const tl = tiLeNho(nho, quen);
  return tl === null ? null : Math.round(tl * tranBan(soCap));
}
