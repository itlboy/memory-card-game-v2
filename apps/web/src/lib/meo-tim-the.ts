/**
 * MẸO LẦN ĐẦU CHƠI TÌM THẺ (chủ dự án duyệt mockup 28.11.2026: https://claude.ai/artifact/23vzn9H7Zh5qTGRSZprbGX).
 * Log 27.11 có người ngồi cả ván không chọn — màn chơi cố ý KHÔNG có chữ, nên người mới không biết luật.
 *
 * Hai bong bóng, chỉ ván Tìm Thẻ ĐẦU TIÊN (một mình hoặc online, KHÔNG cho người xem), rồi không bao giờ hiện lại:
 *   · pha `xem`: "Nhớ vị trí từng lá";
 *   · pha `hoi`: "Lá nào giống thẻ giữa?" + viền vàng quanh thẻ giữa.
 * KHÔNG phủ tối, KHÔNG chặn chạm (đang tính giờ): chạm bàn lúc hỏi là tắt; hết pha hỏi đầu tiên là xong hẳn.
 * Bong bóng vẽ trong `BanVongTim` (prop `meo`), nằm trên lá cao nhất — không che lá nào.
 */
import { computed, ref, watch, type Ref } from 'vue';
import { moChucNang } from './phan-tich';
import { t } from './i18n';

const KHOA = 'mm.meo.timThe';
const doc = (): boolean => { try { return localStorage.getItem(KHOA) === '1'; } catch { return false; } };
const daXong = ref(doc());
function xong(): void {
  daXong.value = true;
  try { localStorage.setItem(KHOA, '1'); } catch { /* chế độ riêng tư: lần sau lại thấy, không sao */ }
}

export interface MeoBan { tieuDe: string; mo: string; vien: boolean }

/** `nhip`: pha của bàn; `choiDuoc`: mình là người chơi (không phải người xem). */
export function useMeoTimThe(nhip: Ref<string>, choiDuoc: Ref<boolean>): { meo: Ref<MeoBan | null>; daCham: () => void } {
  const buoc = ref<'xem' | 'hoi' | null>(null);
  watch([nhip, choiDuoc], ([n, c], [cu]) => {
    if (daXong.value || !c) { buoc.value = null; return; }
    if (n === 'xem') buoc.value = 'xem';
    else if (n === 'hoi' || n === 'noi') buoc.value = 'hoi';
    else if (cu === 'hoi') { buoc.value = null; xong(); }     // hết pha hỏi đầu tiên
    else buoc.value = null;
  }, { immediate: true });
  watch(buoc, (b) => { if (b) moChucNang(`meo_tim_the_${b}`, {}, true); });
  const meo = computed((): MeoBan | null => buoc.value === 'xem'
    ? { tieuDe: t('tt.meo.xem'), mo: t('tt.meo.xemMo'), vien: false }
    : buoc.value === 'hoi' ? { tieuDe: t('tt.meo.hoi'), mo: t('tt.meo.hoiMo'), vien: true } : null);
  /** Chạm bàn lúc hỏi: tắt mẹo ngay (chạm vẫn chọn lá như thường). */
  const daCham = (): void => { if (buoc.value === 'hoi') { buoc.value = null; xong(); } };
  return { meo, daCham };
}
