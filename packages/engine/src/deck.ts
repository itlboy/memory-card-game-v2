import { Rng } from './rng.js';
import type { Card, Power } from './types.js';

const POWERS: readonly Power[] = ['bomb', 'x2', 'eye', 'freeze'];

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

export function buildDeck(opts: DeckOptions): Card[] {
  const { cols, rows, symbols, rng } = opts;
  const total = cols * rows;
  if (total < 4) throw new Error('Lưới không hợp lệ');

  const maxPairs = Math.floor(total / 2);
  const pairCount = Math.min(opts.pairs ?? maxPairs, maxPairs);
  if (pairCount < 2) throw new Error('Bàn phải có ít nhất 2 cặp');
  if (symbols.length < pairCount) {
    throw new Error(`Theme chỉ có ${symbols.length} biểu tượng, cần ${pairCount} cho lưới ${cols}x${rows}`);
  }
  const blanks = total - pairCount * 2;

  const picked = rng.sample(symbols, pairCount);
  const allowed = opts.allowedPowers?.length ? opts.allowedPowers : POWERS;
  const specialCount = Math.floor(pairCount * Math.max(0, Math.min(1, opts.specialRate ?? 0)));
  // Cặp nào mang hiệu ứng — chọn tất định theo seed
  const specialPairs = new Set(rng.sample([...picked.keys()], specialCount));

  const draft: Omit<Card, 'index'>[] = [];
  picked.forEach((symbol, pairId) => {
    const power = specialPairs.has(pairId) ? allowed[rng.int(allowed.length)]! : undefined;
    // Hiệu ứng chỉ gắn trên MỘT thẻ của cặp: lật đúng thẻ đó mới kích hoạt
    const carrier = rng.int(2);
    for (let k = 0; k < 2; k++) {
      draft.push(power && k === carrier ? { pairId, symbol, power } : { pairId, symbol });
    }
  });

  // Xáo cho đến khi không còn cặp nào nằm sát nhau. Xáo thuần ngẫu nhiên để
  // ~83% ván có cặp kề nhau (đo trên 200k ván) — người chơi bắt được cặp đó
  // ngay lượt đầu nên ván mất hết vị "trí nhớ". Vẫn tất định: mọi lần xáo lại
  // đều rút từ cùng một Rng theo seed.
  // NGOẠI LỆ lưới nhỏ: 2×2 chỉ có 3 cách xếp và đúng MỘT cách không kề nhau
  // (hai cặp chéo góc), nên áp luật vào đây là ván nào cũng y hệt ván nào —
  // đoán được 100%, tệ hơn cả việc có cặp nằm cạnh.
  let placed = layout(rng.shuffle(draft), blanks, cols, total);
  if (pairCount >= 3) {
    for (let tries = 0; tries < MAX_SHUFFLE_TRIES && adjacentPairs(placed, cols, rows) > 0; tries++) {
      placed = layout(rng.shuffle(draft), blanks, cols, total);
    }
  }
  return placed.map((c, index) => ({ ...c, index }));
}

/** Số lần xáo lại tối đa — lưới nhỏ (2×2) chỉ có 1/3 cách xếp không kề nhau,
 *  nên cần dư; hết lượt vẫn còn cặp kề thì nhận bàn cuối, không bao giờ treo. */
const MAX_SHUFFLE_TRIES = 200;

/**
 * Chèn ô trống cho vừa lưới. Một ô trống (lưới lẻ như 3×3) đặt chính giữa bàn
 * như trước. Nhiều ô trống thì dồn vào GIỮA HÀNG CUỐI: hàng cuối ngắn lại
 * nhưng vẫn cân hai bên, thay vì rải rác làm bàn nhìn như bị khuyết.
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
  const offset = Math.floor((cols - blanks) / 2);
  for (let i = 0; i < blanks; i++) out.splice(lastRowStart + offset + i, 0, blank());
  return out;
}

/** Đếm số cặp có hai thẻ nằm sát nhau theo hàng hoặc cột. */
function adjacentPairs(
  cards: readonly Omit<Card, 'index'>[],
  cols: number,
  rows: number
): number {
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cards[r * cols + c]?.pairId;
      if (id === undefined || id < 0) continue;   // ô trống không tính
      if (c + 1 < cols && cards[r * cols + c + 1]?.pairId === id) count++;
      if (r + 1 < rows && cards[(r + 1) * cols + c]?.pairId === id) count++;
    }
  }
  return count;
}
