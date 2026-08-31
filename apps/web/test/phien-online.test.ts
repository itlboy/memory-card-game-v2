import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * PHIÊN ONLINE PHẢI Ở localStorage, KHÔNG PHẢI sessionStorage.
 *
 * `token` là thứ DUY NHẤT server dùng để nhận ra ai vào lại. Để nó trong
 * sessionStorage nghĩa là nó chết theo cái TAB: đóng tab rồi mở lại là thành
 * người lạ — id mới, avatar mới, chiếm thêm một chỗ. Đo được thật trước khi
 * sửa: phòng hiện ra "Kiên🦊 Mai🐼 Kiên🐯", một người hoá hai.
 *
 * Và phải CÓ HẠN: localStorage sống mãi, nên không có hạn thì hôm sau bấm
 * "Chơi online" là bị kéo vào cái phòng đã chết từ hôm trước.
 */
class FakeWS {
  static last: FakeWS | null = null;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.last = this; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(d: string): void { this.sent.push(d); }
  close(): void { this.readyState = 3; }
}

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;

beforeEach(async () => {
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  localStorage.clear(); sessionStorage.clear();
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
  await room.join('123456', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok-bi-mat', spectator: false,
    room: { code: '123456', hostId: 'p1', status: 'lobby', players: [], config: {} }
  }) });
});
afterEach(() => { scope.stop(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('phiên online', () => {
  it('lưu vào localStorage, KHÔNG phải sessionStorage', () => {
    expect(localStorage.getItem('mm.online'), 'phiên phải sống qua việc đóng tab').not.toBeNull();
    expect(sessionStorage.getItem('mm.online'), 'sessionStorage chết theo tab').toBeNull();
  });

  it('giữ token để vào lại đúng người', () => {
    const s = JSON.parse(localStorage.getItem('mm.online')!);
    expect(s.token).toBe('tok-bi-mat');
    expect(s.code).toBe('123456');
    expect(typeof s.luc, 'phải có mốc thời gian để tính hạn').toBe('number');
  });

  it('phiên cũ quá hạn thì BỎ, không kéo người ta vào phòng đã chết', () => {
    const s = JSON.parse(localStorage.getItem('mm.online')!);
    // 31 phút trước — quá hạn 30 phút
    s.luc = Date.now() - 31 * 60 * 1000;
    localStorage.setItem('mm.online', JSON.stringify(s));
    expect(room.coPhienLuu(), 'quá hạn mà vẫn nhận là phiên còn dùng được').toBe(false);
    expect(localStorage.getItem('mm.online'), 'phiên quá hạn phải bị dọn luôn').toBeNull();
  });

  it('phiên còn hạn thì vẫn dùng', () => {
    const s = JSON.parse(localStorage.getItem('mm.online')!);
    s.luc = Date.now() - 20 * 60 * 1000;   // 20 phút, còn trong hạn
    localStorage.setItem('mm.online', JSON.stringify(s));
    expect(room.coPhienLuu()).toBe(true);
  });
});
