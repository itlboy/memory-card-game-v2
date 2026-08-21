import { ROOM_LIMITS } from '@mm/engine';
import type {
  ClientMsg, GameView, PublicEvent, QuickEmoji, RoomConfig, RoomInfo, ServerMsg
} from '@mm/engine';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { sfx } from '@/lib/audio';

/** Địa chỉ server online; đổi qua biến build VITE_SERVER_URL khi deploy. */
const SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:8787';
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
  const lastGain = ref<{ amount: number; index: number; key: number } | null>(null);
  const turnBanner = ref<{ name: string; avatar: string; frozen: string | null; key: number } | null>(null);
  const bubbles = ref<Record<string, { emoji: QuickEmoji; key: number }>>({});
  const timeBonusFor = ref<{ playerId: string; key: number } | null>(null);
  /** Hạn chót lượt (ms cục bộ) — server gửi số giây còn lại, client đếm tiếp cho mượt. */
  const turnDeadline = ref(0);
  const clock = ref(0);
  let lastUrgentTick = 0;
  const clockTimer = setInterval(() => {
    clock.value = Date.now();
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

  let ws: WebSocket | null = null;
  let token = '';
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

  async function createRoom(name: string): Promise<void> {
    phase.value = 'connecting';
    error.value = '';
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

  function join(roomCode: string, name: string): void {
    connect(roomCode.trim().toUpperCase(), name);
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
        break;

      case 'room':
        room.value = msg.room;
        if (msg.room.status === 'lobby') phase.value = 'lobby';
        if (msg.room.status === 'ended') endSession();
        break;

      case 'state':
        view.value = msg.view;
        syncTurnClock(msg.view);
        if (msg.view.status === 'playing') phase.value = 'playing';
        if (msg.view.summary) endSession();
        break;

      case 'events':
        applyEvents(msg.events);
        view.value = msg.view;
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
        break;
    }
  }

  function syncTurnClock(v: GameView): void {
    turnDeadline.value = v.turnTimeLeft === null ? 0 : Date.now() + v.turnTimeLeft * 1000;
  }

  function applyEvents(events: PublicEvent[]): void {
    let frozenId: string | null = null;
    let turnId: string | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'flip': sfx.flip(); break;
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
          e.power === 'bomb' ? sfx.bomb() : e.power === 'freeze' ? sfx.freeze() : sfx.power();
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
        case 'end':
          e.summary.ranking[0]?.id === myId.value ? sfx.win() : sfx.lose();
          endSession();
          break;
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

  function leaveSocket(): void {
    clearTimeout(reconnectTimer);
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

  onScopeDispose(() => { leaveSocket(); clearInterval(clockTimer); });

  return {
    phase, error, room, view, myId, isHost, me, myTurn, reconnecting, spectator,
    wrongPair, lastGain, turnBanner, bubbles, turnTimeLeft, timeBonusFor,
    createRoom, join, leave, resumeStored,
    /** Đầu hàng (đang chơi) hoặc rời phòng (lobby) rồi thoát. */
    surrender: () => { send({ t: 'leave' }); leave(); },
    /** Chủ phòng huỷ phòng — mọi người bị đưa ra ngoài. */
    cancelRoom: () => { send({ t: 'cancel' }); leave(); },
    setConfig: (config: Partial<RoomConfig>) => send({ t: 'config', config }),
    start: () => send({ t: 'start' }),
    again: () => send({ t: 'again' }),
    flip: (index: number) => send({ t: 'flip', index }),
    sendEmoji: (emoji: string) => send({ t: 'emoji', emoji }),
    roomCode: () => code
  };
}
