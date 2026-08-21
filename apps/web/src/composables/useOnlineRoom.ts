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
  const reconnecting = ref(false);
  /** Hiệu ứng phía client — cùng ngôn ngữ với chế độ offline. */
  const wrongPair = ref<number[]>([]);
  const lastGain = ref<{ amount: number; index: number; key: number } | null>(null);
  const turnBanner = ref<{ name: string; avatar: string; frozen: string | null; key: number } | null>(null);
  const bubbles = ref<Record<string, { emoji: QuickEmoji; key: number }>>({});

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
  const myTurn = computed(() => !!view.value && view.value.currentId === myId.value);

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
      if (intentionalClose || e.code === 4000) return;
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
        reconnecting.value = false;
        reconnectDeadline = 0;
        room.value = msg.room;
        phase.value = msg.room.status === 'lobby' ? 'lobby' : phase.value;
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(
            { code, token, name: myName } satisfies StoredSession));
        } catch { /* riêng tư */ }
        break;

      case 'room':
        room.value = msg.room;
        if (msg.room.status === 'lobby') phase.value = 'lobby';
        if (msg.room.status === 'ended') phase.value = 'ended';
        break;

      case 'state':
        view.value = msg.view;
        if (msg.view.status === 'playing') phase.value = 'playing';
        if (msg.view.summary) phase.value = 'ended';
        break;

      case 'events':
        applyEvents(msg.events);
        view.value = msg.view;
        if (msg.view.status === 'playing') phase.value = 'playing';
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
        case 'end':
          e.summary.ranking[0]?.id === myId.value ? sfx.win() : sfx.lose();
          phase.value = 'ended';
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

  /** Có phiên dở dang trong sessionStorage (reload trang giữa ván)? */
  function resumeStored(): boolean {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw) as StoredSession;
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
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* bỏ qua */ }
    phase.value = 'idle';
    room.value = null;
    view.value = null;
    myId.value = '';
    token = '';
    error.value = '';
    reconnectDeadline = 0;
  }

  onScopeDispose(leaveSocket);

  return {
    phase, error, room, view, myId, isHost, me, myTurn, reconnecting,
    wrongPair, lastGain, turnBanner, bubbles,
    createRoom, join, leave, resumeStored,
    setConfig: (config: Partial<RoomConfig>) => send({ t: 'config', config }),
    start: () => send({ t: 'start' }),
    again: () => send({ t: 'again' }),
    flip: (index: number) => send({ t: 'flip', index }),
    sendEmoji: (emoji: string) => send({ t: 'emoji', emoji }),
    roomCode: () => code
  };
}
