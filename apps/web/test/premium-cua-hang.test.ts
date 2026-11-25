import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('cửa hàng Premium giả lập', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('mua gói: có Premium + gói còn hạn (tháng 30 ngày, năm 365 ngày), nhớ qua lần mở sau', async () => {
    let m = await import('@/lib/premium');
    m.TRE_CUA_HANG.ms = 0;
    expect(m.daMuaPremium.value).toBe(false);
    expect(await m.muaGoi('nam')).toBe('ok');
    expect(m.daMuaPremium.value).toBe(true);
    const g = m.goiDangCo.value!;
    expect(g.goi).toBe('nam');
    expect(Math.round((g.het - g.tu) / 86_400_000)).toBe(365);
    vi.resetModules();
    m = await import('@/lib/premium');
    expect(m.daMuaPremium.value).toBe(true);
    expect(m.goiDangCo.value?.goi).toBe('nam');
  });

  it('gói hết hạn thì mất Premium; khôi phục không thấy gì', async () => {
    localStorage.setItem('mm.premium.goi', JSON.stringify({ goi: 'thang', tu: 1, het: Date.now() - 1000 }));
    const m = await import('@/lib/premium');
    m.TRE_CUA_HANG.ms = 0;
    expect(m.daMuaPremium.value).toBe(false);
    expect(await m.khoiPhucMua()).toBe(false);
    expect(localStorage.getItem('mm.premium.goi')).toBeNull();
  });

  it('khôi phục thấy gói còn hạn; huỷ thì mất Premium và hình nền hành tinh về mặc định', async () => {
    localStorage.setItem('mm.premium.goi', JSON.stringify({ goi: 'thang', tu: Date.now(), het: Date.now() + 86_400_000 }));
    const m = await import('@/lib/premium');
    const c = await import('@/lib/canh');
    m.TRE_CUA_HANG.ms = 0;
    m.daMuaPremium.value = false;
    expect(await m.khoiPhucMua()).toBe(true);
    expect(m.daMuaPremium.value).toBe(true);
    c.datCanh('sao-moc');
    expect(document.documentElement.dataset.canh).toBe('sao-moc');
    m.huyGoiThu();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.daMuaPremium.value).toBe(false);
    expect(c.canh.value).toBe('goc');
    expect(document.documentElement.dataset.canh).toBeUndefined();
  });
});
