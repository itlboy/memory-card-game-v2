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

/** Đi hết wizard chơi đơn: Một mình → chế độ → lưới → Bắt đầu. */
const start = async (mode = 'Cổ điển', grid = '4×4'): Promise<void> => {
  await click('Chơi một mình');
  await click(mode);
  await click(grid);        // bước lưới riêng, chọn là tự sang theme
  await click('Bắt đầu');
};

describe('App', () => {
  it('bước 1 của wizard chỉ hỏi một câu: chơi một mình hay nhiều người', async () => {
    wrapper = mount(App);
    await flush();
    expect(wrapper.text()).toContain('Bạn muốn chơi thế nào?');
    expect(wrapper.text()).toContain('Chơi một mình');
    expect(wrapper.text()).toContain('Chơi nhiều người');
    // Chưa hiện lưới/theme ở bước đầu — tránh rối
    expect(wrapper.text()).not.toContain('Kích thước lưới');
    expect(wrapper.text()).not.toContain('Theme thẻ');
  });

  it('theme nạp từ JSON hiện ở bước chọn bàn', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    expect(wrapper.text()).toContain('Kích thước lưới');   // bước lưới riêng
    expect(wrapper.text()).not.toContain('Động vật');
    await click('4×4');
    expect(wrapper.text()).toContain('Chọn theme thẻ');    // bước theme riêng
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
    await click('4×4');
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

  it('chọn Chiến dịch thì hiện bản đồ 20 màn, chỉ màn 1 mở khoá', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Chiến dịch');
    const nodes = wrapper.findAll('.node');
    expect(nodes).toHaveLength(20);
    expect(nodes[0]!.attributes('disabled')).toBeUndefined();
    expect(nodes[1]!.attributes('disabled')).toBeDefined();
  });

  it('nhánh nhiều người: số người → chế độ → bàn chơi, vào ván có bảng người chơi', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi nhiều người');
    expect(wrapper.text()).toContain('Mấy người chơi?');
    await click('2 người chơi');
    // Nhiều người chỉ có 2 chế độ hợp lệ
    expect(wrapper.text()).toContain('Cổ điển');
    expect(wrapper.text()).toContain('Sinh tồn');
    expect(wrapper.text()).not.toContain('Chiến dịch');
    await click('Cổ điển');
    await click('4×4');
    await click('Bắt đầu');
    expect(wrapper.findAll('.player')).toHaveLength(2);
    expect(wrapper.text()).toContain('Đang chơi');
  });

  it('lưu và đọc lại tuỳ chọn nền tối', async () => {
    wrapper = mount(App);
    await flush();
    expect(document.documentElement.dataset.theme).toBe('light');
    await wrapper.findAll('header .btn')[0]!.trigger('click');
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
    await click('4×4');
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

describe('bước chọn lưới', () => {
  it('có đủ 12 cỡ bàn, trần 8×8, preview vẽ đúng hình dạng bàn', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    const options = wrapper.findAll('.option');
    expect(options.length).toBe(12);   // 3×4 mobile / 4×3 desktop — tròn hàng
    expect(wrapper.text()).toContain('8×8');
    expect(wrapper.text()).toContain('32 cặp');
    expect(wrapper.text()).not.toContain('8×10');
    // Preview 3×3: 9 ô, ô chính giữa trống (đúng như bàn thật)
    const p33 = options.find((o) => o.text().includes('3×3'))!.findAll('.grid-preview i');
    expect(p33).toHaveLength(9);
    expect(p33[4]!.classes()).toContain('blank');
    // Preview 8×8: 64 ô, không ô trống
    const p88 = options.find((o) => o.text().includes('8×8'))!.findAll('.grid-preview i');
    expect(p88).toHaveLength(64);
    expect(p88.every((i) => !i.classes().includes('blank'))).toBe(true);
  });

  it('8×8 với một theme 24 biểu tượng thì cảnh báo chọn thêm theme', async () => {
    wrapper = mount(App);
    await flush();
    await click('Chơi một mình');
    await click('Cổ điển');
    await click('8×8');
    expect(wrapper.text()).toContain('Chưa đủ biểu tượng');
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined();
  });
});
