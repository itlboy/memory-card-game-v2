/**
 * SỔ TRÍ NHỚ (23.11.2026, thử nghiệm — chỉ hiện khi debug bật). Đọc nhật ký thô ở `storage.ts`
 * (`NgayTriNho`) ra con số để hiện. Công thức điểm nằm ở engine (`diemTriNho`): tỉ lệ nhớ có
 * tính độ lâu × trần của bàn. File này chỉ GỘP: nhiều ván, nhiều cỡ bàn, nhiều ngày.
 */
import { coHoiNho, tiLeNho, tranBan } from '@mm/engine';
import { ref } from 'vue';
import { ngayMay, type DemTriNho, type NgayTriNho } from './storage';

/** Bật = GHI nhật ký trí nhớ và HIỆN dòng điểm ở bảng kết quả. App.vue đặt theo cờ debug:
 *  đang thử nghiệm nên máy không bật debug thì không ghi, không hiện gì (chủ dự án 23.11.2026). */
export const hienTriNho = ref(false);

/**
 * ĐỘ TIN CẬY (chủ dự án 23.11.2026: "chơi ít quá không đủ số liệu để tham khảo"). Đếm theo SỐ CƠ
 * HỘI NHỚ trong kỳ chứ không theo số ván — một ván 4 cặp và một ván 30 cặp cho lượng số liệu khác
 * hẳn nhau. Sai số của một tỉ lệ đo từ n lần ≈ 1/(2√n): 20 lần ≈ ±11%, 60 lần ≈ ±6%.
 * 0 = chưa có gì · 1 = còn ít, chưa nên tin · 2 = tạm tham khảo · 3 = đáng tin.
 */
export const MOC_TIN_CAY: readonly [number, number] = [20, 60];
export type TinCay = 0 | 1 | 2 | 3;
export const tinCay = (coHoi: number): TinCay => (coHoi <= 0 ? 0 : coHoi < MOC_TIN_CAY[0] ? 1 : coHoi < MOC_TIN_CAY[1] ? 2 : 3);

export interface TomTatTriNho {
  /** Điểm trung bình các ván (theo số ván từng cỡ bàn); `null` = chưa đủ để chấm. */
  diem: number | null;
  /** Tỉ lệ nhớ 0–100 gộp mọi cỡ bàn; `null` = chưa đủ để chấm. */
  tiLe: number | null;
  van: number;
  cao: number;
  tam: number;
  /** Tổng cơ hội nhớ (nhớ + quên) của kỳ, và mức tin cậy suy ra từ đó. */
  coHoi: number;
  tinCay: TinCay;
}

const cong = (a: number[], b: readonly number[] | undefined): void => { (b ?? []).forEach((n, i) => { a[i] = (a[i] ?? 0) + n; }); };

/** Gộp nhiều ngày thành một tóm tắt. Điểm = trung bình CÓ TRỌNG SỐ theo số ván của từng cỡ bàn. */
export function tomTat(cacNgay: readonly (NgayTriNho | undefined)[]): TomTatTriNho {
  const ban = new Map<string, DemTriNho>();
  let tam = 0, cao = 0;
  for (const n of cacNgay) {
    if (!n) continue;
    tam = Math.max(tam, n.tam ?? 0); cao = Math.max(cao, n.cao ?? 0);
    for (const [k, d] of Object.entries(n.ban ?? {})) {
      const o = ban.get(k) ?? { van: 0, nho: [], quen: [] };
      o.van += d.van; cong(o.nho, d.nho); cong(o.quen, d.quen);
      ban.set(k, o);
    }
  }
  let van = 0, tongDiem = 0, vanCham = 0;
  const nho: number[] = [], quen: number[] = [];
  for (const [k, d] of ban) {
    van += d.van; cong(nho, d.nho); cong(quen, d.quen);
    const tl = tiLeNho(d.nho, d.quen);
    if (tl !== null) { tongDiem += tl * tranBan(Number(k)) * d.van; vanCham += d.van; }
  }
  const tl = tiLeNho(nho, quen);
  return {
    diem: vanCham ? Math.round(tongDiem / vanCham) : null,
    tiLe: tl === null ? null : Math.round(tl * 100),
    van, cao, tam,
    coHoi: coHoiNho(nho, quen), tinCay: tinCay(coHoiNho(nho, quen))
  };
}

/** Chưa có số liệu của chính người chơi thì coi mỗi ván cho ngần này cơ hội nhớ (bàn 8–12 cặp). */
export const CO_HOI_MOI_VAN_MAC_DINH = 6;
/**
 * CÒN PHẢI CHƠI KHOẢNG MẤY VÁN nữa để kỳ này lên mức tin cậy kế tiếp (chủ dự án 23.11.2026: "báo họ
 * phải chơi thêm bao nhiêu để họ chơi"). Mốc tính bằng cơ hội nhớ, đổi ra ván bằng số cơ hội TRUNG
 * BÌNH MỖI VÁN của chính người đó (`thamChieu`, thường là 14 ngày qua). 0 = đã đáng tin.
 */
export function vanConThieu(ky: Pick<TomTatTriNho, 'coHoi'>, thamChieu: Pick<TomTatTriNho, 'coHoi' | 'van'>): number {
  const moc = ky.coHoi < MOC_TIN_CAY[0] ? MOC_TIN_CAY[0] : ky.coHoi < MOC_TIN_CAY[1] ? MOC_TIN_CAY[1] : 0;
  if (!moc) return 0;
  const moiVan = thamChieu.van > 0 ? Math.max(1, thamChieu.coHoi / thamChieu.van) : CO_HOI_MOI_VAN_MAC_DINH;
  return Math.max(1, Math.ceil((moc - ky.coHoi) / moiVan));
}

/** `soNgay` ngày liên tiếp kết thúc ở `den` (kể cả `den`), cũ → mới, dạng `YYYY-MM-DD`. */
export function dayNgay(soNgay: number, den = new Date()): string[] {
  return Array.from({ length: soNgay }, (_, i) => {
    const d = new Date(den.getFullYear(), den.getMonth(), den.getDate() - (soNgay - 1 - i), 12);
    return ngayMay(d);
  });
}

/** Trần số cặp của từng nhóm cỡ bàn hiện ở sổ: ≤8 · 9–18 · 19–30 · 31+. */
export const NHOM_BAN: readonly number[] = [8, 18, 30, Infinity];

/** Tỉ lệ nhớ (0–100, `null` = chưa đủ) của từng nhóm cỡ bàn trong các ngày đã cho. */
export function theoNhomBan(cacNgay: readonly (NgayTriNho | undefined)[]): { tiLe: number | null; van: number }[] {
  const nhom = NHOM_BAN.map(() => ({ van: 0, nho: [] as number[], quen: [] as number[] }));
  for (const n of cacNgay) {
    for (const [k, d] of Object.entries(n?.ban ?? {})) {
      const o = nhom[NHOM_BAN.findIndex((tran) => Number(k) <= tran)]!;
      o.van += d.van; cong(o.nho, d.nho); cong(o.quen, d.quen);
    }
  }
  return nhom.map((o) => {
    const tl = tiLeNho(o.nho, o.quen);
    return { tiLe: tl === null ? null : Math.round(tl * 100), van: o.van };
  });
}

/** Con số của MỘT ván, cho dòng ở bảng kết quả. `null` = ván không có cơ hội nhớ nào. */
export function triNhoVan(
  p: { nhoTheo?: readonly number[]; quenTheo?: readonly number[]; tamNho?: number } | undefined, soCap: number
): { diem: number | null; tiLe: number | null; tam: number; tran: number } | null {
  if (!p || coHoiNho(p.nhoTheo, p.quenTheo) === 0) return null;
  const tl = tiLeNho(p.nhoTheo, p.quenTheo);
  return {
    diem: tl === null ? null : Math.round(tl * tranBan(soCap)),
    tiLe: tl === null ? null : Math.round(tl * 100),
    tam: p.tamNho ?? 0, tran: tranBan(soCap)
  };
}
