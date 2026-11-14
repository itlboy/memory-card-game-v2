import { computed, ref } from 'vue';

/**
 * CHẾ ĐỘ ĐỒNG ĐỘI 2 đấu 2 / 2 người đấu máy (docs/che-do-dong-doi.md) — MỞ CHO MỌI NGƯỜI từ 1.7.0
 * (chủ dự án 14.11.2026: "tôi chấp nhận phát hành luôn"). Công tắc này giấu NÚT CHỌN "Đồng đội" ở
 * phòng chờ: có sự cố thì đặt `false` là người chơi không mở được phòng đội mới (phòng thường không
 * đụng tới). Phòng ĐÃ bật Đồng đội thì ai vào cũng vẫn thấy đúng giao diện đội.
 * `dongDoiThu` (trang Debug) để thử khi công tắc đang tắt.
 */
export const DONG_DOI_MO = true;

const KHOA = 'mm.dongDoiThu';
const doc = (): boolean => { try { return localStorage.getItem(KHOA) === '1'; } catch { return false; } };

/** Công tắc thử ở trang Debug — tự tắt khi tắt debug (App.vue). */
export const dongDoiThu = ref(doc());

export function datDongDoiThu(bat: boolean): void {
  dongDoiThu.value = bat;
  try { if (bat) localStorage.setItem(KHOA, '1'); else localStorage.removeItem(KHOA); } catch { /* chế độ riêng tư */ }
}

/** Có hiện lựa chọn "Đồng đội" ở phòng chờ không. */
export const coChonDongDoi = computed(() => DONG_DOI_MO || dongDoiThu.value);
