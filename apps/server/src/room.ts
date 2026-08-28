import { DurableObject } from 'cloudflare:workers';
import {
  CAMPAIGN_LEVELS, DEFAULT_ROOM_CONFIG, MemoryGame, QUICK_EMOJIS, ROOM_LIMITS, configFromOptions, sanitizeOptions,
  predealSymbols, publicEvents, publicPlayer, publicView, seedFrom
} from '@mm/engine';
import type {
  ClientMsg, GameEvent, PredealMsg, PublicRoom, QuickEmoji, RoomConfig, RoomInfo, ServerMsg
} from '@mm/engine';
import { LOBBY_HOLD_MS, PREDEAL } from './flags.js';
import { THEME_SYMBOLS } from './themes.js';
import { pairsForLevel } from '@mm/engine';
import { soPhongTuBinding, type SoPhong } from './sophong.js';

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
  /**
   * Sổ phòng công khai (ON-10). Cài sẵn bởi tầng dưới: Cloudflare bọc binding
   * Durable Object, Node đưa thẳng một Map. KHÔNG BẮT BUỘC — thiếu nó thì phòng
   * vẫn chạy y nguyên, chỉ là không ai thấy nó trong danh sách; đó là cách một
   * tính năng phụ nên hỏng, chứ không phải làm chết cả phòng.
   */
  SO_PHONG?: SoPhong;
  /** Binding Durable Object của sổ phòng (chỉ có trên Cloudflare). RoomDO không
   *  đụng thẳng vào nó — `this.so` bọc lại thành `SoPhong`. */
  SO_PHONG_DO?: { getByName(name: string): { fetch(request: Request): Promise<Response> } };
}

interface RoomPlayer {
  id: string;
  name: string;
  avatar?: string;
  /**
   * Định danh BỀN của trình duyệt (client sinh, lưu localStorage).
   *
   * Khác `id`: `id` chỉ sống trong một phòng, cấp mới mỗi lần vào. Cái này
   * theo người qua mọi phòng, nên sổ ván đấu mới cộng được theo NGƯỜI. Client
   * gửi lên nên KHÔNG đáng tin (ON-09): chỉ dùng để thống kê, tuyệt đối không
   * dùng để cấp quyền — ai cũng sửa tay được.
   */
  clientId?: string;
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
  /**
   * Có hiện trong danh sách phòng công khai không (ON-10).
   *
   * MẶC ĐỊNH BẬT: danh sách chỉ có nghĩa khi nó có phòng, mà mặc định tắt thì
   * gần như không ai bật lên và tính năng coi như không tồn tại. Ai muốn chơi
   * riêng với bạn bè thì tắt công tắc — phòng biến khỏi danh sách và chỉ ai có
   * mã 6 số mới vào được.
   *
   * KHÔNG có mật khẩu riêng: mã phòng vốn đã là bí mật (6 số, chỉ chủ phòng
   * biết và tự gửi đi), thêm một lớp nữa là bắt người chơi truyền tay hai thứ.
   */
  congKhai: boolean;
  /** Thời điểm hết đếm ngược 5 giây, khi status = 'countdown'. */
  countdownEnd?: number;
  /** Lúc phòng ở lobby mà KHÔNG còn ai. Xem EMPTY_LOBBY_MS. */
  emptyAt?: number;
}

/** Socket nào thuộc người chơi nào — sống sót qua hibernation nhờ attachment. */
interface Attachment { playerId: string }

// Đủ 10 con — phòng nay chứa tới 10 người, lặp lại là hai người cùng mặt.
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐨', '🦁', '🐷', '🐧', '🐙'];

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
 * TRẦN LÀ ROOM_LIMITS.reconnectMs, không tuỳ ý: lúc phát hiện, `disconnectedAt`
 * được LÙI về `lastSeen` chứ không phải `now`, nên hạn xử thua tính từ lần cuối
 * thấy họ. Đặt bằng hoặc quá hạn đó là vừa phát hiện đã xử thua luôn, mất sạch
 * cửa vào lại. (Hạn nay là 5 phút nên 20 giây rất thoải mái.)
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
// 5 phút, khớp với ROOM_LIMITS.reconnectMs: hai con số này là CÙNG một câu hỏi
// ("im bao lâu thì coi như đã đi"), lệch nhau là ngoài ván bị đá sớm hơn trong
// ván — đúng cảnh ngồi chờ ở lobby, khoá màn hình 2 phút, quay lại mất phòng.
const IDLE_SILENT_MS = 300_000;

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

/**
 * Ở LOBBY, rớt kết nối thì còn giữ CHỖ VÀ QUYỀN CHỦ PHÒNG bấy nhiêu ms.
 *
 * Trước đây `webSocketClose` ở lobby gỡ người ta khỏi phòng NGAY và chuyển
 * quyền chủ phòng ngay lập tức. Hậu quả thật: chủ phòng chuyển tab, khoá màn
 * hình, hay sóng chập một nhịp là mất quyền — quay lại thành khách trong phòng
 * của chính mình, không bấm Bắt đầu được nữa. Nó còn kéo theo avatar trùng:
 * avatar cấp theo `players.length`, người bị gỡ làm số đó tụt xuống nên người
 * vào sau nhận đúng avatar của người đang còn trong phòng.
 *
 * 30 giây là đủ cho một lần mất sóng / chuyển app rồi quay lại, mà vẫn ngắn để
 * người bỏ đi thật không chiếm chỗ lâu. Khác IDLE_SILENT_MS (5 phút): mốc kia
 * dành cho mất mạng IM LẶNG — không có bằng chứng gì nên phải rộng tay; ở đây
 * socket đã đóng hẳn, ta biết chắc họ đã rớt.
 */
// Con số thật nằm ở flags.ts để bộ smoke hạ xuống được (đừng hạ khi chạy thật).

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
    await this.dongBoSo();
  }

  /* ---------- sổ phòng công khai (ON-10) ---------- */

  /**
   * CHỮ KÝ của phòng trên danh sách: đúng những thứ một dòng danh sách hiện ra.
   * Chưa đổi thì không việc gì phải khai lại.
   */
  private chuKySo(): string {
    const r = this.room;
    if (!r || !r.congKhai || r.status !== 'lobby') return '';
    const chu = r.players.find((p) => p.id === r.hostId) ?? r.players[0];
    if (!chu) return '';
    return [r.code, chu.name, chu.avatar ?? '', r.players.length, r.config.level].join('|');
  }

  /** Chữ ký lần khai gần nhất; `null` = chưa từng đồng bộ trong lần thức này. */
  private kySoCuoi: string | null = null;

  /**
   * Đưa phòng lên/xuống sổ cho khớp trạng thái hiện tại.
   *
   * ĐẶT TRONG `save()`, không rải ở từng chỗ: mọi thay đổi trạng thái phòng đều
   * đi qua save, nên một móc ở đây là đủ — rải ra là có ngày thêm một lối đổi
   * trạng thái mà quên khai, và cái sai đó im lặng (phòng chết nằm lại trong
   * danh sách, hoặc phòng thật không bao giờ hiện ra).
   *
   * Chốt `chuKySo()` là thứ giữ cho nó rẻ: save() chạy sau MỖI nước lật thẻ, mà
   * chữ ký chỉ đổi khi có người vào/ra, đổi cấu hình, hay đổi trạng thái phòng.
   *
   * KHÔNG BAO GIỜ ném ra ngoài: sổ hỏng thì cùng lắm là phòng không hiện trong
   * danh sách — không được phép làm hỏng ván đang chơi.
   */
  /**
   * Sổ phòng, dù đang chạy ở đâu. Node đưa thẳng một `SoPhong` (Map trong RAM);
   * Cloudflare chỉ có binding DO thô, bọc tại chỗ. Không có cái nào thì tính
   * năng danh sách coi như tắt — phòng vẫn chạy đủ.
   */
  private get so(): SoPhong | undefined {
    if (this.env?.SO_PHONG) return this.env.SO_PHONG;
    if (this.env?.SO_PHONG_DO) return soPhongTuBinding(this.env.SO_PHONG_DO);
    return undefined;
  }

  private async dongBoSo(): Promise<void> {
    const so = this.so;
    if (!so || !this.room) return;
    const ky = this.chuKySo();
    if (ky === this.kySoCuoi) return;
    this.kySoCuoi = ky;
    try {
      if (!ky) { await so.xoa(this.room.code); return; }
      const r = this.room;
      const chu = r.players.find((p) => p.id === r.hostId) ?? r.players[0]!;
      const phong: PublicRoom = {
        code: r.code,
        chuPhong: chu.name,
        avatar: chu.avatar ?? AVATARS[0]!,
        nguoi: r.players.length,
        toiDa: ROOM_LIMITS.maxPlayers,
        the: pairsForLevel(r.config.level) * 2,
        luc: Date.now()
      };
      await so.khai(phong);
    } catch (e) {
      // Khai lại ở lần save sau: quên chữ ký đi, đừng để một lần lỗi mạng khoá
      // phòng khỏi danh sách cho tới khi có thay đổi tiếp theo.
      this.kySoCuoi = null;
      console.error('[sổ phòng] không đồng bộ được:', e);
    }
  }

  /**
   * Xoá sạch phòng — storage LẪN sổ công khai.
   *
   * Dùng thay cho `storage.deleteAll()` ở MỌI lối dọn phòng (sáu chỗ). Gọi
   * deleteAll trần thì bản ghi trong sổ sống tiếp tới khi hết hạn 15 phút, và
   * suốt quãng đó ai bấm vào phòng đó cũng nhận "Phòng không tồn tại".
   */
  /**
   * Dẹp phòng. `lyDo` chỉ để GHI LẠI, không đổi hành vi nào.
   *
   * Đi bằng một key trong storage rồi mới `deleteAll()`, chứ không thêm tham số
   * vào `deleteAll` — đó là API của Durable Object, sửa nó là chỉ bản Node có
   * còn Cloudflare thì không. Cách này chạy y nhau ở cả hai chỗ: bản CF ghi
   * thêm một key rồi xoá sạch (vô hại), bản Node đọc nó ra ngay trước khi xoá
   * để biết vì sao phòng đóng.
   */
  private async depPhong(lyDo: 'cancelled' | 'empty' | 'expired' | 'ended' = 'ended'): Promise<void> {
    const code = this.room?.code;
    await this.ctx.storage.put('closeReason', lyDo);
    await this.ctx.storage.deleteAll();
    this.kySoCuoi = null;
    if (!code) return;
    try { await this.so?.xoa(code); }
    catch (e) { console.error('[sổ phòng] không gỡ được phòng đã đóng:', e); }
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
    // Cắt 64: đây là chuỗi client gửi lên, không tin độ dài của nó
    const clientId = (url.searchParams.get('cid') ?? '').trim().slice(0, 64) || undefined;
    const token = url.searchParams.get('token') ?? '';

    // Mã không ứng với phòng nào: từ chối thay vì lặng lẽ lập phòng mới.
    // Client đã kiểm trước qua GET /api/rooms/:code, nhưng client không đáng
    // tin (ON-09) nên chặn cả ở đây.
    if (!this.room) {
      if (!(await this.exists())) {
        return new Response('Phòng không tồn tại', { status: 404 });
      }
      this.room = {
        code, hostId: '', config: { ...DEFAULT_ROOM_CONFIG }, players: [],
        status: 'lobby', congKhai: true
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
        clientId,
        // Avatar CHƯA AI TRONG PHÒNG DÙNG. Lấy theo `players.length` thì chỉ
        // đúng khi không ai từng rời đi: một người rời là số đó tụt xuống và
        // người vào sau đội trùng avatar của người đang ngồi đó.
        avatar: this.avatarConTrong(),
        token: crypto.randomUUID(),
        disconnectedAt: null,
        ready: false
      };
      this.room.players.push(player);
      if (!this.room.hostId) this.room.hostId = player.id;
      delete this.room.emptyAt;   // phòng có người trở lại, không còn hẹn xoá
    } else {
      player.disconnectedAt = null;
      delete this.room.emptyAt;   // người giữ chỗ đã về, không còn hẹn xoá
      if (name) player.name = name;
      if (clientId) player.clientId = clientId;
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
   * Đưa phòng từ 'ended' về 'lobby': giữ mã phòng và cấu hình, bỏ ván cũ, mọi
   * người bấm sẵn sàng lại. `giuLai` là danh sách người được ở lại (người đã
   * rớt hẳn thì không giữ chỗ nữa — họ vẫn vào lại bằng mã phòng được).
   */
  private async veLobby(giuLai: RoomPlayer[]): Promise<void> {
    if (!this.room) return;
    this.againVotes.clear();
    this.room.players = giuLai;
    if (!this.room.players.some((p) => p.id === this.room!.hostId)) {
      this.room.hostId = this.room.players[0]?.id ?? '';
    }
    this.room.status = 'lobby';
    this.game = null;
    await this.ctx.storage.delete('game');
    for (const p of this.room.players) p.ready = false;
    await this.save();
    this.broadcast({ t: 'room', room: this.roomInfo() });
    await this.scheduleNext();
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
        /*
         * Tuỳ chọn bàn chơi: LỌC TỪNG CỜ, không tin cái client gửi lên (ON-09).
         * `sanitizeOptions` kéo mọi mức về khoảng 0..3, nên một client sửa tay
         * gửi `lives: 999` hay `peek: 99` cũng chỉ ra bàn hợp lệ. Đây là chỗ
         * DUY NHẤT cấu hình phòng đi vào server.
         */
        if (c.options) this.room.config.options = sanitizeOptions(c.options);
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
        // Đủ phiếu: về phòng chờ để mọi người bấm sẵn sàng lần nữa
        await this.veLobby(here);
        return;
      }

      /*
       * VỀ PHÒNG CHỜ — một người bấm là đủ, KHÔNG cần phiếu như 'again'.
       *
       * 'again' đòi mọi người còn kết nối cùng bấm, nên khi đối phương thoát
       * giữa chừng thì nó không bao giờ đủ phiếu: người còn lại kẹt ở màn kết
       * quả, chỉ còn lối "Về menu" — và thế là MẤT PHÒNG, phải tạo mã mới rồi
       * mời lại từ đầu. Ván đã xong rồi thì đưa phòng về lobby chẳng cắt ngang
       * của ai; ai chưa muốn chơi tiếp cứ ngồi ở lobby hoặc tự thoát.
       */
      /*
       * Bật/tắt hiện trong danh sách công khai (ON-10). Chỉ CHỦ PHÒNG, và chỉ ở
       * lobby: vào ván rồi thì phòng tự rời danh sách (chữ ký rỗng), có bật lên
       * cũng không hiện, mà nút đổi được lại làm người ta tưởng ngược lại.
       */
      case 'public': {
        if (player.id !== this.room.hostId || this.room.status !== 'lobby') return;
        this.room.congKhai = msg.on === true;
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        return;
      }

      case 'tolobby': {
        if (this.room.status !== 'ended') return;
        await this.veLobby(this.room.players.filter((p) => this.connected(p.id)));
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
        // Chỉ đòi người CÒN KẾT NỐI bấm sẵn sàng: người đang trong hạn giữ chỗ
        // (LOBBY_HOLD_MS) không bấm được gì, tính họ vào là phòng kẹt tới 30 giây.
        const notReady = this.room.players.filter(
          (p) => p.id !== this.room!.hostId && !p.ready && this.connected(p.id));
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
        // Đầu hàng giữa ván: xử thua ngay, không chờ hạn vào lại
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
          await this.depPhong('empty');
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
        await this.depPhong('cancelled');
        await this.ctx.storage.deleteAlarm();
        this.room = null;
        this.game = null;
        return;
      }

      case 'alive':
        // Chỉ ghi mốc; mốc đã được cập nhật ở đầu hàm cho MỌI tin nhắn.
        return;

      /*
       * ĐỔI TÊN — ai cũng đổi được, cả ở phòng chờ lẫn giữa ván.
       *
       * Phải sửa ở HAI CHỖ: `room.players` (danh sách phòng chờ) và người chơi
       * trong engine (bảng điểm, chip lượt). Sửa một chỗ là tên hiện một đằng
       * một nẻo tuỳ người đang nhìn màn nào.
       *
       * Tên rỗng thì bỏ qua: client chặn rồi, nhưng client KHÔNG ĐÁNG TIN
       * (ON-09) — để lọt một tên rỗng là chip người chơi thành khoảng trắng.
       */
      case 'rename': {
        const ten = String(msg.name ?? '').trim().slice(0, 16);
        if (!ten || ten === player.name) return;
        player.name = ten;
        const trongVan = this.game?.players.find((p) => p.id === player.id);
        if (trongVan) trongVan.name = ten;
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        if (this.game) this.broadcast({ t: 'state', view: this.view() });
        return;
      }

      /*
       * MỜI MỘT NGƯỜI RA KHỎI PHÒNG — chỉ chủ phòng.
       *
       * Ba chốt, thiếu cái nào cũng thành lỗ hổng hoặc lỗi thật:
       *  - chỉ CHỦ PHÒNG, và không tự mời chính mình ra (muốn đi thì có nút rời
       *    phòng, đi đường đó mới chuyển quyền chủ phòng cho người khác);
       *  - báo LÝ DO cho người bị mời trước khi đóng, không thì họ chỉ thấy mất
       *    kết nối và ngồi đợi mãi;
       *  - đóng bằng mã RIÊNG (4003) để client biết ĐỪNG NỐI LẠI. Client tự vào
       *    lại mỗi 500ms, nên đóng suông là họ quay vào ngay lập tức.
       *
       * Giữa ván thì tính là xử thua, y như đầu hàng — bỏ một người ra khỏi bàn
       * mà không kết sổ thì engine còn chờ lượt của họ.
       */
      case 'kick': {
        if (player.id !== this.room.hostId) return;
        const ai = String(msg.playerId ?? '');
        if (!ai || ai === player.id) return;
        const nan = this.room.players.find((p) => p.id === ai);
        if (!nan) return;

        for (const sock of this.ctx.getWebSockets(ai)) {
          this.send(sock, { t: 'closed', message: 'Chủ phòng đã mời bạn ra khỏi phòng.' });
          sock.close(4003, 'kicked');
        }
        if (this.room.status === 'playing' && this.game) {
          const events = this.game.forfeit(ai, Date.now());
          this.removePlayer(ai);
          await this.afterEvents(events, false);
        } else {
          this.removePlayer(ai);
        }
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
        if (this.game) this.broadcast({ t: 'state', view: this.view() });
        return;
      }

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
      // GIỮ CHỖ, không gỡ ngay: LOBBY_HOLD_MS để họ nối lại, và quyền chủ phòng
      // ở nguyên chỗ cũ trong lúc đó.
      player.disconnectedAt = Date.now();
      if (!this.room.players.some((p) => this.connected(p.id))) {
        // Không còn ai ĐANG kết nối: mã phòng vẫn phải sống để cái link vừa gửi
        // đi dùng được (xem EMPTY_LOBBY_MS). Alarm sẽ dọn nếu hết giờ vẫn vắng.
        // KHÔNG xoá players và KHÔNG bỏ hostId — người rớt còn hạn quay lại.
        this.room.emptyAt = Date.now();
        await this.save();
        await this.scheduleNext();
        return;
      }
    } else {
      player.disconnectedAt = Date.now();   // ON-07: có ROOM_LIMITS.reconnectMs để vào lại
    }
    // Ván đã kết thúc và không còn socket nào: dọn phòng để mã dùng lại được
    if (this.room.status === 'ended' && this.ctx.getWebSockets().length === 0) {
      await this.depPhong('ended');
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
        await this.depPhong('expired');
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
      await this.depPhong('empty');
      await this.ctx.storage.deleteAlarm();
      this.room = null;
      this.game = null;
      return;
    }

    /*
     * HẾT HẠN GIỮ CHỖ Ở LOBBY (LOBBY_HOLD_MS): giờ mới gỡ thật, và giờ mới
     * chuyển quyền chủ phòng. Trước khối này chạy, người rớt vẫn là chủ phòng.
     */
    if (this.room.status === 'lobby') {
      const truoc = this.room.players.length;
      this.room.players = this.room.players.filter(
        (p) => p.disconnectedAt === null || now - p.disconnectedAt < LOBBY_HOLD_MS
      );
      if (this.room.players.length !== truoc) {
        if (!this.room.players.some((p) => p.id === this.room!.hostId)) {
          this.room.hostId = this.room.players[0]?.id ?? '';
        }
        if (!this.room.players.length) this.room.emptyAt = now;
        await this.save();
        this.broadcast({ t: 'room', room: this.roomInfo() });
      }
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
          await this.depPhong('empty');
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
     * hiểu gì, và hạn xử thua không bao giờ chạy. Đã đo được đúng cảnh
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
        // Hết hạn giữ chỗ ở lobby: thiếu mốc này thì người rớt nằm lại phòng tới
        // khi một alarm KHÁC tình cờ nổ, và quyền chủ phòng treo theo.
        if (this.room.status === 'lobby' && p.disconnectedAt !== null) {
          marks.push(p.disconnectedAt + LOBBY_HOLD_MS + 500);
        }
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
    // Lọc lại lần nữa ngay trước khi dựng ván: bản lưu trong storage có thể là
    // của bản cũ (chưa có `options`) hoặc đã bị sửa ở đâu đó.
    this.game = new MemoryGame(configFromOptions({
      options: sanitizeOptions(room.config.options),
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

  /**
   * Avatar chưa ai trong phòng đang đội. AVATARS có 10 con, đúng bằng
   * ROOM_LIMITS.maxPlayers, nên luôn còn ít nhất một con trống; hết sạch (không
   * xảy ra được, nhưng đừng để trả về undefined) thì quay vòng như cũ.
   */
  private avatarConTrong(): string {
    const dangDung = new Set(this.room!.players.map((p) => p.avatar));
    return AVATARS.find((a) => !dangDung.has(a))
      ?? AVATARS[this.room!.players.length % AVATARS.length]!;
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
      // Phòng cũ lưu trước ON-10 không có trường này — coi như công khai, đúng
      // với mặc định của phòng mới.
      congKhai: room.congKhai !== false,
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
    try {
      const kem = this.predealKem(msg);
      if (kem) ws.send(kem);
      ws.send(JSON.stringify(msg));
    } catch { /* socket đã đóng */ }
  }

  /**
   * Nếu đang gửi một cái view và cờ PREDEAL bật thì trả về thông điệp `predeal`
   * để gửi KÈM ngay trước đó.
   *
   * Đặt móc ở đây — trong đúng hai hàm gửi — chứ không rải ở 6 chỗ dựng
   * `t:'state'`/`t:'events'`: rải ra là chắc chắn có ngày thêm chỗ gửi thứ 7 mà
   * quên, rồi bàn lệch sau một lần xáo mà không ai hiểu tại sao.
   *
   * Gửi TRƯỚC view, không phải sau: client xử lý view xong là đã có thể vẽ, nên
   * dữ liệu phải có sẵn trước đó.
   */
  private predealKem(msg: ServerMsg): string | null {
    if (!PREDEAL) return null;
    if (msg.t !== 'state' && msg.t !== 'events') return null;
    if (!this.game) return null;
    return JSON.stringify({ t: 'predeal', symbols: predealSymbols(this.game) } satisfies PredealMsg);
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
    const kem = this.predealKem(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        if (kem) ws.send(kem);
        ws.send(raw);
      } catch { /* bỏ qua socket chết */ }
    }
    void exceptWelcomeFor;
  }
}
