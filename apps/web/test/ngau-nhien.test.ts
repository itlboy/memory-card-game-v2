import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MỤC "NGẪU NHIÊN" ở bảng Hình nền và Nhạc nền (26.11.2026) — chủ dự án: "trong các settings đó có thêm mục ngẫu nhiên…
 * chúng ta sẽ đổi ngẫu nhiên". Đổi mỗi lần mở app / về trang chủ sau một ván; chọn tay là thôi ngẫu nhiên.
 */
const napCanh = async (premium: boolean, kho: Record<string, string> = {}) => {
  localStorage.clear();
  if (premium) localStorage.setItem('mm.premium', '1');
  for (const [k, v] of Object.entries(kho)) localStorage.setItem(k, v);
  vi.resetModules();
  return import('@/lib/canh');
};
beforeEach(() => { document.body.innerHTML = ''; delete document.documentElement.dataset.canh; });

describe('hình nền ngẫu nhiên', () => {
  it('bật là đổi ngay sang hình KHÁC, nhớ qua lần mở sau; mỗi lần gọi lại đổi tiếp', async () => {
    const c = await napCanh(true);
    expect(c.canhNgauNhien.value).toBe(false);
    c.datCanhNgauNhien(true);
    expect(c.canh.value).not.toBe('goc');
    expect(localStorage.getItem('mm.canh.nn')).toBe('1');
    for (let i = 0; i < 20; i++) { const cu = c.canh.value; expect(c.doiCanhNgauNhien()).not.toBe(cu); expect(c.CANH).toContain(c.canh.value); }
    const c2 = await napCanh(true, { 'mm.canh.nn': '1', 'mm.canh': 'thien-ha' });
    expect(c2.canhNgauNhien.value).toBe(true);
  });

  it('chọn tay một hình là tắt ngẫu nhiên; chưa bật thì doiCanhNgauNhien không đụng gì', async () => {
    const c = await napCanh(true);
    expect(c.doiCanhNgauNhien()).toBeNull();
    expect(c.canh.value).toBe('goc');
    c.datCanhNgauNhien(true);
    c.datCanh('anh-dao');
    expect(c.canhNgauNhien.value).toBe(false);
    expect(localStorage.getItem('mm.canh.nn')).toBeNull();
    expect(c.doiCanhNgauNhien()).toBeNull();
    expect(c.canh.value).toBe('anh-dao');
  });

  it('không có Premium thì không đổi (chỉ có một hình)', async () => {
    const c = await napCanh(false, { 'mm.canh.nn': '1' });
    expect(c.doiCanhNgauNhien()).toBeNull();
    expect(c.canh.value).toBe('goc');
  });

  it('bảng Hình nền: dòng Ngẫu nhiên bật/tắt; chưa Premium thì mời nâng cấp', async () => {
    await napCanh(true);
    const Chon = (await import('@/components/ChonHinhNen.vue')).default;
    const c = await import('@/lib/canh');
    const w = mount(Chon, { attachTo: document.body });
    await w.find('.nn').trigger('click');
    expect(c.canhNgauNhien.value).toBe(true);
    expect(w.find('.nn').attributes('aria-pressed')).toBe('true');
    expect(w.findAll('.hn-lon .dang'), 'đang ngẫu nhiên: dấu ✓ không nằm ở ô hình').toHaveLength(0);
    await w.find('.nn').trigger('click');
    expect(c.canhNgauNhien.value).toBe(false);
    w.unmount();

    await napCanh(false);
    const Chon2 = (await import('@/components/ChonHinhNen.vue')).default;
    const pm = await import('@/lib/premium');
    const w2 = mount(Chon2, { attachTo: document.body });
    await w2.find('.nn').trigger('click');
    expect(w2.emitted('close')).toHaveLength(1);
    expect(pm.yeuCauPremium.value?.tu).toBe('nen');
    expect((await import('@/lib/canh')).canhNgauNhien.value).toBe(false);
    w2.unmount();
  });
});

describe('nhạc nền ngẫu nhiên', () => {
  it('bảng Nhạc nền: có dòng Ngẫu nhiên ngay sau Tắt, bấm thì phát "nn"; đang bật thì dấu ✓ ở dòng đó', async () => {
    localStorage.clear(); vi.resetModules();
    const ChonNhac = (await import('@/components/ChonNhac.vue')).default;
    const w = mount(ChonNhac, { props: { nhac: true, bai: 'dem', ngauNhien: false }, attachTo: document.body });
    const dong = () => w.findAll('.cn-ds .dong, .cn-ds .o-bai');
    expect(dong()).toHaveLength(11);
    await dong()[1]!.trigger('click');
    expect(w.emitted('chon')).toEqual([['nn']]);
    await w.setProps({ ngauNhien: true });
    expect(dong()[1]!.attributes('aria-checked')).toBe('true');
    expect(dong().filter((d) => d.find('.dang').exists())).toHaveLength(1);
    expect(dong()[3]!.classes(), 'bài đang phát vẫn có viền').toContain('chon');
    w.unmount();
  });

  it('App: đổi bài chỉ trong các bài CHƠI ĐƯỢC, khác bài đang phát; chọn tay/Tắt là thôi; nhịp 30 phút ngoài ván', () => {
    const s = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
    expect(s).toContain('BAI_NHAC.filter((b) => baiChoiDuoc(b) && b !== baiNhac.value)');
    expect(s).toMatch(/if \(v === 'off'\) \{ nhacBat\.value = false; nhacNgauNhien\.value = false; return; \}/);
    expect(s).toMatch(/nhacNgauNhien\.value = false; baiNhac\.value = v;/);
    // nhịp 30 phút, KHÔNG đổi trong ván: cửa chặn nằm ở đầu hàm, và rời ván là hỏi lại
    expect(s).toMatch(/function doiNgauNhienNeuDenGio\(\): void \{\s*if \(trongVan\.value \|\| /);
    expect(s).toMatch(/if \(!denGioDoi\(\)\) return;\s*doiCanhNgauNhien\(\); doiNhacNgauNhien\(\);\s*ghiMocDoi\(\);/);
    expect(s).toContain('watch(trongVan, (v) => { if (!v) doiNgauNhienNeuDenGio(); });');
    expect(s, 'không còn đổi mỗi lần về trang chủ').not.toMatch(/sc === 'menu' && cu !== 'menu'\) \{ doiCanhNgauNhien/);
    expect(s).toContain('nhacNgauNhien: nhacNgauNhien.value');
  });
});

describe('nhịp đổi ngẫu nhiên: 30 phút một lần', () => {
  it('chưa đủ 30 phút thì chưa đổi, đủ thì đổi; mốc tính xuyên các lần mở app', async () => {
    localStorage.clear(); vi.resetModules();
    const n = await import('@/lib/ngau-nhien');
    const T = 1_800_000_000_000;
    n.ghiMocDoi(T);
    expect(n.denGioDoi(T + 10 * 60_000)).toBe(false);
    expect(n.denGioDoi(T + 29 * 60_000 + 59_000)).toBe(false);
    expect(n.denGioDoi(T + 30 * 60_000)).toBe(true);
    vi.resetModules();                                   // mở app lần khác: mốc vẫn còn
    const n2 = await import('@/lib/ngau-nhien');
    expect(n2.denGioDoi(T + 45 * 60_000)).toBe(true);
    n2.ghiMocDoi(T + 45 * 60_000);
    expect(n2.denGioDoi(T + 50 * 60_000)).toBe(false);
  });

  it('chưa có mốc hoặc đồng hồ bị chỉnh lùi thì đặt mốc mới, chưa đổi', async () => {
    localStorage.clear(); vi.resetModules();
    const n = await import('@/lib/ngau-nhien');
    const T = 1_800_000_000_000;
    expect(n.denGioDoi(T)).toBe(false);
    expect(n.denGioDoi(T + 30 * 60_000)).toBe(true);
    n.ghiMocDoi(T + 5 * 3_600_000);
    expect(n.denGioDoi(T), 'mốc ở tương lai').toBe(false);
    expect(n.denGioDoi(T + 31 * 60_000)).toBe(true);
  });

  it('bật Ngẫu nhiên ở bảng hình nền là đặt mốc — 30 phút tính từ lúc bật', async () => {
    const c = await napCanh(true);
    c.datCanhNgauNhien(true);
    const n = await import('@/lib/ngau-nhien');
    expect(n.denGioDoi()).toBe(false);
    expect(n.denGioDoi(Date.now() + 31 * 60_000)).toBe(true);
  });
});
