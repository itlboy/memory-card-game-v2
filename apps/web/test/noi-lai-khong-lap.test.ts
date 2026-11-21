import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * VÒNG NỐI LẠI VÔ HẠN (21.11.2026, log server Dallas: iPhone mở socket mới mỗi 0,3–1 giây sau khi quay lại từ
 * nền, người trong phòng thấy chủ phòng "nháy" liên tục, chủ phòng không thấy ai vào).
 *
 * Gốc: trình duyệt gọi `onclose` của socket bị đóng CHỦ ĐỘNG một nhịp SAU — lúc đó `connect()` đã đặt lại cờ
 * `intentionalClose = false` cho socket mới, nên onclose muộn tưởng rớt mạng và hẹn `connect()` → đóng socket
 * mới đang mở dở → lặp. FakeWS ở test cũ đóng IM LẶNG nên không bắt được; bản này đóng giống trình duyệt thật.
 */
class WSThat {
  static last: WSThat | null = null;
  static opened = 0;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { WSThat.last = this; WSThat.opened++; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(): void { /* bỏ */ }
  /** Như trình duyệt: đóng là CLOSING ngay, `onclose` tới SAU (bất đồng bộ). */
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 2;
    setTimeout(() => { this.readyState = 3; this.onclose?.({ code: 1005 }); }, 30);
  }
}

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;

beforeEach(async () => {
  vi.useFakeTimers();
  WSThat.last = null; WSThat.opened = 0;
  vi.stubGlobal('WebSocket', Object.assign(WSThat, { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 }));
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
  await room.join('ABCDEF', 'Kiên');
  WSThat.last!.open();
  WSThat.last!.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: 'ABCDEF', hostId: 'p1', status: 'lobby', players: [], config: {} }
  }) });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('nối lại không tự lặp', () => {
  it('mở socket mới khi socket cũ còn đó → onclose MUỘN của socket cũ không hẹn thêm lần nối nào', async () => {
    const truoc = WSThat.opened;
    room.retry();                               // cùng lối với onWake / mất nhịp: connect() khi ws cũ còn
    expect(WSThat.opened).toBe(truoc + 1);
    await vi.advanceTimersByTimeAsync(10_000);   // bản lỗi: thêm ~10–20 socket trong 10 giây
    expect(WSThat.opened, 'chỉ đúng MỘT socket mới').toBe(truoc + 1);
  });

  it('socket mới vẫn nối lại bình thường khi NÓ rớt thật', async () => {
    room.retry();
    await vi.advanceTimersByTimeAsync(100);
    const moi = WSThat.last!;
    moi.open();
    const truoc = WSThat.opened;
    moi.readyState = 3; moi.onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(600);
    expect(WSThat.opened).toBe(truoc + 1);
  });
});
