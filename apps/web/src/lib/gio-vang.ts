import { computed, ref } from 'vue';
import { laApp } from './native';
import { laNhung } from './nen-fb';
import { suKien } from './phan-tich';

/**
 * GIỜ VÀNG MỖI TỐI (28.11.2026, mockup duyệt https://claude.ai/artifact/TdLTzxW8Hc61MU3F23cvkk — mục tiêu 100 người online:
 * hẹn mọi người vào CÙNG một giờ để phòng online luôn có người). 20:00–21:00 THEO GIỜ TRÊN MÁY người chơi (chủ dự án
 * chốt; "giờ vàng thế giới" — một giờ chung — để sau).
 *  · Trang chủ: huy hiệu trên ô Chơi online — đếm ngược trong 3 tiếng trước, "×2 xu" trong giờ (MenuScreen).
 *  · Sảnh online: dải vàng + phút còn lại (OnlineScreen).
 *  · MỌI ván trong giờ: ×2 xu (lib/gio-vang-gio.ts `heSoXu`, áp ở store.addScore/saveResult + taiKhoan.ghiVan).
 *  · Nhắc 19:55 (server apps/node-server/src/thongbao.ts `vongGioVang`), chỉ máy TỰ BẬT (lib/thong-bao.ts `batGioVang`).
 *  · Hỏi bật nhắc: sau ván THẮNG, khi về trang chủ, chỉ trong APP, tối đa 2 lần cách nhau ≥ 7 ngày (`nenHoiNhac`).
 */
export { BAO_TRUOC_GIO, GIO_BAT_DAU, GIO_KET_THUC, heSoXu, lanX2, trangThaiGioVang, type TrangThaiGv } from './gio-vang-gio';
import { trangThaiGioVang, type TrangThaiGv } from './gio-vang-gio';

/** Đồng hồ giờ vàng — đọc lại mỗi 20 giây (đủ mịn cho "còn N phút"). */
export const gioVang = ref<TrangThaiGv>(trangThaiGioVang(new Date()));
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  setInterval(() => { gioVang.value = trangThaiGioVang(new Date()); }, 20_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) gioVang.value = trangThaiGioVang(new Date()); });
}
export const dangGioVang = computed(() => gioVang.value.dang);

/** "1:15" / "0:05" — giờ:phút còn lại tới giờ vàng. */
export function dinhDangCon(phut: number): string { return `${Math.floor(phut / 60)}:${String(phut % 60).padStart(2, '0')}`; }

/* ---------- hỏi bật nhắc ---------- */
const KHOA_HOI = 'mm.gvHoi';
export const HOI_TOI_DA = 2;
export const HOI_CACH_MS = 7 * 86_400_000;
interface DaHoi { lan: number; luc: number }
function docHoi(): DaHoi { try { return { lan: 0, luc: 0, ...(JSON.parse(localStorage.getItem(KHOA_HOI) ?? '{}') as Partial<DaHoi>) }; } catch { return { lan: 0, luc: 0 }; } }

/** Vừa thắng một ván (bất kỳ chế độ) — App gọi; lần về trang chủ kế tiếp mới xét hỏi. */
export const vuaThang = ref(false);

/**
 * Có nên hiện tấm "Hẹn bạn 20:00 mỗi tối?" không. Thuần theo tham số (test được): chỉ APP có plugin + server bật thông báo
 * (`coChuong`), chưa bật nhắc giờ vàng, KHÔNG phải bản nhúng, vừa thắng, chưa hỏi đủ HOI_TOI_DA lần, lần trước cách ≥ 7 ngày.
 */
export function nenHoiNhac(o: { coChuong: boolean; gvBat: boolean; vuaThang: boolean; now?: number; daHoi?: DaHoi; laApp?: boolean }): boolean {
  const h = o.daHoi ?? docHoi();
  const now = o.now ?? Date.now();
  return (o.laApp ?? laApp) && !laNhung && o.coChuong && !o.gvBat && o.vuaThang && h.lan < HOI_TOI_DA && (h.lan === 0 || now - h.luc >= HOI_CACH_MS);
}

/** Đã hiện tấm hỏi (dù người chơi chọn gì) — đếm lần, ghi sự kiện. */
export function ghiDaHoi(): void {
  const h = docHoi();
  try { localStorage.setItem(KHOA_HOI, JSON.stringify({ lan: h.lan + 1, luc: Date.now() })); } catch { /* chế độ riêng tư */ }
  suKien('nhac_hoi', { lan: h.lan + 1 });
}
