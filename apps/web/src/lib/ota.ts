import { ref } from 'vue';
import { laApp, SITE_URL } from './native';
import { t, napTuDien, ngonNgu } from './i18n';
import { sfx } from './audio';
import { suKien } from './phan-tich';
import { nhoTrang } from './appUrl';

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
 *     kiểm sha256. Ở TRANG CHỦ thì phủ "Đang cập nhật" + % trong lúc tải và khởi động lại
 *     NGAY khi xong; đang chơi thì không chen ngang, về trang chủ mới phủ/áp (16.11.2026,
 *     xem `canhCapNhat`). Tải lỗi → gỡ phủ, chơi bình thường. Luôn đặt kèm gói KẾ TIẾP với
 *     điều kiện `kill` làm dự phòng.
 * Gói đã từng hỏng (status 'error') thì không tải lại — khỏi vòng lặp tải/hỏng.
 * Đổi phần NATIVE (plugin, Swift/Java) vẫn phải qua store + nâng `minNative` (ota.json).
 */
interface Manifest {
  id: string; url: string; sha256: string; minNative: string; files?: string;
  /** BẢN GẤP (ota.json `gapDuoi`): máy đang chạy bản THẤP HƠN số này thì áp ngay khi về trang chủ, không chờ. */
  gapDuoi?: string;
}
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


/** Còn ở trang chủ, chưa vào wizard / ván / online — tải lại lúc này không mất gì. */
export function oTrangChu(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const q = new URLSearchParams(search);
  return !['playing', 'room', 'online', 'w'].some((k) => q.has(k));
}

/**
 * TRANG CHỦ THẬT ĐANG HIỆN — nhìn MÀN HÌNH, không chỉ địa chỉ (18.10.2026, chủ dự án: "tôi đang chơi
 * xong cũng cập nhật"). Hết ván ONLINE, `endSession` lau `?room=` khỏi URL ngay lúc bảng kết quả
 * còn trên màn → URL trông như trang chủ → 2 giây không chạm là app tự khởi động lại giữa màn kết
 * quả. Nay phải có CẢ URL sạch LẪN panel trang chủ của MenuScreen (`section.panel.trang-chu`).
 */
export const manTrangChu = (): boolean => typeof document !== 'undefined' && !!document.querySelector('section.panel.trang-chu');
const dangOTrangChu = (): boolean => oTrangChu() && manTrangChu();

/*
 * CẬP NHẬT BẮT BUỘC Ở TRANG CHỦ (16.11.2026, mockup duyệt https://claude.ai/artifact/T6Mw3r4bUeVc1SJf2UVw4Z —
 * chủ dự án: "có bản mới thì phải update trước khi dùng tính năng khác").
 *  · Đang tải gói mới mà người chơi ở TRANG CHỦ → màn phủ kín "Đang cập nhật" + thanh %, không bấm
 *    được gì khác. Không chữ thừa, không icon, không nút.
 *  · Tải xong + ở trang chủ → khởi động lại NGAY (không đếm 3·2·1 — chủ dự án bỏ).
 *  · Đang chơi / phòng online / wizard → KHÔNG chen ngang; về trang chủ mới phủ (hoặc áp ngay nếu xong).
 *  · Tải LỖI hoặc đứng `DUNG_MS` không nhích → gỡ màn phủ, báo nhỏ "Chưa cập nhật được", chơi bình
 *    thường; cả lần mở app này không phủ nữa (`boChan`), gói nếu tải xong sau đó thì áp ở lần mở sau
 *    (`next` + `kill`). Người không có mạng KHÔNG BAO GIỜ bị khoá app.
 * Hộp thoại đang mở (`[role=dialog][aria-modal]`, `[role=menu]`) thì chờ đóng rồi mới tải lại.
 */
const NHIP_MS = 500;
/*
 * ẨN TIẾN ĐỘ (20.11.2026, chủ dự án: "tải và restart ngầm… để ko ảnh hưởng đến người chơi, tạm ẩn thanh progress
 * hiện tại, sau hiện lại nếu cần" — "cơ chế và tần suất vẫn như hiện tại, chỉ là ko hiện progress thôi"):
 * tải ngầm, KHÔNG phủ "Đang cập nhật" / thanh % / màn "Cập nhật xong"; tải xong vẫn khởi động lại đúng lúc như cũ
 * (ở trang chủ, không hộp thoại). Muốn hiện lại: đặt `false`. Bấm TAY "Kiểm tra cập nhật" vẫn có màn phủ — người
 * dùng đang chờ kết quả.
 */
// 25.11.2026 BẬT LẠI tiến độ (chủ dự án: "có lẽ cần phải ép người dùng cập nhật ở bước này… mãi mới update được… có thể người
// dùng đã chuyển sang tính năng khác"): tải ngầm thì người chơi kịp đi chỗ khác, gói chỉ áp khi về trang chủ. Nay có bản
// mới mà đang ở trang chủ → phủ "Đang cập nhật" + % thật, xong là khởi động lại (luật 16.11.2026). Lỗi/đứng 20s vẫn gỡ phủ.
let anTienDo = false;
/** Chỉ cho test: bật/tắt chế độ ẩn tiến độ (`false` = cách cũ: phủ % thật + áp ngay ở trang chủ). */
export function datAnTienDo(v: boolean): void { anTienDo = v; }
/*
 * CẬP NHẬT ÊM (20.11.2026, chủ dự án: "update thì chạy ngầm, khi restart thì chạy thanh progress 2 giây rồi báo
 * update thành công… restart ko làm nháy quá nhiều"). Khi `anTienDo`, gói tải xong được áp vào MỘT trong các lúc:
 *  · App VÀO NỀN khi đang ở trang chủ (`khiVaoNen`) → khởi động lại trong nền, không ai thấy; quay lại có dòng
 *    nhỏ "✓ Đã cập nhật bản x" (`baoVuaCapNhat`).
 *  · Đứng yên ở trang chủ `RANH_MS`, hoặc BẢN GẤP (`gapDuoi`), hoặc tự bấm "Kiểm tra cập nhật" → màn "Đang cập
 *    nhật" chạy GIẢ tới 90% (`chayGia`), khởi động lại DƯỚI màn đó; gói mới dựng lại đúng màn đó ở 90%, chạy nốt
 *    100% + "Cập nhật xong!" (`noiTiepPhu`) — cú nháy trắng nằm sau màn phủ.
 *  · Tắt hẳn rồi mở → `next` + `kill` như cũ; gói mới thấy mã gói đổi → dòng nhỏ "Đã cập nhật".
 * Đang chơi / phòng online / hộp thoại: không bao giờ chen ngang (giữ nguyên).
 */
export const RANH_MS = 30_000;
let lucCham = Date.now();
let daGanCham = false;
let apGap = false;
const VUA_AP_KEY = 'mm.otaVuaAp';
const DA_CHAY_KEY = 'mm.otaDaChay';
function ganCham(): void {
  if (daGanCham || typeof document === 'undefined') return;
  daGanCham = true;
  for (const ev of ['pointerdown', 'keydown'] as const) document.addEventListener(ev, () => { lucCham = Date.now(); }, { capture: true, passive: true });
}
const ranhDu = (): boolean => Date.now() - lucCham >= RANH_MS;
function ghiVuaAp(cach: 'phu' | 'nen'): void {
  try { localStorage.setItem(VUA_AP_KEY, JSON.stringify({ cach, id: trangThaiOta.value.id })); } catch { /* bỏ qua */ }
}
const phuDuoc = (): boolean => !anTienDo || epBuoc;
const DUNG_MS = 20_000;
let henCanh: ReturnType<typeof setInterval> | undefined;
let daAp = false;
let boChan = false;
let pctCu = -1;
let lucNhich = 0;

/** Áp được ngay lúc này: trang chủ thật + app đang hiện + không hộp thoại/menu. */
export function apDuoc(o: { search: string; manChu: boolean; hien: boolean; coHop: boolean }): boolean {
  return oTrangChu(o.search) && o.manChu && o.hien && !o.coHop;
}
/**
 * MÀN PHỦ ĐANG HIỆN thì tải xong là áp NGAY, kể cả có hộp thoại (19.11.2026, chủ dự án: "cập nhật bị treo ở 69%").
 * Đang mở Bảng xếp hạng thì gói mới bắt đầu tải → phủ; tải xong lại chờ "hộp thoại đóng" — mà màn phủ chặn
 * mọi chạm nên KHÔNG AI đóng được: kẹt vĩnh viễn ở % cuối cùng (bộ canh `DUNG_MS` chỉ chạy lúc đang tải).
 * Đã phủ nghĩa là người chơi đang không làm gì được — khởi động lại không làm mất gì thêm.
 */
const dangPhu = (): boolean => typeof document !== 'undefined' && !!document.querySelector('.man-cap-nhat');
/** Người dùng TỰ BẤM "Kiểm tra cập nhật" (menu / nút tại chỗ): phủ và áp ở MỌI màn — họ đã chọn. */
let epBuoc = false;
const hienTrangChu = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'visible' && (epBuoc || dangOTrangChu());
/*
 * MÀN CHÀO HỒ SƠ (25.11.2026) là hộp thoại bắt buộc NẰM TRÊN trang chủ — tính nó là "hộp thoại đang mở" thì người mới /
 * người cũ chưa qua màn chào KHÔNG BAO GIỜ được cập nhật. Ô tên còn TRỐNG thì khởi động lại không mất gì → không chặn;
 * đang gõ dở tên thì chờ (mất chữ là khó chịu).
 */
const coHopChan = (): boolean => [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="menu"]')]
  .some((el) => !(el.matches('.hs-phu.chao') && !(el.querySelector<HTMLInputElement>('input')?.value ?? '').trim()));
const apDuocBayGio = (): boolean => typeof document !== 'undefined' && (epBuoc ? document.visibilityState === 'visible' : apDuoc({
  search: location.search, manChu: manTrangChu(), hien: document.visibilityState === 'visible',
  coHop: coHopChan()
}));

/** Màn phủ "Đang cập nhật" + thanh % (một phần tử, cập nhật tại chỗ). */
function hienManPhu(pct: number, vaoBody = false): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector<HTMLElement>('.man-cap-nhat');
  if (!el) {
    el = document.createElement('div');
    el.className = 'man-cap-nhat';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="mcn-the"><b class="mcn-chu"></b><span class="mcn-thanh"><i></i>'
      + '<span class="mcn-vong" aria-hidden="true"><i></i><i></i></span>'
      + '<span class="mcn-dom" aria-hidden="true"><b>✦</b><b>✦</b><b>✦</b><b>✦</b><b>✦</b><b>✦</b></span>'
      + '<span class="mcn-xong" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>'
      + '</span><span class="mcn-pct"></span></div>';
    el.querySelector('.mcn-chu')!.textContent = t('chung.dangCapNhat');
    // Chặn chạm xuyên xuống trang chủ (màn phủ là để KHÔNG dùng được gì khác)
    for (const ev of ['pointerdown', 'click', 'touchstart'] as const) el.addEventListener(ev, (e) => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
    // Lúc khởi động (`noiTiepPhu`) Vue chưa mount — mount xoá sạch #app, nên gắn vào body
    (vaoBody ? document.body : document.getElementById('app') ?? document.body).appendChild(el);
  }
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  el.querySelector<HTMLElement>('.mcn-thanh > i')!.style.width = `${p}%`;
  el.querySelector('.mcn-pct')!.textContent = `${p}%`;
}
function anManPhu(): void { document.querySelector('.man-cap-nhat')?.remove(); }
/*
 * BÁO CẬP NHẬT XONG (17.11.2026, mockup duyệt https://claude.ai/artifact/4WQiH5YiA9SE2cKHVJru1F,
 * phương án A — chủ dự án: "biểu tượng nhỏ báo đã update thành công… cho người dùng thích").
 * Ngay trên màn "Đang cập nhật": thanh đổi xanh rồi co thành dấu ✓ tròn nảy ra, hai vòng sáng +
 * đốm vàng; chữ thành "Cập nhật xong!", dòng % thành "Bản x.y.z"; tiếng ting. Giữ `XONG_MS` rồi mới
 * khởi động lại — đủ thấy, không bắt chờ. Giảm chuyển động: chỉ đổi chữ, giữ ngắn hơn.
 */
export const XONG_MS = 1500;
let xongMs = XONG_MS;
/** Chỉ cho test: rút thời gian giữ màn "Cập nhật xong" (đồng hồ giả của test khác không chờ được). */
export function datXongMs(ms: number): void { xongMs = ms; }
async function baoXong(banId = trangThaiOta.value.id ?? ''): Promise<void> {
  const el = document.querySelector<HTMLElement>('.man-cap-nhat');
  if (!el) return;
  const it = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cho = (ms: number): Promise<void> | void => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : undefined);
  el.classList.add('xanh');
  await cho(it ? 0 : Math.min(250, xongMs));
  const ban = banId.split('-')[0];
  el.querySelector('.mcn-chu')!.textContent = t('chung.capNhatXong');
  el.querySelector('.mcn-pct')!.textContent = ban ? t('chung.banSo', { v: ban }) : '';
  el.classList.add('xong');
  sfx.star(3);
  await cho(it ? Math.min(700, xongMs) : xongMs - Math.min(250, xongMs));
}
/** Dòng nhỏ "Chưa cập nhật được" — tự tắt. */
function baoChuaCapNhat(): void {
  if (typeof document === 'undefined') return;
  document.querySelector('.loi-cap-nhat')?.remove();
  const el = document.createElement('div');
  el.className = 'loi-cap-nhat';
  el.setAttribute('role', 'status');
  el.textContent = t('chung.chuaCapNhat');
  (document.getElementById('app') ?? document.body).appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
/** Thôi phủ cả lần mở app này: lỗi / tải đứng. Chỉ báo khi người chơi ĐÃ thấy màn phủ. */
function thoiChan(): void {
  if (boChan) return;
  boChan = true;
  if (document.querySelector('.man-cap-nhat')) { anManPhu(); baoChuaCapNhat(); }
}

async function apGoi(id: string): Promise<void> {
  if (daAp) return;
  daAp = true;
  huyApKhiRanh();
  if (anTienDo) { await chayGia(); ghiVuaAp('phu'); }
  else if (phuDuoc()) { hienManPhu(100); await baoXong(); }
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    nhoTrang();                                        // gói mới mở lại ĐÚNG trang đang đứng (lib/appUrl)
    await CapacitorUpdater.set({ id });                // tải lại app sang gói mới
  } catch { anManPhu(); /* vẫn còn lối `next` + `kill`: mở lại app là có */ }
}

/** Thanh GIẢ: từ % đang hiện (hoặc 0) lên 90% trong ~0,9 giây — phần còn lại gói mới chạy nốt. */
async function chayGia(): Promise<void> {
  const tu = document.querySelector('.man-cap-nhat') ? Math.min(90, Math.max(0, pctCu) * 0.9) : 0;
  const tong = Math.min(900, xongMs);
  for (let i = 1; i <= 6; i++) {
    hienManPhu(tu + ((90 - tu) * i) / 6);
    if (tong > 0) await new Promise((r) => setTimeout(r, tong / 6));
  }
}
/** Vào nền ở trang chủ: khởi động lại khi không ai nhìn. */
async function apNen(id: string): Promise<void> {
  if (daAp) return;
  daAp = true;
  huyApKhiRanh();
  ghiVuaAp('nen');
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.set({ id });
  } catch { /* còn `next` + `kill` */ }
}
export function khiVaoNen(): void {
  if (anTienDo && goiCho && !daAp && !boChan && dangOTrangChu()) void apNen(goiCho);
}
/** Gói MỚI vừa chạy: nối tiếp màn phủ (nếu áp bằng màn phủ) hoặc báo dòng nhỏ "Đã cập nhật". Một lần mỗi phiên. */
let daBaoKhoiDong = false;
export function baoVuaCapNhat(): void {
  if (daBaoKhoiDong || typeof document === 'undefined') return;
  daBaoKhoiDong = true;
  let vua: { cach?: string; id?: string } | null = null, truoc: string | null = null;
  try { vua = JSON.parse(localStorage.getItem(VUA_AP_KEY) ?? 'null'); localStorage.removeItem(VUA_AP_KEY); } catch { vua = null; }
  try { truoc = localStorage.getItem(DA_CHAY_KEY); localStorage.setItem(DA_CHAY_KEY, __OTA_ID__); } catch { truoc = null; }
  if (vua?.id === __OTA_ID__ && vua.cach === 'phu') { void noiTiepPhu(); return; }
  if ((truoc !== null && truoc !== __OTA_ID__) || vua?.id === __OTA_ID__) khiHien(baoDaCapNhat);
}
function khiHien(f: () => void): void {
  if (document.visibilityState === 'visible') { f(); return; }
  const nghe = (): void => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', nghe); f(); } };
  document.addEventListener('visibilitychange', nghe);
}
async function noiTiepPhu(): Promise<void> {
  hienManPhu(90, true);
  await napTuDien(ngonNgu.value).catch(() => undefined);
  document.querySelector('.man-cap-nhat .mcn-chu')!.textContent = t('chung.dangCapNhat');
  hienManPhu(100, true);
  await baoXong(__OTA_ID__);
  anManPhu();
}
async function baoDaCapNhat(): Promise<void> {
  await napTuDien(ngonNgu.value).catch(() => undefined);
  document.querySelector('.loi-cap-nhat')?.remove();
  const el = document.createElement('div');
  el.className = 'loi-cap-nhat da-cap-nhat';
  el.setAttribute('role', 'status');
  el.textContent = `✓ ${t('chung.daCapNhatBan', { v: __OTA_ID__.split('-')[0] ?? '' })}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/** Canh mỗi `NHIP_MS` từ lúc biết có gói mới: phủ khi đang tải ở trang chủ, áp khi xong ở trang chủ. */
function canhCapNhat(): void {
  if (henCanh || daAp || typeof window === 'undefined') return;
  henCanh = setInterval(() => {
    const o = trangThaiOta.value;
    if (o.buoc === 'tai') {
      const pct = o.pct ?? 0;
      if (pct !== pctCu) { pctCu = pct; lucNhich = Date.now(); }
      if (!boChan && Date.now() - lucNhich > DUNG_MS) thoiChan();
      if (boChan || !hienTrangChu() || !phuDuoc()) anManPhu(); else hienManPhu(anTienDo ? pct * 0.9 : pct);   // êm: 90–100% do gói mới chạy nốt
      return;
    }
    if (goiCho && !boChan) {
      // 25.11.2026 (chủ dự án: "ở trang chủ phải tự động cập nhật cho người dùng chứ?"): ở trang chủ tải xong là áp
      // NGAY (màn phủ giả ~1 giây) — bỏ điều kiện đứng yên `RANH_MS`, người chơi bấm liên tục thì không bao giờ tới.
      const ngay = true;
      if ((ngay && apDuocBayGio()) || (dangPhu() && document.visibilityState === 'visible')) void apGoi(goiCho);
      else if (!hienTrangChu()) anManPhu();
      return;
    }
    if (o.buoc !== 'kiem') { anManPhu(); huyApKhiRanh(); }   // lỗi / xong việc: thôi canh
  }, NHIP_MS);
}
/** Thôi canh. `datLai` (test): xoá cả trạng thái của lần mở app. */
export function huyApKhiRanh(datLai = false): void {
  clearInterval(henCanh);
  henCanh = undefined;
  if (datLai) { daAp = false; boChan = false; epBuoc = false; apGap = false; pctCu = -1; goiCho = null; lucCham = Date.now(); daBaoKhoiDong = false; anManPhu(); }
}

/**
 * NÚT "KIỂM TRA CẬP NHẬT" (menu, và nút tại chỗ ở lỗi "cần cập nhật" — mockup duyệt 16.11.2026,
 * https://claude.ai/artifact/SwoLymx3xiXGjMZMfveNQj). Hỏi server NGAY; có bản mới thì phủ
 * "Đang cập nhật" và khởi động lại ở BẤT KỲ màn nào (người dùng tự bấm). Trả kết luận cho menu.
 */
export type KetQuaKiem = 'moiNhat' | 'matMang' | 'cuQua' | 'coBan' | 'web';
export async function kiemTraThuCong(): Promise<KetQuaKiem> {
  if (!laApp) return 'web';
  epBuoc = true;
  boChan = false;
  if (goiCho && !daAp) { void apGoi(goiCho); return 'coBan'; }       // đã tải sẵn: áp luôn
  if (!dangKiem) { soLanThuLai = 0; void kiemOta(); }
  for (let i = 0; i < 200; i++) {                                    // tối đa ~20 giây chờ kết luận
    await new Promise((r) => setTimeout(r, 100));
    const b = trangThaiOta.value.buoc;
    if (b === 'tai' || b === 'choMoLai') return 'coBan';
    if (!dangKiem) break;
  }
  epBuoc = false;
  const b = trangThaiOta.value.buoc;
  return b === 'moiNhat' ? 'moiNhat' : b === 'cuQua' ? 'cuQua' : 'matMang';
}

/** Máy đang chạy gói `otaId` (dạng `1.9.8-<băm>`) có phải nhận BẢN GẤP không. */
export const laGap = (otaId: string, gapDuoi?: string): boolean => !!gapDuoi && soSanhBan(otaId.split('-')[0]!, gapDuoi) < 0;
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
 * khi app QUAY LẠI từ nền (visibilitychange + `resume`) mà lần kiểm trước đã lỗi hoặc quá `KIEM_LAI_SAU_MS` thì kiểm lại —
 * người chơi không phải biết hay bấm gì. Gói từng hỏng ('bundle error') thì KHÔNG thử lại.
 */
const THU_LAI_MS = 60_000;
const THU_LAI_TOI_DA = 3;
/**
 * Quay lại từ nền sau bấy nhiêu thì hỏi lại server. Từng là 30 phút → 19.11.2026 chủ dự án: "thoát app (chưa
 * vuốt xoá) rồi mở lại thì chưa tự cập nhật" — iOS giữ app trong nền, mở lại KHÔNG phải mở mới, nên bản phát
 * hành trong 30 phút đó không bao giờ được thấy. manifest.json chỉ vài trăm byte → 1 phút là đủ chống dồn.
 */
const KIEM_LAI_SAU_MS = 60_000;
let soLanThuLai = 0;
let henThuLai: ReturnType<typeof setTimeout> | undefined;
let lucKiem = 0;
let daGanQuayLai = false;
/** App vừa hiện lại: lần trước lỗi, hoặc đã quá `KIEM_LAI_SAU_MS` mà đang ở "mới nhất" → kiểm lại. */
export function khiQuayLai(): void {
  const o = trangThaiOta.value;
  if (o.buoc === 'loi' || (o.buoc === 'moiNhat' && Date.now() - lucKiem > KIEM_LAI_SAU_MS)) {
    soLanThuLai = 0;
    void kiemOta();
  }
}
function ganKiemKhiQuayLai(): void {
  if (daGanQuayLai || typeof document === 'undefined') return;
  daGanQuayLai = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') khiQuayLai(); else khiVaoNen(); });
  // iOS: WKWebView không phải lúc nào cũng bắn visibilitychange khi app trở lại từ nền → nghe thêm `resume`
  // của Capacitor (hai cái cùng bắn thì `dangKiem` + `lucKiem` chặn kiểm trùng).
  void import('@capacitor/app').then(({ App }) => { void App.addListener('resume', khiQuayLai); void App.addListener('pause', khiVaoNen); }).catch(() => undefined);
}

/**
 * GÓI WEB ĐANG CHẠY ĐẾN TỪ ĐÂU (trang Debug, 18.10.2026 — chủ dự án: "ghi thêm lần cập nhật mới
 * nhất là OTA hay app"): gói gốc nằm sẵn trong bản app cài từ store (`builtin`), hay gói cập nhật
 * nóng đã tải (kèm lúc tải). Chỉ đọc cục bộ, không gọi mạng; lỗi gì cũng trả null.
 */
export async function nguonGoi(): Promise<{ loai: 'app' | 'ota'; luc?: string } | null> {
  if (!laApp) return null;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const c = await CapacitorUpdater.current();
    return c.bundle.id === 'builtin' ? { loai: 'app' } : { loai: 'ota', luc: c.bundle.downloaded };
  } catch { return null; }
}

/**
 * PHÂN TÍCH OTA (17.11.2026): `cap_nhat_ota { ket_qua: ok|loi|cu_qua, tu, den, giay, loi }` — trước đây chỉ
 * thấy gián tiếp qua ô "Phiên bản web". `ok` = tải xong, chờ mở lại là chạy bản mới. `cu_qua` = app
 * native quá cũ, phải lên store (đếm một lần mỗi phiên). Không báo `moiNhat`/`kiem` — chuyện bình thường.
 */
let lucTaiOta = 0;
let daBaoCuQua = false;
function baoOta(v: typeof trangThaiOta.value): void {
  if (v.buoc === 'tai' && !lucTaiOta) lucTaiOta = Date.now();
  const giay = lucTaiOta ? Math.round((Date.now() - lucTaiOta) / 1000) : undefined;
  if (v.buoc === 'choMoLai') { suKien('cap_nhat_ota', { ket_qua: 'ok', tu: __OTA_ID__, den: v.id, giay }); lucTaiOta = 0; }
  else if (v.buoc === 'loi') { suKien('cap_nhat_ota', { ket_qua: 'loi', tu: __OTA_ID__, den: v.id, giay, loi: (v.loi ?? '').slice(0, 60) }); lucTaiOta = 0; }
  else if (v.buoc === 'cuQua' && !daBaoCuQua) { daBaoCuQua = true; suKien('cap_nhat_ota', { ket_qua: 'cu_qua', tu: __OTA_ID__, den: v.id }); }
}

let dangKiem = false;
export async function kiemOta(): Promise<void> {
  if (!laApp || dangKiem) return;
  baoVuaCapNhat();
  ganCham();
  dangKiem = true;
  lucKiem = Date.now();
  clearTimeout(henThuLai);
  ganKiemKhiQuayLai();
  const dat = (v: typeof trangThaiOta.value): void => { trangThaiOta.value = v; baoOta(v); };
  dat({ buoc: 'kiem' });
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    void CapacitorUpdater.notifyAppReady();
    const { CapacitorHttp } = await import('@capacitor/core');
    const r = await CapacitorHttp.get({ url: `${SITE_URL}/ota/manifest.json?t=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' } });
    const m = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Manifest | null;
    if (r.status !== 200 || !m?.id) { dat({ buoc: 'loi', loi: `manifest HTTP ${r.status}` }); return; }
    if (m.id === __OTA_ID__) { dat({ buoc: 'moiNhat', id: m.id }); return; }
    apGap = laGap(__OTA_ID__, m.gapDuoi);
    const { App } = await import('@capacitor/app');
    if (soSanhBan((await App.getInfo()).version, m.minNative) < 0) { dat({ buoc: 'cuQua', id: m.id, ban: m.minNative }); return; }
    const { bundles } = await CapacitorUpdater.list();
    if (bundles.some((b) => b.version === m.id && b.status === 'error')) { dat({ buoc: 'loi', id: m.id, loi: 'bundle error' }); return; }
    const co = bundles.find((b) => b.version === m.id && b.status === 'success');
    let goi = co;
    if (!goi) {
      dat({ buoc: 'tai', id: m.id, pct: 0 });
      pctCu = 0; lucNhich = Date.now();
      canhCapNhat();                                   // phủ "Đang cập nhật" nếu đang ở trang chủ
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
    // Dự phòng: tắt hẳn rồi mở lại là áp (kể cả khi lần này không áp được)
    await CapacitorUpdater.next({ id: goi.id });
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
    dat({ buoc: 'choMoLai', id: m.id });
    // Ở trang chủ — hoặc màn phủ đang hiện (đã chặn hết mọi thứ, xem `dangPhu`): khởi động lại NGAY
    const ngay = true;                                                  // 25.11.2026: ở trang chủ áp ngay (xem canhCapNhat)
    if (!boChan && ((ngay && apDuocBayGio()) || (dangPhu() && document.visibilityState === 'visible'))) { await apGoi(goi.id); return; }
    if (!boChan) canhCapNhat();                                         // chờ: vào nền / đứng yên / về trang chủ
  } catch (e) {
    // mất mạng / server cũ chưa có /ota — chơi tiếp bằng gói đang có; debug thấy lý do.
    // Đang phủ "Đang cập nhật" thì gỡ ngay + báo nhỏ: KHÔNG BAO GIỜ khoá app vì tải lỗi.
    thoiChan();
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
  nhoTrang();
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
