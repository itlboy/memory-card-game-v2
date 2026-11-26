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
/*
 * CẢNH TRỌN BỘ (26.11.2026, chủ dự án: "hình nền đẹp hơn, thậm chí bày bố lại cả 3 lá bài, thay đổi các icon bay đằng
 * sau"): `thien-ha` và `anh-dao` đổi CẢ trời, chân trời, cách bày ba lá ở trang chủ (QuatLa), mặt lưng lá và bộ icon
 * bay (IconBay đọc `ICON_CANH`). Hành tinh chỉ đổi thiên thể. Mỗi cảnh có bản sáng + tối theo nền người chơi chọn.
 */
/* 26.11.2026: BỎ 5 hình nền hành tinh lẻ (chủ dự án: bảng chọn "hơi rối, chỉ có mặc định, thiên hà và hoa anh đào thôi").
   Máy đang lưu một hành tinh thì `doc()` trả về `goc`. Ảnh hành tinh (--ht-…) vẫn giữ: Thiên hà vẽ bằng Sao Thổ + Sao Hoả. */
export const CANH = ['goc', 'thien-ha', 'anh-dao'] as const;
/** Bộ icon bay riêng của cảnh trọn bộ — cảnh khác dùng bộ mặc định của IconBay. */
export const ICON_CANH: Partial<Record<string, string[]>> = {
  'thien-ha': ['🚀', '🪐', '⭐', '🛸', '☄️', '🌙', '👽', '🛰️', '🌟', '💫', '🌠', '🔭', '🌍', '✨', '👾'],
  'anh-dao': ['🌸', '🦋', '🍡', '🎐', '🏮', '🐦', '🍵', '🎏', '🌷', '🍃', '💮', '🎋', '🐞', '🌸', '🪷']
};
export type Canh = (typeof CANH)[number];
/** Tên hiển thị: td(`pm.nen.${c}`) — 15 ngôn ngữ. */

const KHOA = 'mm.canh';
function doc(): Canh {
  try { const v = localStorage.getItem(KHOA); return (CANH as readonly string[]).includes(v ?? '') ? (v as Canh) : 'goc'; } catch { return 'goc'; }
}
export const canh = ref<Canh>(doc());

/*
 * NGẪU NHIÊN (26.11.2026, chủ dự án: "trong các settings đó có thêm mục ngẫu nhiên… chúng ta sẽ đổi ngẫu nhiên"): bật thì
 * mỗi lần MỞ APP và mỗi lần VỀ TRANG CHỦ sau một ván, hình nền đổi sang một hình khác (`doiCanhNgauNhien`, App gọi).
 * KHÔNG đổi giữa ván — nền đổi lúc đang nhớ thẻ là phá người chơi. Chọn tay một hình là tắt ngẫu nhiên.
 * Cần Premium (chưa có thì chỉ có một hình, không có gì để đổi): hết Premium là tắt theo.
 */
const KHOA_NN = 'mm.canh.nn';
export const canhNgauNhien = ref((() => { try { return localStorage.getItem(KHOA_NN) === '1'; } catch { return false; } })());
function luuCanh(c: Canh): void {
  canh.value = c;
  try { if (c === 'goc') localStorage.removeItem(KHOA); else localStorage.setItem(KHOA, c); } catch { /* chế độ riêng tư */ }
  ganCanh();
}
function luuNN(bat: boolean): void {
  canhNgauNhien.value = bat;
  try { if (bat) localStorage.setItem(KHOA_NN, '1'); else localStorage.removeItem(KHOA_NN); } catch { /* chế độ riêng tư */ }
}
/** Đang bật ngẫu nhiên thì đổi sang một hình nền KHÁC hình đang dùng. Trả hình mới (hoặc null nếu không đổi). */
export function doiCanhNgauNhien(): Canh | null {
  if (!canhNgauNhien.value || !daMuaPremium.value) return null;
  const ung = CANH.filter((c) => c !== canh.value);
  const moi = ung[Math.floor(Math.random() * ung.length)]!;
  luuCanh(moi);
  return moi;
}
/** Bật/tắt mục "Ngẫu nhiên" ở bảng hình nền. Bật là đổi ngay một lần cho người chơi thấy. */
export function datCanhNgauNhien(bat: boolean): void {
  luuNN(bat);
  moChucNang('hinh_nen', { canh: bat ? 'ngau-nhien' : canh.value });
  if (bat) doiCanhNgauNhien();
}

export function ganCanh(): void {
  if (canh.value === 'goc') delete document.documentElement.dataset.canh;
  else document.documentElement.dataset.canh = canh.value;
}
export function datCanh(c: Canh): void {
  luuNN(false);   // chọn tay một hình = thôi ngẫu nhiên
  luuCanh(c);
  moChucNang('hinh_nen', { canh: c });
}

/** HẾT / HUỶ PREMIUM thì về cảnh gốc — hình nền hành tinh là quyền lợi của gói (trang debug vẫn bật thử tự do được). */
watch(daMuaPremium, (co) => { if (!co && canh.value !== 'goc') datCanh('goc'); });
