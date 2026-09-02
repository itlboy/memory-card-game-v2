import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { effectScope, nextTick, type EffectScope } from 'vue';
import OnlineGame from '@/components/OnlineGame.vue';
import { useOnlineRoom } from '@/composables/useOnlineRoom';

class FakeWS {
  static last: FakeWS | null = null;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.last = this; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(d: string): void {
    this.sent.push(d);
    if ((JSON.parse(d) as { t: string }).t === 'ping') {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ t: 'pong' }) }));
    }
  }
  close(): void { this.readyState = 3; }
}

let scope: EffectScope;
let o: ReturnType<typeof useOnlineRoom>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', Object.assign(FakeWS, { OPEN: 1, CONNECTING: 0, CLOSED: 3 }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exists: true }))));
  scope = effectScope();
  scope.run(() => { o = useOnlineRoom(); });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function view(winnerId: string) {
  return {
    cols: 2, rows: 2, n: 4, o: [],
    players: [
      { id: 'p1', name: 'Kiên', avatar: '🦊', score: 10, pairs: 1, connected: true, forfeited: false },
      { id: 'p2', name: 'Mai', avatar: '🐼', score: 30, pairs: 3, connected: true, forfeited: false }
    ],
    currentId: 'p1', moves: 4, matchedPairs: 2, totalPairs: 2, status: 'ended',
    timeLeft: null, turnTimeLeft: null, peekLeft: null, elapsed: 20, back: 'stars',
    summary: {
      status: 'ended',
      ranking: [
        { id: winnerId, name: winnerId === 'p1' ? 'Kiên' : 'Mai', score: 30, pairs: 3 },
        { id: winnerId === 'p1' ? 'p2' : 'p1', name: 'x', score: 10, pairs: 1 }
      ]
    }
  };
}

async function vaoVanRoiKetThuc(winnerId: string) {
  await o.join('ABCDEF', 'Kiên');
  const ws = FakeWS.last!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({
    t: 'welcome', playerId: 'p1', token: 'tok',
    room: { code: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], config: {} }
  }) });
  const w = mount(OnlineGame, { props: { o }, global: { stubs: { Teleport: true } } });
  ws.onmessage?.({ data: JSON.stringify({ t: 'state', view: view(winnerId) }) });
  await nextTick(); await nextTick();
  return w;
}

describe('kết ván online trên DOM thật', () => {
  it('THẮNG: pháo hoa, không có tro; bảng hiện ở 2,2 giây', async () => {
    const w = await vaoVanRoiKetThuc('p1');
    // Một component cho ba kết cục, phân biệt bằng `data-loai`.
    expect(w.find('.ketcuc-fx[data-loai="thang"]').exists(), 'thắng phải có màn ăn mừng').toBe(true);
    expect(w.find('.ketcuc-fx[data-loai="thua"]').exists(), 'thắng mà hiện màn thua').toBe(false);
    expect(w.findAll('.ketcuc-fx .fx-tan').length, 'thắng mà có tro rơi').toBe(0);

    // Bảng tỉ số: chưa có ở 2,1s, có ở 2,3s. Mốc cũ là 5 giây — năm giây nhìn
    // một bàn đứng im là lâu thật, mà pháo hoa vẫn chạy tiếp phía sau bảng.
    const bang = (): boolean => w.findComponent({ name: 'ResultDialog' }).exists();
    vi.advanceTimersByTime(2100); await nextTick(); await nextTick();
    expect(bang(), 'hiện sớm quá thì cướp mất khoảnh khắc ăn mừng').toBe(false);
    vi.advanceTimersByTime(300); await nextTick(); await nextTick();
    expect(bang(), 'quá 2,4 giây mà bảng tỉ số chưa hiện').toBe(true);
  });

  it('THUA: tro rơi và nền tối, KHÔNG có pháo hoa; bảng hiện sớm hơn bên thắng', async () => {
    const w = await vaoVanRoiKetThuc('p2');
    vi.advanceTimersByTime(1200); await nextTick(); await nextTick();
    expect(w.findComponent({ name: 'ResultDialog' }).exists(),
      'người thua không có gì để xem, đừng bắt chờ lâu bằng người thắng').toBe(true);
    expect(w.find('.ketcuc-fx[data-loai="thua"]').exists(), 'thua phải có màn riêng').toBe(true);
    expect(w.find('.ketcuc-fx[data-loai="thang"]').exists(), 'thua mà bắn pháo hoa').toBe(false);
    expect(w.findAll('.ketcuc-fx .fx-giay').length, 'confetti lọt vào màn thua').toBe(0);
    // Bốn hình thua đều có tro; hai lớp nền thì mọi hình thua đều mang.
    expect(w.findAll('.ketcuc-fx .fx-tan').length, 'phải có hạt tro').toBeGreaterThan(10);
    expect(w.find('.ketcuc-fx .fx-toi').exists(), 'phải có lớp tối dần').toBe(true);
    expect(
      w.find('.ketcuc-fx .fx-xam').exists() || w.find('.ketcuc-fx .fx-nhoe').exists(),
      'phải có lớp rút màu — thứ làm hình thua đọc ra ngay'
    ).toBe(true);
  });
});
