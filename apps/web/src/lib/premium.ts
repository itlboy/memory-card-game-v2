import { computed, ref } from 'vue';
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

/** Bật/tắt "đã mua" để THỬ — nút ở chế độ debug (Luật chơi). Chỉ máy này, không mua thật. */
export function datPremiumThu(v: boolean): void {
  daMuaPremium.value = v;
  try { if (v) localStorage.setItem(KHOA, '1'); else localStorage.removeItem(KHOA); } catch { /* chế độ riêng tư */ }
}

/**
 * CÔNG TẮC BÁN — `false` ở bản đầu lên store (chủ dự án chốt 14.10.2026): chưa có
 * In-App Purchase thì KHÔNG bày đồ Premium ra (tab theme, skin, danh hiệu của theme
 * premium) — đồ khoá mà không mua được là App Review hay loại (luật 2.1). Có IAP
 * thì bật `true`, mọi thứ hiện lại kèm vương miện. `mm.premium='1'` vẫn thấy để thử.
 */
export const banPremium = ref(false);   // ref (không const) để test bật được luồng đã mở bán
export const hienPremium = computed(() => banPremium.value || daMuaPremium.value);

/** Theme này người chơi có được CHỌN không. */
export const choiDuoc = (t: Pick<CardTheme, 'premium'>): boolean => !t.premium || daMuaPremium.value;
