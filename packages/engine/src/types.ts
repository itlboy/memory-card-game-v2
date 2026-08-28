export type Mode = 'classic' | 'time' | 'campaign' | 'survival' | 'peek';

/** Hiệu ứng gắn trên một thẻ đơn lẻ, kích hoạt ngay khi thẻ đó được lật (mục 3.4). */
/** 'bomb' còn trong kiểu nhưng ĐANG TẮT — xem PLAYABLE_POWERS trong deck.ts.
 *  Giữ lại để bản lưu cũ (snapshot, phòng online đang chạy) đọc được. */
export type Power = 'bomb' | 'swap' | 'x2' | 'eye' | 'freeze';

export interface Card {
  readonly index: number;
  readonly pairId: number;
  readonly symbol: string;
  /** Hiệu ứng đặc biệt, chỉ gắn trên 1 trong 2 thẻ của cặp. */
  readonly power?: Power;
  /** Hiệu ứng đã dùng — thẻ chỉ kích hoạt một lần. */
  powerUsed?: boolean;
  /** Ô trống (lưới lẻ ô như 3×3) — không lật được, không thuộc cặp nào. */
  readonly blank?: boolean;
}

export interface PlayerInit {
  id: string;
  name: string;
  avatar?: string;
}

export interface Player extends PlayerInit {
  score: number;
  pairs: number;
  /** Chuỗi ghép đúng liên tiếp hiện tại. */
  streak: number;
  /** Chuỗi dài nhất — dùng phá thế hoà (MP-04). */
  bestStreak: number;
  misses: number;
  lives: number;
  /** Số lượt bị khoá bởi thẻ đóng băng. */
  frozenTurns: number;
  /** Cặp kế tiếp được nhân đôi điểm (thẻ x2). */
  doubleNext: boolean;
  /** Đã bỏ cuộc / bị xử thua (online: rớt mạng quá 30 giây — ON-07). */
  forfeited?: boolean;
}

export interface GameConfig {
  mode: Mode;
  cols: number;
  rows: number;
  /** Bộ biểu tượng của theme; cần ít nhất cols*rows/2 phần tử. */
  symbols: readonly string[];
  seed: number;
  /** 1 người = chơi đơn; 2–10 người = local/online multiplayer. */
  players?: readonly PlayerInit[];
  /** Giới hạn thời gian (giây). null = không giới hạn. */
  timeLimit?: number | null;
  /** Giới hạn số lượt lật. null = không giới hạn. */
  moveLimit?: number | null;
  /** Số mạng (Survival). null = không dùng mạng. */
  lives?: number | null;
  /** Thời gian hé mở đầu ván, ms (Peek). 0 = tắt. */
  peekMs?: number;
  /** Số cặp thật của bàn. Thiếu thì lấy floor(cols*rows/2) như trước.
   *  Có tham số này vì bàn được phép chừa vài ô trống, để số thẻ tăng đúng 2
   *  mỗi màn chiến dịch. */
  pairs?: number;
  /** Tỉ lệ cặp mang thẻ đặc biệt, 0–1 (mặc định 0 = tắt). */
  specialRate?: number;
  /**
   * Số lần XÁO THẺ trong cả ván (tuỳ chọn "Xáo thẻ"). 0 = tắt.
   *
   * Mỗi lần: hai thẻ chưa ghép đổi chỗ cho nhau. Trải đều theo số nước đi, xem
   * `shuffleEvery` trong game.ts. Đây là tuỳ chọn duy nhất đánh thẳng vào trí
   * nhớ vị trí thay vì vào đồng hồ, nên mặc định TẮT.
   */
  shuffleCount?: number;
  /** Độ trễ úp lại 2 thẻ khác nhau, ms. */
  flipBackMs?: number;
  /** Giới hạn mỗi lượt (giây) — multiplayer. null = không giới hạn. */
  turnLimit?: number | null;
  /** Xáo thứ tự người chơi khi vào ván (mặc định bật) — ai đi trước là ngẫu nhiên. */
  shufflePlayers?: boolean;
  /** Mốc điểm đạt 2 và 3 sao (Campaign). */
  starThresholds?: readonly [number, number];
}

export type GameStatus = 'idle' | 'peeking' | 'playing' | 'won' | 'lost';

export interface Summary {
  status: 'won' | 'lost';
  reason: 'cleared' | 'timeout' | 'no-moves' | 'no-lives' | 'forfeit';
  score: number;
  moves: number;
  seconds: number;
  timeBonus: number;
  bestStreak: number;
  stars: 0 | 1 | 2 | 3;
  /** Xếp hạng người chơi (multiplayer), đã sắp giảm dần. */
  ranking: Player[];
}

/** Sự kiện engine phát ra để lớp UI vẽ animation / phát âm thanh. */
export type GameEvent =
  | { type: 'flip'; index: number }
  | { type: 'match'; indices: [number, number]; gained: number; playerId: string }
  | { type: 'miss'; indices: [number, number]; penalty: number; hideAfterMs: number }
  | { type: 'power'; power: Power; index: number; affected: number[] }
  | { type: 'peek-end' }
  /** Hai thẻ vừa bị XÁO đổi chỗ (tuỳ chọn "Xáo thẻ"). UI phải chỉ rõ hai ô nào,
   *  không thì người chơi tưởng mình nhớ sai. */
  | { type: 'shuffle'; affected: [number, number] }
  | { type: 'turn'; playerId: string; skipped: boolean }
  | { type: 'turn-timeout'; playerId: string }
  | { type: 'time-bonus'; playerId: string; ms: number }
  | { type: 'life-lost'; playerId: string; livesLeft: number }
  | { type: 'life-gain'; playerId: string; livesLeft: number }
  | { type: 'end'; summary: Summary };
