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
/**
 * HAI CÔNG TẮC TRÊN CÙNG MỘT MÃ MÁY (giờ vàng, 28.11.2026): chuông "báo phòng mới" (`KHOA_PHONG` = '0' là tắt; vắng = bật,
 * giữ đúng máy cũ đã bật chuông) và "nhắc giờ vàng" (`KHOA_GV` = '1'). Mã máy (`KHOA`) còn khi ÍT NHẤT một công tắc bật;
 * cả hai tắt mới xoá mã khỏi server. Server: cột room_on / gv_on (apps/node-server/src/thongbao.ts).
 */
const KHOA_PHONG = 'mm.thongBao.phong';
const KHOA_GV = 'mm.gioVang';
/** Mã máy đã tắt mà chưa báo được server (mất mạng lúc bấm) — thử lại lần mở app sau. */
const KHOA_TAT = 'mm.thongBao.tat';
const PLUGIN = 'PushNotifications';

/** Chuông có được vẽ không. */
export const coChuong = ref(false);
/** Chuông "báo phòng mới" đang bật. */
export const dangBat = ref(false);
/** Đang nhận nhắc giờ vàng (lib/gio-vang.ts). */
export const gioVangBat = ref(false);
/** Người chơi đã chặn thông báo ở Cài đặt máy — bấm chuông chỉ hiện lời chỉ đường. */
export const biChan = ref(false);

function docMa(): string | null {
  try { return localStorage.getItem(KHOA); } catch { return null; }
}
const docCo = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const ghiCo = (k: string, v: string | null): void => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
/** Đọc lại hai công tắc từ bộ nhớ máy. */
function docCongTac(): void {
  const co = !!docMa();
  dangBat.value = co && docCo(KHOA_PHONG) !== '0';
  gioVangBat.value = co && docCo(KHOA_GV) === '1';
}
function ghiMa(ma: string | null): void {
  try { if (ma) localStorage.setItem(KHOA, ma); else localStorage.removeItem(KHOA); } catch { /* bỏ qua */ }
  docCongTac();
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
      body: JSON.stringify({
        token, nen: nenApp, lang: ngonNgu.value, lechPhut: -new Date().getTimezoneOffset(),
        phong: docCo(KHOA_PHONG) !== '0', gioVang: docCo(KHOA_GV) === '1'
      })
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
  docCongTac();
  try { const cu = localStorage.getItem(KHOA_TAT); if (cu && cu !== docMa()) void tatTrenServer(cu); } catch { /* bỏ qua */ }

  const { PushNotifications } = await import('@capacitor/push-notifications');
  // Bấm vào thông báo → vào thẳng phòng, đi CÙNG lối với link mời (App.vue đọc ?room=). Tin giờ vàng → màn Chơi online.
  void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const d = a.notification.data as { room?: unknown; gv?: unknown } | undefined;
    const code = String(d?.room ?? '');
    if (d?.gv) { suKien('nhac_mo'); location.replace(`${location.pathname}?online=1`); return; }
    suKien('thong_bao_mo', { co_phong: /^\d{6}$/.test(code) });
    if (/^\d{6}$/.test(code)) location.replace(`${location.pathname}?room=${code}`);
  });

  if (!docMa()) return;
  baoDaMo();
  // Quay lại app (từ nền): báo server — tối đa 10 phút một lần
  document.addEventListener('visibilitychange', () => { if (!document.hidden) baoDaMo(); });
  // Đã bật từ trước: quyền còn không (người chơi có thể tắt ở Cài đặt máy)? Mã máy có
  // thể đổi (cài lại, khôi phục máy) → đăng ký lại mỗi lần mở, kèm ngôn ngữ hiện tại.
  const q = await PushNotifications.checkPermissions().catch(() => null);
  if (q?.receive !== 'granted') {
    biChan.value = q?.receive === 'denied';
    ghiCo(KHOA_GV, null);
    await tatChuong(false);
    return;
  }
  const ma = await layMa();
  if (ma) { if (ma !== docMa()) void tatTrenServer(docMa()); ghiMa(ma); void guiLenServer(ma); }
}

let baoLuc = 0;
/** Báo server "máy này vừa mở app" — server không nhắc giờ vàng người đã mở app từ 19:00 hôm đó. */
function baoDaMo(): void {
  const ma = docMa();
  if (!ma || Date.now() - baoLuc < 10 * 60_000) return;
  baoLuc = Date.now();
  void fetch(`${SERVER_URL}/api/thongbao/mo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ma })
  }).catch(() => { /* mạng hỏng: lần sau */ });
}

/** Xin quyền + lấy mã máy. Dùng chung cho chuông và nhắc giờ vàng. */
async function xinQuyenVaMa(): Promise<{ kq: 'ok'; ma: string } | { kq: 'chan' | 'loi' }> {
  if (!pluginCo()) return { kq: 'loi' };
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let q = await PushNotifications.checkPermissions().catch(() => null);
  if (q?.receive === 'prompt' || q?.receive === 'prompt-with-rationale') {
    q = await PushNotifications.requestPermissions().catch(() => null);
  }
  if (q?.receive !== 'granted') { biChan.value = true; return { kq: 'chan' }; }
  biChan.value = false;
  const ma = docMa() ?? await layMa();
  return ma ? { kq: 'ok', ma } : { kq: 'loi' };
}

/** Bật nhắc giờ vàng (tấm hỏi sau ván thắng, hoặc Cài đặt). Chưa bật chuông thì chuông vẫn TẮT. */
export async function batGioVang(): Promise<'bat' | 'chan' | 'loi'> {
  const r = await xinQuyenVaMa();
  if (r.kq !== 'ok') { suKien('nhac_bat', { kq: r.kq }); return r.kq; }
  const coMaCu = !!docMa();
  if (!coMaCu) ghiCo(KHOA_PHONG, '0');          // máy mới bật riêng giờ vàng: không nhận "phòng mới"
  ghiCo(KHOA_GV, '1');
  if (!(await guiLenServer(r.ma))) {
    ghiCo(KHOA_GV, null);
    if (!coMaCu) ghiCo(KHOA_PHONG, null);
    suKien('nhac_bat', { kq: 'loi' });
    return 'loi';
  }
  ghiMa(r.ma);
  suKien('nhac_bat', { kq: 'bat' });
  return 'bat';
}

/** Tắt nhắc giờ vàng. Chuông còn bật thì giữ mã máy, chỉ đổi cờ trên server. */
export async function tatGioVang(): Promise<void> {
  ghiCo(KHOA_GV, null);
  const ma = docMa();
  if (ma && docCo(KHOA_PHONG) !== '0') void guiLenServer(ma);
  else { ghiMa(null); ghiCo(KHOA_PHONG, null); await tatTrenServer(ma); }
  docCongTac();
  suKien('nhac_tat');
}

/** Bật chuông. Trả về kết quả để màn hình báo người chơi. */
export async function batChuong(): Promise<'bat' | 'chan' | 'loi'> {
  const r = await xinQuyenVaMa();
  if (r.kq !== 'ok') { suKien('thong_bao_bat', { kq: r.kq }); return r.kq; }
  const ma = r.ma;
  ghiCo(KHOA_PHONG, null);
  if (!(await guiLenServer(ma))) { suKien('thong_bao_bat', { kq: 'loi' }); return 'loi'; }
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

/** Tắt chuông "phòng mới". Nhắc giờ vàng còn bật thì giữ mã máy (server chỉ đổi room_on); không thì xoá hẳn khỏi server. */
export async function tatChuong(doNguoiBam = true): Promise<void> {
  const ma = docMa();
  if (ma && docCo(KHOA_GV) === '1') {
    ghiCo(KHOA_PHONG, '0');
    docCongTac();
    void guiLenServer(ma);
  } else {
    ghiMa(null);
    ghiCo(KHOA_PHONG, null);
    await tatTrenServer(ma);
  }
  if (doNguoiBam) suKien('thong_bao_tat');
}
