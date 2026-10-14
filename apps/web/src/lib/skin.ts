import { computed, ref, watch } from 'vue';
import { daMuaPremium, hienPremium } from './premium';

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
 */
export const SKINS = ['keo', 'neon', 'go', 'sao', 'bong'] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_MAC_DINH: Skin = 'keo';

/** Màu thanh trình duyệt / thanh trạng thái (meta theme-color) cho từng skin. */
export const MAU_THANH: Record<Skin, string> = { keo: '#5cc2f2', go: '#3a2618', neon: '#6a5cff', sao: '#0d0f2b', bong: '#ffe3f1' };

/**
 * Skin PREMIUM — nằm trong cùng gói với theme premium (lib/premium.ts). Chủ dự án
 * chốt 14.10.2026: thêm Đêm Sao (sao) và Kẹo Bông (bong); Gỗ ở lại miễn phí.
 * Chưa mua thì menu vẫn bày ra (kèm khoá) để người chơi biết có, nhưng không chọn được.
 */
export const SKIN_PREMIUM: ReadonlySet<Skin> = new Set<Skin>(['sao', 'bong']);
/** Skin bày trong menu: chưa bán Premium (`banPremium`) thì skin premium ẩn hẳn. */
export const skinsHien = computed(() => SKINS.filter((s) => !SKIN_PREMIUM.has(s) || hienPremium.value));
export const skinChoiDuoc = (s: Skin): boolean => !SKIN_PREMIUM.has(s) || daMuaPremium.value;

const KHOA = 'mm.skin';
const laSkin = (s: unknown): s is Skin => typeof s === 'string' && (SKINS as readonly string[]).includes(s);

function docSkin(): Skin {
  try {
    const q = new URLSearchParams(location.search).get('skin');
    if (laSkin(q)) { localStorage.setItem(KHOA, q); return q; }   // ?skin= để thử, kể cả skin premium
    const s = localStorage.getItem(KHOA);
    // Skin premium mà gói hết hạn/chưa mua → về mặc định (người dùng Gỗ cũ cũng vậy)
    if (laSkin(s) && skinChoiDuoc(s)) return s;
  } catch { /* chế độ riêng tư */ }
  return SKIN_MAC_DINH;
}

export const skin = ref<Skin>(docSkin());

export function datSkin(s: Skin): void {
  if (!skinChoiDuoc(s)) return;
  skin.value = s;
  try { localStorage.setItem(KHOA, s); } catch { /* chế độ riêng tư */ }
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
