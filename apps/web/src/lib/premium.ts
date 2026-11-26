import { computed, ref, watch } from 'vue';
import type { CardTheme } from './themes';
import { dangDebug } from './debug';
import { coCuaHangThat, khoiDongCuaHang, khoiPhucThat, muaThat, type BangGia, type TrangThaiMua } from './cua-hang';

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
/** `tang`: gói QUÀ TẶNG 1 tháng (xem `nhanQuaTang`) — không qua cửa hàng, hết hạn là về bản thường. */
export interface GoiDangCo { goi: Goi; tu: number; het: number; thuDen?: number; vinhVien?: boolean; tang?: boolean }
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

/*
 * ---------- QUÀ TẶNG 1 THÁNG PREMIUM (26.11.2026, mockup duyệt https://claude.ai/artifact/5y6jdDcExegghTLJbfWKUc) ----------
 * Chủ dự án: tặng mỗi người 1 tháng Premium trước khi có thanh toán, người chơi tự bấm NHẬN ở bảng Premium (mở từ viên
 * Premium trang chủ). "Vẫn chờ tôi chốt đã, hiện tại vẫn cho chế độ debug thôi" → viên Premium và bảng chỉ hiện khi debug.
 *
 * Gói tặng nằm HOÀN TOÀN trên máy (không server, không cửa hàng): `mm.premium.goi` với `tang: true`, hạn 30 ngày TÍNH TỪ LÚC
 * BẤM NHẬN. `mm.premium.tang` ghi mốc đã nhận → mỗi máy một lần. Hết hạn: `docGoi()` lúc mở app (hoặc `kiemHetHanTang()` lúc
 * app đang chạy) gỡ gói, người chơi về bản thường — chủ đề về gốc nhờ `watch(daMuaPremium)` ở lib/canh.
 * Xoá dữ liệu app là nhận lại được: chấp nhận, đây là quà chứ không phải thứ cần chống gian lận.
 */
export const NGAY_TANG = 30;
const KHOA_TANG = 'mm.premium.tang';
function docDaNhanTang(): boolean { try { return Number(localStorage.getItem(KHOA_TANG)) > 0; } catch { return false; } }
export const daNhanTang = ref(docDaNhanTang());
/** Còn quà để nhận: chưa nhận lần nào VÀ chưa có Premium bằng đường khác. */
export const conQuaTang = computed(() => !daNhanTang.value && !daMuaPremium.value);
/** Số ngày còn lại của gói đang có (làm tròn lên; 0 = hết hoặc không có hạn). */
export function ngayConLai(bayGio = Date.now()): number {
  const g = goiDangCo.value;
  return g && !g.vinhVien && g.het > bayGio ? Math.ceil((g.het - bayGio) / NGAY) : 0;
}
/** Bấm "Nhận miễn phí". true = đã có Premium tới ngày hết hạn. */
export function nhanQuaTang(bayGio = Date.now()): boolean {
  if (!conQuaTang.value) return false;
  const g: GoiDangCo = { goi: 'thang', tu: bayGio, het: bayGio + NGAY_TANG * NGAY, tang: true };
  goiDangCo.value = g; daMuaPremium.value = true; daNhanTang.value = true;
  try { localStorage.setItem(KHOA_GOI, JSON.stringify(g)); localStorage.setItem(KHOA_TANG, String(bayGio)); } catch { /* chế độ riêng tư */ }
  return true;
}
/** App đang mở mà gói tặng vừa hết hạn → về bản thường ngay (App.vue gọi mỗi phút). true = vừa hết. */
export function kiemHetHanTang(bayGio = Date.now()): boolean {
  const g = goiDangCo.value;
  if (!g?.tang || g.het > bayGio) return false;
  goiDangCo.value = null; daMuaPremium.value = docCo();
  try { localStorage.removeItem(KHOA_GOI); } catch { /* chế độ riêng tư */ }
  return true;
}

/** Bật/tắt "đã mua" để THỬ — công tắc ở trang debug. Tắt là xoá luôn gói giả lập. Chỉ máy này, không mua thật. */
export function datPremiumThu(v: boolean): void {
  daMuaPremium.value = v;
  if (!v) goiDangCo.value = null;
  try {
    if (v) localStorage.setItem(KHOA, '1');
    else { localStorage.removeItem(KHOA); localStorage.removeItem(KHOA_GOI); localStorage.removeItem(KHOA_DA_THU); localStorage.removeItem(KHOA_TANG); conDungThu.value = true; daNhanTang.value = false; }   // tắt bản thử: trả lại lượt dùng thử + quà tặng để thử lại luồng
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

/*
 * ---------- CỬA HÀNG THẬT (lib/cua-hang.ts, RevenueCat) ----------
 * Khi `cuaHangThat` bật thì ba hàm bên dưới gọi store thật thay cho giả lập. Chỉ nối SDK khi ĐANG DEBUG (Premium chưa
 * mở cho mọi người) — người chơi thường không bị tạo hồ sơ RevenueCat. Quyền lợi đọc được cũng ghi vào `mm.premium.goi`
 * để lần mở sau có Premium ngay cả khi chưa kịp hỏi store (mất mạng).
 */
export const cuaHangThat = ref(false);
/** Giá đã quy đổi theo nước từ store — null thì giao diện dùng `GIA_TAM`. */
export const giaThat = ref<BangGia | null>(null);
/** Mã người dùng bên RevenueCat — cần để TẶNG gói từ bảng điều khiển; hiện ở cuối bảng Premium. */
export const maPremium = ref('');
const XA = 100 * 365 * NGAY;
function apThat(t: TrangThaiMua | null): void {
  if (t?.ma) maPremium.value = t.ma;
  const g: GoiDangCo | null = t ? { goi: t.goi ?? 'nam', tu: t.tu, het: t.het ?? Date.now() + XA, ...(t.thuDen ? { thuDen: t.thuDen } : {}), ...(t.het === null ? { vinhVien: true } : {}) } : null;
  // Cửa hàng báo "không có gói" KHÔNG được xoá gói QUÀ TẶNG còn hạn — quà nằm trên máy, cửa hàng không biết tới nó
  const tang = goiDangCo.value;
  if (!g && tang?.tang && tang.het > Date.now()) return;
  goiDangCo.value = g;
  daMuaPremium.value = !!g || docCo();
  try { if (g) localStorage.setItem(KHOA_GOI, JSON.stringify(g)); else localStorage.removeItem(KHOA_GOI); } catch { /* chế độ riêng tư */ }
}
let dangNoi = false;
async function noiCuaHang(): Promise<void> {
  if (dangNoi || !coCuaHangThat()) return;
  dangNoi = true;
  const r = await khoiDongCuaHang(apThat);
  dangNoi = false;
  if (!r) return;
  cuaHangThat.value = true; giaThat.value = r.gia; maPremium.value = r.ma;
  apThat(r.trangThai);
}
watch(dangDebug, (v) => { if (v) void noiCuaHang(); }, { immediate: true });

/* ---------- CỬA HÀNG (giả lập — xem đầu file) ---------- */
const nghi = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Thời gian "cửa hàng xử lý" giả lập — test đặt 0. */
export const TRE_CUA_HANG = { ms: 1400 };

/** Mua một gói. 'ok' = đã có Premium · 'huy' = người chơi đóng bảng thanh toán · 'loi' = cửa hàng báo lỗi. */
export async function muaGoi(goi: Goi): Promise<'ok' | 'huy' | 'loi'> {
  if (cuaHangThat.value) { const r = await muaThat(goi); if (r.kq === 'ok') apThat(r.trangThai ?? null); return r.kq; }
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
  if (cuaHangThat.value) { const t = await khoiPhucThat(); apThat(t); return !!t; }
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
