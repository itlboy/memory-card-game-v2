var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../packages/engine/src/deck.ts
var POWERS = ["bomb", "x2", "eye", "freeze"];
function buildDeck(opts) {
  const { cols, rows, symbols, rng } = opts;
  const total = cols * rows;
  if (total < 4) throw new Error("L\u01B0\u1EDBi kh\xF4ng h\u1EE3p l\u1EC7");
  const hasBlank = total % 2 === 1;
  const pairCount = Math.floor(total / 2);
  if (symbols.length < pairCount) {
    throw new Error(`Theme ch\u1EC9 c\xF3 ${symbols.length} bi\u1EC3u t\u01B0\u1EE3ng, c\u1EA7n ${pairCount} cho l\u01B0\u1EDBi ${cols}x${rows}`);
  }
  const picked = rng.sample(symbols, pairCount);
  const allowed = opts.allowedPowers?.length ? opts.allowedPowers : POWERS;
  const specialCount = Math.floor(pairCount * Math.max(0, Math.min(1, opts.specialRate ?? 0)));
  const specialPairs = new Set(rng.sample([...picked.keys()], specialCount));
  const draft = [];
  picked.forEach((symbol, pairId) => {
    const power = specialPairs.has(pairId) ? allowed[rng.int(allowed.length)] : void 0;
    const carrier = rng.int(2);
    for (let k = 0; k < 2; k++) {
      draft.push(power && k === carrier ? { pairId, symbol, power } : { pairId, symbol });
    }
  });
  const shuffled = rng.shuffle(draft);
  if (hasBlank) {
    shuffled.splice(Math.floor(total / 2), 0, { pairId: -1, symbol: "", blank: true });
  }
  return shuffled.map((c, index) => ({ ...c, index }));
}
__name(buildDeck, "buildDeck");
function reshuffleHidden(cards, hiddenIndices, rng) {
  const shuffled = rng.shuffle(hiddenIndices);
  const snapshot = hiddenIndices.map((i) => cards[i]);
  hiddenIndices.forEach((slot, k) => {
    const from = shuffled.indexOf(slot);
    cards[slot] = { ...snapshot[from], index: slot };
  });
  return [...hiddenIndices];
}
__name(reshuffleHidden, "reshuffleHidden");

// ../../packages/engine/src/rng.ts
var Rng = class _Rng {
  static {
    __name(this, "Rng");
  }
  s;
  constructor(seed) {
    this.s = Math.trunc(seed) >>> 0 || 2654435769;
  }
  /** Trạng thái nội bộ — dùng cho snapshot/restore. */
  get state() {
    return this.s;
  }
  static fromState(state) {
    const r = new _Rng(1);
    r.s = state >>> 0;
    return r;
  }
  /** Số thực trong [0, 1). */
  next() {
    this.s = this.s + 1831565813 >>> 0;
    let t = this.s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** Số nguyên trong [0, max). */
  int(max) {
    return Math.floor(this.next() * max);
  }
  /** Fisher–Yates, trả về mảng mới. */
  shuffle(input) {
    const a = input.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Lấy `count` phần tử khác nhau. */
  sample(input, count) {
    return this.shuffle(input).slice(0, count);
  }
};
var seedFrom = /* @__PURE__ */ __name((n) => Math.trunc(n) >>> 0 || 1, "seedFrom");

// ../../packages/engine/src/scoring.ts
var BASE_POINTS = 100;
var MISS_PENALTY = 10;
var TIME_BONUS_PER_SEC = 5;
var FLIP_BACK_MS = 1e3;
var TURN_BONUS_MS = 5e3;
var COMBO_STEPS = [1, 1.2, 1.5, 2];
function comboMultiplier(streak) {
  if (streak <= 0) return 1;
  return COMBO_STEPS[Math.min(streak, COMBO_STEPS.length) - 1];
}
__name(comboMultiplier, "comboMultiplier");
function pairScore(streak, doubled) {
  return Math.round(BASE_POINTS * comboMultiplier(streak) * (doubled ? 2 : 1));
}
__name(pairScore, "pairScore");
function timeBonus(secondsLeft) {
  return Math.max(0, Math.round(secondsLeft) * TIME_BONUS_PER_SEC);
}
__name(timeBonus, "timeBonus");
function starsFor(score, thresholds) {
  if (!thresholds) return 3;
  const [two, three] = thresholds;
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}
__name(starsFor, "starsFor");
function rankPlayers(players) {
  return [...players].sort(
    (x, y) => Number(!!x.forfeited) - Number(!!y.forfeited) || y.score - x.score || y.bestStreak - x.bestStreak || y.pairs - x.pairs
  );
}
__name(rankPlayers, "rankPlayers");

// ../../packages/engine/src/game.ts
var SOLO_POWERS = ["bomb", "x2", "eye"];
function makePlayer(init, lives) {
  return {
    ...init,
    score: 0,
    pairs: 0,
    streak: 0,
    bestStreak: 0,
    misses: 0,
    lives: lives ?? Infinity,
    frozenTurns: 0,
    doubleNext: false
  };
}
__name(makePlayer, "makePlayer");
var MemoryGame = class _MemoryGame {
  static {
    __name(this, "MemoryGame");
  }
  config;
  cards;
  players;
  status = "idle";
  /** Chỉ số các thẻ đang mở trong lượt hiện tại (tối đa 2). */
  selection = [];
  /** pairId đã ghép xong. */
  matched = /* @__PURE__ */ new Set();
  turnIndex = 0;
  moves = 0;
  startedAt = null;
  endedAt = null;
  /** Thời điểm hết hé mở toàn bàn (Peek / thẻ mắt thần). */
  revealUntil = 0;
  /** Chờ úp lại 2 thẻ khác nhau đến thời điểm này. */
  pendingUntil = 0;
  /** Hạn chót của lượt hiện tại (ms). 0 = không dùng đồng hồ lượt. */
  turnDeadline = 0;
  missStreakForShuffle = 0;
  rng;
  summaryCache = null;
  constructor(config) {
    this.config = { flipBackMs: FLIP_BACK_MS, ...config };
    this.rng = new Rng(config.seed);
    this.cards = buildDeck({
      cols: config.cols,
      rows: config.rows,
      symbols: config.symbols,
      rng: this.rng,
      specialRate: config.specialRate ?? 0,
      // 'freeze' chỉ có nghĩa khi có đối thủ
      allowedPowers: (config.players?.length ?? 1) > 1 ? void 0 : SOLO_POWERS
    });
    const inits = config.players?.length ? config.players : [{ id: "p1", name: "B\u1EA1n" }];
    let players = inits.map((p) => makePlayer(p, config.lives ?? null));
    if (players.length > 1 && config.shufflePlayers !== false) {
      players = this.rng.shuffle(players);
    }
    this.players = players;
  }
  /* ---------- truy vấn ---------- */
  get totalPairs() {
    return Math.floor(this.cards.length / 2);
  }
  get current() {
    return this.players[this.turnIndex];
  }
  get isMultiplayer() {
    return this.players.length > 1;
  }
  get finished() {
    return this.status === "won" || this.status === "lost";
  }
  get locked() {
    return this.pendingUntil > 0;
  }
  get revealingAll() {
    return this.status === "peeking" || this.revealUntil > 0;
  }
  elapsed(now) {
    if (this.startedAt === null) return 0;
    return ((this.endedAt ?? now) - this.startedAt) / 1e3;
  }
  timeLeft(now) {
    const limit = this.config.timeLimit ?? null;
    return limit === null ? null : Math.max(0, limit - this.elapsed(now));
  }
  /** Giây còn lại của lượt hiện tại; null nếu không dùng đồng hồ lượt. */
  turnTimeLeft(now) {
    if (!this.turnDeadline || this.finished) return null;
    return Math.max(0, (this.turnDeadline - now) / 1e3);
  }
  get turnLimitMs() {
    return this.isMultiplayer && this.config.turnLimit ? this.config.turnLimit * 1e3 : 0;
  }
  armTurnClock(now) {
    if (this.turnLimitMs) this.turnDeadline = now + this.turnLimitMs;
  }
  movesLeft() {
    const limit = this.config.moveLimit ?? null;
    return limit === null ? null : Math.max(0, limit - this.moves);
  }
  isMatched(index) {
    return this.matched.has(this.cards[index].pairId);
  }
  isFaceUp(index) {
    if (this.cards[index].blank) return false;
    return this.revealingAll || this.selection.includes(index) || this.isMatched(index);
  }
  /** Bắt đầu ván (khởi động timer, mở màn hé thẻ nếu là Peek). */
  start(now) {
    if (this.status !== "idle") return [];
    this.startedAt = now;
    const peek = this.config.peekMs ?? 0;
    if (peek > 0) {
      this.status = "peeking";
      this.revealUntil = now + peek;
    } else {
      this.status = "playing";
      this.armTurnClock(now);
    }
    return [];
  }
  /**
   * Nhịp đồng hồ: kết thúc hé mở, úp lại thẻ đang chờ, kiểm tra hết thời gian.
   * UI gọi mỗi frame/200ms; server gọi khi có alarm.
   */
  tick(now) {
    const out = [];
    if (this.finished) return out;
    if (this.revealUntil > 0 && now >= this.revealUntil) {
      this.revealUntil = 0;
      if (this.status === "peeking") {
        this.status = "playing";
        this.startedAt = now;
        this.armTurnClock(now);
      }
      out.push({ type: "peek-end" });
    }
    if (this.pendingUntil > 0 && now >= this.pendingUntil) {
      out.push(...this.resolvePending(now));
    }
    if (this.status === "playing" && !this.locked && this.turnDeadline && now >= this.turnDeadline) {
      const player = this.current;
      player.streak = 0;
      this.selection = [];
      out.push({ type: "turn-timeout", playerId: player.id });
      out.push(...this.nextTurn(now));
    }
    const left = this.timeLeft(now);
    if (left !== null && left <= 0 && this.status === "playing") {
      out.push(...this.end("lost", "timeout", now));
    }
    return out;
  }
  /**
   * Lật thẻ tại `index`. Trả về danh sách sự kiện cho UI; rỗng nếu hành động không hợp lệ.
   * Đây là hàm duy nhất client được phép gọi ở chế độ online — server phán quyết kết quả.
   */
  flip(index, now) {
    if (this.status === "idle") this.start(now);
    if (this.status !== "playing" || this.locked) return [];
    if (!Number.isInteger(index) || index < 0 || index >= this.cards.length) return [];
    if (this.cards[index].blank) return [];
    if (this.isMatched(index) || this.selection.includes(index)) return [];
    if (this.selection.length >= 2) return [];
    const out = [{ type: "flip", index }];
    this.selection.push(index);
    const card = this.cards[index];
    if (card.power && !card.powerUsed) out.push(...this.trigger(card, now));
    if (this.selection.length < 2) return out;
    const [a, b] = this.selection;
    this.moves++;
    const player = this.current;
    if (this.cards[a].pairId === this.cards[b].pairId) {
      player.streak++;
      player.bestStreak = Math.max(player.bestStreak, player.streak);
      const gained = pairScore(player.streak, player.doubleNext);
      player.doubleNext = false;
      player.score += gained;
      player.pairs++;
      this.matched.add(this.cards[a].pairId);
      this.selection = [];
      this.missStreakForShuffle = 0;
      out.push({ type: "match", indices: [a, b], gained, playerId: player.id });
      if (this.turnDeadline) {
        this.turnDeadline = Math.min(this.turnDeadline + TURN_BONUS_MS, now + this.turnLimitMs);
        out.push({ type: "time-bonus", playerId: player.id, ms: TURN_BONUS_MS });
      }
      if (this.matched.size === this.totalPairs) {
        out.push(...this.end("won", "cleared", now));
      } else if (this.movesLeft() === 0) {
        out.push(...this.end("lost", "no-moves", now));
      }
      return out;
    }
    player.streak = 0;
    player.misses++;
    const penalty = this.config.mode === "classic" ? MISS_PENALTY : 0;
    if (penalty) player.score = Math.max(0, player.score - penalty);
    if (this.config.lives != null) {
      player.lives--;
      out.push({ type: "life-lost", playerId: player.id, livesLeft: player.lives });
    }
    this.pendingUntil = now + (this.config.flipBackMs ?? FLIP_BACK_MS);
    out.push({ type: "miss", indices: [a, b], penalty, hideAfterMs: this.config.flipBackMs ?? FLIP_BACK_MS });
    if (this.config.lives != null && player.lives <= 0) {
      out.push(...this.end("lost", "no-lives", now));
    } else if (this.movesLeft() === 0) {
      out.push(...this.end("lost", "no-moves", now));
    }
    return out;
  }
  /** Úp lại 2 thẻ khác nhau và chuyển lượt. Gọi khi hết `flipBackMs`. */
  resolvePending(now) {
    if (this.pendingUntil === 0) return [];
    this.pendingUntil = 0;
    this.selection = [];
    const out = [];
    const every = this.config.shuffleAfterMisses ?? 0;
    if (every > 0 && ++this.missStreakForShuffle >= every) {
      this.missStreakForShuffle = 0;
      const hidden = this.cards.filter((c) => !c.blank && !this.matched.has(c.pairId)).map((c) => c.index);
      if (hidden.length > 2) out.push({ type: "reshuffle", indices: reshuffleHidden(this.cards, hidden, this.rng) });
    }
    if (!this.finished && this.isMultiplayer) out.push(...this.nextTurn(now));
    return out;
  }
  /** Chuyển lượt, bỏ qua người đang bị đóng băng (MP-02, thẻ freeze). */
  nextTurn(now) {
    const out = [];
    for (let guard = 0; guard < this.players.length + 1; guard++) {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      const p = this.current;
      if (p.forfeited) continue;
      if (p.frozenTurns > 0) {
        p.frozenTurns--;
        out.push({ type: "turn", playerId: p.id, skipped: true });
        continue;
      }
      out.push({ type: "turn", playerId: p.id, skipped: false });
      this.armTurnClock(now);
      return out;
    }
    return out;
  }
  /** Kích hoạt thẻ đặc biệt (mục 3.4). */
  trigger(card, now) {
    card.powerUsed = true;
    const power = card.power;
    const player = this.current;
    let affected = [];
    switch (power) {
      case "bomb": {
        const open = [...this.matched];
        const victims = this.rng.sample(open, Math.min(2, open.length));
        for (const pairId of victims) this.matched.delete(pairId);
        affected = this.cards.filter((c) => victims.includes(c.pairId)).map((c) => c.index);
        player.pairs = Math.max(0, player.pairs - victims.length);
        break;
      }
      case "x2":
        player.doubleNext = true;
        break;
      case "eye":
        this.revealUntil = now + 2e3;
        affected = this.cards.map((c) => c.index);
        break;
      case "freeze": {
        const next = this.players[(this.turnIndex + 1) % this.players.length];
        if (next !== player) next.frozenTurns++;
        break;
      }
    }
    return [{ type: "power", power, index: card.index, affected }];
  }
  end(status, reason, now) {
    if (this.finished) return [];
    this.status = status;
    this.endedAt = now;
    this.pendingUntil = 0;
    this.turnDeadline = 0;
    this.selection = [];
    const seconds = Math.round(this.elapsed(now));
    let bonus = 0;
    if (status === "won" && this.config.timeLimit != null && !this.isMultiplayer) {
      bonus = timeBonus(this.config.timeLimit - seconds);
      this.players[0].score += bonus;
    }
    const ranking = rankPlayers(this.players);
    const leader = ranking[0];
    this.summaryCache = {
      status,
      reason,
      seconds,
      timeBonus: bonus,
      score: leader.score,
      moves: this.moves,
      bestStreak: leader.bestStreak,
      stars: status === "won" ? starsFor(leader.score, this.config.starThresholds) : 0,
      ranking
    };
    return [{ type: "end", summary: this.summaryCache }];
  }
  /**
   * Xử thua một người chơi (online: rớt mạng quá hạn — ON-07).
   * Còn lại 1 người thì ván kết thúc và người đó thắng.
   */
  forfeit(playerId, now) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.forfeited || this.finished) return [];
    player.forfeited = true;
    const active = this.players.filter((p) => !p.forfeited);
    if (this.isMultiplayer && active.length <= 1) {
      return this.end("won", "forfeit", now);
    }
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
  snapshot() {
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
      missStreakForShuffle: this.missStreakForShuffle,
      rngState: this.rng.state,
      summaryCache: this.summaryCache && {
        ...this.summaryCache,
        // Infinity không đi qua JSON — chuẩn hoá như players
        ranking: this.summaryCache.ranking.map((p) => ({ ...p, lives: p.lives === Infinity ? null : p.lives }))
      }
    });
  }
  static restore(snapshot) {
    const s = JSON.parse(snapshot);
    const g = Object.create(_MemoryGame.prototype);
    Object.assign(g, {
      config: s.config,
      cards: s.cards,
      players: s.players.map((p) => ({
        ...p,
        lives: p.lives === null ? Infinity : p.lives
      })),
      status: s.status,
      selection: s.selection,
      matched: new Set(s.matched),
      turnIndex: s.turnIndex,
      moves: s.moves,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      revealUntil: s.revealUntil,
      pendingUntil: s.pendingUntil,
      turnDeadline: s.turnDeadline ?? 0,
      missStreakForShuffle: s.missStreakForShuffle,
      rng: Rng.fromState(s.rngState),
      summaryCache: s.summaryCache ? {
        ...s.summaryCache,
        ranking: s.summaryCache.ranking.map((p) => ({ ...p, lives: p.lives === null ? Infinity : p.lives }))
      } : null
    });
    return g;
  }
  summary() {
    return this.summaryCache;
  }
  /** Hệ số combo hiện tại của người đang tới lượt (cho HUD). */
  combo() {
    return comboMultiplier(this.current.streak + 1);
  }
};

// ../../packages/engine/src/presets.ts
var GRIDS = {
  // Lưới lẻ ô (3x3, 5x5) có ô trống ở chính giữa. Trần 8x8 = 32 cặp —
  // một theme 24 biểu tượng là không đủ, người chơi cần chọn thêm theme.
  "2x2": { cols: 2, rows: 2, timeLimit: 15 },
  "2x3": { cols: 2, rows: 3, timeLimit: 25 },
  "3x3": { cols: 3, rows: 3, timeLimit: 35 },
  "3x4": { cols: 3, rows: 4, timeLimit: 55 },
  "4x4": { cols: 4, rows: 4, timeLimit: 70 },
  "4x5": { cols: 4, rows: 5, timeLimit: 100 },
  "5x5": { cols: 5, rows: 5, timeLimit: 115 },
  "5x6": { cols: 5, rows: 6, timeLimit: 140 },
  "6x6": { cols: 6, rows: 6, timeLimit: 190 },
  "6x8": { cols: 6, rows: 8, timeLimit: 230 },
  "7x8": { cols: 7, rows: 8, timeLimit: 260 },
  "8x8": { cols: 8, rows: 8, timeLimit: 300 }
};
function presetConfig({ mode, grid, symbols, seed, players }) {
  if (!Object.hasOwn(GRIDS, grid)) throw new Error(`L\u01B0\u1EDBi ${grid} kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3`);
  const g = GRIDS[grid];
  const base = { mode, cols: g.cols, rows: g.rows, symbols, seed, players };
  if ((players?.length ?? 1) > 1) base.turnLimit = 15;
  switch (mode) {
    case "classic":
      return base;
    case "time":
      return { ...base, timeLimit: g.timeLimit };
    case "survival":
      return { ...base, lives: 5, specialRate: 0.12 };
    case "peek":
      return { ...base, peekMs: 4e3, timeLimit: g.timeLimit };
    case "campaign":
      throw new Error("Campaign d\xF9ng levelConfig() thay cho presetConfig()");
  }
}
__name(presetConfig, "presetConfig");

// ../../packages/engine/src/online.ts
var DEFAULT_ROOM_CONFIG = { mode: "classic", grid: "4x4", themeIds: ["animals"] };
var ROOM_LIMITS = {
  maxPlayers: 4,
  minPlayers: 2,
  /** Rớt mạng quá hạn này thì bị xử thua (ON-07). */
  reconnectMs: 3e4,
  codeLength: 6
};
var QUICK_EMOJIS = ["\u{1F44D}", "\u{1F602}", "\u{1F621}", "\u{1F62E}", "\u{1F62D}", "\u{1F525}", "\u{1F389}", "\u{1F914}", "\u{1F4A9}"];
function publicView(game, now, connected) {
  return {
    cols: game.config.cols,
    rows: game.config.rows,
    cards: game.cards.map((c) => {
      if (c.blank) return { index: c.index, state: "down", blank: true };
      const matched = game.isMatched(c.index);
      const up = matched || game.selection.includes(c.index);
      if (!up) return { index: c.index, state: "down" };
      return {
        index: c.index,
        state: matched ? "matched" : "up",
        symbol: c.symbol,
        ...c.power && !c.powerUsed ? { power: c.power } : {}
      };
    }),
    players: game.players.map((p) => publicPlayer(p, connected(p.id))),
    currentId: game.current.id,
    moves: game.moves,
    matchedPairs: game.matched.size,
    totalPairs: game.totalPairs,
    status: game.status,
    timeLeft: game.timeLeft(now),
    turnTimeLeft: game.turnTimeLeft(now),
    elapsed: Math.floor(game.elapsed(now)),
    summary: game.summary()
  };
}
__name(publicView, "publicView");
function publicPlayer(p, connected) {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    pairs: p.pairs,
    bestStreak: p.bestStreak,
    frozenTurns: p.frozenTurns,
    doubleNext: p.doubleNext,
    forfeited: !!p.forfeited,
    connected,
    lives: Number.isFinite(p.lives) ? p.lives : null
  };
}
__name(publicPlayer, "publicPlayer");
function publicEvents(game, events) {
  return events.map((e) => {
    if (e.type !== "flip") return e;
    const card = game.cards[e.index];
    return {
      type: "flip",
      index: e.index,
      symbol: card.symbol,
      ...card.power && !card.powerUsed ? { power: card.power } : {}
    };
  });
}
__name(publicEvents, "publicEvents");

// src/room.ts
import { DurableObject } from "cloudflare:workers";

// src/themes.ts
var THEME_SYMBOLS = {
  animals: ["\u{1F436}", "\u{1F431}", "\u{1F98A}", "\u{1F43B}", "\u{1F43C}", "\u{1F428}", "\u{1F981}", "\u{1F42F}", "\u{1F435}", "\u{1F437}", "\u{1F438}", "\u{1F427}", "\u{1F989}", "\u{1F98B}", "\u{1F422}", "\u{1F42C}", "\u{1F984}", "\u{1F414}", "\u{1F434}", "\u{1F41D}", "\u{1F41E}", "\u{1F980}", "\u{1F419}", "\u{1F991}"],
  fruits: ["\u{1F34E}", "\u{1F34C}", "\u{1F347}", "\u{1F353}", "\u{1F352}", "\u{1F351}", "\u{1F34D}", "\u{1F95D}", "\u{1F951}", "\u{1F349}", "\u{1F34B}", "\u{1F955}", "\u{1F33D}", "\u{1F346}", "\u{1F954}", "\u{1FAD0}", "\u{1F96D}", "\u{1F350}", "\u{1F965}", "\u{1F345}", "\u{1F330}", "\u{1F95C}", "\u{1FAD2}", "\u{1F966}"],
  flags: ["\u{1F1FB}\u{1F1F3}", "\u{1F1EF}\u{1F1F5}", "\u{1F1F0}\u{1F1F7}", "\u{1F1FA}\u{1F1F8}", "\u{1F1EC}\u{1F1E7}", "\u{1F1EB}\u{1F1F7}", "\u{1F1E9}\u{1F1EA}", "\u{1F1EE}\u{1F1F9}", "\u{1F1EA}\u{1F1F8}", "\u{1F1E7}\u{1F1F7}", "\u{1F1E6}\u{1F1FA}", "\u{1F1E8}\u{1F1E6}", "\u{1F1EE}\u{1F1F3}", "\u{1F1F9}\u{1F1ED}", "\u{1F1F8}\u{1F1EC}", "\u{1F1F2}\u{1F1FE}", "\u{1F1EE}\u{1F1E9}", "\u{1F1F5}\u{1F1ED}", "\u{1F1E8}\u{1F1ED}", "\u{1F1F8}\u{1F1EA}", "\u{1F1F3}\u{1F1F4}", "\u{1F1F5}\u{1F1F9}", "\u{1F1F2}\u{1F1FD}", "\u{1F1FF}\u{1F1E6}"],
  tech: ["\u{1F4BB}", "\u{1F5A5}\uFE0F", "\u2328\uFE0F", "\u{1F5B1}\uFE0F", "\u{1F4F1}", "\u{1F5A8}\uFE0F", "\u{1F4BE}", "\u{1F4BF}", "\u{1F50C}", "\u{1F50B}", "\u{1F4F7}", "\u{1F3AE}", "\u{1F579}\uFE0F", "\u{1F3A7}", "\u{1F4E1}", "\u{1F6F0}\uFE0F", "\u{1F52D}", "\u2699\uFE0F", "\u{1F9F2}", "\u{1F4A1}", "\u{1F52C}", "\u{1F4C0}", "\u{1F5B2}\uFE0F", "\u{1F4E0}"],
  letters: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "+", "="],
  food: ["\u{1F354}", "\u{1F355}", "\u{1F32D}", "\u{1F35F}", "\u{1F37F}", "\u{1F96A}", "\u{1F32E}", "\u{1F32F}", "\u{1F957}", "\u{1F363}", "\u{1F359}", "\u{1F364}", "\u{1F35C}", "\u{1F35D}", "\u{1F958}", "\u{1F372}", "\u{1F9C0}", "\u{1F95E}", "\u{1F9C7}", "\u{1F369}", "\u{1F36A}", "\u{1F382}", "\u{1F370}", "\u{1F950}"],
  sports: ["\u26BD", "\u{1F3C0}", "\u{1F3C8}", "\u26BE", "\u{1F3BE}", "\u{1F3D0}", "\u{1F3C9}", "\u{1F3B1}", "\u{1F3D3}", "\u{1F3F8}", "\u{1F945}", "\u26F3", "\u{1F3D2}", "\u{1F94D}", "\u{1F94A}", "\u{1F94B}", "\u26F8\uFE0F", "\u{1F6F9}", "\u{1F3F9}", "\u{1F3A3}", "\u{1F93F}", "\u{1F3BD}", "\u{1F3C6}", "\u{1F947}"],
  nature: ["\u{1F338}", "\u{1F33B}", "\u{1F339}", "\u{1F337}", "\u{1F335}", "\u{1F334}", "\u{1F340}", "\u{1F341}", "\u{1F33F}", "\u{1F344}", "\u26F0\uFE0F", "\u{1F30B}", "\u{1F3DD}\uFE0F", "\u{1F30A}", "\u2744\uFE0F", "\u26C5", "\u{1F308}", "\u26A1", "\u{1F319}", "\u2600\uFE0F", "\u2B50", "\u{1F525}", "\u{1F4A7}", "\u{1F333}"],
  space: ["\u{1F680}", "\u{1F6F8}", "\u{1FA90}", "\u{1F30D}", "\u{1F30E}", "\u{1F30F}", "\u{1F315}", "\u2604\uFE0F", "\u{1F31F}", "\u2728", "\u{1F47D}", "\u{1F6F0}\uFE0F", "\u{1F52D}", "\u{1F30C}", "\u{1F320}", "\u{1F9ED}", "\u{1F4E1}", "\u269B\uFE0F", "\u{1F311}", "\u{1F31C}", "\u{1F31B}", "\u{1F31E}", "\u{1F386}", "\u{1F321}\uFE0F"],
  vehicles: ["\u{1F697}", "\u{1F695}", "\u{1F699}", "\u{1F68C}", "\u{1F68E}", "\u{1F3CE}\uFE0F", "\u{1F693}", "\u{1F691}", "\u{1F692}", "\u{1F69A}", "\u{1F69C}", "\u{1F6F5}", "\u{1F3CD}\uFE0F", "\u{1F6B2}", "\u{1F6F4}", "\u{1F682}", "\u2708\uFE0F", "\u{1F681}", "\u26F5", "\u{1F6A4}", "\u{1F6F3}\uFE0F", "\u{1F6FA}", "\u{1F6A0}", "\u{1F6A1}"],
  smileys: ["\u{1F600}", "\u{1F601}", "\u{1F602}", "\u{1F923}", "\u{1F60A}", "\u{1F607}", "\u{1F642}", "\u{1F609}", "\u{1F60D}", "\u{1F618}", "\u{1F61C}", "\u{1F92A}", "\u{1F928}", "\u{1F60E}", "\u{1F929}", "\u{1F973}", "\u{1F634}", "\u{1F92F}", "\u{1F631}", "\u{1F976}", "\u{1F922}", "\u{1F920}", "\u{1F921}", "\u{1F47B}"],
  ocean: ["\u{1F433}", "\u{1F40B}", "\u{1F42C}", "\u{1F988}", "\u{1F419}", "\u{1F991}", "\u{1F990}", "\u{1F99E}", "\u{1F980}", "\u{1F421}", "\u{1F420}", "\u{1F41F}", "\u{1F41A}", "\u2693", "\u{1F30A}", "\u26F5", "\u{1F6A4}", "\u{1F6E5}\uFE0F", "\u{1F3DD}\uFE0F", "\u{1F3D6}\uFE0F", "\u{1F93F}", "\u{1F3A3}", "\u{1F9DC}\u200D\u2640\uFE0F", "\u{1F422}"]
};

// src/room.ts
var AVATARS = ["\u{1F98A}", "\u{1F43C}", "\u{1F42F}", "\u{1F438}"];
var RoomDO = class extends DurableObject {
  static {
    __name(this, "RoomDO");
  }
  room = null;
  game = null;
  /* ---------- nạp / lưu ---------- */
  async load() {
    if (this.room) return;
    this.room = await this.ctx.storage.get("room") ?? null;
    const snap = await this.ctx.storage.get("game");
    if (snap) this.game = MemoryGame.restore(snap);
  }
  async save() {
    if (this.room) await this.ctx.storage.put("room", this.room);
    if (this.game) await this.ctx.storage.put("game", this.game.snapshot());
  }
  /* ---------- kết nối ---------- */
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket only", { status: 426 });
    }
    await this.load();
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const name = (url.searchParams.get("name") ?? "").trim().slice(0, 16);
    const token = url.searchParams.get("token") ?? "";
    this.room ??= {
      code,
      hostId: "",
      config: { ...DEFAULT_ROOM_CONFIG },
      players: [],
      status: "lobby"
    };
    let player = token ? this.room.players.find((p) => p.token === token) : void 0;
    if (!player) {
      if (!name) return new Response("Thi\u1EBFu t\xEAn", { status: 400 });
      if (this.room.status !== "lobby" || this.room.players.length >= ROOM_LIMITS.maxPlayers) {
        return this.acceptSpectator();
      }
      player = {
        id: crypto.randomUUID().slice(0, 8),
        name,
        avatar: AVATARS[this.room.players.length % AVATARS.length],
        token: crypto.randomUUID(),
        disconnectedAt: null,
        ready: false
      };
      this.room.players.push(player);
      if (!this.room.hostId) this.room.hostId = player.id;
    } else {
      player.disconnectedAt = null;
      if (name) player.name = name;
    }
    for (const ws of this.ctx.getWebSockets(player.id)) ws.close(4e3, "replaced");
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [player.id]);
    pair[1].serializeAttachment({ playerId: player.id });
    await this.save();
    this.send(pair[1], {
      t: "welcome",
      playerId: player.id,
      token: player.token,
      room: this.roomInfo()
    });
    this.broadcast({ t: "room", room: this.roomInfo() }, player.id);
    if (this.game) this.send(pair[1], { t: "state", view: this.view() });
    await this.scheduleNext();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  /**
   * Gỡ một người khỏi phòng (đầu hàng / bị xử thua vì rớt mạng quá hạn).
   * Chủ phòng rời thì chuyển quyền cho người kế tiếp — nếu không thì
   * không ai còn bấm được "Chơi lại" hay huỷ phòng.
   */
  removePlayer(id) {
    if (!this.room) return;
    this.room.players = this.room.players.filter((p) => p.id !== id);
    if (this.room.hostId === id) this.room.hostId = this.room.players[0]?.id ?? "";
  }
  /** Khán giả: nhận mọi broadcast nhưng không có mặt trong danh sách người chơi. */
  acceptSpectator() {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], ["spectator"]);
    pair[1].serializeAttachment({ playerId: "" });
    this.send(pair[1], {
      t: "welcome",
      playerId: "",
      token: "",
      spectator: true,
      room: this.roomInfo()
    });
    if (this.game) this.send(pair[1], { t: "state", view: this.view() });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws, raw) {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment();
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    switch (msg.t) {
      case "ping":
        this.send(ws, { t: "pong" });
        return;
      case "config": {
        if (player.id !== this.room.hostId || this.room.status !== "lobby") return;
        const c = msg.config;
        if (typeof c.grid === "string" && Object.hasOwn(GRIDS, c.grid)) this.room.config.grid = c.grid;
        if (c.mode === "classic" || c.mode === "survival") this.room.config.mode = c.mode;
        if (Array.isArray(c.themeIds)) {
          const valid = [...new Set(c.themeIds)].filter((id) => typeof id === "string" && Object.hasOwn(THEME_SYMBOLS, id));
          if (valid.length) this.room.config.themeIds = valid;
        }
        await this.save();
        this.broadcast({ t: "room", room: this.roomInfo() });
        return;
      }
      case "ready": {
        if (this.room.status !== "lobby") return;
        player.ready = !!msg.ready;
        await this.save();
        this.broadcast({ t: "room", room: this.roomInfo() });
        return;
      }
      case "start":
      case "again": {
        if (player.id !== this.room.hostId) return;
        if (msg.t === "start" && this.room.status !== "lobby") return;
        if (msg.t === "again" && this.room.status !== "ended") return;
        this.room.players = this.room.players.filter(
          (p) => this.connected(p.id) || p.disconnectedAt !== null
        );
        if (this.room.hostId && !this.room.players.some((p) => p.id === this.room.hostId)) {
          this.room.hostId = this.room.players[0]?.id ?? "";
        }
        if (this.room.players.length < ROOM_LIMITS.minPlayers) {
          this.send(ws, { t: "error", code: "not-enough", message: "C\u1EA7n \xEDt nh\u1EA5t 2 ng\u01B0\u1EDDi ch\u01A1i \u0111ang k\u1EBFt n\u1ED1i" });
          return;
        }
        if (msg.t === "again") {
          this.room.status = "lobby";
          this.game = null;
          await this.ctx.storage.delete("game");
          for (const p of this.room.players) p.ready = false;
          await this.save();
          this.broadcast({ t: "room", room: this.roomInfo() });
          return;
        }
        const notReady = this.room.players.filter((p) => p.id !== this.room.hostId && !p.ready);
        if (notReady.length) {
          this.send(ws, {
            t: "error",
            code: "not-ready",
            message: `Ch\u01B0a s\u1EB5n s\xE0ng: ${notReady.map((p) => p.name).join(", ")}`
          });
          return;
        }
        this.prepareGame();
        this.room.status = "countdown";
        this.room.countdownEnd = Date.now() + 5e3;
        await this.save();
        const first = this.game.current;
        this.broadcast({ t: "room", room: this.roomInfo() });
        this.broadcast({ t: "state", view: this.view() });
        this.broadcast({
          t: "countdown",
          endsInMs: 5e3,
          firstId: first.id,
          firstName: first.name
        });
        await this.ctx.storage.setAlarm(this.room.countdownEnd);
        return;
      }
      case "flip": {
        if (!this.game || this.room.status !== "playing") return;
        if (typeof msg.index !== "number") return;
        if (this.game.current.id !== player.id) return;
        const events = this.game.flip(msg.index, Date.now());
        if (!events.length) return;
        await this.afterEvents(events);
        return;
      }
      case "leave": {
        if (this.room.status === "playing" && this.game && !this.game.finished) {
          player.disconnectedAt = null;
          const events = this.game.forfeit(player.id, Date.now());
          await this.afterEvents(events);
        }
        this.removePlayer(player.id);
        for (const sock of this.ctx.getWebSockets(player.id)) sock.close(4001, "left");
        if (!this.room.players.length) {
          await this.ctx.storage.deleteAll();
          this.room = null;
          this.game = null;
          return;
        }
        await this.save();
        this.broadcast({ t: "room", room: this.roomInfo() });
        await this.scheduleNext();
        return;
      }
      case "cancel": {
        if (player.id !== this.room.hostId) return;
        this.broadcast({ t: "closed", message: "Ch\u1EE7 ph\xF2ng \u0111\xE3 hu\u1EF7 ph\xF2ng." });
        for (const sock of this.ctx.getWebSockets()) sock.close(4002, "room-cancelled");
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.room = null;
        this.game = null;
        return;
      }
      case "emoji": {
        if (!QUICK_EMOJIS.includes(msg.emoji)) return;
        this.broadcast({ t: "emoji", from: player.id, emoji: msg.emoji });
        return;
      }
    }
  }
  async webSocketClose(ws) {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment();
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;
    if (this.ctx.getWebSockets(player.id).some((s) => s !== ws)) return;
    if (this.room.status === "lobby") {
      this.room.players = this.room.players.filter((p) => p.id !== player.id);
      if (this.room.hostId === player.id) this.room.hostId = this.room.players[0]?.id ?? "";
      if (!this.room.players.length) {
        await this.ctx.storage.deleteAll();
        this.room = null;
        this.game = null;
        return;
      }
    } else {
      player.disconnectedAt = Date.now();
    }
    if (this.room.status === "ended" && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      this.room = null;
      this.game = null;
      return;
    }
    await this.save();
    this.broadcast({ t: "room", room: this.roomInfo() });
    await this.scheduleNext();
  }
  /* ---------- đồng hồ của phòng ---------- */
  async alarm() {
    await this.load();
    if (!this.room) return;
    const now = Date.now();
    if (this.room.status === "countdown" && this.game && now >= (this.room.countdownEnd ?? 0)) {
      this.game.start(now);
      this.room.status = "playing";
      delete this.room.countdownEnd;
      await this.save();
      this.broadcast({ t: "room", room: this.roomInfo() });
      this.broadcast({ t: "state", view: this.view() });
    }
    if (this.game && this.room.status === "playing") {
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null && now - p.disconnectedAt >= ROOM_LIMITS.reconnectMs) {
          p.disconnectedAt = null;
          const events2 = this.game.forfeit(p.id, now);
          this.removePlayer(p.id);
          await this.afterEvents(events2, false);
          this.broadcast({ t: "room", room: this.roomInfo() });
        }
      }
      const events = this.game.tick(now);
      if (events.length) await this.afterEvents(events, false);
    }
    await this.save();
    await this.scheduleNext();
  }
  /** Một alarm duy nhất = mốc gần nhất trong: úp thẻ, hạn vào lại, hết giờ. */
  async scheduleNext() {
    const marks = [];
    const now = Date.now();
    if (this.room?.status === "countdown" && this.room.countdownEnd) marks.push(this.room.countdownEnd);
    if (this.room?.status === "playing" && this.game && !this.game.finished) {
      if (this.game.locked) marks.push(now + (this.game.config.flipBackMs ?? 1e3));
      if (this.game.turnDeadline) marks.push(this.game.turnDeadline + 50);
      const left = this.game.timeLeft(now);
      if (left !== null) marks.push(now + left * 1e3 + 50);
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null) marks.push(p.disconnectedAt + ROOM_LIMITS.reconnectMs);
      }
    }
    if (marks.length) await this.ctx.storage.setAlarm(Math.min(...marks));
    else await this.ctx.storage.deleteAlarm();
  }
  /* ---------- trợ giúp ---------- */
  prepareGame() {
    const room = this.room;
    const symbols = [...new Set(
      room.config.themeIds.flatMap((id) => THEME_SYMBOLS[id] ?? [])
    )];
    if (!symbols.length) symbols.push(...THEME_SYMBOLS["animals"]);
    const seed = seedFrom(crypto.getRandomValues(new Uint32Array(1))[0]);
    this.game = new MemoryGame(presetConfig({
      mode: room.config.mode,
      grid: room.config.grid,
      symbols,
      seed,
      players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
    }));
  }
  /** Phát sự kiện + view mới cho cả phòng, cập nhật trạng thái phòng nếu ván xong. */
  async afterEvents(events, save = true) {
    if (!events.length || !this.game || !this.room) return;
    if (events.some((e) => e.type === "end")) this.room.status = "ended";
    if (save) await this.save();
    this.broadcast({ t: "events", events: publicEvents(this.game, events), view: this.view() });
    if (this.room.status === "ended") this.broadcast({ t: "room", room: this.roomInfo() });
    if (save) await this.scheduleNext();
  }
  view() {
    return publicView(this.game, Date.now(), (id) => this.connected(id));
  }
  connected(id) {
    const p = this.room?.players.find((x) => x.id === id);
    return !!p && p.disconnectedAt === null && this.ctx.getWebSockets(id).length > 0;
  }
  roomInfo() {
    const room = this.room;
    return {
      code: room.code,
      hostId: room.hostId,
      config: room.config,
      status: room.status,
      players: room.players.map((p) => {
        const gp = this.game?.players.find((x) => x.id === p.id);
        if (gp) return { ...publicPlayer(gp, this.connected(p.id)), ready: p.ready };
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: 0,
          pairs: 0,
          bestStreak: 0,
          frozenTurns: 0,
          doubleNext: false,
          forfeited: false,
          connected: this.connected(p.id),
          lives: null,
          ready: p.ready
        };
      })
    };
  }
  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
    }
  }
  broadcast(msg, exceptWelcomeFor) {
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(raw);
      } catch {
      }
    }
    void exceptWelcomeFor;
  }
};

// src/index.ts
var CODE_ALPHABET = "0123456789";
function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_LIMITS.codeLength));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
__name(makeCode, "makeCode");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const code = makeCode();
      return Response.json({ code }, { headers: CORS });
    }
    const match = url.pathname.match(/^\/ws\/([0-9]{6})$/);
    if (match) {
      const code = match[1].toUpperCase();
      const stub = env.ROOM.getByName(code);
      const forward = new URL(request.url);
      forward.searchParams.set("code", code);
      return stub.fetch(new Request(forward, request));
    }
    if (url.pathname === "/health") return Response.json({ ok: true }, { headers: CORS });
    return new Response("Not found", { status: 404, headers: CORS });
  }
};

// ../../node_modules/.pnpm/wrangler@4.125.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.125.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-REmMY2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@4.125.0_@cloudflare+workers-types@4.20260702.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-REmMY2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RoomDO,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
