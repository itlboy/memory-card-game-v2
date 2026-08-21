import { buildDeck, reshuffleHidden } from './deck.js';
import { Rng } from './rng.js';
import {
  FLIP_BACK_MS, MISS_PENALTY, comboMultiplier, pairScore, rankPlayers, starsFor, timeBonus
} from './scoring.js';
import type {
  Card, GameConfig, GameEvent, GameStatus, Player, PlayerInit, Power, Summary
} from './types.js';

const SOLO_POWERS: readonly Power[] = ['bomb', 'x2', 'eye'];

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
  private missStreakForShuffle = 0;
  private rng: Rng;
  private summaryCache: Summary | null = null;

  constructor(config: GameConfig) {
    this.config = { flipBackMs: FLIP_BACK_MS, ...config };
    this.rng = new Rng(config.seed);
    this.cards = buildDeck({
      cols: config.cols,
      rows: config.rows,
      symbols: config.symbols,
      rng: this.rng,
      specialRate: config.specialRate ?? 0,
      // 'freeze' chỉ có nghĩa khi có đối thủ
      allowedPowers: (config.players?.length ?? 1) > 1 ? undefined : SOLO_POWERS
    });
    const inits = config.players?.length
      ? config.players
      : [{ id: 'p1', name: 'Bạn' }];
    this.players = inits.map((p) => makePlayer(p, config.lives ?? null));
  }

  /* ---------- truy vấn ---------- */

  get totalPairs(): number { return this.cards.length / 2; }
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
    return limit === null ? null : Math.max(0, limit - this.elapsed(now));
  }

  movesLeft(): number | null {
    const limit = this.config.moveLimit ?? null;
    return limit === null ? null : Math.max(0, limit - this.moves);
  }

  isMatched(index: number): boolean { return this.matched.has(this.cards[index]!.pairId); }
  isFaceUp(index: number): boolean {
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
      if (this.status === 'peeking') { this.status = 'playing'; this.startedAt = now; }
      out.push({ type: 'peek-end' });
    }

    if (this.pendingUntil > 0 && now >= this.pendingUntil) {
      out.push(...this.resolvePending(now));
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
    if (index < 0 || index >= this.cards.length) return [];
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
      this.selection = [];
      this.missStreakForShuffle = 0;
      out.push({ type: 'match', indices: [a, b], gained, playerId: player.id });

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
    const penalty = this.config.mode === 'classic' ? MISS_PENALTY : 0;
    if (penalty) player.score = Math.max(0, player.score - penalty);

    if (this.config.lives != null) {
      player.lives--;
      out.push({ type: 'life-lost', playerId: player.id, livesLeft: player.lives });
    }

    this.pendingUntil = now + (this.config.flipBackMs ?? FLIP_BACK_MS);
    out.push({ type: 'miss', indices: [a, b], penalty, hideAfterMs: this.config.flipBackMs ?? FLIP_BACK_MS });

    if (this.config.lives != null && player.lives <= 0) {
      out.push(...this.end('lost', 'no-lives', now));
    } else if (this.movesLeft() === 0) {
      out.push(...this.end('lost', 'no-moves', now));
    }
    return out;
  }

  /** Úp lại 2 thẻ khác nhau và chuyển lượt. Gọi khi hết `flipBackMs`. */
  resolvePending(now: number): GameEvent[] {
    if (this.pendingUntil === 0) return [];
    this.pendingUntil = 0;
    this.selection = [];
    const out: GameEvent[] = [];

    const every = this.config.shuffleAfterMisses ?? 0;
    if (every > 0 && ++this.missStreakForShuffle >= every) {
      this.missStreakForShuffle = 0;
      const hidden = this.cards.filter((c) => !this.matched.has(c.pairId)).map((c) => c.index);
      if (hidden.length > 2) out.push({ type: 'reshuffle', indices: reshuffleHidden(this.cards, hidden, this.rng) });
    }

    if (!this.finished && this.isMultiplayer) out.push(...this.nextTurn());
    return out;
  }

  /** Chuyển lượt, bỏ qua người đang bị đóng băng (MP-02, thẻ freeze). */
  private nextTurn(): GameEvent[] {
    const out: GameEvent[] = [];
    for (let guard = 0; guard < this.players.length + 1; guard++) {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      const p = this.current;
      if (p.frozenTurns > 0) {
        p.frozenTurns--;
        out.push({ type: 'turn', playerId: p.id, skipped: true });
        continue;
      }
      out.push({ type: 'turn', playerId: p.id, skipped: false });
      return out;
    }
    return out;
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
      case 'x2':
        player.doubleNext = true;
        break;
      case 'eye':
        this.revealUntil = now + 2000;
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

  summary(): Summary | null { return this.summaryCache; }

  /** Hệ số combo hiện tại của người đang tới lượt (cho HUD). */
  combo(): number { return comboMultiplier(this.current.streak + 1); }
}
