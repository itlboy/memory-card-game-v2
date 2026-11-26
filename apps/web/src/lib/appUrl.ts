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
/** Ghi nhớ trang đang đứng (query của URL app) để lần nạp kế mở lại đúng chỗ. */
export function nhoTrang(): void {
  try {
    const q = mongMuon.split('?')[1] ?? '';
    if (q) localStorage.setItem(NHO_KEY, JSON.stringify({ q, luc: Date.now() }));
    else localStorage.removeItem(NHO_KEY);
  } catch { /* chế độ riêng tư */ }
}
/** Lần nạp ngay sau `nhoTrang()`: đặt lại query. URL đã có query (link mời…) thì URL thắng. */
export function khoiPhucTrang(): void {
  try {
    const tho = localStorage.getItem(NHO_KEY);
    if (!tho) return;
    localStorage.removeItem(NHO_KEY);                       // một lần — không kéo lại ở lần mở sau
    const { q, luc } = JSON.parse(tho) as { q?: unknown; luc?: unknown };
    if (typeof q !== 'string' || typeof luc !== 'number') return;
    if (location.search || Date.now() - luc > HAN_NHO_MS || !/^[\w=&%.~-]{1,200}$/.test(q)) return;
    history.replaceState(history.state, '', `${location.pathname}?${q}`);
  } catch { /* dữ liệu hỏng — mở ở trang chủ như cũ */ }
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
