import { computed, ref } from 'vue';
import type { CardTheme } from './themes';
import { dangDebug } from './debug';

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
/** `thuDen`: đang trong thời gian DÙNG THỬ miễn phí tới mốc này (chưa bị tính tiền). */
export interface GoiDangCo { goi: Goi; tu: number; het: number; thuDen?: number }
/** Số ngày dùng thử miễn phí cho lần đăng ký ĐẦU (26.11.2026, chủ dự án: "có báo thời gian dùng thử"). Bán thật = ưu đãi mở đầu khai trên store. */
export const NGAY_DUNG_THU = 7;
const KHOA_DA_THU = 'mm.premium.daThu';
function docDaThu(): boolean { try { return localStorage.getItem(KHOA_DA_THU) === '1'; } catch { return false; } }
/** Còn được dùng thử không — mỗi người một lần (store cũng chỉ cho một lần mỗi tài khoản). */
export const conDungThu = ref(!docDaThu());
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
    else { localStorage.removeItem(KHOA); localStorage.removeItem(KHOA_GOI); localStorage.removeItem(KHOA_DA_THU); conDungThu.value = true; }   // tắt bản thử: trả lại lượt dùng thử để thử lại luồng
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
  const thu = conDungThu.value ? NGAY_DUNG_THU * NGAY : 0;
  const g: GoiDangCo = { goi, tu, het: tu + thu + (goi === 'nam' ? 365 : 30) * NGAY, ...(thu ? { thuDen: tu + thu } : {}) };
  conDungThu.value = false;
  try { localStorage.setItem(KHOA_DA_THU, '1'); } catch { /* chế độ riêng tư */ }
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

/*
 * LỜI MỜI NÂNG CẤP (26.11.2026, chủ dự án: "cần có các nút để người dùng nâng cấp ngay trên giao diện"). Mọi nút
 * nâng cấp trong app gọi `moPremium(<nơi bấm>)`; App.vue nghe `yeuCauPremium` rồi mở BangPremium, bảng dùng `tu` để
 * mở đầu bằng đúng thứ người chơi vừa chạm vào. `moiNangCap` = có bày các nút đó không: CHƯA BÁN THẬT nên chỉ khi
 * đang debug (đồ khoá mà không mua được là App Review loại), và thôi mời khi đã có gói.
 */
export type NoiMoPremium = 'menu' | 'trang-chu' | 'cai-dat' | 'nen' | 'nhac' | 'tri-nho' | 'debug';
/** `canh`: hình nền người chơi vừa bấm (đang khoá) — bảng Premium mở đầu bằng đúng hình đó. */
export const yeuCauPremium = ref<{ tu: NoiMoPremium; lan: number; canh?: string } | null>(null);
export function moPremium(tu: NoiMoPremium, canh?: string): void {
  yeuCauPremium.value = { tu, canh, lan: (yeuCauPremium.value?.lan ?? 0) + 1 };
}
export const moiNangCap = computed(() => (banPremium.value || dangDebug.value) && !daMuaPremium.value);
