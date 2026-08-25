import { DurableObject } from 'cloudflare:workers';
import {
  CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, MemoryGame, QUICK_EMOJIS, ROOM_LIMITS, ROOM_MODES,
  presetConfig, publicEvents, publicPlayer, publicView, seedFrom
} from '@mm/engine';
import type {
  ClientMsg, GameEvent, QuickEmoji, RoomConfig, RoomInfo, RoomMode, ServerMsg
} from '@mm/engine';
import { THEME_SYMBOLS } from './themes.js';

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
}

interface RoomPlayer {
  id: string;
  name: string;
  avatar?: string;
  /** Bí mật để vào lại sau khi rớt mạng (ON-07). */
  token: string;
  /** Hạn chót vào lại; null = đang kết nối. */
  disconnectedAt: number | null;
  /** Lần cuối server NHẬN được tin từ người này. Dùng để phát hiện mất mạng im
   *  lặng (cắt TCP không sinh close). */
  lastSeen?: number;
  /** Đã bấm sẵn sàng ở lobby. */
  ready: boolean;
}

interface RoomState {
  code: string;
  hostId: string;
  config: RoomConfig;
  players: RoomPlayer[];
  status: 'lobby' | 'countdown' | 'playing' | 'ended';
  /** Thời điểm hết đếm ngược 5 giây, khi status = 'countdown'. */
  countdownEnd?: number;
  /** Lúc phòng ở lobby mà KHÔNG còn ai. Xem EMPTY_LOBBY_MS. */
  emptyAt?: number;
}

/** Socket nào thuộc người chơi nào — sống sót qua hibernation nhờ attachment. */
interface Attachment { playerId: string }

const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

/**
 * Một phòng chơi = một Durable Object (ON-01…ON-09).
 *
 * Server-authoritative: engine chạy TẠI ĐÂY, client chỉ gửi {t:'flip', index}.
 * WebSocket Hibernation giữ phòng rẻ khi không ai thao tác; trạng thái phòng
 * và snapshot engine nằm trong storage nên DO bị evict vẫn khôi phục được.
 */
/**
 * Không nhận được tin nào từ một người trong bấy nhiêu ms thì coi là mất kết nối.
 *
 * Client gửi `alive` mỗi 4 giây, nên 20 giây là tha được BỐN nhịp trượt. Mức cũ
 * 9 giây (hai nhịp) cắt oan quá nhiều: chuyển sang app khác một nhịp là trình
 * duyệt bóp `setInterval` của tab nền xuống còn 1 lần/phút, 4G nấc nhẹ một nhịp
 * rưỡi cũng đủ vượt ngưỡng — người chơi bị báo "rớt mạng" trong khi mạng không
 * có vấn đề gì.
 *
 * TRẦN LÀ 25 GIÂY, không tuỳ ý: lúc phát hiện, `disconnectedAt` được LÙI về
 * `lastSeen` chứ không phải `now`, nên hạn xử thua vẫn là 30 giây kể từ lần cuối
 * thấy họ (ROOM_LIMITS.reconnectMs). Đặt bằng hoặc quá 30 giây là vừa phát hiện
 * đã xử thua luôn, mất sạch cửa vào lại.
 *
 * Không còn cần ngắn hơn đồng hồ lượt (15 giây): hết lượt thì engine tự
 * `turn-timeout` chuyển lượt, bàn KHÔNG treo — muộn ở đây chỉ là cái nhãn "mất
 * kết nối" hiện chậm, không phải ván đứng im.
 *
 * Nới ngưỡng còn RẺ hơn: alarm hẹn tại `lastSeen + SILENT_MS`, nên mỗi người
 * chơi từ ~380 lần đánh thức DO mỗi giờ xuống còn ~170.
 */
const SILENT_MS = 20_000;

/**
 * Ngoài ván (lobby / đã kết thúc), im bấy nhiêu ms thì bị gỡ khỏi phòng.
 *
 * Vì sao KHÔNG dùng luôn SILENT_MS 20 giây: ở lobby người ta ngồi chờ nhau,
 * chuyện thường là mở app khác đi mời bạn — trình duyệt bóp `setInterval` của
 * tab nền xuống còn 1 lần/phút, nên 20 giây là đá họ ra khỏi phòng của chính
 * mình. Ngoài ván không có gì gấp: 2 phút chỉ để dọn phòng CHẾT.
 *
 * Vì sao cần: cắt mạng kiểu không sinh sự kiện `close` (rút Wi-Fi, iOS treo kết
 * nối) thì `webSocketClose` không bao giờ chạy. Trước đây watchdog chỉ soi khi
 * status = 'playing' và `scheduleNext()` không hẹn alarm nào ở lobby, nên phòng
 * đó SỐNG VĨNH VIỄN: giữ mã phòng, đếm là một người "đang chờ".
 */
const IDLE_SILENT_MS = 120_000;

/**
 * Phòng đã lập (POST /api/rooms) mà không ai vào trong bấy nhiêu ms thì xoá.
 *
 * `open()` ghi cờ `created` để mã sai không lặng lẽ thành phòng mới. Cờ đó
 * không tự mất, nên bấm "Tạo phòng" rồi đóng tab để lại một mẩu rác vĩnh viễn.
 */
const UNUSED_ROOM_MS = 600_000;

/**
 * Lobby không còn ai thì phòng còn sống thêm bấy nhiêu ms trước khi bị xoá.
 *
 * Vì sao KHÔNG xoá ngay: luồng chia link là "tạo phòng → thoát ra → gửi link
 * cho bạn → quay lại". Xoá ngay lúc người cuối rời lobby thì cái link vừa gửi
 * đã chết trước khi bạn kịp bấm, và người nhận thấy "Phòng không tồn tại" —
 * chính người tạo phòng cũng không vào lại được phòng của mình.
 *
 * 10 phút, không phải 5: gần như ai cũng chơi trên ĐIỆN THOẠI, mà ở đó "gửi
 * link" là rời app sang Zalo/Messenger, gõ vài câu, chờ bạn tải trang. iOS còn
 * treo hẳn kết nối của tab nền nên người tạo phòng thường bị tính là đã đi.
 * Giữ một phòng rỗng chỉ tốn một mẩu storage và MỘT alarm, nên thà rộng tay.
 */
const EMPTY_LOBBY_MS = 600_000;

export class RoomDO extends DurableObject<Env> {
  private room: RoomState | null = null;
  private game: MemoryGame | null = null;
  /** Mốc thời gian các emoji gần nhất của từng người, để chặn spam.
   *  Chỉ trong RAM: mất khi DO ngủ cũng không sao — spam là hành vi liên tục,
   *  còn người ngủ dậy gửi lại một cái thì đáng được cho qua. */
  private emojiLog = new Map<string, number[]>();
  /**
   * Trả lời ping ngay ở tầng runtime, KHÔNG đánh thức Durable Object.
   *
   * Vì sao quan trọng về tiền: DO tính phí theo thời gian nó thức. Nếu mỗi ping
   * đều gọi vào code thì hai người chơi ping 4 giây một lần là DO thức suốt ván
   * — tài liệu Cloudflare nói rõ tin auto-response "will not incur additional
   * wall-clock time, and so they will not be charged". Tin vào vẫn tính vào số
   * request nhưng theo tỷ lệ 20:1, tức 100 tin = 5 request.
   */
  private armPingAutoResponse(): void {
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(JSON.stringify({ t: 'ping' }), JSON.stringify({ t: 'pong' }))
    );
  }

  /** Ai đã bấm "chơi lại" sau ván này. Chỉ trong RAM: DO ngủ giữa lúc chờ thì
   *  coi như mọi người bấm lại — thà hỏi lại còn hơn mở ván mà một bên chưa muốn. */
  private againVotes = new Set<string>();

  /* ---------- nạp / lưu ---------- */

  private async load(): Promise<void> {
    if (this.room) return;
    this.room = (await this.ctx.storage.get<RoomState>('room')) ?? null;
    const snap = await this.ctx.storage.get<string>('game');
    if (snap) this.game = MemoryGame.restore(snap);
  }

  private async save(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
    if (this.game) await this.ctx.storage.put('game', this.game.snapshot());
  }

  /* ---------- kết nối ---------- */

  /**
   * Đánh dấu phòng này ĐÃ ĐƯỢC MỞ. Gọi từ POST /api/rooms.
   *
   * Vì sao cần: Durable Object sinh ra theo tên, nên `getByName(code)` với mã
   * nào cũng tạo ra một phòng. Không có dấu này thì gõ sai một số là lặng lẽ
   * lập phòng mới và ngồi chờ mãi — người chơi tưởng bạn mình chưa vào.
   */
  async open(): Promise<void> {
    await this.ctx.storage.put('created', true);
    await this.ctx.storage.put('openedAt', Date.now());
    // Không ai vào thì alarm này là thứ duy nhất dọn được mẩu rác đó
    await this.ctx.storage.setAlarm(Date.now() + UNUSED_ROOM_MS);
  }

  /** Phòng có thật hay không — dùng cho GET /api/rooms/:code. */
  async exists(): Promise<boolean> {
    if (await this.ctx.storage.get<boolean>('created')) return true;
    // Phòng lập TRƯỚC khi có dấu `created` (bản cũ) vẫn phải chạy được
    return (await this.ctx.storage.get('room')) != null;
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket only', { status: 426 });
    }
    await this.load();

    const url = new URL(request.url);
    const code = url.searchParams.get('code') ?? '';
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 16);
    const token = url.searchParams.get('token') ?? '';

    // Mã không ứng với phòng nào: từ chối thay vì lặng lẽ lập phòng mới.
    // Client đã kiểm trước qua GET /api/rooms/:code, nhưng client không đáng
    // tin (ON-09) nên chặn cả ở đây.
    if (!this.room) {
      if (!(await this.exists())) {
        return new Response('Phòng không tồn tại', { status: 404 });
      }
      this.room = {
        code, hostId: '', config: { ...DEFAULT_ROOM_CONFIG }, players: [], status: 'lobby'
      };
    }

    // Vào lại bằng token (ON-07) hay người chơi mới?
    let player = token ? this.room.players.find((p) => p.token === token) : undefined;
    if (!player) {
      if (!name) return new Response('Thiếu tên', { status: 400 });
      // Ván đã bắt đầu / phòng đầy: vào làm KHÁN GIẢ — chỉ xem, không thao tác
      if (this.room.status !== 'lobby' || this.room.players.length >= ROOM_LIMITS.maxPlayers) {
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
      delete this.room.emptyAt;   // phòng có người trở lại, không còn hẹn xoá
    } else {
      player.disconnectedAt = null;
      if (name) player.name = name;
    }

    // Đóng socket cũ của cùng người chơi (mở tab mới / reconnect nhanh)
    for (const ws of this.ctx.getWebSockets(player.id)) ws.close(4000, 'replaced');

    const pair = new WebSocketPair();
    this.armPingAutoResponse();
    this.ctx.acceptWebSocket(pair[1], [player.id]);
    pair[1].serializeAttachment({ playerId: player.id } satisfies Attachment);

    await this.save();
    this.send(pair[1], {
      t: 'welcome', playerId: player.id, token: player.token, room: this.roomInfo()
    });
    this.broadcast({ t: 'room', room: this.roomInfo() }, player.id);
    if (this.game) this.send(pair[1], { t: 'state', view: this.view() });
    await this.scheduleNext();

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /**
   * Gỡ một người khỏi phòng (đầu hàng / bị xử thua vì rớt mạng quá hạn).
   * Chủ phòng rời thì chuyển quyền cho người kế tiếp — nếu không thì
   * không ai còn bấm được "Chơi lại" hay huỷ phòng.
   */
  private removePlayer(id: string): void {
    if (!this.room) return;
    this.room.players = this.room.players.filter((p) => p.id !== id);
    if (this.room.hostId === id) this.room.hostId = this.room.players[0]?.id ?? '';
  }

  /** Khán giả: nhận mọi broadcast nhưng không có mặt trong danh sách người chơi. */
  private acceptSpectator(): Response {
    const pair = new WebSocketPair();
    this.armPingAutoResponse();
    this.ctx.acceptWebSocket(pair[1], ['spectator']);
    pair[1].serializeAttachment({ playerId: '' } satisfies Attachment);
    this.send(pair[1], {
      t: 'welcome', playerId: '', token: '', spectator: true, room: this.roomInfo()
    });
    if (this.game) this.send(pair[1], { t: 'state', view: this.view() });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;   // khán giả (playerId rỗng) không được gửi hành động

    // Mọi tin nhắn đều là bằng chứng "còn sống" — ghi mốc trước khi xử lý.
    player.lastSeen = Date.now();
    if (player.disconnectedAt !== null) player.disconnectedAt = null;

    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMsg;
    } catch { return; }

    switch (msg.t) {
      case 'ping':
        this.send(ws, { t: 'pong' });
        return;

      case 'config': {
        // ON-03: chỉ chủ phòng chỉnh cấu hình, và chỉ khi còn ở lobby
        if (player.id !== this.room.hostId || this.room.status !== 'lobby') return;
        const c = msg.config;
        // Số màn từ client: phải là số nguyên trong khoảng, không thì presetConfig
        // ném lỗi ngay lúc bắt đầu ván và cả phòng bị treo (ON-09)
        if (Number.isInteger(c.level) && c.level! >= 1 && c.level! <= CAMPAIGN_LEVELS) {
          this.room.config.level = c.level!;
        }
        // Mọi chế độ trừ Chiến dịch — chiến dịch là chuỗi cấp của riêng một
        // người. Chỉ sửa ở client thì server âm thầm bỏ qua cấu hình và phòng
        // vẫn chạy chế độ cũ.
        if (ROOM_MODES.includes(c.mode as RoomMode)) this.room.config.mode = c.mode as RoomMode;
        if (Array.isArray(c.themeIds)) {
          const valid = [...new Set(c.themeIds)]
            .filter((id): id is string => typeof id === 'string' && Object.hasOwn(THEME_SYMBOLS, id));
          if (valid.length) this.room.config.themeIds = valid;
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        return;
      }

      case 'ready': {
        if (this.room.status !== 'lobby') return;
        player.ready = !!msg.ready;
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        return;
      }

      case 'again': {
        if (this.room.status !== 'ended') return;
        // MỌI người bấm được, không riêng chủ phòng. Trước đây server lặng lẽ
        // bỏ qua lượt bấm của khách: họ bấm mà không thấy gì xảy ra, còn chủ
        // phòng thì không biết đối phương có muốn chơi nữa hay không.
        this.againVotes.add(player.id);
        const here = this.room.players.filter((p) => this.connected(p.id));
        const allWant = here.length >= ROOM_LIMITS.minPlayers
          && here.every((p) => this.againVotes.has(p.id));
        if (!allWant) {
          // Chưa đủ: phát cho cả phòng biết ai đã bấm
          await this.save();
          this.broadcast({ t: 'room', room: this.roomInfo() });
          return;
        }
        this.againVotes.clear();
        // Đủ phiếu: về phòng chờ để mọi người bấm sẵn sàng lần nữa
        this.room.players = here;
        if (!this.room.players.some((p) => p.id === this.room!.hostId)) {
          this.room.hostId = this.room.players[0]?.id ?? '';
        }
        this.room.status = 'lobby';
        this.game = null;
        await this.ctx.storage.delete('game');
        for (const p of this.room.players) p.ready = false;
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        return;
      }

      case 'start': {
        if (player.id !== this.room.hostId) return;
        if (this.room.status !== 'lobby') return;
        this.againVotes.clear();
        // Chỉ những người còn kết nối mới vào ván mới — không chờ người đã đi hẳn
        this.room.players = this.room.players.filter(
          (p) => this.connected(p.id) || p.disconnectedAt !== null
        );
        if (this.room.hostId && !this.room.players.some((p) => p.id === this.room!.hostId)) {
          this.room.hostId = this.room.players[0]?.id ?? '';
        }
        if (this.room.players.length < ROOM_LIMITS.minPlayers) {
          this.send(ws, { t: 'error', code: 'not-enough', message: 'Cần ít nhất 2 người chơi đang kết nối' });
          return;
        }
        // Chủ phòng mặc nhiên sẵn sàng; những người khác phải bấm đủ
        const notReady = this.room.players.filter((p) => p.id !== this.room!.hostId && !p.ready);
        if (notReady.length) {
          this.send(ws, {
            t: 'error', code: 'not-ready',
            message: `Chưa sẵn sàng: ${notReady.map((p) => p.name).join(', ')}`
          });
          return;
        }
        // Dựng ván (thứ tự đi đã bốc ngẫu nhiên) nhưng CHƯA chạy — đếm ngược
        // (ROOM_LIMITS.countdownMs) để người đi đầu không bị động
        this.prepareGame();
        this.room.status = 'countdown';
        this.room.countdownEnd = Date.now() + ROOM_LIMITS.countdownMs;
        await this.save();
        const first = this.game!.current;
        this.broadcast({ t: 'room', room: this.roomInfo() });
        this.broadcast({ t: 'state', view: this.view() });
        this.broadcast({
          // PHẢI suy từ countdownEnd, đừng viết số: viết cứng 5000 trong khi hạn
          // thật là 3 giây làm client hiện "5" rồi nhảy thẳng xuống "3" — đúng
          // lỗi đã bị phản ánh, và không test nào bắt được vì hai chỗ đọc hai số.
          t: 'countdown',
          endsInMs: this.room.countdownEnd - Date.now(),
          firstId: first.id, firstName: first.name
        });
        await this.ctx.storage.setAlarm(this.room.countdownEnd);
        return;
      }

      case 'flip': {
        if (!this.game || this.room.status !== 'playing') return;
        // TỰ CHỮA chuỗi alarm: bất kể nước này có hợp lệ hay không, hẹn lại giờ.
        // Nếu vì lý do nào đó alarm bị mất (DO ngủ đông, alarm bị ghi đè, một
        // nhánh nào đó xoá alarm khi chưa nạp đủ trạng thái) thì bàn đứng im
        // VĨNH VIỄN: hai thẻ mở, đồng hồ lượt 0, không ai làm gì được — đúng lỗi
        // đã gặp trên production mà tôi chưa tái hiện được ở local. Hẹn lại ở đây
        // rất rẻ và biến "treo vĩnh viễn" thành "chậm một nước".
        await this.scheduleNext();
        // ON-09: server phán quyết — sai lượt thì bỏ qua, không tin client.
        // typeof check trước: Number(null) = 0 sẽ thành lật thẻ 0 thật!
        if (typeof msg.index !== 'number') return;
        if (this.game.current.id !== player.id) return;
        const events = this.game.flip(msg.index, Date.now());
        if (!events.length) return;
        await this.afterEvents(events);
        return;
      }

      case 'leave': {
        // Đầu hàng giữa ván: xử thua ngay, không chờ hạn 30 giây
        if (this.room.status === 'playing' && this.game && !this.game.finished) {
          player.disconnectedAt = null;
          const events = this.game.forfeit(player.id, Date.now());
          await this.afterEvents(events);
        }
        this.removePlayer(player.id);   // ván sau không còn chờ người đã đi
        for (const sock of this.ctx.getWebSockets(player.id)) sock.close(4001, 'left');
        if (!this.room.players.length) {
          // Ở lobby thì giữ mã phòng thêm EMPTY_LOBBY_MS cho cái link đã gửi;
          // ván đã chạy rồi thì không còn gì để quay lại, xoá luôn.
          if (this.room.status === 'lobby') {
            this.room.emptyAt = Date.now();
            this.room.hostId = '';
            await this.save();
            await this.scheduleNext();
            return;
          }
          await this.ctx.storage.deleteAll();
          this.room = null;
          this.game = null;
          return;
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        await this.scheduleNext();
        return;
      }

      case 'cancel': {
        // Huỷ phòng: chỉ chủ phòng; mọi người bị đưa ra ngoài
        if (player.id !== this.room.hostId) return;
        this.broadcast({ t: 'closed', message: 'Chủ phòng đã huỷ phòng.' });
        for (const sock of this.ctx.getWebSockets()) sock.close(4002, 'room-cancelled');
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.room = null;
        this.game = null;
        return;
      }

      case 'alive':
        // Chỉ ghi mốc; mốc đã được cập nhật ở đầu hàm cho MỌI tin nhắn.
        return;

      case 'emoji': {
        if (!(QUICK_EMOJIS as readonly string[]).includes(msg.emoji)) return;   // ON-08: danh sách đóng
        if (!this.allowEmoji(player.id)) return;   // vượt hạn mức thì nuốt êm
        this.broadcast({ t: 'emoji', from: player.id, emoji: msg.emoji as QuickEmoji });
        return;
      }
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.load();
    if (!this.room) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    const player = this.room.players.find((p) => p.id === att?.playerId);
    if (!player) return;
    // Socket khác của cùng người còn sống thì không tính là rớt mạng
    if (this.ctx.getWebSockets(player.id).some((s) => s !== ws)) return;

    if (this.room.status === 'lobby') {
      // Ở lobby thì rời phòng luôn
      this.room.players = this.room.players.filter((p) => p.id !== player.id);
      if (this.room.hostId === player.id) this.room.hostId = this.room.players[0]?.id ?? '';
      if (!this.room.players.length) {
        // KHÔNG xoá ngay: mã phòng phải còn sống để cái link vừa gửi đi dùng
        // được (xem EMPTY_LOBBY_MS). Alarm sẽ dọn nếu hết giờ vẫn không ai vào.
        this.room.emptyAt = Date.now();
        this.room.hostId = '';
        await this.save();
        await this.scheduleNext();
        return;
      }
    } else {
      player.disconnectedAt = Date.now();   // ON-07: 30 giây để vào lại
    }
    // Ván đã kết thúc và không còn socket nào: dọn phòng để mã dùng lại được
    if (this.room.status === 'ended' && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      this.room = null;
      this.game = null;
      return;
    }
    await this.save();
    this.broadcast({ t: 'room', room: this.roomInfo() });
    await this.scheduleNext();
  }

  /* ---------- đồng hồ của phòng ---------- */

  override async alarm(): Promise<void> {
    await this.load();
    const now = Date.now();

    // Phòng lập mà không ai vào: chưa từng có `room` thì đây là mẩu rác, xoá luôn
    if (!this.room) {
      const openedAt = (await this.ctx.storage.get<number>('openedAt')) ?? 0;
      if (openedAt && now - openedAt >= UNUSED_ROOM_MS) {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
      }
      return;
    }

    // Hết đếm ngược 5 giây → ván thực sự bắt đầu, đồng hồ lượt chạy
    if (this.room.status === 'countdown' && this.game && now >= (this.room.countdownEnd ?? 0)) {
      this.game.start(now);
      this.room.status = 'playing';
      delete this.room.countdownEnd;
      await this.save();
      this.broadcast({ t: 'room', room: this.roomInfo() });
      this.broadcast({ t: 'state', view: this.view() });
    }

    /*
     * MẤT MẠNG IM LẶNG NGOÀI VÁN (lobby / đã kết thúc): không có khối này thì
     * phòng có người "mất mạng im lặng" sống vĩnh viễn — xem IDLE_SILENT_MS.
     * Ngưỡng dài hơn hẳn trong ván vì ngoài ván không có gì gấp, mà đá oan một
     * người đang ngồi chờ ở phòng của chính họ thì tệ hơn là để phòng rác thêm
     * một phút.
     */
    // Lobby rỗng quá hạn: cái link đã hết cửa dùng, giờ mới xoá thật
    if (this.room.emptyAt && now - this.room.emptyAt >= EMPTY_LOBBY_MS) {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      this.room = null;
      this.game = null;
      return;
    }

    if (this.room.status === 'lobby' || this.room.status === 'ended') {
      const truoc = this.room.players.length;
      // `lastSeen` chưa có (vừa vào, chưa gửi tin nào) thì GIỮ: chưa có bằng
      // chứng gì để đá người ta ra.
      this.room.players = this.room.players.filter(
        (p) => !p.lastSeen || now - p.lastSeen <= IDLE_SILENT_MS
      );
      if (this.room.players.length !== truoc) {
        if (!this.room.players.length) {
          if (this.room.status === 'lobby') {
            this.room.emptyAt = now;   // vẫn cho link sống thêm EMPTY_LOBBY_MS
            this.room.hostId = '';
            await this.save();
            await this.scheduleNext();
            return;
          }
          await this.ctx.storage.deleteAll();
          await this.ctx.storage.deleteAlarm();
          this.room = null;
          this.game = null;
          return;
        }
        // Chủ phòng im tiếng thì phải chuyển quyền, không thì không ai bấm được gì
        if (!this.room.players.some((p) => p.id === this.room!.hostId)) {
          this.room.hostId = this.room.players[0]!.id;
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
      }
    }

    /*
     * MẤT MẠNG IM LẶNG: cắt TCP không sinh sự kiện close, nên chỉ dựa vào close
     * là server tưởng người đó vẫn đang chơi — đối thủ ngồi nhìn bàn im không
     * hiểu gì, và hạn 30 giây xử thua không bao giờ chạy. Đã đo được đúng cảnh
     * này bằng hai trình duyệt và cắt mạng một bên.
     *
     * Client gửi `alive` mỗi 4 giây, nên quá SILENT_MS không thấy tin nào là
     * coi như mất kết nối. Mốc tính từ lần cuối thấy họ, không phải từ bây giờ.
     */
    if (this.room.status === 'playing') {
      let doi = false;
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null) continue;
        const seen = p.lastSeen ?? 0;
        if (seen && now - seen > SILENT_MS) { p.disconnectedAt = seen; doi = true; }
      }
      if (doi) {
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        this.broadcast({ t: 'state', view: this.view() });
      }
    }

    // Xử thua người rớt mạng quá hạn (ON-07)
    if (this.game && this.room.status === 'playing') {
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null && now - p.disconnectedAt >= ROOM_LIMITS.reconnectMs) {
          p.disconnectedAt = null;
          const events = this.game.forfeit(p.id, now);
          this.removePlayer(p.id);
          await this.afterEvents(events, false);
          this.broadcast({ t: 'room', room: this.roomInfo() });
        }
      }
      // Úp lại thẻ sai / hết giờ
      const events = this.game.tick(now);
      if (events.length) await this.afterEvents(events, false);
    }

    await this.save();
    await this.scheduleNext();
  }

  /** Một alarm duy nhất = mốc gần nhất trong: úp thẻ, hạn vào lại, hết giờ. */
  private async scheduleNext(): Promise<void> {
    const marks: number[] = [];
    const now = Date.now();
    if (this.room?.status === 'countdown' && this.room.countdownEnd) marks.push(this.room.countdownEnd);
    if (this.room?.status === 'playing' && this.game && !this.game.finished) {
      if (this.game.locked) marks.push(now + (this.game.config.flipBackMs ?? 1000));
      /*
       * HẾT HÉ MỞ CẢ BÀN (Chớp nhoáng, và thẻ Mắt thần ở mọi chế độ).
       *
       * Thiếu mốc này là bàn nằm mở tới khi một alarm KHÁC tình cờ nổ: lúc hé
       * mở, `flip()` bị chặn (status = 'peeking') nên không nước đi nào làm
       * engine nhích, và không có gì khác đánh thức DO. Đo được trên wrangler:
       * bàn 6 thẻ đáng hé 3,6 giây thì nằm mở 15,5 giây — hơn bốn lần.
       */
      if (this.game.revealUntil > 0) marks.push(this.game.revealUntil + 50);
      // Đồng hồ 30 giây mỗi lượt: hết hạn thì alarm đánh thức để chuyển lượt
      if (this.game.turnDeadline) marks.push(this.game.turnDeadline + 50);
      const left = this.game.timeLeft(now);
      if (left !== null) marks.push(now + left * 1000 + 50);
      for (const p of this.room.players) {
        if (p.disconnectedAt !== null) marks.push(p.disconnectedAt + ROOM_LIMITS.reconnectMs);
        // Cả mốc phát hiện mất mạng im lặng: không có nó thì alarm không bao giờ
        // thức đúng lúc để nhận ra người kia đã đi.
        else if (p.lastSeen) marks.push(p.lastSeen + SILENT_MS + 500);
      }
    }
    // Ngoài ván cũng phải có alarm: đây là thứ duy nhất phát hiện được người
    // "mất mạng im lặng" ở lobby. Trước đây chỗ này rơi vào nhánh deleteAlarm()
    // nên phòng chết không ai dọn.
    if (this.room?.status === 'lobby' || this.room?.status === 'ended') {
      for (const p of this.room.players) {
        if (p.lastSeen) marks.push(p.lastSeen + IDLE_SILENT_MS + 500);
      }
      // Phòng rỗng: không có mốc này thì nó không bao giờ bị dọn
      if (this.room.emptyAt) marks.push(this.room.emptyAt + EMPTY_LOBBY_MS + 500);
    }
    if (marks.length) await this.ctx.storage.setAlarm(Math.min(...marks));
    else await this.ctx.storage.deleteAlarm();
  }

  /* ---------- trợ giúp ---------- */

  private prepareGame(): void {
    const room = this.room!;
    // Trộn biểu tượng của mọi theme đã chọn (loại trùng)
    const symbols = [...new Set(
      room.config.themeIds.flatMap((id) => THEME_SYMBOLS[id] ?? [])
    )];
    // themeIds rỗng (phòng tạo nhanh, chưa qua wizard) → dùng TẤT CẢ theme
    // server có, thay vì tụt về một bộ duy nhất
    if (!symbols.length) symbols.push(...new Set(Object.values(THEME_SYMBOLS).flat()));
    // Seed sinh tại server — client không bao giờ biết trước bàn thẻ (NF-04)
    const seed = seedFrom(crypto.getRandomValues(new Uint32Array(1))[0]!);
    this.game = new MemoryGame(presetConfig({
      mode: room.config.mode,
      level: room.config.level,
      symbols,
      seed,
      players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
    }));
  }

  /** Phát sự kiện + view mới cho cả phòng, cập nhật trạng thái phòng nếu ván xong. */
  private async afterEvents(events: GameEvent[], save = true): Promise<void> {
    if (!events.length || !this.game || !this.room) return;
    if (events.some((e) => e.type === 'end')) this.room.status = 'ended';
    if (save) await this.save();
    this.broadcast({ t: 'events', events: publicEvents(this.game, events), view: this.view() });
    if (this.room.status === 'ended') this.broadcast({ t: 'room', room: this.roomInfo() });
    if (save) await this.scheduleNext();
  }

  private view() {
    return publicView(this.game!, Date.now(), (id) => this.connected(id));
  }

  private connected(id: string): boolean {
    const p = this.room?.players.find((x) => x.id === id);
    return !!p && p.disconnectedAt === null && this.ctx.getWebSockets(id).length > 0;
  }

  private roomInfo(): RoomInfo {
    const room = this.room!;
    return {
      code: room.code,
      hostId: room.hostId,
      config: room.config,
      status: room.status,
      againVotes: [...this.againVotes],
      players: room.players.map((p) => {
        const gp = this.game?.players.find((x) => x.id === p.id);
        if (gp) return { ...publicPlayer(gp, this.connected(p.id)), ready: p.ready };
        return {
              id: p.id, name: p.name, avatar: p.avatar,
              score: 0, pairs: 0, bestStreak: 0, frozenTurns: 0,
              doubleNext: false, forfeited: false, connected: this.connected(p.id),
              lives: null, ready: p.ready
            };
      })
    };
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket đã đóng */ }
  }

  /** Người này còn được gửi emoji không? Ghi nhận luôn lần gửi nếu được. */
  private allowEmoji(playerId: string): boolean {
    const now = Date.now();
    const cutoff = now - ROOM_LIMITS.emojiWindowMs;
    const recent = (this.emojiLog.get(playerId) ?? []).filter((t) => t > cutoff);
    if (recent.length >= ROOM_LIMITS.emojiBurst) {
      this.emojiLog.set(playerId, recent);
      return false;
    }
    recent.push(now);
    this.emojiLog.set(playerId, recent);
    return true;
  }

  private broadcast(msg: ServerMsg, exceptWelcomeFor?: string): void {
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(raw); } catch { /* bỏ qua socket chết */ }
    }
    void exceptWelcomeFor;
  }
}
