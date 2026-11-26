import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * BẢNG CHỌN NHẠC NỀN (26.11.2026) — chủ dự án: "nhạc nền bấm vào tôi cũng muốn ra trang settings giống như hình nền để
 * người dùng chọn các bản premium", và "tính năng premium nào cần có dấu premium… ngay cả người dùng premium — để họ
 * hiểu quyền lợi của mình".
 */
const nap = async (premium: boolean) => {
  localStorage.clear();
  if (premium) localStorage.setItem('mm.premium', '1');
  const { vi } = await import('vitest');
  vi.resetModules();
  const ChonNhac = (await import('@/components/ChonNhac.vue')).default;
  const pm = await import('@/lib/premium');
  const w = mount(ChonNhac, { props: { nhac: true, bai: 'dem' }, attachTo: document.body });
  return { w, pm };
};
const dong = (w: Awaited<ReturnType<typeof nap>>['w']) => w.findAll('.cn-ds .dong');

beforeEach(() => { document.body.innerHTML = ''; });

describe('bảng chọn nhạc nền', () => {
  it('bày ĐỦ Tắt + 5 bài, bài đang phát có dấu ✓, tên bài không lặp chữ "Nhạc nền:"', async () => {
    const { w } = await nap(false);
    expect(dong(w)).toHaveLength(6);
    expect(dong(w)[2]!.attributes('aria-checked')).toBe('true');
    expect(dong(w)[2]!.find('.dang').exists()).toBe(true);
    expect(dong(w)[1]!.find('b').text()).toBe('Vui (marimba)');
    w.unmount();
  });

  it('chưa có Premium: bấm bài thường thì đổi nhạc; bấm bài khoá thì ĐÓNG bảng và mở bảng Premium, KHÔNG đổi nhạc', async () => {
    const { w, pm } = await nap(false);
    await dong(w)[1]!.trigger('click');
    expect(w.emitted('chon')).toEqual([['keo']]);
    await dong(w)[4]!.trigger('click');
    expect(w.emitted('chon')).toHaveLength(1);
    expect(w.emitted('close')).toHaveLength(1);
    expect(pm.yeuCauPremium.value?.tu).toBe('nhac');
    w.unmount();
  });

  it('ĐÃ có Premium: bài Premium chọn được và VẪN đeo vương miện', async () => {
    const { w } = await nap(true);
    expect(dong(w).filter((d) => d.find('.vm').exists())).toHaveLength(2);
    await dong(w)[5]!.trigger('click');
    expect(w.emitted('chon')).toEqual([['chuong']]);
    expect(w.emitted('close')).toBeUndefined();
    expect(w.find('.cn-chu').exists(), 'dòng giải thích vương miện hiện cho cả người đã có Premium').toBe(true);
    w.unmount();
  });

  it('bấm "Tắt" thì tắt nhạc', async () => {
    const { w } = await nap(false);
    await dong(w)[0]!.trigger('click');
    expect(w.emitted('chon')).toEqual([['off']]);
    w.unmount();
  });
});

describe('dấu Premium hiện cho cả người đã có Premium', () => {
  const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');
  it('hình nền: vương miện theo HÌNH (không theo "chưa mua"), dòng giải thích luôn hiện', () => {
    const s = doc('ChonHinhNen.vue');
    expect(s).toContain(`<span v-if="c !== 'goc'" class="vm"`);
    expect(s).not.toMatch(/v-if="!daMuaPremium" class="hn-chu"/);
  });
  it('menu: dòng Hình nền và Nhạc nền luôn đeo vương miện', () => {
    const s = doc('TopBar.vue');
    expect(s.match(/<Crown class="vm-nho"/g)).toHaveLength(2);
    expect(s).not.toMatch(/<Crown v-if="moiNangCap" class="vm-nho"/);
  });
  it('bộ hình: bộ Premium đã mở vẫn có vương miện', () => {
    expect(doc('ThemePicker.vue')).toContain('v-if="x.premium && choiDuoc(x)" class="tick prem cua-minh"');
  });
});
