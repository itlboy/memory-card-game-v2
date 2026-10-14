import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * NGÔN NGỮ TRONG APP ĐỒNG BỘ HAI CHIỀU VỚI CÀI ĐẶT MÁY (14.10.2026).
 * Máy → game: ngôn ngữ máy khác lần mở trước = người dùng vừa đổi trong Cài đặt.
 * Game → máy: chọn trong game thì gọi plugin NgonNguApp ghi xuống máy.
 */
const dat = vi.fn(async () => {});
vi.mock('@/lib/native', () => ({ laApp: true, nenApp: 'ios', SITE_URL: '' }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ dat }) }));

async function moApp(ngonNguMay: string): Promise<typeof import('@/lib/i18n')> {
  Object.defineProperty(navigator, 'languages', { value: [ngonNguMay], configurable: true });
  Object.defineProperty(navigator, 'language', { value: ngonNguMay, configurable: true });
  vi.resetModules();
  return import('@/lib/i18n');
}

afterEach(() => { localStorage.clear(); dat.mockClear(); });

describe('ngôn ngữ app ↔ Cài đặt máy', () => {
  it('mở lần đầu: theo ngôn ngữ máy', async () => {
    expect((await moApp('ja-JP')).ngonNgu.value).toBe('ja');
  });

  it('đã chọn trong game, máy không đổi: giữ lựa chọn trong game', async () => {
    localStorage.setItem('mm.lang', 'vi');
    localStorage.setItem('mm.langMay', 'en');
    expect((await moApp('en-US')).ngonNgu.value).toBe('vi');
  });

  it('vừa đổi trong Cài đặt máy: theo máy, bỏ lựa chọn cũ', async () => {
    localStorage.setItem('mm.lang', 'vi');
    localStorage.setItem('mm.langMay', 'vi');
    const m = await moApp('fr-FR');
    expect(m.ngonNgu.value).toBe('fr');
    expect(localStorage.getItem('mm.lang')).toBe('fr');
  });

  it('đổi trong game thì ghi xuống máy, đúng mã thư mục lproj', async () => {
    const m = await moApp('en-US');
    m.ngonNgu.value = 'pt';
    await vi.waitFor(() => expect(dat).toHaveBeenCalledWith({ ma: 'pt-BR' }));
    expect(localStorage.getItem('mm.langMay')).toBe('pt');
  });

  it('lần đặt đầu lúc mở app KHÔNG ghi xuống máy', async () => {
    await moApp('de-DE');
    await new Promise((r) => setTimeout(r, 20));
    expect(dat).not.toHaveBeenCalled();
  });
});
