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
 *    (chỗ trống của bàn 351×510, gap 6px): bàn 42 thẻ cho lá 51px, bàn 56 thẻ
 *    (7×8) còn 44px — vừa sát ngưỡng, nên đó là TRẦN.
 *
 *    Chặn ở đây là SỐ CỘT, không phải số thẻ và cũng không phải số hàng. Đo
 *    thật (computeFit, iPhone SE): 8×9, 8×10 và 8×11 đều cho lá 38,6px y hệt
 *    nhau — thêm hàng KHÔNG làm lá bé đi, vì bàn cao quá thì cả bàn co lại theo
 *    tỷ lệ chứ ô không dẹt xuống. Còn 10 cột thì gap ăn mất chỗ: (351−9×6)/10 =
 *    29,7px. Nên muốn nhiều thẻ mà lá vẫn to thì THÊM HÀNG, đừng thêm cột.
 *
 *    NGOẠI LỆ ĐÃ CHỐT (yêu cầu của chủ dự án): hai cỡ CUỐI — 8×9 (72 thẻ) và
 *    8×11 (88 thẻ) — CỐ Ý phá trần 44px. Đo trên iPhone SE: cả hai cho lá
 *    38,6px. Đây là bàn "siêu khó" người chơi tự chọn, không phải
 *    cỡ mặc định; đừng "sửa" bằng cách bỏ chúng đi, và cũng đừng lấy chúng làm
 *    tiền lệ để thêm cỡ mới — mọi cỡ khác vẫn phải ≥44px.
 * 4. Bàn phải LẤP được chỗ trống, không hở hai bên. Bàn cao hơn vùng bàn thì
 *    chiều cao chạm trần trước và bề rộng thừa ra thành hai dải trống. Đo thật
 *    trên iPhone SE: bàn 2×4 chỉ dùng 72% diện tích, bàn 4×7 dùng 82% — nên hai
 *    cỡ đó bị loại dù thoả ba điều kiện trên. Các cỡ còn lại dùng 99,6% diện
 *    tích, tệ nhất 96%. Đổi lại: số thẻ nhảy 6→12 và 24→30 chứ không tăng đều.
 *
 * `levels` là số KHOÁ CẤP mỗi cỡ bàn giữ trong thang khoá cũ (1..LEVEL_KEYS).
 * Thang đó ĐÓNG BĂNG: số cấp ở đây là khoá kỷ lục (`mode:L<cấp>`), là số phòng
 * online gửi lên server, và app bản cũ trong store vẫn gửi đúng những số này.
 * Đổi phân bổ ở đây là kỷ lục người chơi trỏ sang cỡ bàn khác, và app cũ chọn
 * "36 thẻ" mà server dựng bàn 30 thẻ. Chiến dịch KHÔNG đi theo thang này nữa —
 * xem CAMPAIGN_REPEAT bên dưới.
 */
const BOARDS: readonly { cols: number; rows: number; levels: number }[] = [
  { cols: 2, rows: 2, levels: 1 },    //  4 thẻ
  { cols: 2, rows: 3, levels: 1 },    //  6 thẻ
  { cols: 3, rows: 4, levels: 3 },    // 12 thẻ
  { cols: 4, rows: 4, levels: 4 },    // 16 thẻ
  { cols: 4, rows: 5, levels: 5 },    // 20 thẻ
  { cols: 4, rows: 6, levels: 6 },    // 24 thẻ
  { cols: 5, rows: 6, levels: 7 },    // 30 thẻ
  { cols: 6, rows: 6, levels: 9 },    // 36 thẻ
  { cols: 6, rows: 7, levels: 9 },    // 42 thẻ
  { cols: 7, rows: 8, levels: 3 },    // 56 thẻ
  { cols: 8, rows: 9, levels: 1 },    // 72 thẻ
  { cols: 8, rows: 11, levels: 1 }    // 88 thẻ — trần mới
];

/** Bàn của từng khoá cấp, trải phẳng từ BOARDS. Cấp 1 nằm ở chỉ số 0. */
const LADDER: readonly { cols: number; rows: number; pairs: number }[] =
  BOARDS.flatMap((b) =>
    Array.from({ length: b.levels }, () => ({
      cols: b.cols, rows: b.rows, pairs: (b.cols * b.rows) / 2
    }))
  );

/** Số khoá cấp cỡ bàn (1..50) — biên kiểm `level` ở server, prefs, kỷ lục. */
export const LEVEL_KEYS = LADDER.length;

/**
 * CHIẾN DỊCH: MỖI CỠ BÀN ĐÚNG CAMPAIGN_REPEAT MÀN (chủ dự án 14.10.2026).
 * Thang cũ chia lệch 1·1·3·4·5·6·7·9·9·3·1·1 — chín màn liền một bàn 36 thẻ
 * rồi phần cuối nhảy 56→72→88 trong năm màn. Nay 12 cỡ × 5 = 60 màn; trong năm
 * lần lặp của một cỡ, giờ siết theo SECS_PER_PAIR (giây mỗi cặp). Năm màn một
 * cỡ cũng là đúng một hàng của lưới 5 cột trên bản đồ.
 */
export const CAMPAIGN_REPEAT = 5;
const SECS_PER_PAIR: readonly number[] = [9, 8, 7, 6, 5];

export const CAMPAIGN_LEVELS = BOARDS.length * CAMPAIGN_REPEAT;

/**
 * MƯỜI HAI CỠ BÀN — thứ mà các chế độ NGOÀI Chiến dịch thật sự chọn.
 *
 * Số cỡ phải TRÒN HÀNG trong lưới chọn (xem CLAUDE.md): 12 = 3×4 / 4×3. Thêm
 * hay bớt một cỡ là lưới lòi ô lẻ ở hàng cuối — phải đổi theo cặp.
 *
 * Thang màn là chuyện riêng của Chiến dịch: nhiều màn dùng chung một cỡ bàn
 * và chỉ khác nhau ở đồng hồ. Đem thang đó cho chế độ thường thì người chơi
 * phải đọc "Cấp 37" để đoán ra "36 thẻ" — trong khi thứ họ muốn chọn chỉ là số
 * thẻ, còn độ khó đã nằm ở năm tuỳ chọn bàn chơi.
 *
 * `level` là cấp ĐẦU TIÊN dùng cỡ bàn đó. Giữ lại một số cấp hợp lệ cho mỗi cỡ
 * để không phải đổi engine, server (kiểm biên `level`) và khoá lưu kỷ lục —
 * mỗi cỡ bàn từ nay có đúng một khoá.
 */
export const BOARD_SIZES: readonly { cols: number; rows: number; pairs: number; level: number }[] =
  BOARDS.map((b, i) => ({
    cols: b.cols, rows: b.rows, pairs: (b.cols * b.rows) / 2,
    level: BOARDS.slice(0, i).reduce((n, x) => n + x.levels, 0) + 1
  }));

/** Cỡ bàn của một KHOÁ cấp (thang 1..LEVEL_KEYS, không phải màn Chiến dịch), quy về mục tương ứng trong BOARD_SIZES. */
export const sizeForLevel = (id: number): (typeof BOARD_SIZES)[number] => {
  const { pairs } = boardForLevel(id);
  return BOARD_SIZES.find((s) => s.pairs === pairs)!;
};

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
 * Bốn chặng của Chiến dịch, mỗi chặng ĐÚNG ba cỡ bàn (15 màn). Một cỡ = năm màn
 * = một hàng của lưới 5 cột, nên lưới luôn TRÒN HÀNG và mỗi hàng đọc ra
 * "cùng bàn, giờ ngắn dần từ trái sang phải".
 */
export interface Chapter { id: number; name: string; from: number; to: number }
const MAN_MOI_CHANG = 3 * CAMPAIGN_REPEAT;
export const CHAPTERS: readonly Chapter[] = ['Nhập môn', 'Tăng tốc', 'Thử thách', 'Bậc thầy']
  .map((name, i) => ({ id: i + 1, name, from: i * MAN_MOI_CHANG + 1, to: (i + 1) * MAN_MOI_CHANG }));

/** Mốc sao và tỉ lệ thẻ đặc biệt theo vị trí trên một thang `tong` bậc. */
function sao(id: number, tong: number, pairs: number): Pick<Level, 'specialRate' | 'starThresholds'> {
  // Nửa sau thang siết sao: cùng một bàn nhưng đòi chơi sạch hơn mới đủ sao
  const hard = id > tong / 2;
  const perfect = perfectScore(pairs);
  // Thẻ đặc biệt có từ CẤP 1, thưa ở cấp dễ rồi dày dần tới trần 30%. Trước đây
  // chặn tới cấp 3 mới bật, mà bàn nhỏ lại làm tròn xuống 0 nên thực tế phải
  // tới cấp 25 người chơi mới gặp thẻ tráo — coi như không có tính năng đó.
  // Cấp 1 là bàn tập 2 thẻ nên buildDeck tự bỏ qua (cần ít nhất 3 cặp).
  const specialRate = Math.min(0.3, 0.06 + (id - 1) * 0.005);
  return {
    specialRate,
    starThresholds: hard
      ? [Math.round(perfect * 0.62), Math.round(perfect * 0.85)]
      : [Math.round(perfect * 0.55), Math.round(perfect * 0.8)]
  };
}

/**
 * Màn Chiến dịch. Cỡ bàn = (id−1) / CAMPAIGN_REPEAT; lần lặp thứ k trong cỡ đó
 * được SECS_PER_PAIR[k] giây mỗi cặp (9 → 5). Bàn 4 thẻ: 18·16·14·12·10 giây;
 * bàn 88 thẻ: 396·352·308·264·220 giây.
 */
export function campaignSpec(id: number): Level {
  if (!Number.isInteger(id) || id < 1 || id > CAMPAIGN_LEVELS) {
    throw new Error(`Màn ${id} không tồn tại`);
  }
  const b = BOARDS[Math.floor((id - 1) / CAMPAIGN_REPEAT)]!;
  const pairs = (b.cols * b.rows) / 2;
  const timeLimit = pairs * SECS_PER_PAIR[(id - 1) % CAMPAIGN_REPEAT]!;
  return { id, cols: b.cols, rows: b.rows, pairs, timeLimit, ...sao(id, CAMPAIGN_LEVELS, pairs) };
}

/** Spec theo KHOÁ cấp (thang cũ 1..LEVEL_KEYS) — chế độ thường và online chỉ
 *  đọc cỡ bàn ở đây; Chiến dịch dùng campaignSpec. */
export function levelSpec(id: number): Level {
  const { cols, rows, pairs } = boardForLevel(id);

  // Mốc 9 giây mỗi cặp, siết ĐÚNG 2 giây mỗi cấp, sàn 3 giây mỗi cặp. Bước phải
  // là số nguyên giây: siết theo tỷ lệ (0,1 giây mỗi cặp) thì ở bàn nhỏ mỗi cấp
  // chỉ giảm 0,4 giây, làm tròn xong hai cấp liền nhau ra cùng một con số —
  // cấp sau không khó hơn cấp trước nữa. Đây là thứ DUY NHẤT phân biệt các cấp
  // dùng chung một cỡ bàn (xem BOARDS).
  const timeLimit = Math.max(pairs * 3, pairs * 9 - (id - 1) * 2);
  return { id, cols, rows, pairs, timeLimit, ...sao(id, LEVEL_KEYS, pairs) };
}

/** Mọi màn Chiến dịch. */
export const allLevels = (): Level[] =>
  Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => campaignSpec(i + 1));

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
