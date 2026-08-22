/**
 * Giao thức online + view công khai — dùng chung giữa server (Durable Object)
 * và client. Nguyên tắc NF-04: client KHÔNG BAO GIỜ nhận biểu tượng của thẻ
 * đang úp; server chỉ gửi những gì đã lộ trên bàn.
 */
import type { GameEvent, Mode, Player, Summary } from './types.js';
import type { MemoryGame } from './game.js';

/* ---------- cấu hình phòng (ON-03) ---------- */

export interface RoomConfig {
  /** Mọi chế độ trừ Chiến dịch — xem ROOM_MODES bên dưới. */
  mode: Exclude<Mode, 'campaign'>;
  grid: string;
  /** Các theme đang chọn — bàn thẻ trộn biểu tượng của tất cả. */
  themeIds: string[];
}

/** Chế độ dùng được trong phòng nhiều người: mọi thứ trừ Chiến dịch — chiến
 *  dịch là chuỗi màn của riêng một người và dựng bàn qua levelConfig(). */
export const ROOM_MODES = ['classic', 'time', 'survival', 'peek'] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

/** themeIds rỗng = server tự dùng TẤT CẢ theme nó có. Ghi cứng một theme thì
 *  phòng tạo nhanh (chưa qua wizard) chỉ có một bộ biểu tượng. */
export const DEFAULT_ROOM_CONFIG: RoomConfig = { mode: 'classic', grid: '4x4', themeIds: [] };

export const ROOM_LIMITS = {
  maxPlayers: 4,
  minPlayers: 2,
  /** Rớt mạng quá hạn này thì bị xử thua (ON-07). */
  reconnectMs: 30_000,
  codeLength: 6,
  /** Chống spam emoji: tối đa `emojiBurst` lần trong `emojiWindowMs`.
   *  Client dùng để làm mờ nút, server dùng để thực sự chặn (client không
   *  đáng tin — ON-09), nên hai bên phải đọc cùng một con số. */
  emojiBurst: 3,
  emojiWindowMs: 10_000
} as const;

/** Emoji chat nhanh — danh sách đóng để tránh nội dung xấu (ON-08).
 *  Nghiêng về trêu đùa vui: 🐔 gà (chê đánh dở), 🐌 chậm như sên, 🍌 trượt vỏ
 *  chuối, 💩 dở, 🧠 nhớ giỏi. Bỏ 👍 / 😮 / 🤔 vì chỉ là phản ứng suông, không
 *  tạo được không khí đùa nhau giữa bạn bè. */
export const QUICK_EMOJIS = ['😂', '🐔', '🐌', '🍌', '💩', '😭', '😡', '🔥', '🧠', '🎉'] as const;
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
  /** Mạng còn lại (Sinh tồn); null = chế độ không dùng mạng. */
  lives: number | null;
  /** Đã bấm sẵn sàng ở lobby (chủ phòng mặc nhiên sẵn sàng). */
  ready?: boolean;
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
  /** Giây còn lại của lượt hiện tại (đồng hồ lượt). */
  turnTimeLeft: number | null;
  /** Giây đã trôi của ván — client tự đếm tiếp giữa hai lần cập nhật. */
  elapsed: number;
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
      // Chớp nhoáng / thẻ mắt thần hé mở TOÀN BÀN trong vài giây — thiếu điều
      // kiện này thì chế độ đó ở phòng online chỉ hiện một bàn úp im lìm.
      // Vẫn an toàn theo NF-04: engine trên server mới quyết định lúc nào hé.
      const up = matched || game.revealingAll || game.selection.includes(c.index);
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
    turnTimeLeft: game.turnTimeLeft(now),
    elapsed: Math.floor(game.elapsed(now)),
    summary: game.summary()
  };
}

export function publicPlayer(p: Player, connected: boolean): PublicPlayer {
  return {
    id: p.id, name: p.name, avatar: p.avatar,
    score: p.score, pairs: p.pairs, bestStreak: p.bestStreak,
    frozenTurns: p.frozenTurns, doubleNext: p.doubleNext,
    forfeited: !!p.forfeited, connected,
    lives: Number.isFinite(p.lives) ? p.lives : null
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
  | { t: 'ready'; ready: boolean }                  // sẵn sàng ở lobby
  | { t: 'leave' }                                  // đầu hàng (đang chơi) / rời phòng (lobby)
  | { t: 'cancel' }                                 // chủ phòng huỷ phòng
  | { t: 'emoji'; emoji: string }
  | { t: 'ping' };

export interface RoomInfo {
  code: string;
  hostId: string;
  config: RoomConfig;
  players: PublicPlayer[];
  status: 'lobby' | 'countdown' | 'playing' | 'ended';
}

/** Server → client. */
export type ServerMsg =
  | { t: 'welcome'; playerId: string; token: string; room: RoomInfo; spectator?: boolean }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: GameView }
  | { t: 'countdown'; endsInMs: number; firstId: string; firstName: string }
  | { t: 'events'; events: PublicEvent[]; view: GameView }
  | { t: 'emoji'; from: string; emoji: QuickEmoji }
  | { t: 'closed'; message: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong' };
