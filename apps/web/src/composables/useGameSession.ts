import { MemoryGame } from '@mm/engine';
import type { Card, GameConfig, GameEvent, Player, Summary } from '@mm/engine';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { BOT_SPECS, botPick, botRng, createBotMemory, observe, publicView } from '@mm/engine';
import type { BotLevel, BotMemory } from '@mm/engine';
import { sfx } from '@/lib/audio';

/**
 * Cầu nối engine ↔ Vue.
 *
 * Engine là nguồn sự thật duy nhất; Vue chỉ giữ một `shallowRef` tới instance và
 * một số đếm `rev` để kích hoạt re-render. Cố tình KHÔNG bọc engine trong
 * `reactive()`: engine phải sạch framework để server (Durable Object) dùng chung.
 */
export function useGameSession() {
  const game = shallowRef<MemoryGame | null>(null);
  const rev = ref(0);
  const summary = shallowRef<Summary | null>(null);
  /** Thẻ đang lắc vì ghép sai, để UI vẽ hiệu ứng. */
  const wrongPair = ref<number[]>([]);
  const lastPower = ref<GameEvent & { type: 'power' } | null>(null);
  /** Hai ô vừa bị thẻ tráo đổi hoán chỗ, kèm key để lặp lại animation. */
  const swapPair = ref<{ a: number; b: number; key: number } | null>(null);
  /** Thời gian hai thẻ bay — phải khớp keyframes `swap-move` trong CardTile. */
  const SWAP_MS = 620;
  /** Vừa hồi mạng (Sinh tồn) — phải báo rõ, không thì tim trên HUD tự nhiều
   *  thêm một cái và người chơi không hiểu vì sao. */
  const lifeGain = ref<{ key: number } | null>(null);
  /** Điểm vừa ghi + vị trí thẻ, cho hiệu ứng "+120" bay lên. `key` để ép re-render. */
  const lastGain = ref<{ amount: number; index: number; key: number } | null>(null);
  /** Banner "Đến lượt X" khi chuyển người chơi (multiplayer). */
  const turnBanner = ref<{ name: string; avatar: string; frozen: string | null; key: number } | null>(null);
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  const now = ref(0);
  let lastTickSecond = -1;
  let lastTurnTickAt = 0;
  /** Đếm ngược 5 giây trước ván multiplayer; 0 = không dùng. */
  let countdownUntil = 0;
  let lastCdSec = -1;
  const countdownLeft = ref<number | null>(null);
  /** Mặt sau của ván này — bốc ngẫu nhiên mỗi ván cho đa dạng. */
  const BACKS = ['stars', 'diamond', 'aurora'] as const;
  const backStyle = ref<string>('stars');
  const pickBack = (): void => { backStyle.value = BACKS[Math.floor(Math.random() * BACKS.length)]!; };
  /** Hiệu ứng "+10s" trên chip người vừa ghép đúng. */
  const timeBonusFor = ref<{ playerId: string; key: number } | null>(null);

  let raf = 0;
  // Date.now thay vì performance.now: mốc thời gian phải sống qua F5
  // để khôi phục ván dở từ snapshot không làm sai đồng hồ
  const clockNow = (): number => Date.now();
  const bump = (): void => { rev.value++; };

  function handle(events: GameEvent[]): void {
    let frozenId: string | null = null;
    let turnId: string | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'flip': sfx.flip(); break;
        case 'match': {
          const streak = game.value?.players.find((p) => p.id === e.playerId)?.streak ?? 1;
          sfx.match(streak);
          lastGain.value = { amount: e.gained, index: e.indices[1], key: (lastGain.value?.key ?? 0) + 1 };
          break;
        }
        case 'miss':
          sfx.miss();
          wrongPair.value = e.indices;
          setTimeout(() => { wrongPair.value = []; }, e.hideAfterMs);
          break;
        case 'power':
          if (e.power === 'bomb') sfx.bomb();
          else if (e.power === 'freeze') sfx.freeze();
          else if (e.power === 'swap') sfx.swap();
          else sfx.power();
          // Hai ô bị tráo: UI cho chúng bay chéo qua nhau. Mặt sau mọi lá bài
          // giống hệt nhau (NF), nên KHÔNG có hiệu ứng thì người chơi không thể
          // biết vừa có gì xảy ra.
          if (e.power === 'swap' && e.affected.length === 2) {
            swapPair.value = { a: e.affected[0]!, b: e.affected[1]!, key: (swapPair.value?.key ?? 0) + 1 };
            setTimeout(() => { swapPair.value = null; }, SWAP_MS);
            // Thông báo nằm GIỮA bàn, mà hai thẻ cũng bay qua giữa bàn — hiện
            // ngay thì chữ che đúng thứ cần cho người chơi xem. Đợi thẻ đáp
            // xuống rồi mới nói vừa xảy ra chuyện gì.
            setTimeout(() => {
              lastPower.value = e;
              setTimeout(() => { lastPower.value = null; }, 3200);
            }, SWAP_MS);
            break;
          }
          lastPower.value = e;
          // 1,6 giây không đủ đọc một câu tiếng Việt có dấu — nhất là khi thẻ
          // đang lật và mắt người chơi còn ở chỗ khác
          setTimeout(() => { lastPower.value = null; }, 3200);
          break;
        case 'turn':
          if (e.skipped) { frozenId = e.playerId; }
          else { turnId = e.playerId; sfx.turn(); }
          break;
        case 'turn-timeout':
          sfx.miss();
          break;
        case 'life-gain':
          sfx.unlockTheme();
          lifeGain.value = { key: (lifeGain.value?.key ?? 0) + 1 };
          setTimeout(() => { lifeGain.value = null; }, 3200);
          break;
        case 'time-bonus':
          timeBonusFor.value = { playerId: e.playerId, key: (timeBonusFor.value?.key ?? 0) + 1 };
          setTimeout(() => { timeBonusFor.value = null; }, 1400);
          break;
        case 'end':
          summary.value = e.summary;
          e.summary.status === 'won' ? sfx.victory() : sfx.lose();
          break;
      }
    }
    // Chỉ hiện banner khi lượt thực sự đổi sang người khác (multiplayer)
    if (turnId && (game.value?.players.length ?? 0) > 1) {
      const find = (id: string | null) => game.value?.players.find((p) => p.id === id);
      const p = find(turnId);
      if (p) {
        turnBanner.value = {
          name: p.name,
          avatar: p.avatar ?? '',
          frozen: find(frozenId)?.name ?? null,
          key: (turnBanner.value?.key ?? 0) + 1
        };
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => { turnBanner.value = null; }, 1500);
      }
    }
    if (events.length) bump();
  }

  /* ---------- đối thủ máy ---------- */

  /**
   * Bot chỉ được nhìn `publicView` — đúng thứ client online nhận, và view đó
   * không bao giờ chứa biểu tượng của thẻ đang úp (NF-04). Nên bot KHÔNG THỂ
   * gian lận: không phải vì nó tự nguyện không xem bàn thẻ, mà vì nó không có
   * tham chiếu nào tới bàn thẻ.
   */
  const botLevel = ref<BotLevel | null>(null);
  let botMem: BotMemory = createBotMemory();
  let botRandom = botRng(1);
  let botTimer: ReturnType<typeof setTimeout> | undefined;
  const BOT_ID = 'bot';

  /** Bot đang nghĩ — UI khoá bàn để người chơi không lật hộ nó. */
  const botThinking = ref(false);

  function stopBot(): void {
    if (botTimer) clearTimeout(botTimer);
    botTimer = undefined;
    botThinking.value = false;
  }

  /** Nhìn bàn qua view công khai và ghi vào ký ức của bot. */
  function botWatch(): void {
    const g = game.value;
    if (!g || !botLevel.value) return;
    observe(botMem, publicView(g, now.value, () => true), botLevel.value);
  }

  /**
   * Tới lượt bot thì hẹn giờ rồi lật. Hẹn giờ để người chơi THẤY nó đang nghĩ;
   * lật tức thì thì cảm giác như bị máy tính bắn nhanh, không ra đối thủ.
   */
  function botTurn(): void {
    const g = game.value;
    const level = botLevel.value;
    if (!g || !level || g.finished) { stopBot(); return; }
    if (g.current.id !== BOT_ID || countdownUntil) { stopBot(); return; }
    // Bàn đang khoá (hai thẻ chờ úp lại) thì đợi, không hỏi nước nào — engine
    // bỏ qua nước thứ ba và bot mất lượt oan
    if (botTimer) return;
    botThinking.value = true;
    botTimer = setTimeout(() => {
      botTimer = undefined;
      const g2 = game.value;
      if (!g2 || g2.finished || g2.current.id !== BOT_ID) { stopBot(); return; }
      if (locked.value) { botThinking.value = false; return; }   // thử lại ở tick sau
      botWatch();
      const pick = botPick(publicView(g2, now.value, () => true), botMem, botRandom, level);
      botThinking.value = false;
      if (pick !== null) applyFlip(pick);
    }, BOT_SPECS[level].thinkMs);
  }

  function loop(): void {
    const g = game.value;
    if (g && !g.finished) {
      now.value = clockNow();
      // Đang đếm ngược: chưa cho engine chạy, tick mỗi giây
      if (countdownUntil) {
        const left = (countdownUntil - now.value) / 1000;
        if (left > 0) {
          const sec = Math.ceil(left);
          countdownLeft.value = sec;
          if (sec !== lastCdSec) { lastCdSec = sec; sfx.tick(); }
          raf = requestAnimationFrame(loop);
          return;
        }
        countdownUntil = 0;
        countdownLeft.value = null;
        g.start(now.value);
        sfx.turn();
        bump();
      }
      handle(g.tick(now.value));
      // Nhìn bàn MỖI KHUNG, không phải chỉ lúc tới lượt mình: thẻ người chơi
      // lật rồi úp lại sẽ không bao giờ vào ký ức bot nếu chỉ nhìn theo lượt —
      // bot hoá ra mù trước mọi nước của đối thủ, chơi như đánh một mình.
      if (botLevel.value) { botWatch(); botTurn(); }
      // Tick cảnh báo mỗi giây trong 10 giây cuối
      const left = g.timeLeft(now.value);
      if (left !== null && left > 0 && left <= 10) {
        const sec = Math.ceil(left);
        if (sec !== lastTickSecond) { lastTickSecond = sec; sfx.tick(); }
      }
      // Đồng hồ lượt: dưới 10 giây tick dồn dập gấp đôi để giục người chơi
      const turnLeft = g.turnTimeLeft(now.value);
      if (turnLeft !== null && turnLeft > 0 && turnLeft <= 10) {
        if (now.value - lastTurnTickAt >= 500) { lastTurnTickAt = now.value; sfx.tick(); }
      }
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  }

  /** Bắt đầu ván mới. `seed` do lớp gọi truyền vào để engine giữ tính tất định. */
  function start(config: GameConfig): MemoryGame {
    stop();
    const g = new MemoryGame(config);
    game.value = g;
    summary.value = null;
    wrongPair.value = [];
    lastPower.value = null;
    swapPair.value = null;
    lastGain.value = null;
    turnBanner.value = null;
    clearTimeout(bannerTimer);
    lastTickSecond = -1;
    now.value = clockNow();
    stopBot();
    botMem = createBotMemory();
    botRandom = botRng(config.seed);
    pickBack();
    // Đếm ngược 5 giây trước khi ván chạy. Multiplayer cần để người đi đầu
    // không bị động; Chớp nhoáng cần vì cả bàn bật lên rồi úp lại chỉ trong 4
    // giây — không báo trước thì người chơi chưa kịp nhìn đã hết.
    if (g.isMultiplayer || (g.config.peekMs ?? 0) > 0) {
      countdownUntil = now.value + 5000;
      lastCdSec = -1;
      countdownLeft.value = 5;
    } else {
      countdownUntil = 0;
      countdownLeft.value = null;
      g.start(now.value);
    }
    sfx.deal(g.cards.length);
    bump();
    raf = requestAnimationFrame(loop);
    return g;
  }

  /** Đang là lượt của máy — người chơi không được lật hộ nó. */
  const botTurnNow = computed(() => {
    touch();
    return !!botLevel.value && game.value?.current.id === BOT_ID && !game.value.finished;
  });

  /** Đưa nước lật vào engine. Chỉ dùng nội bộ — bot đi qua đây, người chơi đi
   *  qua `flip()` (có chốt chặn lượt). */
  function applyFlip(index: number): void {
    const g = game.value;
    if (!g || countdownUntil) return;
    now.value = clockNow();
    handle(g.flip(index, now.value));
    if (!raf && !g.finished) raf = requestAnimationFrame(loop);
  }

  /** Người chơi bấm. Chặn ở GỐC chứ không chỉ khoá giao diện: bấm trong lượt
   *  máy thì nước đó ghi vào tài khoản MÁY — tự tay mở thẻ cho đối thủ ăn. */
  function flip(index: number): void {
    if (botLevel.value && game.value?.current.id === BOT_ID) return;
    applyFlip(index);
  }

  /** Bật/tắt đối thủ máy. Gọi TRƯỚC start() để ván mới gieo đúng rng cho bot. */
  function setBot(level: BotLevel | null): void {
    stopBot();
    botLevel.value = level;
    botMem = createBotMemory();
  }

  function stop(): void {
    stopBot();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Nhận một ván đã khôi phục từ snapshot (F5 giữa ván) và chạy tiếp. */
  function adopt(g: MemoryGame): void {
    stop();
    countdownUntil = 0;
    countdownLeft.value = null;
    game.value = g;
    summary.value = g.summary();
    wrongPair.value = [];
    lastPower.value = null;
    swapPair.value = null;
    lastGain.value = null;
    turnBanner.value = null;
    lastTickSecond = -1;
    now.value = clockNow();
    bump();
    if (!g.finished) raf = requestAnimationFrame(loop);
  }

  onScopeDispose(stop);

  /* ---------- dữ liệu cho template (đọc qua rev để bám re-render) ---------- */

  /** `touch()` khai báo phụ thuộc để computed chạy lại khi engine thay đổi. */
  const touch = (): void => { void rev.value; };
  const touchClock = (): void => { void rev.value; void now.value; };

  // Trả về BẢN SAO, không phải mảng gốc của engine: từ Vue 3.4, computed nào trả
  // về cùng reference sẽ không lan truyền thay đổi xuống computed/render phía sau —
  // engine mutate tại chỗ nên nếu trả nguyên mảng thì HUD sẽ đứng yên.
  const cards = computed<Card[]>(() => { touch(); return [...(game.value?.cards ?? [])]; });
  const players = computed<Player[]>(() => {
    touch();
    return (game.value?.players ?? []).map((p) => ({ ...p }));
  });
  const current = computed<Player | null>(() => {
    touch();
    const p = game.value?.current;
    return p ? { ...p } : null;
  });
  const matchedCount = computed(() => { touch(); return game.value?.matched.size ?? 0; });
  const totalPairs = computed(() => { touch(); return game.value?.totalPairs ?? 0; });
  const combo = computed(() => { touch(); return game.value?.combo() ?? 1; });
  const revealingAll = computed(() => { touchClock(); return game.value?.revealingAll ?? false; });
  /** Giây còn lại của lúc hé mở cả bàn. Không có đồng hồ thì bài úp xuống đột
   *  ngột, người chơi không biết còn bao lâu để nhìn. */
  const peekLeft = computed(() => {
    touchClock();
    const g = game.value;
    if (!g?.revealUntil) return null;
    return Math.max(0, (g.revealUntil - now.value) / 1000);
  });
  const status = computed(() => { touch(); return game.value?.status ?? 'idle'; });
  /** Bàn đang khoá vì chờ úp lại 2 thẻ sai — phải đi qua `rev` vì `game.locked`
   *  là getter của class, Vue không theo dõi được trực tiếp. */
  const locked = computed(() => { touchClock(); return game.value?.locked ?? false; });

  const elapsed = computed(() => { touchClock(); return game.value?.elapsed(now.value) ?? 0; });
  const timeLeft = computed(() => { touchClock(); return game.value?.timeLeft(now.value) ?? null; });
  const movesLeft = computed(() => { touch(); return game.value?.movesLeft() ?? null; });
  const turnTimeLeft = computed(() => { touchClock(); return game.value?.turnTimeLeft(now.value) ?? null; });
  const moves = computed(() => { touch(); return game.value?.moves ?? 0; });

  /** Thẻ nào đang ngửa mặt — tính lại theo cả rev và now (vì hé mở có hạn giờ). */
  const faceUp = computed<Set<number>>(() => {
    touchClock();
    const g = game.value;
    const set = new Set<number>();
    if (!g) return set;
    for (const c of g.cards) if (g.isFaceUp(c.index)) set.add(c.index);
    return set;
  });

  const matchedSet = computed<Set<number>>(() => {
    touch();
    const g = game.value;
    const set = new Set<number>();
    if (!g) return set;
    for (const c of g.cards) if (g.isMatched(c.index)) set.add(c.index);
    return set;
  });

  return {
    game, start, flip, stop, adopt, setBot, botLevel, botThinking, botTurnNow,
    cards, players, current, faceUp, matchedSet, wrongPair, lastPower, swapPair, lastGain, lifeGain, turnBanner, timeBonusFor,
    matchedCount, totalPairs, combo, revealingAll, peekLeft, status, locked,
    elapsed, timeLeft, movesLeft, moves, summary, turnTimeLeft, countdownLeft, backStyle
  };
}
