import { computed, ref } from 'vue';
import { laApp } from './native';
import { laNhung } from './nen-fb';
import { moChucNang, suKien } from './phan-tich';

/**
 * GIỜ VÀNG MỖI TỐI (28.11.2026, mockup duyệt https://claude.ai/artifact/TdLTzxW8Hc61MU3F23cvkk — mục tiêu 100 người online:
 * hẹn mọi người vào CÙNG một giờ để phòng online luôn có người). 20:00–21:00 THEO GIỜ TRÊN MÁY người chơi (chủ dự án
 * chốt; "giờ vàng thế giới" — một giờ chung — để sau).
 *  · Trang chủ: huy hiệu trên ô Chơi online — đếm ngược trong 3 tiếng trước, "×2 xu" trong giờ (MenuScreen).
 *  · Sảnh online: dải vàng + phút còn lại (OnlineScreen).
 *  · Thắng ván online trong giờ: ×2 xu (`heSoXu`) — xu cộng ở client, server chỉ chặn > DIEM_TOI_DA/ván.
 *  · Nhắc 19:55 (server apps/node-server/src/thongbao.ts `vongGioVang`), chỉ máy TỰ BẬT (lib/thong-bao.ts `batGioVang`).
 *  · Hỏi bật nhắc: sau ván THẮNG, khi về trang chủ, chỉ trong APP, tối đa 2 lần cách nhau ≥ 7 ngày (`nenHoiNhac`).
 */
export const GIO_BAT_DAU = 20;
export const GIO_KET_THUC = 21;
/** Huy hiệu đếm ngược hiện trong bấy nhiêu giờ trước giờ vàng. */
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

/** Đồng hồ giờ vàng — đọc lại mỗi 20 giây (đủ mịn cho "còn N phút"). */
export const gioVang = ref<TrangThaiGv>(trangThaiGioVang(new Date()));
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  setInterval(() => { gioVang.value = trangThaiGioVang(new Date()); }, 20_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) gioVang.value = trangThaiGioVang(new Date()); });
}
export const dangGioVang = computed(() => gioVang.value.dang);

/** "1:15" / "0:05" — giờ:phút còn lại tới giờ vàng. */
export function dinhDangCon(phut: number): string { return `${Math.floor(phut / 60)}:${String(phut % 60).padStart(2, '0')}`; }

/** Hệ số xu cho một ván ONLINE vừa xong: thắng trong giờ vàng → 2 (ghi sự kiện), còn lại 1. */
export function heSoXu(thang: boolean, now = new Date()): number {
  if (!thang || !trangThaiGioVang(now).dang) return 1;
  moChucNang('gio_vang_x2');
  return 2;
}

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
