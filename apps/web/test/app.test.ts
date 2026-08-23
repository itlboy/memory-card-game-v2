import { CAMPAIGN_LEVELS } from '@mm/engine';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';

const THEMES = {
  themes: [
    { id: 'animals', name: 'Động vật', unlockAt: 0, symbols: Array.from({ length: 24 }, (_, i) => `A${i}`) },
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

/** Đi hết wizard chơi đơn: Một mình → chế độ → cấp → Bắt đầu. Cấp 8 = 4×4. */
const start = async (mode = 'Cổ điển', level = 8): Promise<void> => {
  await click('Chơi một mình');
  await click(mode);
  await click(`Cấp ${level},`);
  await click('Bắt đầu');
};

describe('App', () => {
  it('bước 1 của wizard chỉ hỏi một câu: chơi một mình hay nhiều người', async () => {
    wrapper = mount(App);
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.text()).toContain('Chơi một mình');
    expect(wrapper.text()).toContain('Chơi nhiều người');
    // Chưa hiện cấp/theme ở bước đầu — tránh rối
    expect(wrapper.text()).not.toContain('Chọn cấp độ');
    expect(wrapper.text()).not.toContain('Theme thẻ');
  });

  it('theme nạp từ JSON hiện ở bước chọn bàn', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    expect(wrapper.text()).not.toContain('Động vật');
    await click('Cổ điển');
    expect(wrapper.text()).toContain('Chọn cấp độ');       // cấp đứng trước theme
    await click('Cấp 8,');
    expect(wrapper.text()).toContain('Chọn theme thẻ');
    expect(wrapper.text()).toContain('Động vật');
  });

  it('nút quay lại đưa về bước trước', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    expect(wrapper.text()).toContain('Chọn chế độ');
    await wrapper.find('[aria-label="Quay lại"]').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
  });

  it('theme chưa mở khoá thì bị vô hiệu hoá', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    await click('Cấp 8,');
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
    await click('Chơi một mình');
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
    expect(wrapper.text()).toContain('Cổ điển');
    expect(wrapper.text()).toContain('Sinh tồn');
    expect(wrapper.text()).toContain('Đua thời gian');
    expect(wrapper.text()).toContain('Chớp nhoáng');
    expect(wrapper.text()).not.toContain('Chiến dịch');
    await click('Cổ điển');
    await click('Cấp 1,');         // cấp mặc định mở sẵn
    await click('Bắt đầu');
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
    await click('Chơi một mình');
    await click('Cổ điển');
    await click('Cấp 8,');
    const chip = (name: string) =>
      wrapper.findAll('[role="checkbox"]').find((c) => c.text().includes(name))!;
    expect(chip('Động vật').attributes('aria-checked')).toBe('true');
    // "Bị khoá" chưa mở nên không toggle được; toggle Động vật đi thì phải giữ lại vì là theme cuối
    await chip('Động vật').trigger('click');
    await flush();
    expect(chip('Động vật').attributes('aria-checked')).toBe('true');   // không cho bỏ hết
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

describe('bước chọn cấp độ', () => {
  it('đủ 50 cấp, cấp 1 là 2 thẻ và cấp cuối 100 thẻ', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    const nodes = wrapper.findAll('.node');
    expect(nodes).toHaveLength(CAMPAIGN_LEVELS);
    // Bốn chặng, mỗi chặng một thẻ có tên riêng
    expect(wrapper.findAll('.chapter')).toHaveLength(4);
    expect(wrapper.text()).toContain('Chặng 1 · Nhập môn');
    expect(wrapper.text()).toContain('Chặng 4 · Bậc thầy');
    // Chặng ghi khoảng số thẻ; chặng quá trần nói rõ độ khó đến từ thời gian
    expect(wrapper.text()).toContain('2 – 20 thẻ');
    expect(wrapper.text()).toContain('thời gian siết dần');
  });

  it('cấp cần nhiều biểu tượng hơn bộ theme đang chọn thì bị chặn và có cảnh báo', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    const blocked = wrapper.findAll('.node.nosym');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0]!.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('cần thêm theme');
  });
});
