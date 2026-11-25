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
const tong = (a: readonly number[] | undefined): number => (a ?? []).reduce((s, n) => s + (n || 0), 0);
/** Số cơ hội nhớ = lần nhớ đúng + lần quên. */
export function coHoiNho(nho: readonly number[] | undefined, quen: readonly number[] | undefined): number {
  return tong(nho) + tong(quen);
}

/*
 * CHỈ SỐ TRÍ NHỚ = CỘNG 5 CHẶNG NHỚ, tối đa 1000 (chủ dự án duyệt 25.11.2026, trang nghiên cứu
 * https://claude.ai/artifact/D1HPHCCMsVXdgzoFwRjjsu). Thay công thức "tỉ lệ × trần của bàn": bàn 16 thẻ bị trần 425,
 * muốn lên điểm chỉ cần chọn bàn to, và không nói được người chơi yếu ở đâu.
 *
 *   điểm một chặng = tỉ lệ nhớ THẬT của chặng (đã trừ phần ăn may) × điểm của chặng
 *
 * HAI CON SỐ ĐÃ MÔ PHỎNG (test/mo-phong-tri-nho.test.ts — người chơi giả quên theo nửa đời, 6 cỡ bàn):
 *  · `DIEM_CHANG` 50·150·200·275·325, KHÔNG PHẢI 100·150·200·250·300: chặng "vừa thấy" ai cũng ~100% → 100 điểm cho
 *    không, bậc Đồng (dưới 200) gần như không ai rơi vào.
 *  · TRỪ ĂN MAY (`may`, engine cộng 1/số lá úp cho mỗi cơ hội): tỉ lệ = (nhớ − may) / (số lần − may). Không trừ thì
 *    điểm phụ thuộc cỡ bàn (người không nhớ gì: ~400 ở bàn 16 thẻ, ~200 ở bàn 88 thẻ). Trừ rồi thì 24–88 thẻ ra cùng
 *    điểm, chỉ còn phụ thuộc SỨC NHỚ: nửa đời 1 lượt ≈ 120 · 3 ≈ 265 · 8 ≈ 465 · 12 ≈ 565 · 20 ≈ 685 · 40 ≈ 810 · hoàn hảo ≈ 990.
 * Cỡ bàn vẫn vào điểm theo cách chủ dự án chốt 23.11.2026, nhưng là MỞ KHOÁ chứ không là trần: ván 12–16 thẻ quá
 * ngắn để có chặng 16+ lượt (trần ~675), muốn Kim cương phải chơi bàn ≥ 24 thẻ.
 */
/** Điểm tối đa của từng chặng (cùng thứ tự `nhomTuoi`): vừa thấy · 2–3 · 4–7 · 8–15 · 16+ lượt. Tổng = 1000. */
export const DIEM_CHANG: readonly number[] = [50, 150, 200, 275, 325];
/** Một chặng cần ngần này lần gặp trong kỳ mới được MỞ (ít hơn thì một lần may rủi làm điểm nhảy cả trăm). */
export const LAN_MO_CHANG = 5;
/** Mốc điểm của 5 bậc: Đồng · Bạc · Vàng · Bạch kim · Kim cương. Mốc CỐ ĐỊNH, không so với bot (chủ dự án: bot có thể đổi độ khó). */
export const MOC_BAC_TRI_NHO: readonly number[] = [0, 200, 400, 600, 800];
/** Bậc 0–4 của một điểm. */
export const bacTriNho = (diem: number): number => MOC_BAC_TRI_NHO.reduce((b, m, i) => (diem >= m ? i : b), 0);

export interface ChangNho {
  /** Số lần gặp (nhớ + quên) trong kỳ. */
  n: number;
  /** Đủ `LAN_MO_CHANG` lần → có điểm. */
  mo: boolean;
  /** Tỉ lệ nhớ 0..1 ĐÃ TRỪ ĂN MAY; `null` khi chặng chưa mở. */
  tiLe: number | null;
  diem: number;
  toiDa: number;
}

/**
 * Chấm 5 chặng từ số đếm thô đã cộng dồn của một kỳ. `may` thiếu (số liệu engine cũ) = không trừ gì.
 * `diem` = tổng điểm các chặng ĐÃ MỞ; `null` khi chưa chặng nào mở.
 */
export function chiSoTriNho(
  nho: readonly number[] | undefined, quen: readonly number[] | undefined, may?: readonly number[]
): { diem: number | null; chang: ChangNho[] } {
  const chang: ChangNho[] = DIEM_CHANG.map((toiDa, i) => {
    const dung = nho?.[i] ?? 0;
    const n = dung + (quen?.[i] ?? 0);
    if (n < LAN_MO_CHANG) return { n, mo: false, tiLe: null, diem: 0, toiDa };
    // Kẹp phần may dưới số lần: bàn 2 lá cuối thì may = 1 mỗi lần, mẫu số về 0
    const m = Math.min(Math.max(0, may?.[i] ?? 0), n - 0.5);
    const tiLe = Math.min(1, Math.max(0, (dung - m) / (n - m)));
    return { n, mo: true, tiLe, diem: Math.round(tiLe * toiDa), toiDa };
  });
  const mo = chang.filter((c) => c.mo);
  return { diem: mo.length ? mo.reduce((s, c) => s + c.diem, 0) : null, chang };
}

/** Cần ngần này cơ hội nhớ thì MỘT VÁN mới có chỉ số riêng — ít hơn thì một lần nhớ/quên đã lật cả con số. */
export const MOC_CO_DIEM_VAN = 4;

/**
 * CHỈ SỐ TRÍ NHỚ CỦA MỘT VÁN, 0–1000 (chủ dự án 25.11.2026: "cho chỉ số trí nhớ của từng ván, hiện của ván đó thôi").
 * Một ván không đủ lần để mở từng chặng như kỳ 7 ngày (`chiSoTriNho`), nên gộp MỌI cơ hội của ván thành một tỉ lệ
 * nhớ đã trừ ăn may, mỗi cơ hội nặng theo điểm chặng của nó (`DIEM_CHANG` — nhớ xa đáng giá hơn nhớ gần):
 *   1000 × Σ wᵢ·(nhớᵢ − mayᵢ) / Σ wᵢ·(nᵢ − mayᵢ).
 * Vì chia cho đúng những cơ hội ĐÃ CÓ, bàn nhỏ (chỉ có chặng gần) vẫn lên được 1000. `null` = dưới `MOC_CO_DIEM_VAN` cơ hội.
 */
export function chiSoVan(
  nho: readonly number[] | undefined, quen: readonly number[] | undefined, may?: readonly number[]
): number | null {
  let tu = 0, mau = 0, coHoi = 0;
  DIEM_CHANG.forEach((w, i) => {
    const dung = nho?.[i] ?? 0;
    const n = dung + (quen?.[i] ?? 0);
    if (!n) return;
    coHoi += n;
    const m = Math.min(Math.max(0, may?.[i] ?? 0), n - 0.5);
    tu += w * Math.max(0, dung - m); mau += w * (n - m);
  });
  if (coHoi < MOC_CO_DIEM_VAN || mau <= 0) return null;
  return Math.round(Math.min(1, tu / mau) * 1000);
}
