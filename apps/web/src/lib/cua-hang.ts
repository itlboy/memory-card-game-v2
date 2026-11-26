import { laApp, nenApp } from './native';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';

/**
 * CỬA HÀNG THẬT — In-App Purchase qua RevenueCat (26.11.2026, chủ dự án chốt dùng RevenueCat; "triển khai tính năng mua
 * thật, vẫn để chế độ debug"). File này CHỈ nói chuyện với SDK và trả về dữ liệu thô; lib/premium.ts quyết định dùng nó
 * hay cửa hàng giả lập, và giữ các ref mà giao diện đọc.
 *
 * BA ĐIỀU KIỆN mới chạy thật (`coCuaHangThat`), thiếu một là app dùng cửa hàng giả lập như trước:
 *  1. đang là app iOS / Android (web không có In-App Purchase);
 *  2. bản app native ĐÃ CÓ plugin (bản cũ nhận cập nhật nóng thì chưa có → `isPluginAvailable` = false);
 *  3. đã điền khoá SDK công khai của RevenueCat cho nền tảng đó ở `KHOA_RC`.
 *
 * KHOÁ SDK CÔNG KHAI (`appl_…` / `goog_…`) vốn nằm trong app, không phải bí mật — được phép commit. KHÔNG BAO GIỜ đặt
 * khoá bí mật (`sk_…`) ở đây.
 *
 * TRÊN STORE + REVENUECAT phải có (chủ dự án tạo): hai gói định kỳ `premium_thang`, `premium_nam` trong offering mặc
 * định (gói Monthly + Annual), cùng gắn vào quyền lợi `premium`. Dùng thử miễn phí = ưu đãi mở đầu khai trên store.
 * TẶNG (theo tháng / vĩnh viễn — chủ dự án: "vĩnh viễn chỉ để tặng"): cấp quyền lợi `premium` cho MÃ người dùng
 * (`ma`, hiện ở cuối bảng Premium) trong bảng điều khiển RevenueCat; quyền vĩnh viễn không có ngày hết hạn.
 */
export const KHOA_RC: Record<'ios' | 'android', string> = { ios: '', android: '' };
export const QUYEN = 'premium';
const PLUGIN = 'Purchases';

export function coCuaHangThat(): boolean {
  if (!laApp || nenApp === 'web' || !KHOA_RC[nenApp]) return false;
  const cap = (globalThis as { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  return cap?.isPluginAvailable?.(PLUGIN) === true;
}

/** Quyền lợi đang có. `het` null = vĩnh viễn (được tặng). `goi` null = không khớp gói nào đang bán (cũng là được tặng). */
export interface TrangThaiMua { goi: 'thang' | 'nam' | null; tu: number; het: number | null; thuDen?: number; ma: string }
/** Giá đã quy đổi theo nước, lấy từ store. `ngayThu` = số ngày dùng thử của gói năm (0 = không có); `duocThu` = người này còn được dùng thử. */
export interface BangGia { thang: string; nam: string; namMoiThang: string; tietKiem: number; ngayThu: number; duocThu: boolean }

let goiBan: { thang: PurchasesPackage | null; nam: PurchasesPackage | null } = { thang: null, nam: null };
let sanSang: Promise<boolean> | null = null;

const sdk = async () => (await import('@revenuecat/purchases-capacitor')).Purchases;

function docTrangThai(info: CustomerInfo): TrangThaiMua | null {
  const q = info.entitlements.active[QUYEN];
  if (!q) return null;
  const sp = q.productIdentifier;
  const goi = sp === goiBan.nam?.product.identifier ? 'nam' : sp === goiBan.thang?.product.identifier ? 'thang'
    : /nam|year|annual/i.test(sp) ? 'nam' : /thang|month/i.test(sp) ? 'thang' : null;
  const het = q.expirationDateMillis ?? null;
  return {
    goi, tu: q.latestPurchaseDateMillis, het, ma: info.originalAppUserId,
    ...(q.periodType === 'TRIAL' && het ? { thuDen: het } : {})
  };
}

function docGia(info: CustomerInfo): BangGia | null {
  const { thang, nam } = goiBan;
  if (!thang || !nam) return null;
  const mo = nam.product.introPrice;
  const doi = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 } as Record<string, number>;
  const ngayThu = mo && mo.price === 0 ? (doi[mo.periodUnit] ?? 0) * mo.periodNumberOfUnits * Math.max(1, mo.cycles) : 0;
  const moiThang = nam.product.pricePerMonth ?? nam.product.price / 12;
  return {
    thang: thang.product.priceString, nam: nam.product.priceString,
    namMoiThang: new Intl.NumberFormat(undefined, { style: 'currency', currency: nam.product.currencyCode, maximumFractionDigits: moiThang >= 1000 ? 0 : 2 }).format(moiThang),
    tietKiem: Math.max(0, Math.round((1 - nam.product.price / (thang.product.price * 12)) * 100)),
    // Chưa từng có quyền lợi này = còn lượt dùng thử (store là nơi quyết định cuối cùng lúc thanh toán)
    ngayThu, duocThu: ngayThu > 0 && !info.entitlements.all[QUYEN]
  };
}

/**
 * Nối SDK (một lần), đọc gói đang bán + quyền lợi hiện có. `khiDoi` được gọi mỗi khi quyền lợi đổi (gia hạn, hết hạn,
 * được tặng, mua ở máy khác). Trả null khi không chạy được cửa hàng thật.
 */
export async function khoiDongCuaHang(khiDoi: (t: TrangThaiMua | null) => void): Promise<{ trangThai: TrangThaiMua | null; gia: BangGia | null; ma: string } | null> {
  if (!coCuaHangThat() || nenApp === 'web') return null;
  const P = await sdk();
  sanSang ??= (async () => {
    await P.configure({ apiKey: KHOA_RC[nenApp as 'ios' | 'android'] });
    await P.addCustomerInfoUpdateListener((info) => khiDoi(docTrangThai(info)));
    return true;
  })();
  try {
    await sanSang;
    const of = await P.getOfferings();
    goiBan = { thang: of.current?.monthly ?? null, nam: of.current?.annual ?? null };
    const { customerInfo } = await P.getCustomerInfo();
    return { trangThai: docTrangThai(customerInfo), gia: docGia(customerInfo), ma: customerInfo.originalAppUserId };
  } catch { sanSang = null; return null; }
}

export async function muaThat(goi: 'thang' | 'nam'): Promise<{ kq: 'ok' | 'huy' | 'loi'; trangThai?: TrangThaiMua | null }> {
  const g = goiBan[goi];
  if (!g) return { kq: 'loi' };
  try {
    const { customerInfo } = await (await sdk()).purchasePackage({ aPackage: g });
    const t = docTrangThai(customerInfo);
    return t ? { kq: 'ok', trangThai: t } : { kq: 'loi' };
  } catch (e) {
    return { kq: (e as { userCancelled?: boolean | null })?.userCancelled ? 'huy' : 'loi' };
  }
}

export async function khoiPhucThat(): Promise<TrangThaiMua | null> {
  try { return docTrangThai((await (await sdk()).restorePurchases()).customerInfo); } catch { return null; }
}
