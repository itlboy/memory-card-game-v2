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
 * BÀN VÒNG TRÒN (27.11.2026, chủ dự án duyệt mockup https://claude.ai/artifact/84a1NKjn98ViN2Koj51K7U): thẻ cần tìm ở TÂM,
 * các lá xếp trên một elip quanh nó, lá đầu ở 12 giờ rồi theo chiều kim đồng hồ. Thẻ giữa BẰNG lá thường.
 *
 * Màn dọc: bảng cỡ lá + bán kính đã dò máy trên khung chuẩn 360 × 570 (lá TO NHẤT mà mọi khe ≥ 14px, bàn 3 thẻ cân — chủ dự
 * án chê bản đầu "3 có vẻ không cân"), rồi co giãn theo khung thật. Màn ngang: elip nằm ngang, dò lá to nhất mà khe ≥ 12px.
 * Cả cụm được dời cho cân giữa khung theo chiều dọc. Toạ độ là TÂM lá, tính từ góc trên trái khung.
 */
const VONG_CHUAN: Record<number, readonly [number, number, number]> = {
  3: [88, 130, 156], 4: [88, 118, 144], 5: [88, 124, 176], 6: [88, 130, 156], 7: [84, 126, 188], 8: [76, 128, 164], 9: [68, 134, 236]
};
export interface BanVong { w: number; h: number; tam: [number, number]; vi: [number, number][] }
export function bayVong(n: number, rong: number, cao: number): BanVong {
  const ngang = rong > cao * 1.1;
  let w: number, rx: number, ry: number;
  if (!ngang) {
    const [w0, rx0, ry0] = VONG_CHUAN[n] ?? VONG_CHUAN[9]!;
    const k = Math.min(rong / 360, cao / 570, 1.25);
    w = Math.round(w0 * k); rx = rx0 * k; ry = ry0 * k;
  } else {
    for (w = 96; ; w -= 2) {
      const h = (w * 4) / 3;
      ry = Math.max(0, cao / 2 - h / 2 - 4); rx = Math.min(rong / 2 - w / 2 - 4, ry * 2.4);
      if (w <= 30 || khePhut(n, w, h, rx, ry) >= 12) break;
    }
  }
  const h = (w * 4) / 3;
  const vi: [number, number][] = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [rong / 2 + Math.cos(a) * rx, cao / 2 + Math.sin(a) * ry];
  });
  const tren = Math.min(cao / 2 - h / 2, ...vi.map((c) => c[1] - h / 2));
  const duoi = Math.max(cao / 2 + h / 2, ...vi.map((c) => c[1] + h / 2));
  const doi = cao / 2 - (tren + duoi) / 2;
  for (const c of vi) c[1] += doi;
  return { w, h, tam: [rong / 2, cao / 2 + doi], vi };
}
/** Khe hẹp nhất giữa hai lá bất kỳ (kể cả lá giữa) của một vòng. */
function khePhut(n: number, w: number, h: number, rx: number, ry: number): number {
  const p: [number, number][] = [[0, 0]];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; p.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  let min = Infinity;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    min = Math.min(min, Math.max(Math.abs(p[i]![0] - p[j]![0]) - w, Math.abs(p[i]![1] - p[j]![1]) - h));
  }
  return min;
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

/**
 * Kỷ lục RIÊNG từng cỡ bàn + tốc độ, chỉ ván MỘT MÌNH — chỉ dùng để bắn hiệu ứng "kỷ lục mới" cuối ván, KHÔNG hiện ở màn
 * chọn (chủ dự án 28.11.2026: "Kỷ lục ko để chỗ đó"). Khoá `kyLuc2` từ 28.11.2026: đổi giờ xem 1,5/1/0,75 → 3/2/1 giây/thẻ
 * làm kỷ lục cũ không còn so được — chủ dự án: "Xoá đi". `xoaKyLucCu` dọn khoá cũ một lần.
 */
const khoaKyLuc = (soThe: number, doKho: TimTheDoKho): string => `mm.timThe.kyLuc2.${soThe}.${doKho}`;
export function xoaKyLucCu(): void {
  try {
    const cu: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('mm.timThe.kyLuc.')) cu.push(k); }
    for (const k of cu) localStorage.removeItem(k);
  } catch { /* chế độ riêng tư: không có gì để xoá */ }
}
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
