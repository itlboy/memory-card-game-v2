import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { effectScope, type EffectScope } from 'vue';

/**
 * Nước bấm KHÔNG TỚI ĐƯỢC SERVER thì phải cứu được lượt.
 *
 * Lỗi thật đã bị phản ánh: "bấm rồi mà server không phản hồi, người chơi bị quá
 * giờ luôn và không được bấm lại". Hai nguyên nhân: `send()` âm thầm bỏ tin khi
 * socket không mở, và nhịp tim phải 3 nhịp × 4 giây = 12 giây mới kết luận socket
 * chết — trong khi một lượt chỉ có 15 giây.
 */

/** WebSocket giả: mở/đóng theo lệnh, ghi lại tin đã gửi. */
class FakeWS {
  static last: FakeWS | null = null;
  static opened = 0;
  readyState = 0;              // CONNECTING
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWS.last = this;
    FakeWS.opened++;
  }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  get flips(): number[] {
    return this.sent.map((s) => JSON.parse(s) as { t: string; index?: number })
      .filter((m) => m.t === 'flip').map((m) => m.index!);
  }
}

let scope: EffectScope;
let room: ReturnType<typeof useOnlineRoom>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeWS.last = null; FakeWS.opened = 0;
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  scope = effectScope();
  scope.run(() => { room = useOnlineRoom(); });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Vào phòng: dựng socket rồi mở, giả tin joined để có code + token.
 *  `join()` là async (kiểm mã qua REST trước) nên phải await. */
async function enterRoom(): Promise<FakeWS> {
  await room.join('ABCDEF', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  // Tin server gửi lúc vào phòng tên là 'welcome' (không phải 'joined'), và nó
  // là chỗ client nhận `token` — thiếu token thì reconnectNow() không làm gì.
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], config: {} }
  }) });
  // Và một view nói rõ ĐANG LÀ LƯỢT MÌNH: client chặn sẵn cú bấm mà server chắc
  // chắn bỏ qua (không phải lượt mình, hoặc đã có 2 ô đang mở) — không dựng lượt
  // thì flip() không gửi gì và test kiểm sai thứ.
  ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: viewCuaToi('p1') }) });
  return ws;
}

/** View 12 ô úp hết, lượt của `currentId`. */
function viewCuaToi(currentId: string): unknown {
  return {
    cols: 4, rows: 3,
    cards: Array.from({ length: 12 }, (_, index) => ({ index, state: 'down' })),
    players: [{ id: 'p1', name: 'Kiên' }, { id: 'p2', name: 'Bạn' }],
    currentId, moves: 0, matchedPairs: 0, totalPairs: 6, status: 'playing',
    timeLeft: null, turnTimeLeft: 15, elapsed: 0, summary: null, back: 'stars'
  };
}

describe('nước bấm bị rơi', () => {
  it('socket ĐÓNG: nói ra ngay và vào lại, không im lặng chờ hết lượt', async () => {
    const ws = await enterRoom();
    const soLanMo = FakeWS.opened;
    ws.readyState = 3;                       // socket chết, readyState báo CLOSED

    room.flip(4);
    expect(room.netTrouble.value, 'phải nói ra là mất kết nối').not.toBe('');
    expect(room.pending.value.has(4), 'không để thẻ treo ở trạng thái chờ').toBe(false);
    expect(FakeWS.opened, 'phải mở kết nối mới NGAY, không chờ 12 giây nhịp tim')
      .toBeGreaterThan(soLanMo);
  });

  it('socket báo OPEN nhưng server im: sau 1,5 giây thì đồng bộ lại', async () => {
    const ws = await enterRoom();
    const soLanMo = FakeWS.opened;
    room.flip(7);
    expect(ws.flips, 'tin đã được gửi').toContain(7);
    expect(room.pending.value.has(7), 'đang chờ xác nhận').toBe(true);

    vi.advanceTimersByTime(1400);
    expect(FakeWS.opened, 'chưa tới hạn thì đừng vội vào lại').toBe(soLanMo);

    vi.advanceTimersByTime(300);
    expect(room.netTrouble.value).not.toBe('');
    expect(FakeWS.opened, 'quá hạn thì vào lại để lấy trạng thái thật').toBeGreaterThan(soLanMo);
  });

  it('KHÔNG gửi lại nước cũ khi đồng bộ — gửi lại có thể thành lật thêm một thẻ', async () => {
    const ws = await enterRoom();
    room.flip(9);
    vi.advanceTimersByTime(2000);
    expect(ws.flips.filter((i) => i === 9)).toHaveLength(1);
  });

  it('server trả lời kịp thì không báo sự cố gì', async () => {
    const ws = await enterRoom();
    room.flip(2);
    ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: viewCuaToi('p1') }) });
    vi.advanceTimersByTime(3000);
    expect(room.netTrouble.value).toBe('');
  });
});

describe('emoji chat nổi trên header', () => {
  it('teleport ra body và dùng position: fixed — trong dải thông báo thì bị `main` cắt', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineGame.vue'), 'utf8');
    // `main` có overflow: auto (bản đồ cấp cần cuộn) nên thứ gì nhô lên trên mép
    // main đều bị CẮT — nhìn ra thành "emoji nằm dưới header". Không phải z-index.
    expect(src, 'phải teleport ra body').toContain('<Teleport to="body">');
    const at = src.indexOf('.emoji-blast {');
    const rule = src.slice(at, src.indexOf('}', at));
    expect(rule).toContain('position: fixed');
    expect(rule).toMatch(/z-index:\s*\d+/);
  });
});
