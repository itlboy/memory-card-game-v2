import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * HUY HIỆU PREMIUM TRÊN AVATAR (26.11.2026, mockup duyệt https://claude.ai/artifact/UTdgp7a6ngSsiWyv3ZXz7U) — dấu nhỏ ở góc
 * TRÊN PHẢI avatar, ba kiểu (vương miện · trái tim · kim cương), người khác thấy qua phòng online.
 */
const nap = async (kho: Record<string, string> = {}) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(kho)) localStorage.setItem(k, v);
  vi.resetModules();
  return import('@/lib/premium');
};
const doc = (f: string): string => readFileSync(resolve(process.cwd(), f), 'utf8');
beforeEach(() => { document.body.innerHTML = ''; });

describe('huy hiệu Premium', () => {
  it('engine: ba mã, server chỉ nhận mã trong danh sách', async () => {
    const { HUY_HIEU, huyHieuHoSo } = await import('@mm/engine');
    expect([...HUY_HIEU]).toEqual(['vm', 'tim', 'kc']);
    expect(huyHieuHoSo('tim')).toBe('tim');
    for (const x of ['', 'xx', 1, null, '<b>']) expect(huyHieuHoSo(x)).toBeUndefined();
  });

  it('mặc định đeo vương miện; chỉ HIỆN khi có Premium; chọn "không hiện" thì nhớ', async () => {
    const pm = await nap();
    expect(pm.huyHieu.value).toBe('vm');
    expect(pm.huyHieuDangDeo.value, 'chưa có Premium').toBe('');
    pm.datPremiumThu(true);
    expect(pm.huyHieuDangDeo.value).toBe('vm');
    pm.datHuyHieu('kc');
    expect(pm.huyHieuDangDeo.value).toBe('kc');
    pm.datHuyHieu('');
    const pm2 = await nap({ 'mm.huyHieu': '', 'mm.premium': '1' });
    expect(pm2.huyHieuDangDeo.value, 'đã chọn không hiện').toBe('');
    const pm3 = await nap({ 'mm.huyHieu': 'lung-tung', 'mm.premium': '1' });
    expect(pm3.huyHieuDangDeo.value, 'mã lạ về mặc định').toBe('vm');
  });

  it('bảng chọn: ba ô + "không hiện"; bấm là đổi', async () => {
    const pm = await nap({ 'mm.premium': '1' });
    const Chon = (await import('@/components/ChonHuyHieu.vue')).default;
    const w = mount(Chon, { attachTo: document.body });
    expect(w.findAll('.o')).toHaveLength(3);
    expect(w.findAll('.o .dau-pm')).toHaveLength(3);
    await w.findAll('.o')[1]!.trigger('click');
    expect(pm.huyHieu.value).toBe('tim');
    await w.find('.khong').trigger('click');
    expect(pm.huyHieu.value).toBe('');
    w.unmount();
  });

  it('dấu: vẽ đúng kiểu, mã lạ không vẽ gì; bám góc TRÊN PHẢI ô avatar', async () => {
    const Dau = (await import('@/components/DauPremium.vue')).default;
    expect(mount(Dau, { props: { loai: 'kc' } }).find('.dau-pm.kc').exists()).toBe(true);
    expect(mount(Dau, { props: { loai: 'xx' } }).find('.dau-pm').exists()).toBe(false);
    expect(mount(Dau, { props: { loai: undefined } }).find('.dau-pm').exists()).toBe(false);
    const css = doc('src/components/DauPremium.vue');
    expect(css).toMatch(/\.dau-pm \{[^}]*position: absolute; top: -[.\d]+em; right: -[.\d]+em;/);
  });

  it('đường đi: client gửi ?hh= → server nhận qua huyHieuHoSo, giữ khi vào lại, trả trong danh sách người chơi', () => {
    expect(doc('src/composables/useOnlineRoom.ts')).toContain("if (huyHieuDangDeo.value) params.set('hh', huyHieuDangDeo.value);");
    const sv = doc('../server/src/room.ts');
    expect(sv).toContain("const hh = huyHieuHoSo(url.searchParams.get('hh'));");
    expect(sv).toContain('if (hh) player.hh = hh; else delete player.hh;');
    expect(sv.match(/\.\.\.\(p\.hh \? \{ hh: p\.hh \} : \{\}\)/g)).toHaveLength(2);
  });

  it('hiện ở: chip người chơi trong ván (5 chỗ), danh sách phòng chờ (2), avatar trên thanh đầu + menu hồ sơ (2)', () => {
    expect(doc('src/components/OnlineGame.vue').match(/<DauPremium :loai="hhCua\(/g)).toHaveLength(5);
    expect(doc('src/components/OnlineScreen.vue').match(/<DauPremium :loai="p\.hh" \/>/g)).toHaveLength(2);
    expect(doc('src/components/TopBar.vue').match(/<DauPremium :loai="huyHieuDangDeo" \/>/g)).toHaveLength(2);
  });
});
