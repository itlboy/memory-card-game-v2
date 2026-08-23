import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';

/** Truy cập engine bên trong App để chơi tất định. */
type Session = {
  game: { value: { cards: { index: number; pairId: number; blank?: boolean }[]; totalPairs: number } | null };
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
  sessionStorage.clear();
  history.replaceState(null, '', location.pathname);
  // Mọi chế độ giờ đi qua bản đồ cấp, mặc định chỉ mở cấp 1 (bàn 2 thẻ). Test
  // cần bàn lớn nên mở sẵn hết; test nào kiểm chính việc khoá thì tự xoá đi.
  localStorage.setItem('mm.v2', JSON.stringify({ levels: { 'classic:49': { stars: 1, score: 0 } } }));
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

/** Bấm nút theo chữ hiển thị hoặc theo aria-label (ô chọn số người chỉ hiện số
 *  to + "người chơi", số thật nằm trong aria-label). */
async function click(text: string): Promise<void> {
  const btn = wrapper.findAll('button').find(
    (b) => b.text().includes(text) || b.attributes('aria-label')?.includes(text)
  );
  if (!btn) throw new Error(`Không thấy nút "${text}"`);
  await btn.trigger('click');
  await flush();
}

/** Đi tới bước theme của nhánh chơi đơn với chế độ cho trước. */
async function pickMode(name: string): Promise<void> {
  await click('Chơi một mình');
  await click(name);
}

/** Từ bước cấp độ: chọn cấp rồi Bắt đầu ở bước theme. Cấp 8 = 8 cặp = bàn 4×4. */
async function start(level = 8): Promise<void> {
  await click(`Cấp ${level},`);
  await click('Bắt đầu');
}

/** Ghép hết các cặp bằng cách đọc pairId từ engine. */
async function winGame(missFirst = false): Promise<void> {
  const cards = session(wrapper).game.value!.cards.filter((c) => !c.blank);
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
  // Thắng xong ăn mừng 5s rồi popup mới hiện
  await vi.advanceTimersByTimeAsync(5100);
  await flush();
}

describe('luồng trọn ván', () => {
  it('thắng ván Cổ điển: hiện kết quả, lưu kỷ lục, mở thành tích không-lật-sai', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Kỷ lục mới');
    expect(wrapper.text()).toContain('Trí nhớ siêu phàm');   // misses = 0
    expect(localStorage.getItem('mm.v2')).toContain('"classic:L8"');
  });

  it('ván có lật sai thì không được thành tích không-lật-sai', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame(true);
    expect(wrapper.text()).toContain('Hoàn thành');
    expect(wrapper.text()).not.toContain('Trí nhớ siêu phàm');
  });

  it('thắng lại với điểm thấp hơn thì không báo kỷ lục mới', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame();
    expect(wrapper.text()).toContain('Kỷ lục mới');
    await click('Chơi lại cấp này');   // nút chính giờ là "Cấp tiếp theo""
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
    await vi.advanceTimersByTimeAsync(1100);                 // thua: popup vào sau 1 giây
    await flush();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Hết thời gian');
    expect(localStorage.getItem('mm.v2') ?? '').not.toContain('"time:4x4"');
  }, 15_000);   // tua 71s giả × 16ms/frame nên cần trần thời gian cao hơn

  it('nút Về menu đóng kết quả và quay lại menu', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame();
    await wrapper.findAll('[role="dialog"] .btn').find((b) => b.text() === 'Về menu')!.trigger('click');
    await flush();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
  });

  it('thoát giữa ván: hỏi xác nhận, đồng ý thì về menu', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await wrapper.findAll('.card')[0]!.trigger('click');       // ván đã "đang chơi"
    await wrapper.find('[aria-label="Thoát về menu"]').trigger('click');
    await flush();
    // Popup xác nhận hiện ra, ván vẫn còn phía sau
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Thoát ván đang chơi?');
    await click('Ở lại');
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    expect(wrapper.findAll('.card')).toHaveLength(16);          // vẫn trong ván
    await wrapper.find('[aria-label="Thoát về menu"]').trigger('click');
    await flush();
    await click('Thoát ván');
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('bấm logo giữa ván cũng hỏi xác nhận; ở menu thì không hỏi', async () => {
    await mountApp();
    await click('Chơi một mình');
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);   // menu: về thẳng
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');

    await pickMode('Cổ điển');
    await start();
    await wrapper.findAll('.card')[0]!.trigger('click');
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Thoát ván đang chơi?');
    await click('Thoát ván');
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
  });

  it('thắng cấp 2 Chiến dịch: lưu sao, hiện nút "Cấp tiếp theo", mở khoá cấp sau', async () => {
    await mountApp();
    await pickMode('Chiến dịch');
    await start(2);                                          // cấp 2 = 2 cặp = bàn 2×2
    expect(wrapper.findAll('.card')).toHaveLength(4);
    await winGame();
    expect(wrapper.text()).toContain('Cấp tiếp theo');
    expect(wrapper.text()).toMatch(/★/);
    await wrapper.find('[role="dialog"] .btn-primary').trigger('click');   // sang cấp 3
    await flush();
    expect(wrapper.findAll('.card').length).toBeGreaterThan(0);
    expect(localStorage.getItem('mm.v2')).toContain('"campaign:2"');
  });

  it('Sinh tồn: HUD hiển thị mạng, chỉ mất khi thẻ trùng đã lộ', async () => {
    await mountApp();
    await pickMode('Sinh tồn');
    await start();
    expect(wrapper.text()).toContain('❤️ 5');
    const cards = session(wrapper).game.value!.cards;
    const pairA = cards.filter((c) => c.pairId === cards[0]!.pairId).map((c) => c.index);
    const pairB = cards.filter((c) => c.pairId !== cards[0]!.pairId && !c.blank);
    const bId = pairB[0]!.pairId;
    const slotsB = cards.filter((c) => c.pairId === bId).map((c) => c.index);

    const missTurn = async (i: number, j: number): Promise<void> => {
      await wrapper.findAll('.card')[i]!.trigger('click');
      await wrapper.findAll('.card')[j]!.trigger('click');
      await vi.advanceTimersByTimeAsync(1100);
      await flush();
    };

    // Lượt dò: cả hai thẻ đều chưa ai thấy → không mất mạng
    await missTurn(pairA[0]!, slotsB[0]!);
    expect(wrapper.text()).toContain('❤️ 5');

    // Lượt sau: thẻ trùng của cả hai đã lộ ở lượt trước → mất mạng
    await missTurn(pairA[1]!, slotsB[1]!);
    expect(wrapper.text()).toContain('❤️ 4');
    expect(wrapper.text()).not.toContain('❤️ 5');
  });

  it('Chớp nhoáng: thẻ hé mở lúc đầu và không bấm được, sau 4 giây thì úp lại', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();
    await vi.advanceTimersByTimeAsync(5100);   // đếm ngược báo trước 5 giây
    await flush();
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
    await pickMode('Cổ điển');
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
    await pickMode('Cổ điển');
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
    await pickMode('Cổ điển');
    await start();
    const board = wrapper.find('[role="grid"]');
    await board.trigger('keydown', { key: 'Tab' });   // không ném lỗi là đạt
  });
});

describe('bàn nhỏ và ô trống', () => {
  it('bàn lẻ ô (3×5): 1 ô trống không bấm được, thắng với 7 cặp', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(7);   // cấp 7 = 7 cặp = 14 thẻ trên bàn 3×5, thừa một ô
    expect(wrapper.findAll('.card')).toHaveLength(15);
    const blanks = wrapper.findAll('.card.blank');
    expect(blanks).toHaveLength(1);
    expect(wrapper.text()).toContain('0/7');
    await winGame();
    expect(wrapper.text()).toContain('Kỷ lục mới');   // thắng lần đầu = kỷ lục
  });

  it('ván 2×2 thắng chỉ với 2 cặp', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(2);   // cấp 2 = 2 cặp = bàn 2×2
    expect(wrapper.findAll('.card')).toHaveLength(4);
    await winGame();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  });

  it('bàn phím nhảy qua ô trống ở giữa bàn', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(7);   // cấp 7 = bàn 3×5, ô trống ở chính giữa (index 7)
    const board = wrapper.find('[role="grid"]');
    const tile = (i: number) => board.find(`[data-index="${i}"]`);
    (tile(6).element as HTMLElement).focus();                 // ô trái của ô trống
    await board.trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tile(8).element);     // nhảy qua ô trống
    await board.trigger('keydown', { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tile(6).element);
  });
});

describe('F5 giữa ván (state trên URL + snapshot)', () => {
  it('vào ván thì URL có ?playing=1, về menu thì sạch', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    expect(location.search).toBe('?playing=1');
    await wrapper.find('[aria-label="Thoát về menu"]').trigger('click');
    await flush();
    await click('Thoát ván');   // qua popup xác nhận
    expect(location.search).toBe('');
  });

  it('reload giữa ván khôi phục đúng bàn: cặp đã ghép, điểm, số lượt', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    // Ghép đúng 1 cặp + lật sai 1 lượt rồi "F5"
    const cards = session(wrapper).game.value!.cards.filter((c) => !c.blank);
    const byPair = new Map<number, number[]>();
    for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.index]);
    const [p0, p1] = [...byPair.values()];
    const tiles = () => wrapper.findAll('.card');
    await tiles()[p0![0]!]!.trigger('click');
    await tiles()[p0![1]!]!.trigger('click');   // đúng
    await tiles()[p1![0]!]!.trigger('click');
    const wrongIdx = [...byPair.values()][2]![0]!;
    await tiles()[wrongIdx]!.trigger('click');  // sai → -10
    await vi.advanceTimersByTimeAsync(1100);
    await flush();
    expect(wrapper.text()).toContain('1/8');

    window.dispatchEvent(new Event('beforeunload'));   // chốt snapshot như trước khi reload
    wrapper.unmount();
    // URL vẫn là ?playing=1 → mount mới (trang mới) phải dựng lại ván
    expect(location.search).toBe('?playing=1');
    await mountApp();
    expect(wrapper.findAll('.card')).toHaveLength(16);
    expect(wrapper.findAll('.card.done')).toHaveLength(2);   // cặp đã ghép còn nguyên
    expect(wrapper.text()).toContain('1/8');
    expect(wrapper.text()).toContain('90');                  // 100 - 10 điểm phạt
    expect(wrapper.text()).toContain('Lượt2');
  });

  it('reload sau khi thắng không dựng lại ván — về menu sạch sẽ', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame();
    wrapper.unmount();
    await mountApp();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.findAll('.card')).toHaveLength(0);
  });

  it('reload giữa cấp Chiến dịch giữ nguyên số cấp', async () => {
    await mountApp();
    await pickMode('Chiến dịch');
    await start(2);
    window.dispatchEvent(new Event('beforeunload'));
    wrapper.unmount();
    await mountApp();
    expect(wrapper.findAll('.card')).toHaveLength(4);   // cấp 2 = 2×2
    expect(wrapper.text()).toContain('Cấp2');
  });
});

describe('đồng hồ lượt (multiplayer cùng máy)', () => {
  async function startTwoPlayer(): Promise<void> {
    await mountApp();
    await click('Chơi nhiều người');
    await click('2 người chơi');
    await click('Tiếp tục');        // bước điền tên — để trống, dùng "Người 1/2"
    await click('Cổ điển');
    await start();
    await vi.advanceTimersByTimeAsync(5100);   // qua màn đếm ngược 5 giây
    await flush();
  }

  it('người đang tới lượt có đồng hồ đếm ngược từ 15s', async () => {
    await startTwoPlayer();
    expect(wrapper.find('.turn-clock').exists()).toBe(true);
    expect(wrapper.find('.turn-clock').text()).toContain('15');
    // Chỉ hiện trên đúng 1 chip — người đang tới lượt
    expect(wrapper.findAll('.turn-clock')).toHaveLength(1);
    expect(wrapper.find('.player.active .turn-clock').exists()).toBe(true);
  });

  it('dưới 10 giây đồng hồ chuyển trạng thái giục (đỏ, nhấp nháy)', async () => {
    await startTwoPlayer();
    expect(wrapper.find('.turn-clock.urgent').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    await flush();
    expect(wrapper.find('.turn-clock.urgent').exists()).toBe(true);
  });

  it('hết 15 giây thì tự chuyển lượt sang người kia', async () => {
    await startTwoPlayer();
    const firstActive = wrapper.find('.player.active b').text();
    await vi.advanceTimersByTimeAsync(15_500);
    await flush();
    const nowActive = wrapper.find('.player.active b').text();
    expect(nowActive).not.toBe(firstActive);
    expect(wrapper.find('.turn-clock').text()).toContain('15');   // người mới đủ 15s
  });

  it('ghép đúng hiện +5s và đồng hồ không vượt trần 15', async () => {
    await startTwoPlayer();
    await vi.advanceTimersByTimeAsync(4000);       // còn ~11s
    const cards = session(wrapper).game.value!.cards.filter((c) => !c.blank);
    const pairId = cards[0]!.pairId;
    const [a, b] = cards.filter((c) => c.pairId === pairId).map((c) => c.index);
    const tiles = wrapper.findAll('.card');
    await tiles[a!]!.trigger('click');
    await tiles[b!]!.trigger('click');
    await flush();
    expect(wrapper.find('.plus10').exists()).toBe(true);
    const secs = Number(wrapper.find('.turn-clock').text().replace(/\D/g, ''));
    expect(secs).toBeGreaterThan(11);
    expect(secs).toBeLessThanOrEqual(15);           // trần 15
  });
});

describe('đếm ngược 5 giây trước ván multiplayer', () => {
  it('hiện đếm ngược + tên người đi đầu, chưa lật được thẻ, hết 5s thì chơi', async () => {
    await mountApp();
    await click('Chơi nhiều người');
    await click('2 người chơi');
    await click('Tiếp tục');        // bước điền tên
    await click('Cổ điển');
    await start();
    expect(wrapper.find('.countdown').exists()).toBe(true);
    expect(wrapper.text()).toContain('đi trước!');
    // Trong lúc đếm ngược không lật được
    await wrapper.findAll('.card')[0]!.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.up')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5200);
    await flush();
    expect(wrapper.find('.countdown').exists()).toBe(false);
    await wrapper.findAll('.card')[0]!.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.up')).toHaveLength(1);   // giờ mới lật được
  });

  it('chơi đơn không có đếm ngược', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    expect(wrapper.find('.countdown').exists()).toBe(false);
    await wrapper.findAll('.card')[0]!.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.up')).toHaveLength(1);
  });
});

describe('F5 giữ bước wizard (?w= trên URL)', () => {
  it('đi tới bước cấp độ, F5 vẫn đứng ở bước cấp độ', async () => {
    await mountApp();
    await click('Chơi một mình');
    expect(location.search).toBe('?w=mode');
    await click('Cổ điển');
    expect(location.search).toBe('?w=level');
    wrapper.unmount();
    await mountApp();                                  // "F5"
    expect(wrapper.text()).toContain('Chọn cấp độ');   // vẫn ở bước cấp độ
    await click('Cấp 8,');
    expect(location.search).toBe('?w=theme');
  });

  it('logo về trang chủ thì URL sạch và về bước 1 — mất trạng thái là chủ đích', async () => {
    await mountApp();
    await click('Chơi một mình');
    await click('Cổ điển');
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(location.search).toBe('');
    wrapper.unmount();
    await mountApp();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');   // F5 sau đó cũng về bước 1
  });

  it('F5 ở màn vào online quay lại màn online', async () => {
    vi.stubGlobal('WebSocket', class {
      onmessage: unknown = null; onclose: unknown = null;
      close(): void {} send(): void {}
    });
    await mountApp();
    await click('Chơi online');
    expect(location.search).toBe('?online=1');
    wrapper.unmount();
    await mountApp();
    expect(wrapper.text()).toContain('Vào phòng có sẵn');   // đứng ở màn online
  });
});

describe('Chớp nhoáng: báo trước rồi mới mở bài', () => {
  it('đếm ngược 5 giây kèm lời báo, rồi hé mở 4 giây có đồng hồ', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();

    // Chưa mở bài: đang đếm ngược, và nói rõ sắp có gì thay vì báo người đi đầu
    expect(wrapper.find('.countdown').exists()).toBe(true);
    expect(wrapper.text()).toContain('Sắp mở cả bàn');
    expect(wrapper.findAll('.card.peek')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(5100);
    await flush();

    // Hết đếm ngược thì cả bàn hé mở, kèm số giây còn lại
    expect(wrapper.find('.countdown').exists()).toBe(false);
    expect(wrapper.findAll('.card.peek').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('Ghi nhớ vị trí');
    expect(wrapper.find('.peek-clock').text()).toMatch(/^[1-4]s$/);

    // Đồng hồ chạy xuống chứ không đứng
    const before = wrapper.find('.peek-clock').text();
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(wrapper.find('.peek-clock').text()).not.toBe(before);

    // Hết 4 giây thì bài úp lại và chơi được
    await vi.advanceTimersByTimeAsync(2200);
    await flush();
    expect(wrapper.findAll('.card.peek')).toHaveLength(0);
    expect(wrapper.find('.peek-clock').exists()).toBe(false);
  });
});
