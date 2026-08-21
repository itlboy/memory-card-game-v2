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

const start = async (): Promise<void> => {
  await wrapper.find('.btn-primary').trigger('click');
  await flush();
};

describe('App', () => {
  it('render menu và nạp theme từ JSON', async () => {
    wrapper = mount(App);
    await flush();
    expect(wrapper.text()).toContain('Chế độ chơi');
    expect(wrapper.text()).toContain('Động vật');
    expect(wrapper.findAll('[role="radio"]').length).toBeGreaterThan(5);
  });

  it('theme chưa mở khoá thì bị vô hiệu hoá', async () => {
    wrapper = mount(App);
    await flush();
    const locked = wrapper.findAll('.chip').find((c) => c.text().includes('Bị khoá'))!;
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
    const campaign = wrapper.findAll('.chip').find((c) => c.text().includes('Chiến dịch'))!;
    await campaign.trigger('click');
    await flush();
    const nodes = wrapper.findAll('.node');
    expect(nodes).toHaveLength(20);
    expect(nodes[0]!.attributes('disabled')).toBeUndefined();
    expect(nodes[1]!.attributes('disabled')).toBeDefined();
  });

  it('chọn 2 người chơi thì hiện bảng người chơi và lượt hiện tại', async () => {
    wrapper = mount(App);
    await flush();
    const two = wrapper.findAll('.chip').find((c) => c.text().trim() === '2 người')!;
    await two.trigger('click');
    await flush();
    await start();
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
