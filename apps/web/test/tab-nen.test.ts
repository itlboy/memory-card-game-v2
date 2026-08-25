import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * TAB BỊ ĐƯA XUỐNG NỀN — cảnh thường nhất trên điện thoại: đang ở phòng, rời app
 * sang Zalo dán link mời bạn, rồi quay lại.
 *
 * Trình duyệt bóp `setInterval` của tab nền (Chrome ~1 lần/phút, iOS treo hẳn),
 * nên nhịp `alive` 4 giây ngừng chảy và server tính là mất kết nối. Nới
 * SILENT_MS chỉ mua thêm thời gian; thứ chữa đúng gốc là NÓI NGAY "tôi còn đây"
 * ở giây quay lại. Và nếu socket đã chết trong lúc ở nền — iOS treo kết nối mà
 * `readyState` vẫn báo OPEN — thì phải nối lại luôn, đừng chờ ba nhịp trượt nữa.
 */

/** WebSocket giả: mở/đóng theo lệnh, ghi lại tin đã gửi. */
class FakeWS {
  static last: FakeWS | null = null;
  static opened = 0;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.last = this; FakeWS.opened++; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  /** Số tin `alive` đã gửi — đây là thứ DUY NHẤT đánh thức Durable Object,
   *  `ping` được runtime tự trả lời nên server không biết mình còn sống. */
  get soAlive(): number {
    return this.sent.filter((s) => (JSON.parse(s) as { t: string }).t === 'alive').length;
  }
}

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;
/** Trạng thái hiện/ẩn của tab — `document.visibilityState` chỉ đọc được nên phải ghi đè. */
let hienThi: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  FakeWS.last = null; FakeWS.opened = 0;
  hienThi = 'visible';
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => hienThi
  });
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function vaoPhong(): Promise<FakeWS> {
  await room.join('ABCDEF', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: 'ABCDEF', hostId: 'p1', status: 'lobby', players: [], config: {} }
  }) });
  return ws;
}

/** Giả cảnh tab xuống nền rồi hiện lại. Không có `setInterval` nào chạy ở giữa
 *  — đúng như trình duyệt làm với tab nền. */
function quayLaiTab(): void {
  hienThi = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  hienThi = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('tab quay lại từ nền', () => {
  it('đập nhịp NGAY, không chờ hết 4 giây', async () => {
    const ws = await vaoPhong();
    const truoc = ws.soAlive;
    quayLaiTab();
    expect(ws.soAlive, 'quay lại là phải nói ngay "tôi còn đây"').toBe(truoc + 1);
  });

  it('socket đã chết trong lúc ở nền thì nối lại LUÔN, không chờ ba nhịp trượt', async () => {
    const ws = await vaoPhong();
    const soLanMo = FakeWS.opened;
    // iOS: kết nối bị treo mà readyState vẫn báo OPEN → ở đây dựng cảnh nặng
    // hơn, socket đã CLOSED hẳn
    ws.readyState = 3;

    quayLaiTab();
    expect(FakeWS.opened, 'phải mở kết nối mới ngay khi tab hiện lại').toBe(soLanMo + 1);
    expect(room.reconnecting.value).toBe(true);
  });

  it('tab ẩn đi thì KHÔNG đập nhịp — chỉ lúc hiện lại mới đập', async () => {
    const ws = await vaoPhong();
    const truoc = ws.soAlive;
    hienThi = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ws.soAlive, 'đang ẩn thì gửi cũng vô nghĩa').toBe(truoc);
  });

  it('rời phòng rồi thì không còn nghe visibilitychange nữa', async () => {
    const ws = await vaoPhong();
    room.leave();
    const truoc = ws.soAlive;
    const soLanMo = FakeWS.opened;
    quayLaiTab();
    // Bộ nghe còn sót lại là mỗi lần đổi tab lại đập nhịp / nối lại một phòng
    // mình đã rời — lỗi kiểu này không bao giờ tự lộ ra.
    expect(ws.soAlive, 'không được gửi gì sau khi đã rời phòng').toBe(truoc);
    expect(FakeWS.opened, 'không được nối lại phòng đã rời').toBe(soLanMo);
  });
});
