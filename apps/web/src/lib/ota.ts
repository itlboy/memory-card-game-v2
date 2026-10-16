import { ref } from 'vue';
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
interface Manifest { id: string; url: string; sha256: string; minNative: string; files?: string }
/** `/ota/<id>.files.json`: [đường dẫn trong gói, sha256] — tools/dong-goi-ota.mjs. */
type DanhSachFile = [string, string][];
/** Đuôi của file ở `/ota/f/<sha256><đuôi>` — PHẢI KHỚP `duoiOta` ở tools/dong-goi-ota.mjs:
 *  chỉ giữ đuôi loại Cloudflare nén mà không sửa nội dung; HTML/ảnh/font để trống (Cloudflare
 *  sửa HTML trên đường đi → lệch sha256 → hỏng cả lượt tải chênh lệch). */
const DUOI_GIU = /\.(js|mjs|css|json|svg|webmanifest|txt|xml|map)$/i;
export const duoiOta = (ten: string): string => ten.match(DUOI_GIU)?.[0].toLowerCase() ?? '';

/**
 * TRẠNG THÁI CẬP NHẬT NÓNG — hiện trong khối debug của menu (chủ dự án 16.10.2026: mở app
 * mà không thấy cập nhật, không biết đang tải, đã tải hay hỏng). Trước đó mọi lỗi bị nuốt
 * im lặng trong `catch`.
 */
export type BuocOta = 'web' | 'kiem' | 'moiNhat' | 'cuQua' | 'tai' | 'choMoLai' | 'loi';
export const trangThaiOta = ref<{ buoc: BuocOta; id?: string; pct?: number; loi?: string; ban?: string }>(
  { buoc: laApp ? 'kiem' : 'web' });
/** Gói đã tải xong, chờ áp (để nút "Áp dụng ngay" trong debug dùng). */
let goiCho: string | null = null;

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

/*
 * TỰ THỬ LẠI (16.10.2026): lỗi tạm (mạng chập, Cloudflare chưa phát tán xong bản vừa release
 * ~1 phút) thì thử lại sau `THU_LAI_MS`, tối đa `THU_LAI_TOI_DA` lần mỗi lần mở app; và mỗi
 * khi app QUAY LẠI từ nền mà lần kiểm trước đã lỗi hoặc quá `KIEM_LAI_SAU_MS` thì kiểm lại —
 * người chơi không phải biết hay bấm gì. Gói từng hỏng ('bundle error') thì KHÔNG thử lại.
 */
const THU_LAI_MS = 60_000;
const THU_LAI_TOI_DA = 3;
const KIEM_LAI_SAU_MS = 30 * 60_000;
let soLanThuLai = 0;
let henThuLai: ReturnType<typeof setTimeout> | undefined;
let lucKiem = 0;
let daGanQuayLai = false;
function ganKiemKhiQuayLai(): void {
  if (daGanQuayLai || typeof document === 'undefined') return;
  daGanQuayLai = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const o = trangThaiOta.value;
    if (o.buoc === 'loi' || (o.buoc === 'moiNhat' && Date.now() - lucKiem > KIEM_LAI_SAU_MS)) {
      soLanThuLai = 0;
      void kiemOta();
    }
  });
}

let dangKiem = false;
export async function kiemOta(): Promise<void> {
  if (!laApp || dangKiem) return;
  dangKiem = true;
  lucKiem = Date.now();
  clearTimeout(henThuLai);
  ganKiemKhiQuayLai();
  const dat = (v: typeof trangThaiOta.value): void => { trangThaiOta.value = v; };
  dat({ buoc: 'kiem' });
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    void CapacitorUpdater.notifyAppReady();
    const { CapacitorHttp } = await import('@capacitor/core');
    const r = await CapacitorHttp.get({ url: `${SITE_URL}/ota/manifest.json?t=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' } });
    const m = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Manifest | null;
    if (r.status !== 200 || !m?.id) { dat({ buoc: 'loi', loi: `manifest HTTP ${r.status}` }); return; }
    if (m.id === __OTA_ID__) { dat({ buoc: 'moiNhat', id: m.id }); return; }
    const { App } = await import('@capacitor/app');
    if (soSanhBan((await App.getInfo()).version, m.minNative) < 0) { dat({ buoc: 'cuQua', id: m.id, ban: m.minNative }); return; }
    const { bundles } = await CapacitorUpdater.list();
    if (bundles.some((b) => b.version === m.id && b.status === 'error')) { dat({ buoc: 'loi', id: m.id, loi: 'bundle error' }); return; }
    const co = bundles.find((b) => b.version === m.id && b.status === 'success');
    let goi = co;
    if (!goi) {
      dat({ buoc: 'tai', id: m.id, pct: 0 });
      const nghe = await CapacitorUpdater.addListener('download', (e) => {
        if (trangThaiOta.value.buoc === 'tai') dat({ buoc: 'tai', id: m.id, pct: Math.round(e.percent) });
      });
      try {
        // TẢI CHÊNH LỆCH trước (16.10.2026): plugin lấy file trùng sha256 từ bản app cài sẵn
        // hoặc kho đệm, CHỈ tải file khác qua `/ota/f/<sha256><đuôi>`. Lỗi gì cũng quay về zip.
        if (m.files) {
          try {
            const rf = await CapacitorHttp.get({ url: new URL(m.files, SITE_URL).href });
            const ds = (typeof rf.data === 'string' ? JSON.parse(rf.data) : rf.data) as DanhSachFile;
            if (rf.status === 200 && Array.isArray(ds) && ds.length) {
              goi = await CapacitorUpdater.download({
                url: new URL(m.url, SITE_URL).href, version: m.id,
                manifest: ds.map(([ten, h]) => ({ file_name: ten, file_hash: h, download_url: new URL(`/ota/f/${h}${duoiOta(ten)}`, SITE_URL).href }))
              });
            }
          } catch { goi = undefined; }
          // Tải chênh lệch hỏng thì plugin đánh dấu bản đó 'error' — xoá dấu đó trước khi thử
          // zip, không thì lần mở sau bản này bị coi là hỏng và không bao giờ cập nhật.
          if (!goi) {
            const { bundles: ds2 } = await CapacitorUpdater.list();
            const hong = ds2.find((b) => b.version === m.id && b.status === 'error');
            if (hong) await CapacitorUpdater.delete({ id: hong.id }).catch(() => undefined);
          }
        }
        goi ??= await CapacitorUpdater.download({ url: new URL(m.url, SITE_URL).href, version: m.id, checksum: m.sha256 });
      } finally { void nghe.remove(); }
    }
    goiCho = goi.id;
    if (performance.now() - LUC_MO < AP_NGAY_MS && oTrangChu()) {
      await baoCapNhat();                              // đếm 3·2·1 rồi mới tải lại
      await CapacitorUpdater.set({ id: goi.id });      // tải lại app sang gói mới
      return;
    }
    await CapacitorUpdater.next({ id: goi.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
    dat({ buoc: 'choMoLai', id: m.id });
  } catch (e) {
    // mất mạng / server cũ chưa có /ota — chơi tiếp bằng gói đang có; debug thấy lý do
    dat({ buoc: 'loi', id: trangThaiOta.value.id, loi: String((e as Error)?.message ?? e).slice(0, 80) });
  } finally {
    dangKiem = false;
    const o = trangThaiOta.value;
    if (o.buoc === 'loi' && o.loi !== 'bundle error' && soLanThuLai < THU_LAI_TOI_DA) {
      soLanThuLai++;
      henThuLai = setTimeout(() => { void kiemOta(); }, THU_LAI_MS);
    } else if (o.buoc !== 'loi') soLanThuLai = 0;
  }
}

/** Nút "Áp dụng ngay" (debug): gói đã tải xong thì tải lại app sang nó ngay. */
export async function apOtaNgay(): Promise<void> {
  if (!laApp || !goiCho) return;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.set({ id: goiCho });
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
