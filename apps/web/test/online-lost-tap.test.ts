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

describe('chặn cú bấm server chắc chắn bỏ qua', () => {
  /** Gửi view: 12 ô, `up` là các ô đang mở, lượt của `currentId`. */
  function guiView(ws: FakeWS, currentId: string, up: number[] = []): void {
    ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: {
      cols: 4, rows: 3,
      cards: Array.from({ length: 12 }, (_, index) => ({
        index, state: up.includes(index) ? 'up' : 'down', symbol: up.includes(index) ? 'A' : undefined
      })),
      players: [{ id: 'p1', name: 'Kiên' }, { id: 'p2', name: 'Bạn' }],
      currentId, moves: 0, matchedPairs: 0, totalPairs: 6, status: 'playing',
      timeLeft: null, turnTimeLeft: 15, elapsed: 0, summary: null, back: 'stars'
    } }) });
  }

  it('KHÔNG phải lượt mình thì không gửi và không treo ô nào', async () => {
    const ws = await enterRoom();
    guiView(ws, 'p2');
    const truoc = ws.flips.length;
    room.flip(3);
    expect(ws.flips.length, 'không gửi').toBe(truoc);
    expect(room.pending.value.size, 'không treo ô — ô treo bị vẽ xoay 90°, trông như MẤT thẻ').toBe(0);
  });

  it('bấm ô thứ BA khi đã có hai ô cho lượt này thì bỏ qua', async () => {
    const ws = await enterRoom();
    guiView(ws, 'p1');
    room.flip(0);
    room.flip(1);
    const truoc = ws.flips.length;
    room.flip(2);
    expect(ws.flips.length).toBe(truoc);
    expect(room.pending.value.size).toBeLessThanOrEqual(2);
  });

  it('bấm ô đang MỞ hoặc bấm hai lần cùng một ô thì bỏ qua', async () => {
    const ws = await enterRoom();
    guiView(ws, 'p1', [5]);          // ô 5 đang mở
    const truoc = ws.flips.length;
    room.flip(5);
    expect(ws.flips.length, 'ô đang mở').toBe(truoc);
    room.flip(7);
    const sauMotO = ws.flips.length;
    room.flip(7);
    expect(ws.flips.length, 'bấm lại cùng ô').toBe(sauMotO);
  });

  it('bấm dồn hai ô hợp lệ thì CẢ HAI đều được thả ra sau hạn, không ô nào treo lại', async () => {
    const ws = await enterRoom();
    guiView(ws, 'p1');
    room.flip(0);
    room.flip(1);
    expect(room.pending.value.size).toBe(2);
    // Server im: mỗi ô phải có hẹn giờ RIÊNG. Dùng chung một hẹn giờ là chỉ ô
    // cuối được thả, ô kia treo vĩnh viễn ở 90 độ — đúng lỗi "mất thẻ" đã gặp.
    vi.advanceTimersByTime(2000);
    expect(room.pending.value.size, 'không ô nào được treo lại').toBe(0);
  });
});

describe('bàn treo thì phải nói ra và tự đồng bộ', () => {
  it('đồng hồ lượt về 0 mà server im 4 giây → báo cho người chơi và vào lại', async () => {
    const ws = await enterRoom();
    const soLanMo = FakeWS.opened;
    // View: đang chơi, đồng hồ lượt ĐÃ HẾT, hai thẻ còn mở — đúng ảnh chụp lỗi
    ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: {
      cols: 4, rows: 3,
      cards: Array.from({ length: 12 }, (_, index) => ({
        index, state: index < 2 ? 'up' : 'down', symbol: index < 2 ? `S${index}` : undefined
      })),
      players: [{ id: 'p1', name: 'Kiên' }, { id: 'p2', name: 'kkkk' }],
      currentId: 'p2', moves: 2, matchedPairs: 0, totalPairs: 6, status: 'playing',
      timeLeft: 60, turnTimeLeft: 0, elapsed: 5, summary: null, back: 'stars'
    } }) });

    vi.advanceTimersByTime(1000);
    expect(room.netTrouble.value, 'chưa tới hạn thì đừng vội báo').toBe('');
    vi.advanceTimersByTime(4000);
    expect(room.netTrouble.value, 'phải NÓI RA, không để người chơi ngồi nhìn màn hình chết')
      .not.toBe('');
    expect(FakeWS.opened, 'và tự đồng bộ lại').toBeGreaterThan(soLanMo);
  });
});

describe('mất mạng: bàn phải khoá và nói ra', () => {
  it('mất kết nối thì flip() không gửi gì — bấm vào hư không là tưởng game hỏng', async () => {
    const ws = await enterRoom();
    ws.readyState = 3;                       // socket chết
    const truoc = ws.flips.length;
    room.flip(4);
    expect(ws.flips.length).toBe(truoc);
    expect(room.netTrouble.value).not.toBe('');
  });

  it('đối thủ mất kết nối thì view báo `connected: false` để UI giải thích', async () => {
    const ws = await enterRoom();
    ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: {
      cols: 4, rows: 3,
      cards: Array.from({ length: 12 }, (_, index) => ({ index, state: 'down' })),
      players: [
        { id: 'p1', name: 'Kiên', connected: true, forfeited: false },
        { id: 'p2', name: 'kkkk', connected: false, forfeited: false }
      ],
      currentId: 'p2', moves: 0, matchedPairs: 0, totalPairs: 6, status: 'playing',
      timeLeft: null, turnTimeLeft: 8, elapsed: 1, summary: null, back: 'stars'
    } }) });
    const kia = room.view.value!.players.find((p) => p.id !== room.myId.value)!;
    expect(kia.connected, 'UI dựa vào cờ này để hiện "đang chờ đối thủ"').toBe(false);
  });
});
