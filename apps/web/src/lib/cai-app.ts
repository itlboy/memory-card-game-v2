/**
 * CÀI LÊN MÀN HÌNH CHÍNH (22.10.2026, chủ dự án: app chưa lên App Store nên hướng dẫn
 * người chơi điện thoại thêm web vào màn hình chính để dùng như app).
 *
 * Làm NGAY TRONG GAME chứ không ở trang riêng: iPhone lưu đúng TRANG ĐANG MỞ, làm ở
 * game thì biểu tượng mở thẳng game; và người chơi làm theo ngay trên màn đang đứng.
 * Link chia sẻ được: `/?cai=1` mở game kèm hộp hướng dẫn (App.vue).
 *
 * Tự nhận thiết bị: iPhone/iPad → các bước Safari; Android → nút "Cài ngay" một chạm
 * khi Chrome cho (`beforeinstallprompt`), không thì các bước menu ⋮. Trình duyệt NHÚNG
 * (Zalo, Facebook, Messenger…) không có lối thêm vào màn hình chính → nhắc mở bằng
 * Safari/Chrome trước. Không hiện gì trong app store (`laApp`) hay khi đã mở từ biểu tượng.
 */
import { ref } from 'vue';
import { laApp } from './native';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

export type HeMay = 'ios' | 'android' | 'khac';
export const heMay: HeMay = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  ? 'ios' : /Android/.test(ua) ? 'android' : 'khac';

/** Trình duyệt nhúng trong app khác — ở đó không thêm vào màn hình chính được. */
export const trongAppKhac = /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|Messenger|TikTok|musical_ly|BytedanceWebview|Twitter|GSA\//.test(ua);

/** Đang chạy từ biểu tượng màn hình chính (đã cài). */
export const daCai = typeof window !== 'undefined' && (
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

/** Có nên mời cài không: điện thoại/máy tính bảng mở bằng trình duyệt, chưa cài. */
export const nenMoiCai = !laApp && !daCai && heMay !== 'khac';

/** Mục hướng dẫn trong Luật chơi: mọi nơi trừ khi đang là app (store hoặc đã cài). */
export const coHuongDanCai = !laApp && !daCai;

/** Tab đang xem (iOS / Android) — chung cho hộp và mục Luật chơi, mở sẵn theo máy. */
export const tabCai = ref<'ios' | 'android'>(heMay === 'android' ? 'android' : 'ios');

/** Hộp hướng dẫn đang mở — App.vue vẽ, MenuScreen/TopBar mở. */
export const hienCai = ref(false);
export const moCai = (): void => { hienCai.value = true; };

/** Viên mời trên trang chủ: người chơi bấm ✕ là ẩn hẳn trên máy đó (menu vẫn còn lối). */
const KHOA_AN = 'mm.anCai';
const docAn = (): boolean => { try { return localStorage.getItem(KHOA_AN) === '1'; } catch { return false; } };
export const anLoiMoi = ref(docAn());
export function tatLoiMoi(): void {
  anLoiMoi.value = true;
  try { localStorage.setItem(KHOA_AN, '1'); } catch { /* chế độ riêng tư */ }
}

/* Chrome Android: giữ sự kiện cài để nút "Cài ngay" gọi lại lúc người chơi bấm. */
interface SuKienCai extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
export const coCaiNgay = ref(false);
let hoi: SuKienCai | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); hoi = e as SuKienCai; coCaiNgay.value = true; });
  window.addEventListener('appinstalled', () => { hoi = null; coCaiNgay.value = false; hienCai.value = false; });
}
export async function caiNgay(): Promise<void> {
  if (!hoi) return;
  const e = hoi;
  await e.prompt();
  await e.userChoice.catch(() => null);
  hoi = null; coCaiNgay.value = false;
}
