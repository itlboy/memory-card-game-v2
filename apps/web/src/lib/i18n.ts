import { ref, watch } from 'vue';
import vi from '@/locales/vi';
import en from '@/locales/en';
import { laApp } from './native';

/**
 * ĐA NGÔN NGỮ — bộ dịch nhỏ tự viết (bắt đầu 12.10.2026).
 *
 * Vì sao không dùng vue-i18n: app chỉ cần tra khoá + điền tham số, mà một bộ
 * tự viết ~40 dòng thì TypeScript canh được đủ khoá — `en.ts` khai kiểu
 * `TuDien` nên thiếu một khoá là typecheck đỏ, không phải đợi người chơi thấy
 * chữ trống.
 *
 * MẶC ĐỊNH TIẾNG VIỆT, KHÔNG tự đoán theo ngôn ngữ trình duyệt: người chơi chủ
 * yếu là người Việt, mà rất nhiều người dùng điện thoại cài tiếng Anh — đoán
 * theo máy là họ mở ra thấy game tiếng Anh. Đổi bằng menu Cài đặt hoặc link
 * `?lang=en`; lựa chọn được nhớ (localStorage `mm.lang`).
 *
 * Giá trị là chuỗi có `{tham_so}`, hoặc hàm khi câu đổi hình theo số (số nhiều
 * tiếng Anh: "1 pair" / "2 pairs").
 */
export type NgonNgu = 'vi' | 'en';
export const NGON_NGU: readonly { id: NgonNgu; ten: string; ngan: string }[] = [
  { id: 'vi', ten: 'Tiếng Việt', ngan: 'VI' },
  { id: 'en', ten: 'English', ngan: 'EN' }
];

type ThamSo = Record<string, string | number>;
export type GiaTri = string | ((p: ThamSo) => string);
export type KhoaDich = keyof typeof vi;
/** Kiểu của MỌI từ điển: đủ đúng các khoá của bản tiếng Việt. */
export type TuDien = { [K in KhoaDich]: GiaTri };

const BO: Record<NgonNgu, TuDien> = { vi, en };
const KHOA_LUU = 'mm.lang';

function docBanDau(): NgonNgu {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'vi' || q === 'en') { localStorage.setItem(KHOA_LUU, q); return q; }
    const luu = localStorage.getItem(KHOA_LUU);
    if (luu === 'vi' || luu === 'en') return luu;
    /*
     * TRONG APP (Capacitor) thì ĐOÁN THEO MÁY: ngôn ngữ của khung web iOS chính
     * là ngôn ngữ máy — kể cả khi người dùng chọn ngôn ngữ riêng cho app trong
     * Cài đặt iOS — nên đó là lựa chọn thật. Trên web thì không (xem đầu file).
     */
    if (laApp && typeof navigator !== 'undefined') return /^vi\b/i.test(navigator.language) ? 'vi' : 'en';
  } catch { /* chế độ riêng tư / môi trường không có location */ }
  return 'vi';
}

export const ngonNgu = ref<NgonNgu>(docBanDau());

watch(ngonNgu, (l) => {
  try { localStorage.setItem(KHOA_LUU, l); } catch { /* bỏ qua */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    // Tiêu đề tab theo ngôn ngữ (index.html chỉ có bản tiếng Việt cho máy đọc thẻ og)
    document.title = t('chung.tieuDeTrang');
  }
}, { immediate: true });

/** Tra một khoá ở ngôn ngữ đang chọn, điền `{tham_so}`. Thiếu bản dịch thì về tiếng Việt. */
export function t(khoa: KhoaDich, p: ThamSo = {}): string {
  const v = BO[ngonNgu.value][khoa] ?? vi[khoa];
  if (typeof v === 'function') return v(p);
  return v.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ''));
}

/**
 * Khoá GHÉP ĐỘNG (`tb.am.${muc}`, `opt.${key}.${muc}`) — TypeScript không kiểm
 * được chuỗi ghép, nên đi cửa riêng này cho rõ. Lưới an toàn: khoá không có thật
 * thì trả về chính khoá (thấy ngay trên màn), và `test/i18n.test.ts` dò mọi
 * tiền tố động để chắc đủ bộ khoá.
 */
export function td(khoa: string, p: ThamSo = {}): string {
  return khoa in vi ? t(khoa as KhoaDich, p) : khoa;
}

