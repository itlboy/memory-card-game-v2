import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * RỚT KẾT NỐI: thử lại DÀY và IM LẶNG.
 *
 * Hai luật do chủ dự án chốt, và cả hai đều dễ bị "sửa" ngược lại nếu không có
 * chốt canh:
 *
 *  1. Thử lại đều đặn mỗi 500ms, KHÔNG backoff. Bản cũ giãn 1,5 → 3 → 6 → 10
 *     giây để đỡ đập server; nhưng ca thật hay gặp là sóng chớp một nhịp giữa
 *     ván, mà một lượt chỉ có 15 giây — chờ 10 giây cho sự cố đã hết từ lâu là
 *     mất lượt oan.
 *  2. Chỉ báo sau 5 giây rớt LIÊN TỤC, và báo ĐÚNG MỘT LẦN cho cả đợt. Mỗi lượt
 *     thử một dòng đỏ là spam; nháy lên rồi tắt ngay cho một lần chớp sóng thì
 *     đọc thành "mạng lởm" trong khi chẳng có gì hỏng.
 */

class FakeWS {
  static last: FakeWS | null = null;
  static opened = 0;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.last = this; FakeWS.opened++; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  /** Server rớt: đóng KHÔNG phải do mình chủ động (mã 4000..4002 là chủ động). */
  rot(): void { this.readyState = 3; this.onclose?.({ code: 1006 }); }
}

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;

beforeEach(async () => {
  vi.useFakeTimers();
  FakeWS.last = null; FakeWS.opened = 0;
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
  await room.join('ABCDEF', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: 'ABCDEF', hostId: 'p1', status: 'lobby', players: [], config: {} }
  }) });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('rớt kết nối', () => {
  it('thử lại mỗi 500ms, không giãn dần', async () => {
    const truoc = FakeWS.opened;
    FakeWS.last!.rot();

    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWS.opened, 'nửa giây sau phải thử lại lần 1').toBe(truoc + 1);

    FakeWS.last!.rot();
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWS.opened, 'lần 2 vẫn đúng nửa giây, KHÔNG nhân đôi lên 1 giây').toBe(truoc + 2);

    FakeWS.last!.rot();
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWS.opened, 'lần 3 vẫn nửa giây').toBe(truoc + 3);
  });

  it('rớt chớp nhoáng thì người chơi KHÔNG thấy gì', async () => {
    FakeWS.last!.rot();
    await vi.advanceTimersByTimeAsync(500);
    expect(room.reconnecting.value, 'đang nối lại nhưng chưa được báo').toBe(false);

    // Nối lại được ở lượt đầu: cả đợt trôi qua lặng lẽ
    const ws = FakeWS.last!;
    ws.open();
    ws.onmessage?.({ data: JSON.stringify({
      t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
      room: { code: 'ABCDEF', hostId: 'p1', status: 'lobby', players: [], config: {} }
    }) });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(room.reconnecting.value, 'đã nối lại rồi thì đừng báo gì nữa').toBe(false);
  });

  it('rớt quá 5 giây mới báo, và mốc tính từ lần rớt ĐẦU chứ không phải lượt thử cuối', async () => {
    FakeWS.last!.rot();
    // Mười lượt thử trượt liên tiếp trong 5 giây
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
      FakeWS.last!.rot();
    }
    expect(room.reconnecting.value, 'rớt liên tục 5 giây thì phải báo').toBe(true);

    /*
     * Chốt chống SPAM: mốc 5 giây đặt MỘT lần cho cả đợt (`if (rotTu) return`).
     * Cách viết ngây thơ là mỗi lượt thử lại clear rồi set hẹn giờ mới — với
     * nhịp 500ms thì mốc 5 giây bị đẩy lùi mãi và dòng thông báo KHÔNG BAO GIỜ
     * hiện. Đã kiểm ngược: thay chốt đó bằng clearTimeout là test này đỏ.
     */
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
      FakeWS.last!.rot();
    }
    expect(room.reconnecting.value, 'vẫn đang rớt thì giữ nguyên MỘT dòng, không tắt bật').toBe(true);
  });
});
