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
  /**
   * CHẾ ĐỘ ĐỒNG ĐỘI (`GameConfig.teamFlip`, docs/che-do-dong-doi.md): "người chơi" này là một ĐỘI,
   * đây là mã hai thành viên theo thứ tự [A, B]. Không bật chế độ thì không có trường này.
   */
  thanhVien?: readonly string[];
}

export interface Player extends PlayerInit {
  score: number;
  pairs: number;
  /** Chuỗi ghép đúng liên tiếp hiện tại. */
  streak: number;
  /** Chuỗi dài nhất — dùng phá thế hoà (MP-04). */
  bestStreak: number;
  misses: number;
  /** Lật sai mà LẼ RA tránh được: lá cùng cặp với lá lật đầu đã từng lộ ra
   *  (cùng điều kiện mất mạng). Sao Chiến dịch đếm cái này, không đếm `misses` —
   *  lật hai lá chưa từng mở mà không khớp là đang dò, không phải lỗi. */
  quen?: number;
  /**
   * ĐIỂM TRÍ NHỚ — số đếm THÔ, chia theo ĐỘ LÂU (`scoring.nhomTuoi`: lá đôi lộ ra cách đây
   * 1 · 2–3 · 4–7 · 8–15 · 16+ nước). `nhoTheo` = ghép đúng khi lá đôi đã từng lộ; `quenTheo`
   * = cùng tình huống mà ghép sai (tổng của nó = `quen`). Ghép đúng do may không vào đây.
   * Thiếu = chưa có lần nào (hoặc server/bản lưu cũ). Điểm tính bằng `chiSoTriNho()`.
   * `mayTheo` (25.11.2026): PHẦN ĂN MAY của các cơ hội đó, cùng cách chia — mỗi cơ hội cộng 1/số lá còn úp lúc lật
   * lá thứ hai (xác suất đoán bừa mà trúng). Số THẬP PHÂN. Thiếu = ván chấm bằng engine cũ.
   */
  nhoTheo?: number[];
  quenTheo?: number[];
  mayTheo?: number[];
  /** Lần nhớ đúng XA nhất trong ván, tính bằng số nước. */
  tamNho?: number;
  lives: number;
  /** Số lượt bị khoá bởi thẻ đóng băng. */
  frozenTurns: number;
  /** Cặp kế tiếp được nhân đôi điểm (thẻ x2). */
  doubleNext: boolean;
  /** Đã bỏ cuộc / bị xử thua (online: rớt mạng quá 30 giây — ON-07). */
  forfeited?: boolean;
  /** ĐỒNG ĐỘI: số lượt đội ĐÃ BẮT ĐẦU, chẵn → thành viên [0] lật lá đầu, lẻ → [1]. */
  luotDoi?: number;
  /** ĐỒNG ĐỘI: thành viên đã rời hẳn — người còn lại lật cả hai lá. */
  vang?: string[];
  /** ĐỘI THEO LƯỢT (`teamTurn`): số cặp TỪNG THÀNH VIÊN tự ghép được, theo mã thành viên. */
  capTV?: Record<string, number>;
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
  /** Mốc điểm đạt 2 và 3 sao — cách CŨ, chỉ còn để ván dở trong bản lưu cũ
   *  khôi phục được. Màn Chiến dịch mới dùng `starMisses`. */
  starThresholds?: readonly [number, number];
  /** Số lần lật sai TỐI ĐA để đạt 2 và 3 sao (Chiến dịch). Có thì ưu tiên hơn
   *  `starThresholds`. */
  starMisses?: readonly [number, number];
  /**
   * CHẾ ĐỘ ĐỒNG ĐỘI "mỗi người một lá" (docs/che-do-dong-doi.md). Mỗi `players[i]` là một ĐỘI
   * (`thanhVien`); lá 1 do người lật trước của đội mở, lá 2 do người kia. `turnLimit` khi đó tính
   * cho TỪNG LÁ. Không có / false = ván như cũ, cùng nhánh code.
   */
  teamFlip?: boolean;
  /**
   * ĐỘI THEO LƯỢT (15.11.2026, thay "mỗi người một lá"): mỗi `players[i]` vẫn là một ĐỘI
   * (`thanhVien`, 1 người trở lên), nhưng MỖI LƯỢT của đội do MỘT thành viên lật CẢ HAI lá, lượt
   * sau của đội tới thành viên kế (A+B đấu C: A → C → B → C). Đồng hồ lượt y ván thường.
   */
  teamTurn?: boolean;
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
  /** Ngôi sao thứ 4 (Chiến dịch): thắng mà không QUÊN lần nào (`quen` = 0). */
  hoanHao?: boolean;
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
