/**
 * HẠNG TRÊN VIÊN ĐỒNG XU — HẠNG TUẦN NÀY (20.11.2026, mockup duyệt https://claude.ai/artifact/4GKeTS7QbeoLB2XV3phdne;
 * trước đó là hạng Mọi lúc, 19.11.2026 https://claude.ai/artifact/11swqn2QDAce9P5GTBxAbz). Viên xu ở thanh trên mang
 * thêm "🏆 18": nhìn là biết có bảng xếp hạng và tuần này mình đứng thứ mấy — tuần thì người mới cũng leo được.
 *
 * ÍT GỌI (chủ dự án 19.11.2026): server chỉ được hỏi khi (1) khởi động app — MỘT lần (`hoiLanDau`), (2) điểm của mình
 * vừa tăng — MỘT lần, khi đã ra khỏi ván (`hoiSauDiem`, TopBar gọi), (3) mở bảng xếp hạng ở tab Tuần, tuần này.
 * Huy hiệu = hạng lần hỏi gần nhất. Hạng ĐỔI → `doiHangCho` ('len' | 'xuong' | 'moi' = lần đầu có hạng trong tuần),
 * TopBar diễn hiệu ứng + âm thanh khi đang ngoài ván và bảng đã đóng.
 * Sang tuần mới (thứ Hai 00:00 UTC, cùng mốc server) hạng cũ bỏ đi — cúp trống tới khi có xu tuần đó.
 */
import { ref } from 'vue';
import { bangXepHang, type BangXh } from './taikhoan';

const KHOA = 'mm.hangTuan';
const KHOA_MEO = 'mm.meoXu';

/** Thứ Hai 'YYYY-MM-DD' (UTC) của tuần chứa `ms` — cùng cách tính với server (apps/node-server dauTuan). */
export function dauTuanUtc(ms = Date.now()): string {
  const d = new Date(ms);
  const lui = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - lui)).toISOString().slice(0, 10);
}

function doc(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA) ?? 'null') as { tuan?: string; hang?: number } | null;
    return v && v.tuan === dauTuanUtc() && Number(v.hang) > 0 ? Number(v.hang) : null;
  } catch { return null; }
}

/** Hạng TUẦN NÀY của máy này ở lần hỏi gần nhất; null = chưa có (chưa có xu tuần này, đã ẩn khỏi bảng, tuần mới). */
export const hangXu = ref<number | null>(doc());
export type KieuDoiHang = 'len' | 'xuong' | 'moi';
/** Hạng vừa đổi — TopBar diễn rồi đặt lại null. */
export const doiHangCho = ref<{ kieu: KieuDoiHang; tu: number | null; den: number } | null>(null);

/** Ghi hạng từ bảng TUẦN NÀY vừa tải (số MỚI từ server). Bảng khác (Mọi lúc, tuần cũ) bỏ qua. */
export function ghiHang(b: BangXh): void {
  if (!b.tuan?.nay) return;
  const cu = doc();
  const moi = b.toi?.hang && (b.toi.totalScore ?? 0) > 0 ? b.toi.hang : null;
  hangXu.value = moi;
  try {
    if (moi) localStorage.setItem(KHOA, JSON.stringify({ tuan: b.tuan.batDau, hang: moi }));
    else localStorage.removeItem(KHOA);
  } catch { /* bỏ qua */ }
  if (!moi) return;
  if (!cu) doiHangCho.value = { kieu: 'moi', tu: null, den: moi };
  else if (moi < cu) doiHangCho.value = { kieu: 'len', tu: cu, den: moi };
  else if (moi > cu) doiHangCho.value = { kieu: 'xuong', tu: cu, den: moi };
}

let dangHoi: Promise<void> | null = null;
function hoi(): Promise<void> {
  dangHoi ??= bangXepHang('tuan').then(ghiHang, () => { /* lỗi mạng: giữ hạng cũ, im */ }).finally(() => { dangHoi = null; });
  return dangHoi;
}
let daHoiLanDau = false;
/** Hỏi hạng MỘT lần mỗi lần khởi động app (không lặp khi quay lại từ nền / TopBar dựng lại). */
export function hoiLanDau(): Promise<void> {
  if (daHoiLanDau) return Promise.resolve();
  daHoiLanDau = true;
  return hoi();
}
/** Điểm của mình vừa tăng (đã ra khỏi ván): hỏi lại một lần — hạng chỉ đổi khi điểm mình đổi (hoặc bị vượt). */
export const hoiSauDiem = (): Promise<void> => hoi();

/** Mẹo "bấm vào đây để xem hạng" — chỉ MỘT lần trong đời máy. */
export function daXemMeoXu(): boolean {
  try { return localStorage.getItem(KHOA_MEO) === '1'; } catch { return true; }
}
export function tatMeoXu(): void {
  try { localStorage.setItem(KHOA_MEO, '1'); } catch { /* bỏ qua */ }
}
