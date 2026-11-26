import { laApp } from './native';
import { suKien } from './phan-tich';
import { store } from './storage';

/**
 * XIN ĐÁNH GIÁ APP (26.11.2026, chủ dự án: "có nên xin review người dùng không? chúng ta đang cần review" → duyệt hướng dùng HỘP
 * ĐÁNH GIÁ CỦA HỆ ĐIỀU HÀNH, plugin @capacitor-community/in-app-review). Không tự vẽ hộp riêng dẫn ra store.
 *
 * LUẬT (đừng nới):
 *  - Hỏi lúc VUI: vừa THẮNG một ván và đã về trang chủ — không bao giờ giữa ván, không sau ván thua.
 *  - Đủ gắn bó: dùng app từ ≥ 3 NGÀY (mốc `mm.daMo` của lib/phan-tich) và đã chơi ≥ 5 ván (`BoDem.van`).
 *  - Thưa: cách lần trước ≥ 120 ngày, tối đa 3 lần (iOS cũng tự giới hạn 3 lần/năm và có thể KHÔNG hiện hộp — app không biết
 *    người chơi có thấy hay không, nên chỉ đếm số lần ĐÃ XIN).
 *  - KHÔNG đổi quà lấy đánh giá (tặng xu / Premium để xin 5 sao) — vi phạm luật cả App Store lẫn Google Play.
 * Bản app cũ nhận cập nhật nóng chưa có plugin → `isPluginAvailable` = false → im lặng (không nâng `minNative`).
 */
const KHOA = 'mm.danhGia';
const NGAY = 86_400_000;
export const DK = { ngayDung: 3, vanToiThieu: 5, cachNgay: 120, toiDa: 3 } as const;
interface DaXin { lan: number; luc: number }

function docDaXin(): DaXin {
  try { const v = JSON.parse(localStorage.getItem(KHOA) ?? 'null') as DaXin | null; return v && v.lan >= 0 ? v : { lan: 0, luc: 0 }; } catch { return { lan: 0, luc: 0 }; }
}
function coPlugin(): boolean {
  const cap = (globalThis as { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  return laApp && cap?.isPluginAvailable?.('InAppReview') === true;
}

/** Có nên xin lúc này không (thuần — test gọi thẳng). */
export function duDieuKien(bayGio: number, moLuc: number, soVan: number, da: DaXin): boolean {
  if (!(moLuc > 0) || bayGio - moLuc < DK.ngayDung * NGAY) return false;
  if (soVan < DK.vanToiThieu) return false;
  if (da.lan >= DK.toiDa) return false;
  return !da.luc || bayGio - da.luc >= DK.cachNgay * NGAY;
}

let vuaThang = false;
/** Gọi khi người chơi vừa THẮNG một ván (offline, đấu máy, online). */
export function ghiVuaThang(): void { vuaThang = true; }

/** Gọi khi về trang chủ. Chỉ xin nếu ván vừa rồi thắng và đủ mọi điều kiện ở trên. */
export async function thuXinDanhGia(bayGio = Date.now()): Promise<boolean> {
  if (!vuaThang) return false;
  vuaThang = false;
  if (!coPlugin()) return false;
  let moLuc = 0;
  try { moLuc = Number(localStorage.getItem('mm.daMo')) || 0; } catch { /* chế độ riêng tư */ }
  const da = docDaXin();
  if (!duDieuKien(bayGio, moLuc, store.boDem().van ?? 0, da)) return false;
  const moi: DaXin = { lan: da.lan + 1, luc: bayGio };
  try { localStorage.setItem(KHOA, JSON.stringify(moi)); } catch { /* chế độ riêng tư */ }
  suKien('xin_danh_gia', { lan: moi.lan });
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    return true;
  } catch { return false; }
}
