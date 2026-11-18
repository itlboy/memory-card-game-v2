import { ref } from 'vue';
import { laApp, nenApp, SERVER_URL } from './native';
import { ngonNgu } from './i18n';
import { suKien } from './phan-tich';

/**
 * CHUÔNG "BÁO TÔI KHI CÓ PHÒNG MỚI" (18.11.2026) — server: apps/node-server/src/thongbao.ts.
 *
 * Chỉ có trong APP (iOS/Android), và chỉ khi:
 *  - bản app có plugin `@capacitor/push-notifications` (từ 1.8.17). Gói OTA mới chạy trên
 *    app cũ thì `isPluginAvailable` = false → GIẤU chuông. Nhờ vậy KHÔNG phải nâng
 *    `minNative` (nâng là cắt OTA của mọi máy 1.3.0–1.8.16);
 *  - server bật nền đó (`/api/thongbao/config`) — server Cloudflare dự phòng không có → 404 → giấu.
 *
 * Bấm chuông lần đầu mới XIN QUYỀN (không hỏi lúc mở app). Tắt = xoá mã máy khỏi server.
 * Mã máy giữ ở localStorage `mm.thongBao`; có mã nghĩa là đang bật.
 */

const KHOA = 'mm.thongBao';
/** Mã máy đã tắt mà chưa báo được server (mất mạng lúc bấm) — thử lại lần mở app sau. */
const KHOA_TAT = 'mm.thongBao.tat';
const PLUGIN = 'PushNotifications';

/** Chuông có được vẽ không. */
export const coChuong = ref(false);
/** Đang nhận thông báo. */
export const dangBat = ref(false);
/** Người chơi đã chặn thông báo ở Cài đặt máy — bấm chuông chỉ hiện lời chỉ đường. */
export const biChan = ref(false);

function docMa(): string | null {
  try { return localStorage.getItem(KHOA); } catch { return null; }
}
function ghiMa(ma: string | null): void {
  try { if (ma) localStorage.setItem(KHOA, ma); else localStorage.removeItem(KHOA); } catch { /* bỏ qua */ }
  dangBat.value = !!ma;
}

/** Mã máy để server bỏ qua phòng của chính mình (gắn `?tb=` lúc tạo phòng). */
export function maMayHienTai(): string | null { return dangBat.value ? docMa() : null; }

function pluginCo(): boolean {
  const cap = (globalThis as { Capacitor?: { isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  return laApp && cap?.isPluginAvailable?.(PLUGIN) === true;
}

async function guiLenServer(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/thongbao`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, nen: nenApp, lang: ngonNgu.value, lechPhut: -new Date().getTimezoneOffset() })
    });
    return res.ok;
  } catch { return false; }
}

/** Đăng ký với APNs/FCM, chờ mã máy (tối đa 10 giây). */
async function layMa(): Promise<string | null> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  return new Promise<string | null>((resolve) => {
    let xong = false;
    const het = (v: string | null): void => { if (!xong) { xong = true; resolve(v); } };
    void PushNotifications.addListener('registration', (t) => het(t.value));
    void PushNotifications.addListener('registrationError', () => het(null));
    void PushNotifications.register().catch(() => het(null));
    setTimeout(() => het(null), 10_000);
  });
}

let daKhoiDong = false;

/** Gọi một lần lúc mở app (main.ts). Im lặng mọi lỗi — chuông là lớp phủ. */
export async function khoiDongThongBao(): Promise<void> {
  if (daKhoiDong || !pluginCo()) return;
  daKhoiDong = true;
  try {
    const res = await fetch(`${SERVER_URL}/api/thongbao/config`);
    if (!res.ok) return;
    const cfg = (await res.json()) as { ios?: boolean; android?: boolean };
    if (!(nenApp === 'ios' ? cfg.ios : cfg.android)) return;
  } catch { return; }
  coChuong.value = true;
  dangBat.value = !!docMa();
  try { const cu = localStorage.getItem(KHOA_TAT); if (cu && cu !== docMa()) void tatTrenServer(cu); } catch { /* bỏ qua */ }

  const { PushNotifications } = await import('@capacitor/push-notifications');
  // Bấm vào thông báo → vào thẳng phòng, đi CÙNG lối với link mời (App.vue đọc ?room=)
  void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const code = String((a.notification.data as { room?: unknown } | undefined)?.room ?? '');
    suKien('thong_bao_mo', { co_phong: /^\d{6}$/.test(code) });
    if (/^\d{6}$/.test(code)) location.replace(`${location.pathname}?room=${code}`);
  });

  if (!dangBat.value) return;
  // Đã bật từ trước: quyền còn không (người chơi có thể tắt ở Cài đặt máy)? Mã máy có
  // thể đổi (cài lại, khôi phục máy) → đăng ký lại mỗi lần mở, kèm ngôn ngữ hiện tại.
  const q = await PushNotifications.checkPermissions().catch(() => null);
  if (q?.receive !== 'granted') {
    biChan.value = q?.receive === 'denied';
    await tatChuong(false);
    return;
  }
  const ma = await layMa();
  if (ma) { if (ma !== docMa()) void tatTrenServer(docMa()); ghiMa(ma); void guiLenServer(ma); }
}

/** Bật chuông. Trả về kết quả để màn hình báo người chơi. */
export async function batChuong(): Promise<'bat' | 'chan' | 'loi'> {
  if (!pluginCo()) return 'loi';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let q = await PushNotifications.checkPermissions().catch(() => null);
  if (q?.receive === 'prompt' || q?.receive === 'prompt-with-rationale') {
    q = await PushNotifications.requestPermissions().catch(() => null);
  }
  if (q?.receive !== 'granted') {
    biChan.value = true;
    suKien('thong_bao_bat', { kq: 'chan' });
    return 'chan';
  }
  biChan.value = false;
  const ma = await layMa();
  if (!ma || !(await guiLenServer(ma))) { suKien('thong_bao_bat', { kq: 'loi' }); return 'loi'; }
  ghiMa(ma);
  suKien('thong_bao_bat', { kq: 'bat' });
  return 'bat';
}

async function tatTrenServer(ma: string | null): Promise<void> {
  if (!ma) return;
  let ok = false;
  try {
    ok = (await fetch(`${SERVER_URL}/api/thongbao/tat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ma })
    })).ok;
  } catch { /* mạng hỏng */ }
  // Tắt mà server không nghe thấy là người chơi VẪN bị làm phiền — nhớ để thử lại.
  try { if (ok) localStorage.removeItem(KHOA_TAT); else localStorage.setItem(KHOA_TAT, ma); } catch { /* bỏ qua */ }
}

/** Tắt chuông: xoá mã máy khỏi server — không còn nhận gì nữa. */
export async function tatChuong(doNguoiBam = true): Promise<void> {
  const ma = docMa();
  ghiMa(null);
  await tatTrenServer(ma);
  if (doNguoiBam) suKien('thong_bao_tat');
}
