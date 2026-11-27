import { laApp, nenApp } from './native';
import { store } from './storage';
import { gaDem, taoGaTrucTiep } from './ga-truc-tiep';

/**
 * GOOGLE ANALYTICS 4 — game web + app (app nhận qua cập nhật nóng, không cần bản store).
 * Chủ dự án chốt 15.10.2026: dùng GA4, KHÔNG có hộp hỏi cookie.
 *
 * Cấu hình cố định (đừng nới): tắt Google Signals + cá nhân hoá quảng cáo, không gửi
 * dữ liệu cá nhân (tên, email, mã tài khoản). Người ở CHÂU ÂU (đoán theo múi giờ) chạy
 * KHÔNG COOKIE (`analytics_storage: denied` — GA vẫn đếm lượt ẩn danh), để không cần hộp
 * hỏi đồng ý. Trong app (capacitor://, https://localhost) không có cookie bền → dùng mã
 * ẩn danh sẵn có của máy (`store.clientId()`) làm client_id, và gán địa chỉ trang giả
 * định trên tên miền thật để báo cáo không lẫn "localhost".
 *
 * KHÔNG chạy: chưa có mã đo lường, đang test/phát triển cục bộ, hay trình duyệt tự động
 * (`navigator.webdriver` — công cụ đo và chụp ảnh store) — không làm bẩn số liệu.
 * Trang quyền riêng tư (mục "Usage analytics") phải khớp với những gì gửi ở đây.
 */
export const GA_ID = 'G-MZ4MDWZRH3';   // tài khoản GA "Cozy Pi" → thuộc tính "Flip Match" (15.10.2026)

/** Địa chỉ lúc nạp trang — trước mọi lần viết lại URL (xem page_location ở batPhanTich). */
const URL_DAU = typeof location === 'undefined' ? '' : location.href;

type Gtag = (...a: unknown[]) => void;
let gtag: Gtag | null = null;
/** Sự kiện gửi TRƯỚC khi `batPhanTich` chạy (nó ở onMounted của App — sau setup của con: `buoc_menu`
 *  immediate của MenuScreen tới trước) — giữ lại, gửi bù khi bật. Đo trên web thật 13.11.2026: thiếu cái
 *  này là MẤT bước đầu của phễu menu mỗi lần mở trang. Có trần, vì test/dev không bao giờ bật GA. */
const choGui: [string, Record<string, unknown>][] = [];
const CHO_TOI_DA = 20;

const chauAu = (): boolean => {
  try { return /^(Europe|Atlantic\/(Reykjavik|Canary|Madeira|Faroe|Azores))/.test(Intl.DateTimeFormat().resolvedOptions().timeZone); }
  catch { return false; }
};

/** Đang gửi bằng đường nào — cho dòng chẩn đoán ở trang Debug. */
let kieuGui: 'off' | 'gtag' | 'direct' = 'off';
/*
 * MÃ NGƯỜI CHƠI ẨN DANH (27.11.2026, chủ dự án chọn "cách 1"): `u<id tài khoản>` hoặc `k<16 hex mã băm khách>` — KHÔNG
 * phải tên (điều khoản GA cấm thông tin định danh). Gửi làm `user_id` + thuộc tính người dùng `ma_nguoi`; tra ra tên ở
 * server (`/api/thongke/ten`, khoá THONGKE_KEY). Châu Âu (không cookie) thì KHÔNG gắn mã. lib/taikhoan tính + gọi `datMaNguoi`.
 */
let maNguoi: string | null = null;
const upChung: Record<string, string> = {};
export function datMaNguoi(ma: string | null): void {
  if (ma === maNguoi) return;
  maNguoi = chauAu() ? null : ma;
  if (maNguoi) upChung.ma_nguoi = maNguoi; else delete upChung.ma_nguoi;
  if (kieuGui === 'gtag' && gtag) {
    gtag('set', { user_id: maNguoi ?? undefined });
    gtag('set', 'user_properties', { ma_nguoi: maNguoi ?? undefined });
  }
}
let soGoi = 0;

/**
 * DÒNG CHẨN ĐOÁN (trang Debug): giao thức trang, đường gửi, số sự kiện game đã gọi, và số yêu cầu
 * `/g/collect` trình duyệt THẬT SỰ phát đi (đọc từ Resource Timing — đúng cho cả gtag.js lẫn gửi thẳng).
 * Gọi > 0 mà phát = 0 nghĩa là sự kiện không rời máy (đúng cảnh iOS trước 15.11.2026).
 */
export function chanDoanGa(): string {
  let phat = 0;
  try { phat = performance.getEntriesByType('resource').filter((e) => e.name.includes('/g/collect')).length; } catch { /* bỏ qua */ }
  const them = kieuGui === 'direct' ? ` ok ${gaDem.xong} err ${gaDem.loi}` : '';
  return `GA ${location.protocol} ${kieuGui} · call ${soGoi} · net ${phat}${them}`;
}

export function batPhanTich(): void {
  if (gtag || !/^G-[A-Z0-9]{6,}$/.test(GA_ID) || typeof window === 'undefined') return;
  if (import.meta.env.MODE === 'test' || import.meta.env.DEV || navigator.webdriver) return;
  if (!laApp && /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  /*
   * APP iOS (`capacitor://localhost`): gtag.js huỷ mọi sự kiện khi trang không chạy trên http/https
   * → 0 người ở /app/ios suốt từ khi công khai (15.11.2026). Tự gửi thẳng — xem lib/ga-truc-tiep.ts.
   * Android (`https://localhost`) và web vẫn đi gtag.js bên dưới.
   */
  if (!/^https?:$/.test(location.protocol)) {
    kieuGui = 'direct';
    const truc = taoGaTrucTiep({
      tid: GA_ID, cid: store.clientId(), dl: `https://flipmatch.cozypi.com/app/${nenApp}`,
      eu: chauAu(), up: Object.assign(upChung, { nen_tang: nenApp, ban_web: __OTA_ID__ }), uid: () => maNguoi
    });
    gtag = (lenh, ten, thamSo) => { if (lenh === 'event') truc(String(ten), (thamSo ?? {}) as Record<string, unknown>); };
    for (const [ten, thamSo] of choGui.splice(0)) gtag('event', ten, thamSo);
    return;
  }
  kieuGui = 'gtag';
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  // gtag CHUẨN đẩy `arguments`, không phải mảng — đổi sang mảng là GA bỏ qua lệnh
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function () { w.dataLayer.push(arguments); };
  gtag = w.gtag;
  const eu = chauAu();
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: eu ? 'denied' : 'granted'
  });
  gtag('js', new Date());
  gtag('config', GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(laApp ? {
      client_id: store.clientId(),
      client_storage: 'none',
      page_location: `https://flipmatch.cozypi.com/app/${nenApp}`
    } : URL_DAU.includes('utm_') ? {
      // Link mời / chia sẻ mang utm_*; App.vue có thể đã viết lại URL (?room=…) trước khi GA bật → đưa
      // địa chỉ LÚC MỞ để GA ghi đúng nguồn (17.11.2026)
      page_location: URL_DAU
    } : {})
  });
  gtag('set', 'user_properties', { nen_tang: nenApp, ban_web: __OTA_ID__, ...(maNguoi ? { ma_nguoi: maNguoi } : {}) });
  if (maNguoi) gtag('set', { user_id: maNguoi });
  for (const [ten, thamSo] of choGui.splice(0)) gtag('event', ten, thamSo);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

/** Một sự kiện. Tên snake_case ≤ 40 ký tự, tham số là số/chuỗi ngắn — KHÔNG dữ liệu cá nhân. */
export function suKien(ten: string, thamSo: Record<string, string | number | boolean | undefined> = {}): void {
  soGoi++;
  if (!gtag) { if (choGui.length < CHO_TOI_DA) choGui.push([ten, { nen_tang: nenApp, ...thamSo }]); return; }
  try { gtag('event', ten, { nen_tang: nenApp, ...thamSo }); } catch { /* không bao giờ làm hỏng game */ }
}

/**
 * MỞ MỘT CHỨC NĂNG (13.11.2026, chủ dự án: biết chức năng / menu / loại game nào được vào, cái nào ÍT
 * được vào, để tối ưu game). MỌI màn, hộp thoại, lối vào đều đi qua MỘT tên sự kiện `mo_chuc_nang` với
 * tham số `chuc_nang` — báo cáo GA xếp hạng nhiều → ít trong một bảng. Tên chức năng snake_case, cố định
 * (đổi tên là đứt chuỗi số liệu cũ). `motLan` = chỉ đếm lần đầu trong phiên (thứ bấm liên tục như emoji).
 */
const daDem = new Set<string>();
export function moChucNang(ten: string, thamSo: Record<string, string | number | boolean | undefined> = {}, motLan = false): void {
  if (motLan) { if (daDem.has(ten)) return; daDem.add(ten); }
  suKien('mo_chuc_nang', { chuc_nang: ten, ...thamSo });
}

/** Đổi một cài đặt (nền, âm thanh, nhạc, rung): `muc` = cài đặt nào, `gia_tri` = giá trị mới. */
export function doiCaiDat(muc: string, giaTri: string | boolean): void {
  suKien('doi_cai_dat', { muc, gia_tri: String(giaTri) });
}

/* ------------------------------------------------------------------------------------------------
 * ĐO ĐỂ TỐI ƯU (17.11.2026, chủ dự án duyệt): ~1/3 người mới vào rồi đi không chơi ván nào, ~18% quay
 * lại. Ba thứ dưới đây trả lời "vì sao": trang có LỖI không, tải có CHẬM không, người mới thấy gì đầu tiên.
 * ------------------------------------------------------------------------------------------------ */

const T0 = typeof performance === 'undefined' ? 0 : performance.now();
const msTuMo = (): number => Math.round((typeof performance === 'undefined' ? 0 : performance.now()) - T0);

/** Lần đầu máy này mở game (không có dữ liệu cũ). Đọc MỘT lần lúc nạp module rồi đánh dấu. */
const LAN_DAU_KEY = 'mm.daMo';
const lanDau: boolean = (() => {
  try {
    if (localStorage.getItem(LAN_DAU_KEY)) return false;
    localStorage.setItem(LAN_DAU_KEY, String(Date.now()));
    return true;
  } catch { return false; }
})();

/**
 * MÀN ĐẦU + THỜI GIAN TẢI: gọi một lần khi khung đầu của game ĐÃ VẼ. `man_hinh` = màn mở ra (menu, online qua
 * link mời, …), `lan_dau` = máy lần đầu mở game — lọc `lan_dau=true` là ra phễu người mới:
 * tai_xong → buoc_menu → van_bat_dau → van_ket_thuc.
 */
let daBaoTai = false;
export function baoTaiXong(man: string): void {
  if (daBaoTai) return;
  daBaoTai = true;
  suKien('tai_xong', { man_hinh: man, lan_dau: lanDau, ms_toi_menu: msTuMo() });
}

/** Ván ĐẦU TIÊN của phiên mang thêm `ms_tu_mo` (mở trang → bắt đầu ván) — người mới mất bao lâu mới chơi. */
let daVanDau = false;
export function thamSoVanDau(): Record<string, number | boolean> {
  if (daVanDau) return {};
  daVanDau = true;
  return { van_dau_phien: true, ms_tu_mo: msTuMo(), lan_dau: lanDau };
}

/**
 * LỖI JAVASCRIPT → GA (`loi_js`). Trước đây trang hỏng trên máy người chơi là mình KHÔNG BIẾT. Rút gọn
 * thông điệp (bỏ URL, email, số dài — không dữ liệu cá nhân), tối đa 5 lỗi khác nhau mỗi phiên để một
 * vòng lặp lỗi không xả hết hạn mức GA. `noi` = window | promise | vue.
 */
const loiDaGui = new Set<string>();
const LOI_TOI_DA = 5;
const LOI_BO_QUA = /ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch|AbortError/i;
/**
 * Hai khung đầu của ngăn xếp, chỉ giữ `tệp:dòng:cột` (bỏ đường dẫn, bỏ query) — lỗi promise/Vue không có
 * `filename` nên trước đây không biết lỗi ở đâu. Đối chiếu với bản dựng theo `ban_web`.
 */
export function nganXep(e: unknown): string {
  const st = e instanceof Error && typeof e.stack === 'string' ? e.stack : '';
  const khung = [...st.matchAll(/([\w.-]+\.m?js)(?:\?[^:\s)]*)?:(\d+):(\d+)/g)].slice(0, 2).map((m) => `${m[1]}:${m[2]}:${m[3]}`);
  return khung.join(' < ').slice(0, 100);
}

export function guiLoi(noi: string, e: unknown, nguon = ''): void {
  try {
    const tho = e instanceof Error ? `${e.name}: ${e.message}` : String((e as { message?: unknown })?.message ?? e);
    if (!tho || LOI_BO_QUA.test(tho)) return;
    const gon = tho
      .replace(/https?:\/\/\S+/g, '<url>')
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
      .replace(/\d{4,}/g, '#')
      // Tên biến bị rút gọn khác nhau theo từng bản dựng (`ve.value` / `Q.value` / `oe.value`) → gộp
      // làm một, kẻo một lỗi thành ba dòng trên admin.
      .replace(/(^|[^\w$.])[\w$]{1,3}(?=\.value\b)/g, '$1_')
      .slice(0, 100);
    if (loiDaGui.has(gon) || loiDaGui.size >= LOI_TOI_DA) return;
    loiDaGui.add(gon);
    suKien('loi_js', {
      noi, thong_diep: gon, nguon: nguon.replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 60),
      ngan_xep: nganXep(e), ban_web: __OTA_ID__
    });
  } catch { /* bắt lỗi không bao giờ được gây lỗi */ }
}

export function ganBatLoi(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    guiLoi('window', ev.error ?? ev.message, ev.filename ? `${ev.filename}:${ev.lineno}` : '');
  });
  window.addEventListener('unhandledrejection', (ev) => guiLoi('promise', ev.reason));
}
