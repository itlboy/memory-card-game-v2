/**
 * BỌC CÁC API CỦA CLOUDFLARE để chạy `RoomDO` NGUYÊN VẸN trên Node.
 *
 * Vì sao làm thế thay vì viết lại phòng cho Node: luật phòng là 759 dòng đã qua
 * hàng loạt sự cố thật (mất mạng im lặng, bàn treo, chia link, kiểm biên tuỳ
 * chọn). Viết bản thứ hai là chắc chắn hai bản lệch nhau, và lệch ở đúng những
 * chỗ khó thấy nhất. Ở đây `apps/server/src/room.ts` được dùng Y NGUYÊN, chỉ
 * thay tầng bên dưới nó.
 *
 * Ba thứ Node không có mà room.ts cần:
 *
 *  1. `cloudflare:workers` → lớp `DurableObject` (chỉ cần gán this.ctx/this.env);
 *  2. `Response` với status 101 — undici NÉM LỖI với 101 (chỉ nhận 200–599),
 *     mà đó đúng là cách CF trả WebSocket về;
 *  3. `WebSocketPair` + `ctx.acceptWebSocket` + `serializeAttachment` —
 *     Hibernation API, Node không có khái niệm đó.
 *
 * Cả ba được thay bằng `define` lúc build (xem build.mjs), nên KHÔNG phải sửa
 * một dòng nào trong room.ts.
 */
import type { WebSocket as WsSocket } from 'ws';

/* ---------- 1. Lớp DurableObject ---------- */

export class DurableObject<E = unknown> {
  constructor(public ctx: MmCtx, public env: E) {}
}

/* ---------- 2. Response mang theo WebSocket ---------- */

/**
 * `Response` tối giản, chỉ đủ những gì room.ts đọc: `status` và (với 101) socket
 * kèm theo. Không kế thừa Response thật vì chính constructor đó chặn 101.
 */
export class MmResponse {
  readonly status: number;
  readonly body: string | null;
  constructor(body: BodyInit | null, init?: { status?: number; webSocket?: unknown }) {
    this.body = typeof body === 'string' ? body : null;
    this.status = init?.status ?? 200;
  }
}

/* ---------- 3. Socket: Hibernation API trên nền `ws` ---------- */

/**
 * Bọc socket của thư viện `ws` cho giống socket của CF: thêm
 * `serializeAttachment`/`deserializeAttachment` (CF dùng để nhớ playerId qua
 * hibernation) và `close(code, reason)`.
 *
 * Ở Node không có hibernation nên attachment chỉ cần nằm trong RAM.
 */
export class MmSocket {
  private attachment: unknown = null;
  /** Nhãn CF gán lúc acceptWebSocket — room.ts tra socket theo playerId. */
  tags: string[] = [];

  constructor(private raw: WsSocket) {}

  send(data: string): void {
    if (this.raw.readyState === 1) this.raw.send(data);
  }
  close(code?: number, reason?: string): void {
    try { this.raw.close(code, reason); } catch { /* đã đóng */ }
  }
  serializeAttachment(v: unknown): void { this.attachment = v; }
  deserializeAttachment(): unknown { return this.attachment; }
  get readyState(): number { return this.raw.readyState; }
  get rawSocket(): WsSocket { return this.raw; }
}

/** Cặp yêu cầu/trả lời để tự đáp `ping` mà không đánh thức DO. Ở Node chỉ là dữ liệu. */
export class MmRequestResponsePair {
  constructor(public request: string, public response: string) {}
}

/**
 * `new WebSocketPair()` của CF trả [client, server]. Ở Node chỉ có MỘT socket
 * thật (peer đầu kia là trình duyệt), nên hai phần tử cùng trỏ vào nó.
 *
 * Socket "đang vào" phải lấy qua hàm: room.ts gọi `new WebSocketPair()` ở giữa
 * thân `fetch()`, nên lúc dựng lớp này chưa biết là socket nào.
 */
export function makePairFactory(laySocketHienTai: () => MmSocket) {
  return class MmWebSocketPair {
    0: MmSocket;
    1: MmSocket;
    constructor() {
      const s = laySocketHienTai();
      this[0] = s;
      this[1] = s;
    }
  };
}

/* ---------- Bối cảnh của một phòng (thay cho DurableObjectState) ---------- */

export interface MmCtx {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    deleteAll(): Promise<void>;
    setAlarm(when: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  acceptWebSocket(ws: MmSocket, tags?: string[]): void;
  getWebSockets(tag?: string): MmSocket[];
  setWebSocketAutoResponse(pair: MmRequestResponsePair): void;
}

/** Trạng thái sống của một phòng trong tiến trình Node. */
export interface RoomBox {
  ctx: MmCtx;
  /** Cặp ping/pong tự đáp, nếu phòng đã đăng ký. */
  autoResponse: MmRequestResponsePair | null;
  sockets: Set<MmSocket>;
  alarmTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Dựng bối cảnh cho một phòng.
 *
 * `onAlarm` là hàm gọi lại khi tới hẹn — chính là `room.alarm()`. Ở CF, alarm
 * đánh thức cả Durable Object; ở đây chỉ là một `setTimeout`, nhưng phải giữ
 * ĐÚNG một cái: room.ts đặt lại alarm liên tục và trông đợi cái sau ghi đè cái
 * trước (`scheduleNext`).
 */
/**
 * Móc để lưu phòng xuống kho bền (MySQL). Không truyền thì y như cũ: phòng chỉ
 * sống trong RAM và biến mất khi tiến trình chết.
 *
 * `luu` được gọi sau MỖI thay đổi — kho tự lo việc gộp lại; ở đây không được
 * `await` gì cả, vì hàm này nằm trên đường đi của mỗi nước lật thẻ.
 */
export interface MocLuu {
  luu(duLieu: Record<string, unknown>, alarmLuc: number | null): void;
  /** Phòng dẹp hẳn. `lyDo` do room.ts ghi vào storage ngay trước `deleteAll()`. */
  dong(lyDo: string): void;
}

export function taoBoiCanh(
  onAlarm: () => Promise<void>,
  khiRong: () => void,
  moc?: MocLuu,
  banDau?: Record<string, unknown>
): RoomBox {
  const kho = new Map<string, unknown>(Object.entries(banDau ?? {}));
  /** Mốc alarm đang hẹn — phải lưu kèm, không thì phòng khôi phục xong nằm chết
   *  không ai đánh thức (ván không tick, phòng rác không được dọn). */
  let alarmLuc: number | null = null;
  /*
   * ĐÃ DẸP HẲN. `depPhong()` gọi `deleteAll()` rồi `deleteAlarm()` ngay sau —
   * mà `deleteAlarm` cũng lưu, nên nó GHI ĐÈ lệnh xoá bằng một bản ghi rỗng và
   * phòng đã huỷ sống lại trong database dưới dạng rác. Đo được thật: huỷ một
   * phòng mà số dòng trong bảng vẫn tăng.
   *
   * Sau khi dẹp thì mọi lệnh lưu đều bị bỏ qua — phòng này đã chết, không còn
   * gì đáng ghi nữa.
   */
  let daDep = false;
  const luu = (): void => { if (!daDep) moc?.luu(Object.fromEntries(kho), alarmLuc); };
  const box: RoomBox = {
    autoResponse: null,
    sockets: new Set(),
    alarmTimer: null,
    ctx: {
      storage: {
        get: async <T>(k: string) => kho.get(k) as T | undefined,
        put: async (k, v) => { kho.set(k, v); luu(); },
        delete: async (k) => { const co = kho.delete(k); luu(); return co; },
        deleteAll: async () => {
          /*
           * Lý do đóng phải đọc TRƯỚC khi xoá sạch: room.ts ghi nó vào storage
           * ngay trước lệnh này (xem `depPhong`). Đi đường vòng như vậy vì
           * `deleteAll` là API của Durable Object — thêm tham số vào đó thì chỉ
           * bản Node có, còn Cloudflare thì không.
           */
          const lyDo = String(kho.get('closeReason') ?? 'ended');
          kho.clear();
          daDep = true;
          moc?.dong(lyDo);
          // Phòng đã dọn sạch: bỏ luôn khỏi bảng phòng của tiến trình, không thì
          // mã phòng vẫn "tồn tại" vì bản ghi rỗng còn nằm đó.
          khiRong();
        },
        setAlarm: async (when: number) => {
          if (box.alarmTimer) clearTimeout(box.alarmTimer);
          alarmLuc = when;
          const cho = Math.max(0, when - Date.now());
          box.alarmTimer = setTimeout(() => {
            box.alarmTimer = null;
            alarmLuc = null;
            void onAlarm().catch((e) => console.error('[room] alarm lỗi:', e));
          }, cho);
          luu();
        },
        deleteAlarm: async () => {
          if (box.alarmTimer) clearTimeout(box.alarmTimer);
          box.alarmTimer = null;
          alarmLuc = null;
          luu();
        }
      },
      acceptWebSocket: (ws, tags) => {
        ws.tags = tags ?? [];
        box.sockets.add(ws);
      },
      getWebSockets: (tag) => [...box.sockets].filter(
        (s) => (tag === undefined || s.tags.includes(tag)) && s.readyState === 1
      ),
      setWebSocketAutoResponse: (pair) => { box.autoResponse = pair; }
    }
  };
  return box;
}
