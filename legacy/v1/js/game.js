// Engine luật chơi — tách khỏi DOM để dễ kiểm thử và tái dùng cho các chế độ sau.
const GRIDS = {
  '4x4': { cols: 4, rows: 4, limit: 70 },
  '4x5': { cols: 4, rows: 5, limit: 100 },
  '6x6': { cols: 6, rows: 6, limit: 190 }
};

const BASE_POINTS = 100;
const MISS_PENALTY = 10;          // chỉ áp dụng cho Classic
const TIME_BONUS_PER_SEC = 5;     // chỉ áp dụng cho chế độ có timer
const FLIP_BACK_MS = 1000;
const COMBO_STEPS = [1, 1.2, 1.5, 2];

const comboMultiplier = (streak) => COMBO_STEPS[Math.min(streak, COMBO_STEPS.length - 1)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(gridKey, symbols) {
  const { cols, rows } = GRIDS[gridKey];
  const total = cols * rows;
  if (total % 2) throw new Error(`Lưới ${gridKey} có số ô lẻ`);
  const pairs = total / 2;
  if (symbols.length < pairs) throw new Error('Theme không đủ biểu tượng cho lưới này');
  const picked = shuffle(symbols).slice(0, pairs);
  return shuffle(picked.flatMap((s, i) => [
    { id: i * 2, pairId: i, symbol: s },
    { id: i * 2 + 1, pairId: i, symbol: s }
  ]));
}

class Game {
  constructor({ mode, grid, symbols }) {
    this.mode = mode;                 // 'classic' | 'time'
    this.grid = grid;
    this.cards = buildDeck(grid, symbols);
    this.matched = new Set();         // pairId đã tìm thấy
    this.selection = [];              // chỉ số ô đang mở
    this.score = 0;
    this.moves = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.locked = false;              // đang chờ úp lại 2 thẻ khác nhau
    this.startedAt = null;
    this.finished = false;
    this.timeLimit = mode === 'time' ? GRIDS[grid].limit : null;
  }

  get totalPairs() { return this.cards.length / 2; }
  get combo() { return comboMultiplier(this.streak); }
  get elapsed() { return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0; }
  get timeLeft() { return this.timeLimit === null ? null : Math.max(0, this.timeLimit - this.elapsed); }
  get isWon() { return this.matched.size === this.totalPairs; }

  isOpen(i) { return this.selection.includes(i) || this.matched.has(this.cards[i].pairId); }

  /**
   * Lật một ô. Trả về mô tả kết quả để lớp UI vẽ, hoặc null nếu hành động không hợp lệ.
   * { type: 'flip' } | { type: 'match', gained, cleared } | { type: 'miss', hide }
   */
  flip(i) {
    if (this.finished || this.locked) return null;
    if (i < 0 || i >= this.cards.length || this.isOpen(i)) return null;

    this.startedAt ??= Date.now();
    this.selection.push(i);
    if (this.selection.length < 2) return { type: 'flip' };

    const [a, b] = this.selection;
    this.moves++;

    if (this.cards[a].pairId === this.cards[b].pairId) {
      const gained = Math.round(BASE_POINTS * comboMultiplier(this.streak + 1));
      this.score += gained;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.matched.add(this.cards[a].pairId);
      this.selection = [];
      if (this.isWon) this.finish();
      return { type: 'match', gained, cleared: [a, b] };
    }

    this.streak = 0;
    if (this.mode === 'classic') this.score = Math.max(0, this.score - MISS_PENALTY);
    this.locked = true;
    return { type: 'miss', hide: [a, b], delay: FLIP_BACK_MS };
  }

  /** Gọi sau độ trễ của kết quả 'miss' để úp 2 thẻ lại và mở khoá lượt. */
  resolveMiss() {
    this.selection = [];
    this.locked = false;
  }

  /** Hết thời gian ở chế độ có timer. */
  timeout() {
    if (!this.finished) { this.finished = true; this.timedOut = true; }
    return this.summary();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.seconds = Math.round(this.elapsed);
    if (this.timeLimit !== null) {
      this.timeBonus = Math.round(Math.max(0, this.timeLimit - this.seconds) * TIME_BONUS_PER_SEC);
      this.score += this.timeBonus;
    }
  }

  summary() {
    return {
      won: this.isWon,
      timedOut: !!this.timedOut,
      score: this.score,
      moves: this.moves,
      seconds: this.seconds ?? Math.round(this.elapsed),
      timeBonus: this.timeBonus || 0,
      bestStreak: this.bestStreak
    };
  }
}
