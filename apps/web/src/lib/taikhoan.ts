import { ref, shallowRef } from 'vue';
import { store } from './storage';

/**
 * TÀI KHOẢN phía client — đăng nhập Google, hồ sơ, gửi kết quả ván.
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
  id: number; name: string; avatar: string | null; totalScore: number; wins: number; matches: number;
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

const SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:8787' : (typeof location === 'undefined' ? '' : location.origin));

/** Server này có tài khoản không (dò lúc mở app). */
export const san = ref(false);
export const googleClientId = ref('');
/** Hồ sơ đang đăng nhập; null = ẩn danh. */
export const me = shallowRef<HoSo | null>(null);
export const dangTai = ref(false);

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
  try {
    const res = await fetch(`${SERVER}/api/auth/config`);
    if (!res.ok) { san.value = false; return; }
    const cfg = await res.json() as { googleClientId?: string };
    if (!cfg.googleClientId) { san.value = false; return; }
    googleClientId.value = cfg.googleClientId;
    san.value = true;
  } catch { san.value = false; return; }
  if (docToken()) {
    try { me.value = (await goi<{ me: HoSo }>('/api/me')).me; } catch { /* đã xử lý 401 ở goi() */ }
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
  dangTai.value = true;
  try {
    const r = await goi<{ token: string; me: HoSo }>('/api/auth/google', {
      method: 'POST', body: JSON.stringify({ credential })
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
  store.unlockAchievements(h.achievements);
  store.mergeBest(h.best);
}

export function dangXuat(): void {
  ghiToken(null);
  me.value = null;
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
export const taiKhoan = { san, me, dangTai, khoiDong, lamMoi, dangNhap, dangXuat, ghiVan, dongBo, bangXepHang, veNutGoogle };
