import { Rng } from './rng.js';
import type { Card, Power } from './types.js';

/**
 * Thẻ đặc biệt được phép xuất hiện.
 *
 * Bom (úp lại hai cặp đã mở) và Tráo đổi từng bị tắt vì "quá nặng" và "lạc
 * quẻ", nhưng cái làm chúng khó chịu không phải bản thân hiệu ứng mà là chuyện
 * bàn có thể dồn nhiều thẻ cùng loại. Nay việc chia đã đổi: mỗi loại xuất hiện
 * TỐI ĐA HAI lần và số lần giữa các loại chênh nhau không quá một, nên không
 * bàn nào biến thành bàn-toàn-bom.
 *
 * 'eye' (Mắt thần — hé cả bàn 5 giây) TẠM TẮT: bàn mở ra quá nhiều lần thì nhìn
 * loạn, mà nó lại đè lên đúng thứ tuỳ chọn "Xem trước" đang làm một cách có
 * kiểm soát. Luật xử lý vẫn còn nguyên trong game.ts — bật lại chỉ cần thêm tên
 * vào danh sách này, và ván đang chơi dở lưu từ bản trước vẫn khôi phục được.
 */
const PLAYABLE_POWERS: readonly Power[] = ['bomb', 'swap', 'x2', 'freeze'];

/** TRẦN mỗi loại trong một bàn. Xem chiaPowers(). */
const TRAN_MOI_LOAI = 2;

export interface DeckOptions {
  cols: number;
  rows: number;
  symbols: readonly string[];
  rng: Rng;
  /** Tỉ lệ cặp mang thẻ đặc biệt, 0–1. */
  specialRate?: number;
  /** Loại hiệu ứng được phép (chế độ chơi đơn không có 'freeze'). */
  allowedPowers?: readonly Power[];
  /** Số cặp mong muốn. Thiếu thì lấy tối đa lưới chứa được. Ít hơn mức tối đa
   *  thì phần dư thành ô trống — nhờ vậy số thẻ tăng đúng 2 mỗi màn. */
  pairs?: number;
}

/**
 * Chia `count` thẻ đặc biệt ĐỀU NHẤT có thể giữa các loại được phép.
 *
 * Bốc từng cái độc lập thì bàn 4 thẻ đặc biệt hoàn toàn có thể ra bốn quả bom —
 * đúng loại xui khiến người chơi thấy trò chơi bất công. Ở đây chia theo VÒNG:
 * mỗi vòng phát mỗi loại nhiều nhất một lần, thứ tự trong vòng xáo theo seed.
 * Hệ quả: số lần giữa hai loại chênh nhau tối đa 1, và không loại nào quá
 * TRAN_MOI_LOAI lần.
 */
function chiaPowers(allowed: readonly Power[], count: number, rng: Rng): Power[] {
  const ra: Power[] = [];
  for (let vong = 0; vong < TRAN_MOI_LOAI && ra.length < count; vong++) {
    for (const p of rng.shuffle(allowed)) {
      if (ra.length >= count) break;
      ra.push(p);
    }
  }
  return rng.shuffle(ra);   // xáo lần cuối: không thì cặp nào cũng theo thứ tự vòng
}

export function buildDeck(opts: DeckOptions): Card[] {
  const { cols, rows, symbols, rng } = opts;
  const total = cols * rows;
  // Bàn nhỏ nhất là 2 thẻ (màn tập của chiến dịch), không phải 4
  if (total < 2) throw new Error('Lưới không hợp lệ');

  const maxPairs = Math.floor(total / 2);
  const pairCount = Math.min(opts.pairs ?? maxPairs, maxPairs);
  if (pairCount < 1) throw new Error('Bàn phải có ít nhất 1 cặp');
  if (symbols.length < pairCount) {
    throw new Error(`Theme chỉ có ${symbols.length} biểu tượng, cần ${pairCount} cho lưới ${cols}x${rows}`);
  }
  const blanks = total - pairCount * 2;

  const picked = rng.sample(symbols, pairCount);
  const allowed = opts.allowedPowers?.length ? opts.allowedPowers : PLAYABLE_POWERS;
  // LÀM TRÒN LÊN, và luôn có ít nhất một cặp đặc biệt khi tỉ lệ > 0. Làm tròn
  // xuống thì bàn nhỏ ra 0: 6 cặp × 10% = 0,6 → 0, nên cấp đầu chiến dịch không
  // bao giờ thấy thẻ đặc biệt nào dù luật nói có 10%. Chặn dưới ở 3 cặp để bàn
  // 2 cặp (cấp tập) không bị nhồi hiệu ứng.
  const rate = Math.max(0, Math.min(1, opts.specialRate ?? 0));
  const specialCount = rate > 0 && pairCount >= 3
    // Trần cứng: nhiều hơn số loại × TRAN_MOI_LOAI thì không chia đều được nữa,
    // và bàn cũng chẳng còn chỗ cho trí nhớ.
    ? Math.min(Math.max(1, Math.round(pairCount * rate)), allowed.length * TRAN_MOI_LOAI)
    : 0;
  // Cặp nào mang hiệu ứng — chọn tất định theo seed
  const specialPairs = [...rng.sample([...picked.keys()], specialCount)];
  // Hiệu ứng của từng cặp đó, chia đều giữa các loại
  const powerOf = new Map<number, Power>();
  chiaPowers(allowed, specialPairs.length, rng).forEach((p, i) => powerOf.set(specialPairs[i]!, p));

  const draft: Omit<Card, 'index'>[] = [];
  picked.forEach((symbol, pairId) => {
    const power = powerOf.get(pairId);
    // Hiệu ứng chỉ gắn trên MỘT thẻ của cặp: lật đúng thẻ đó mới kích hoạt
    const carrier = rng.int(2);
    for (let k = 0; k < 2; k++) {
      draft.push(power && k === carrier ? { pairId, symbol, power } : { pairId, symbol });
    }
  });

  /*
   * XÁO ĐÚNG MỘT LẦN — NGẪU NHIÊN HOÀN TOÀN, không lọc gì.
   *
   * Trước đây xáo lại (tối đa 200 lần) cho tới khi không còn cặp nào nằm sát
   * nhau, vì xáo thuần thì ~83% ván có ít nhất một cặp kề (đo trên 200k ván) và
   * người chơi bắt được cặp đó ngay lượt đầu. Đã BỎ theo quyết định của chủ dự
   * án: để bàn thật sự ngẫu nhiên. Đừng "sửa lại" — đây là chủ ý, không phải
   * thiếu sót; có test canh phân bố đúng mức ngẫu nhiên.
   */
  const placed = layout(rng.shuffle(draft), blanks, cols, total);
  return placed.map((c, index) => ({ ...c, index }));
}

/**
 * Chèn ô trống cho vừa lưới, LUÔN đối xứng theo trục dọc — ô trống lệch một bên
 * làm bàn trông như bị khuyết, nhìn rất khó chịu lúc chia bài.
 *
 * Một ô trống: đặt đúng ô giữa bàn. Chỉ xảy ra khi tổng số ô lẻ, tức cả hai
 * cạnh đều lẻ, nên ô giữa đúng là tâm bàn.
 *
 * Nhiều ô trống (luôn CHẴN — gridForPairs đã tránh số lẻ ≥3): chia đều HAI ĐẦU
 * hàng cuối, để hàng cuối thành một hàng ngắn nằm giữa. Trước đây dồn cả cụm
 * vào giữa hàng cuối, lệch nửa ô khi (cols - blanks) lẻ.
 */
function layout(
  shuffled: Omit<Card, 'index'>[],
  blanks: number,
  cols: number,
  total: number
): Omit<Card, 'index'>[] {
  if (blanks <= 0) return shuffled;
  const blank = (): Omit<Card, 'index'> => ({ pairId: -1, symbol: '', blank: true });
  const out = shuffled.slice();
  if (blanks === 1) {
    out.splice(Math.floor(total / 2), 0, blank());
    return out;
  }
  const lastRowStart = total - cols;
  const left = Math.floor(blanks / 2);
  // Chèn bên PHẢI trước: chèn bên trái xong thì các chỉ số phía sau đã dịch
  for (let i = 0; i < blanks - left; i++) out.push(blank());
  for (let i = 0; i < left; i++) out.splice(lastRowStart, 0, blank());
  return out;
}

