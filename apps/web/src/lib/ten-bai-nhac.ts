import { td } from './i18n';
import type { BaiNhac } from './nhac';

/**
 * Tên NGẮN của một bài nhạc nền, lấy từ nhãn aria sẵn có (`tb.nhacBai.*` = "Nhạc nền: Vui (marimba)") → "Vui": bỏ phần trước
 * dấu hai chấm (Latin lẫn toàn chiều 日本語/中文) và phần trong ngoặc (chủ dự án 26.11.2026: "bỏ cái trong ngoặc đi"). Dùng ở
 * bảng chọn nhạc và dòng "Nhạc nền" của bảng Premium — khỏi thêm 9 khoá × 15 ngôn ngữ chỉ để lặp lại cùng một chữ.
 */
export function tenBaiNhac(b: BaiNhac): string {
  const s = td(`tb.nhacBai.${b}`).replace(/^[^:：]*[:：]\s*/, '').replace(/\s*[（(][^）)]*[）)]\s*$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
