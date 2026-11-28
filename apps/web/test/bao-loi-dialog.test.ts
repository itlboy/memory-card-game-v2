import { mount, flushPromises } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * HỘP BÁO LỖI / GÓP Ý (28.11.2026, mockup duyệt https://claude.ai/artifact/QUH5duZnNP6ZJ7kS8Q78BJ): chạm là xong —
 * "Ở đâu" chọn sẵn theo màn vừa rời; gửi được khi có ít nhất một ô hoặc vài chữ; gửi kèm thông tin máy, KHÔNG tên người chơi.
 */
const nap = async (manVuaRoi?: string) => {
  vi.resetModules();
  const bl = await import('@/lib/bao-loi');
  if (manVuaRoi) bl.ghiManGanNhat(manVuaRoi as never);
  const BaoLoiDialog = (await import('@/components/BaoLoiDialog.vue')).default;
  return mount(BaoLoiDialog, { attachTo: document.body });
};
let gui: { url: string; than: Record<string, unknown> }[] = [];
beforeEach(() => {
  document.body.innerHTML = ''; localStorage.clear(); gui = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    gui.push({ url, than: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return new Response(JSON.stringify({ ok: true, id: 1 }), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('hộp báo lỗi', () => {
  it('"Ở đâu" chọn sẵn theo màn vừa rời (Online)', async () => {
    const w = await nap('online');
    const chon = w.findAll('[role="radio"].bl-chip').find((b) => b.attributes('aria-checked') === 'true');
    expect(chon?.text()).toBe('Online');
    w.unmount();
  });

  it('chưa chọn gì mà bấm Gửi: KHÔNG gửi, nhắc chọn; chọn một ô thì gửi đúng loại / nơi / ô + thông tin máy, không tên', async () => {
    const w = await nap('timThe');
    await w.find('.bl-gui').trigger('click');
    expect(gui).toHaveLength(0);
    expect(w.find('.loi-gui').text()).toContain('Chọn ít nhất một ô');
    const o = w.findAll('[aria-pressed]').find((b) => b.text() === 'Mất kết nối')!;
    await o.trigger('click');
    await w.find('.bl-gui').trigger('click');
    await flushPromises();
    expect(gui).toHaveLength(1);
    expect(gui[0]!.url).toMatch(/\/api\/baoloi$/);
    expect(gui[0]!.than).toMatchObject({ loai: 'loi', noi: 'timThe', vanDe: ['matKetNoi'] });
    const may = gui[0]!.than.may as Record<string, unknown>;
    expect(may).toHaveProperty('manHinh');
    expect(may).toHaveProperty('banWeb');
    expect(JSON.stringify(gui[0]!.than)).not.toMatch(/"ten"|"name"/);
    expect(w.find('.xong').exists()).toBe(true);
    w.unmount();
  });

  it('đổi sang Góp ý: bộ ô đổi theo (Thêm tính năng…), ô của Lỗi đã chọn bị bỏ', async () => {
    const w = await nap();
    await w.findAll('[aria-pressed]').find((b) => b.text() === 'Văng ra ngoài')!.trigger('click');
    await w.findAll('.o-loai')[1]!.trigger('click');
    const ten = w.findAll('[aria-pressed]').map((b) => b.text());
    expect(ten).toContain('Thêm tính năng');
    expect(ten).not.toContain('Văng ra ngoài');
    expect(w.findAll('[aria-pressed="true"]')).toHaveLength(0);
    w.unmount();
  });

  it('server báo quá nhiều thư (429): giữ hộp, hiện lời nhắn', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    const w = await nap();
    await w.findAll('[aria-pressed]')[0]!.trigger('click');
    await w.find('.bl-gui').trigger('click');
    await flushPromises();
    expect(w.find('.xong').exists()).toBe(false);
    expect(w.find('.loi-gui').text()).toContain('nhiều thư');
    w.unmount();
  });

  it('menu có hàng "Báo lỗi / Góp ý" riêng, dưới hàng Luật chơi | Cập nhật', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/TopBar.vue'), 'utf8');
    expect(src).toMatch(/class="hang-cuoi"[\s\S]{0,2500}<\/div>\s*<!-- BÁO LỖI[\s\S]{0,300}emit\('bao-loi'\)/);
  });
});
