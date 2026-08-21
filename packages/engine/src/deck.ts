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
  if (total <= 0) throw new Error('Lưới không hợp lệ');
  if (total % 2 !== 0) throw new Error(`Lưới ${cols}x${rows} có số ô lẻ, không chia được thành cặp`);

  const pairCount = total / 2;
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

  return rng.shuffle(draft).map((c, index) => ({ ...c, index }));
}

/** Đổi chỗ các thẻ chưa mở, giữ nguyên vị trí thẻ đã ghép (thẻ "xáo trộn"). */
export function reshuffleHidden(cards: Card[], hiddenIndices: readonly number[], rng: Rng): number[] {
  const shuffled = rng.shuffle(hiddenIndices);
  const snapshot = hiddenIndices.map((i) => cards[i]!);
  hiddenIndices.forEach((slot, k) => {
    const from = shuffled.indexOf(slot);
    cards[slot] = { ...snapshot[from]!, index: slot };
  });
  return [...hiddenIndices];
}
