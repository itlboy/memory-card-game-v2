import type { GameConfig, Mode } from './types.js';

export interface GridSpec { cols: number; rows: number; timeLimit: number }

/** Lưới dùng cho chế độ chơi nhanh. */
export const GRIDS: Record<string, GridSpec> = {
  // Lưới lẻ ô (3x3, 5x5) có ô trống ở chính giữa. Trần 8x8 = 32 cặp —
  // một theme 24 biểu tượng là không đủ, người chơi cần chọn thêm theme.
  '2x2': { cols: 2, rows: 2, timeLimit: 15 },
  '2x3': { cols: 2, rows: 3, timeLimit: 25 },
  '3x3': { cols: 3, rows: 3, timeLimit: 35 },
  '3x4': { cols: 3, rows: 4, timeLimit: 55 },
  '4x4': { cols: 4, rows: 4, timeLimit: 70 },
  '4x5': { cols: 4, rows: 5, timeLimit: 100 },
  '5x5': { cols: 5, rows: 5, timeLimit: 115 },
  '5x6': { cols: 5, rows: 6, timeLimit: 140 },
  '6x6': { cols: 6, rows: 6, timeLimit: 190 },
  '6x8': { cols: 6, rows: 8, timeLimit: 230 },
  '7x8': { cols: 7, rows: 8, timeLimit: 260 },
  '8x8': { cols: 8, rows: 8, timeLimit: 300 }
};

export type GridKey = keyof typeof GRIDS;

export interface PresetInput {
  mode: Mode;
  grid: string;
  symbols: readonly string[];
  seed: number;
  players?: GameConfig['players'];
}

/** Cấu hình mặc định cho từng chế độ (mục 3.1 / 3.2). */
export function presetConfig({ mode, grid, symbols, seed, players }: PresetInput): GameConfig {
  // Object.hasOwn: khoá như '__proto__' tra cứu ra Object.prototype (truthy)
  if (!Object.hasOwn(GRIDS, grid)) throw new Error(`Lưới ${grid} không được hỗ trợ`);
  const g = GRIDS[grid]!;

  const base: GameConfig = { mode, cols: g.cols, rows: g.rows, symbols, seed, players };
  // Multiplayer: mỗi người 15 giây cho lượt của mình
  if ((players?.length ?? 1) > 1) base.turnLimit = 15;
  switch (mode) {
    case 'classic':  return base;
    case 'time':     return { ...base, timeLimit: g.timeLimit };
    case 'survival': return { ...base, lives: 5, specialRate: 0.12 };
    case 'peek':     return { ...base, peekMs: 4000, timeLimit: g.timeLimit };
    case 'campaign': throw new Error('Campaign dùng levelConfig() thay cho presetConfig()');
  }
}
