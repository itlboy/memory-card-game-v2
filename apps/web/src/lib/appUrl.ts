/**
 * MỘT CHỖ DUY NHẤT ghi URL của app.
 *
 * Vì sao phải gom: nút Back cần dọn bớt mục lịch sử thừa bằng `history.back()`,
 * mà mỗi cú back lại KÉO URL LÙI THEO — `?playing=1` biến thành `?w=theme`, và
 * F5 sau đó dựng lại sai màn. Gom về đây thì lúc dọn xong chỉ việc ghi lại đúng
 * URL mà app đang muốn, không phải đoán.
 *
 * Luôn `replaceState`: mọi mục lịch sử đều do useBackGuard đẩy, còn đây chỉ đổi
 * địa chỉ của mục đang đứng.
 */

/*
 * CẬP NHẬT XONG VỀ ĐÚNG TRANG ĐANG ĐỨNG (chủ dự án 26.11.2026: "bấm cập nhật ở trang bất kỳ hay bị
 * load về trang chủ… reload ngay trang hiện tại là được mà"). Áp gói OTA là WebView mở gói mới ở
 * URL TRẦN — mất `?room=` / `?online=1` / `?mua=1` / `?w=` nên App dựng lại ở menu. lib/ota gọi
 * `nhoTrang()` ngay trước khi áp; lần nạp kế (trong `HAN_NHO_MS`) đặt lại query TRƯỚC khi App đọc URL.
 * Phải nằm ở module này và chạy lúc nạp: `mongMuon` bên dưới chụp URL ngay khi import.
 */
const NHO_KEY = 'mm.otaTrang';
const HAN_NHO_MS = 60_000;
/**
 * GIỮ DẤU 15 GIÂY SAU LẦN NẠP ĐẦU (28.11.2026, chủ dự án: "vào phòng chờ hoặc trang cài đặt, bấm update là reload về trang
 * chủ ngay" — tái hiện được mỗi lần). Bản 26.11 XOÁ dấu ngay ở lần nạp đầu; áp gói trên máy thật WebView có thể nạp HAI lần
 * (plugin nạp gói mới rồi nạp lại) → lần hai không còn dấu → trang chủ. Nay lần nạp nào trong 15 giây cũng khôi phục.
 */
const GIU_DAU_MS = 15_000;
/** Menu thanh trên đang mở lúc bấm "Cập nhật" (`cd` = trang Cài đặt) — trang này không có địa chỉ, phải nhớ riêng. */
let menuNho: 'menu' | 'cd' | null = null;
export function nhoMenu(m: 'menu' | 'cd' | null): void { menuNho = m; }
/** Ghi nhớ trang đang đứng (query của URL app + menu đang mở) để lần nạp kế mở lại đúng chỗ. */
export function nhoTrang(): void {
  try {
    const q = mongMuon.split('?')[1] ?? '';
    if (q || menuNho) localStorage.setItem(NHO_KEY, JSON.stringify({ q, luc: Date.now(), ...(menuNho ? { menu: menuNho } : {}) }));
    else localStorage.removeItem(NHO_KEY);
  } catch { /* chế độ riêng tư */ }
}
/**
 * Kết quả lần khôi phục sau cập nhật — main.ts gửi GA `ota_ve_trang`. `trang` = các KHOÁ của query đã nhớ (room / playing / …),
 * không gửi giá trị (mã phòng). `lan` = lần nạp thứ mấy dùng dấu này (2 = WebView nạp lại hai lần).
 */
export let ketQuaVeTrang: { ket_qua: 'url_san' | 'da_dat' | 'qua_han' | 'hong'; trang: string; giay: number; lan: number } | null = null;
/** TopBar đọc lúc gắn: mở lại menu / trang Cài đặt như trước khi cập nhật. */
export let menuKhoiPhuc: 'menu' | 'cd' | null = null;
/** Lần nạp sau `nhoTrang()`: đặt lại query + menu. URL đã có query (link mời, `keepUrlPathAfterReload`) thì URL thắng. */
export function khoiPhucTrang(): void {
  try {
    const tho = localStorage.getItem(NHO_KEY);
    if (!tho) return;
    const d = JSON.parse(tho) as { q?: unknown; luc?: unknown; menu?: unknown; dung?: unknown; lan?: unknown };
    const { q, luc } = d;
    if (typeof q !== 'string' || typeof luc !== 'number') { localStorage.removeItem(NHO_KEY); ketQuaVeTrang = { ket_qua: 'hong', trang: '', giay: 0, lan: 0 }; return; }
    const bay = Date.now();
    // Đã dùng ở lần nạp trước: chỉ còn hiệu lực GIU_DAU_MS kể từ lần đó
    if (typeof d.dung === 'number' && bay - d.dung > GIU_DAU_MS) { localStorage.removeItem(NHO_KEY); return; }
    const lan = (typeof d.lan === 'number' ? d.lan : 0) + 1;
    const trang = [...new URLSearchParams(q).keys()].join(',').slice(0, 40) + (d.menu ? `+menu_${d.menu}` : ''), giay = Math.round((bay - luc) / 1000);
    if (bay - luc > HAN_NHO_MS || (q && !/^[\w=&%.~-]{1,200}$/.test(q))) { localStorage.removeItem(NHO_KEY); ketQuaVeTrang = { ket_qua: 'qua_han', trang, giay, lan }; return; }
    localStorage.setItem(NHO_KEY, JSON.stringify({ ...d, dung: typeof d.dung === 'number' ? d.dung : bay, lan }));
    setTimeout(() => { try { localStorage.removeItem(NHO_KEY); } catch { /* bỏ qua */ } }, GIU_DAU_MS);
    if (d.menu === 'menu' || d.menu === 'cd') menuKhoiPhuc = d.menu;
    if (location.search || !q) { ketQuaVeTrang = { ket_qua: 'url_san', trang, giay, lan }; return; }
    history.replaceState(history.state, '', `${location.pathname}?${q}`);
    ketQuaVeTrang = { ket_qua: 'da_dat', trang, giay, lan };
  } catch { ketQuaVeTrang = { ket_qua: 'hong', trang: '', giay: 0, lan: 0 }; }
}
if (typeof location !== 'undefined') khoiPhucTrang();

/** URL mà app ĐANG MUỐN hiển thị — nguồn duy nhất để khôi phục sau khi tự lùi. */
let mongMuon = typeof location === 'undefined' ? '/' : location.pathname + location.search;

/** Ghi URL app (đường dẫn + query đầy đủ, ví dụ `/?playing=1`). */
export function ghiUrl(url: string): void {
  mongMuon = url;
  history.replaceState(history.state, '', url);
}

/** Ghi URL từ query rời: `null`/rỗng là URL sạch. */
export function ghiQuery(query: string | null): void {
  ghiUrl(location.pathname + (query ? `?${query}` : ''));
}

/** URL app đang muốn. useBackGuard gọi sau khi tự lùi để đặt lại cho đúng. */
export const urlApp = (): string => mongMuon;
