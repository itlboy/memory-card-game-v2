import { ref } from 'vue';
import { ngayMay } from './storage';

/**
 * HIỆU ỨNG TRONG VÁN — QUYỀN LỢI PREMIUM (26.11.2026, mockup duyệt https://claude.ai/artifact/ALpRKG88kcozoAgRgw9gCh mục 4).
 * Chủ dự án: "chỉ cần 2 cặp cũng là đủ có hiệu ứng đẹp rồi đó, kể cả 1 cặp"; "làm sao để người dùng biết đó là hiệu ứng premium".
 *   · ghép đúng 1 cặp → hai lá phồng + phát sáng + bung tia theo CHỦ ĐỀ (Thiên hà: sao · Hoa anh đào: cánh hoa · gốc: kim tuyến)
 *   · ghép liền từ 2 cặp → nhãn "Chuỗi N" có lửa, ĐEO VƯƠNG MIỆN (dấu hiệu Premium luôn thấy)
 *   · lần đầu mỗi NGÀY có hiệu ứng → dòng nhỏ "Hiệu ứng Premium" ~2 giây ở đáy bàn
 *   · online: người khác cũng thấy hiệu ứng của người có Premium (server chuyển cờ `pm`, xem useOnlineRoom)
 * Bản thường KHÔNG đổi gì. Ai gọi `bungGhep` là người đã kiểm "cặp này của người có Premium".
 * Lớp vẽ: GhepPremiumFx.vue (đặt một lần ở App.vue) đọc `suKienGhep`.
 */
export interface SuKienGhep { key: number; indices: readonly number[]; chuoi: number; baoHomNay: boolean }
export const suKienGhep = ref<SuKienGhep | null>(null);

const KHOA_NGAY = 'mm.fxPm.ngay';
/** Hôm nay đã hiện dòng "Hiệu ứng Premium" chưa — chưa thì ghi lại và trả true (chỉ MỘT lần mỗi ngày). */
export function baoLanDauHomNay(homNay = ngayMay()): boolean {
  try {
    if (localStorage.getItem(KHOA_NGAY) === homNay) return false;
    localStorage.setItem(KHOA_NGAY, homNay);
    return true;
  } catch { return false; }
}

/** Phát hiệu ứng cho một cặp vừa ghép. `chuoi` = số cặp ghép LIỀN của người đó tính cả cặp này. */
export function bungGhep(indices: readonly number[], chuoi: number): void {
  suKienGhep.value = { key: (suKienGhep.value?.key ?? 0) + 1, indices, chuoi, baoHomNay: baoLanDauHomNay() };
}
