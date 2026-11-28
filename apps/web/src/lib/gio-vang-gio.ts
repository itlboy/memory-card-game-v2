import { ref } from 'vue';

/**
 * PHẦN THUẦN CỦA GIỜ VÀNG — không import gì của app (lib/storage.ts và lib/taikhoan.ts dùng nó; lib/gio-vang.ts kéo theo
 * phan-tich → storage, import ngược sẽ thành vòng). Xem lib/gio-vang.ts cho phần giao diện/nhắc.
 *
 * LUẬT XU (28.11.2026, chủ dự án: "mục tiêu là số người dùng app đồng thời… không cần phải chơi online, chỉ cần mở app"):
 * trong 20:00–21:00 GIỜ MÁY, MỌI ván (một mình, đấu máy, chiến dịch, chung máy, online, Tìm Thẻ) được ×2 xu. Áp ở HAI cửa
 * chung: `store.addScore` / `store.saveResult` (tổng trên máy) và `taiKhoan.ghiVan` (điểm gửi server) — không sửa từng màn.
 * Đường đồng bộ xu server → máy (`addScore(…, false)`) KHÔNG nhân.
 */
export const GIO_BAT_DAU = 20;
export const GIO_KET_THUC = 21;
export const BAO_TRUOC_GIO = 3;

export interface TrangThaiGv { dang: boolean; conPhut: number; truocPhut: number | null }

/** Thuần — có test. `conPhut` = phút còn lại khi đang diễn ra; `truocPhut` = phút tới giờ vàng nếu trong BAO_TRUOC_GIO. */
export function trangThaiGioVang(now: Date): TrangThaiGv {
  const phut = now.getHours() * 60 + now.getMinutes();
  const bd = GIO_BAT_DAU * 60, kt = GIO_KET_THUC * 60;
  if (phut >= bd && phut < kt) return { dang: true, conPhut: kt - phut, truocPhut: null };
  const toi = bd - phut;
  return { dang: false, conPhut: 0, truocPhut: toi > 0 && toi <= BAO_TRUOC_GIO * 60 ? toi : null };
}

/** Tăng mỗi lần một khoản xu vừa được nhân đôi — App nghe để báo dải "Giờ vàng: ×2 xu" + ghi sự kiện. */
export const lanX2 = ref(0);

/** Hệ số xu lúc này: 2 trong giờ vàng, 1 ngoài giờ. `ghi` = đếm vào `lanX2` (cửa cộng xu trên máy). */
export function heSoXu(now = new Date(), ghi = false): number {
  // Môi trường test: TẮT trừ khi test tự bật (`globalThis.__gioVangTest = true`) — không thì test cộng xu đỏ mỗi ngày lúc 20:00
  // theo giờ máy chạy test (gặp 28.11.2026: 6 test cũ đỏ đúng giờ vàng). Code thật không bao giờ có cờ này.
  if (import.meta.env.MODE === 'test' && !(globalThis as { __gioVangTest?: boolean }).__gioVangTest) return 1;
  if (!trangThaiGioVang(now).dang) return 1;
  if (ghi) lanX2.value++;
  return 2;
}
