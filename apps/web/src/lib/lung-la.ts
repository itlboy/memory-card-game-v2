import { watch } from 'vue';
import { canh, type Canh } from './canh';
import { moChucNang } from './phan-tich';

/**
 * MẶT LƯNG LÁ THEO HÌNH NỀN (26.11.2026) — chủ dự án: "khi người dùng chọn hình nền nào thì sẽ dùng mặt lưng đó, ngẫu
 * nhiên nếu có nhiều", áp "cho cả trong ván". Hình và luật vẽ ở styles/skins/keo-lung.css.
 *
 * MỖI VÁN MỘT MẶT LƯNG CHO CẢ BÀN: bốc ngẫu nhiên lúc ván bắt đầu rồi giữ tới hết ván. KHÔNG bốc theo từng lá —
 * lưng khác nhau là đánh dấu bài, trò lật thẻ hỏng luôn. Cảnh `goc` không có bộ riêng: giữ lưng ngôi sao.
 * Chỉ là trang trí phía máy mình: ván online mỗi người thấy mặt lưng của hình nền mình chọn.
 */
export const LUNG: Record<Exclude<Canh, 'goc'>, readonly string[]> = {
  'thien-ha': ['ht-troi', 'ht-thuy', 'ht-kim', 'ht-dat', 'ht-hoa', 'ht-moc', 'ht-tho', 'ht-thien', 'ht-hai'],
  'anh-dao': ['ad-hoa', 'ad-canh', 'ad-trang', 'ad-nui', 'ad-den']
};

const boCua = (c: Canh): readonly string[] => (c === 'goc' ? [] : LUNG[c]);

/** `n` mặt lưng KHÁC NHAU của một cảnh (xáo rồi cắt; `n` lớn hơn bộ thì trả cả bộ). */
export function bocNhieu(c: Canh, n: number): string[] {
  return boCua(c).map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, v]) => v);
}

let dangDung: string | null = null;
/** Mặt lưng ván đang dùng (null = lưng ngôi sao mặc định). */
export const lungVan = (): string | null => dangDung;

/**
 * Bốc mặt lưng cho VÁN MỚI và gắn lên <html data-lung>. Tránh lặp lại đúng mặt vừa dùng khi bộ có từ hai hình —
 * chơi liền mấy ván mà toàn một hình thì người chơi tưởng chỉ có một.
 */
export function bocLungVan(ghi = true): string | null {
  const bo = boCua(canh.value);
  const ung = bo.length > 1 ? bo.filter((x) => x !== dangDung) : bo;
  dangDung = ung.length ? ung[Math.floor(Math.random() * ung.length)]! : null;
  if (typeof document !== 'undefined') {
    if (dangDung) document.documentElement.dataset.lung = dangDung;
    else delete document.documentElement.dataset.lung;
  }
  if (ghi && dangDung) moChucNang('lung_la', { canh: canh.value, lung: dangDung });
  return dangDung;
}

/** Đổi hình nền (kể cả giữa ván, hoặc hết Premium về cảnh gốc) → mặt lưng đổi theo ngay. Gọi một lần lúc khởi động. */
export function ganLung(): void {
  bocLungVan(false);
  watch(canh, () => { bocLungVan(false); });
}
