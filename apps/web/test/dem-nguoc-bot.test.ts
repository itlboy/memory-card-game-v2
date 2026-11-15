import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { effectScope, type EffectScope } from 'vue';
import { BOT_SPECS, MAT_RONG_VANG } from '@mm/engine';
import { useOnlineRoom } from '@/composables/useOnlineRoom';
import { ngonNgu } from '@/lib/i18n';

/**
 * "BOT RỒNG THẦN ĐI TRƯỚC" (15.11.2026, chủ dự án báo): màn đếm ngược online in thẳng tên gốc
 * server gửi (chữ Việt, không dịch) và — ở ván đội — tên cả ĐỘI thay vì người lật đầu tiên.
 * Mọi câu báo tên phải đi qua `tenNguoi` (dịch tên bot theo ngôn ngữ).
 */
class FakeWS {
  static last: FakeWS | null = null;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.last = this; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(): void { /* bỏ qua */ }
  close(): void { this.readyState = 3; }
}

const bot = { id: 'bot', name: BOT_SPECS.divine.name, avatar: MAT_RONG_VANG, connected: true, ready: true, may: 'divine' };
const toi = { id: 'p1', name: 'Kiên', avatar: '🐼', connected: true, ready: true };
const gui = (m: unknown) => FakeWS.last!.onmessage?.({ data: JSON.stringify(m) });

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
  FakeWS.last!.open();
  gui({ t: 'welcome', playerId: 'p1', token: 'tok', spectator: false,
    room: { code: '123456', hostId: 'p1', status: 'lobby', players: [toi, bot], config: {} } });
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); ngonNgu.value = 'vi'; });

describe('đếm ngược với bot', () => {
  it('tên bot được dịch theo ngôn ngữ', () => {
    ngonNgu.value = 'en';
    gui({ t: 'countdown', endsInMs: 3000, firstId: 'bot', firstName: BOT_SPECS.divine.name });
    expect(room.countdown.value?.firstName).toBe('Divine Dragon');
  });

  it('ván đội: báo NGƯỜI lật đầu, không phải tên cả đội', () => {
    gui({ t: 'state', view: {
      cards: [], currentId: 'doi-1', nguoiLat: 'bot', status: 'countdown', cols: 2, rows: 2, totalPairs: 2,
      players: [{ id: 'doi-1', name: 'Kiên & Bot rồng thần', avatar: '🐼', thanhVien: ['p1', 'bot'], score: 0, connected: true }]
    } });
    gui({ t: 'countdown', endsInMs: 3000, firstId: 'doi-1', firstName: 'Kiên & Bot rồng thần' });
    expect(room.countdown.value?.firstId).toBe('bot');
    expect(room.countdown.value?.firstName).toBe('Bot rồng thần');
  });
});

/*
 * CANH CHUNG: mọi câu báo có TÊN người chơi ở ván online phải dịch được tên bot. Thêm câu báo mới
 * mà quên `tenHien`/`tenNguoi` thì test dưới (bot nói/thả emoji/mất mạng bằng tiếng Anh) hoặc
 * phép quét mã nguồn cuối file sẽ đỏ.
 */
describe('mọi câu báo tên bot đều dịch', () => {
  beforeEach(() => { ngonNgu.value = 'en'; });

  it('bot thả emoji', () => {
    gui({ t: 'emoji', from: 'bot', emoji: '👍' });
    expect(room.emojiBong.value.at(-1)?.name).toBe('Divine Dragon');
  });

  it('bot nói câu nhanh', () => {
    gui({ t: 'say', from: 'bot', id: 'gg' });
    expect(room.loiNoi.value.at(-1)?.name).toBe('Divine Dragon');
  });

  it('bot mất mạng', () => {
    gui({ t: 'events', events: [{ type: 'life-lost', playerId: 'bot', livesLeft: 1 }], view: {
      cards: [], currentId: 'p1', status: 'playing', cols: 2, rows: 2, totalPairs: 2,
      players: [{ ...toi, score: 0 }, { ...bot, score: 0 }]
    } });
    expect(room.lifeLost.value?.name).toBe('Divine Dragon');
  });
});

describe('quét mã nguồn: không in thẳng tên/mặt người chơi', () => {
  const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src', f), 'utf8');

  it.each(['composables/useOnlineRoom.ts', 'composables/useGameSession.ts'])('%s: câu báo không gán `.name` thô', (f) => {
    const src = doc(f);
    // `name: who?.name ?? ''`, `name: p.name`, `frozen: find(x)?.name ?? null` — tên bot sẽ ra chữ gốc tiếng Việt
    const sai = src.split('\n')
      .filter((l) => /\b(name|frozen):[^,]*\.name\b(?!\])/.test(l) && !l.includes('URLSearchParams'));   // tham số URL, không phải chữ hiện
    expect(sai, `${f}: gán tên hiển thị từ .name — dùng tenHien/tenNguoi`).toEqual([]);
  });

  it.each(['OnlineGame.vue', 'OnlineScreen.vue', 'TeamStrip.vue', 'ChonDoi.vue', 'PlayerStrip.vue', 'GameScreen.vue'])('%s: template không in tên người chơi thô', (f) => {
    const src = doc(`components/${f}`);
    expect(src, `${f}: {{ p.name }} — dùng tenNguoi(p)`).not.toMatch(/\{\{\s*(p|m|ai|dangDi|nguoi|player|r)\.name\s*\}\}/);
    expect(src, `${f}: { ten: p.name } — dùng tenNguoi(p)`).not.toMatch(/ten: (p|m|ai|dangDi|nguoi|player|r|khac\[0\]!?)\.name\b/);
  });
});

