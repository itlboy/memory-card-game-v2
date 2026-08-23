import { ROOM_LIMITS, isDraw } from '@mm/engine';
import type {
  ClientMsg, GameView, PublicEvent, QuickEmoji, RoomConfig, RoomInfo, ServerMsg
} from '@mm/engine';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { CARD_BACKS } from '@mm/engine';
import { sfx } from '@/lib/audio';
import { store } from '@/lib/storage';

/**
 * Địa chỉ server online. Bản deploy dùng CHÍNH origin đang chạy: web và worker
 * giờ là một Worker duy nhất (xem apps/server/wrangler.jsonc), nên không còn
 * phải khai địa chỉ server cho từng môi trường — thiếu khai là hỏng im lặng.
 * Lúc dev thì vite ở :3001 còn wrangler ở :8787 nên vẫn cần địa chỉ riêng.
 * VITE_SERVER_URL vẫn được tôn trọng để trỏ tay khi cần.
 */
const SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:8787' : location.origin);
const WS_SERVER = SERVER.replace(/^http/, 'ws');

type Phase = 'idle' | 'connecting' | 'lobby' | 'playing' | 'ended' | 'error';

interface StoredSession { code: string; token: string; name: string }
const SESSION_KEY = 'mm.online';

/**
 * Client online: mọi luật chơi nằm trên server (ON-09) — composable này chỉ
 * gửi hành động, nhận sự kiện + view đã che thẻ úp, và lo tự vào lại khi
 * rớt mạng trong hạn 30 giây (ON-07).
 */
export function useOnlineRoom() {
  const phase = ref<Phase>('idle');
  const error = ref('');
  const room = shallowRef<RoomInfo | null>(null);
  const view = shallowRef<GameView | null>(null);
  const myId = ref('');
  const spectator = ref(false);
  const reconnecting = ref(false);
  /** Hiệu ứng phía client — cùng ngôn ngữ với chế độ offline. */
  const wrongPair = ref<number[]>([]);
  /**
   * So trạng thái sẵn sàng cũ với mới rồi phát tiếng. Phát theo THAY ĐỔI chứ
   * không theo cú bấm của mình: server gửi cùng một tin cho cả phòng, nên hai
   * bên đều nghe và đều biết đối phương vừa làm gì.
   */
  function announceReady(next: RoomInfo): void {
    const before = room.value;
    if (!before) return;
    // Có người vừa bấm "chơi lại": phát tiếng cho cả phòng, không thì bên kia
    // bấm mà bên này không hay biết gì
    const wasVotes = new Set(before.againVotes ?? []);
    for (const id of next.againVotes ?? []) if (!wasVotes.has(id)) sfx.ready();
    if (next.status !== 'lobby') return;
    for (const p of next.players) {
      const was = before.players.find((q) => q.id === p.id);
      if (!was || !!was.ready === !!p.ready) continue;
      if (p.ready) sfx.ready(); else sfx.unready();
    }
  }

  /** Mình đã bấm "chơi lại" chưa. */
  const iWantAgain = computed(() =>
    !!myId.value && (room.value?.againVotes ?? []).includes(myId.value));
  /** Tên những người KHÁC đã bấm chơi lại. Bên chưa bấm phải thấy dòng này, nếu
   *  không thì đối phương bấm xong mà bên này không hay biết gì. */
  const againFrom = computed(() => {
    const r = room.value;
    if (!r) return [] as string[];
    return (r.againVotes ?? [])
      .filter((id) => id !== myId.value)
      .map((id) => r.players.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n);
  });

  /** Tên những người CÒN chưa bấm — để nói rõ đang chờ ai. */
  const againWaiting = computed(() => {
    const r = room.value;
    if (!r) return [] as string[];
    const voted = new Set(r.againVotes ?? []);
    return r.players.filter((p) => p.connected && !voted.has(p.id)).map((p) => p.name);
  });

  /* ---------- nhịp tim: đo độ trễ mạng của CHÍNH MÌNH ---------- */

  /**
   * Độ trễ vòng đi-về, ms. null = chưa đo được lần nào.
   *
   * Hiện số GIỮA của 5 nhịp gần nhất, không hiện nhịp mới nhất: mạng thật dao
   * động 50–60ms rồi thỉnh thoảng vọt 300ms, mà hiện số tức thời thì chip nhảy
   * loạn — vừa khó đọc vừa làm người chơi tưởng mạng đang tệ trong khi chỉ là
   * một nhịp lẻ.
   */
  const ping = ref<number | null>(null);
  /** 5 nhịp gần nhất, để lấy số giữa. */
  const pingSamples: number[] = [];
  /** Mất bao lâu chưa nhận được pong — dùng để biết mình đang mất mạng. */
  const pingLost = ref(0);
  let pingSentAt = 0;
  let pingTimer: ReturnType<typeof setInterval> | undefined;

  /**
   * 4 giây một nhịp. Server trả lời bằng auto-response nên KHÔNG đánh thức
   * Durable Object (không tính tiền thời gian chạy), còn tin vào tính theo tỷ
   * lệ 20:1 nên hai người chơi cả tiếng cũng chỉ tốn vài trăm request.
   */
  function startHeartbeat(): void {
    stopHeartbeat();
    const beat = (): void => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      if (pingSentAt) pingLost.value += 1;   // nhịp trước chưa có trả lời
      // Mất 3 nhịp liền (12 giây) là socket coi như chết. iOS treo kết nối khi
      // người chơi rời app mà readyState vẫn báo OPEN, nên KHÔNG có bước này
      // thì họ ngồi nhìn chip đỏ mãi tới khi tự tải lại trang.
      if (pingLost.value >= 3 && code && token) {
        reconnecting.value = true;
        connect(code, myName, token);
        return;
      }
      pingSentAt = performance.now();
      ws.send(JSON.stringify({ t: 'ping' }));
    };
    beat();   // đo ngay, không thì 4 giây đầu ván chỗ hiện ping còn trống
    pingTimer = setInterval(beat, 4000);
  }
  function stopHeartbeat(): void {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = undefined;
    pingSentAt = 0;
    pingLost.value = 0;
    ping.value = null;
    pingSamples.length = 0;
  }

  /** Ô đã bấm nhưng server chưa xác nhận — UI lật tới 90 độ để bấm là thấy phản hồi. */
  const pending = ref<Set<number>>(new Set());

  /**
   * Bỏ khỏi `pending` những ô server đã trả lời. Không xoá sạch cả tập: người
   * chơi bấm ô thứ hai trước khi view của ô thứ nhất về là chuyện thường, xoá
   * sạch thì ô thứ hai bật ngược về mặt úp rồi lật lại — thấy giật.
   *
   * Ô nào server vẫn báo 'down' thì giữ, vì có thể view này chưa kịp mang câu
   * trả lời cho nó. Lượt bị từ chối (không phải lượt mình) không có view riêng
   * nào cả, nên phải có hẹn giờ dọn ở flip().
   */
  function settlePending(v: GameView): void {
    if (!pending.value.size) return;
    const still = new Set(
      [...pending.value].filter((i) => v.cards[i]?.state === 'down')
    );
    if (still.size !== pending.value.size) pending.value = still;
  }
  /** Hai ô vừa bị thẻ tráo đổi hoán chỗ — BoardGrid dùng để chạy hiệu ứng. */
  const swapPair = ref<{ a: number; b: number; key: number } | null>(null);
  const lastGain = ref<{ amount: number; index: number; key: number } | null>(null);
  const turnBanner = ref<{ name: string; avatar: string; frozen: string | null; key: number } | null>(null);
  const bubbles = ref<Record<string, { emoji: QuickEmoji; key: number }>>({});
  /** Emoji mới nhất phóng to giữa bàn cho ấn tượng. */
  const emojiBlast = ref<{ emoji: QuickEmoji; name: string; key: number } | null>(null);
  let blastTimer: ReturnType<typeof setTimeout> | undefined;
  const timeBonusFor = ref<{ playerId: string; key: number } | null>(null);
  /** Hạn chót lượt (ms cục bộ) — server gửi số giây còn lại, client đếm tiếp cho mượt. */
  const turnDeadline = ref(0);
  /** Mốc thời gian đã trôi của ván (giây + thời điểm nhận) — đếm tiếp cục bộ. */
  const elapsedMark = ref<{ sec: number; at: number } | null>(null);
  /** Đếm ngược 5 giây trước ván + người đi đầu. */
  const countdown = ref<{ endsAt: number; firstId: string; firstName: string } | null>(null);
  /** Mặt sau của ván — bốc ngẫu nhiên mỗi ván mới. */
  /** Mặt sau lấy TỪ SERVER: bốc tại client thì hai người chơi cùng một bàn lại
   *  thấy hai kiểu khác nhau — đúng lỗi đã gặp. */
  const backStyle = computed<string>(() => view.value?.back ?? CARD_BACKS[0]);
  let lastCountdownSec = -1;
  const clock = ref(0);
  let lastUrgentTick = 0;
  const clockTimer = setInterval(() => {
    clock.value = Date.now();
    // Đếm ngược trước ván: mỗi giây một tick
    const cd = countdownLeft.value;
    if (cd !== null && cd !== lastCountdownSec) { lastCountdownSec = cd; sfx.tick(); }
    // Tới lượt mình mà còn ≤10 giây: tick dồn dập mỗi 500ms để giục
    const left = turnTimeLeft.value;
    if (left !== null && left > 0 && left <= 10
      && view.value?.currentId === myId.value
      && clock.value - lastUrgentTick >= 500) {
      lastUrgentTick = clock.value;
      sfx.tick();
    }
  }, 200);

  const turnTimeLeft = computed(() => {
    if (!turnDeadline.value || view.value?.status !== 'playing' || view.value.summary) return null;
    return Math.max(0, (turnDeadline.value - clock.value) / 1000);
  });

  /** Giây đếm ngược còn lại; null = không trong giai đoạn đếm ngược. */
  const countdownLeft = computed(() => {
    if (!countdown.value) return null;
    const left = (countdown.value.endsAt - clock.value) / 1000;
    return left > 0 ? Math.ceil(left) : null;
  });

  const elapsed = computed(() => {
    const m = elapsedMark.value;
    if (!m) return 0;
    if (view.value?.summary) return m.sec;                        // ván xong thì đứng
    return m.sec + Math.max(0, (clock.value - m.at) / 1000);
  });

  let ws: WebSocket | null = null;
  let token = '';
  /** Config host đã chọn trước khi tạo phòng — gửi lên ngay sau welcome. */
  let pendingConfig: Partial<RoomConfig> | null = null;
  let myName = '';
  let code = '';
  let intentionalClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDeadline = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;

  const isHost = computed(() => !!room.value && room.value.hostId === myId.value);
  const me = computed(() => room.value?.players.find((p) => p.id === myId.value) ?? null);
  const myTurn = computed(() =>
    !spectator.value && !!view.value && !!myId.value && view.value.currentId === myId.value);

  function send(msg: ClientMsg): void {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  async function createRoom(name: string, config?: Partial<RoomConfig>): Promise<void> {
    phase.value = 'connecting';
    error.value = '';
    pendingConfig = config ?? null;
    try {
      const res = await fetch(`${SERVER}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { code: string };
      connect(data.code, name);
    } catch {
      phase.value = 'error';
      error.value = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    }
  }

  /**
   * Vào phòng có sẵn. Kiểm mã TRƯỚC khi mở WebSocket: mã sai thì socket chỉ
   * đóng lặng lẽ, người chơi không biết vì sao — mà trước đây còn tệ hơn, mã
   * sai được lập thành phòng mới nên họ ngồi chờ mãi một người sẽ không tới.
   */
  async function join(roomCode: string, name: string): Promise<void> {
    const c = roomCode.trim();
    phase.value = 'connecting';
    error.value = '';
    try {
      const res = await fetch(`${SERVER}/api/rooms/${c}`);
      const { exists } = (await res.json()) as { exists: boolean };
      if (!exists) {
        phase.value = 'idle';
        error.value = `Không có phòng nào mang mã ${c}. Kiểm lại mã giúp mình nhé.`;
        return;
      }
    } catch {
      // Không kiểm được (mất mạng) thì cứ thử kết nối — server vẫn chặn mã lạ
    }
    connect(c, name);
  }

  function connect(roomCode: string, name: string, useToken = ''): void {
    leaveSocket();
    intentionalClose = false;
    code = roomCode;
    myName = name;
    phase.value = phase.value === 'playing' ? 'playing' : 'connecting';
    error.value = '';

    const params = new URLSearchParams({ name });
    if (useToken) params.set('token', useToken);
    ws = new WebSocket(`${WS_SERVER}/ws/${roomCode}?${params}`);

    ws.onopen = () => startHeartbeat();
    ws.onmessage = (e) => handle(JSON.parse(String(e.data)) as ServerMsg);
    ws.onclose = (e) => {
      // 4000: bị thay bằng socket mới · 4001: tự rời · 4002: chủ phòng huỷ
      if (intentionalClose || e.code === 4000 || e.code === 4001 || e.code === 4002) return;
      // Đang trong ván: tự vào lại trong hạn 30 giây (ON-07)
      if (token && (phase.value === 'playing' || phase.value === 'lobby')) {
        if (!reconnectDeadline) reconnectDeadline = Date.now() + ROOM_LIMITS.reconnectMs;
        if (Date.now() < reconnectDeadline) {
          reconnecting.value = true;
          reconnectTimer = setTimeout(() => connect(code, myName, token), 1500);
          return;
        }
      }
      phase.value = 'error';
      error.value ||= 'Mất kết nối với phòng.';
    };
    ws.onerror = () => { /* onclose sẽ lo */ };
  }

  function handle(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        myId.value = msg.playerId;
        token = msg.token;
        spectator.value = !!msg.spectator;
        reconnecting.value = false;
        reconnectDeadline = 0;
        room.value = msg.room;
        if (msg.spectator) {
          // Khán giả: phòng đã bắt đầu / đầy — chỉ xem, không lưu phiên
          phase.value = msg.room.status === 'ended' ? 'ended' : 'playing';
          break;
        }
        phase.value = msg.room.status === 'lobby' ? 'lobby' : phase.value;
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(
            { code, token, name: myName } satisfies StoredSession));
        } catch { /* riêng tư */ }
        // Bàn chơi host đã chọn trong wizard trước khi tạo phòng
        if (pendingConfig && msg.room.hostId === msg.playerId) {
          send({ t: 'config', config: pendingConfig });
          pendingConfig = null;
        }
        break;

      case 'room':
        // Ai đó bấm sẵn sàng hay huỷ: phát tiếng cho CẢ PHÒNG nghe. Trước đây
        // bấm xong im lặng nên không ai biết đối phương đã sẵn sàng hay chưa.
        announceReady(msg.room);
        room.value = msg.room;
        if (msg.room.status === 'lobby') {
          phase.value = 'lobby';
          view.value = null;          // "Chơi lại" đưa cả phòng về lobby — bỏ view ván cũ
          countdown.value = null;
        }
        if (msg.room.status === 'playing') {
          countdown.value = null;     // hết đếm ngược, ván chạy thật
          phase.value = 'playing';
        }
        if (msg.room.status === 'ended') endSession();
        break;

      case 'state':
        view.value = msg.view;
        settlePending(msg.view);
        syncTurnClock(msg.view);
        if (msg.view.status === 'playing' || room.value?.status === 'countdown') phase.value = 'playing';
        if (msg.view.summary) endSession();
        break;

      case 'countdown':
        countdown.value = {
          endsAt: Date.now() + msg.endsInMs,
          firstId: msg.firstId,
          firstName: msg.firstId === myId.value ? 'Bạn' : msg.firstName
        };
        phase.value = 'playing';
        sfx.turn();
        break;

      case 'events':
        applyEvents(msg.events);
        view.value = msg.view;
        settlePending(msg.view);
        syncTurnClock(msg.view);
        if (msg.view.status === 'playing') phase.value = 'playing';
        break;

      case 'closed':
        // Chủ phòng huỷ phòng: về màn vào phòng kèm thông báo
        clearStored();
        leaveSocket();
        room.value = null;
        view.value = null;
        phase.value = 'error';
        error.value = msg.message;
        break;

      case 'emoji': {
        const cur = bubbles.value[msg.from];
        bubbles.value = {
          ...bubbles.value,
          [msg.from]: { emoji: msg.emoji, key: (cur?.key ?? 0) + 1 }
        };
        const sender = room.value?.players.find((p) => p.id === msg.from);
        emojiBlast.value = {
          emoji: msg.emoji,
          name: msg.from === myId.value ? 'Bạn' : (sender?.name ?? ''),
          key: (emojiBlast.value?.key ?? 0) + 1
        };
        clearTimeout(blastTimer);
        blastTimer = setTimeout(() => { emojiBlast.value = null; }, 1900);
        sfx.select();
        setTimeout(() => {
          const rest = { ...bubbles.value };
          delete rest[msg.from];
          bubbles.value = rest;
        }, 2200);
        break;
      }

      case 'error':
        error.value = msg.message;
        break;

      case 'pong':
        if (pingSentAt) {
          pingSamples.push(Math.round(performance.now() - pingSentAt));
          if (pingSamples.length > 5) pingSamples.shift();
          const sorted = [...pingSamples].sort((a, b) => a - b);
          ping.value = sorted[Math.floor(sorted.length / 2)]!;
          pingSentAt = 0;
          pingLost.value = 0;
        }
        break;
    }
  }

  function syncTurnClock(v: GameView): void {
    turnDeadline.value = v.turnTimeLeft === null ? 0 : Date.now() + v.turnTimeLeft * 1000;
    elapsedMark.value = { sec: v.elapsed, at: Date.now() };
  }

  function applyEvents(events: PublicEvent[]): void {
    let frozenId: string | null = null;
    let turnId: string | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'flip':
          // Thẻ mình tự bấm đã phát tiếng ngay lúc bấm rồi; phát lại là nghe đôi
          if (!pending.value.has(e.index)) sfx.flip();
          break;
        case 'match': {
          const streak = 1 + (view.value?.players.find((p) => p.id === e.playerId)?.bestStreak ?? 0);
          sfx.match(Math.min(streak, 4));
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
          // Mặt sau mọi lá bài giống hệt nhau, nên không có hiệu ứng thì cả
          // phòng không ai biết vừa có hai thẻ đổi chỗ (giống chơi đơn)
          if (e.power === 'swap' && e.affected.length === 2) {
            swapPair.value = { a: e.affected[0]!, b: e.affected[1]!, key: (swapPair.value?.key ?? 0) + 1 };
            setTimeout(() => { swapPair.value = null; }, 620);
          }
          break;
        case 'turn':
          if (e.skipped) frozenId = e.playerId;
          else { turnId = e.playerId; sfx.turn(); }
          break;
        case 'turn-timeout':
          sfx.miss();
          break;
        case 'time-bonus':
          timeBonusFor.value = { playerId: e.playerId, key: (timeBonusFor.value?.key ?? 0) + 1 };
          setTimeout(() => { timeBonusFor.value = null; }, 1400);
          break;
        case 'life-gain': {
          const who = view.value?.players.find((p) => p.id === e.playerId);
          sfx.unlockTheme();
          lifeGain.value = { name: who?.name ?? '', key: (lifeGain.value?.key ?? 0) + 1 };
          setTimeout(() => { lifeGain.value = null; }, 3200);
          break;
        }
        case 'end': {
          const draw = isDraw(e.summary.ranking);
          // Tỷ số cả loạt trong phòng: chủ phòng bấm "chơi lại" nhiều ván nên
          // đây là con số người trong phòng thực sự theo dõi. Giữ ở client theo
          // TÊN (id đổi khi vào lại phòng), hoà thì không ai được cộng.
          const champName = e.summary.ranking[0]?.name;
          if (champName && !draw) {
            seriesWins.value = { ...seriesWins.value, [champName]: (seriesWins.value[champName] ?? 0) + 1 };
          }
          const iLead = e.summary.ranking[0]?.id === myId.value;
          if (draw) sfx.win();                     // hoà: mừng nhẹ, không fanfare
          else if (iLead) sfx.victory();
          else sfx.defeat();
          // Điểm của CHÍNH mình được cộng vào tổng tích luỹ — chơi online cả
          // buổi mà tổng không nhích thì không mở được theme nào
          store.addScore(e.summary.ranking.find((p) => p.id === myId.value)?.score ?? 0);
          endSession();
          break;
        }
      }
    }
    if (turnId) {
      const find = (id: string | null) => room.value?.players.find((p) => p.id === id);
      const p = find(turnId);
      if (p) {
        turnBanner.value = {
          name: p.id === myId.value ? 'bạn' : p.name,
          avatar: p.avatar ?? '',
          frozen: find(frozenId)?.name ?? null,
          key: (turnBanner.value?.key ?? 0) + 1
        };
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => { turnBanner.value = null; }, 1500);
      }
    }
  }

  function clearStored(): void {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* bỏ qua */ }
  }

  /**
   * Ván đã kết thúc: xoá phiên + làm sạch URL để F5/quay lại không bị hút
   * ngược vào màn kết thúc của trận cũ nữa.
   */
  function endSession(): void {
    phase.value = 'ended';
    clearStored();
    if (location.search.includes('room=')) history.replaceState(null, '', location.pathname);
  }

  /**
   * Có phiên dở dang trong sessionStorage (reload trang giữa ván)?
   * `matchCode`: chỉ resume nếu đúng phòng đó (khi vào bằng link mời).
   */
  function resumeStored(matchCode?: string): boolean {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw) as StoredSession;
      if (matchCode && s.code !== matchCode) return false;
      token = s.token;
      connect(s.code, s.name, s.token);
      return true;
    } catch { return false; }
  }

  /** Chất lượng mạng của MÌNH, gộp thành ba mức cho UI. */
  const netQuality = computed<'good' | 'ok' | 'bad' | 'lost'>(() => {
    if (pingLost.value >= 2) return 'lost';
    const p = ping.value;
    if (p === null) return 'ok';
    // Mốc chọn theo mạng thật đo được: 50–60ms là bình thường nên phải nằm
    // trong "tốt"; 300ms là lúc bấm thẻ đã thấy trễ nên phải chuyển vàng, chứ
    // để trần 350 thì đúng lúc đáng cảnh báo lại vẫn màu trung tính.
    if (p < 100) return 'good';
    if (p < 250) return 'ok';
    return 'bad';
  });

  function leaveSocket(): void {
    clearTimeout(reconnectTimer);
    stopHeartbeat();
    if (ws) {
      intentionalClose = true;
      try { ws.close(); } catch { /* đã đóng */ }
      ws = null;
    }
  }

  function leave(): void {
    leaveSocket();
    clearStored();
    phase.value = 'idle';
    room.value = null;
    view.value = null;
    myId.value = '';
    token = '';
    error.value = '';
    reconnectDeadline = 0;
  }

  /**
   * Quay lại app (đổi tab, mở lại từ màn khoá): đo ngay một nhịp thay vì đợi
   * hết 4 giây. Trên iPhone đây là lúc dễ phát hiện socket đã chết trong lúc
   * app nằm nền.
   */
  function onWake(): void {
    if (document.visibilityState !== 'visible') return;
    if (pingTimer) startHeartbeat();
  }
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('pageshow', onWake);

  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('pageshow', onWake);
    leaveSocket();
    clearInterval(clockTimer);
  });

  /* ---------- chống spam emoji ---------- */
  // Server mới là nơi thực sự chặn (client không đáng tin — ON-09); phần này chỉ
  // để người chơi THẤY mình đã hết lượt, chứ không phải bấm mà chẳng có gì xảy ra.
  /** Số ván thắng của từng người trong phòng, theo tên. */
  const seriesWins = ref<Record<string, number>>({});
  /** Ai vừa hồi mạng (Sinh tồn). */
  const lifeGain = ref<{ name: string; key: number } | null>(null);

  const emojiSentAt: number[] = [];
  const emojiReady = ref(true);
  /** Giây còn lại tới lúc gửi được tiếp; 0 khi đang rảnh. Hiện lên UI để người
   *  chơi biết phải chờ bao lâu, chứ không phải bấm mãi mà không hiểu vì sao. */
  const emojiCooldown = ref(0);
  let emojiTimer: ReturnType<typeof setInterval> | undefined;

  function refreshEmojiQuota(): void {
    const cutoff = Date.now() - ROOM_LIMITS.emojiWindowMs;
    while (emojiSentAt.length && emojiSentAt[0]! <= cutoff) emojiSentAt.shift();
    emojiReady.value = emojiSentAt.length < ROOM_LIMITS.emojiBurst;
    if (emojiReady.value) {
      emojiCooldown.value = 0;
      clearInterval(emojiTimer);
      emojiTimer = undefined;
      return;
    }
    // Mở lại đúng lúc cái cũ nhất rơi ra khỏi cửa sổ
    const openAt = emojiSentAt[0]! + ROOM_LIMITS.emojiWindowMs;
    emojiCooldown.value = Math.max(1, Math.ceil((openAt - Date.now()) / 1000));
    if (!emojiTimer) emojiTimer = setInterval(refreshEmojiQuota, 250);
  }

  onScopeDispose(() => clearInterval(emojiTimer));

  function sendEmoji(emoji: string): void {
    refreshEmojiQuota();
    if (!emojiReady.value) return;
    emojiSentAt.push(Date.now());
    send({ t: 'emoji', emoji });
    refreshEmojiQuota();
  }

  return {
    phase, error, room, view, myId, isHost, me, myTurn, reconnecting, spectator,
    wrongPair, swapPair, lastGain, turnBanner, bubbles, emojiBlast, turnTimeLeft, timeBonusFor, elapsed,
    countdown, countdownLeft, backStyle,
    createRoom, join, leave, resumeStored,
    setReady: (ready: boolean) => send({ t: 'ready', ready }),
    /** Đầu hàng (đang chơi) hoặc rời phòng (lobby) rồi thoát. */
    surrender: () => { send({ t: 'leave' }); leave(); },
    /** Chủ phòng huỷ phòng — mọi người bị đưa ra ngoài. */
    cancelRoom: () => { send({ t: 'cancel' }); leave(); },
    setConfig: (config: Partial<RoomConfig>) => send({ t: 'config', config }),
    start: () => send({ t: 'start' }),
    ping,
    netQuality,
    again: () => {
      // Phản hồi ngay tại chỗ, y như bấm thẻ: chờ server xác nhận mới đổi gì
      // thì người bấm tưởng nút bị hỏng
      sfx.ready();
      send({ t: 'again' });
    },
    iWantAgain,
    againWaiting,
    againFrom,
    flip: (index: number) => {
      // Phản hồi NGAY, không chờ server. Vòng đi-về đo được 69ms lúc bình
      // thường nhưng có lúc vọt 376ms, và trong suốt khoảng đó màn hình không
      // có gì thay đổi — chính khoảng lặng đó là cảm giác lag, không phải con
      // số. Đánh dấu "đang chờ" để UI lật thẻ tới 90 độ (cạnh thẻ, CHƯA thấy
      // mặt nên không bịa thông tin — NF-04 vẫn nguyên), rồi khi view về mới
      // lật nốt sang mặt thật.
      pending.value = new Set(pending.value).add(index);
      sfx.flip();
      send({ t: 'flip', index });
      // Lượt bị server bỏ qua (không phải lượt mình) không sinh view nào, nên
      // không có gì dọn `pending` — hẹn giờ trả thẻ về mặt úp
      setTimeout(() => {
        if (!pending.value.has(index)) return;
        const left = new Set(pending.value);
        left.delete(index);
        pending.value = left;
      }, 1500);
    },
    pending,
    sendEmoji,
    /** Còn được gửi emoji không — dùng để làm mờ và chặn nút. */
    emojiReady,
    /** Giây còn lại tới lúc gửi được tiếp (0 = đang rảnh). */
    emojiCooldown,
    /** Số ván thắng trong loạt của phòng (theo tên). */
    seriesWins,
    /** Ai vừa hồi mạng (Sinh tồn). */
    lifeGain,
    roomCode: () => code
  };
}
