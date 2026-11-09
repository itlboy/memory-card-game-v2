import { ref, shallowRef, watch } from 'vue';
import { store } from './storage';
import { moKhoa } from './achievements';
import { laApp, nenApp, SERVER_URL } from './native';

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
  /** Tên TẮT (server cắt) — bảng công khai không mang tên thật, ảnh, id. */
  name: string; avatar: string | null; toi?: boolean; totalScore: number; wins: number; matches: number;
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
  return hoanTat('/api/auth/google', { credential });
}

async function hoanTat(path: string, than: Record<string, unknown>): Promise<HoSo> {
  dangTai.value = true;
  try {
    const r = await goi<{ token: string; me: HoSo }>(path, {
      method: 'POST', body: JSON.stringify(than)
    });
    ghiToken(r.token);
    me.value = r.me;
    await dongBo();
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
        totalScore: store.totalScore(), best: store.allBest(), achievements: store.achievements()
      })
    });
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
  return hoanTat('/api/auth/apple', { idToken: r.idToken, code: r.authorizationCode, name: name || undefined });
}

/**
 * Đăng nhập Google trong APP (native, ≥ 1.5.0). Android: hộp chọn tài khoản của máy (Credential
 * Manager) với client WEB; iOS: GoogleSignIn với client iOS. Server nhận cả hai `aud`
 * (node-server/taikhoan.ts). Người chơi tự đóng hộp chọn thì ném `huy`.
 */
export async function dangNhapGoogleApp(): Promise<HoSo> {
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
  return hoanTat('/api/auth/google', { credential: r.idToken });
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
  if (!me.value) return;
  try {
    const r = await goi<{ me: HoSo }>('/api/me/van', { method: 'POST', body: JSON.stringify(van) });
    me.value = r.me;
    keoVeMay(r.me);   // máy kia vừa chơi thì tổng ở server cao hơn máy này
  } catch { /* mất một ván trong sổ còn hơn làm phiền người chơi */ }
}

export async function bangXepHang(): Promise<DongBxh[]> {
  return (await goi<{ top: DongBxh[] }>('/api/bxh')).top;
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
export const taiKhoan = { san, me, dangTai, khoiDong, lamMoi, dangNhap, dangNhapApple, dangXuat, xoaTaiKhoan, ghiVan, dongBo, bangXepHang, veNutGoogle };
