/**
 * GIỮ MÀN HÌNH SÁNG khi đang ở ván / phòng online / Mưa Thẻ (chủ dự án 26.11.2026: "đang xem ván
 * màn hình hay bị tối"). Người XEM ván không chạm gì nên máy tự mờ rồi khoá sau ~30 giây.
 *
 * Dùng Screen Wake Lock của web (`navigator.wakeLock`) — đi theo gói OTA, không cần plugin native.
 * Máy không có API này (WebView cũ) thì im lặng bỏ qua: màn tự tắt như trước, không lỗi.
 *
 * BẪY: hệ điều hành TỰ NHẢ khoá mỗi lần trang ẩn (xuống nền, khoá máy) và KHÔNG tự lấy lại —
 * phải xin lại khi trang hiện lại, không thì chỉ giữ sáng được tới lần rời app đầu tiên.
 * Về menu là nhả ngay: giữ sáng cả ở menu là ngốn pin vô ích.
 */
interface Khoa { released: boolean; release(): Promise<void>; addEventListener(ev: 'release', f: () => void): void }
interface CoKhoa { wakeLock?: { request(loai: 'screen'): Promise<Khoa> } }

let muon = false;
let khoa: Khoa | null = null;
let dangXin = false;
let daGan = false;

async function xin(): Promise<void> {
  if (!muon || dangXin || (khoa && !khoa.released)) return;
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const wl = (navigator as unknown as CoKhoa).wakeLock;
  if (!wl) return;
  dangXin = true;
  try {
    const k = await wl.request('screen');
    k.addEventListener('release', () => { if (khoa === k) khoa = null; });
    khoa = k;
    if (!muon) nha();                     // đã về menu trong lúc chờ
  } catch { /* pin yếu / hệ điều hành từ chối — thử lại ở lần hiện trang sau */ }
  finally { dangXin = false; }
}

function nha(): void {
  const k = khoa;
  khoa = null;
  void k?.release().catch(() => undefined);
}

/** Bật/tắt giữ sáng. Gọi lại nhiều lần là vô hại. */
export function giuSang(bat: boolean): void {
  muon = bat;
  if (!bat) { nha(); return; }
  if (!daGan && typeof document !== 'undefined') {
    daGan = true;
    document.addEventListener('visibilitychange', () => { void xin(); });
  }
  void xin();
}
