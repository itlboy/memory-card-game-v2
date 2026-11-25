import { computed, ref } from 'vue';
import type { CardTheme } from './themes';

/**
 * GÓI PREMIUM — gói THÁNG / NĂM (chủ dự án 25.11.2026), mở mọi thứ premium: hình nền hành tinh, skin, nhạc, theme…
 *
 * CHƯA BÁN THẬT — CỬA HÀNG GIẢ LẬP. Mọi màn (BangPremium…) chỉ gọi BA HÀM ở cuối file: `muaGoi`, `khoiPhucMua`,
 * `huyGoiThu`. Hiện chúng giả lập cửa hàng ngay trên máy (chờ ~1,4 giây rồi ghi gói vào localStorage `mm.premium.goi`),
 * để đi hết luồng thật: chọn gói → đang xử lý → cảm ơn → thấy ngày gia hạn → khôi phục → huỷ. KHÔNG có đồng nào bị thu.
 *
 * NỐI THANH TOÁN THẬT (Apple / Google bắt buộc In-App Purchase cho đồ số): chỉ thay THÂN ba hàm đó bằng lời gọi SDK
 * (dự kiến RevenueCat: `purchasePackage`, `restorePurchases`, đọc `entitlements.active`) và lấy GIÁ từ store thay cho
 * `GIA_TAM`. Giao diện không phải đổi. Cần bản app native mới (thêm plugin) — không đi được bằng cập nhật nóng.
 *
 * `mm.premium='1'` (cờ cũ, công tắc "Mở Premium để thử" ở trang debug) vẫn dùng được: có Premium mà không mang gói nào.
 *
 * Online: chỉ CHỦ PHÒNG cần sở hữu; người vào phòng chơi cùng bàn premium được. Server không kiểm — game chơi với
 * bạn bè, không chống gian lận.
 */
export type Goi = 'thang' | 'nam';
export interface GoiDangCo { goi: Goi; tu: number; het: number }
/** Giá TẠM (đồng) — chủ dự án chưa chốt; bán thật thì đọc giá đã quy đổi từ store. */
export const GIA_TAM: Record<Goi, number> = { thang: 29000, nam: 199000 };
const NGAY = 86_400_000;
const KHOA = 'mm.premium';
const KHOA_GOI = 'mm.premium.goi';

function docCo(): boolean {
  try { return localStorage.getItem(KHOA) === '1'; } catch { return false; }
}
function docGoi(): GoiDangCo | null {
  try {
    const g = JSON.parse(localStorage.getItem(KHOA_GOI) ?? 'null') as GoiDangCo | null;
    if (!g || (g.goi !== 'thang' && g.goi !== 'nam') || !(g.het > Date.now())) { localStorage.removeItem(KHOA_GOI); return null; }
    return g;
  } catch { return null; }
}
/** Gói đang có (giả lập) — null = chưa mua hoặc đã hết hạn. */
export const goiDangCo = ref<GoiDangCo | null>(docGoi());
export const daMuaPremium = ref(docCo() || !!goiDangCo.value);

/** Bật/tắt "đã mua" để THỬ — công tắc ở trang debug. Tắt là xoá luôn gói giả lập. Chỉ máy này, không mua thật. */
export function datPremiumThu(v: boolean): void {
  daMuaPremium.value = v;
  if (!v) goiDangCo.value = null;
  try {
    if (v) localStorage.setItem(KHOA, '1');
    else { localStorage.removeItem(KHOA); localStorage.removeItem(KHOA_GOI); }
  } catch { /* chế độ riêng tư */ }
}

/**
 * CÔNG TẮC BÁN — `false`: chưa có In-App Purchase thì KHÔNG bày đồ Premium ra cho người chơi thường (đồ khoá mà không
 * mua được là App Review hay loại, luật 2.1). Có IAP thì bật `true`. Người đã có Premium (thử) vẫn thấy.
 */
export const banPremium = ref(false);   // ref (không const) để test bật được luồng đã mở bán
export const hienPremium = computed(() => banPremium.value || daMuaPremium.value);

/** Theme này người chơi có được CHỌN không. */
export const choiDuoc = (t: Pick<CardTheme, 'premium'>): boolean => !t.premium || daMuaPremium.value;

/* ---------- CỬA HÀNG (giả lập — xem đầu file) ---------- */
const nghi = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Thời gian "cửa hàng xử lý" giả lập — test đặt 0. */
export const TRE_CUA_HANG = { ms: 1400 };

/** Mua một gói. 'ok' = đã có Premium · 'huy' = người chơi đóng bảng thanh toán · 'loi' = cửa hàng báo lỗi. */
export async function muaGoi(goi: Goi): Promise<'ok' | 'huy' | 'loi'> {
  await nghi(TRE_CUA_HANG.ms);
  const tu = Date.now();
  const g: GoiDangCo = { goi, tu, het: tu + (goi === 'nam' ? 365 : 30) * NGAY };
  goiDangCo.value = g;
  daMuaPremium.value = true;
  try { localStorage.setItem(KHOA_GOI, JSON.stringify(g)); } catch { /* chế độ riêng tư */ }
  return 'ok';
}

/** Khôi phục giao dịch (đổi máy / cài lại). true = tìm thấy gói còn hạn. */
export async function khoiPhucMua(): Promise<boolean> {
  await nghi(Math.min(TRE_CUA_HANG.ms, 900));
  const g = docGoi();
  goiDangCo.value = g;
  if (g) daMuaPremium.value = true;
  return !!g;
}

/** Huỷ gói GIẢ LẬP (bán thật thì người chơi huỷ trong App Store / Google Play, app chỉ đọc lại trạng thái). */
export function huyGoiThu(): void { datPremiumThu(false); }
