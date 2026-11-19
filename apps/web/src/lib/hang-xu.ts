/**
 * HẠNG TRÊN VIÊN ĐỒNG XU (19.11.2026, mockup duyệt https://claude.ai/artifact/11swqn2QDAce9P5GTBxAbz — chủ dự án:
 * "sợ người dùng không biết chỗ đó bấm vào"). Viên xu ở thanh trên mang thêm "🏆 #137": nhìn là biết có bảng
 * xếp hạng và mình đứng thứ mấy.
 *
 * ÍT GỌI (chủ dự án 19.11.2026: "bấm vào mới gọi lên… chỉ tự hỏi lần đầu vào app… hay là khi có sự thay đổi
 * điểm số của bản thân"): server chỉ được hỏi khi (1) khởi động app — MỘT lần (`hoiLanDau`, cũng nạp sẵn bảng
 * cho lần bấm đầu), (2) điểm của mình vừa tăng — MỘT lần, khi đã ra khỏi ván (`hoiSauDiem`, TopBar gọi),
 * (3) mở bảng xếp hạng. KHÔNG hỏi theo giờ / khi quay lại từ nền. Huy hiệu = hạng lần hỏi gần nhất.
 * Thấy LÊN hạng → `lenHangCho`, TopBar diễn "Lên hạng #129 (↑8)" khi đang ngoài ván và bảng đã đóng.
 */
import { ref } from 'vue';
import { bangXepHang, type BangXh } from './taikhoan';

const KHOA = 'mm.hangXu';
const KHOA_MEO = 'mm.meoXu';

function doc(): number | null {
  try { const v = Number(localStorage.getItem(KHOA)); return v > 0 ? v : null; } catch { return null; }
}

/** Hạng của máy này ở lần mở bảng gần nhất; null = chưa có (chưa chơi, đã ẩn khỏi bảng, chưa mở bảng). */
export const hangXu = ref<number | null>(doc());
/** Lần mở bảng vừa rồi thấy lên hạng — TopBar diễn rồi đặt lại null. */
export const lenHangCho = ref<{ hang: number; n: number } | null>(null);

/** Ghi hạng từ bảng vừa tải (số MỚI từ server, không phải bảng lưu tạm). */
export function ghiHang(b: BangXh): void {
  const cu = hangXu.value;
  const moi = b.toi && b.toi.matches > 0 ? b.toi.hang : null;
  hangXu.value = moi;
  try { if (moi) localStorage.setItem(KHOA, String(moi)); else localStorage.removeItem(KHOA); } catch { /* bỏ qua */ }
  if (cu && moi && moi < cu) lenHangCho.value = { hang: moi, n: cu - moi };
}

let dangHoi: Promise<void> | null = null;
function hoi(): Promise<void> {
  dangHoi ??= bangXepHang().then(ghiHang, () => { /* lỗi mạng: giữ hạng cũ, im */ }).finally(() => { dangHoi = null; });
  return dangHoi;
}
let daHoiLanDau = false;
/** Hỏi hạng MỘT lần mỗi lần khởi động app (không lặp khi quay lại từ nền / TopBar dựng lại). */
export function hoiLanDau(): Promise<void> {
  if (daHoiLanDau) return Promise.resolve();
  daHoiLanDau = true;
  return hoi();
}
/** Điểm của mình vừa tăng (đã ra khỏi ván): hỏi lại một lần — hạng chỉ đổi khi điểm mình đổi. */
export const hoiSauDiem = (): Promise<void> => hoi();

/** Mẹo "bấm vào đây để xem hạng" — chỉ MỘT lần trong đời máy. */
export function daXemMeoXu(): boolean {
  try { return localStorage.getItem(KHOA_MEO) === '1'; } catch { return true; }
}
export function tatMeoXu(): void {
  try { localStorage.setItem(KHOA_MEO, '1'); } catch { /* bỏ qua */ }
}
