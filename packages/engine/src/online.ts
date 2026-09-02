/**
 * Giao thức online + view công khai — dùng chung giữa server (Durable Object)
 * và client. Nguyên tắc NF-04: client KHÔNG BAO GIỜ nhận biểu tượng của thẻ
 * đang úp; server chỉ gửi những gì đã lộ trên bàn.
 */
import { DEFAULT_OPTIONS } from './options.js';
import type { BoardOptions } from './options.js';
import type { GameEvent, Player, Summary } from './types.js';
import type { MemoryGame } from './game.js';

/* ---------- cấu hình phòng (ON-03) ---------- */

export interface RoomConfig {
  /** Cấp độ (1..CAMPAIGN_LEVELS) — quyết định cỡ bàn, giống hệt chơi đơn. */
  level: number;
  /** Các theme đang chọn — bàn thẻ trộn biểu tượng của tất cả. */
  themeIds: string[];
  /**
   * Tuỳ chọn bàn chơi (năm công tắc 0..3) — thay cho `mode` cũ.
   *
   * Client KHÔNG đáng tin (ON-09): server phải cho cả bộ này qua
   * `sanitizeOptions` trước khi dùng, không thì một client sửa tay gửi lên
   * `lives: 999` hay `peek: 99` là dựng ra ván không ai chơi nổi.
   */
  options: BoardOptions;
}

/** Chiến dịch KHÔNG mở được trong phòng: nó là chuỗi màn của riêng một người,
 *  mở khoá dần theo tiến độ cá nhân. Phòng luôn là một ván lẻ. */

/** themeIds rỗng = server tự dùng TẤT CẢ theme nó có. Ghi cứng một theme thì
 *  phòng tạo nhanh (chưa qua wizard) chỉ có một bộ biểu tượng. */
// Cấp 6 = 8 cặp = bàn 4×4, cỡ bàn quen thuộc cho phòng tạo nhanh. Số này phải
// là cấp ĐẠI DIỆN của cỡ bàn (`BOARD_SIZES`), không phải một cấp bất kỳ có cùng
// cỡ: lobby tô ô đang chọn bằng cách so đúng số này.
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  level: 6, themeIds: [], options: DEFAULT_OPTIONS
};

export const ROOM_LIMITS = {
  maxPlayers: 10,
  minPlayers: 2,
  /**
   * Rớt mạng quá hạn này thì bị xử thua (ON-07).
   *
   * 5 PHÚT, không phải 30 giây. Ai cũng chơi trên điện thoại: khoá màn hình một
   * lúc, nhận cuộc gọi, chuyển sang Zalo trả lời một câu — iOS treo hẳn kết nối
   * của tab nền, và với hạn 30 giây thì quay lại là đã bị xoá khỏi phòng. Tệ
   * hơn: token cũ không còn ứng với ai nên vào lại được cấp CHỖ MỚI, thành ra
   * một người hoá hai (đúng lỗi đã bị phản ánh).
   *
   * Nới không làm treo ván: hết lượt thì engine tự `turn-timeout` chuyển lượt,
   * người rớt mạng chỉ bị bỏ lượt liên tục chứ bàn vẫn chạy. Ai muốn dứt điểm
   * sớm thì bấm đầu hàng — chỗ đó xử thua NGAY, không chờ hạn này.
   */
  reconnectMs: 300_000,
  codeLength: 6,
  /** Chống spam emoji: tối đa `emojiBurst` lần trong `emojiWindowMs`.
   *  Client dùng để làm mờ nút, server dùng để thực sự chặn (client không
   *  đáng tin — ON-09), nên hai bên phải đọc cùng một con số.
   *  10 lần / 4 giây (2,5 lần/giây): đủ nhanh để đối đáp qua lại như nói
   *  chuyện — mức cũ 3 lần / 5 giây khiến gửi ba cái là ngồi chờ, mà chat
   *  emoji là chuyện của những nhịp liên tiếp. Vẫn còn trần để một người
   *  không nhấn giữ mà lấp kín màn hình người khác. */
  emojiBurst: 10,
  emojiWindowMs: 4_000,
  /** Đếm ngược trước khi ván chạy. Client và server PHẢI đọc cùng con số này,
   *  lệch nhau là một bên đã cho lật khi bên kia còn đang đếm. */
  countdownMs: 3_000
} as const;

/**
 * Emoji chat nhanh — danh sách đóng để tránh nội dung xấu (ON-08).
 * Nghiêng về trêu đùa vui: 🐔 gà (chê đánh dở), 🐌 chậm như sên, 💩 dở,
 * 🐢 rùa (chúc may mắn — khác hẳn 🐌, đừng gộp hai cái làm một).
 * Bỏ 👍 / 😮 / 🤔 vì chỉ là phản ứng suông, không tạo được không khí đùa nhau.
 *
 * THỨ TỰ Ở ĐÂY LÀ THỨ TỰ ƯU TIÊN. Thanh emoji giữ nguyên cỡ nút (31px) và ẩn
 * bớt từ CUỐI khi máy hẹp, thay vì bóp nhỏ mọi nút — máy rộng thừa chỗ thì
 * chẳng có lý do gì bắt nó chịu theo máy hẹp nhất. Đo được: iPhone SE hiện 8
 * cái, iPhone 15 Pro Max hiện đủ 9. Nên cái hay dùng phải đặt TRƯỚC; thêm emoji
 * mới cứ thêm, nhưng biết là máy nhỏ sẽ không thấy nó.
 * Mốc nằm ở EmojiBar.vue (container query, mỗi nút 31px + gap 4px).
 */
export const QUICK_EMOJIS = ['😂', '🐔', '🐌', '🐢', '💩', '😭', '😡', '🔥', '🎉'] as const;
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

/**
 * Kiểu mặt sau lá bài. Nằm ở engine để CLIENT VÀ SERVER dùng cùng một danh
 * sách — trước đây mỗi client tự bốc bằng Math.random() nên hai người chơi cùng
 * một bàn lại thấy hai kiểu mặt sau khác nhau.
 */
export const CARD_BACKS = ['stars', 'diamond', 'aurora'] as const;
export type CardBack = (typeof CARD_BACKS)[number];

/** Mặt sau của một ván, suy từ seed nên mọi người trong phòng thấy giống nhau.
 *  Băm seed thay vì lấy `seed % 3` để không hé ra quan hệ trực tiếp với seed. */
export function backForSeed(seed: number): CardBack {
  const h = Math.imul(seed >>> 0, 2654435761) >>> 0;
  return CARD_BACKS[h % CARD_BACKS.length]!;
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
  /**
   * Giây còn lại của giai đoạn HÉ MỞ CẢ BÀN; null = không đang hé mở.
   *
   * Không có nó thì phòng online chơi Chớp nhoáng phải TỰ ĐOÁN còn bao lâu —
   * đúng cái chế độ mà từng giây đều đáng giá. Dùng cho cả thẻ Mắt thần (hé cả
   * bàn 5 giây), vì cùng một `revealUntil`.
   */
  peekLeft: number | null;
  /** Giây đã trôi của ván — client tự đếm tiếp giữa hai lần cập nhật. */
  elapsed: number;
  summary: Summary | null;
  /** Mặt sau lá bài của ván này — server quyết để cả phòng thấy giống nhau. */
  back: CardBack;
}

/**
 * View ở DẠNG GỬI TRÊN DÂY — bỏ mảng `cards`, chỉ mang những ô KHÔNG phải
 * "úp trơn".
 *
 * Vì sao đáng làm: bàn lớn nhất 88 thẻ thì gần hết một cái view là 88 lần lặp
 * `{"index":n,"state":"down"}` — 27 byte mỗi ô, không mang tin gì mà client
 * chưa biết. Đo thật: view của bàn 88 thẻ là 2.998 byte, trong khi thông tin
 * thực sự mới ("người A vừa lật ô 17") chỉ khoảng 20 byte. Mà cái view ấy đi
 * lại sau MỖI nước lật, kèm cả `predeal` nữa.
 *
 * Ô úp trơn suy ra được từ `n` nên không cần gửi: cái gì không có trong `o` thì
 * là ô úp. Ô trống (`blank`) và ô đang ngửa/đã ghép thì có mặt đầy đủ.
 */
export interface WireView extends Omit<GameView, 'cards'> {
  /** Tổng số ô của bàn. */
  n: number;
  /** Chỉ những ô không phải "úp trơn" — ngửa, đã ghép, hoặc ô trống. */
  o: PublicCard[];
}

/** Gói view lại để gửi. Xem `WireView`. */
export function packView(v: GameView): WireView {
  const { cards, ...con } = v;
  return {
    ...con,
    n: cards.length,
    o: cards.filter((c) => c.state !== 'down' || c.blank)
  };
}

/**
 * Mở gói view nhận được.
 *
 * CHẤP NHẬN CẢ HAI DẠNG một cách có chủ đích: đã có `cards` thì trả nguyên si.
 * Nhờ vậy đổi cách gói không bắt mọi thứ đọc view (client, bộ smoke, công cụ
 * soi) phải đổi cùng một lúc, và server cũ với client mới vẫn nói chuyện được.
 */
export function unpackView(v: GameView | WireView): GameView {
  if ('cards' in v) return v;
  const { n, o, ...con } = v;
  const tra = new Map(o.map((c) => [c.index, c]));
  const cards: PublicCard[] = Array.from({ length: n }, (_, i) =>
    tra.get(i) ?? { index: i, state: 'down' as const });
  return { ...con, cards };
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
    peekLeft: game.revealUntil > 0 ? Math.max(0, (game.revealUntil - now) / 1000) : null,
    elapsed: Math.floor(game.elapsed(now)),
    summary: game.summary(),
    back: backForSeed(game.config.seed)
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
  /**
   * Lật một ô. `seq` là SỐ THỨ TỰ TĂNG DẦN của riêng người gửi.
   *
   * Không có nó thì một nước đi rơi giữa đường là mất luôn: client KHÔNG DÁM
   * gửi lại, vì server không phân biệt được "gửi lại nước cũ" với "lật thêm
   * một thẻ nữa" — hai thứ đó trên dây y hệt nhau. Đó là lý do thật của cảm
   * giác "bấm mà không ăn" trên mạng yếu, và là lỗi kiến trúc chứ không phải
   * lỗi đường truyền: một game đi lần lượt đáng lẽ chỉ cần gửi lại tới khi
   * nhận được là xong.
   *
   * Có `seq`, server nhớ số cuối đã xử của từng người và BỎ QUA tin trùng
   * (vẫn trả về view để client thôi chờ). Nhờ vậy client gửi lại thoải mái.
   * Thiếu `seq` (client cũ) thì server xử như trước, không ai vỡ.
   */
  | { t: 'flip'; index: number; seq?: number }
  /**
   * Xin lại trạng thái hiện tại trên CHÍNH socket đang mở.
   *
   * Trước đây mọi sự cố nhỏ — rơi một tin, bàn có vẻ đứng — đều được "chữa"
   * bằng cách mở lại socket. Mà bắt tay TCP+TLS+WS chính là thứ dễ hỏng nhất
   * trên mạng yếu, nên cách chữa lại làm hỏng thêm đúng lúc đang yếu nhất.
   * Một tin vài chục byte trên đường đã thông thì rẻ hơn nhiều lần.
   */
  | { t: 'resync' }
  | { t: 'again' }                                  // chủ phòng mở ván mới sau khi kết thúc
  | { t: 'tolobby' }                                // về phòng chờ (một người bấm là đủ)
  | { t: 'public'; on: boolean }                    // chủ phòng bật/tắt hiện trong danh sách
  | { t: 'ready'; ready: boolean }                  // sẵn sàng ở lobby
  | { t: 'leave' }                                  // đầu hàng (đang chơi) / rời phòng (lobby)
  | { t: 'cancel' }                                 // chủ phòng huỷ phòng
  | { t: 'emoji'; emoji: string }
  /**
   * Đổi tên. AI CŨNG đổi được, và đổi được cả trong ván.
   *
   * Tên là thứ duy nhất người khác nhận ra mình, mà nó được nhớ từ lần chơi
   * trước — nên phải sửa được tại chỗ, không bắt thoát phòng ra rồi vào lại.
   */
  | { t: 'rename'; name: string }
  /**
   * Chủ phòng mời một người ra khỏi phòng.
   *
   * Dùng khi ai đó vào nhầm, hoặc khi một người rớt mạng và cả phòng phải chờ
   * hết hạn giữ chỗ mới đi tiếp được.
   */
  | { t: 'kick'; playerId: string }
  | { t: 'ping' }
  /**
   * Báo còn sống. KHÁC `ping`: `ping` do server tự trả lời (setWebSocketAutoResponse)
   * nên KHÔNG đánh thức Durable Object — nghĩa là DO không biết ai còn kết nối.
   * Mất mạng kiểu cắt TCP không sinh sự kiện close, nên nếu chỉ dựa vào close thì
   * server tưởng người đó vẫn đang chơi: đối thủ ngồi nhìn bàn im mà không được
   * báo gì, và hạn 30 giây xử thua cũng không bao giờ chạy. Tin này đi thẳng vào
   * DO để nó ghi mốc "lần cuối thấy còn sống".
   */
  | { t: 'alive' };

export interface RoomInfo {
  code: string;
  hostId: string;
  config: RoomConfig;
  players: PublicPlayer[];
  status: 'lobby' | 'countdown' | 'playing' | 'ended';
  /** Id những người đã bấm "chơi lại" sau khi ván kết thúc. Cần gửi cho client
   *  vì trước đây bấm xong không ai biết ai đã bấm — kể cả chính mình. */
  againVotes?: string[];
  /** Có hiện trong danh sách phòng công khai không (ON-10). Chủ phòng bật/tắt
   *  được ngay ở phòng chờ, nên client phải thấy trạng thái hiện tại. */
  congKhai: boolean;
}

/**
 * MỘT DÒNG trong danh sách phòng công khai (ON-10).
 *
 * Cố tình MỎNG: chỉ đủ để người chơi quyết định có vào hay không. Không mang
 * danh sách người chơi, không mang cấu hình đầy đủ — danh sách này ai cũng đọc
 * được mà không cần vào phòng, nên càng ít thứ rò ra càng tốt, và mỗi byte đều
 * nhân với số phòng đang mở.
 *
 * `chuPhong` là TÊN CHỦ PHÒNG: phòng không có tên riêng, người chơi nhận ra nó
 * qua "Phòng của Kiên". Không bắt gõ thêm một cái tên nữa.
 */
export interface PublicRoom {
  code: string;
  chuPhong: string;
  avatar: string;
  /** Số người đang ở trong phòng, và trần của phòng. */
  nguoi: number;
  toiDa: number;
  /** Số THẺ (không phải số cặp) — người chơi đọc bằng số thẻ ở mọi màn khác. */
  the: number;
  /** Mốc tạo phòng, để client sắp phòng mới lên trước. */
  luc: number;
}

/**
 * Toàn bộ nội dung bàn, để client lật thẻ hiện ngay không phải chờ vòng đi-về.
 * Bật/tắt bằng `PREDEAL` ở `apps/server/src/flags.ts`.
 *
 * Vì sao là thông điệp RIÊNG chứ không thêm field vào `GameView`: trộn vào view
 * là mọi chỗ đang vẽ từ view đều có thể vô tình vẽ ra thẻ úp. Tách ra thì
 * `view.cards[].symbol` của thẻ úp vẫn rỗng đúng như trước, và client phải cố ý
 * đi lấy chỗ khác mới có — không lấy được do nhầm.
 *
 * Gửi kèm MỖI lần gửi view, không phải chỉ lúc bắt đầu ván: xáo thẻ và thẻ đặc
 * biệt Tráo đổi đều đổi chỗ thẻ giữa ván, nên bản đồ theo index sẽ lệch. Gửi lại
 * cả bàn thì không bao giờ lệch — bàn to nhất cũng chỉ vài trăm byte, rẻ hơn
 * nhiều so với một lớp logic đồng bộ hoá sai lúc nào không biết.
 */
export interface PredealMsg {
  t: 'predeal';
  /** index thẻ → symbol. Thẻ trống (`blank`) không có mặt. */
  symbols: Record<number, string>;
}

/** Dựng bản đồ index → symbol cho cả bàn. */
export function predealSymbols(game: MemoryGame): Record<number, string> {
  const out: Record<number, string> = {};
  for (const c of game.cards) if (!c.blank) out[c.index] = c.symbol;
  return out;
}

/** Server → client. */
export type ServerMsg =
  | PredealMsg
  /**
   * `flipSeq` = số thứ tự nước lật cuối server đã xử của người này.
   *
   * Client nhảy bộ đếm của mình lên trên con số đó. Không có nó thì một người
   * tải lại trang giữa ván sẽ bắt đầu đếm lại từ đầu, và mọi nước đi của họ bị
   * chốt chống trùng nuốt sạch — im lặng, không lỗi, không cách nào đoán ra.
   */
  | { t: 'welcome'; playerId: string; token: string; room: RoomInfo; spectator?: boolean; flipSeq?: number }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: GameView | WireView }
  | { t: 'countdown'; endsInMs: number; firstId: string; firstName: string }
  | { t: 'events'; events: PublicEvent[]; view: GameView | WireView }
  | { t: 'emoji'; from: string; emoji: QuickEmoji }
  | { t: 'closed'; message: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong' };
