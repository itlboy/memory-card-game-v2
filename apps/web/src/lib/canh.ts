import { ref, watch } from 'vue';
import { moChucNang } from './phan-tich';
import { daMuaPremium } from './premium';

/**
 * HÌNH NỀN (cảnh sau bàn chơi + trang chủ) của skin Kẹo — quyền lợi PREMIUM đang làm (25.11.2026).
 * `goc` là cảnh mọi người đang có (mặt trời / trăng); các cảnh còn lại thay thiên thể bằng một HÀNH TINH
 * (styles/skins/keo-canh.css, đè biến `--thien-the`). Bản đầu (biển, hoàng hôn, núi tuyết, kẹo ngọt) đã bỏ vì bị che.
 * ĐANG THỬ: chỉ chọn được ở trang debug (DebugMenu). Khi mở bán thì thêm cổng `daMuaPremium` vào `datCanh`
 * và đưa bảng chọn ra Cài đặt.
 */
export const CANH = ['goc', 'sao-moc', 'sao-thuy', 'trai-dat', 'sao-tho', 'sao-hoa'] as const;
export type Canh = (typeof CANH)[number];
/** Tên hiển thị: td(`pm.nen.${c}`) — 15 ngôn ngữ. */

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

/** HẾT / HUỶ PREMIUM thì về cảnh gốc — hình nền hành tinh là quyền lợi của gói (trang debug vẫn bật thử tự do được). */
watch(daMuaPremium, (co) => { if (!co && canh.value !== 'goc') datCanh('goc'); });
