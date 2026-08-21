import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';

/** Truy cập engine bên trong App để chơi tất định. */
type Session = {
  game: { value: { cards: { index: number; pairId: number }[]; totalPairs: number } | null };
};
const session = (w: VueWrapper): Session => (w.vm as unknown as { session: Session }).session;

const THEMES = {
  themes: [{ id: 'animals', name: 'Động vật', unlockAt: 0,
    symbols: Array.from({ length: 24 }, (_, i) => `S${i}`) }]
};

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i++) { await nextTick(); await Promise.resolve(); }
}

let wrapper: VueWrapper;

beforeEach(() => {
  localStorage.clear();
  // Phải giả cả performance (đồng hồ của engine) và rAF (vòng tick của session)
  vi.useFakeTimers({ toFake: [
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date',
    'performance', 'requestAnimationFrame', 'cancelAnimationFrame'
  ] });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(THEMES))));
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0;
    createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => ({}), start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    get destination() { return {}; }
  });
});

afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mountApp(): Promise<void> {
  wrapper = mount(App, { attachTo: document.body });
  await flush();
  await vi.advanceTimersByTimeAsync(10);
  await flush();
}

async function pickMode(name: string): Promise<void> {
  await wrapper.findAll('.chip').find((c) => c.text().includes(name))!.trigger('click');
  await flush();
}

async function start(): Promise<void> {
  await wrapper.find('.btn-primary').trigger('click');
  await flush();
}

/** Ghép hết các cặp bằng cách đọc pairId từ engine. */
async function winGame(missFirst = false): Promise<void> {
  const cards = session(wrapper).game.value!.cards;
  const byPair = new Map<number, number[]>();
  for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.index]);
  const tiles = () => wrapper.findAll('.card');

  if (missFirst) {
    const [p0, p1] = [...byPair.values()];
    await tiles()[p0![0]!]!.trigger('click');
    await tiles()[p1![0]!]!.trigger('click');
    await vi.advanceTimersByTimeAsync(1100);   // chờ úp lại
    await flush();
  }
  for (const [a, b] of byPair.values() as Iterable<[number, number]>) {
    await tiles()[a]!.trigger('click');
    await tiles()[b]!.trigger('click');
    await flush();
  }
  await vi.advanceTimersByTimeAsync(50);
  await flush();
}

describe('luồng trọn ván', () => {
  it('thắng ván Cổ điển: hiện kết quả, lưu kỷ lục, mở thành tích không-lật-sai', async () => {
    await mountApp();
    await start();
    await winGame();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Kỷ lục mới');
    expect(wrapper.text()).toContain('Trí nhớ siêu phàm');   // misses = 0
    expect(localStorage.getItem('mm.v2')).toContain('"classic:4x4"');
  });

  it('ván có lật sai thì không được thành tích không-lật-sai', async () => {
    await mountApp();
    await start();
    await winGame(true);
    expect(wrapper.text()).toContain('Hoàn thành');
    expect(wrapper.text()).not.toContain('Trí nhớ siêu phàm');
  });

  it('thắng lại với điểm thấp hơn thì không báo kỷ lục mới', async () => {
    await mountApp();
    await start();
    await winGame();
    expect(wrapper.text()).toContain('Kỷ lục mới');
    await wrapper.find('[role="dialog"] .btn-primary').trigger('click');   // chơi lại
    await flush();
    await winGame(true);                                     // kém hơn: có 1 lượt sai
    expect(wrapper.text()).toContain('Hoàn thành');
    expect(wrapper.text()).not.toContain('Kỷ lục mới');
  });

  it('Đua thời gian: hết giờ thì hiện "Hết thời gian", không lưu kỷ lục', async () => {
    await mountApp();
    await pickMode('Đua thời gian');
    await start();
    await wrapper.findAll('.card')[0]!.trigger('click');     // khởi động đồng hồ
    await vi.advanceTimersByTimeAsync(71_000);               // giới hạn 4x4 là 70s
    await flush();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Hết thời gian');
    expect(localStorage.getItem('mm.v2') ?? '').not.toContain('"time:4x4"');
  });

  it('nút Về menu đóng kết quả và quay lại menu', async () => {
    await mountApp();
    await start();
    await winGame();
    await wrapper.findAll('[role="dialog"] .btn').find((b) => b.text() === 'Về menu')!.trigger('click');
    await flush();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Chế độ chơi');
  });

  it('thoát giữa ván bằng nút ✕ quay về menu, không hiện kết quả', async () => {
    await mountApp();
    await start();
    await wrapper.find('[aria-label="Thoát về menu"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Chế độ chơi');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('thắng màn 1 Chiến dịch: lưu sao, hiện nút "Màn tiếp theo", mở khoá màn 2', async () => {
    await mountApp();
    await pickMode('Chiến dịch');
    await wrapper.findAll('.node')[0]!.trigger('click');     // vào màn 1 (lưới 3×4)
    await flush();
    expect(wrapper.findAll('.card')).toHaveLength(12);
    await winGame();
    expect(wrapper.text()).toContain('Màn tiếp theo');
    expect(wrapper.text()).toMatch(/★/);
    await wrapper.find('[role="dialog"] .btn-primary').trigger('click');   // sang màn 2
    await flush();
    expect(wrapper.findAll('.card').length).toBeGreaterThan(0);
    expect(localStorage.getItem('mm.v2')).toContain('"campaign"');
  });

  it('Sinh tồn: HUD hiển thị mạng và mất dần khi lật sai', async () => {
    await mountApp();
    await pickMode('Sinh tồn');
    await start();
    expect(wrapper.text()).toContain('❤️❤️❤️❤️❤️');
    const cards = session(wrapper).game.value!.cards;
    const p0 = cards.filter((c) => c.pairId === cards[0]!.pairId)[0]!.index;
    const other = cards.find((c) => c.pairId !== cards[0]!.pairId)!.index;
    await wrapper.findAll('.card')[p0]!.trigger('click');
    await wrapper.findAll('.card')[other]!.trigger('click');
    await vi.advanceTimersByTimeAsync(1100);
    await flush();
    expect(wrapper.text()).toContain('❤️❤️❤️❤️');
    expect(wrapper.text()).not.toContain('❤️❤️❤️❤️❤️');
  });

  it('Chớp nhoáng: thẻ hé mở lúc đầu và không bấm được, sau 4 giây thì úp lại', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();
    expect(wrapper.text()).toContain('Ghi nhớ vị trí');
    expect(wrapper.findAll('.card.up, .card.peek').length).toBeGreaterThan(0);
    await wrapper.findAll('.card')[0]!.trigger('click');     // bị chặn khi đang hé mở
    await flush();
    expect(session(wrapper).game.value!.cards.length).toBe(16);
    await vi.advanceTimersByTimeAsync(4200);
    await flush();
    expect(wrapper.text()).not.toContain('Ghi nhớ vị trí');
  });
});

describe('điều hướng bàn phím (NF-07)', () => {
  it('mũi tên di chuyển focus theo lưới 4 cột', async () => {
    await mountApp();
    await start();
    const board = wrapper.find('[role="grid"]');
    const tiles = wrapper.findAll('.card');
    (tiles[0]!.element as HTMLElement).focus();
    await board.trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tiles[1]!.element);
    await board.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tiles[5]!.element);
    await board.trigger('keydown', { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tiles[4]!.element);
    await board.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tiles[0]!.element);
  });

  it('không đi ra ngoài biên lưới', async () => {
    await mountApp();
    await start();
    const board = wrapper.find('[role="grid"]');
    const tiles = wrapper.findAll('.card');
    (tiles[0]!.element as HTMLElement).focus();
    await board.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tiles[0]!.element);
    (tiles[15]!.element as HTMLElement).focus();
    await board.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tiles[15]!.element);
  });

  it('phím khác không bị chặn hành vi mặc định', async () => {
    await mountApp();
    await start();
    const board = wrapper.find('[role="grid"]');
    await board.trigger('keydown', { key: 'Tab' });   // không ném lỗi là đạt
  });
});
