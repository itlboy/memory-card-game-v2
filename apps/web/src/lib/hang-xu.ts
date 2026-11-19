/**
 * HẠNG TRÊN VIÊN ĐỒNG XU (19.11.2026, mockup duyệt https://claude.ai/artifact/11swqn2QDAce9P5GTBxAbz — chủ dự án:
 * "sợ người dùng không biết chỗ đó bấm vào"). Viên xu ở thanh trên mang thêm "🏆 #137": nhìn là biết có bảng
 * xếp hạng và mình đứng thứ mấy. Lên hạng thì TopBar diễn hiệu ứng + lời nhắc "Lên hạng #129 (↑8)".
 *
 * Hạng hỏi server (POST /api/bxh — cùng đường với bảng xếp hạng, nó tự gửi điểm khách mới nhất trước) khi mở
 * app và vài giây sau mỗi lần tổng xu đổi. Nhớ hạng lần trước trong localStorage: mở app mất mạng vẫn hiện số
 * cũ, và lần hỏi sau biết là lên hay xuống. Lỗi mạng: giữ số cũ, KHÔNG diễn gì.
 */
import { ref } from 'vue';
import { bangXepHang } from './taikhoan';

const KHOA = 'mm.hangXu';
const KHOA_MEO = 'mm.meoXu';

function doc(): number | null {
  try { const v = Number(localStorage.getItem(KHOA)); return v > 0 ? v : null; } catch { return null; }
}

/** Hạng hiện tại của máy này; null = chưa có (chưa chơi, đã ẩn khỏi bảng, chưa hỏi được). */
export const hangXu = ref<number | null>(doc());

let dangHoi: Promise<{ cu: number | null; moi: number | null } | null> | null = null;

const KHOA_LUC = 'mm.hangXuLuc';
/** Lúc MỞ APP chỉ hỏi lại khi lần trước đã quá chừng này — mở/tắt app liên tục không dội server. */
export const HOI_LAI_KHI_MO_MS = 10 * 60_000;
export function vuaHoi(now = Date.now()): boolean {
  try { return now - Number(localStorage.getItem(KHOA_LUC) ?? 0) < HOI_LAI_KHI_MO_MS; } catch { return false; }
}

/** Hỏi lại hạng. Trả { cu, moi } để người gọi biết có lên hạng không; null khi lỗi mạng. */
export function capNhatHang(): Promise<{ cu: number | null; moi: number | null } | null> {
  dangHoi ??= (async () => {
    try {
      const b = await bangXepHang();
      const cu = hangXu.value;
      const moi = b.toi && b.toi.matches > 0 ? b.toi.hang : null;
      hangXu.value = moi;
      try {
        if (moi) localStorage.setItem(KHOA, String(moi)); else localStorage.removeItem(KHOA);
        localStorage.setItem(KHOA_LUC, String(Date.now()));
      } catch { /* bỏ qua */ }
      return { cu, moi };
    } catch { return null; } finally { dangHoi = null; }
  })();
  return dangHoi;
}

/** Mẹo "bấm vào đây để xem hạng" — chỉ MỘT lần trong đời máy. */
export function daXemMeoXu(): boolean {
  try { return localStorage.getItem(KHOA_MEO) === '1'; } catch { return true; }
}
export function tatMeoXu(): void {
  try { localStorage.setItem(KHOA_MEO, '1'); } catch { /* bỏ qua */ }
}
