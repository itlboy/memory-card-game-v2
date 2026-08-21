/**
 * Giao thức online + view công khai — dùng chung giữa server (Durable Object)
 * và client. Nguyên tắc NF-04: client KHÔNG BAO GIỜ nhận biểu tượng của thẻ
 * đang úp; server chỉ gửi những gì đã lộ trên bàn.
 */
import type { GameEvent, Mode, Player, Summary } from './types.js';
import type { MemoryGame } from './game.js';

/* ---------- cấu hình phòng (ON-03) ---------- */

export interface RoomConfig {
  mode: Extract<Mode, 'classic' | 'survival'>;
  grid: string;
  themeId: string;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = { mode: 'classic', grid: '4x4', themeId: 'animals' };

export const ROOM_LIMITS = {
  maxPlayers: 4,
  minPlayers: 2,
  /** Rớt mạng quá hạn này thì bị xử thua (ON-07). */
  reconnectMs: 30_000,
  codeLength: 6
} as const;

/** Emoji chat nhanh — danh sách đóng để tránh nội dung xấu (ON-08). */
export const QUICK_EMOJIS = ['👍', '😂', '😮', '😭', '🔥', '🎉', '🤔', '💩'] as const;
export type QuickEmoji = (typeof QUICK_EMOJIS)[number];

/* ---------- view công khai ---------- */

export interface PublicCard {
  index: number;
  /** 'down' = úp (không kèm symbol), 'up' = đang mở, 'matched' = đã ghép. */
  state: 'down' | 'up' | 'matched';
  symbol?: string;
  power?: string;
  blank?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  pairs: number;
  bestStreak: number;
  frozenTurns: number;
  doubleNext: boolean;
  forfeited: boolean;
  connected: boolean;
}

export interface GameView {
  cols: number;
  rows: number;
  cards: PublicCard[];
  players: PublicPlayer[];
  currentId: string;
  moves: number;
  matchedPairs: number;
  totalPairs: number;
  status: string;
  timeLeft: number | null;
  summary: Summary | null;
}

/** Chuyển trạng thái engine thành view an toàn để gửi client. */
export function publicView(
  game: MemoryGame,
  now: number,
  connected: (id: string) => boolean
): GameView {
  return {
    cols: game.config.cols,
    rows: game.config.rows,
    cards: game.cards.map((c) => {
      if (c.blank) return { index: c.index, state: 'down' as const, blank: true };
      const matched = game.isMatched(c.index);
      const up = matched || game.selection.includes(c.index);
      if (!up) return { index: c.index, state: 'down' as const };
      return {
        index: c.index,
        state: matched ? ('matched' as const) : ('up' as const),
        symbol: c.symbol,
        ...(c.power && !c.powerUsed ? { power: c.power } : {})
      };
    }),
    players: game.players.map((p) => publicPlayer(p, connected(p.id))),
    currentId: game.current.id,
    moves: game.moves,
    matchedPairs: game.matched.size,
    totalPairs: game.totalPairs,
    status: game.status,
    timeLeft: game.timeLeft(now),
    summary: game.summary()
  };
}

export function publicPlayer(p: Player, connected: boolean): PublicPlayer {
  return {
    id: p.id, name: p.name, avatar: p.avatar,
    score: p.score, pairs: p.pairs, bestStreak: p.bestStreak,
    frozenTurns: p.frozenTurns, doubleNext: p.doubleNext,
    forfeited: !!p.forfeited, connected
  };
}

/**
 * Lọc sự kiện engine trước khi phát cho client: sự kiện 'flip' được gắn thêm
 * symbol (thẻ VỪA lật là thông tin công khai), các sự kiện khác giữ nguyên —
 * chúng không chứa nội dung thẻ úp.
 */
export type PublicEvent = GameEvent | { type: 'flip'; index: number; symbol: string; power?: string };

export function publicEvents(game: MemoryGame, events: GameEvent[]): PublicEvent[] {
  return events.map((e) => {
    if (e.type !== 'flip') return e;
    const card = game.cards[e.index]!;
    return {
      type: 'flip' as const, index: e.index, symbol: card.symbol,
      ...(card.power && !card.powerUsed ? { power: card.power } : {})
    };
  });
}

/* ---------- thông điệp WebSocket ---------- */

/** Client → server. */
export type ClientMsg =
  | { t: 'config'; config: Partial<RoomConfig> }   // chỉ chủ phòng
  | { t: 'start' }                                  // chỉ chủ phòng
  | { t: 'flip'; index: number }
  | { t: 'again' }                                  // chủ phòng mở ván mới sau khi kết thúc
  | { t: 'emoji'; emoji: string }
  | { t: 'ping' };

export interface RoomInfo {
  code: string;
  hostId: string;
  config: RoomConfig;
  players: PublicPlayer[];
  status: 'lobby' | 'playing' | 'ended';
}

/** Server → client. */
export type ServerMsg =
  | { t: 'welcome'; playerId: string; token: string; room: RoomInfo }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: GameView }
  | { t: 'events'; events: PublicEvent[]; view: GameView }
  | { t: 'emoji'; from: string; emoji: QuickEmoji }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong' };
