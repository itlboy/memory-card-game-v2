import { ref, watch } from 'vue';
import vi from '@/locales/vi';
import en from '@/locales/en';
import es from '@/locales/es';
import pt from '@/locales/pt';
import fr from '@/locales/fr';
import de from '@/locales/de';
import ja from '@/locales/ja';
import ko from '@/locales/ko';
import zh from '@/locales/zh';
import ru from '@/locales/ru';
import id from '@/locales/id';
import th from '@/locales/th';
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
/**
 * 12 NGÔN NGỮ (12.10.2026, chủ dự án: "ít nhất 10 ngôn ngữ phổ biến trên App
 * Store và CH Play"). Tên ghi bằng CHÍNH ngôn ngữ đó — người không đọc được
 * tiếng Việt vẫn tìm ra tiếng của mình trong danh sách. `bcp` dùng cho định
 * dạng số (`Intl`) và thuộc tính `lang` của trang.
 * Chưa có tiếng Ả Rập: viết phải-sang-trái, phải lật cả bố cục — việc riêng.
 */
export const NGON_NGU = [
  { id: 'vi', ten: 'Tiếng Việt', bcp: 'vi-VN' },
  { id: 'en', ten: 'English', bcp: 'en-US' },
  { id: 'es', ten: 'Español', bcp: 'es-ES' },
  { id: 'pt', ten: 'Português (Brasil)', bcp: 'pt-BR' },
  { id: 'fr', ten: 'Français', bcp: 'fr-FR' },
  { id: 'de', ten: 'Deutsch', bcp: 'de-DE' },
  { id: 'ja', ten: '日本語', bcp: 'ja-JP' },
  { id: 'ko', ten: '한국어', bcp: 'ko-KR' },
  { id: 'zh', ten: '简体中文', bcp: 'zh-CN' },
  { id: 'ru', ten: 'Русский', bcp: 'ru-RU' },
  { id: 'id', ten: 'Bahasa Indonesia', bcp: 'id-ID' },
  { id: 'th', ten: 'ไทย', bcp: 'th-TH' }
] as const;
export type NgonNgu = (typeof NGON_NGU)[number]['id'];
const LA_NGON_NGU = (x: unknown): x is NgonNgu => NGON_NGU.some((l) => l.id === x);
/** Mã BCP-47 của ngôn ngữ đang chọn — cho `Intl.NumberFormat`. */
export const bcp = (): string => NGON_NGU.find((l) => l.id === ngonNgu.value)?.bcp ?? 'vi-VN';

type ThamSo = Record<string, string | number>;
export type GiaTri = string | ((p: ThamSo) => string);
export type KhoaDich = keyof typeof vi;
/** Kiểu của MỌI từ điển: đủ đúng các khoá của bản tiếng Việt. */
export type TuDien = { [K in KhoaDich]: GiaTri };

const BO: Record<NgonNgu, TuDien> = { vi, en, es, pt, fr, de, ja, ko, zh, ru, id, th };
/** Mọi từ điển (trừ bản gốc) — cho test đối chiếu. */
export const TU_DIEN = BO;
const KHOA_LUU = 'mm.lang';
/** Ngôn ngữ MÁY (của app) lúc mở lần trước — để biết người dùng có vừa đổi trong Cài đặt máy không. */
const KHOA_MAY = 'mm.langMay';

function docBanDau(): NgonNgu {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (LA_NGON_NGU(q)) { localStorage.setItem(KHOA_LUU, q); return q; }
    const luu = localStorage.getItem(KHOA_LUU);
    /*
     * TRONG APP (Capacitor): ngôn ngữ của khung web CHÍNH LÀ ngôn ngữ riêng của app
     * mà người dùng đặt trong Cài đặt máy (iOS: Cài đặt → Flip Match; Android 13+:
     * Cài đặt → Ứng dụng → Ngôn ngữ). HAI CHIỀU ĐỒNG BỘ (14.10.2026):
     *  · máy → game: ngôn ngữ máy KHÁC lần mở trước (`mm.langMay`) nghĩa là người
     *    dùng vừa đổi trong Cài đặt → theo máy, bỏ lựa chọn cũ trong game;
     *  · game → máy: chọn trong game thì ghi xuống máy (`ghiXuongMay`, lib/ngon-ngu-app.ts).
     * Trên web thì không đoán (xem đầu file).
     */
    if (laApp && typeof navigator !== 'undefined') {
      const may = theoMay(navigator.languages ?? [navigator.language]);
      if (localStorage.getItem(KHOA_MAY) !== may) {
        localStorage.setItem(KHOA_MAY, may);
        localStorage.setItem(KHOA_LUU, may);
        return may;
      }
      return LA_NGON_NGU(luu) ? luu : may;
    }
    if (LA_NGON_NGU(luu)) return luu;
  } catch { /* chế độ riêng tư / môi trường không có location */ }
  return 'vi';
}

/** Ngôn ngữ đầu tiên của máy mà app có; không có cái nào thì English. */
export function theoMay(ds: readonly string[]): NgonNgu {
  for (const tag of ds) {
    const goc = tag.toLowerCase().split(/[-_]/)[0];
    const ma = goc === 'in' ? 'id' : goc;   // Android cũ báo tiếng Indonesia là "in"
    if (LA_NGON_NGU(ma)) return ma;
  }
  return 'en';
}

export const ngonNgu = ref<NgonNgu>(docBanDau());

watch(ngonNgu, (l, cu) => {
  try { localStorage.setItem(KHOA_LUU, l); } catch { /* bỏ qua */ }
  // Người chơi đổi trong game (không phải lần đặt đầu): ghi xuống Cài đặt máy cho khớp
  if (cu !== undefined && laApp) {
    try { localStorage.setItem(KHOA_MAY, l); } catch { /* bỏ qua */ }
    void import('./ngon-ngu-app').then((m) => m.ghiXuongMay(l)).catch(() => { /* không có plugin */ });
  }
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

