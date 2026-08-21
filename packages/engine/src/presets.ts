import type { GameConfig, Mode } from './types.js';

export interface GridSpec { cols: number; rows: number; timeLimit: number }

/** Lưới dùng cho chế độ chơi nhanh. */
export const GRIDS: Record<string, GridSpec> = {
  '2x2': { cols: 2, rows: 2, timeLimit: 15 },
  '3x3': { cols: 3, rows: 3, timeLimit: 35 },   // ô giữa để trống, 4 cặp
  '4x4': { cols: 4, rows: 4, timeLimit: 70 },
  '4x5': { cols: 4, rows: 5, timeLimit: 100 },
  '6x6': { cols: 6, rows: 6, timeLimit: 190 }
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
  const g = GRIDS[grid];
  if (!g) throw new Error(`Lưới ${grid} không được hỗ trợ`);

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
