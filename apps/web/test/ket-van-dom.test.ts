import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { effectScope, nextTick, type EffectScope } from 'vue';
import OnlineGame from '@/components/OnlineGame.vue';
import { HIEN_BANG_MS } from '@/lib/ketcuc-fx';
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
  it('THẮNG: cảnh chiến thắng, bảng hiện đúng mốc của cảnh', async () => {
    const w = await vaoVanRoiKetThuc('p1');
    expect(w.find('.ketcuc-fx[data-canh="thang"]').exists(), 'thắng phải có cảnh ăn mừng').toBe(true);
    expect(w.find('.ketcuc-fx .fx-thang').exists()).toBe(true);
    expect(w.find('.ketcuc-fx .fx-thua').exists(), 'thắng mà hiện chữ thua').toBe(false);
    const bang = (): boolean => w.findComponent({ name: 'ResultDialog' }).exists();
    vi.advanceTimersByTime(HIEN_BANG_MS.thang - 100); await nextTick(); await nextTick();
    expect(bang(), 'hiện sớm quá thì cướp mất khoảnh khắc ăn mừng').toBe(false);
    vi.advanceTimersByTime(300); await nextTick(); await nextTick();
    expect(bang()).toBe(true);
  });

  it('THUA: cảnh thua (chữ THUA RỒI + dòng an ủi), KHÔNG có chữ thắng', async () => {
    const w = await vaoVanRoiKetThuc('p2');
    expect(w.find('.ketcuc-fx[data-canh="thua"]').exists(), 'thua phải có cảnh riêng').toBe(true);
    expect(w.find('.ketcuc-fx .fx-thua').exists()).toBe(true);
    expect(w.find('.ketcuc-fx .fx-an-ui').text()).toMatch(/Làm lại nhé/);
    expect(w.find('.ketcuc-fx .fx-thang').exists(), 'thua mà hiện CHIẾN THẮNG').toBe(false);
    vi.advanceTimersByTime(HIEN_BANG_MS.thua + 100); await nextTick(); await nextTick();
    expect(w.findComponent({ name: 'ResultDialog' }).exists()).toBe(true);
  });
});
