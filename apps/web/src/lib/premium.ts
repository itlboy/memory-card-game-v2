import { ref } from 'vue';
import type { CardTheme } from './themes';

/**
 * GÓI PREMIUM — MỘT gói mở mọi theme premium (chủ dự án chốt 14.10.2026).
 *
 * Đợt này CHƯA BÁN THẬT: nút mua chỉ báo "sắp có". Quyền sở hữu tạm đọc từ
 * localStorage `mm.premium` (đặt '1' để thử giao diện đã mua). Khi có In-App
 * Purchase (Apple/Google bắt buộc dùng IAP cho đồ số trong app) thì chỉ thay chỗ
 * đặt `daMuaPremium` ở đây — mọi màn đều hỏi qua `choiDuoc()` chứ không tự đọc cờ.
 *
 * Online: chỉ CHỦ PHÒNG cần sở hữu; người vào phòng chơi cùng bàn premium được
 * (cũng là cách giới thiệu theme). Server không kiểm — cùng lý do PREDEAL: game
 * chơi với bạn bè, không chống gian lận.
 */
const KHOA = 'mm.premium';
function doc(): boolean {
  try { return localStorage.getItem(KHOA) === '1'; } catch { return false; }
}
export const daMuaPremium = ref(doc());

/** Theme này người chơi có được CHỌN không. */
export const choiDuoc = (t: Pick<CardTheme, 'premium'>): boolean => !t.premium || daMuaPremium.value;
