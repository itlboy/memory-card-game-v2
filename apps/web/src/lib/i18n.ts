import { ref, watch } from 'vue';
import vi from '@/locales/vi';
import { laApp } from './native';
import { ghiUrl } from './appUrl';

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
 * 15 NGÔN NGỮ — 12 từ 12.10.2026 (chủ dự án: "ít nhất 10 ngôn ngữ phổ biến trên App
 * Store và CH Play"), thêm Ý, Thổ Nhĩ Kỳ, Trung phồn thể 15.10.2026. THÊM/BỚT MỘT
 * NGÔN NGỮ: làm theo danh sách mọi chỗ phải đổi ở docs/ngon-ngu.md. Tên ghi bằng CHÍNH ngôn ngữ đó — người không đọc được
 * tiếng Việt vẫn tìm ra tiếng của mình trong danh sách. `bcp` dùng cho định
 * dạng số (`Intl`) và thuộc tính `lang` của trang.
 * Chưa có tiếng Ả Rập: viết phải-sang-trái, phải lật cả bố cục — việc riêng.
 */
// Thứ tự = thứ tự trong menu chọn: English đầu, Tiếng Việt cuối (chủ dự án 14.10.2026).
// MẶC ĐỊNH vẫn là tiếng Việt — đó do `ngonNgu` quyết, không do thứ tự này.
export const NGON_NGU = [
  { id: 'en', ten: 'English', bcp: 'en-US' },
  { id: 'es', ten: 'Español', bcp: 'es-ES' },
  { id: 'pt', ten: 'Português (Brasil)', bcp: 'pt-BR' },
  { id: 'fr', ten: 'Français', bcp: 'fr-FR' },
  { id: 'de', ten: 'Deutsch', bcp: 'de-DE' },
  { id: 'it', ten: 'Italiano', bcp: 'it-IT' },
  { id: 'tr', ten: 'Türkçe', bcp: 'tr-TR' },
  { id: 'ja', ten: '日本語', bcp: 'ja-JP' },
  { id: 'ko', ten: '한국어', bcp: 'ko-KR' },
  { id: 'zh', ten: '简体中文', bcp: 'zh-CN' },
  { id: 'zh-TW', ten: '繁體中文', bcp: 'zh-TW' },
  { id: 'ru', ten: 'Русский', bcp: 'ru-RU' },
  { id: 'id', ten: 'Bahasa Indonesia', bcp: 'id-ID' },
  { id: 'th', ten: 'ไทย', bcp: 'th-TH' },
  { id: 'vi', ten: 'Tiếng Việt', bcp: 'vi-VN' }
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

/*
 * TỪ ĐIỂN TẢI THEO NHU CẦU (18.10.2026, tốc độ trang): 15 từ điển ~530KB nguồn = phần lớn gói JS
 * chính (Lighthouse: chữ đầu tiên hiện sau 5 giây trên 4G). Tiếng Việt (bản GỐC, cũng là dự phòng
 * khi thiếu khoá) luôn có sẵn; ngôn ngữ khác là một chunk riêng, `main.ts` chờ nạp xong ngôn ngữ đầu
 * rồi mới mount (không loé tiếng Việt). Đổi ngôn ngữ giữa chừng: chữ theo bản mới ngay khi chunk về
 * (`phienBan` báo Vue vẽ lại). Trong app/PWA chunk nằm sẵn trên máy nên vẫn chạy không mạng.
 * Test nạp đủ cả bộ trước (test/setup-tu-dien.ts) — `ngonNgu.value = 'en'` có chữ ngay.
 */
const NAP = import.meta.glob<{ default: TuDien }>(['../locales/*.ts', '!../locales/vi.ts']);
const BO: Partial<Record<NgonNgu, TuDien>> = { vi };
const phienBan = ref(0);
/** Mọi từ điển ĐÃ NẠP — cho test đối chiếu (setup nạp đủ). */
export const TU_DIEN = BO as Record<NgonNgu, TuDien>;
/** Đưa sẵn một từ điển vào (test). */
export function ganTuDien(l: NgonNgu, tu: TuDien): void { BO[l] = tu; phienBan.value++; }
/** Nạp từ điển của một ngôn ngữ (chunk riêng). Lỗi mạng → vẫn chạy bằng tiếng Việt. */
export async function napTuDien(l: NgonNgu): Promise<void> {
  if (BO[l]) return;
  const nap = NAP[`../locales/${l}.ts`];
  if (!nap) return;
  try { ganTuDien(l, (await nap()).default); } catch { /* mất mạng giữa chừng: chữ tiếng Việt */ }
}
const KHOA_LUU = 'mm.lang';
/** Ngôn ngữ MÁY (của app) lúc mở lần trước — để biết người dùng có vừa đổi trong Cài đặt máy không. */
const KHOA_MAY = 'mm.langMay';

/*
 * MỖI NGÔN NGỮ MỘT ĐỊA CHỈ CHƠI (SEO, 18.10.2026): `/` = tiếng Việt (mặc định), `/<mã>/` = ngôn ngữ
 * khác (`dist/<mã>/index.html` dựng sẵn tiêu đề/mô tả/hreflang — tools/dung-trang-cong-khai.mjs).
 * Google tìm "memory game online" phải ra `/en/` bằng tiếng Anh, không ra trang tiếng Việt.
 * Chỉ trên web: app gói luôn ở `/`.
 */
export const duongChoi = (l: NgonNgu): string => (l === 'vi' ? '/' : `/${l}/`);
const MAU_DUONG_CHOI = /^\/(?:([a-z]{2}(?:-[A-Z]{2})?)\/)?$/;

function docBanDau(): NgonNgu {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (LA_NGON_NGU(q)) { localStorage.setItem(KHOA_LUU, q); return q; }
    // Địa chỉ /<mã>/ thắng lựa chọn đã lưu: đó là trang người ta vừa bấm vào từ Google / link
    const p = laApp ? null : location.pathname.match(MAU_DUONG_CHOI)?.[1];
    if (LA_NGON_NGU(p)) { localStorage.setItem(KHOA_LUU, p); return p; }
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
    // Trung PHỒN THỂ (Đài Loan, Hồng Kông, Macao, "Hant") — xét trước khi cắt về "zh"
    if (/^zh[-_](hant|tw|hk|mo)\b/i.test(tag)) return 'zh-TW';
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
  let doiTieuDe = false;
  // Địa chỉ đi theo ngôn ngữ (chỉ khi đang ở trang chơi gốc `/` hoặc `/<mã>/`, không đụng trang khác)
  if (!laApp && typeof location !== 'undefined' && MAU_DUONG_CHOI.test(location.pathname)) {
    const q = new URLSearchParams(location.search); q.delete('lang');
    const qs = q.toString(), dich = duongChoi(l) + (qs ? `?${qs}` : '');
    if (dich !== location.pathname + location.search) { ghiUrl(dich); doiTieuDe = true; }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    // Tiêu đề tab theo ngôn ngữ. Lần đầu ở ĐÚNG trang chơi của ngôn ngữ thì GIỮ tiêu đề trong HTML:
    // đó là tiêu đề SEO dựng sẵn (game.title), và Google đọc tiêu đề SAU khi JS chạy.
    if (doiTieuDe || cu !== undefined || laApp) void napTuDien(l).then(() => { if (ngonNgu.value === l) document.title = t('chung.tieuDeTrang'); });
  }
  void napTuDien(l);
}, { immediate: true });

/** Tra một khoá ở ngôn ngữ đang chọn, điền `{tham_so}`. Thiếu bản dịch thì về tiếng Việt. */
export function t(khoa: KhoaDich, p: ThamSo = {}): string {
  void phienBan.value;   // phụ thuộc: từ điển nạp xong thì Vue vẽ lại
  const v = BO[ngonNgu.value]?.[khoa] ?? vi[khoa];
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

