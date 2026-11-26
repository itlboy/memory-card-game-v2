import { ref, watch } from 'vue';

/*
 * SKIN = LỚP ÁO CỦA CẢ APP, tách khỏi bố cục và luật chơi.
 *
 * Component chỉ đọc token (biến CSS ở tokens.css) và class chung; mỗi skin là
 * MỘT file `styles/skins/<id>.css` ghi đè token + vài khối hình dáng dưới
 * `:root[data-skin='<id>']`. Thêm skin = thêm một id ở đây + một file CSS + tên
 * ở 12 từ điển (`tb.skin.<id>`) — `test/skin.test.ts` canh đủ ba thứ.
 *
 * `neon` là giao diện cũ: màu CHÍNH LÀ giá trị gốc ở tokens.css, file riêng
 * chỉ thêm nền (sàn lưới + quầng sáng). Chỉ neon đọc công tắc Nền tối; hai skin kia có bảng màu cố định
 * (selector `:root[data-skin]` đặc hơn `[data-theme='dark']` nên luôn thắng).
 *
 * Nhớ ở localStorage `mm.skin` (như `mm.lang`), đặt TRƯỚC khi app mount để
 * không loé giao diện cũ một khung hình. `?skin=go` để thử nhanh.
 *
 * CHỈ KẸO CHO NGƯỜI CHƠI (chủ dự án 17.10.2026): menu chỉ còn Sáng/Tối của Kẹo; các skin
 * khác GIỮ NGUYÊN (có thể dùng lại) nhưng chỉ chọn được ở trang Debug. Tắt debug — hoặc
 * mở app khi debug tắt — là về Kẹo (`skinVeMacDinh`, App.vue), trừ khi URL có `?skin=`.
 */
/*
 * CHỈ CÒN KẸO (26.11.2026): bốn skin cũ Neon · Gỗ · Đêm Sao · Kẹo Bông ĐÃ XOÁ theo lời chủ dự án ("các theme cũ trước kia
 * thì tôi nghĩ nên bỏ đi luôn" → "đúng, xoá đi") — từ 17.10 chúng chỉ còn chọn được ở trang Debug, còn vẻ ngoài của app giờ
 * đổi bằng CHỦ ĐỀ (lib/canh.ts: nền + mặt lưng lá + icon bay). Giữ nguyên khung `SKINS` / `data-skin` vì toàn bộ CSS của Kẹo
 * viết dưới `:root[data-skin='keo']`; máy còn lưu `mm.skin` cũ thì `laSkin` loại ra và về Kẹo.
 * Màu gốc ở tokens.css (vẻ "neon" ngày trước) vẫn là LỚP NỀN mà Kẹo ghi đè — đừng xoá nó.
 */
export const SKINS = ['keo'] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_MAC_DINH: Skin = 'keo';

/** Màu thanh trình duyệt / thanh trạng thái (meta theme-color). */
export const MAU_THANH: Record<Skin, string> = { keo: '#5cc2f2' };

const KHOA = 'mm.skin';
const laSkin = (s: unknown): s is Skin => typeof s === 'string' && (SKINS as readonly string[]).includes(s);

function docSkin(): Skin {
  try {
    const q = new URLSearchParams(location.search).get('skin');
    if (laSkin(q)) { localStorage.setItem(KHOA, q); return q; }
    const s = localStorage.getItem(KHOA);
    if (laSkin(s)) return s;
  } catch { /* chế độ riêng tư */ }
  return SKIN_MAC_DINH;
}

export const skin = ref<Skin>(docSkin());

export function datSkin(s: Skin): void {
  skin.value = s;
  try { localStorage.setItem(KHOA, s); } catch { /* chế độ riêng tư */ }
}

/** Skin có công tắc Sáng/Tối (`data-theme`). Chỉ còn Kẹo nên luôn đúng — giữ hàm cho các chỗ đang gọi. */
export const coNenToi = (_s: Skin): boolean => true;

/** Về Kẹo — gọi khi debug tắt (skin khác chỉ dành cho debug). */
export function skinVeMacDinh(): void {
  skin.value = SKIN_MAC_DINH;
  try { localStorage.removeItem(KHOA); } catch { /* chế độ riêng tư */ }
}

function apDung(s: Skin): void {
  document.documentElement.dataset.skin = s;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', MAU_THANH[s]);
}

/** Gọi MỘT lần ở main.ts, trước `mount`. */
export function ganSkin(): void {
  apDung(skin.value);
  watch(skin, apDung);
}
