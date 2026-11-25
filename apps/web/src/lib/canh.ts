import { ref } from 'vue';
import { moChucNang } from './phan-tich';

/**
 * HÌNH NỀN (cảnh sau bàn chơi + trang chủ) của skin Kẹo — quyền lợi PREMIUM đang làm (25.11.2026).
 * `goc` là cảnh mọi người đang có (mặt trời / trăng); các cảnh còn lại thay thiên thể bằng một HÀNH TINH
 * (styles/skins/keo-canh.css, đè biến `--thien-the`). Bản đầu (biển, hoàng hôn, núi tuyết, kẹo ngọt) đã bỏ vì bị che.
 * ĐANG THỬ: chỉ chọn được ở trang debug (DebugMenu). Khi mở bán thì thêm cổng `daMuaPremium` vào `datCanh`
 * và đưa bảng chọn ra Cài đặt.
 */
export const CANH = ['goc', 'sao-moc', 'sao-thuy', 'trai-dat', 'sao-tho', 'sao-hoa'] as const;
export type Canh = (typeof CANH)[number];
/** Tên chỉ dùng ở trang debug — ra Cài đặt thì chuyển sang i18n. */
export const TEN_CANH: Record<Canh, string> = { goc: 'Gốc', 'sao-moc': 'Sao Mộc', 'sao-thuy': 'Sao Thuỷ', 'trai-dat': 'Trái Đất', 'sao-tho': 'Sao Thổ', 'sao-hoa': 'Sao Hoả' };

const KHOA = 'mm.canh';
function doc(): Canh {
  try { const v = localStorage.getItem(KHOA); return (CANH as readonly string[]).includes(v ?? '') ? (v as Canh) : 'goc'; } catch { return 'goc'; }
}
export const canh = ref<Canh>(doc());

export function ganCanh(): void {
  if (canh.value === 'goc') delete document.documentElement.dataset.canh;
  else document.documentElement.dataset.canh = canh.value;
}
export function datCanh(c: Canh): void {
  canh.value = c;
  try { if (c === 'goc') localStorage.removeItem(KHOA); else localStorage.setItem(KHOA, c); } catch { /* chế độ riêng tư */ }
  ganCanh();
  moChucNang('hinh_nen', { canh: c });
}
