import { levelSpec } from './campaign.js';
import type { GameConfig, Mode } from './types.js';

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
    case 'peek':     return { ...base, peekMs: 4000, timeLimit: spec.timeLimit };
    // Chiến dịch: thêm thẻ đặc biệt tăng dần và mốc sao để xếp 1–3 sao
    case 'campaign': return {
      ...base,
      timeLimit: spec.timeLimit,
      specialRate: spec.specialRate,
      starThresholds: spec.starThresholds
    };
  }
}
