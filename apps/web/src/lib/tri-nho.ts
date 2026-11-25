/**
 * CHỈ SỐ TRÍ NHỚ (bản 3, 25.11.2026 — trang nghiên cứu duyệt https://claude.ai/artifact/D1HPHCCMsVXdgzoFwRjjsu).
 * MỞ CHO MỌI NGƯỜI từ 1.9.66 (25.11.2026, chủ dự án: "bật tính năng chỉ số trí nhớ cho tất cả mọi người luôn"). Công thức ở engine (`chiSoTriNho`): cộng 5 chặng nhớ, đã trừ ăn may.
 * File này GỘP nhật ký thô (`storage.ts`, số đếm theo ngày × cỡ bàn) thành chỉ số của một KỲ 7 NGÀY, tính bậc, và
 * giữ "vừa đổi bao nhiêu" sau mỗi ván cho bảng kết quả + nút trang chủ.
 *
 * MỘT CON SỐ cho cả game: không còn điểm riêng của từng ván (một ván quá ít số liệu để chấm 5 chặng) — sau ván chỉ
 * báo chỉ số 7 ngày vừa đổi bao nhiêu.
 */
import { MOC_BAC_TRI_NHO, bacTriNho, chiSoTriNho, chiSoVan, coHoiNho, rongNhomTuoi, type ChangNho } from '@mm/engine';
import { ref } from 'vue';
import { mayUocLuong, ngayMay, store, type NgayTriNho } from './storage';

/** Bật = GHI nhật ký trí nhớ và HIỆN chỉ số. Trước 1.9.66 theo cờ debug; nay LUÔN bật — giữ làm công tắc để tắt nhanh nếu cần. */
export const hienTriNho = ref(true);

/** Kỳ tính chỉ số: 7 ngày kết thúc ở ngày đang xem. */
export const SO_NGAY_KY = 7;
/**
 * Cần ngần này CƠ HỘI NHỚ trong kỳ mới bày con số (chủ dự án 23.11.2026: "chơi ít quá không đủ số liệu để tham
 * khảo"). Đếm cơ hội chứ không đếm ván: ván 8 thẻ và ván 60 thẻ cho lượng số liệu khác hẳn nhau.
 */
export const MOC_CO_DIEM = 20;

export interface ChiSo {
  /** 0–1000; `null` = chưa đủ số liệu (dưới `MOC_CO_DIEM` cơ hội, hoặc chưa chặng nào mở). */
  diem: number | null;
  chang: ChangNho[];
  /** Bậc 0–4 (Đồng → Kim cương); `null` khi chưa có điểm. */
  bac: number | null;
  /** Điểm còn thiếu để lên bậc kế; `null` khi chưa có điểm hoặc đã ở bậc cao nhất. */
  conToiBac: number | null;
  /** Đã đi được bao nhiêu phần của bậc hiện tại (0..1) — viền nút trang chủ. */
  tienBac: number;
  van: number;
  coHoi: number;
  /** Lần nhớ đúng xa nhất trong kỳ (số lượt). */
  tam: number;
}

/** Gộp nhiều ngày thành chỉ số của một kỳ. Số liệu cũ không có phần ăn may thì ước lượng (`mayUocLuong`). */
export function chiSo(cacNgay: readonly (NgayTriNho | undefined)[]): ChiSo {
  const nho = rongNhomTuoi(), quen = rongNhomTuoi(), may = rongNhomTuoi();
  let van = 0, tam = 0;
  for (const n of cacNgay) {
    if (!n) continue;
    tam = Math.max(tam, n.tam ?? 0);
    for (const [k, d] of Object.entries(n.ban ?? {})) {
      van += d.van;
      const m = d.may ?? mayUocLuong(d.nho, d.quen, Number(k));
      for (let i = 0; i < nho.length; i++) { nho[i]! += d.nho?.[i] ?? 0; quen[i]! += d.quen?.[i] ?? 0; may[i]! += m[i] ?? 0; }
    }
  }
  const coHoi = coHoiNho(nho, quen);
  const k = chiSoTriNho(nho, quen, may);
  const diem = coHoi >= MOC_CO_DIEM ? k.diem : null;
  const bac = diem === null ? null : bacTriNho(diem);
  const mocKe = bac === null ? undefined : MOC_BAC_TRI_NHO[bac + 1];
  const mocNay = bac === null ? 0 : MOC_BAC_TRI_NHO[bac]!;
  return {
    diem, chang: k.chang, bac,
    conToiBac: diem === null || mocKe === undefined ? null : mocKe - diem,
    tienBac: diem === null ? 0 : mocKe === undefined ? 1 : (diem - mocNay) / (mocKe - mocNay),
    van, coHoi, tam
  };
}

/** `soNgay` ngày liên tiếp kết thúc ở `den` (kể cả `den`), cũ → mới, dạng `YYYY-MM-DD`. */
export function dayNgay(soNgay: number, den = new Date()): string[] {
  return Array.from({ length: soNgay }, (_, i) => {
    const d = new Date(den.getFullYear(), den.getMonth(), den.getDate() - (soNgay - 1 - i), 12);
    return ngayMay(d);
  });
}
/** Khoá `YYYY-MM-DD` → Date giữa trưa (tránh lệch ngày vì múi giờ / giờ mùa hè). */
export const ngayTuKhoa = (k: string): Date => { const [y, m, d] = k.split('-').map(Number); return new Date(y!, (m ?? 1) - 1, d ?? 1, 12); };

/** Chỉ số của kỳ 7 ngày KẾT THÚC ở ngày `den` (mặc định hôm nay) — cũng là thứ hiện khi bấm một ngày cũ trên biểu đồ. */
export function chiSoTai(nhatKy: Record<string, NgayTriNho>, den = new Date()): ChiSo {
  return chiSo(dayNgay(SO_NGAY_KY, den).map((k) => nhatKy[k]));
}

/** Chưa có số liệu của chính người chơi thì coi mỗi ván cho ngần này cơ hội nhớ (bàn 16–24 thẻ). */
export const CO_HOI_MOI_VAN_MAC_DINH = 6;
/**
 * CÒN PHẢI CHƠI KHOẢNG MẤY VÁN nữa để có điểm (chủ dự án 23.11.2026: "báo họ phải chơi thêm bao nhiêu để họ chơi").
 * Mốc tính bằng cơ hội nhớ, đổi ra ván bằng số cơ hội TRUNG BÌNH MỖI VÁN của chính người đó. 0 = đã đủ.
 */
export function vanConThieu(ky: Pick<ChiSo, 'coHoi' | 'van'>): number {
  if (ky.coHoi >= MOC_CO_DIEM) return 0;
  const moiVan = ky.van > 0 ? Math.max(1, ky.coHoi / ky.van) : CO_HOI_MOI_VAN_MAC_DINH;
  return Math.max(1, Math.ceil((MOC_CO_DIEM - ky.coHoi) / moiVan));
}

/**
 * NÊN LUYỆN BÀN BAO NHIÊU THẺ: chặng đầu tiên CHƯA MỞ quyết định (chặng dài cần bàn to: mô phỏng — bàn 16 thẻ không
 * bao giờ có chặng 16+ lượt); mở hết rồi thì luyện chặng có tỉ lệ thấp nhất. Chặng → số thẻ: 16 · 16 · 24 · 36 · 36.
 */
export const THE_LUYEN: readonly number[] = [16, 16, 24, 36, 36];
export function theNenLuyen(chang: readonly ChangNho[]): number {
  let i = chang.findIndex((c) => !c.mo);
  if (i < 0) i = chang.reduce((y, c, j) => ((c.tiLe ?? 1) < (chang[y]!.tiLe ?? 1) ? j : y), 0);
  return THE_LUYEN[i] ?? 24;
}

/* ---------- vừa đổi sau ván + đã xem ---------- */

/** Đổi là các chỗ đang hiện chỉ số (nút trang chủ) tính lại — nhật ký nằm ở localStorage, không tự phản ứng. */
export const phienTriNho = ref(0);
/** Chỉ số của kỳ hôm nay, đọc thẳng từ bản lưu. */
export const chiSoHomNay = (): ChiSo => chiSoTai(store.nhatKyTriNho());

export interface VuaDoi { truoc: number | null; sau: number | null; bacTruoc: number | null; bacSau: number | null;
  /** Chỉ số RIÊNG của ván vừa xong (`chiSoVan`, 0–1000) — thứ bảng kết quả hiện; `null` = ván quá ít cơ hội nhớ. */
  van: number | null }
/** Chỉ số trước/sau VÁN VỪA XONG — bảng kết quả đọc. `null` = ván vừa rồi không được chấm. */
export const vuaDoi = ref<VuaDoi | null>(null);

/**
 * Ghi một ván vào nhật ký (như `store.ghiTriNho`) và nhớ chỉ số đổi thế nào. Gọi TRƯỚC khi bảng kết quả mở.
 * Ván không có cơ hội nhớ nào thì không ghi, `vuaDoi` = null.
 */
export function ghiVanTriNho(
  p: { nhoTheo?: readonly number[]; quenTheo?: readonly number[]; mayTheo?: readonly number[]; tamNho?: number } | undefined, soCap: number
): void {
  vuaDoi.value = null;
  if (!p || coHoiNho(p.nhoTheo, p.quenTheo) === 0) return;
  const truoc = chiSoHomNay();
  store.ghiTriNho(p, soCap);
  const sau = chiSoHomNay();
  vuaDoi.value = { truoc: truoc.diem, sau: sau.diem, bacTruoc: truoc.bac, bacSau: sau.bac, van: chiSoVan(p.nhoTheo, p.quenTheo, p.mayTheo) };
  phienTriNho.value++;
}

/** Điểm người chơi đã XEM lần cuối ở màn chỉ số — nút trang chủ chỉ nhấp nháy khi điểm khác số này. */
export function daXemTriNho(): void {
  const d = chiSoHomNay().diem;
  if (d !== null && store.prefs().triNhoXem !== d) store.savePrefs({ triNhoXem: d });
  phienTriNho.value++;
}
