import { CAMPAIGN_LEVELS } from '@mm/engine';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';

const THEMES = {
  themes: [
    { id: 'animals', name: 'Động vật', unlockAt: 0, symbols: Array.from({ length: 24 }, (_, i) => `A${i}`) },
    // Theme mở sẵn THỨ HAI, để tổng biểu tượng đủ cho bàn lớn nhất (56 thẻ = 28
    // cặp). Bản thật có sáu theme mở sẵn; một theme 24 biểu tượng thì không bộ
    // đơn lẻ nào dựng nổi bàn trần, và đó là ý đồ — phải trộn theme.
    { id: 'food', name: 'Đồ ăn', unlockAt: 0, symbols: Array.from({ length: 24 }, (_, i) => `F${i}`) },
    { id: 'locked', name: 'Bị khoá', unlockAt: 999999, symbols: Array.from({ length: 24 }, (_, i) => `B${i}`) }
  ]
};

/** Chờ themes tải xong (fetch giả) rồi render lại. */
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
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(THEMES), {
    headers: { 'Content-Type': 'application/json' }
  })));
  // AudioContext không tồn tại trong happy-dom
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    currentTime = 0;
    createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => ({}), start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    get destination() { return {}; }
  });
});

afterEach(() => wrapper?.unmount());

/** Bấm nút/lựa chọn theo chữ hiển thị. */
const click = async (text: string): Promise<void> => {
  const btn = wrapper.findAll('button').find(
    (b) => b.text().includes(text) || b.attributes('aria-label')?.includes(text)
  );
  if (!btn) throw new Error(`Không thấy nút "${text}"`);
  await btn.trigger('click');
  await flush();
};

/**
 * Mở khoá tới cấp `n`. Mọi chế độ giờ đều đi qua bản đồ cấp, mà mặc định chỉ
 * mở cấp 1 (bàn 2 thẻ) — muốn test bàn 4×4 thì phải có tiến độ trước.
 * PHẢI gọi TRƯỚC mount: prefs và tiến độ đọc lúc dựng component.
 */
const unlockTo = (n: number): void => {
  localStorage.setItem('mm.v2', JSON.stringify({
    levels: { [`classic:${n - 1}`]: { stars: 1, score: 0 } }
  }));
};

/** Đi hết wizard chơi đơn: Một mình → chế độ → số thẻ → Bắt đầu. 16 thẻ = 4×4. */
/**
 * Qua nốt bước theme rồi bảng tuỳ chọn (chỉ chơi nhanh mới có bảng đó), và TẮT
 * thẻ đặc biệt.
 *
 * Vì sao tắt: các test dưới đây đọc trước bàn thẻ rồi bấm theo chỉ số. Bấm trúng
 * lá Tráo đổi thì hai thẻ đổi chỗ và chỉ số thành sai, bấm trúng Mắt thần thì cả
 * bàn bật lên — mà thẻ đặc biệt rải theo seed ngẫu nhiên nên test đỏ THẤT
 * THƯỜNG (đã đỏ thật 2/4 lần chạy). Chọn dữ liệu không có yếu tố ngẫu nhiên đó,
 * không phải chạy lại cho tới lúc xanh.
 */
const xongTuyChon = async (): Promise<void> => {
  const tiep = wrapper.findAll('button').find((b) => b.text() === 'Tiếp');
  if (tiep) {
    await tiep.trigger('click');
    await flush();
    // Tắt SẠCH năm luật, không riêng thẻ đặc biệt: mặc định nay bật cả năm ở
    // mức 1, mà "xem trước" hé cả bàn lúc vào ván nên các phép kiểm đọc mặt thẻ
    // ngay sau khi bắt đầu sẽ thấy bàn đang ngửa.
    const TAT: Record<string, string> = {
      'Thời gian': 'Vô hạn', 'Số mạng': 'Vô hạn', 'Xem trước': 'Không',
      'Xáo thẻ': 'Không', 'Thẻ đặc biệt': 'Không'
    };
    for (const [ten, muc] of Object.entries(TAT)) {
      const hang = wrapper.findAll('.opt-row').find((r) => r.find('.opt-name').text() === ten);
      const tat = hang?.findAll('.seg-btn').find((b) => b.text() === muc);
      if (tat) { await tat.trigger('click'); await flush(); }
    }
  }
  await click('Bắt đầu');
};

/** Đi hết wizard chơi nhanh: Chơi nhanh → cấp → theme → tuỳ chọn → Bắt đầu. */
const start = async (_mode = '', cards = 16): Promise<void> => {
  await click('Chơi nhanh');
  await click(`${cards} thẻ`);
  await xongTuyChon();
};

describe('App', () => {
  it('bước 1 là nơi chọn LỐI ĐI: chiến dịch, chơi nhanh, đấu máy, nhiều người, online', async () => {
    wrapper = mount(App);
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.text()).toContain('Chơi nhanh');
    expect(wrapper.text()).toContain('Chiến dịch');
    expect(wrapper.text()).toContain('Chơi nhiều người');
    // Chưa hiện cấp/theme ở bước đầu — tránh rối
    expect(wrapper.text()).not.toContain('Chọn số thẻ');
    expect(wrapper.text()).not.toContain('Theme thẻ');
  });

  it('theme nạp từ JSON hiện ở bước chọn bàn', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhanh');
    expect(wrapper.text()).not.toContain('Động vật');
    expect(wrapper.text()).toContain('Chọn số thẻ');       // bước chọn bàn đứng trước theme
    await click('16 thẻ');
    expect(wrapper.text()).toContain('Chọn theme thẻ');
    expect(wrapper.text()).toContain('Động vật');
  });

  it('nút quay lại đưa về bước trước', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhanh');
    expect(wrapper.text()).toContain('Chọn số thẻ');
    await wrapper.find('[aria-label="Quay lại"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
  });

  it('theme chưa mở khoá thì bị vô hiệu hoá', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhanh');
    await click('16 thẻ');
    const locked = wrapper.findAll('[role="checkbox"]').find((c) => c.text().includes('Bị khoá'))!;
    expect(locked.attributes('aria-disabled')).toBe('true');
  });

  it('bắt đầu ván Cổ điển 4×4 thì render đúng 16 thẻ, tất cả úp mặt', async () => {
    wrapper = mount(App);
    await flush();
    await start();
    expect(wrapper.findAll('.card')).toHaveLength(16);
    expect(wrapper.findAll('.card.up')).toHaveLength(0);
    expect(wrapper.text()).toContain('0/8');
  });

  it('lật thẻ thì thẻ ngửa mặt và nhãn a11y đổi theo', async () => {
    wrapper = mount(App);
    await flush();
    await start();
    const first = wrapper.findAll('.card')[0]!;
    expect(first.attributes('aria-label')).toContain('chưa mở');
    await first.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.up')).toHaveLength(1);
    expect(wrapper.findAll('.card')[0]!.attributes('aria-label')).not.toContain('chưa mở');
  });

  it('ghép đúng một cặp thì cả hai thẻ được đánh dấu xong và HUD tăng điểm', async () => {
    wrapper = mount(App);
    await flush();
    await start();
    // Tìm 2 thẻ cùng ký hiệu qua nhãn a11y sau khi lật thử là không khả thi;
    // đọc trực tiếp bàn thẻ từ engine rồi bấm đúng 2 ô của một cặp.
    const cards = (wrapper.vm as unknown as { session: { game: { value: { cards: { index: number; pairId: number }[] } } } })
      .session.game.value.cards;
    const [a, b] = cards.filter((c) => c.pairId === cards[0]!.pairId).map((c) => c.index);
    const tiles = wrapper.findAll('.card');
    await tiles[a!]!.trigger('click');
    await tiles[b!]!.trigger('click');
    await flush();
    expect(wrapper.findAll('.card.done')).toHaveLength(2);
    expect(wrapper.text()).toContain('1/8');
    expect(wrapper.text()).toContain('100');
  });

  it('chọn Chiến dịch thì hiện bản đồ đủ cấp, chưa chơi thì chỉ mở cấp 1', async () => {
    localStorage.clear();          // xoá tiến độ mở sẵn của beforeEach
    wrapper = mount(App);
    await flush();
    // Chiến dịch giờ là lối đi RIÊNG ngay ở màn đầu, không nằm sau "chơi một mình"
    await click('Chiến dịch');
    const nodes = wrapper.findAll('.node');
    expect(nodes).toHaveLength(CAMPAIGN_LEVELS);
    expect(nodes[0]!.attributes('disabled')).toBeUndefined();
    expect(nodes[1]!.attributes('disabled')).toBeDefined();
  });

  it('nhánh nhiều người: số người → tên → chế độ → bàn chơi, vào ván có bảng người chơi', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhiều người');
    expect(wrapper.text()).toContain('Mấy người chơi?');
    await click('2 người chơi');
    // Bước điền tên: đúng số ô theo số người, để trống thì lấy tên mặc định
    expect(wrapper.text()).toContain('Tên từng người');
    expect(wrapper.findAll('.name-row input')).toHaveLength(2);
    await click('Tiếp tục');
    // Nhiều người có mọi chế độ trừ Chiến dịch

    expect(wrapper.text()).not.toContain('Chiến dịch');
    await click('4 thẻ');         // cấp mặc định mở sẵn
    await xongTuyChon();
    expect(wrapper.findAll('.player')).toHaveLength(2);
    expect(wrapper.text()).toContain('Đang chơi');
  });

  it('lưu và đọc lại tuỳ chọn nền tối', async () => {
    wrapper = mount(App);
    await flush();
    expect(document.documentElement.dataset.theme).toBe('light');
    // Tìm theo nhãn, không theo vị trí: thanh trên cùng còn có nút Luật chơi và
    // âm lượng, thêm nút mới là test theo index sẽ bấm nhầm
    const darkBtn = wrapper.findAll('header .btn')
      .find((b) => (b.attributes('aria-label') ?? '').includes('nền tối'));
    await darkBtn!.trigger('click');
    await flush();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('mm.v2')).toContain('"dark":true');
  });
});

describe('multi-theme', () => {
  it('chọn thêm theme thứ hai — cả hai cùng được đánh dấu', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhanh');
    await click('16 thẻ');
    const chip = (name: string) =>
      wrapper.findAll('[role="checkbox"]').find((c) => c.text().includes(name))!;
    // Chưa từng chọn thì App bật SẴN mọi theme đang mở khoá
    expect(chip('Động vật').attributes('aria-checked')).toBe('true');
    expect(chip('Đồ ăn').attributes('aria-checked')).toBe('true');
    // Bỏ một cái thì cái kia ở lại
    await chip('Đồ ăn').trigger('click');
    await flush();
    expect(chip('Đồ ăn').attributes('aria-checked')).toBe('false');
    expect(chip('Động vật').attributes('aria-checked')).toBe('true');
    // Bỏ nốt cái cuối thì bị chặn — bàn không có biểu tượng nào thì không dựng được
    await chip('Động vật').trigger('click');
    await flush();
    expect(chip('Động vật').attributes('aria-checked')).toBe('true');
    expect(localStorage.getItem('mm.v2') ?? '').not.toContain('"themes":[]');
  });
});

describe('màn online (điều hướng, không cần server)', () => {
  it('vào Chơi online rồi quay lại menu — cả hai chiều đều render nội dung', async () => {
    // WebSocket giả không kết nối gì — chỉ cần màn entry render được
    vi.stubGlobal('WebSocket', class {
      onmessage: unknown = null; onclose: unknown = null; onerror: unknown = null;
      readyState = 0;
      close(): void { /* noop */ }
      send(): void { /* noop */ }
    });
    wrapper = mount(App, { attachTo: document.body });
    await flush();
    await click('Chơi online');
    // Bước 1: chỉ hai lựa chọn, chưa hiện form
    expect(wrapper.text()).toContain('Tạo phòng mới');
    expect(wrapper.text()).toContain('Vào phòng có sẵn');
    expect(wrapper.text()).not.toContain('Tên của bạn');
    await click('Tạo phòng mới');
    expect(wrapper.text()).toContain('Tên của bạn');
    await wrapper.find('[aria-label="Quay lại"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Vào phòng có sẵn');   // quay lại bước chọn
    // Quay lại — trước đây multi-root trong <Transition> làm trắng trang
    await wrapper.find('[aria-label="Quay lại"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.html().length).toBeGreaterThan(500);
  });
});

describe('bản đồ cấp của Chiến dịch', () => {
  it('đủ 50 cấp chia 4 chặng, cấp 1 là 4 thẻ và cấp cuối 56 thẻ', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chiến dịch');
    const nodes = wrapper.findAll('.node');
    expect(nodes).toHaveLength(CAMPAIGN_LEVELS);
    expect(nodes[0]!.text()).toContain('4 thẻ');
    expect(nodes.at(-1)!.text()).toContain('56 thẻ');
    // Bốn chặng, mỗi chặng một thẻ có tên riêng
    expect(wrapper.findAll('.chapter')).toHaveLength(4);
    expect(wrapper.text()).toContain('Chặng 1 · Nhập môn');
    expect(wrapper.text()).toContain('Chặng 4 · Bậc thầy');
    // Chặng ghi khoảng số thẻ, và nói rõ trong chặng còn siết giờ
    expect(wrapper.text()).toContain('4 – 20 thẻ');
    expect(wrapper.text()).toContain('giờ siết dần');
  });

  it('bật đủ theme thì KHÔNG cấp nào bị chặn — trần 56 thẻ đòi 28 biểu tượng', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chiến dịch');
    expect(wrapper.findAll('.node.nosym')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('cần thêm theme');
  });
});
