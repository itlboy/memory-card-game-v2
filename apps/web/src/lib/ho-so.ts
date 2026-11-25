import { computed, ref } from 'vue';
import { store } from './storage';
import { laTenTuSinh } from './ten-goc';
import { AVATAR_HO_SO, MAU_HO_SO } from '@mm/engine';

/**
 * HỒ SƠ NGƯỜI CHƠI (25.11.2026, mockup duyệt https://claude.ai/artifact/TEoguR6Vy3GDoLpFcyx8go): tên + avatar thú +
 * màu. Tên vẫn nằm ở `playerNames[0]` (chung với online + bảng xếp hạng); avatar và màu ở `hoSo` của bản lưu.
 *
 * BẮT BUỘC (chủ dự án): chưa `xong` thì màn chào chặn trước trang chủ, không có nút bỏ qua. Ô tên TRỐNG với người
 * mới và người cũ còn mang tên tự sinh ("Sóc Đỏ Nhỏ" — `laTenTuSinh`); ai đã tự gõ tên thì giữ sẵn.
 */

export { AVATAR_HO_SO, MAU_HO_SO };

export interface HoSo { mat: string; mau: string; xong?: boolean }

const boc = <T>(ds: readonly T[]): T => ds[Math.floor(Math.random() * ds.length)]!;

/** Hồ sơ đang lưu, thiếu thì bốc sẵn avatar + màu (chưa ghi — chỉ để màn chào có giá trị chọn sẵn). */
function docHoSo(): HoSo {
  const h = store.hoSo();
  return {
    mat: h?.mat && AVATAR_HO_SO.includes(h.mat) ? h.mat : boc(AVATAR_HO_SO),
    mau: h?.mau && MAU_HO_SO.includes(h.mau) ? h.mau : boc(MAU_HO_SO),
    // Test (vitest): coi như đã qua màn chào — không thì màn chào bắt buộc phủ lên mọi test giao diện.
    xong: !!h?.xong || import.meta.env.MODE === 'test',
  };
}

export const hoSo = ref<HoSo>(docHoSo());
/** Tên hiển thị của mình (ô tên chung). */
export const tenToi = ref<string>((store.playerNames()[0] ?? '').trim());

/** Cần chặn bằng màn chào không. */
export const canMoChao = computed(() => !hoSo.value.xong);

/** Tên điền sẵn ở màn chào: trống nếu chưa có hoặc là tên tự sinh. */
export function tenDienSan(): string {
  const ten = (store.playerNames()[0] ?? '').trim();
  return laTenTuSinh(ten) ? '' : ten;
}

export function luuHoSo(ten: string, mat: string, mau: string): void {
  const sach = ten.trim();
  const ds = store.playerNames();
  store.savePlayerNames([sach, ...ds.slice(1)]);
  store.saveHoSo({ mat, mau, xong: true });
  hoSo.value = { mat, mau, xong: true };
  tenToi.value = sach;
}

/** Màu cho người chơi cùng máy (không phải mình): bỏ màu của mình, xoay vòng theo thứ tự. */
export function mauKhac(i: number): string {
  const con = MAU_HO_SO.filter((m) => m !== hoSo.value.mau);
  return con[i % con.length]!;
}

store.ngheDoiTen((ds) => { tenToi.value = (ds[0] ?? '').trim(); });
