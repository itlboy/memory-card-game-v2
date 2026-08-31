import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * THẺ LẬT SAI PHẢI Ở LẠI ĐỦ LÂU CHO NGƯỜI XEM.
 *
 * Server đếm `flipBackMs` từ lúc NÓ xử nước đi, rồi úp lại và gửi view mới.
 * Người kia nhận tin trễ: mạng nghẽn rồi thông thì tin "lật sai" và tin "đã úp"
 * tới gần như cùng lúc — thẻ loé lên rồi tắt, không kịp nhìn. Đúng lỗi đã bị
 * phản ánh: "mở rồi úp rất nhanh".
 *
 * Nên client GHIM hai lá đó, đếm đủ `hideAfterMs` KỂ TỪ LÚC NHẬN.
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

const the = (index: number, state: string, symbol = '') => ({ index, state, symbol });
const banCo = (states: [number, string, string][]) => ({
  cards: states.map(([i, s, sy]) => the(i, s, sy)),
  players: [], currentId: 'p2', status: 'playing',
  turnTimeLeft: 30, elapsed: 1, peekLeft: null, cols: 2, rows: 2, totalPairs: 2
});

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  localStorage.clear();
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
  await room.join('123456', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: '123456', hostId: 'p2', status: 'playing', players: [], config: {} }
  }) });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const guiMiss = (hideAfterMs = 800) => FakeWS.last!.onmessage?.({ data: JSON.stringify({
  t: 'events',
  events: [{ type: 'miss', indices: [0, 1], penalty: 0, hideAfterMs }],
  // View ĐI KÈM tin này: hai lá còn ngửa và CÓ symbol
  view: banCo([[0, 'up', '🦊'], [1, 'up', '🐼'], [2, 'down', ''], [3, 'down', '']])
}) });

const guiDaUp = () => FakeWS.last!.onmessage?.({ data: JSON.stringify({
  t: 'state',
  view: banCo([[0, 'down', ''], [1, 'down', ''], [2, 'down', ''], [3, 'down', '']])
}) });

describe('giữ thẻ lật sai đủ lâu', () => {
  it('ghim hai lá kèm symbol chụp từ view ĐI KÈM tin đó', () => {
    guiMiss();
    // `applyEvents` chạy TRƯỚC khi view mới được gán, nên phải chụp từ view của
    // chính tin nhắn — lấy `view.value` là còn view cũ, chưa có lá thứ hai.
    expect([...room.giuMo.value.entries()]).toEqual([[0, '🦊'], [1, '🐼']]);
  });

  it('view "đã úp" tới ngay sau đó KHÔNG xoá được ghim', () => {
    guiMiss();
    guiDaUp();                       // mạng thông, hai tin dồn tới
    expect(room.giuMo.value.size, 'thẻ tắt ngay, người xem không kịp nhìn').toBe(2);
  });

  it('đủ hideAfterMs thì mới nhả', () => {
    guiMiss(800);
    guiDaUp();
    vi.advanceTimersByTime(799);
    expect(room.giuMo.value.size, 'nhả sớm hơn hạn').toBe(2);
    vi.advanceTimersByTime(2);
    expect(room.giuMo.value.size, 'quá hạn mà vẫn ghim').toBe(0);
  });

  it('đếm từ LÚC NHẬN, không phải từ mốc của server', () => {
    // Đây là điểm mấu chốt: server có thể đã úp từ lâu, nhưng người xem vẫn
    // được trọn 800ms kể từ khi tin tới tay họ.
    guiMiss(800);
    vi.advanceTimersByTime(700);
    guiDaUp();                       // server úp muộn hơn nữa
    expect(room.giuMo.value.size).toBe(2);
    vi.advanceTimersByTime(101);
    expect(room.giuMo.value.size).toBe(0);
  });

  it('KHÔNG ghim thẻ chưa từng ngửa — không lộ bài', () => {
    guiMiss();
    // chỉ hai lá server vừa báo ngửa, không có lá nào khác
    expect([...room.giuMo.value.keys()].sort()).toEqual([0, 1]);
  });
});
