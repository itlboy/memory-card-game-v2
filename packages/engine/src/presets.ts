import { levelSpec } from './campaign.js';
import type { GameConfig, Mode } from './types.js';

/**
 * Thời gian hé mở cả bàn ở chế độ Chớp nhoáng, giãn theo số thẻ. Trước đây cố
 * định 4 giây cho mọi cấp: bàn 4 thẻ thì thừa thãi, còn bàn 50 thẻ thì không ai
 * nhớ nổi. Neo ở 50 thẻ = 15 giây (2 + 0,26 mỗi thẻ), nên bàn 4 thẻ được 3 giây
 * và bàn 16 thẻ được hơn 6 giây.
 */
export const peekMsFor = (cards: number): number => 2_000 + Math.round(cards * 260);

export interface PresetInput {
  mode: Mode;
  /** Số màn (1..CAMPAIGN_LEVELS). Màn quyết định cỡ bàn và số cặp. */
  level: number;
  symbols: readonly string[];
  seed: number;
  players?: GameConfig['players'];
}

/**
 * Cấu hình một ván từ (chế độ, màn). MỌI chế độ đều đi qua đây — trước đây
 * Chiến dịch dựng bàn theo thang màn còn các chế độ khác chọn 1 trong 12 cỡ
 * bàn cố định, nên cùng một việc "chọn bàn" lại có hai kiểu, và chỉ Chiến
 * dịch mới có màn tiếp theo để chơi tiếp.
 */
export function presetConfig({ mode, level, symbols, seed, players }: PresetInput): GameConfig {
  const spec = levelSpec(level);

  const base: GameConfig = {
    mode, cols: spec.cols, rows: spec.rows, pairs: spec.pairs, symbols, seed, players
  };
  // Multiplayer: mỗi người 15 giây cho lượt của mình
  if ((players?.length ?? 1) > 1) base.turnLimit = 15;

  switch (mode) {
    case 'classic':  return base;
    case 'time':     return { ...base, timeLimit: spec.timeLimit };
    case 'survival': return { ...base, lives: 5, specialRate: 0.12 };
    case 'peek':     return { ...base, peekMs: peekMsFor(spec.pairs * 2), timeLimit: spec.timeLimit };
    // Chiến dịch: thêm thẻ đặc biệt tăng dần và mốc sao để xếp 1–3 sao
    case 'campaign': return {
      ...base,
      timeLimit: spec.timeLimit,
      specialRate: spec.specialRate,
      starThresholds: spec.starThresholds
    };
  }
}
