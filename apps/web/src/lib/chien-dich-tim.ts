import type { BotLevel, TimTheDoKho } from '@mm/engine';
import type { TimTheChon } from './tim-the';

/**
 * CHIẾN DỊCH TÌM THẺ (đợt 3, 28.11.2026, mockup duyệt https://claude.ai/artifact/BZWf4m2Ma6Tp6rGvnBWJrV).
 *
 * 30 màn, 3 chặng × 10 (Mắt non · Mắt sáng · Mắt thần). Mỗi màn: số thẻ, tốc độ, có thể có máy; màn 10/20/30 là trùm.
 * Ván luôn 10 lượt. SAO theo số lượt đúng: ★ 6 · ★★ 8 · ★★★ 10. Có ≥ 1★ là qua (mở màn sau) — màn có máy thì còn phải
 * THẮNG máy. Sao Tìm Thẻ tính RIÊNG (90 sao), không cộng vào 180 sao Lật cặp. Tiến độ ở `Save.timCD` (storage.ts).
 */
export interface ManTim { id: number; soThe: number; doKho: TimTheDoKho; may?: BotLevel; trum?: boolean }

const M = (soThe: number, doKho: TimTheDoKho, may?: BotLevel, trum?: boolean): Omit<ManTim, 'id'> =>
  ({ soThe, doKho, ...(may ? { may } : {}), ...(trum ? { trum } : {}) });

export const MAN_TIM: readonly ManTim[] = [
  // Chặng 1 · Mắt non — 3 → 5 thẻ, làm quen tốc độ
  M(3, 'de'), M(3, 'vua'), M(3, 'kho'), M(4, 'de'), M(4, 'vua'), M(4, 'kho'), M(5, 'de'), M(5, 'vua'), M(4, 'vua', 'normal'), M(5, 'vua', 'normal', true),
  // Chặng 2 · Mắt sáng — 5 → 7 thẻ, gặp Báo đen
  M(5, 'kho'), M(6, 'de'), M(6, 'vua'), M(5, 'vua', 'hard'), M(6, 'kho'), M(6, 'vua', 'hard'), M(7, 'de'), M(7, 'vua'), M(6, 'kho', 'hard'), M(7, 'vua', 'insane', true),
  // Chặng 3 · Mắt thần — 6 → 7 thẻ Nhanh, Mãnh hổ và Rồng thần
  M(7, 'kho'), M(6, 'kho', 'insane'), M(7, 'kho'), M(7, 'vua', 'insane'), M(7, 'kho'), M(6, 'kho', 'divine'), M(7, 'kho', 'insane'), M(7, 'kho'), M(7, 'kho', 'divine'), M(7, 'kho', 'divine', true)
].map((m, i) => ({ id: i + 1, ...m }));

export const SO_MAN_TIM = MAN_TIM.length;
export const CHANG_TIM = [1, 2, 3].map((id) => ({ id, from: (id - 1) * 10 + 1, to: id * 10 }));

/** Mốc sao: số lượt đúng tối thiểu cho ★ / ★★ / ★★★. */
export const MOC_SAO_TIM = [6, 8, 10] as const;
export const saoTim = (dung: number): number => MOC_SAO_TIM.filter((m) => dung >= m).length;
/** Lượt đúng còn thiếu tới ngôi sao kế tiếp (null = đã đủ 3★). */
export function thieuSaoKe(dung: number): { sao: number; thieu: number } | null {
  const i = MOC_SAO_TIM.findIndex((m) => dung < m);
  return i < 0 ? null : { sao: i + 1, thieu: MOC_SAO_TIM[i]! - dung };
}
/** Qua màn: có ít nhất 1★, và nếu màn có máy thì phải thắng máy. */
export function quaManTim(man: ManTim, dung: number, ketQua: 'thang' | 'thua' | 'hoa' | 'xong'): boolean {
  return saoTim(dung) > 0 && (!man.may || ketQua === 'thang');
}
export const chonCuaMan = (man: ManTim): TimTheChon => ({ soThe: man.soThe, doKho: man.doKho, doiThu: man.may ?? 'mot' });
export const manTim = (id: number): ManTim | undefined => MAN_TIM[id - 1];

/** Màn cao nhất được chơi: qua màn n thì mở n+1. */
export function moToiTim(tienDo: Record<string, { stars: number }>): number {
  let max = 0;
  for (const [k, v] of Object.entries(tienDo)) if (v.stars > 0) max = Math.max(max, Number(k) || 0);
  return Math.min(SO_MAN_TIM, max + 1);
}
export const tongSaoTim = (tienDo: Record<string, { stars: number }>): number =>
  Object.values(tienDo).reduce((n, v) => n + Math.min(3, v.stars), 0);

/** Thanh "Lật cặp | Tìm Thẻ" trên bản đồ Chiến dịch — nhớ lần trước (riêng với Kiểu chơi ở Chơi nhanh). */
const KHOA_KIEU_CD = 'mm.kieuCD';
export function docKieuCD(): 'thuong' | 'tim' {
  try { return localStorage.getItem(KHOA_KIEU_CD) === 'tim' ? 'tim' : 'thuong'; } catch { return 'thuong'; }
}
export function luuKieuCD(k: 'thuong' | 'tim'): void {
  try { localStorage.setItem(KHOA_KIEU_CD, k); } catch { /* chỉ mất lựa chọn */ }
}
