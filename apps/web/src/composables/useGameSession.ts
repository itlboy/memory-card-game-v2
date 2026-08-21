import { MemoryGame } from '@mm/engine';
import type { Card, GameConfig, GameEvent, Player, Summary } from '@mm/engine';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
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
          e.power === 'bomb' ? sfx.bomb() : e.power === 'freeze' ? sfx.freeze() : sfx.power();
          lastPower.value = e;
          setTimeout(() => { lastPower.value = null; }, 1600);
          break;
        case 'turn':
          if (e.skipped) { frozenId = e.playerId; }
          else { turnId = e.playerId; sfx.turn(); }
          break;
        case 'turn-timeout':
          sfx.miss();
          break;
        case 'time-bonus':
          timeBonusFor.value = { playerId: e.playerId, key: (timeBonusFor.value?.key ?? 0) + 1 };
          setTimeout(() => { timeBonusFor.value = null; }, 1400);
          break;
        case 'end':
          summary.value = e.summary;
          e.summary.status === 'won' ? sfx.win() : sfx.lose();
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
    lastGain.value = null;
    turnBanner.value = null;
    clearTimeout(bannerTimer);
    lastTickSecond = -1;
    now.value = clockNow();
    pickBack();
    if (g.isMultiplayer) {
      // Multiplayer: đếm ngược 5 giây để người đi đầu không bị động
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

  function flip(index: number): void {
    const g = game.value;
    if (!g || countdownUntil) return;
    now.value = clockNow();
    handle(g.flip(index, now.value));
    if (!raf && !g.finished) raf = requestAnimationFrame(loop);
  }

  function stop(): void {
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
    game, start, flip, stop, adopt,
    cards, players, current, faceUp, matchedSet, wrongPair, lastPower, lastGain, turnBanner, timeBonusFor,
    matchedCount, totalPairs, combo, revealingAll, status, locked,
    elapsed, timeLeft, movesLeft, moves, summary, turnTimeLeft, countdownLeft, backStyle
  };
}
