import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from '@/App.vue';
import { FLIP_BACK_MS } from '@mm/engine';

/**
 * TÁI HIỆN "Ô TRẮNG TRƠN": một lá NGỬA mà không có ký hiệu nào trên mặt.
 *
 * Người chơi gặp giữa ván đấu bot trên bàn 88 thẻ, kèm phán đoán "có vẻ do tôi
 * bấm nhanh". Mặt trước của lá ngửa là nền kem — nên lá ngửa mà `card.symbol`
 * rỗng trông đúng như một ô trắng trơn.
 */
const THEMES = { themes: [{ id: 'animals', name: 'Động vật', unlockAt: 0,
  symbols: Array.from({ length: 50 }, (_, i) => `S${i}`) }] };

const flush = async (n = 4) => { for (let i = 0; i < n; i++) { await nextTick(); await Promise.resolve(); } };
let wrapper: VueWrapper;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, '', location.pathname);
  localStorage.setItem('mm.v2', JSON.stringify({ levels: { 'classic:49': { stars: 1, score: 0 } } }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date',
    'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(THEMES))));
  vi.stubGlobal('AudioContext', class {
    state = 'running'; currentTime = 0;
    createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => ({}), start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    get destination() { return {}; }
  });
});
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const click = async (text: string) => {
  const b = wrapper.findAll('button').find((x) => x.text().includes(text) || x.attributes('aria-label')?.includes(text));
  if (!b) throw new Error(`không thấy nút "${text}"`);
  await b.trigger('click'); await flush();
};
const chonMuc = async (hang: string, muc: string) => {
  const row = wrapper.findAll('.opt-row').find((r) => r.find('.opt-name').text() === hang)!;
  await row.findAll('.seg-btn').find((b) => b.text() === muc)!.trigger('click');
  await flush();
};

/** Lá ngửa (hoặc đã ghép) mà mặt trước không có chữ nào. */
function oTrang(): { index: string; classes: string }[] {
  return wrapper.findAll('.card').filter((c) => {
    const cl = c.classes();
    if (!cl.includes('up') && !cl.includes('done')) return false;
    if (cl.includes('blank')) return false;
    return c.find('.front').text().trim() === '';
  }).map((c) => ({ index: c.attributes('data-index') ?? '?', classes: c.classes().join(' ') }));
}

describe('không bao giờ có ô trắng trơn giữa ván', () => {
  it('bấm dồn dập trên bàn lớn có thẻ đặc biệt', async () => {
    wrapper = mount(App, { attachTo: document.body });
    await flush(); await vi.advanceTimersByTimeAsync(10); await flush();

    await click('Chơi nhanh');
    await click('88 thẻ');
    await click('Tiếp');
    for (const [h, m] of Object.entries({ 'Thời gian': 'Vô hạn', 'Số mạng': 'Vô hạn',
      'Xem trước': 'Không', 'Xáo thẻ': 'Nhiều', 'Thẻ đặc biệt': 'Nhiều' })) await chonMuc(h, m);
    await click('Bắt đầu');
    await vi.advanceTimersByTimeAsync(4000); await flush();

    // Bấm dồn dập: nhiều lá trong CÙNG một nhịp, lặp nhiều vòng, xen kẽ lúc hai
    // lá đang mở và lúc đang úp lại — đúng kiểu bấm của người chơi vội.
    const tiles = () => wrapper.findAll('.card');
    for (let vong = 0; vong < 14; vong++) {
      const t = tiles();
      for (const i of [vong * 5, vong * 5 + 1, vong * 5 + 2, vong * 5 + 3]) {
        if (t[i % t.length]) await t[i % t.length]!.trigger('click');
      }
      await flush();
      const thay = oTrang();
      expect(thay, `vòng ${vong}: ${JSON.stringify(thay)}`).toEqual([]);
      await vi.advanceTimersByTimeAsync(FLIP_BACK_MS / 2);
      await flush();
      expect(oTrang(), `vòng ${vong} giữa lúc úp lại`).toEqual([]);
      await vi.advanceTimersByTimeAsync(FLIP_BACK_MS);
      await flush();
      expect(oTrang(), `vòng ${vong} sau khi úp lại`).toEqual([]);
    }
  });
});

/**
 * LƯỚI AN TOÀN: LÁ BÀI KHÔNG BAO GIỜ ĐƯỢC LÀ MỘT Ô TRẮNG.
 *
 * Không chữa được lỗi VẼ của trình duyệt từ CSS, nhưng chữa được cái người chơi
 * nhìn thấy: `.card` có nền phẳng sẫm nằm DƯỚI hai mặt thẻ, nên lớp nào không
 * được vẽ thì ra lá bài sẫm màu chứ không ra cái lỗ trắng giữa bàn.
 */
describe('nền dự phòng của lá bài', () => {
  const tile = readFileSync(resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');
  const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

  it('.card không còn trong suốt', () => {
    const mo = tile.indexOf('\n.card {');
    const khoi = tile.slice(mo, tile.indexOf('\n}', mo));
    expect(khoi, 'nền trong suốt thì lớp hỏng để lộ nền TRANG (trắng)')
      .toMatch(/background: var\(--card-nen-du-phong\)/);
  });

  it('ô trống (lưới lẻ) vẫn phải trong suốt — nó không phải lá bài', () => {
    expect(tile).toMatch(/\.card\.blank \{[^}]*background: transparent/);
  });

  it('token khai ở CẢ hai bảng màu, không thì một bảng ra biến rỗng', () => {
    expect((tokens.match(/--card-nen-du-phong:/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
