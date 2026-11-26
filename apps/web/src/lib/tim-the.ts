/**
 * TÌM THẺ — phần của MÁY NÀY: công tắc mở, lựa chọn đã lưu, kỷ lục. Luật nằm ở engine
 * (`packages/engine/src/tim-the.ts`) vì phòng online chạy cùng bộ luật trên server.
 */
import { ref } from 'vue';
import { BOT_SPECS, TIM_THE_DO_KHO, TIM_THE_SO_THE, timTheHopLe, type BotLevel, type TimTheDoKho } from '@mm/engine';

/**
 * CÔNG TẮC MỞ CHO NGƯỜI CHƠI. `false` (chủ dự án 26.11.2026: "sau cửa debug trước, thử ổn mới mở"):
 * không có ô Tìm Thẻ ở bước Thể loại, `?tim=1` chỉ mở khi debug — lối vào duy nhất là trang Debug.
 * Bật lại = `true`, không phải sửa chỗ nào khác.
 */
export const TIM_THE_MO = false;

/** Đang ở màn chơi Tìm Thẻ ONLINE — App tắt icon bay phía sau (màn chơi không gì kéo mắt khỏi bàn). OnlineTimThe đặt. */
export const dangTimOnline = ref(false);

/** Đối thủ: một mình, hoặc MỘT máy ở mức đã chọn. */
export type TimTheDoiThu = 'mot' | BotLevel;
export interface TimTheChon { soThe: number; doKho: TimTheDoKho; doiThu: TimTheDoiThu }

const KHOA = 'mm.timThe.chon';
const laDoiThu = (v: unknown): v is TimTheDoiThu => v === 'mot' || (typeof v === 'string' && v in BOT_SPECS);

export function docChon(): TimTheChon {
  let tho: Partial<TimTheChon> = {};
  try { tho = JSON.parse(localStorage.getItem(KHOA) ?? '{}') as Partial<TimTheChon>; } catch { /* hỏng thì về mặc định */ }
  const hl = timTheHopLe(tho);
  return { soThe: hl.soThe, doKho: hl.doKho, doiThu: laDoiThu(tho.doiThu) ? tho.doiThu : 'mot' };
}
export function luuChon(c: TimTheChon): void {
  try { localStorage.setItem(KHOA, JSON.stringify(c)); } catch { /* chế độ riêng tư: chỉ không nhớ */ }
}

/** KIỂU CHƠI ở màn Chơi nhanh / Đấu với máy (27.11.2026): nhớ lần trước, lần sau mở ra đúng kiểu đã chơi. */
export type KieuChoi = 'thuong' | 'tim';
const KHOA_KIEU = 'mm.kieuChoi';
export function docKieu(): KieuChoi {
  try { return localStorage.getItem(KHOA_KIEU) === 'tim' ? 'tim' : 'thuong'; } catch { return 'thuong'; }
}
export function luuKieu(k: KieuChoi): void {
  try { localStorage.setItem(KHOA_KIEU, k); } catch { /* chỉ không nhớ */ }
}

/** Kỷ lục RIÊNG từng cỡ bàn + độ khó, chỉ ván MỘT MÌNH — 3 thẻ Dễ và 12 thẻ Khó là hai trò khác nhau. */
const khoaKyLuc = (soThe: number, doKho: TimTheDoKho): string => `mm.timThe.kyLuc.${soThe}.${doKho}`;
export function docKyLuc(soThe: number, doKho: TimTheDoKho): number {
  try { return Number(localStorage.getItem(khoaKyLuc(soThe, doKho))) || 0; } catch { return 0; }
}
/** Ghi nếu cao hơn; trả `true` khi là kỷ lục mới. */
export function ghiKyLuc(soThe: number, doKho: TimTheDoKho, diem: number): boolean {
  if (diem <= docKyLuc(soThe, doKho)) return false;
  try { localStorage.setItem(khoaKyLuc(soThe, doKho), String(diem)); } catch { /* chỉ mất kỷ lục */ }
  return true;
}

/** Loại ván cho GA — cùng thang `che_do` với ghép cặp (`dau_may_<mức>`, `choi_nhanh`…) để so được trong MỘT báo cáo. */
export const cheDoGa = (doiThu: TimTheDoiThu): string => (doiThu === 'mot' ? 'tim_the' : `tim_the_may_${doiThu}`);

export { TIM_THE_DO_KHO, TIM_THE_SO_THE };

/** Kết quả một ván, màn TimThe.vue gửi lên App (xu, bộ đếm, tài khoản, GA). */
export interface TimTheKetVan extends TimTheChon {
  diem: number;
  /** Số lượt chọn đúng / tổng số lượt. */
  dung: number;
  soLuot: number;
  chuoiDai: number;
  /** Một mình: luôn `xong`. Đấu máy: kết cục CỦA NGƯỜI. */
  ketQua: 'xong' | 'thang' | 'thua' | 'hoa';
  kyLucMoi: boolean;
  giay: number;
}
/** Ván bỏ ngang (cho GA `van_bo_do`). */
export interface TimTheBoDo extends TimTheChon { luot: number; soLuot: number; giay: number }
