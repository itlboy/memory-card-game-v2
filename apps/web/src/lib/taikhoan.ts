import { ref, shallowRef, watch } from 'vue';
import { store } from './storage';
import { moKhoa } from './achievements';
import { laApp, nenApp, SERVER_URL } from './native';
import { suKien } from './phan-tich';

/**
 * TÀI KHOẢN phía client — đăng nhập Google hoặc Apple, hồ sơ, gửi kết quả ván.
 *
 * Nút nào hiện tuỳ NỀN: Google Identity Services là thư viện WEB, Google chặn nó
 * trong WebView của app gói (Capacitor) — nên trong app KHÔNG vẽ nút Google (bấm
 * là lỗi, đúng thứ App Review loại theo luật 2.1). Apple: app iOS dùng hộp thoại
 * native (plugin `@capgo/capacitor-social-login`), web dùng Apple JS — chỉ khi
 * server khai Services ID. Android chưa có Apple (phải qua trang chuyển hướng).
 *
 * Nguyên tắc: KHÔNG ĐĂNG NHẬP VẪN CHƠI Y NHƯ CŨ. Mọi thành tích vẫn ghi vào
 * localStorage như trước; tài khoản chỉ là lớp PHỦ THÊM: có đăng nhập thì mỗi
 * ván xong gửi thêm một bản lên server, và lúc đăng nhập thì đẩy bản lưu cục
 * bộ lên (server hợp theo MAX nên gọi lại không nhân đôi gì).
 *
 * Server Cloudflare dự phòng KHÔNG có tài khoản: `khoiDong()` dò
 * `/api/auth/config`, không có là `san = false` và nút đăng nhập không hiện.
 *
 * Phiên nằm ở localStorage (`mm.auth`) — cùng lý do với phiên online: phải
 * sống qua việc đóng tab. Server tự đặt hạn 30 ngày trong token.
 */

export interface HoSo {
  id: number;
  name: string;
  avatar: string | null;
  totalScore: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  best: Record<string, { score: number; moves: number; seconds: number }>;
  achievements: string[];
}

export interface DongBxh {
  /** Tên TẮT (server cắt) — bảng công khai không mang tên thật, ảnh, id. Khách: tên tự đặt. */
  name: string; avatar: string | null; toi?: boolean; totalScore: number; wins: number; matches: number;
  /** Mặt thú: avatar hồ sơ người chơi tự chọn, chưa chọn thì server bốc ổn định theo id / mã khách. Server cũ không gửi. */
  mat?: string;
  /** Màu hồ sơ (25.11.2026) — vòng quanh mặt. Chưa chọn / server cũ: không có. */
  mau?: string;
  /** Khách chưa đặt tên: số để hiện "Khách 4821". */
  khach?: number;
  /** Đang mở app (sảnh): `sid` khi rảnh — thách được; `ban` = đang ở phòng/ván online. Server cũ không gửi. */
  ol?: { sid?: string; ban: boolean };
}

/** Nút "Phá" ở dòng kỷ lục (TaiKhoanDialog → App.vue): chế độ + màn/khoá cấp + số thẻ. */
export interface PhaKyLuc { mode: 'campaign' | 'classic'; cap: number; cells: number }

/** Hạng của người đang xem (cả khi ngoài top 20) + người ngay trên / ngay dưới. */
export interface HangToi extends DongBxh {
  /** null = bảng tuần, chưa có điểm tuần đó (vẫn hiện dòng mình, hạng "–"). */
  hang: number | null; tong: number;
  tren: (DongBxh & { hang: number }) | null;
  duoi: (DongBxh & { hang: number }) | null;
}

export type LoaiBxh = 'tuan' | 'tat';
/** Tuần đang xem (bảng tuần): `batDau` = thứ Hai 'YYYY-MM-DD' (UTC), `het` = mốc chốt (ms). */
export interface TuanBxh { batDau: string; het: number; nay: boolean; coTruoc: boolean }
export interface BangXh {
  top: DongBxh[]; toi?: HangToi;
  /** 3 người chót (dưới top đang hiện) kèm hạng — nhìn là biết bảng có bao nhiêu người. Server cũ không gửi. */
  cuoi?: (DongBxh & { hang: number })[];
  tuan?: TuanBxh;
}

export interface VanBao {
  ketQua: 'thang' | 'thua' | 'hoa';
  score: number;
  boardKey?: string;
  moves?: number;
  seconds?: number;
  achievements?: string[];
}

export const AUTH_KEY = 'mm.auth';

const SERVER = SERVER_URL;

/** Server này có tài khoản không (dò lúc mở app). */
export const san = ref(false);
export const googleClientId = ref('');
/** Nền này vẽ được nút nào — server bật VÀ nền chạy được. */
export const coGoogle = ref(false);
export const coApple = ref(false);
/**
 * Đăng nhập Google NATIVE trong app (09.11.2026). Chỉ bản app ≥ 1.5.0 mới mang SDK Google
 * (capacitor.config `providers.google`); bản cũ nhận gói web này qua cập nhật nóng nhưng
 * gọi plugin Google là lỗi — nên dò số phiên bản native trước khi vẽ nút.
 */
export const coGoogleApp = ref(false);
const BAN_CO_GOOGLE = '1.5.0';
/** Client OAuth iOS (công khai) — khớp URL scheme trong ios/App/App/Info.plist. */
const GOOGLE_IOS_CLIENT_ID = '43109043290-lfla0jfjm3kllm8t67uk2u60aqou08l5.apps.googleusercontent.com';
/** So "1.5.0" với "1.4.5.362": từng số, thiếu coi là 0. */
function banToiThieu(ban: string, can: string): boolean {
  const a = ban.split('.').map(Number), b = can.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0;
  }
  return true;
}
let appleWebId = '';
/** Hồ sơ đang đăng nhập; null = ẩn danh. */
export const me = shallowRef<HoSo | null>(null);
export const dangTai = ref(false);

/*
 * NHỚ HỒ SƠ TRÊN MÁY (09.11.2026, chủ dự án: "vào menu mất một lúc mới hiện đã đăng nhập —
 * trải nghiệm kém"). Trước đây mở app là `me` = null cho tới khi xong HAI lượt hỏi server nối
 * tiếp (`/api/auth/config` rồi `/api/me`), nên menu hiện "Đăng nhập" như người lạ vài giây.
 * Nay: có token + có bản hồ sơ đã lưu thì hiện NGAY từ khung đầu; server trả về thì ghi đè.
 * Token hết hạn (401) thì `goi()` xoá cả hai như cũ.
 */
const ME_KEY = 'mm.authMe';
function docMeLuu(): HoSo | null {
  try {
    if (!localStorage.getItem(AUTH_KEY)) return null;
    const v = JSON.parse(localStorage.getItem(ME_KEY) ?? 'null') as HoSo | null;
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}
{
  const luu = docMeLuu();
  if (luu) { me.value = luu; san.value = true; }
}
watch(me, (m) => {
  try { m ? localStorage.setItem(ME_KEY, JSON.stringify(m)) : localStorage.removeItem(ME_KEY); } catch { /* riêng tư */ }
});

function docToken(): string | null {
  try { return localStorage.getItem(AUTH_KEY); } catch { return null; }
}
function ghiToken(t: string | null): void {
  try { t ? localStorage.setItem(AUTH_KEY, t) : localStorage.removeItem(AUTH_KEY); } catch { /* bỏ qua */ }
}

/**
 * Danh tính để SẢNH (lib/sanh.ts) biết dòng nào trên bảng xếp hạng là mình đang online: phiên đăng nhập, không thì
 * mã khách (chỉ khi đang hiện trên bảng). Server tự xác minh — gửi trong tin nhắn WebSocket, không lên URL.
 */
export function danhTinhSanh(): { token?: string; khach?: string } {
  const token = me.value ? docToken() : null;
  if (token) return { token };
  const k = store.khach(false);
  return k && !k.an && !k.daGop ? { khach: k.id } : {};
}

async function goi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = docToken();
  const res = await fetch(`${SERVER}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  if (res.status === 401) {
    // Phiên hết hạn hoặc tài khoản không còn: về ẩn danh, không báo lỗi ồn ào
    ghiToken(null);
    me.value = null;
    throw new Error('401');
  }
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

/**
 * Lúc mở app: dò server có tài khoản không; có token thì nạp hồ sơ.
 * Mọi lỗi mạng ở đây đều nuốt — tài khoản là lớp phủ, không được chặn trang chủ.
 */
export async function khoiDong(): Promise<void> {
  // Hỏi hồ sơ SONG SONG với cấu hình — không chờ nhau (trước đây nối tiếp = gấp đôi thời gian)
  const meP = docToken() ? goi<{ me: HoSo }>('/api/me').then((r) => r.me).catch(() => null) : null;
  try {
    const res = await fetch(`${SERVER}/api/auth/config`);
    if (!res.ok) { san.value = false; return; }
    const cfg = await res.json() as { googleClientId?: string; apple?: { app?: boolean; webClientId?: string } };
    googleClientId.value = cfg.googleClientId ?? '';
    appleWebId = cfg.apple?.webClientId ?? '';
    coGoogle.value = !!cfg.googleClientId && !laApp;
    coApple.value = nenApp === 'ios' ? !!cfg.apple?.app : nenApp === 'web' && !!appleWebId;
    if (laApp && cfg.googleClientId) {
      try {
        const { App } = await import('@capacitor/app');
        coGoogleApp.value = banToiThieu((await App.getInfo()).version, BAN_CO_GOOGLE);
      } catch { coGoogleApp.value = false; }
    }
    san.value = coGoogle.value || coGoogleApp.value || coApple.value;
    if (!san.value) return;
  } catch { san.value = false; return; }
  if (docToken()) {
    const moi = await meP;   // 401 thì goi() đã xoá token + hồ sơ
    if (moi) me.value = moi;
    /*
     * ĐỒNG BỘ NGAY LÚC MỞ APP, không chỉ lúc đăng nhập. Một tài khoản hai máy:
     * máy B chơi, máy A mở lên phải thấy điểm mới. Bản đầu chỉ nạp hồ sơ để
     * hiện avatar, nên điểm/kỷ lục/danh hiệu ở máy A đứng yên (người chơi báo).
     */
    await dongBo();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void lamMoi();
    });
  }
}

/** Kéo hồ sơ mới nhất về (khi quay lại tab/app) — máy kia có thể vừa chơi. */
export async function lamMoi(): Promise<void> {
  if (!me.value) return;
  try {
    const r = await goi<{ me: HoSo }>('/api/me');
    me.value = r.me;
    keoVeMay(r.me);
  } catch { /* 401 đã xử lý, lỗi mạng thì lần sau */ }
}

/**
 * Hoàn tất đăng nhập với ID token Google rồi ĐỒNG BỘ bản lưu cục bộ lên.
 * Trả về hồ sơ sau khi hợp nhất.
 */
export async function dangNhap(credential: string): Promise<HoSo> {
  return baoDangNhap('google', () => hoanTat('/api/auth/google', { credential }, 'google'));
}

/**
 * PHÂN TÍCH ĐĂNG NHẬP (17.11.2026): `dang_nhap { cach, ket_qua: ok|huy|loi, moi }` — trang admin đọc GA,
 * không đọc MySQL, nên số tài khoản mới phải đi đường này. `moi` = hồ sơ server trả về còn TRẮNG (chưa
 * ván, chưa điểm, chưa danh hiệu) trước khi đồng bộ bản máy — tài khoản vừa tạo, hoặc tạo rồi chưa từng
 * chơi khi đăng nhập. `loi` chỉ giữ mã ngắn, KHÔNG gửi email/tên.
 */
async function baoDangNhap(cach: 'google' | 'apple', lam: () => Promise<HoSo>): Promise<HoSo> {
  try {
    return await lam();
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    suKien('dang_nhap', { cach, ket_qua: m === 'huy' ? 'huy' : 'loi', loi: m === 'huy' ? undefined : m.replace(/[^\w.-]+/g, ' ').trim().slice(0, 40) });
    throw e;
  }
}

async function hoanTat(path: string, than: Record<string, unknown>, cach: 'google' | 'apple'): Promise<HoSo> {
  dangTai.value = true;
  try {
    const r = await goi<{ token: string; me: HoSo }>(path, {
      method: 'POST', body: JSON.stringify(than)
    });
    ghiToken(r.token);
    suKien('dang_nhap', { cach, ket_qua: 'ok', moi: !r.me.matches && !r.me.totalScore && !r.me.achievements?.length });
    me.value = r.me;
    await dongBo();
    void guiHoSo();   // hồ sơ của máy này đi theo tài khoản lên bảng xếp hạng
    return me.value ?? r.me;
  } finally { dangTai.value = false; }
}

/** Đẩy bản lưu cục bộ lên tài khoản, rồi kéo phần tài khoản có mà máy này chưa có về. */
export async function dongBo(): Promise<void> {
  if (!me.value) return;
  try {
    const r = await goi<{ me: HoSo }>('/api/me/dongbo', {
      method: 'POST',
      body: JSON.stringify({
        totalScore: store.totalScore(), best: store.allBest(), achievements: store.achievements(),
        khach: store.khach(false)?.id   // từng lên bảng dạng khách → server gộp và bỏ dòng khách
      })
    });
    if (store.khach(false)) store.ganKhach({ daGop: true });
    me.value = r.me;
    keoVeMay(r.me);
  } catch { /* lần sau đăng nhập lại sẽ đồng bộ tiếp */ }
}

/**
 * Máy mới thì tài khoản cao hơn bản cục bộ: nâng bản cục bộ lên cho khớp.
 * Chỉ nâng LÊN, không hạ xuống — theme mở theo điểm, hạ là khoá lại thứ
 * người chơi đã có.
 */
function keoVeMay(h: HoSo): void {
  const thieu = h.totalScore - store.totalScore();
  if (thieu > 0) store.addScore(thieu);
  // Lặng lẽ: đồng bộ không phải là vừa đạt được gì
  moKhoa(h.achievements, { im: true });
  store.mergeBest(h.best);
}

export function dangXuat(): void {
  ghiToken(null);
  me.value = null;
}

/**
 * Đăng nhập bằng Apple. Plugin nạp TRỄ (lần bấm đầu) — gói của nó kéo theo mã
 * cho cả chục nhà cung cấp, không có lý do bắt mọi người tải lúc mở trang.
 * Người chơi tự đóng hộp thoại thì ném `huy` để màn tài khoản im lặng.
 */
export async function dangNhapApple(): Promise<HoSo> {
  return baoDangNhap('apple', dangNhapAppleTho);
}
async function dangNhapAppleTho(): Promise<HoSo> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({
    apple: nenApp === 'web'
      ? { clientId: appleWebId, redirectUrl: location.origin, useProperTokenExchange: true }
      : { useProperTokenExchange: true }
  });
  let kq;
  try {
    kq = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    throw new Error(/cancel|1001|closed|popup_closed/i.test(m) ? 'huy' : m);
  }
  const r = kq.result as { idToken?: string | null; authorizationCode?: string; profile?: { givenName?: string | null; familyName?: string | null } };
  if (!r.idToken) throw new Error('401');
  // Apple chỉ đưa tên ở LẦN ĐẦU, và không nằm trong token
  const name = [r.profile?.givenName, r.profile?.familyName].filter(Boolean).join(' ');
  return hoanTat('/api/auth/apple', { idToken: r.idToken, code: r.authorizationCode, name: name || undefined }, 'apple');
}

/**
 * Đăng nhập Google trong APP (native, ≥ 1.5.0). Android: hộp chọn tài khoản của máy (Credential
 * Manager) với client WEB; iOS: GoogleSignIn với client iOS. Server nhận cả hai `aud`
 * (node-server/taikhoan.ts). Người chơi tự đóng hộp chọn thì ném `huy`.
 */
export async function dangNhapGoogleApp(): Promise<HoSo> {
  return baoDangNhap('google', dangNhapGoogleAppTho);
}
async function dangNhapGoogleAppTho(): Promise<HoSo> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({
    google: {
      webClientId: googleClientId.value,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: googleClientId.value,
      mode: 'online'
    }
  });
  let kq;
  try {
    kq = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    throw new Error(/cancel|canceled|cancelled|-5|12501|closed/i.test(m) ? 'huy' : m);
  }
  const r = kq.result as { idToken?: string | null };
  if (!r.idToken) throw new Error('401');
  return hoanTat('/api/auth/google', { credential: r.idToken }, 'google');
}

/**
 * XOÁ TÀI KHOẢN trên server (App Store và Google Play bắt buộc). Bản lưu trên
 * máy này giữ nguyên — nó có từ trước khi đăng nhập và là của máy.
 */
export async function xoaTaiKhoan(): Promise<void> {
  await goi<{ ok: boolean }>('/api/me', { method: 'DELETE' });
  dangXuat();
}

/**
 * Báo một ván vừa xong. Gọi ĐÚNG MỘT LẦN mỗi ván (từ watcher kết ván) — tổng
 * điểm và số ván cộng dồn ở server. Không đăng nhập thì không làm gì.
 */
export async function ghiVan(van: VanBao): Promise<void> {
  if (!me.value) { void guiKhach(); return; }
  try {
    const r = await goi<{ me: HoSo }>('/api/me/van', { method: 'POST', body: JSON.stringify(van) });
    me.value = r.me;
    keoVeMay(r.me);   // máy kia vừa chơi thì tổng ở server cao hơn máy này
  } catch { /* mất một ván trong sổ còn hơn làm phiền người chơi */ }
}

/**
 * BẢNG XẾP HẠNG CÓ KHÁCH (19.11.2026, mockup duyệt https://claude.ai/artifact/CYPTEG9edvmDEgEGFuEnzy):
 * chưa đăng nhập vẫn lên bảng chung bằng tên trong game + mặt thú. Máy gửi TỔNG điểm (không phải
 * từng ván) nên gửi lại bao nhiêu lần cũng không nhân đôi. Chưa chơi ván nào thì chưa gửi.
 */
export async function guiKhach(): Promise<void> {
  if (me.value || !san.value) return;
  const k = store.khach(false) ?? (store.totalScore() > 0 ? store.khach() : null);
  if (!k || k.daGop) return;
  const d = store.boDem();
  // Đang ẨN vẫn gửi (20.11.2026): server giữ điểm + điểm tuần, chỉ không hiện — bấm "Hiện lại" là về bảng đủ điểm
  const hs = store.hoSo();
  const body = JSON.stringify({ id: k.id, name: store.playerNames()[0] ?? '', totalScore: store.totalScore(), wins: d.wins, matches: Math.max(d.van ?? 0, d.wins), an: !!k.an,
    // Hồ sơ người chơi (25.11.2026): avatar + màu tự chọn lên bảng xếp hạng
    ...(hs?.xong ? { mat: hs.mat, mau: hs.mau } : {}) });
  // Y hệt lần vừa gửi xong → bỏ: mở bảng xếp hạng ngay sau ván khỏi chờ thêm một vòng mạng
  if (body === khachDaGui) return;
  try {
    await goi<{ ok: boolean }>('/api/khach', { method: 'POST', body });
    khachDaGui = body;
  } catch { /* lần sau gửi tiếp — tổng điểm nên không mất gì */ }
}
let khachDaGui = '';

/**
 * HỒ SƠ (25.11.2026): đẩy avatar + màu lên bảng xếp hạng — đăng nhập thì vào tài khoản, khách thì đi kèm lần gửi điểm.
 * Gọi sau khi lưu hồ sơ và sau khi đăng nhập. Lỗi mạng: nuốt, lần lưu/đăng nhập sau gửi lại.
 */
export async function guiHoSo(): Promise<void> {
  const hs = store.hoSo();
  if (!hs?.xong || !san.value) return;
  if (!me.value) { void guiKhach(); return; }
  try { await goi<{ ok: boolean }>('/api/me/ho-so', { method: 'POST', body: JSON.stringify({ mat: hs.mat, mau: hs.mau }) }); }
  catch { /* lần sau gửi lại */ }
}

/** Đặt tên trên bảng — cũng là tên khi chơi online (cùng ô nhớ). */
/** Trong các tên này, tên nào CHƯA ai dùng trên bảng xếp hạng (lib/ten-ngau-nhien.ts — tránh trùng tên tự tạo). */
export async function tenTrong(ds: string[]): Promise<string[]> {
  const r = await goi<{ trong: string[] }>('/api/ten/trong', { method: 'POST', body: JSON.stringify({ ds }) });
  return Array.isArray(r.trong) ? r.trong : [];
}

export async function datTenKhach(ten: string): Promise<void> {
  const tt = ten.trim().slice(0, 16);
  const ds = store.playerNames();
  store.savePlayerNames([tt, ...ds.slice(1)]);
  await guiKhach();
}

/**
 * "Ẩn tôi" / "Hiện lại" (20.11.2026, chủ dự án: "ẩn thôi ko xóa, sau họ thích thì cho họ hiện lại"): chỉ bật/tắt cờ
 * ẨN trên server — điểm, lịch sử tuần còn nguyên. Gửi lại tổng điểm kèm `an` là đủ (server ≥ 20.11 đọc cờ này).
 */
export async function anKhach(an: boolean): Promise<void> {
  const k = store.khach(false);
  if (!k) return;
  store.ganKhach({ an });
  khachDaGui = '';
  await guiKhach();
}

/**
 * `loai`: 'tat' = Mọi lúc (mặc định — hạng trên viên xu), 'tuan' = bảng tuần; `tuan` = thứ Hai của tuần cũ muốn xem
 * (bỏ trống = tuần này). Chỉ bảng Mọi lúc và bảng TUẦN NÀY được lưu làm "bảng lần trước".
 */
export type DongHang = DongBxh & { hang: number };
const thanBxh = (loai: LoaiBxh, tuan?: string): Record<string, unknown> => {
  const k = me.value ? null : store.khach(false);
  return { khach: k && !k.an && !k.daGop ? k.id : undefined, ...(loai === 'tuan' ? { loai, tuan } : {}) };
};
/** 20 dòng kế tiếp từ hạng `tu + 1` (tải thêm khi cuộn). `het` = đã giáp 3 người chót. Server cũ không hiểu → coi như hết. */
export async function trangBxh(loai: LoaiBxh, tuan: string | undefined, tu: number): Promise<{ ds: DongHang[]; het: boolean }> {
  const r = await goi<{ ds?: DongHang[]; het?: boolean }>('/api/bxh', { method: 'POST', body: JSON.stringify({ ...thanBxh(loai, tuan), tu }) });
  return Array.isArray(r.ds) ? { ds: r.ds, het: r.het !== false } : { ds: [], het: true };
}
/** Mọi người đang online (kể cả ngoài top 20) kèm hạng thật — bộ lọc "người đang online". Server cũ → rỗng. */
export async function bxhOnline(loai: LoaiBxh, tuan?: string): Promise<DongHang[]> {
  const r = await goi<{ ds?: DongHang[] }>('/api/bxh', { method: 'POST', body: JSON.stringify({ ...thanBxh(loai, tuan), online: true }) });
  return Array.isArray(r.ds) ? r.ds.filter((d) => typeof d.hang === 'number') : [];
}
export async function bangXepHang(loai: LoaiBxh = 'tat', tuan?: string): Promise<BangXh> {
  if (!me.value) await guiKhach();   // hạng tính trên điểm MỚI NHẤT của máy
  const k = me.value ? null : store.khach(false);
  const b = await goi<BangXh>('/api/bxh', {
    method: 'POST',
    body: JSON.stringify({ khach: k && !k.an && !k.daGop ? k.id : undefined, ...(loai === 'tuan' ? { loai, tuan } : {}) })
  });
  if (!tuan) try { localStorage.setItem(khoaBxh(loai), JSON.stringify({ ai: aiDangXem(), b })); } catch { /* đầy / riêng tư */ }
  return b;
}

/*
 * BẢNG LẦN TRƯỚC (19.11.2026, chủ dự án: "trải nghiệm loading của bảng xếp hạng chưa tốt"). Mở bảng phải
 * chờ HAI vòng mạng (gửi điểm khách rồi mới hỏi bảng) → khung trống + chữ "Đang tải…" rồi giật cao lên.
 * Nay mỗi lần hỏi xong (kể cả lần TopBar hỏi hạng lúc mở app / sau ván) lưu lại; mở bảng hiện NGAY bản đó
 * rồi lặng lẽ thay bằng số mới. Gắn với người đang xem (tài khoản / khách): đổi người thì không dùng.
 */
const khoaBxh = (loai: LoaiBxh): string => (loai === 'tuan' ? 'mm.bxhTuan' : 'mm.bxh');
const aiDangXem = (): string => (me.value ? `u${me.value.id}` : 'khach');
export function bxhLanTruoc(loai: LoaiBxh = 'tat'): BangXh | null {
  try {
    const v = JSON.parse(localStorage.getItem(khoaBxh(loai)) ?? 'null') as { ai: string; b: BangXh } | null;
    // Bảng tuần đã qua tuần (chốt rồi) thì không đem ra làm "tuần này"
    if (v?.b?.tuan && v.b.tuan.het <= Date.now()) return null;
    return v && v.ai === aiDangXem() && Array.isArray(v.b?.top) ? v.b : null;
  } catch { return null; }
}

/* ---------- Google Identity Services ---------- */

interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void;
  renderButton(el: HTMLElement, cfg: Record<string, unknown>): void;
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

let napGis: Promise<GoogleId> | null = null;

/** Nạp script GIS một lần. Trả về `google.accounts.id`. */
export function layGoogle(): Promise<GoogleId> {
  if (napGis) return napGis;
  napGis = new Promise<GoogleId>((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(window.google.accounts.id); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      const g = window.google?.accounts?.id;
      g ? resolve(g) : reject(new Error('GIS không nạp được'));
    };
    s.onerror = () => { napGis = null; reject(new Error('Không tải được Google')); };
    document.head.appendChild(s);
  });
  return napGis;
}

/** Vẽ nút "Đăng nhập với Google" vào một phần tử; bấm xong thì `dangNhap()`. */
export async function veNutGoogle(el: HTMLElement, xong: (h: HoSo) => void, loi: (e: Error) => void): Promise<void> {
  const g = await layGoogle();
  g.initialize({
    client_id: googleClientId.value,
    callback: (r) => { dangNhap(r.credential).then(xong).catch(loi); }
  });
  g.renderButton(el, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280, locale: 'vi'
  });
}

/** Gom một mối để App/OnlineGame gọi và để test giả lập. */
export const taiKhoan = { san, me, dangTai, khoiDong, lamMoi, dangNhap, dangNhapApple, dangXuat, xoaTaiKhoan, ghiVan, dongBo, bangXepHang, guiKhach, tenTrong, veNutGoogle };
