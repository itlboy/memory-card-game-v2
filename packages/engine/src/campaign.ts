import { pairScore } from './scoring.js';
import type { GameConfig } from './types.js';

/**
 * LUẬT CỦA MỘT MÀN CHIẾN DỊCH (27.10.2026). Bản đầu (5 màn mỗi cỡ, mỗi màn một luật) bị
 * chủ dự án chê "viển vông": bàn 4 thẻ lặp 5 lần, tim nhiều tới mức không ai thua (đo:
 * người khá thắng 98–100% mọi màn). Nay số màn THEO ĐỘ SÂU của cỡ bàn (`MAN_THEO_CO`) và
 * mọi con số của từng màn là BẢNG ĐO (`DO_MAN`), không công thức.
 * `xemTruoc` = hé cả bàn vài giây đầu ván rồi giờ gắt hơn; `nhanh` = chỉ đồng hồ gắt.
 */
export type LuatMan = 'tron' | 'xemTruoc' | 'xao' | 'mang' | 'dacBiet' | 'nhanh' | 'trum';
/** Luật đơn — thành phần của một màn (màn trùm có từ hai luật đơn). */
export type LuatDon = Exclude<LuatMan, 'tron' | 'trum'>;

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
  /** Số lần lật sai tối đa cho 2★ và 3★ — xem `saiToiDa`. */
  starMisses: [number, number];
  /** Luật của màn (Chiến dịch); ngoài Chiến dịch luôn 'tron'. */
  luat: LuatMan;
  /** Các luật đơn đang bật — màn trùm có hai, màn trơn không có. */
  cacLuat: readonly LuatDon[];
  /** Số mạng (null = không dùng mạng). */
  lives: number | null;
  /** Số lần xáo thẻ trong ván (0 = tắt). */
  shuffleCount: number;
  /** Hé cả bàn đầu ván, ms (0 = tắt). */
  peekMs: number;
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
 * xem LUAT_THEO_CO bên dưới.
 */
// `sao`: số lần QUÊN tối đa để đạt [2★, 3★] ở Chiến dịch — xem saiToiDa.
// `gio`: số giây một người chơi khá cần để dọn bàn (đo) — gốc giờ Chiến dịch.
const BOARDS: readonly {
  cols: number; rows: number; levels: number; sao: readonly [number, number]; gio: number;
}[] = [
  { cols: 2, rows: 2, levels: 1, sao: [1, 0], gio: 7 },    //  4 thẻ
  { cols: 2, rows: 3, levels: 1, sao: [1, 0], gio: 13 },    //  6 thẻ
  { cols: 3, rows: 4, levels: 3, sao: [1, 0], gio: 26 },    // 12 thẻ
  { cols: 4, rows: 4, levels: 4, sao: [2, 0], gio: 36 },    // 16 thẻ
  { cols: 4, rows: 5, levels: 5, sao: [3, 1], gio: 51 },    // 20 thẻ
  { cols: 4, rows: 6, levels: 6, sao: [5, 1], gio: 63 },    // 24 thẻ
  { cols: 5, rows: 6, levels: 7, sao: [8, 2], gio: 91 },    // 30 thẻ
  { cols: 6, rows: 6, levels: 9, sao: [11, 3], gio: 125 },    // 36 thẻ
  { cols: 6, rows: 7, levels: 9, sao: [15, 5], gio: 150 },    // 42 thẻ
  { cols: 7, rows: 8, levels: 3, sao: [20, 7], gio: 210 },    // 56 thẻ
  { cols: 8, rows: 9, levels: 1, sao: [24, 9], gio: 255 },    // 72 thẻ
  { cols: 8, rows: 11, levels: 1, sao: [28, 10], gio: 290 }    // 88 thẻ — trần mới
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
 * CHIẾN DỊCH (14.10.2026: 12 cỡ × 5; 27.10.2026: số màn theo độ sâu — LUAT_THEO_CO).
 * Thang cũ chia lệch 1·1·3·4·5·6·7·9·9·3·1·1 — chín màn liền một bàn 36 thẻ
 * rồi phần cuối nhảy 56→72→88 trong năm màn. Nay mọi cỡ đều có mặt, bàn nhỏ ít màn,
 * bàn to nhiều màn, mỗi màn một luật.
 *
 * `gio` (thời gian THẬT cần, đo) là mốc để chỉnh mô hình mô phỏng sinh DO_MAN.
 * Thời gian cần tăng nhanh hơn số cặp (bàn to lật mò nhiều hơn), nên bản
 * 9→5 giây/cặp thừa giờ ở bàn nhỏ (4 thẻ được 18 giây, cần 7 — chủ dự án báo)
 * và gắt ở bàn to (người khá thua gần hết bàn 56–88 thẻ). `gio` đo bằng mô
 * phỏng người chơi khá (duel-helper, 0,9 giây mỗi lá, FLIP_BACK_MS thật); bàn
 * ≥36 thẻ mô hình khá bị mòn trí nhớ nên lấy gần trung vị người giỏi.
 */
/**
 * LUẬT TỪNG MÀN THEO CỠ BÀN (chỉ số = BOARDS). [] = bàn trơn; một luật = màn luật đó;
 * từ hai luật = màn TRÙM 👑. Số màn theo ĐỘ SÂU của cỡ (chủ dự án chọn 27.10.2026):
 *   · 4 · 6 thẻ: người chơi KHÔNG quên nổi lần nào (đo) — tim/xáo/thẻ đặc biệt vô nghĩa,
 *     nên 1 và 2 màn, chỉ trơn + đua giờ;
 *   · tim CHỈ ở 16–42 thẻ: dưới đó không ai quên đủ để mất tim, trên đó người khá quên
 *     30–50 lần — số tim hàng chục, thành trang trí;
 *   · bàn to thay tim bằng XEM TRƯỚC và NHANH.
 * Tổng PHẢI là 60 (bốn chặng × 15) — sự thật công khai "60 màn".
 */
export const LUAT_THEO_CO: readonly (readonly (readonly LuatDon[])[])[] = [
  /*  4 */ [[]],
  /*  6 */ [[], ['nhanh']],
  /* 12 */ [[], ['xao'], ['dacBiet'], ['xao', 'dacBiet']],
  /* 16 */ [[], ['xao'], ['mang'], ['dacBiet'], ['xao', 'mang']],
  /* 20 */ [[], ['xao'], ['mang'], ['dacBiet'], ['dacBiet', 'mang']],
  /* 24 */ [[], ['xemTruoc'], ['xao'], ['mang'], ['dacBiet'], ['xao', 'dacBiet']],
  /* 30 */ [[], ['xemTruoc'], ['xao'], ['mang'], ['dacBiet'], ['xao', 'mang']],
  /* 36 */ [[], ['xemTruoc'], ['xao'], ['mang'], ['dacBiet'], ['dacBiet', 'mang']],
  /* 42 */ [[], ['xemTruoc'], ['xao'], ['mang'], ['dacBiet'], ['xao', 'dacBiet']],
  /* 56 */ [[], ['xemTruoc'], ['xao'], ['dacBiet'], ['nhanh'], ['xao', 'dacBiet']],
  /* 72 */ [[], ['xemTruoc'], ['xao'], ['dacBiet'], ['nhanh'], ['xemTruoc', 'xao']],
  /* 88 */ [[], ['xemTruoc'], ['xao'], ['dacBiet'], ['nhanh'], ['xao', 'dacBiet'], ['xao', 'dacBiet', 'nhanh']]
];

/** Màn phẳng: cỡ bàn (chỉ số BOARDS) + các luật đơn — thứ tự đúng số màn 1..60. */
export const MAN_PHANG: readonly { bang: number; cacLuat: readonly LuatDon[] }[] =
  LUAT_THEO_CO.flatMap((ds, bang) => ds.map((cacLuat) => ({ bang, cacLuat })));

export const CAMPAIGN_LEVELS = MAN_PHANG.length;

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
 * Bốn chặng của Chiến dịch, mỗi chặng 15 màn — lưới 5 cột luôn TRÒN HÀNG. Một cỡ bàn có
 * thể vắt qua hai chặng (số màn mỗi cỡ theo độ sâu, không còn trùng một hàng).
 */
export interface Chapter { id: number; name: string; from: number; to: number }
const MAN_MOI_CHANG = 15;
export const CHAPTERS: readonly Chapter[] = ['Nhập môn', 'Tăng tốc', 'Thử thách', 'Bậc thầy']
  .map((name, i) => ({ id: i + 1, name, from: i * MAN_MOI_CHANG + 1, to: (i + 1) * MAN_MOI_CHANG }));

/**
 * SAO THEO SỐ LẦN QUÊN, KHÔNG THEO % ĐIỂM HOÀN HẢO, KHÔNG THEO THỜI GIAN (chủ dự
 * án 14.10.2026: "3 sao luôn khó, không bất khả thi"; thời gian chỉ quyết thắng
 * thua). "Quên" = lật sai khi lá cùng cặp với lá lật đầu ĐÃ từng lộ (`quen` ở
 * engine, cùng điều kiện mất mạng). Lật hai lá chưa từng mở là đang dò — đếm
 * nó thì bị trừ sao vì một ô chưa ai thấy (chủ dự án bắt được).
 *
 * Mốc `sao` trong BOARDS là BẢNG ĐO bằng mô phỏng người chơi (mô hình
 * duel-helper, nghĩ 0,9 giây mỗi lá, đồng hồ + lá đặc biệt thật): 3★ ≈ p30 của
 * người nhớ RẤT tốt, 2★ ≈ trung vị của người khá. Bàn ≤16 thẻ người nhớ tốt
 * thường không quên lần nào nên 3★ = 0 — trùng 💎 Hoàn hảo, chấp nhận: bàn nhỏ
 * vốn dễ. Đổi luật lá đặc biệt / FLIP_BACK_MS / đồng hồ là phải đo lại.
 */
export function saiToiDa(pairs: number): [number, number] {
  const b = BOARDS.find((x) => x.cols * x.rows === pairs * 2);
  if (!b) throw new Error(`Không có cỡ bàn ${pairs} cặp`);
  return [b.sao[0], b.sao[1]];
}

/** Mốc sao và tỉ lệ thẻ đặc biệt theo vị trí trên thang (thang KHOÁ cỡ bàn). */
function sao(id: number, pairs: number): Pick<Level, 'specialRate' | 'starMisses'> {
  // Thẻ đặc biệt có từ CẤP 1, thưa ở cấp dễ rồi dày dần tới trần 30%. Trước đây
  // chặn tới cấp 3 mới bật, mà bàn nhỏ lại làm tròn xuống 0 nên thực tế phải
  // tới cấp 25 người chơi mới gặp thẻ tráo — coi như không có tính năng đó.
  // Cấp 1 là bàn tập 2 thẻ nên buildDeck tự bỏ qua (cần ít nhất 3 cặp).
  const specialRate = Math.min(0.3, 0.06 + (id - 1) * 0.005);
  return { specialRate, starMisses: saiToiDa(pairs) };
}

/** Tỉ lệ cặp đặc biệt của màn có luật thẻ đặc biệt: dày dần theo cỡ bàn. */
export const tiLeDacBiet = (bang: number): number => Math.min(0.3, 0.12 + bang * 0.016);
/** Số lần xáo: mức "Nhiều" (thẻ/5) — mức vừa đo không đổi gì (lá bị xáo phần lớn chưa ai mở). */
export const soLanXao = (pairs: number): number => Math.max(1, Math.ceil((pairs * 2) / 5));
/** Giây hé bàn của màn Xem trước: 2 giây nhìn cả bàn + 1 giây mỗi 4 thẻ. */
export const giayXemTruoc = (pairs: number): number => Math.ceil(2 + (pairs * 2) / 4);

/**
 * BẢNG ĐO TỪNG MÀN — [giờ (giây), số tim | null, max quên 2★, max quên 3★].
 * SINH BẰNG `DO_CD=1 … vitest run test/do-chien-dich.test.ts -t "sinh bảng"` (mô phỏng
 * người chơi đã chỉnh sát bảng `gio`/`sao` đo người thật: nghĩ 1,25 giây/lá), KHÔNG sửa tay.
 * Đích (người khá): trơn ~99% qua · một luật ~90% · trùm ~70% · nhanh ~75%. Tim = số lần
 * quên p85 (+1: hết tim mới thua). Sao: 2★ = trung vị quên người khá, 3★ = p25 người giỏi.
 * Đổi luật / bảng LUAT_THEO_CO / engine (FLIP_BACK_MS, thẻ đặc biệt) là SINH LẠI.
 */
const DO_MAN: readonly (readonly [number, number | null, number, number])[] = [
  [16, null, 1, 0],   //  1 · 4 thẻ · trơn
  [24, null, 1, 0],   //  2 · 6 thẻ · trơn
  [15, null, 1, 0],   //  3 · 6 thẻ · nhanh
  [50, null, 1, 0],   //  4 · 12 thẻ · trơn
  [30, null, 1, 0],   //  5 · 12 thẻ · xao
  [35, null, 1, 0],   //  6 · 12 thẻ · dacBiet
  [26, null, 1, 0],   //  7 · 12 thẻ · xao+dacBiet
  [70, null, 1, 0],   //  8 · 16 thẻ · trơn
  [45, null, 1, 0],   //  9 · 16 thẻ · xao
  [40, 3, 1, 0],   // 10 · 16 thẻ · mang
  [45, null, 1, 0],   // 11 · 16 thẻ · dacBiet
  [35, 4, 1, 0],   // 12 · 16 thẻ · xao+mang
  [85, null, 2, 0],   // 13 · 20 thẻ · trơn
  [55, null, 2, 0],   // 14 · 20 thẻ · xao
  [50, 4, 2, 0],   // 15 · 20 thẻ · mang
  [55, null, 2, 0],   // 16 · 20 thẻ · dacBiet
  [45, 4, 2, 0],   // 17 · 20 thẻ · dacBiet+mang
  [100, null, 2, 0],   // 18 · 24 thẻ · trơn
  [35, null, 1, 0],   // 19 · 24 thẻ · xemTruoc
  [65, null, 3, 0],   // 20 · 24 thẻ · xao
  [60, 5, 2, 0],   // 21 · 24 thẻ · mang
  [65, null, 3, 0],   // 22 · 24 thẻ · dacBiet
  [55, null, 3, 1],   // 23 · 24 thẻ · xao+dacBiet
  [130, null, 4, 0],   // 24 · 30 thẻ · trơn
  [55, null, 2, 0],   // 25 · 30 thẻ · xemTruoc
  [85, null, 4, 1],   // 26 · 30 thẻ · xao
  [80, 7, 4, 0],   // 27 · 30 thẻ · mang
  [85, null, 4, 1],   // 28 · 30 thẻ · dacBiet
  [65, 7, 4, 1],   // 29 · 30 thẻ · xao+mang
  [160, null, 5, 1],   // 30 · 36 thẻ · trơn
  [65, null, 3, 0],   // 31 · 36 thẻ · xemTruoc
  [105, null, 6, 1],   // 32 · 36 thẻ · xao
  [100, 9, 6, 1],   // 33 · 36 thẻ · mang
  [110, null, 6, 1],   // 34 · 36 thẻ · dacBiet
  [90, 9, 6, 1],   // 35 · 36 thẻ · dacBiet+mang
  [190, null, 7, 1],   // 36 · 42 thẻ · trơn
  [85, null, 5, 1],   // 37 · 42 thẻ · xemTruoc
  [120, null, 8, 2],   // 38 · 42 thẻ · xao
  [115, 11, 7, 1],   // 39 · 42 thẻ · mang
  [130, null, 8, 2],   // 40 · 42 thẻ · dacBiet
  [110, null, 9, 2],   // 41 · 42 thẻ · xao+dacBiet
  [270, null, 12, 3],   // 42 · 56 thẻ · trơn
  [130, null, 10, 2],   // 43 · 56 thẻ · xemTruoc
  [170, null, 13, 4],   // 44 · 56 thẻ · xao
  [190, null, 14, 4],   // 45 · 56 thẻ · dacBiet
  [135, null, 12, 3],   // 46 · 56 thẻ · nhanh
  [155, null, 14, 4],   // 47 · 56 thẻ · xao+dacBiet
  [375, null, 20, 5],   // 48 · 72 thẻ · trơn
  [185, null, 18, 4],   // 49 · 72 thẻ · xemTruoc
  [245, null, 20, 6],   // 50 · 72 thẻ · xao
  [260, null, 22, 6],   // 51 · 72 thẻ · dacBiet
  [185, null, 20, 5],   // 52 · 72 thẻ · nhanh
  [175, null, 18, 4],   // 53 · 72 thẻ · xemTruoc+xao
  [500, null, 31, 7],   // 54 · 88 thẻ · trơn
  [250, null, 28, 6],   // 55 · 88 thẻ · xemTruoc
  [320, null, 31, 8],   // 56 · 88 thẻ · xao
  [335, null, 32, 8],   // 57 · 88 thẻ · dacBiet
  [250, null, 31, 7],   // 58 · 88 thẻ · nhanh
  [270, null, 33, 9],   // 59 · 88 thẻ · xao+dacBiet
  [260, null, 31, 9],   // 60 · 88 thẻ · xao+dacBiet+nhanh
];

/**
 * Màn Chiến dịch: cỡ bàn + luật từ MAN_PHANG, con số từ DO_MAN. Bàn 4 thẻ (2 cặp) không
 * bao giờ có luật thẻ đặc biệt — buildDeck cần ≥3 cặp (bảng LUAT_THEO_CO đã tránh; test canh).
 */
export function campaignSpec(id: number): Level {
  if (!Number.isInteger(id) || id < 1 || id > CAMPAIGN_LEVELS) {
    throw new Error(`Màn ${id} không tồn tại`);
  }
  const { bang, cacLuat } = MAN_PHANG[id - 1]!;
  const b = BOARDS[bang]!;
  const pairs = (b.cols * b.rows) / 2;
  const [timeLimit, lives, s2, s3] = DO_MAN[id - 1] ?? [Math.ceil(b.gio * 1.8), null, b.sao[0], b.sao[1]];
  const luat: LuatMan = cacLuat.length === 0 ? 'tron' : cacLuat.length === 1 ? cacLuat[0]! : 'trum';
  return {
    id, cols: b.cols, rows: b.rows, pairs, timeLimit,
    specialRate: cacLuat.includes('dacBiet') ? tiLeDacBiet(bang) : 0,
    starMisses: [s2, s3],
    luat, cacLuat,
    lives: cacLuat.includes('mang') ? lives : null,
    shuffleCount: cacLuat.includes('xao') ? soLanXao(pairs) : 0,
    peekMs: cacLuat.includes('xemTruoc') ? giayXemTruoc(pairs) * 1000 : 0
  };
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
  return { id, cols, rows, pairs, timeLimit, ...sao(id, pairs), luat: 'tron', cacLuat: [], lives: null, shuffleCount: 0, peekMs: 0 };
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
    starMisses: level.starMisses,
    lives: level.lives,
    shuffleCount: level.shuffleCount,
    peekMs: level.peekMs
  };
}
