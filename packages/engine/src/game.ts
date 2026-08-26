import { buildDeck } from './deck.js';
import { Rng } from './rng.js';
import {
  FLIP_BACK_MS, MATCH_TIME_BONUS_MS, TURN_BONUS_MS,
  comboMultiplier, pairScore, rankPlayers, starsFor, timeBonus
} from './scoring.js';
import type {
  Card, GameConfig, GameEvent, GameStatus, Player, PlayerInit, Power, Summary
} from './types.js';

/** Chơi đơn không có 'freeze' (không có đối thủ để đóng băng). */
const SOLO_POWERS: readonly Power[] = ['swap', 'x2', 'eye'];

/** Avatar mặc định cho ván nhiều người cùng máy. Gán theo SEED (không phải theo
 *  thứ tự) nên mỗi ván mới là một bộ khác — nhưng F5 giữa ván hay khôi phục từ
 *  snapshot vẫn ra đúng bộ cũ, vì cùng seed. */
const AVATARS: readonly string[] = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐧', '🦁', '🐨', '🐮', '🐷'];

function makePlayer(init: PlayerInit, lives: number | null): Player {
  return {
    ...init,
    score: 0, pairs: 0, streak: 0, bestStreak: 0, misses: 0,
    lives: lives ?? Infinity, frozenTurns: 0, doubleNext: false
  };
}

/**
 * Engine luật chơi — thuần logic, không phụ thuộc DOM/framework.
 *
 * Mọi hàm nhận thời điểm `now` (ms) từ bên ngoài và mọi ngẫu nhiên đi qua `seed`,
 * nên cùng input luôn cho cùng output: client và server (Durable Object) chạy
 * cùng engine này và không bao giờ lệch trạng thái.
 */
export class MemoryGame {
  readonly config: Required<Pick<GameConfig, 'mode' | 'cols' | 'rows' | 'seed'>> & GameConfig;
  readonly cards: Card[];
  readonly players: Player[];

  status: GameStatus = 'idle';
  /** Chỉ số các thẻ đang mở trong lượt hiện tại (tối đa 2). */
  selection: number[] = [];
  /** pairId đã ghép xong. */
  matched = new Set<number>();
  turnIndex = 0;
  moves = 0;
  startedAt: number | null = null;
  endedAt: number | null = null;
  /** Thời điểm hết hé mở toàn bàn (Peek / thẻ mắt thần). */
  revealUntil = 0;
  /** Chờ úp lại 2 thẻ khác nhau đến thời điểm này. */
  private pendingUntil = 0;
  /** Hạn chót của lượt hiện tại (ms). 0 = không dùng đồng hồ lượt. */
  turnDeadline = 0;
  /** Thời gian được cộng thêm nhờ ghép đúng (Đua thời gian). Tách khỏi
   *  `startedAt` để `elapsed()` vẫn là thời gian thực đã chơi. */
  private extraTimeMs = 0;
  /** Số lần đã xáo thẻ trong ván này (tuỳ chọn "Xáo thẻ"). */
  private shuffled = 0;
  private rng: Rng;
  private summaryCache: Summary | null = null;
  /** Các ô người chơi ĐÃ TỪNG thấy mặt trước. Dùng để phán xử lỗi trong Sinh tồn:
   *  lật hai thẻ mới toanh là phỏng đoán hợp lý, không phải sai sót. */
  private seen = new Set<number>();

  constructor(config: GameConfig) {
    this.config = { flipBackMs: FLIP_BACK_MS, ...config };
    this.rng = new Rng(config.seed);
    this.cards = buildDeck({
      cols: config.cols,
      rows: config.rows,
      pairs: config.pairs,
      symbols: config.symbols,
      rng: this.rng,
      specialRate: config.specialRate ?? 0,
      // 'freeze' chỉ có nghĩa khi có đối thủ
      allowedPowers: (config.players?.length ?? 1) > 1 ? undefined : SOLO_POWERS
    });
    const inits = config.players?.length
      ? config.players
      : [{ id: 'p1', name: 'Bạn' }];
    let players = inits.map((p) => makePlayer(p, config.lives ?? null));
    // Avatar: chỉ gán cho người chưa có (online do server tự đặt). Rút từ danh
    // sách đã xáo theo seed để mỗi ván một bộ khác nhau.
    if (players.some((p) => !p.avatar)) {
      const picked = this.rng.sample(AVATARS, players.length);
      players = players.map((p, i) => (p.avatar ? p : { ...p, avatar: picked[i] }));
    }
    // Thứ tự đi ngẫu nhiên theo seed — chủ phòng không mặc nhiên đi trước.
    // Tất định theo seed nên server/client và snapshot/restore vẫn khớp nhau.
    if (players.length > 1 && config.shufflePlayers !== false) {
      players = this.rng.shuffle(players);
    }
    this.players = players;
  }

  /* ---------- truy vấn ---------- */

  /** Đếm thẻ THẬT: bàn có thể chừa ô trống nên cards.length/2 không còn đúng. */
  get totalPairs(): number { return this.cards.filter((c) => !c.blank).length / 2; }
  get current(): Player { return this.players[this.turnIndex]!; }
  get isMultiplayer(): boolean { return this.players.length > 1; }
  get finished(): boolean { return this.status === 'won' || this.status === 'lost'; }
  get locked(): boolean { return this.pendingUntil > 0; }
  get revealingAll(): boolean { return this.status === 'peeking' || this.revealUntil > 0; }

  elapsed(now: number): number {
    if (this.startedAt === null) return 0;
    return ((this.endedAt ?? now) - this.startedAt) / 1000;
  }

  timeLeft(now: number): number | null {
    const limit = this.config.timeLimit ?? null;
    return limit === null ? null : Math.max(0, limit + this.extraTimeMs / 1000 - this.elapsed(now));
  }

  /** Giây còn lại của lượt hiện tại; null nếu không dùng đồng hồ lượt. */
  turnTimeLeft(now: number): number | null {
    if (!this.turnDeadline || this.finished) return null;
    return Math.max(0, (this.turnDeadline - now) / 1000);
  }

  private get turnLimitMs(): number {
    return this.isMultiplayer && this.config.turnLimit ? this.config.turnLimit * 1000 : 0;
  }

  private armTurnClock(now: number): void {
    if (this.turnLimitMs) this.turnDeadline = now + this.turnLimitMs;
  }

  movesLeft(): number | null {
    const limit = this.config.moveLimit ?? null;
    return limit === null ? null : Math.max(0, limit - this.moves);
  }

  isMatched(index: number): boolean { return this.matched.has(this.cards[index]!.pairId); }
  isFaceUp(index: number): boolean {
    if (this.cards[index]!.blank) return false;
    return this.revealingAll || this.selection.includes(index) || this.isMatched(index);
  }

  /** Bắt đầu ván (khởi động timer, mở màn hé thẻ nếu là Peek). */
  start(now: number): GameEvent[] {
    if (this.status !== 'idle') return [];
    this.startedAt = now;
    const peek = this.config.peekMs ?? 0;
    if (peek > 0) {
      this.status = 'peeking';
      this.revealUntil = now + peek;
    } else {
      this.status = 'playing';
      this.armTurnClock(now);
    }
    return [];
  }

  /**
   * Nhịp đồng hồ: kết thúc hé mở, úp lại thẻ đang chờ, kiểm tra hết thời gian.
   * UI gọi mỗi frame/200ms; server gọi khi có alarm.
   */
  tick(now: number): GameEvent[] {
    const out: GameEvent[] = [];
    if (this.finished) return out;

    if (this.revealUntil > 0 && now >= this.revealUntil) {
      this.revealUntil = 0;
      // Peek chỉ tính thời gian từ lúc thẻ úp lại xuống
      if (this.status === 'peeking') { this.status = 'playing'; this.startedAt = now; this.armTurnClock(now); }
      out.push({ type: 'peek-end' });
    }

    if (this.pendingUntil > 0 && now >= this.pendingUntil) {
      out.push(...this.resolvePending(now));
    }

    // Hết giờ lượt (multiplayer): huỷ thẻ đang mở dở, mất combo, chuyển lượt.
    // Không xử khi đang khoá — lượt đằng nào cũng sắp chuyển ở resolvePending.
    if (this.status === 'playing' && !this.locked && this.turnDeadline && now >= this.turnDeadline) {
      const player = this.current;
      player.streak = 0;
      this.selection = [];
      out.push({ type: 'turn-timeout', playerId: player.id });
      out.push(...this.nextTurn(now));
    }

    const left = this.timeLeft(now);
    if (left !== null && left <= 0 && this.status === 'playing') {
      out.push(...this.end('lost', 'timeout', now));
    }
    return out;
  }

  /**
   * Lật thẻ tại `index`. Trả về danh sách sự kiện cho UI; rỗng nếu hành động không hợp lệ.
   * Đây là hàm duy nhất client được phép gọi ở chế độ online — server phán quyết kết quả.
   */
  flip(index: number, now: number): GameEvent[] {
    if (this.status === 'idle') this.start(now);
    if (this.status !== 'playing' || this.locked) return [];
    // NaN/số thực/chuỗi vượt qua được cả hai phép so sánh biên — phải chặn tường minh
    if (!Number.isInteger(index) || index < 0 || index >= this.cards.length) return [];
    if (this.cards[index]!.blank) return [];
    if (this.isMatched(index) || this.selection.includes(index)) return [];
    if (this.selection.length >= 2) return [];

    const out: GameEvent[] = [{ type: 'flip', index }];
    this.selection.push(index);

    const card = this.cards[index]!;
    if (card.power && !card.powerUsed) out.push(...this.trigger(card, now));

    if (this.selection.length < 2) return out;

    const [a, b] = this.selection as [number, number];
    this.moves++;
    const player = this.current;

    if (this.cards[a]!.pairId === this.cards[b]!.pairId) {
      player.streak++;
      player.bestStreak = Math.max(player.bestStreak, player.streak);
      const gained = pairScore(player.streak, player.doubleNext);
      player.doubleNext = false;
      player.score += gained;
      player.pairs++;
      this.matched.add(this.cards[a]!.pairId);
      this.seen.add(a);
      this.seen.add(b);
      this.selection = [];
      out.push({ type: 'match', indices: [a, b], gained, playerId: player.id });

      // Sinh tồn: đang nguy (dưới 2 mạng) mà ghép đúng hai lần liên tiếp thì
      // được hồi 1 mạng. Chỉ hồi khi đang nguy — nếu không thì người chơi giỏi
      // cứ thế tích mạng và chế độ mất hết sức ép.
      if (this.config.lives != null && player.lives < 2 && player.streak >= 2 && player.streak % 2 === 0) {
        player.lives++;
        out.push({ type: 'life-gain', playerId: player.id, livesLeft: player.lives });
      }
      if (this.turnDeadline) {
        // +5 giây nhưng không vượt trần 15 giây tính từ bây giờ
        this.turnDeadline = Math.min(this.turnDeadline + TURN_BONUS_MS, now + this.turnLimitMs);
        out.push({ type: 'time-bonus', playerId: player.id, ms: TURN_BONUS_MS });
      }
      // Đua thời gian: ghép đúng được thêm giây vào đồng hồ chung. Giữ RIÊNG
      // trong extraTimeMs, không cộng vào startedAt — làm thế thì `elapsed()`
      // ngắn đi và thời gian hoàn thành ghi vào kỷ lục sẽ sai.
      if (this.config.timeLimit != null) {
        this.extraTimeMs += MATCH_TIME_BONUS_MS;
        out.push({ type: 'time-bonus', playerId: player.id, ms: MATCH_TIME_BONUS_MS });
      }

      if (this.matched.size === this.totalPairs) {
        out.push(...this.end('won', 'cleared', now));
      } else if (this.movesLeft() === 0) {
        out.push(...this.end('lost', 'no-moves', now));
      }
      return out;
    }

    // Lật sai
    player.streak = 0;
    player.misses++;
    // Không còn phạt điểm khi lật sai. Trước đây chỉ chế độ Cổ điển trừ 10
    // điểm, và đó là chỗ DUY NHẤT CÒN LẠI trong engine đọc `config.mode` — bỏ
    // nó đi thì `mode` chỉ còn là khoá lưu kỷ lục, không còn là luật chơi.
    const penalty = 0;

    // Chỉ mất mạng khi ĐÁNG mất: thẻ vừa mở đã có thẻ trùng lộ ra từ trước, tức
    // người chơi có đủ thông tin để ghép đúng mà vẫn trượt. Lật hai thẻ chưa ai
    // từng thấy là bước dò cần thiết của trò chơi, trừ mạng ở đó là bất công.
    const avoidable = this.hasKnownTwin(a) || this.hasKnownTwin(b);
    if (this.config.lives != null && avoidable) {
      player.lives--;
      out.push({ type: 'life-lost', playerId: player.id, livesLeft: player.lives });
    }
    this.seen.add(a);
    this.seen.add(b);

    this.pendingUntil = now + (this.config.flipBackMs ?? FLIP_BACK_MS);
    out.push({ type: 'miss', indices: [a, b], penalty, hideAfterMs: this.config.flipBackMs ?? FLIP_BACK_MS });

    if (this.config.lives != null && avoidable && player.lives <= 0) {
      out.push(...this.end('lost', 'no-lives', now));
    } else if (this.movesLeft() === 0) {
      out.push(...this.end('lost', 'no-moves', now));
    }
    return out;
  }

  /** Thẻ ở `index` có thẻ trùng nào ĐÃ từng lộ ra trước lượt này không? */
  private hasKnownTwin(index: number): boolean {
    const pairId = this.cards[index]!.pairId;
    return this.cards.some((c) => c.index !== index && c.pairId === pairId && this.seen.has(c.index));
  }

  /** Úp lại 2 thẻ khác nhau và chuyển lượt. Gọi khi hết `flipBackMs`. */
  resolvePending(now: number): GameEvent[] {
    if (this.pendingUntil === 0) return [];
    this.pendingUntil = 0;
    this.selection = [];
    const out: GameEvent[] = [];

    out.push(...this.maybeShuffle());
    if (!this.finished && this.isMultiplayer) out.push(...this.nextTurn(now));
    return out;
  }

  /**
   * Cách nhau bao nhiêu NƯỚC ĐI thì xáo một lần.
   *
   * Một ván dọn sạch bàn tốn cỡ 2 nước mỗi cặp, nên chia quãng đó cho số lần
   * xáa muốn có. Sàn 2 nước: dày hơn nữa thì bàn đổi chỗ gần như mỗi lượt, trí
   * nhớ thành vô dụng và ván biến thành đỏ đen — đúng thứ trò chơi này không
   * nên trở thành.
   */
  private get shuffleEvery(): number {
    const lan = this.config.shuffleCount ?? 0;
    if (lan <= 0) return 0;
    return Math.max(2, Math.round((this.totalPairs * 2) / lan));
  }

  /**
   * Xáo thẻ nếu tới nhịp: hai thẻ CHƯA GHÉP đổi chỗ cho nhau.
   *
   * Khác thẻ đặc biệt Tráo đổi ở chỗ KHÔNG đòi thẻ phải "đã từng lộ ra": đây là
   * luật của cả bàn, người chơi biết trước là bàn sẽ động, nên xáo cả thẻ chưa ai
   * mở vẫn công bằng. Vẫn không đụng thẻ đang mở dở (thấy nội dung nhảy chỗ
   * trước mắt là vô lý) và thẻ đã ghép.
   */
  private maybeShuffle(): GameEvent[] {
    const nhip = this.shuffleEvery;
    if (!nhip || this.finished) return [];
    const lan = this.config.shuffleCount ?? 0;
    if (this.shuffled >= lan) return [];
    if (this.moves === 0 || this.moves % nhip !== 0) return [];

    const duoc = this.cards
      .filter((c) => !c.blank && !this.isMatched(c.index) && !this.selection.includes(c.index))
      .map((c) => c.index);
    if (duoc.length < 2) return [];

    const [a, b] = this.rng.sample(duoc, 2) as [number, number];
    this.swapCards(a, b);
    this.shuffled++;
    return [{ type: 'shuffle', affected: [a, b] }];
  }

  /** Chuyển lượt, bỏ qua người đang bị đóng băng (MP-02, thẻ freeze). */
  private nextTurn(now: number): GameEvent[] {
    const out: GameEvent[] = [];
    for (let guard = 0; guard < this.players.length + 1; guard++) {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      const p = this.current;
      if (p.forfeited) continue;
      if (p.frozenTurns > 0) {
        p.frozenTurns--;
        out.push({ type: 'turn', playerId: p.id, skipped: true });
        continue;
      }
      out.push({ type: 'turn', playerId: p.id, skipped: false });
      this.armTurnClock(now);
      return out;
    }
    return out;
  }

  /**
   * Đổi chỗ hai thẻ trên bàn. Phải sửa cả `index` của chúng (index LÀ vị trí,
   * UI và mọi luật đều tra theo nó) và cả tập `seen` — "đã từng lộ ra" thuộc về
   * LÁ BÀI chứ không thuộc về ô, nếu không thì Sinh tồn trừ mạng oan.
   */
  private swapCards(a: number, b: number): void {
    const ca = this.cards[a]!, cb = this.cards[b]!;
    // index là readonly nên dựng bản sao thay vì gán — spread giữ nguyên
    // powerUsed và mọi trường khác
    this.cards[a] = { ...cb, index: a };
    this.cards[b] = { ...ca, index: b };
    const sa = this.seen.has(a), sb = this.seen.has(b);
    if (sa !== sb) {
      // Chỉ một trong hai từng lộ: chuyển dấu đó sang ô mới của lá bài đó
      this.seen.delete(sa ? a : b);
      this.seen.add(sa ? b : a);
    }
  }

  /** Kích hoạt thẻ đặc biệt (mục 3.4). */
  private trigger(card: Card, now: number): GameEvent[] {
    card.powerUsed = true;
    const power = card.power!;
    const player = this.current;
    let affected: number[] = [];

    switch (power) {
      case 'bomb': {
        // Úp lại 2 cặp đã mở, chọn tất định theo seed
        const open = [...this.matched];
        const victims = this.rng.sample(open, Math.min(2, open.length));
        for (const pairId of victims) this.matched.delete(pairId);
        affected = this.cards.filter((c) => victims.includes(c.pairId)).map((c) => c.index);
        player.pairs = Math.max(0, player.pairs - victims.length);
        break;
      }
      case 'swap': {
        /*
         * ƯU TIÊN thẻ ĐÃ TỪNG LỘ RA — tráo thứ người chơi đang nhớ mới là cái
         * làm nên thẻ này. Nhưng KHÔNG được đứng im khi chưa lộ thẻ nào: bốc
         * trúng lá tráo ngay nước đầu (rất dễ xảy ra sau màn xem trước, lúc bàn
         * vừa úp lại) thì người chơi bấm mà chẳng thấy gì xảy ra, và họ kết luận
         * là nút hỏng. Không có thẻ nào đã lộ thì tráo cả thẻ chưa mở.
         *
         * Cả hai nhánh đều tránh thẻ đang mở dở (thấy nội dung nhảy chỗ trước
         * mắt là vô lý) và thẻ đã ghép xong.
         */
        const conTrenBan = this.cards
          .filter((c) => !c.blank
            && !this.isMatched(c.index)
            && !this.selection.includes(c.index))
          .map((c) => c.index);
        const daLo = conTrenBan.filter((i) => this.seen.has(i));
        const swappable = daLo.length >= 2 ? daLo : conTrenBan;
        if (swappable.length < 2) {
          // Cả bàn không còn nổi hai thẻ để tráo (cuối ván): ĐỂ DÀNH thẻ này cho
          // lần sau thay vì tiêu nó vào một cú tráo không có gì để tráo.
          card.powerUsed = false;
          return [];
        }
        const [a, b] = this.rng.sample(swappable, 2) as [number, number];
        this.swapCards(a, b);
        affected = [a, b];
        break;
      }
      case 'x2':
        player.doubleNext = true;
        break;
      case 'eye':
        // 5 giây, không phải 2: bàn 40 thẻ thì 2 giây chỉ đủ đưa mắt qua một
        // góc, thẻ đắt nhất bàn mà gần như không dùng được.
        this.revealUntil = now + 5000;
        affected = this.cards.map((c) => c.index);
        break;
      case 'freeze': {
        const next = this.players[(this.turnIndex + 1) % this.players.length]!;
        if (next !== player) next.frozenTurns++;
        break;
      }
    }
    return [{ type: 'power', power, index: card.index, affected }];
  }

  private end(status: 'won' | 'lost', reason: Summary['reason'], now: number): GameEvent[] {
    if (this.finished) return [];
    this.status = status;
    this.endedAt = now;
    this.pendingUntil = 0;
    this.turnDeadline = 0;
    this.selection = [];

    const seconds = Math.round(this.elapsed(now));
    let bonus = 0;
    // Thưởng thời gian chỉ áp dụng cho chơi đơn (multiplayer tính điểm theo cặp)
    if (status === 'won' && this.config.timeLimit != null && !this.isMultiplayer) {
      bonus = timeBonus(this.config.timeLimit - seconds);
      this.players[0]!.score += bonus;
    }

    const ranking = rankPlayers(this.players);
    const leader = ranking[0]!;

    this.summaryCache = {
      status, reason, seconds, timeBonus: bonus,
      score: leader.score,
      moves: this.moves,
      bestStreak: leader.bestStreak,
      stars: status === 'won' ? starsFor(leader.score, this.config.starThresholds) : 0,
      ranking
    };
    return [{ type: 'end', summary: this.summaryCache }];
  }

  /**
   * Xử thua một người chơi (online: rớt mạng quá hạn — ON-07).
   * Còn lại 1 người thì ván kết thúc và người đó thắng.
   */
  forfeit(playerId: string, now: number): GameEvent[] {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.forfeited || this.finished) return [];
    player.forfeited = true;

    const active = this.players.filter((p) => !p.forfeited);
    if (this.isMultiplayer && active.length <= 1) {
      return this.end('won', 'forfeit', now);
    }
    // Đang tới lượt người bỏ cuộc thì huỷ lựa chọn dở và chuyển lượt
    if (this.current.id === playerId) {
      this.selection = [];
      this.pendingUntil = 0;
      return this.nextTurn(now);
    }
    return [];
  }

  /**
   * Ảnh chụp toàn bộ trạng thái để lưu trữ (Durable Object hibernation).
   * `restore()` dựng lại đúng ván này, kể cả trạng thái sinh ngẫu nhiên.
   */
  snapshot(): string {
    return JSON.stringify({
      config: this.config,
      cards: this.cards,
      players: this.players.map((p) => ({ ...p, lives: p.lives === Infinity ? null : p.lives })),
      status: this.status,
      selection: this.selection,
      matched: [...this.matched],
      turnIndex: this.turnIndex,
      moves: this.moves,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      revealUntil: this.revealUntil,
      pendingUntil: this.pendingUntil,
      turnDeadline: this.turnDeadline,
      extraTimeMs: this.extraTimeMs,
      seen: [...this.seen],        // thiếu cái này thì sau F5 hoặc hibernation
      rngState: this.rng.state,    // engine "quên" thẻ nào đã lộ và phán xử sai
      summaryCache: this.summaryCache && {
        ...this.summaryCache,
        // Infinity không đi qua JSON — chuẩn hoá như players
        ranking: this.summaryCache.ranking.map((p) => ({ ...p, lives: p.lives === Infinity ? null : p.lives }))
      }
    });
  }

  static restore(snapshot: string): MemoryGame {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const s = JSON.parse(snapshot) as any;
    const g = Object.create(MemoryGame.prototype) as MemoryGame;
    Object.assign(g, {
      config: s.config,
      cards: s.cards,
      players: (s.players as (Omit<Player, 'lives'> & { lives: number | null })[]).map((p) => ({
        ...p, lives: p.lives === null ? Infinity : p.lives
      })),
      status: s.status,
      selection: s.selection,
      matched: new Set(s.matched as number[]),
      turnIndex: s.turnIndex,
      moves: s.moves,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      revealUntil: s.revealUntil,
      pendingUntil: s.pendingUntil,
      turnDeadline: s.turnDeadline ?? 0,
      extraTimeMs: (s.extraTimeMs as number | undefined) ?? 0,
      seen: new Set((s.seen as number[] | undefined) ?? []),
      rng: Rng.fromState(s.rngState as number),
      summaryCache: s.summaryCache
        ? {
            ...s.summaryCache,
            ranking: (s.summaryCache.ranking as (Omit<Player, 'lives'> & { lives: number | null })[])
              .map((p) => ({ ...p, lives: p.lives === null ? Infinity : p.lives }))
          }
        : null
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return g;
  }

  summary(): Summary | null { return this.summaryCache; }

  /** Hệ số combo hiện tại của người đang tới lượt (cho HUD). */
  combo(): number { return comboMultiplier(this.current.streak + 1); }
}
