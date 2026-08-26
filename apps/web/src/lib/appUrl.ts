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
