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
/** Cạnh bàn lớn nhất, dùng cho bàn trần 5×10. */
const MAX_SIDE = 10;
/** Bàn không dài quá mức này (rows/cols) — dài hơn thì thành một dải, khó nhớ
 *  vị trí. 2,0 để bàn trần 5×10 hợp lệ: khung app là cột dọc nên bàn cao gấp
 *  đôi bề rộng vẫn vừa, còn dài hơn nữa thì thẻ bé quá. */
const MAX_RATIO = 2;
/** Trần 50 thẻ = 25 cặp. 100 thẻ (10×10) thì mỗi thẻ trên điện thoại chỉ còn
 *  hơn 30px và một ván kéo dài quá lâu — chơi thành khổ, không còn vui. */
const MAX_PAIRS = 25;
/** Từ cấp này trở đi bàn không to thêm nữa; độ khó lên bằng thời gian ngắn dần
 *  và nhiều thẻ đặc biệt hơn. */
const PLATEAU_FROM = MAX_PAIRS;

/** Cấp N có N cặp cho tới trần 25 cặp (50 thẻ): cấp 1 là cấp tập 2 thẻ, cấp 25
 *  là bàn 5×10 kín. Từ cấp 26 bàn giữ nguyên 50 thẻ — xem PLATEAU_FROM. */
export const pairsForLevel = (id: number): number => Math.min(MAX_PAIRS, id);
/** Số cặp lớn nhất chiến dịch đòi (màn cuối) — UI dùng để cảnh báo trước khi
 *  người chơi lao vào màn mà bộ theme đang chọn không đủ biểu tượng. */
export const CAMPAIGN_MAX_PAIRS = pairsForLevel(CAMPAIGN_LEVELS);

/**
 * Chọn bàn cho một số cặp cho trước. Số thẻ chẵn nhưng không phải số nào cũng
 * chia thành lưới chữ nhật đầy, nên bàn được phép có vài Ô TRỐNG — miễn chúng
 * nằm gọn trong một hàng.
 *
 * Ưu tiên ĐẦU TIÊN là xếp được ĐỐI XỨNG. Ô trống lệch về một bên làm bàn trông
 * như bị khuyết, rất khó chịu lúc chia bài. Chỉ hai kiểu ô trống là đối xứng
 * được: một ô đúng giữa bàn (lưới toàn cạnh lẻ), hoặc số ô CHẴN chia đều hai
 * đầu hàng cuối (xem layout()). Số ô trống lẻ từ 3 trở lên thì không kiểu nào
 * cân, nên bị đẩy xuống cuối danh sách.
 *
 * Sau đó: ít ô trống nhất → tỷ lệ gần 1,3 (dáng khung dọc) → bàn nhỏ hơn.
 */
export function gridForPairs(pairs: number): { cols: number; rows: number } {
  // Màn tập: hai thẻ cạnh nhau. Vòng lặp dưới đòi cols >= 2 và cols <= rows nên
  // không sinh được bàn 1 cặp nào coi được (2×2 thì hai ô trống trên bốn ô).
  if (pairs === 1) return { cols: 2, rows: 1 };
  let best: { cols: number; rows: number; key: [number, number, number, number] } | null = null;
  const need = pairs * 2;
  for (let cols = 2; cols <= MAX_SIDE; cols++) {
    for (let rows = cols; rows <= MAX_SIDE; rows++) {
      const total = cols * rows;
      if (total < need) continue;
      const waste = total - need;
      if (waste > cols - 1) continue;          // ô trống phải gọn trong một hàng
      if (rows / cols > MAX_RATIO) continue;
      const lopsided = waste % 2 === 1 && waste !== 1 ? 1 : 0;
      const key: [number, number, number, number] = [
        lopsided, waste, Math.abs(rows / cols - 1.3), total
      ];
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
  // Phải chặn cả số lẻ và NaN: số màn giờ do CLIENT gửi lên (mọi chế độ đều
  // chọn màn), mà client không đáng tin — ON-09.
  if (!Number.isInteger(id) || id < 1 || id > CAMPAIGN_LEVELS) {
    throw new Error(`Màn ${id} không tồn tại`);
  }

  const pairs = pairsForLevel(id);
  const { cols, rows } = gridForPairs(pairs);

  // Thời gian nới theo số cặp nhưng siết 2 giây mỗi cấp. Từ cấp 26 bàn không to
  // thêm được nữa (trần 50 thẻ) nên đây thành thứ DUY NHẤT làm cấp sau khó hơn
  // cấp trước — cứ siết đều, chặn dưới ở 2 giây mỗi cặp để còn chơi được.
  const timeLimit = Math.max(pairs * 2, pairs * 9 - (id - 1) * 2);

  // Nửa sau chiến dịch siết sao: cùng một bàn nhưng đòi chơi sạch hơn mới đủ sao
  const hard = id > CAMPAIGN_LEVELS / 2;
  const perfect = perfectScore(pairs);
  // Thẻ đặc biệt bật từ cấp 3 (mục 3.4). Qua mốc bàn hết to thì nới trần lên
  // 0,3 — cùng với đồng hồ, đây là chỗ còn lại để tăng độ khó.
  const specialRate = id < 3
    ? 0
    : id <= PLATEAU_FROM
      ? Math.min(0.2, 0.1 + (id - 3) * 0.005)
      : Math.min(0.3, 0.2 + (id - PLATEAU_FROM) * 0.004);
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
