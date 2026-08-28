import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';
import { BOARD_SIZES, ROOM_LIMITS, levelSpec } from '@mm/engine';
import { sfx } from '@/lib/audio';

/** Truy cập engine bên trong App để chơi tất định. */
type Session = {
  game: { value: { cards: { index: number; pairId: number; blank?: boolean; power?: string }[]; totalPairs: number } | null };
};
const session = (w: VueWrapper): Session => (w.vm as unknown as { session: Session }).session;

const THEMES = {
  themes: [{ id: 'animals', name: 'Động vật', unlockAt: 0,
    // 50 biểu tượng = đủ cho cỡ lớn nhất (bàn 10×10 = 50 cặp); bộ 24 cũ làm
    // hai cỡ cuối bị khoá "thiếu biểu tượng" và mọi chốt "mọi cỡ đều mở" đỏ.
    symbols: Array.from({ length: 50 }, (_, i) => `S${i}`) }]
};

/**
 * Chờ hết màn đếm ngược vào ván. ĐỌC TỪ HẰNG SỐ, không viết số cứng: đổi
 * countdownMs (5s → 3s) là cả loạt test đỏ vì phần dư của cú advance bị tính
 * vào đồng hồ lượt / đồng hồ hé mở (đã đỏ đúng như thế, 3 test).
 */
async function passCountdown(): Promise<void> {
  await vi.advanceTimersByTimeAsync(ROOM_LIMITS.countdownMs + 100);
  await flush();
}

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
  /*
   * Mặc định của TEST là bàn trơn: chơi nhanh, TẮT thẻ đặc biệt.
   *
   * Vì sao tắt: rất nhiều test đọc trước danh sách thẻ rồi bấm theo chỉ số. Thẻ
   * Tráo đổi làm hai thẻ đổi chỗ giữa chừng nên danh sách đó thành sai và ván
   * không bao giờ kết thúc — đỏ thất thường theo seed. Test nào cần thẻ đặc
   * biệt thì bật rõ ràng (xem `pickMode('Sinh tồn')`).
   *
   * Chỉ `pickMode('Chiến dịch')` mới đặt về null — không đặt lại ở đây thì test
   * sau thừa hưởng nhánh của test trước.
   */
  luatDangCho = { ...TAT_HET };
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
/*
 * KHÔNG CÒN BƯỚC CHỌN CHẾ ĐỘ. Bốn chế độ cũ giờ là các mức trong bảng tuỳ chọn
 * ở cuối wizard, nên `pickMode('Sinh tồn')` chỉ GHI NHỚ luật cần bật, còn
 * `start()` mới thật sự bấm chúng. Giữ nguyên chữ ký cũ để mọi test đang nói
 * bằng tên chế độ vẫn đọc được — cái chúng kiểm là luật, không phải cái tên.
 */
const TAT_HET = {
  'Thời gian': 'Vô hạn', 'Số mạng': 'Vô hạn', 'Xem trước': 'Không',
  'Xáo thẻ': 'Không', 'Thẻ đặc biệt': 'Không'
} as const;
// Khai đủ CẢ NĂM hàng ở mỗi bộ, không dựa vào mặc định: mặc định là thứ có thể
// đổi (đã đổi một lần, từ "chỉ đồng hồ" sang "cả năm luật ở mức 1") và test bám
// vào nó thì hàng loạt ván đổi luật giữa chừng mà không ai sửa test có chủ đích.
const LUAT_CUA_CHE_DO: Record<string, Record<string, string>> = {
  'Cổ điển':        { ...TAT_HET },
  'Đua thời gian':  { ...TAT_HET, 'Thời gian': 'Vừa' },
  'Sinh tồn':       { ...TAT_HET, 'Số mạng': 'Vừa', 'Thẻ đặc biệt': 'Vừa' },
  'Chớp nhoáng':    { ...TAT_HET, 'Xem trước': 'Vừa' }
};
let luatDangCho: Record<string, string> | null = null;

async function pickMode(name: string): Promise<void> {
  if (name === 'Chiến dịch') { luatDangCho = null; await click('Chiến dịch'); return; }
  luatDangCho = LUAT_CUA_CHE_DO[name] ?? {};
  await click('Chơi nhanh');
}

/** Qua nốt bước theme rồi bảng tuỳ chọn. Chiến dịch không có bảng tuỳ chọn nên
 *  bước theme của nó đã là nút "Bắt đầu cấp N" luôn. */
async function xongTuyChon(): Promise<void> {
  const tiep = wrapper.findAll('button').find((b) => b.text() === 'Tiếp');
  if (tiep) { await tiep.trigger('click'); await flush(); }
  // Tắt sạch năm luật: mặc định nay bật cả năm ở mức 1, mà những test dùng hàm
  // này chỉ muốn một bàn trơn để lật cho hết (có mạng thì bot làm thua ván, có
  // xem trước thì bàn còn đang khoá).
  if (wrapper.find('.opt-row').exists()) {
    for (const [hang, muc] of Object.entries(TAT_HET)) await chonMuc(hang, muc);
  }
  await click('Bắt đầu');
}

/** Bấm một mức trong bảng tuỳ chọn, tra theo TÊN HÀNG để không phụ thuộc thứ tự. */
async function chonMuc(hang: string, muc: string): Promise<void> {
  const row = wrapper.findAll('.opt-row').find((r) => r.find('.opt-name').text() === hang);
  if (!row) throw new Error(`Không thấy hàng tuỳ chọn "${hang}"`);
  const btn = row.findAll('.seg-btn').find((b) => b.text() === muc);
  if (!btn) throw new Error(`Hàng "${hang}" không có mức "${muc}"`);
  await btn.trigger('click');
  await flush();
}

/** Chọn bàn ở bước đầu. Chiến dịch vẫn là bản đồ cấp; các chế độ khác nay chọn
 *  SỐ THẺ nên nhãn là "16 thẻ". */
/** Cấp đại diện của cỡ bàn mà `level` rơi vào — khoá lưu kỷ lục ngoài Chiến
 *  dịch dùng số này, một khoá cho mỗi cỡ bàn. */
const banDe = (level: number): number =>
  BOARD_SIZES.find((b) => b.pairs === levelSpec(level).pairs)!.level;

async function chonBan(level: number): Promise<void> {
  if (luatDangCho === null) { await click(`Cấp ${level},`); return; }
  await click(`${levelSpec(level).pairs * 2} thẻ`);
}

/** Từ bước chọn bàn: chọn bàn, qua theme, đặt luật rồi Bắt đầu. Cấp 8 = bàn 4×4. */
async function start(level = 8): Promise<void> {
  await chonBan(level);
  if (luatDangCho === null) { await click('Bắt đầu'); return; }   // Chiến dịch: vào thẳng
  await click('Tiếp');                                            // xong bước theme
  for (const [hang, muc] of Object.entries(luatDangCho)) await chonMuc(hang, muc);
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
  // Thắng xong ăn mừng 5s rồi popup mới hiện. KHÔNG dùng passCountdown() ở đây:
  // đây là màn ăn mừng (App.vue: resultTimer 5000ms), không phải đếm ngược vào
  // ván — hai con số khác nhau và không liên quan gì nhau.
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
    expect(localStorage.getItem('mm.v2')).toContain(`"classic:L${banDe(8)}"`);
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
    await vi.advanceTimersByTimeAsync(76_000);               // giới hạn 4×4 mức Vừa là 75s
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
    await click('Chơi nhanh');
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

  it('thắng cấp 1 Chiến dịch: lưu sao, hiện nút "Cấp tiếp theo", mở khoá cấp sau', async () => {
    await mountApp();
    await pickMode('Chiến dịch');
    await start(1);                                          // cấp 1 = 2 cặp = bàn 2×2
    expect(wrapper.findAll('.card')).toHaveLength(4);
    await winGame();
    expect(wrapper.text()).toContain('Cấp tiếp theo');
    expect(wrapper.text()).toMatch(/★/);
    await wrapper.find('[role="dialog"] .btn-primary').trigger('click');   // sang cấp 3
    await flush();
    expect(wrapper.findAll('.card').length).toBeGreaterThan(0);
    expect(localStorage.getItem('mm.v2')).toContain('"campaign:1"');
  });

  it('Sinh tồn: HUD hiển thị mạng, chỉ mất khi thẻ trùng đã lộ', async () => {
    await mountApp();
    await pickMode('Sinh tồn');
    await start();
    // 3 mạng chứ không phải 5: số mạng giờ neo theo cỡ bàn (bàn 16 thẻ, mức
    // "Vừa" = sống sót 60% số ván), không còn là hằng số của một chế độ.
    // Đọc qua aria-label vì HUD giờ vẽ icon gradient + số, không phải emoji.
    expect(wrapper.find('[aria-label="Mạng còn lại"]').text()).toBe('3');
    // Chỉ dùng cặp KHÔNG mang thẻ đặc biệt: bấm nhầm lá mắt thần là cả bàn lật
    // lên, lượt dò không còn tính là lật sai — seed là ngẫu nhiên nên test sẽ
    // đỏ thất thường (đã đỏ thật một lần).
    const cards = session(wrapper).game.value!.cards;
    const plain = new Map<number, number[]>();
    for (const c of cards) {
      if (c.blank || c.power) continue;
      plain.set(c.pairId, [...(plain.get(c.pairId) ?? []), c.index]);
    }
    const clean = [...plain.values()].filter((ix) => ix.length === 2);
    expect(clean.length, 'bàn phải còn ít nhất hai cặp thường').toBeGreaterThanOrEqual(2);
    const [pairA, slotsB] = clean as [number[], number[]];

    const missTurn = async (i: number, j: number): Promise<void> => {
      await wrapper.findAll('.card')[i]!.trigger('click');
      await wrapper.findAll('.card')[j]!.trigger('click');
      await vi.advanceTimersByTimeAsync(1100);
      await flush();
    };

    // Lượt dò: cả hai thẻ đều chưa ai thấy → không mất mạng
    await missTurn(pairA[0]!, slotsB[0]!);
    expect(wrapper.find('[aria-label="Mạng còn lại"]').text(), 'lượt dò không được mất mạng').toBe('3');

    // Lượt sau: thẻ trùng của cả hai đã lộ ở lượt trước → mất mạng
    await missTurn(pairA[1]!, slotsB[1]!);
    expect(wrapper.find('[aria-label="Mạng còn lại"]').text()).toBe('2');

  });

  it('Chớp nhoáng: thẻ hé mở lúc đầu và không bấm được, hết giờ nhìn thì úp lại', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();
    await passCountdown();
    expect(wrapper.text()).toContain('Ghi nhớ vị trí');
    expect(wrapper.findAll('.card.up, .card.peek').length).toBeGreaterThan(0);
    await wrapper.findAll('.card')[0]!.trigger('click');     // bị chặn khi đang hé mở
    await flush();
    expect(session(wrapper).game.value!.cards.length).toBe(16);
    // Thời gian nhìn giãn theo số thẻ (16 thẻ ≈ 6,2 giây) nên lấy từ engine
    await vi.advanceTimersByTimeAsync((session(wrapper).game.value!.config.peekMs ?? 0) + 300);
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

describe('bàn nhỏ và bàn đầy', () => {
  it('cấp 1 là bàn 2×2, thắng với 2 cặp', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(1);
    expect(wrapper.findAll('.card')).toHaveLength(4);
    expect(wrapper.findAll('.card.blank')).toHaveLength(0);
    await winGame();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  });

  it('bàn kín đúng cols×rows, không ô trống nào', async () => {
    // Engine đã kiểm cả 50 cấp (test/symmetry.test.ts); ở đây chỉ xác nhận UI
    // vẽ đúng số ô đó, không tự thêm ô trống nào.
    await mountApp();
    await pickMode('Cổ điển');
    await start(20);
    const g = session(wrapper).game.value!;
    expect(wrapper.findAll('.card')).toHaveLength(g.config.cols * g.config.rows);
    expect(wrapper.findAll('.card.blank')).toHaveLength(0);
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
    expect(wrapper.text()).toContain('100');   // không còn phạt −10 khi lật sai                  // 100 - 10 điểm phạt
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
    await start(1);
    window.dispatchEvent(new Event('beforeunload'));
    wrapper.unmount();
    await mountApp();
    expect(wrapper.findAll('.card')).toHaveLength(4);   // cấp 1 = 2×2
    expect(wrapper.text()).toContain('Cấp1');
  });
});

describe('đồng hồ lượt (multiplayer cùng máy)', () => {
  async function startTwoPlayer(): Promise<void> {
    await mountApp();
    await click('Chơi nhiều người');
    await click('2 người chơi');
    await click('Tiếp tục');        // bước điền tên — để trống, dùng "Người 1/2"
    await start();
    await passCountdown();
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
    await start();
    expect(wrapper.find('.countdown').exists()).toBe(true);
    expect(wrapper.text()).toContain('đi trước!');
    // Trong lúc đếm ngược không lật được
    await wrapper.findAll('.card')[0]!.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.up')).toHaveLength(0);
    await passCountdown();
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
    await click('Chơi nhanh');
    expect(location.search).toBe('?w=level');
    expect(location.search).toBe('?w=level');
    wrapper.unmount();
    await mountApp();                                  // "F5"
    expect(wrapper.text()).toContain('Chọn số thẻ');   // vẫn ở bước cấp độ
    await chonBan(8);
    expect(location.search).toBe('?w=theme');
  });

  it('logo về trang chủ thì URL sạch và về bước 1 — mất trạng thái là chủ đích', async () => {
    await mountApp();
    await click('Chơi nhanh');
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
    expect(wrapper.text()).toContain('Phòng đang chờ');   // đứng ở màn online
  });
});

describe('Chớp nhoáng: báo trước rồi mới mở bài', () => {
  it('đếm ngược 5 giây kèm lời báo, rồi hé mở có đồng hồ đếm xuống', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();

    // Chưa mở bài: đang đếm ngược, và nói rõ sắp có gì thay vì báo người đi đầu
    expect(wrapper.find('.countdown').exists()).toBe(true);
    expect(wrapper.text()).toContain('Sắp mở cả bàn');
    expect(wrapper.findAll('.card.peek')).toHaveLength(0);

    await passCountdown();

    // Hết đếm ngược thì cả bàn hé mở, kèm số giây còn lại
    expect(wrapper.find('.countdown').exists()).toBe(false);
    expect(wrapper.findAll('.card.peek').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('Ghi nhớ vị trí');
    // Bàn 16 thẻ được hơn 6 giây nhìn (2s + 16×0,26s)
    const peekMs = session(wrapper).game.value!.config.peekMs!;
    expect(peekMs).toBe(6000);
    expect(wrapper.find('.peek-clock').text()).toBe(`${Math.ceil(peekMs / 1000)}s`);

    // Đồng hồ chạy xuống chứ không đứng
    const before = wrapper.find('.peek-clock').text();
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(wrapper.find('.peek-clock').text()).not.toBe(before);

    // Hết giờ nhìn thì bài úp lại và chơi được
    await vi.advanceTimersByTimeAsync(peekMs);
    await flush();
    expect(wrapper.findAll('.card.peek')).toHaveLength(0);
    expect(wrapper.find('.peek-clock').exists()).toBe(false);
  });
});

describe('thẻ tráo đổi', () => {
  /**
   * Lộ ra hai thẻ không thành cặp (để chúng vào tập "đã thấy"), rồi lật thẻ mang
   * power tráo. Phải có bước lộ trước: thẻ tráo chỉ tráo thẻ ĐÃ TỪNG LỘ, nên lật
   * nó ngay nước đầu thì đúng theo luật là không tráo gì cả.
   */
  async function triggerSwap(): Promise<void> {
    const g = session(wrapper).game.value!;
    for (const c of g.cards) (c as { power?: string }).power = undefined;
    const tiles = () => wrapper.findAll('.card');
    const a = g.cards[0]!;
    const b = g.cards.find((c) => c.pairId !== a.pairId)!;
    await tiles()[a.index]!.trigger('click');
    await tiles()[b.index]!.trigger('click');
    await vi.advanceTimersByTimeAsync(1200);        // chờ hai thẻ úp lại
    await flush();

    const carrier = g.cards.find((c) => c.index !== a.index && c.index !== b.index)!;
    (g.cards[carrier.index] as { power?: string }).power = 'swap';
    await tiles()[carrier.index]!.trigger('click');
    await flush();
  }

  it('hai thẻ bay chéo qua nhau ngay, và bay TRÊN các thẻ khác', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(12);
    await triggerSwap();

    const flying = wrapper.findAll('.card.swapping');
    expect(flying).toHaveLength(2);
    // Mỗi thẻ mang độ lệch tới chỗ CŨ của nó; hai độ lệch phải ngược dấu nhau
    const offs = flying.map((c) => (c.attributes('style') ?? ''));
    for (const st of offs) expect(st).toMatch(/--sx:/);
    expect(offs[0]).not.toBe(offs[1]);
  });

  it('thông báo đợi thẻ đáp mới hiện — hiện ngay thì chữ che đúng hai thẻ đang bay', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(12);
    await triggerSwap();

    // Đang bay: chưa có chữ nào che bàn
    expect(wrapper.find('.toast').exists()).toBe(false);

    await vi.advanceTimersByTimeAsync(700);
    await flush();
    expect(wrapper.find('.toast').text()).toContain('Tráo đổi');
    expect(wrapper.findAll('.card.swapping')).toHaveLength(0);   // đã đáp
  });

  /*
   * Bom đã được BẬT LẠI. Nó từng bị tắt vì "đòn quá nặng", nhưng cái khó chịu
   * thật không phải bản thân hiệu ứng mà là chuyện bàn dồn nhiều thẻ cùng loại
   * — nay mỗi loại tối đa hai lần và chênh nhau không quá một, nên không có
   * bàn-toàn-bom nữa. Đổi lại phải canh: KHÔNG loại nào được quá hai lần.
   */
  it('không loại thẻ đặc biệt nào xuất hiện quá hai lần trong một bàn', async () => {
    await mountApp();
    await pickMode('Sinh tồn');       // luôn có thẻ đặc biệt
    await start(20);
    const g = session(wrapper).game.value!;
    const dem = new Map<string, number>();
    for (const c of g.cards) if (c.power) dem.set(c.power, (dem.get(c.power) ?? 0) + 1);
    expect([...dem.values()].length, 'bàn phải có thẻ đặc biệt').toBeGreaterThan(0);
    for (const [loai, n] of dem) expect(n, `${loai} xuất hiện ${n} lần`).toBeLessThanOrEqual(2);
  });
});

describe('phản hồi tức thì khi bấm thẻ (ván online)', () => {
  /**
   * Ván online là server-authoritative: bấm thẻ chỉ gửi `{t:'flip'}` rồi chờ
   * view về. Vòng đi-về đo trên bản thật là 69ms lúc thường nhưng có lúc vọt
   * 376ms, và trong suốt khoảng đó màn hình KHÔNG đổi gì — đó là cảm giác lag.
   *
   * Cách chữa: đánh dấu ô vừa bấm là `pending`, CardTile lật tới đúng 90 độ —
   * cạnh thẻ, chưa thấy mặt nào nên không bịa thông tin (NF-04 vẫn nguyên).
   */
  it('ô vừa bấm nhận class pending ngay, và mất khi server xác nhận', async () => {
    // Dựng trực tiếp trên CardTile: chạy cả phòng online trong unit test thì
    // phải giả WebSocket, mà thứ cần kiểm ở đây chỉ là trạng thái hiển thị.
    const { default: CardTile } = await import('@/components/CardTile.vue');
    const card = { index: 0, pairId: 1, symbol: '🦊' };

    const waiting = mount(CardTile, {
      props: { card, dealOrder: 0, faceUp: false, matched: false, wrong: false, peeking: false, disabled: false, pending: true }
    });
    expect(waiting.find('.card').classes()).toContain('pending');
    expect(waiting.find('.card').classes()).not.toContain('up');

    const confirmed = mount(CardTile, {
      props: { card, dealOrder: 0, faceUp: true, matched: false, wrong: false, peeking: false, disabled: false, pending: false }
    });
    expect(confirmed.find('.card').classes()).toContain('up');
    expect(confirmed.find('.card').classes()).not.toContain('pending');
  });

  it('thẻ đã ngửa thì pending không được ghi đè — 90 độ chỉ dành cho lúc chờ', async () => {
    const { default: CardTile } = await import('@/components/CardTile.vue');
    // Trạng thái chuyển tiếp: server đã xác nhận (faceUp) mà pending chưa dọn
    const w = mount(CardTile, {
      props: {
        card: { index: 0, pairId: 1, symbol: '🦊' }, dealOrder: 0,
        faceUp: true, matched: false, wrong: false, peeking: false, disabled: false, pending: true
      }
    });
    // CSS dùng `.pending:not(.up)`, nên có cả hai class thì .up thắng
    expect(w.find('.card').classes()).toContain('up');
  });
});

describe('thanh trên cùng không cắt tên game', () => {
  it('điểm sáu chữ số hiện gọn, không đẩy tên game ra ngoài', async () => {
    const { numShort } = await import('@/lib/format');
    // Dưới 10 nghìn giữ nguyên cho dễ đọc từng điểm
    expect(numShort(0)).toBe('0');
    expect(numShort(9_999)).toBe('9.999');
    // Từ 10 nghìn trở lên mới gọn — đây là mốc huy hiệu bắt đầu phình ra
    expect(numShort(90_000)).toBe('90k');
    expect(numShort(1_250_000)).toBe('1,3tr');
    // Chuỗi gọn phải NGẮN hơn hẳn chuỗi đầy đủ, không thì gọn làm gì
    expect(numShort(90_000).length).toBeLessThan((90_000).toLocaleString('vi-VN').length);
  });
});

describe('bảng kết quả nhiều người', () => {
  const summary = {
    status: 'won' as const, reason: 'cleared' as const, score: 0, moves: 20, seconds: 60,
    stars: 0, bestStreak: 0, timeBonus: 0, pairs: 0,
    ranking: [
      { id: 'a', name: 'Kiên', score: 740, pairs: 7, bestStreak: 4 },
      { id: 'b', name: 'An', score: 260, pairs: 3, bestStreak: 2 }
    ]
  };
  const base = {
    summary, isRecord: false, showStars: false, multiplayer: true,
    freshAchievements: [], hasNext: false, totalBefore: 0, totalAfter: 0
  };

  it('hiện đủ tên, điểm và dòng "cặp · chuỗi" của từng người', async () => {
    const { default: ResultDialog } = await import('@/components/ResultDialog.vue');
    const w = mount(ResultDialog, { props: base });
    expect(w.find('.ranking').html()).toContain('Kiên');
    expect(w.find('.ranking small').text()).toBe('7 cặp · chuỗi 4');
    // Hai hàng, hàng đầu là người thắng
    const rows = w.findAll('.ranking li');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('Kiên');
    expect(rows[0]!.find('b').text()).toBe('740');
  });

  /*
   * "Ai muốn chơi tiếp / ai đã đi" đọc ngay CẠNH TÊN trong bảng xếp hạng, không
   * còn là dòng thông báo dưới nút: bảng đã là chỗ mắt đang đọc tên từng người.
   * Tra theo ID, nên hai người trùng tên vẫn ra hai nhãn khác nhau.
   */
  it('ai đã bấm chơi tiếp thì nhãn nằm ngay cạnh TÊN người đó', async () => {
    const { default: ResultDialog } = await import('@/components/ResultDialog.vue');
    const w = mount(ResultDialog, { props: { ...base, rematchState: { b: 'in' } } });
    const rows = w.findAll('.ranking li');
    expect(rows[1]!.text()).toContain('An');
    expect(rows[1]!.find('.tag.in').text()).toContain('Chơi tiếp');
    // Người chưa bấm KHÔNG gắn nhãn — không thì cả bảng đầy nhãn, đọc không ra ai
    expect(rows[0]!.find('.tag').exists()).toBe(false);
  });

  it('ai đã thoát thì nhãn "Đã thoát" cạnh tên, không lẫn với "Chơi tiếp"', async () => {
    const { default: ResultDialog } = await import('@/components/ResultDialog.vue');
    const w = mount(ResultDialog, { props: { ...base, rematchState: { a: 'in', b: 'out' } } });
    const rows = w.findAll('.ranking li');
    expect(rows[0]!.find('.tag.in').text()).toContain('Chơi tiếp');
    expect(rows[1]!.find('.tag.out').text()).toContain('Đã thoát');
    expect(rows[1]!.find('.tag.in').exists()).toBe(false);
  });

  it('không còn dòng thông báo "đang chờ" / "muốn chơi lại" dưới nút', async () => {
    const { default: ResultDialog } = await import('@/components/ResultDialog.vue');
    const w = mount(ResultDialog, { props: { ...base, rematchState: { a: 'in' } } });
    expect(w.text()).not.toContain('muốn chơi lại');
    expect(w.text()).not.toContain('Chờ');
  });

  it('đối phương rời hẳn thì không còn nút chơi lại', async () => {
    const { default: ResultDialog } = await import('@/components/ResultDialog.vue');
    const w = mount(ResultDialog, { props: { ...base, rematchBlocked: true } });
    expect(w.text()).toContain('đã rời phòng');
    const labels = w.findAll('button').map((b) => b.text());
    expect(labels.some((t) => t.includes('Chơi lại'))).toBe(false);
  });
});

describe('không bao giờ để vùng chính trắng xoá', () => {
  it('screen báo đang chơi mà không có ván thì tự về menu', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start(8);
    expect(wrapper.findAll('.card').length).toBeGreaterThan(0);

    // Dựng đúng trạng thái bế tắc: đang ở màn chơi nhưng ván bị mất
    session(wrapper).game.value = null;
    await flush();
    await flush();

    const main = wrapper.find('main');
    expect(main.element.children.length, 'vùng chính KHÔNG được rỗng')
      .toBeGreaterThan(0);
    expect(main.text()).toContain('Bạn muốn chơi thế nào?');   // đã về menu
    expect(location.search).toBe('');                          // URL cũng lau sạch
  });
});

describe('vào online rồi về trang chủ', () => {
  it('không để lại trang trắng — lỗi từng phải F5 mới thoát', async () => {
    await mountApp();
    await click('Chơi online');
    await flush();
    expect(wrapper.text()).toContain('Chơi online');

    // Bấm logo về trang chủ
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    await flush();

    const main = wrapper.find('main');
    expect(main.element.children.length, 'vùng chính KHÔNG được rỗng').toBeGreaterThan(0);
    expect(main.text()).toContain('Bạn muốn chơi thế nào?');
  });
});

describe('đấu với máy', () => {
  /** Vào ván đấu máy ở mức cho trước. */
  /** Tắt bot để tự ghép hết bàn: hai test điểm bên dưới kiểm LUẬT CỘNG ĐIỂM,
   *  nếu để bot cùng lật thì nó chen vào giữa hai cú bấm của một cặp và ván
   *  không bao giờ xong — test đỏ thất thường. Việc bot tự đi có test riêng. */
  async function muteBot(): Promise<void> {
    (wrapper.vm as unknown as { session: { setBot: (l: null) => void } }).session.setBot(null);
    // Bot vừa lật sai thì bàn đang KHOÁ chờ úp lại; bấm tiếp trong lúc đó là
    // engine bỏ nước, ghép hết bàn thành ghép được 0 cặp.
    await vi.advanceTimersByTimeAsync(1300);
    await flush();
  }

  async function startVsBot(level: string): Promise<void> {
    await click('Đấu với máy');
    await click(level);
    await start(4);   // 4 cặp — đủ ngắn để máy chơi xong trong test
  }

  it('ô đấu máy nằm ngay sau Chiến dịch và Chơi nhanh ở bước đầu', async () => {
    await mountApp();
    const tiles = wrapper.findAll('.step-body .option');
    expect(tiles[0]!.text()).toContain('Chiến dịch');
    expect(tiles[1]!.text()).toContain('Chơi nhanh');
    expect(tiles[2]!.text()).toContain('Đấu với máy');
  });

  it('ván đấu máy có đúng hai người: người chơi và máy', async () => {
    await mountApp();
    await startVsBot('Bot Pro');
    const names = wrapper.findAll('.card').length > 0
      ? (wrapper.vm as unknown as { session: { players: { value: { id: string }[] } } }).session.players.value
      : [];
    expect(names.map((p) => p.id).sort()).toEqual(['bot', 'p1']);
  });

  it('máy TỰ lật khi tới lượt nó — không cần người chơi bấm hộ', async () => {
    await mountApp();
    await startVsBot('Bot Pro');
    await passCountdown();
    const s = (wrapper.vm as unknown as {
      session: { moves: { value: number }; current: { value: { id: string } | null } }
    }).session;
    // Máy đi trước thì nó phải tự đi; người đi trước thì lật hộ một nước cho tới lượt máy
    if (s.current.value?.id !== 'bot') {
      // Phải là hai lá LỆCH nhau: bấm hai lá bất kỳ có lúc trúng đúng một cặp,
      // ghép đúng thì người chơi GIỮ lượt, bot không bao giờ được đi và test đỏ
      // ngẫu nhiên (đã đỏ thật, ~1/15 bàn).
      const cards = session(wrapper).game.value!.cards.filter((c) => !c.blank);
      const a = cards[0]!;
      const b = cards.find((c) => c.pairId !== a.pairId)!;
      await wrapper.findAll('.card')[a.index]!.trigger('click');
      await wrapper.findAll('.card')[b.index]!.trigger('click');
      await vi.advanceTimersByTimeAsync(1200);
      await flush();
      expect(s.current.value?.id, 'lật lệch thì lượt phải sang máy').toBe('bot');
    }
    const before = s.moves.value;
    // Nhịp nghĩ là một KHOẢNG (Bot Pro tới 3,5s mỗi nước), nên phải chờ dư cho
    // hai nước lật, không thì test đỏ đúng lúc bot rút phải nhịp chậm.
    await vi.advanceTimersByTimeAsync(12_000);
    await flush();
    expect(s.moves.value, 'máy phải tự đi được ít nhất một nước').toBeGreaterThan(before);
  });

  it('mức Ngu KHÔNG cộng điểm tích luỹ — cày máy dễ không mở được theme', async () => {
    await mountApp();
    await startVsBot('Bot dễ');
    await passCountdown();
    const before = Number(JSON.parse(localStorage.getItem('mm.v2') ?? '{}').totalScore ?? 0);
    await muteBot();
    await winGame();
    const after = Number(JSON.parse(localStorage.getItem('mm.v2') ?? '{}').totalScore ?? 0);
    expect(wrapper.text(), 'ván phải thật sự kết thúc, nếu không phép so điểm vô nghĩa')
      .toContain('Chơi lại');
    expect(after).toBe(before);
  });

  it('mức Pro cộng ĐÚNG điểm của người, không cộng điểm của bot', async () => {
    await mountApp();
    await startVsBot('Bot Pro');
    await passCountdown();
    await muteBot();
    const before = Number(JSON.parse(localStorage.getItem('mm.v2') ?? '{}').totalScore ?? 0);
    await winGame();
    const s = (wrapper.vm as unknown as {
      session: { summary: { value: { ranking: { id: string; score: number }[] } | null } }
    }).session.summary.value!;
    // Ai đi trước là ngẫu nhiên theo seed, nên điểm người có thể là 0 — điều
    // phải đúng là phần CỘNG VÀO khớp điểm người, và không bao giờ là điểm bot.
    const mine = s.ranking.find((r) => r.id !== 'bot')!.score;
    const after = Number(JSON.parse(localStorage.getItem('mm.v2') ?? '{}').totalScore ?? 0);
    expect(after - before).toBe(mine);
  });
});

describe('lượt của bot thì người chơi bị chặn', () => {
  it('bấm thẻ trong lượt máy KHÔNG tính — nếu tính thì người tự mở thẻ cho máy ăn', async () => {
    await mountApp();
    await click('Đấu với máy');
    await click('Bot siêu đẳng');
    await chonBan(8);
    await xongTuyChon();
    await passCountdown();

    // ĐẶT lượt về máy thay vì chơi cho tới lượt máy: nhờ vào nhịp đi của bot là
    // test phụ thuộc thời gian, đổi tham số trí nhớ của bot là đỏ oan (đã đỏ
    // đúng như thế khi nửa đời ký ức tăng lên).
    //
    // Và ĐỌC THẲNG ENGINE, không qua computed: đặt turnIndex không kích `rev`
    // nên computed của Vue còn giữ giá trị cũ — cũng đã đỏ oan vì chuyện này.
    const g = session(wrapper).game.value! as unknown as {
      players: { id: string }[]; turnIndex: number; moves: number;
      current: { id: string };
    };
    g.turnIndex = g.players.findIndex((p) => p.id === 'bot');
    expect(g.current.id, 'phải đang là lượt máy mới kiểm được').toBe('bot');

    const before = g.moves;
    await wrapper.findAll('.card')[0]!.trigger('click');
    await wrapper.findAll('.card')[1]!.trigger('click');
    await flush();
    expect(g.moves, 'nước bấm trong lượt máy phải bị bỏ').toBe(before);
  });
});

describe('không lộ nội dung thẻ đang úp', () => {
  it('vào ván xong, thẻ úp KHÔNG chạy animation lật — keyframe lật-xuống mở ở mặt trước', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    // Qua hết cửa sổ chia bài rồi mới xét: lúc này lá úp phải "im", nếu có
    // class lắc thì nó bắt đầu ở rotateY(180deg) — mặt trước quay ra ngoài.
    await vi.advanceTimersByTimeAsync(1500);
    await flush();
    const down = wrapper.findAll('.card:not(.up):not(.done)');
    expect(down.length).toBeGreaterThan(0);
    for (const c of down) {
      expect(c.classes(), 'thẻ úp không được lắc khi chưa từng bị lật').not.toContain('wob-down');
    }
  });

  it('lật lên rồi úp lại thì MỚI lắc', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await vi.advanceTimersByTimeAsync(1500);
    await flush();
    const cards = session(wrapper).game.value!.cards.filter((c) => !c.blank);
    const tiles = () => wrapper.findAll('.card');
    await tiles()[cards[0]!.index]!.trigger('click');
    await flush();
    expect(tiles()[cards[0]!.index]!.classes()).toContain('wob-up');
  });
});

describe('mở khoá cấp sau', () => {

  it('THUA bot thì KHÔNG mở cấp — không thì cứ để bot siêu đẳng phá là mở hết', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await click('Đấu với máy');
    await click('Bot Pro');
    await chonBan(1);
    await xongTuyChon();
    await passCountdown();
    await muteBotOf(wrapper);
    // Bơm điểm cho bot để nó dẫn đầu lúc kết ván: mô phỏng đúng tình huống
    // "để bot phá bàn" mà không phải điều khiển được lượt của nó trong test.
    const g = session(wrapper).game.value! as unknown as { players: { id: string; score: number }[] };
    g.players.find((p) => p.id === 'bot')!.score = 99_999;
    await winGame();
    const champ = (wrapper.vm as unknown as {
      session: { summary: { value: { ranking: { id: string }[] } | null } }
    }).session.summary.value?.ranking[0];
    expect(champ?.id, 'bot phải dẫn đầu để phép kiểm có nghĩa').toBe('bot');
    expect(localStorage.getItem('mm.v2') ?? '', 'thua bot thì KHÔNG được mở cấp')
      .not.toContain('"classic:1"');
    // Nút "Cấp tiếp theo" vẫn bấm được: đấu bot MỞ SẴN hết cấp (thang cấp chỉ
    // dành cho chơi một mình). Điều phải đúng là THANG CẤP của chơi đơn không bị
    // ghi thêm — tức không thể để bot phá bàn rồi mở cấp cho chế độ một mình.
    const next = wrapper.findAll('[role="dialog"] button')
      .find((b) => b.text().includes('Cấp tiếp theo'));
    expect(next, 'nút cấp sau phải vẫn hiện').toBeTruthy();
    expect(next!.attributes('disabled'), 'đấu bot thì đi tiếp được, thắng hay thua').toBeUndefined();
    expect(wrapper.text()).toContain('Chơi lại');
  });

  it('THẮNG ván đấu máy thì mở cấp sau — không thì ai chỉ đấu bot sẽ mắc mãi ở cấp 1', async () => {
    localStorage.removeItem('mm.v2');   // bắt đầu sạch: chỉ cấp 1 được mở
    await mountApp();
    await click('Đấu với máy');
    await click('Bot Pro');
    await chonBan(1);
    await xongTuyChon();
    await passCountdown();
    await muteBotOf(wrapper);
    // Ép lượt về NGƯỜI trước khi ghép: ghép đúng thì giữ lượt, nên ai đang tới
    // lượt sẽ ăn trọn bàn. Bot đi trước là bot thắng và test kiểm sai thứ.
    forceHumanTurn(wrapper);
    await winGame();
    expect(localStorage.getItem('mm.v2')).toContain('"classic:1"');
    expect(wrapper.text(), 'thắng thì phải có nút sang cấp sau').toContain('Cấp tiếp theo');

    // Và thang cấp của CHƠI MỘT MÌNH cũng được mở theo (thắng bot là bằng chứng
    // đã chơi được cấp này)
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    await click('Chơi nhanh');
    // Thang cấp của chơi đơn không còn khoá gì (chọn thẳng số thẻ), nên thứ
    // phải đúng chỉ là TIẾN ĐỘ đã được ghi — kiểm ở dòng `classic:1` phía trên.
    expect(wrapper.findAll('.size-grid .option').length).toBe(BOARD_SIZES.length);
  });
});

/** Đưa lượt về người chơi (id 'p1'). */
function forceHumanTurn(w: VueWrapper): void {
  const g = (w.vm as unknown as {
    session: { game: { value: { players: { id: string }[]; turnIndex: number } | null } }
  }).session.game.value!;
  g.turnIndex = g.players.findIndex((p) => p.id !== 'bot');
}

/** Tắt bot rồi chờ hết khoá bàn — dùng lại ở nhiều describe. */
async function muteBotOf(w: VueWrapper): Promise<void> {
  (w.vm as unknown as { session: { setBot: (l: null) => void } }).session.setBot(null);
  await vi.advanceTimersByTimeAsync(1300);
  await flush();
}

describe('hover không được làm lộ bài', () => {
  it('nhịp lắc lúc hover nằm ở lớp NGOÀI, không ghi đè animation lật của .inner', () => {
    // Lộ bài xảy ra khi hover và animation lật ở CÙNG một phần tử: rời chuột
    // là `flip-down` chạy lại từ khung đầu — mà khung đầu là rotateY(180deg),
    // mặt trước quay ra ngoài (đo được -180° trên trình duyệt thật).
    const css = readFileSync(resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');
    const hoverRules = css.split('\n').filter((l) => l.includes(':hover') && l.includes('.inner'));
    for (const r of hoverRules) {
      expect(r, `rule hover không được đụng animation của .inner: ${r}`).not.toMatch(/animation/);
    }
    // Và nhịp lắc hover phải gắn vào .card qua class, không qua :hover
    expect(css).toContain('.card.wob-hover { animation: hover-wob');
  });
});

describe('nhịp lắc không được nháy', () => {
  it('không animation nào của thẻ gắn vào selector :hover — rời chuột là cắt giữa nhịp', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');
    // Lấy phần <style>
    const style = css.slice(css.indexOf('<style'));
    // Chỉ xét animation làm ĐỔI CHỖ/HÌNH của thẻ (trên .card hoặc .inner). Hiệu
    // ứng trang trí trên ::after (vệt sáng lướt) bị cắt cũng không sao: nó chạy
    // ra ngoài mép thẻ nên cắt giữa nhịp là biến mất, không nhảy về chỗ khác.
    for (const line of style.split('\n')) {
      if (!line.includes(':hover') || !/animation:\s*(?!none)/.test(line)) continue;
      const target = line.split('{')[0] ?? '';
      if (target.includes('::after') || target.includes('::before')) continue;
      throw new Error(`animation gắn vào :hover sẽ bị cắt giữa nhịp khi rời chuột: ${line.trim()}`);
    }
    // Nhịp hover phải do class JS gắn
    expect(style).toContain('.card.wob-hover { animation: hover-wob');
    // Và khai báo `deal` phải được TẮT sau khi chạy xong, không thì hết nhịp
    // hover là deal chạy lại từ đầu (đo được cú nhảy 29°).
    expect(style).toContain('.card.settled { animation: none; }');
  });
});

describe('đếm ngược vào ván', () => {
  it('dài đúng ROOM_LIMITS.countdownMs (3 giây), và client-server đọc CHUNG con số', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();
    const s = (wrapper.vm as unknown as {
      session: { countdownLeft: { value: number | null } }
    }).session;
    expect(s.countdownLeft.value).toBe(Math.ceil(ROOM_LIMITS.countdownMs / 1000));

    // Chưa hết hạn thì vẫn còn đếm
    await vi.advanceTimersByTimeAsync(ROOM_LIMITS.countdownMs - 400);
    await flush();
    expect(s.countdownLeft.value).not.toBeNull();

    // Qua hạn thì vào ván
    await vi.advanceTimersByTimeAsync(700);
    await flush();
    expect(s.countdownLeft.value).toBeNull();
  });

  it('KHÔNG còn tiếng chia bài — nó gây khó chịu, đã bỏ', () => {
    expect((sfx as unknown as Record<string, unknown>).deal).toBeUndefined();
  });
});

describe('bản đồ cấp hiện số thẻ', () => {
  // Bản đồ cấp nay CHỈ còn ở Chiến dịch: các chế độ khác chọn thẳng số thẻ.
  it('cấp ĐÃ QUA vẫn hiện số thẻ — đó là thông tin để chọn cấp', async () => {
    // Qua cấp 1 và 2, mở tới cấp 3
    localStorage.setItem('mm.v2', JSON.stringify({
      levels: { 'campaign:1': { stars: 3, score: 900 }, 'campaign:2': { stars: 1, score: 100 } }
    }));
    await mountApp();
    await pickMode('Chiến dịch');
    const nodes = wrapper.findAll('.node');
    expect(nodes.length).toBeGreaterThan(3);
    // Trước đây số thẻ nằm trong nhánh v-else của phần sao, nên ô đã qua chỉ
    // hiện sao và MẤT số thẻ.
    for (const n of nodes.slice(0, 3)) {
      expect(n.text(), `ô "${n.text()}" phải ghi số thẻ`).toMatch(/\d+ thẻ/);
    }
    expect(nodes[0]!.classes(), 'ô cấp 1 phải là ô đã qua').toContain('cleared');
    expect(nodes[0]!.text()).toMatch(/\d+ thẻ/);
  });

  it('ô KHOÁ cũng ghi số thẻ, để người chơi biết phía trước là gì', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await pickMode('Chiến dịch');
    const locked = wrapper.findAll('.node.locked');
    expect(locked.length).toBeGreaterThan(0);
    expect(locked[0]!.text()).toMatch(/\d+ thẻ/);
  });
});

describe('bố cục nút ở màn kết quả', () => {
  /** Ba nút, đúng thứ tự: chơi lại · cấp tiếp theo · về menu. */
  const labels = (): string[] => wrapper.findAll('[role="dialog"] button')
    .map((b) => b.text()).filter((t) => t.length > 0);

  it('thắng: hàng trên là "Chơi lại cấp này" rồi "Cấp tiếp theo", "Về menu" ở dưới', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await start();
    await winGame();
    const l = labels();
    expect(l[0]).toContain('Chơi lại cấp này');
    expect(l[1]).toContain('Cấp tiếp theo');
    expect(l[2]).toContain('Về menu');
    // Cả hai nút hàng trên đều bấm được, và cùng là nút nổi bật
    const btns = wrapper.findAll('[role="dialog"] .row button');
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      expect(b.classes()).toContain('btn-primary');
      expect(b.attributes('disabled')).toBeUndefined();
    }
  });

  it('THUA: bố cục y nguyên, chỉ nút cấp sau bị tắt', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await pickMode('Đua thời gian');
    await start(1);
    // Hết giờ mà chưa ghép xong → thua
    await vi.advanceTimersByTimeAsync(120_000);
    await flush();
    await vi.advanceTimersByTimeAsync(1500);
    await flush();
    expect(wrapper.text()).toContain('Hết thời gian');
    const l = labels();
    expect(l[0]).toContain('Chơi lại');
    expect(l[1]).toContain('Cấp tiếp theo');
    expect(l[2]).toContain('Về menu');
    const next = wrapper.findAll('[role="dialog"] .row button')[1]!;
    expect(next.attributes('disabled'), 'thua thì cấp sau phải tắt').toBeDefined();
  });
});

describe('màn đếm ngược cân giữa màn hình', () => {
  it('overlay đếm ngược dùng position: fixed, không phải absolute trong bàn thẻ', () => {
    // absolute trong .board-wrap thì cụm cân giữa BÀN, mà bàn bắt đầu dưới HUD
    // nên tâm nó thấp hơn tâm màn hình (đo được 63px trên iPhone 13) — đọc ra
    // thành lệch xuống dưới, rõ nhất trên máy màn ngắn.
    for (const file of ['GameScreen.vue', 'OnlineGame.vue']) {
      const css = readFileSync(resolve(process.cwd(), `src/components/${file}`), 'utf8');
      const block = css.slice(css.indexOf('.countdown {'));
      const rule = block.slice(0, block.indexOf('}'));
      expect(rule, `${file}: overlay phải fixed`).toContain('position: fixed');
      expect(rule, `${file}: phải phủ trọn màn hình`).toContain('inset: 0');
    }
  });

  it('có số đếm và tên người đi đầu, số ở trên tên ở dưới', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start();
    const cd = wrapper.find('.countdown');
    expect(cd.exists()).toBe(true);
    const kids = cd.element.children;
    expect(kids[0]!.className, 'con đầu là số đếm').toContain('num');
    expect(kids[1]!.className, 'con thứ hai là dòng báo').toContain('first');
  });
});

describe('không ô nào bị dính viền "đang chọn"', () => {
  it('bước bấm-là-đi: lựa chọn lần trước KHÔNG làm ô sáng viền lúc vừa vào', async () => {
    // Đi một vòng để lựa chọn được nhớ vào prefs
    await mountApp();
    await click('Chơi nhanh');
    await flush();
    // Về trang chủ rồi vào lại bước đầu
    await wrapper.find('[aria-label="Về trang chủ"]').trigger('click');
    await flush();
    for (const tile of wrapper.findAll('.step-body .option')) {
      expect(tile.attributes('aria-pressed'), `ô "${tile.text().slice(0, 14)}" không được mang aria-pressed`)
        .toBeUndefined();
    }
  });

  it('bước có trạng thái thật (theme) VẪN đánh dấu ô đang chọn', async () => {
    await mountApp();
    await pickMode('Cổ điển');
    await chonBan(1);
    const checked = wrapper.findAll('.step-body [aria-checked="true"]');
    expect(checked.length, 'theme là chọn nhiều, phải đánh dấu ô đang bật').toBeGreaterThan(0);
  });
});

describe('emoji lúc chat to gấp đôi nút bấm', () => {
  it('emoji người kia gửi lớn hơn hẳn nút gửi, và có TÊN người gửi kèm dưới', () => {
    // Thanh gửi ở EmojiBar.vue, emoji người kia gửi ở EmojiBlast.vue — đọc cả hai
    const css = ['EmojiBar.vue', 'EmojiBlast.vue']
      .map((f) => readFileSync(resolve(process.cwd(), `src/components/${f}`), 'utf8'))
      .join('\n');
    const px = (sel: string): number => {
      const at = css.indexOf(sel);
      expect(at, `không thấy rule ${sel}`).toBeGreaterThan(-1);
      const rule = css.slice(at, css.indexOf('}', at));
      const m = /font-size:[^;]*?(\d+)px/.exec(rule);
      expect(m, `rule ${sel} phải có font-size theo px`).toBeTruthy();
      return Number(m![1]);
    };
    // Neo vào ĐẦU DÒNG: '.emoji {' còn khớp cả trong '.emoji-bar.spent .emoji {'
    expect(px('.emoji-blast .big')).toBeGreaterThanOrEqual(px('\n.emoji {') * 2);
    // Xếp DỌC (biểu tượng trên, tên dưới) và trôi lên mờ dần
    const at = css.indexOf('.emoji-blast {');
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('flex-direction: column');
    expect(rule).toContain('blast-float');
    // Dấu nhỏ trên chip người chơi đã bỏ — tên nằm ngay dưới emoji rồi
    expect(css, 'không còn bong bóng trên chip').not.toContain('class="bubble"');
  });
});


describe('hai thông báo cùng lúc thì không đè nhau', () => {
  it('cái tới SAU nằm tầng trên; một mình thì về tầng dưới', async () => {
    await mountApp();
    await pickMode('Chớp nhoáng');
    await start(4);
    await passCountdown();
    await flush();

    // Chớp nhoáng: đang hé mở cả bàn → có toast, chưa có banner chuyển lượt
    const toast = wrapper.find('.notice-bar .toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes(), 'một mình thì KHÔNG nâng tầng').not.toContain('raised');
  });

  it('màn chơi đơn có tầng trên cho thông báo tới trước', () => {
    // Chỉ màn chơi đơn cần: bên online, emoji đã teleport ra body nên nó không
    // nằm chung dải với thông báo chuyển lượt nữa.
    const css = readFileSync(resolve(process.cwd(), 'src/components/GameScreen.vue'), 'utf8');
    expect(css).toContain('.notice-bar > .raised');
  });
});

describe('ngoài Chiến dịch: chọn SỐ THẺ, không khoá gì', () => {
  /** Ô cỡ bàn còn bấm được (chỉ bị chặn khi bộ theme thiếu biểu tượng). */
  const oMo = (): number => wrapper.findAll('.size-grid .option:not([disabled])').length;
  const oTatCa = (): number => wrapper.findAll('.size-grid .option').length;

  it('chơi một mình: KHÔNG còn thang cấp — mọi cỡ bàn chọn được ngay từ đầu', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await pickMode('Cổ điển');
    expect(wrapper.findAll('.node').length, 'không còn bản đồ cấp ở chế độ thường').toBe(0);
    // Không còn ô nào bị KHOÁ theo tiến độ. Ô duy nhất có thể bấm không được là
    // ô mà bộ theme đang mở chưa đủ biểu tượng — lý do khác hẳn, và có ghi rõ
    // trên ô.
    expect(oTatCa()).toBe(BOARD_SIZES.length);
    for (const o of wrapper.findAll('.size-grid .option[disabled]')) {
      expect(o.text()).toContain('thiếu biểu tượng');
    }
  });

  it('nhiều người cùng máy: cũng là lưới số thẻ', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await click('Chơi nhiều người');
    await click('2 người chơi');
    await click('Tiếp tục');
    expect(oMo(), 'mọi cỡ bàn phải mở').toBeGreaterThanOrEqual(oTatCa() - 1);
  });

  it('đấu máy: cũng là lưới số thẻ', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await click('Đấu với máy');
    await click('Bot Pro');
    expect(oMo()).toBeGreaterThanOrEqual(oTatCa() - 1);
  });

  it('Chiến dịch VẪN giữ bản đồ cấp — ở đó cấp mới là độ khó thật', async () => {
    localStorage.removeItem('mm.v2');
    await mountApp();
    await pickMode('Chiến dịch');
    expect(wrapper.findAll('.node').length).toBeGreaterThan(1);
    expect(wrapper.findAll('.size-grid').length).toBe(0);
  });
});

describe('phiên bản ở cuối bảng Luật chơi', () => {
  it('hiện số phiên bản, ngày giờ build và tuổi bản build', async () => {
    await mountApp();
    await wrapper.find('[aria-label="Luật chơi"]').trigger('click');
    await flush();
    const box = wrapper.find('.build');
    expect(box.exists(), 'phải có chân trang phiên bản').toBe(true);
    expect(box.text()).toMatch(/^v\d+\.\d+\.\d+/);        // v1.1.0
    expect(box.text()).toMatch(/\d{2}\/\d{2}\/\d{4}/);     // 25/08/2026
    expect(box.text()).toMatch(/(trước|vừa xong)/);        // tuổi bản build
  });

  /*
   * Chỉ kiểm ĐƯỜNG DÂY: bảng luật có gọi hàm đổi tuổi build thành chữ. Luật của
   * hàm (giữ hai đơn vị, không in số 0) được kiểm tất định ở build-age.test.ts.
   *
   * Bản cũ của test này soi thẳng chuỗi và đòi "không có 0 phút" trong khi hàm
   * lúc đó chỉ cắt số 0 ở đầu — nên nó ĐỎ đúng vào phút thứ 0 của mỗi giờ, tức
   * thất thường theo giờ chạy CI. Test không được phụ thuộc lúc nó chạy.
   */
  it('tuổi bản build hiện theo đơn vị thời gian, không in số 0', async () => {
    await mountApp();
    await wrapper.find('[aria-label="Luật chơi"]').trigger('click');
    await flush();
    const txt = wrapper.find('.build').text();
    expect(txt).toMatch(/\d+ (ngày|giờ|phút|giây) trước|vừa xong/);
    expect(txt).not.toMatch(/\b0 (ngày|giờ|phút|giây)/);
  });
});

/*
 * "GIẬT GIẬT KHI MỞ LÁ BÀI" ở phòng online — đã đo được với trễ 87ms/chiều
 * (ping 175ms): lá đang ở 80,2° thì nhảy thẳng lên 180° trong MỘT frame (96,2°).
 *
 * Gốc: cả `flip-up` (0% = rotateY(0)) và `shake` (mọi keyframe = rotateY(180deg))
 * đều là animation với góc TUYỆT ĐỐI. Ở online, lá dừng ở 90° chờ server; khi câu
 * trả lời về thì `pending` tắt và `faceUp` bật TRONG CÙNG MỘT NHỊP, animation
 * chiếm quyền giữa lúc transition đang chạy và lá nhảy phắt về góc mở đầu của
 * keyframe. Chơi đơn không có đường này nên không bao giờ thấy.
 *
 * Test đọc nguồn vì đây là luật CSS + thứ tự nhịp Vue: dựng lại cảnh này trong
 * jsdom thì không có layout, không có transition, không đo được góc nào.
 */
/*
 * Trong một dãy CHỌN-MỘT, mục đang chọn luôn phải trông như đang chọn — kể cả
 * mức tắt ("Vô hạn" / "Không"), vốn là nút ĐẦU TIÊN của mọi hàng.
 *
 * Lỗi đã bị phản ánh thật: mức tắt trước đây chỉ đổi viền cho "đỡ ồn", nên khi
 * bàn để mặc định thì bốn hàng đầu đều trông như CHƯA CHỌN GÌ — người chơi
 * không đọc ra được là mình đang tắt hay là nút bị hỏng.
 */
describe('bảng tuỳ chọn: hàng nào cũng có đúng một nút đang chọn', () => {
  it('kể cả khi mức đang chọn là mức tắt (nút đầu hàng)', async () => {
    await mountApp();
    await click('Chơi nhanh');
    await chonBan(1);
    await click('Tiếp');
    // Đưa MỌI hàng về mức tắt — đây là cảnh dễ trông thành "không chọn gì nhất"
    for (const hang of ['Thời gian', 'Số mạng', 'Xem trước', 'Xáo thẻ', 'Thẻ đặc biệt']) {
      const row = wrapper.findAll('.opt-row').find((r) => r.find('.opt-name').text() === hang)!;
      const tat = row.findAll('.seg-btn')[0]!;          // nút đầu = mức tắt
      await tat.trigger('click');
      await flush();
      const sang = row.findAll('.seg-btn').filter((b) => b.attributes('aria-pressed') === 'true');
      expect(sang, `hàng "${hang}" phải có ĐÚNG MỘT nút đang chọn`).toHaveLength(1);
      expect(sang[0]!.text(), `hàng "${hang}": nút đang chọn phải là nút vừa bấm`).toBe(tat.text());
    }
    // Và không nút nào mang class riêng làm nó nhạt đi so với các mức khác
    const src = readFileSync(resolve(process.cwd(), 'src/components/MenuScreen.vue'), 'utf8');
    expect(src, 'mức tắt không được có luật CSS riêng làm nó trông như chưa chọn')
      .not.toMatch(/\.seg-btn\.zero\[aria-pressed/);
  });
});

describe('lật thẻ online không được nhảy góc', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');

  it('có nhớ trạng thái vừa-chờ-server, vì pending và faceUp đổi cùng một nhịp', () => {
    // Đọc props.pending trong watcher của faceUp thì nó ĐÃ là false — cái guard
    // `if (props.pending) return` một mình không bao giờ bắt được đường online.
    expect(src).toMatch(/const daCho = ref\(false\)/);
    expect(src).toMatch(/watch\(\(\) => props\.pending/);
  });

  it('lắc sau khi chờ server phải bắt đầu ĐÚNG ở 180 độ (wob-tail), không phải 0', () => {
    // '@keyframes wob-tail {' có dấu ngoặc: chuỗi không ngoặc còn khớp cả chú
    // thích ở đầu file, cắt từ đó ra thì đọc phải comment thay vì keyframes.
    const at = src.indexOf('@keyframes wob-tail {');
    expect(at, 'thiếu keyframes wob-tail').toBeGreaterThan(-1);
    const kf = src.slice(at, src.indexOf('}\n', src.indexOf('100%', at)));
    expect(kf, 'wob-tail phải mở màn ở 180deg').toMatch(/0%\s*\{\s*transform: rotateY\(180deg\)/);
    // flip-up thì ngược lại: nó mở màn ở 0 độ, nên KHÔNG được dùng cho đường online
    const up = src.slice(src.indexOf('@keyframes flip-up'));
    expect(up.slice(0, 120)).toMatch(/0%\s*\{\s*transform: rotateY\(0\)/);
  });

  it('lắc "ghép sai" đi qua lacSai, không gắn thẳng prop wrong', () => {
    // shake ép rotateY(180deg) ở mọi keyframe: gắn lúc lá còn ở 90° là lá nhảy
    // phắt lên 180 và cú lật biến mất.
    expect(src).toMatch(/wrong: lacSai/);
    expect(src, 'shake vẫn phải cùng trục rotateY với cú lật').toMatch(
      /@keyframes shake[\s\S]{0,200}rotateY\(180deg\)/
    );
  });

  it('mốc hoãn lắc bằng đúng transition-duration của .inner', () => {
    const flipMs = Number(/const FLIP_MS = (\d+)/.exec(src)![1]);
    const trans = /transition: transform \.(\d+)s/.exec(src)![1];
    expect(flipMs, `FLIP_MS phải bằng transition .${trans}s`).toBe(Number(trans) * 10);
  });
});
