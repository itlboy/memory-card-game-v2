// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CỬA HÀNG THẬT (lib/cua-hang.ts) — SDK RevenueCat được GIẢ ở đây: chưa có khoá + gói trên store nên không gọi thật được.
 * Test canh phần mình viết: khi nào chạy thật, đọc giá / dùng thử / quyền lợi (kể cả gói TẶNG vĩnh viễn) ra sao.
 */
const goi = (id: string, price: number, intro?: object) => ({ product: { identifier: id, price, priceString: `$${price}`, currencyCode: 'USD', pricePerMonth: id.includes('nam') ? price / 12 : price, introPrice: intro ?? null } });
const quyen = (o: object) => ({ productIdentifier: 'premium_nam', latestPurchaseDateMillis: 1000, expirationDateMillis: 9_000_000_000_000, periodType: 'NORMAL', ...o });
const info = (q?: object, tungCo = !!q) => ({ originalAppUserId: '$RCAnonymousID:abc', entitlements: { active: q ? { premium: q } : {}, all: tungCo ? { premium: q ?? {} } : {} } });

type Gia = { Capacitor?: unknown };
let P: Record<string, ReturnType<typeof vi.fn>>;
async function nap(khoa = 'appl_test', coPlugin = true) {
  vi.doMock('@/lib/native', () => ({ laApp: true, nenApp: 'ios' }));
  vi.doMock('@revenuecat/purchases-capacitor', () => ({ Purchases: P }));
  (globalThis as Gia).Capacitor = { isPluginAvailable: () => coPlugin };
  const m = await import('@/lib/cua-hang');
  m.KHOA_RC.ios = khoa;
  return m;
}

describe('cửa hàng thật (RevenueCat giả)', () => {
  beforeEach(() => {
    vi.resetModules();
    P = {
      configure: vi.fn(async () => undefined), addCustomerInfoUpdateListener: vi.fn(async () => 'cb'),
      getOfferings: vi.fn(async () => ({ current: { monthly: goi('premium_thang', 1.99), annual: goi('premium_nam', 9.99, { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 }) } })),
      getCustomerInfo: vi.fn(async () => ({ customerInfo: info() })),
      purchasePackage: vi.fn(), restorePurchases: vi.fn()
    };
  });
  afterEach(() => { vi.doUnmock('@/lib/native'); vi.doUnmock('@revenuecat/purchases-capacitor'); (globalThis as Gia).Capacitor = undefined; });

  it('thiếu khoá hoặc bản app chưa có plugin → không chạy thật, không đụng SDK', async () => {
    let m = await nap('');
    expect(m.coCuaHangThat()).toBe(false);
    expect(await m.khoiDongCuaHang(() => undefined)).toBeNull();
    vi.resetModules();
    m = await nap('appl_test', false);
    expect(m.coCuaHangThat()).toBe(false);
    expect(P.configure).not.toHaveBeenCalled();
  });

  it('nối được: đọc giá từ store, 7 ngày dùng thử, tiết kiệm gói năm, mã người dùng', async () => {
    const m = await nap();
    const r = (await m.khoiDongCuaHang(() => undefined))!;
    expect(P.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
    expect(r.trangThai).toBeNull();
    expect(r.ma).toBe('$RCAnonymousID:abc');
    expect(r.gia).toMatchObject({ thang: '$1.99', nam: '$9.99', ngayThu: 7, duocThu: true, tietKiem: 58 });
  });

  it('mua: đang dùng thử thì có mốc hết thử; người chơi đóng bảng thanh toán là "huy"; lỗi khác là "loi"', async () => {
    const m = await nap();
    await m.khoiDongCuaHang(() => undefined);
    P.purchasePackage!.mockResolvedValueOnce({ customerInfo: info(quyen({ periodType: 'TRIAL', expirationDateMillis: 5000 })) });
    expect(await m.muaThat('nam')).toEqual({ kq: 'ok', trangThai: { goi: 'nam', tu: 1000, het: 5000, thuDen: 5000, ma: '$RCAnonymousID:abc' } });
    P.purchasePackage!.mockRejectedValueOnce({ userCancelled: true });
    expect((await m.muaThat('thang')).kq).toBe('huy');
    P.purchasePackage!.mockRejectedValueOnce(new Error('mạng'));
    expect((await m.muaThat('thang')).kq).toBe('loi');
  });

  it('gói TẶNG vĩnh viễn: không ngày hết hạn, không khớp gói đang bán; đã từng có quyền lợi thì hết lượt dùng thử', async () => {
    P.getCustomerInfo!.mockResolvedValue({ customerInfo: info(quyen({ productIdentifier: 'rc_promo_premium_lifetime', expirationDateMillis: null })) });
    const m = await nap();
    const r = (await m.khoiDongCuaHang(() => undefined))!;
    expect(r.trangThai).toMatchObject({ goi: null, het: null });
    expect(r.gia!.duocThu).toBe(false);
    P.restorePurchases!.mockResolvedValueOnce({ customerInfo: info() });
    expect(await m.khoiPhucThat()).toBeNull();
  });
});
