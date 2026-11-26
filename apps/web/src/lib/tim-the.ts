/**
 * TÌM THẺ — phần của MÁY NÀY: công tắc mở, lựa chọn đã lưu, kỷ lục. Luật nằm ở engine
 * (`packages/engine/src/tim-the.ts`) vì phòng online chạy cùng bộ luật trên server.
 */
import { ref } from 'vue';
import { BOT_SPECS, TIM_THE_DO_KHO, TIM_THE_SO_THE, timTheHopLe, type BotLevel, type Player, type Summary, type TimTheDoKho } from '@mm/engine';

/**
 * CÔNG TẮC MỞ CHO NGƯỜI CHƠI. `false` (chủ dự án 26.11.2026: "sau cửa debug trước, thử ổn mới mở"):
 * không có ô Tìm Thẻ ở bước Thể loại, `?tim=1` chỉ mở khi debug — lối vào duy nhất là trang Debug.
 * Bật lại = `true`, không phải sửa chỗ nào khác.
 */
export const TIM_THE_MO = true;

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

/**
 * BÀY BÀN (27.11.2026, chủ dự án: "cho các lá thẻ đồng đều hơn trên bàn để nhìn trên dưới đỡ trống"): KHÔNG cố định số cột
 * theo số thẻ nữa — thử mọi số cột, lấy cách cho LÁ TO NHẤT trong khung (`rong` × `cao`, lá 3:4, khe `khe`, trần `tran`).
 * Màn dọc nên bàn 6 thẻ ra 2×3, 12 thẻ ra 3×4 thay vì nằm bẹt giữa khoảng trống. Lá bằng nhau (chạm trần) thì chọn lưới ÍT Ô
 * TRỐNG hơn, rồi lưới có tỷ lệ gần khung nhất (phủ đều cả ngang lẫn dọc).
 */
export function bayBan(n: number, rong: number, cao: number, khe = 10, tran = 132): { cot: number; w: number } {
  // Bàn nhỏ giữ cách bày quen: 3 lá một HÀNG (một cột 3 lá dọc trông như cái tháp), 4 lá 2×2
  const coDinh = n === 3 ? 3 : n === 4 ? 2 : 0;
  let tot = { cot: 1, w: 0, trong: 0, lech: Infinity };
  for (let cot = coDinh || 1; cot <= (coDinh || n); cot++) {
    const hang = Math.ceil(n / cot);
    if (cot > 1 && Math.ceil(n / (cot - 1)) === hang) continue;   // thêm cột mà không bớt hàng: chỉ thêm ô trống
    const w = Math.floor(Math.max(0, Math.min((rong - khe * (cot - 1)) / cot, ((cao - khe * (hang - 1)) / hang) * 0.75, tran)));
    const trong = cot * hang - n;
    const lech = Math.abs((hang * w * 4 / 3 + khe * (hang - 1)) / cao - (cot * w + khe * (cot - 1)) / rong);
    if (w > tot.w || (w === tot.w && (trong < tot.trong || (trong === tot.trong && lech < tot.lech)))) tot = { cot, w, trong, lech };
  }
  return { cot: tot.cot, w: Math.max(36, tot.w) };
}

/**
 * KẾT QUẢ VÁN TÌM THẺ dạng `Summary` của ghép cặp — để hết ván dùng ĐÚNG bảng kết quả cũ (ResultDialog, prop `timThe`;
 * chủ dự án 27.11.2026). `pairs` / `moves` = SỐ LƯỢT ĐÚNG; bảng tự đổi nhãn. `score` / `bestStreak` của NGƯỜI CẦM MÁY.
 */
export function tomTatTimThe(
  ds: readonly { id: string; ten: string; mat?: string; diem: number; dung: number; chuoiDai: number }[],
  toiId: string, soLuot: number, giay: number
): Summary {
  const nguoi: Player[] = ds.map((n) => ({
    id: n.id, name: n.ten, ...(n.mat ? { avatar: n.mat } : {}), score: n.diem, pairs: n.dung, streak: 0, bestStreak: n.chuoiDai,
    misses: Math.max(0, soLuot - n.dung), lives: 0, frozenTurns: 0, doubleNext: false
  }));
  const ranking = [...nguoi].sort((a, b) => b.score - a.score || b.pairs - a.pairs);
  const toi = nguoi.find((n) => n.id === toiId) ?? ranking[0];
  return {
    status: 'won', reason: 'cleared', score: toi?.score ?? 0, moves: toi?.pairs ?? 0, seconds: giay, timeBonus: 0,
    bestStreak: toi?.bestStreak ?? 0, stars: 0, ranking
  };
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
