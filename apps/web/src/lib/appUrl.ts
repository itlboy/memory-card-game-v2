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
/*
 * DỰ PHÒNG THEO PHIÊN BẢN (28.11.2026, chủ dự án vẫn bị về trang chủ ở 1.10.13x; GA hôm đó: `ota_bam_trong` — không có một
 * `ota_ve_*` nào, tức dấu `mm.otaTrang` không sống tới lần nạp gói mới). Mọi lần ghi URL đều ghi `mm.trangCuoi` = { q, ban }
 * (ghi TỪ LÚC người chơi đi tới trang đó, nên đã nằm chắc trên đĩa từ lâu trước khi áp gói). Bấm Cập nhật / áp gói đóng dấu
 * `ap` + KHOÁ q (đóng menu kéo địa chỉ lùi không đè được). Lần nạp kế mà `ban` KHÁC bản đang chạy + `ap` còn trong hạn
 * → mở lại q đó. Chạy SAU dấu cũ (`mm.otaTrang`), chỉ khi dấu cũ không có.
 */
const TRANG_CUOI = 'mm.trangCuoi';
interface TrangCuoi { q: string; ban: string; ap?: number; menu?: 'menu' | 'cd' }
function docTrangCuoi(): TrangCuoi | null {
  try { const d = JSON.parse(localStorage.getItem(TRANG_CUOI) ?? 'null') as TrangCuoi | null; return d && typeof d.q === 'string' ? d : null; } catch { return null; }
}
function ghiTrangCuoi(q: string): void {
  try {
    const cu = docTrangCuoi();
    if (cu?.ap && cu.ban === __APP_VERSION__ && Date.now() - cu.ap < HAN_NHO_MS) return;   // đã đóng dấu áp gói: giữ q lúc bấm
    localStorage.setItem(TRANG_CUOI, JSON.stringify({ q, ban: __APP_VERSION__ }));
  } catch { /* chế độ riêng tư */ }
}
/** Menu thanh trên đang mở lúc bấm "Cập nhật" (`cd` = trang Cài đặt) — trang này không có địa chỉ, phải nhớ riêng. */
let menuNho: 'menu' | 'cd' | null = null;
export function nhoMenu(m: 'menu' | 'cd' | null): void { menuNho = m; }
/** Ghi nhớ trang đang đứng (query của URL app + menu đang mở) để lần nạp kế mở lại đúng chỗ. */
export function nhoTrang(): void {
  try {
    const tc = docTrangCuoi();
    const qNay = mongMuon.split('?')[1] ?? '';
    // Dấu dự phòng: q lúc bấm (hoặc q đã ghi nếu địa chỉ vừa bị kéo về trống), đóng dấu thời điểm áp
    if (!(tc?.ap && tc.ban === __APP_VERSION__ && Date.now() - tc.ap < HAN_NHO_MS)) {
      localStorage.setItem(TRANG_CUOI, JSON.stringify({ q: qNay || (tc?.ban === __APP_VERSION__ ? tc.q : ''), ban: __APP_VERSION__, ap: Date.now(), ...(menuNho ? { menu: menuNho } : {}) }));
    } else if (menuNho && !tc.menu) localStorage.setItem(TRANG_CUOI, JSON.stringify({ ...tc, menu: menuNho }));
    const q = mongMuon.split('?')[1] ?? '';
    // KHÔNG ghi đè dấu TỐT bằng địa chỉ trống (28.11.2026): TopBar nhớ trang NGAY lúc bấm "Cập nhật"; tới lúc áp gói (tải xong,
    // vài giây sau) đóng menu có thể đã kéo địa chỉ lùi về trang chủ — dấu ghi lúc bấm mới là trang thật.
    if (!q && !menuNho) {
      const cu = JSON.parse(localStorage.getItem(NHO_KEY) ?? 'null') as { q?: unknown; luc?: unknown; dung?: unknown } | null;
      if (cu && typeof cu.q === 'string' && cu.q && typeof cu.luc === 'number' && Date.now() - cu.luc < HAN_NHO_MS && cu.dung === undefined) return;
      localStorage.removeItem(NHO_KEY);
      return;
    }
    localStorage.setItem(NHO_KEY, JSON.stringify({ q, luc: Date.now(), ...(menuNho ? { menu: menuNho } : {}) }));
  } catch { /* chế độ riêng tư */ }
}
/** Loại trang (KHOÁ đầu của query, hoặc `trong`) — chẩn đoán bằng TÊN sự kiện GA (tham số chưa đăng ký thì không đọc được). */
export const loaiTrang = (): string => (mongMuon.split('?')[1] ?? '').split(/[=&]/)[0] || 'trong';
/**
 * Kết quả lần khôi phục sau cập nhật — main.ts gửi GA `ota_ve_trang`. `trang` = các KHOÁ của query đã nhớ (room / playing / …),
 * không gửi giá trị (mã phòng). `lan` = lần nạp thứ mấy dùng dấu này (2 = WebView nạp lại hai lần).
 */
export let ketQuaVeTrang: { ket_qua: 'url_san' | 'da_dat' | 'qua_han' | 'hong' | 'theo_ban'; trang: string; giay: number; lan: number } | null = null;
/** TopBar đọc lúc gắn: mở lại menu / trang Cài đặt như trước khi cập nhật. */
export let menuKhoiPhuc: 'menu' | 'cd' | null = null;
/** Lần nạp sau `nhoTrang()`: đặt lại query + menu. URL đã có query (link mời, `keepUrlPathAfterReload`) thì URL thắng. */
export function khoiPhucTrang(): void {
  try {
    const tho = localStorage.getItem(NHO_KEY);
    if (!tho) { khoiPhucTheoBan(); return; }
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
/** Dự phòng: dấu cũ không có, nhưng vừa lên PHIÊN BẢN MỚI ngay sau khi bấm Cập nhật / áp gói → mở lại trang đã ghi. */
function khoiPhucTheoBan(): void {
  const tc = docTrangCuoi();
  if (!tc?.ap || tc.ban === __APP_VERSION__) return;
  const bay = Date.now(), giay = Math.round((bay - tc.ap) / 1000);
  const trang = [...new URLSearchParams(tc.q).keys()].join(',').slice(0, 40) + (tc.menu ? `+menu_${tc.menu}` : '');
  try { localStorage.setItem(TRANG_CUOI, JSON.stringify({ q: tc.q, ban: __APP_VERSION__ })); } catch { /* bỏ qua */ }
  if (bay - tc.ap > HAN_NHO_MS || (tc.q && !/^[\w=&%.~-]{1,200}$/.test(tc.q))) { ketQuaVeTrang = { ket_qua: 'qua_han', trang, giay, lan: 1 }; return; }
  if (tc.menu === 'menu' || tc.menu === 'cd') menuKhoiPhuc = tc.menu;
  if (location.search || !tc.q) { ketQuaVeTrang = { ket_qua: 'url_san', trang, giay, lan: 1 }; return; }
  history.replaceState(history.state, '', `${location.pathname}?${tc.q}`);
  ketQuaVeTrang = { ket_qua: 'theo_ban', trang, giay, lan: 1 };
}
if (typeof location !== 'undefined') khoiPhucTrang();

/** URL mà app ĐANG MUỐN hiển thị — nguồn duy nhất để khôi phục sau khi tự lùi. */
let mongMuon = typeof location === 'undefined' ? '/' : location.pathname + location.search;

/** Ghi URL app (đường dẫn + query đầy đủ, ví dụ `/?playing=1`). */
export function ghiUrl(url: string): void {
  mongMuon = url;
  ghiTrangCuoi(url.split('?')[1] ?? '');
  history.replaceState(history.state, '', url);
}

/** Ghi URL từ query rời: `null`/rỗng là URL sạch. */
export function ghiQuery(query: string | null): void {
  ghiUrl(location.pathname + (query ? `?${query}` : ''));
}

/** URL app đang muốn. useBackGuard gọi sau khi tự lùi để đặt lại cho đúng. */
export const urlApp = (): string => mongMuon;
