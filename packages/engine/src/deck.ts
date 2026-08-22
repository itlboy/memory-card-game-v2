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
}

export function buildDeck(opts: DeckOptions): Card[] {
  const { cols, rows, symbols, rng } = opts;
  const total = cols * rows;
  if (total < 4) throw new Error('Lưới không hợp lệ');

  // Lưới lẻ ô (3×3, 5×5...): ô chính giữa để trống, phần còn lại chia cặp
  const hasBlank = total % 2 === 1;
  const pairCount = Math.floor(total / 2);
  if (symbols.length < pairCount) {
    throw new Error(`Theme chỉ có ${symbols.length} biểu tượng, cần ${pairCount} cho lưới ${cols}x${rows}`);
  }

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
  let placed = layout(rng.shuffle(draft), hasBlank, total);
  for (let tries = 0; tries < MAX_SHUFFLE_TRIES && adjacentPairs(placed, cols, rows) > 0; tries++) {
    placed = layout(rng.shuffle(draft), hasBlank, total);
  }
  return placed.map((c, index) => ({ ...c, index }));
}

/** Số lần xáo lại tối đa — lưới nhỏ (2×2) chỉ có 1/3 cách xếp không kề nhau,
 *  nên cần dư; hết lượt vẫn còn cặp kề thì nhận bàn cuối, không bao giờ treo. */
const MAX_SHUFFLE_TRIES = 200;

/** Chèn ô trống vào chính giữa lưới để bố cục cân đối. */
function layout(
  shuffled: Omit<Card, 'index'>[],
  hasBlank: boolean,
  total: number
): Omit<Card, 'index'>[] {
  if (!hasBlank) return shuffled;
  const out = shuffled.slice();
  out.splice(Math.floor(total / 2), 0, { pairId: -1, symbol: '', blank: true });
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
