import { laApp, SITE_URL } from './native';
import { t } from './i18n';

/**
 * CẬP NHẬT NÓNG (OTA) — app gói nhận bản web mới KHÔNG cần qua duyệt store
 * (14.10.2026, từ bản 1.3.0). Plugin `@capgo/capacitor-updater` ở chế độ THỦ CÔNG:
 * không dùng dịch vụ đám mây Capgo, không gửi thống kê (`statsUrl: ''` ở
 * capacitor.config — mặc định nó gửi crash/lỗi JS về Capgo).
 *
 * Mỗi lần mở app:
 *  1. `notifyAppReady()` NGAY — gói không gọi được trong 10 giây là plugin tự quay
 *     về gói trước (gói hỏng không bao giờ khoá chết app).
 *  2. Đọc /ota/manifest.json trên server (tools/dong-goi-ota.mjs sinh lúc build).
 *     Đi đường HTTP NATIVE (CapacitorHttp) vì origin app là capacitor://localhost —
 *     fetch thường thì vướng CORS.
 *  3. Khác gói đang chạy (`__OTA_ID__`) và app đủ mới (`minNative`) → tải zip ngầm,
 *     kiểm sha256, rồi:
 *       · tải xong trong `AP_NGAY_MS` đầu VÀ người chơi còn ở TRANG CHỦ (URL không
 *         mang ?playing/?room/?online/?w) → báo "đang cập nhật" và áp NGAY (`set` tải
 *         lại app) — chủ dự án muốn mở app là có bản mới (14.10.2026);
 *       · không thì đặt làm gói KẾ TIẾP với điều kiện `kill`: áp khi app được MỞ LẠI
 *         TỪ ĐẦU, không áp lúc chuyển nền — không bao giờ cắt ngang ván đang chơi.
 * Gói đã từng hỏng (status 'error') thì không tải lại — khỏi vòng lặp tải/hỏng.
 * Đổi phần NATIVE (plugin, Swift/Java) vẫn phải qua store + nâng `minNative` (ota.json).
 */
interface Manifest { id: string; url: string; sha256: string; minNative: string }

/** Mở app được bao lâu thì thôi không áp ngay nữa (người chơi đã bắt đầu dùng app). */
const AP_NGAY_MS = 8000;
const LUC_MO = typeof performance !== 'undefined' ? performance.now() : 0;

/** Còn ở trang chủ, chưa vào wizard / ván / online — tải lại lúc này không mất gì. */
export function oTrangChu(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const q = new URLSearchParams(search);
  return !['playing', 'room', 'online', 'w'].some((k) => q.has(k));
}

/** Thẻ giữa màn "Có bản mới · khởi động lại sau ③" — MỘT dòng, đếm 3·2·1 rồi mới
 *  tải lại. Cú tải lại không lời giải thích bị đọc thành app giật ("nháy một cái
 *  quá nhanh"), còn thẻ không đếm thì đọc thành app treo/lỗi (chủ dự án 14.10.2026). */
const DEM_GIAY = 3;
async function baoCapNhat(): Promise<void> {
  const el = document.createElement('div');
  el.className = 'bao-cap-nhat';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="bcn-the"><span class="bcn-sao" aria-hidden="true">✨</span><span class="bcn-chu"></span><b class="bcn-so"></b></span>';
  el.querySelector('.bcn-chu')!.textContent = t('chung.dangCapNhat');
  const so = el.querySelector<HTMLElement>('.bcn-so')!;
  (document.getElementById('app') ?? document.body).appendChild(el);
  for (let n = DEM_GIAY; n >= 1; n--) {
    so.textContent = String(n);
    so.classList.remove('nay'); void so.offsetWidth; so.classList.add('nay');   // nảy lại mỗi nhịp
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export function soSanhBan(a: string, b: string): number {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export async function kiemOta(): Promise<void> {
  if (!laApp) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    void CapacitorUpdater.notifyAppReady();
    const { CapacitorHttp } = await import('@capacitor/core');
    const r = await CapacitorHttp.get({ url: `${SITE_URL}/ota/manifest.json?t=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' } });
    const m = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Manifest | null;
    if (r.status !== 200 || !m?.id || m.id === __OTA_ID__) return;
    const { App } = await import('@capacitor/app');
    if (soSanhBan((await App.getInfo()).version, m.minNative) < 0) return;
    const { bundles } = await CapacitorUpdater.list();
    if (bundles.some((b) => b.version === m.id && b.status === 'error')) return;
    const co = bundles.find((b) => b.version === m.id && b.status === 'success');
    const goi = co ?? await CapacitorUpdater.download({ url: new URL(m.url, SITE_URL).href, version: m.id, checksum: m.sha256 });
    if (performance.now() - LUC_MO < AP_NGAY_MS && oTrangChu()) {
      await baoCapNhat();                              // đếm 3·2·1 rồi mới tải lại
      await CapacitorUpdater.set({ id: goi.id });      // tải lại app sang gói mới
      return;
    }
    await CapacitorUpdater.next({ id: goi.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
  } catch { /* mất mạng / server cũ chưa có /ota — chơi tiếp bằng gói đang có */ }
}

/** "app 1.3.0 · 130" — bản NATIVE cài từ store (khác gói web có thể đã cập nhật nóng). */
export async function banNative(): Promise<string | null> {
  if (!laApp) return null;
  try {
    const { App } = await import('@capacitor/app');
    const i = await App.getInfo();
    return `${i.version} · ${i.build}`;
  } catch { return null; }
}
