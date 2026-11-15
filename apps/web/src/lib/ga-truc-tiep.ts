/**
 * GỬI SỰ KIỆN GA4 TRỰC TIẾP — chỉ dùng khi trang KHÔNG chạy trên http/https (app iOS:
 * `capacitor://localhost`).
 *
 * VÌ SAO (15.11.2026): 47 lượt cài từ App Store mà GA ghi 0 người ở /app/ios. `gtag.js` HUỶ mọi sự
 * kiện khi `location.protocol` khác `http:`/`https:` (đọc mã thư viện + tái hiện: cùng một trang,
 * http gửi 3 yêu cầu, giao thức lạ gửi 0). Capacitor iOS không cho đổi sang https, `page_location`
 * giả định cũng không cứu được (thư viện đọc giao thức THẬT). Android chạy `https://localhost`
 * nên vẫn dùng gtag.js như web — ĐỪNG chuyển Android/web sang đường này.
 *
 * Gửi tới đúng địa chỉ thu thập mà gtag.js dùng (`/g/collect`, POST rỗng, tham số trên URL), tên
 * tham số chép từ yêu cầu thật của gtag.js: `en` tên sự kiện, `ep.x` tham số chữ, `epn.x` tham số
 * số, `up.x` thuộc tính người dùng, `sid`/`sct` phiên, `_ss`/`_fv` mở phiên / lần đầu, `_et` số ms
 * đã xem kể từ sự kiện trước, `seg` phiên có tương tác. Giao thức này Google KHÔNG công bố chính
 * thức — nếu số iOS tụt về 0 lần nữa thì xem lại tham số ở đây trước.
 *
 * Giữ đúng cam kết của phan-tich.ts: không quảng cáo (`npa=1`), không dữ liệu cá nhân. Người ở
 * châu Âu (`eu`): KHÔNG dùng mã máy lưu sẵn và KHÔNG lưu phiên — mỗi lần mở app là một mã ngẫu
 * nhiên, tương đương chế độ không cookie của web.
 */
export interface CauHinhGa {
  tid: string;
  /** Mã ẩn danh của máy; với `eu` thì bỏ qua, dùng mã ngẫu nhiên theo lần mở app. */
  cid: string;
  /** Địa chỉ trang giả định trên tên miền thật (báo cáo lọc theo /app/ios). */
  dl: string;
  eu: boolean;
  up: Record<string, string>;
  /** Tiêm để test; mặc định fetch/localStorage/đồng hồ thật. */
  gui?: (url: string) => Promise<unknown>;
  kho?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
}

interface Phien { sid: number; sct: number; luc: number; et: number; seg: boolean }

const KHOA = 'mm.ga4';
const HET_PHIEN_MS = 30 * 60_000;   // như GA4: 30 phút không hoạt động là phiên mới
const TUONG_TAC_MS = 10_000;        // như GA4: xem đủ 10 giây là phiên "có tương tác"

/** Số đo cho dòng chẩn đoán ở trang Debug. */
export const gaDem = { goi: 0, xong: 0, loi: 0 };

export function taoGaTrucTiep(c: CauHinhGa): (ten: string, thamSo?: Record<string, unknown>) => void {
  const now = c.now ?? (() => Date.now());
  const kho = c.eu ? null : (c.kho === undefined ? khoMacDinh() : c.kho);
  const gui = c.gui ?? ((url: string) => fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, credentials: 'omit' }));
  const cid = c.eu ? `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(now() / 1000)}` : c.cid;
  const trang = Math.floor(Math.random() * 2 ** 31);   // `_p`: mã lần tải trang
  let soHit = 0;
  let ph: Phien | null = doc();
  // Thời gian đang XEM (app ở trước mặt) kể từ sự kiện gần nhất
  let xemTu: number | null = typeof document === 'undefined' || document.visibilityState === 'visible' ? now() : null;
  let dong = 0;

  function khoMacDinh(): Pick<Storage, 'getItem' | 'setItem'> | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  }
  function doc(): Phien | null {
    try { return JSON.parse(kho?.getItem(KHOA) ?? 'null') as Phien | null; } catch { return null; }
  }
  function ghi(): void {
    try { kho?.setItem(KHOA, JSON.stringify(ph)); } catch { /* chế độ riêng tư */ }
  }
  /** Lấy số ms đã xem dồn được rồi đặt lại mốc. */
  function layXem(): number {
    const t = now();
    if (xemTu !== null) { dong += t - xemTu; xemTu = t; }
    const ms = Math.max(0, Math.round(dong));
    dong = 0;
    return ms;
  }

  function hit(ten: string, thamSo: Record<string, unknown>): void {
    const t = now();
    const moi = !ph || t - ph.luc > HET_PHIEN_MS;
    const lanDau = !ph;
    if (moi) ph = { sid: Math.floor(t / 1000), sct: (ph?.sct ?? 0) + 1, luc: t, et: 0, seg: false };
    const p = ph!;
    const et = layXem();
    p.et += et;
    if (p.et >= TUONG_TAC_MS) p.seg = true;
    p.luc = t;
    ghi();

    const q = new URLSearchParams({
      v: '2', tid: c.tid, _p: String(trang), gcs: c.eu ? 'G100' : 'G101', npa: '1',
      cid, ul: (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase(),
      sr: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '0x0',
      _s: String(++soHit), dl: c.dl, sid: String(p.sid), sct: String(p.sct), seg: p.seg ? '1' : '0',
      dt: typeof document !== 'undefined' ? document.title : '', en: ten
    });
    if (moi) q.set('_ss', '1');
    if (moi && lanDau && !c.eu) q.set('_fv', '1');
    for (const [k, v] of Object.entries(thamSo)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && Number.isFinite(v)) q.set(`epn.${k}`, String(v));
      else q.set(`ep.${k}`, String(v).slice(0, 100));
    }
    if (et > 0) q.set('_et', String(et));
    for (const [k, v] of Object.entries(c.up)) q.set(`up.${k}`, v);

    gaDem.goi++;
    try {
      gui(`https://www.google-analytics.com/g/collect?${q}`).then(() => { gaDem.xong++; }, () => { gaDem.loi++; });
    } catch { gaDem.loi++; }
  }

  /** Phiên mới (lần đầu, hoặc quay lại sau 30 phút) luôn mở bằng `page_view` — GA cần nó để tính phiên. */
  function suKien(ten: string, thamSo: Record<string, unknown> = {}): void {
    if (ten !== 'page_view' && (!ph || now() - ph.luc > HET_PHIEN_MS)) hit('page_view', {});
    hit(ten, thamSo);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { xemTu = now(); return; }
      // App vào nền: chốt thời gian đã xem — như `user_engagement` của gtag.js
      if (xemTu !== null) { dong += now() - xemTu; xemTu = null; }
      if (dong >= 1000) suKien('user_engagement');
    });
  }

  suKien('page_view');
  return suKien;
}
