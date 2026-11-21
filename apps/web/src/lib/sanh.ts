import { ref, watch } from 'vue';
import { SERVER_URL } from './native';
import { store } from './storage';

/**
 * SẢNH — MỜI NGƯỜI ĐANG ONLINE (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU
 * mục 3; server: apps/node-server/src/sanh.ts).
 *
 * PHÍA NGƯỜI ĐƯỢC MỜI: app giữ MỘT WebSocket nhẹ tới `/ws/sanh` khi (1) app đang hiện, (2) bật "Nhận lời
 * mời chơi", (3) KHÔNG ở phòng chờ / ván online nào (App.vue đặt `trongPhongOnline`). Ở trang chủ hay
 * đang chơi offline đều nhận được (chủ dự án). App vào nền → đóng; quay lại → mở lại. Lời mời tới →
 * `loiMoi` (LoiMoi.vue vẽ thẻ ở đầu màn, 20 giây).
 *
 * PHÍA CHỦ PHÒNG: `dsOnline` / `moiNguoi` gọi HTTP kèm mã phòng + token (POST — token không vào URL/log).
 * Server Cloudflare không có sảnh → 404 → `coSanh` false, nút mời ẩn.
 */
const KHOA_NHAN = 'mm.nhanLoiMoi';

function docNhan(): boolean { try { return localStorage.getItem(KHOA_NHAN) !== '0'; } catch { return true; } }
/** Công tắc "Nhận lời mời chơi" ở trang Cài đặt — mặc định BẬT. */
export const nhanLoiMoi = ref(docNhan());
export function datNhanLoiMoi(v: boolean): void {
  nhanLoiMoi.value = v;
  try { localStorage.setItem(KHOA_NHAN, v ? '1' : '0'); } catch { /* bỏ qua */ }
}

export interface LoiMoi {
  id: string; ma: string; het: number; han: number;
  tu: { ten: string; mat: string; anh?: string };
  nguoi: number; toiDa: number; soThe: number;
}
export const loiMoi = ref<LoiMoi | null>(null);
/** Đang ở phòng chờ / ván online (kể cả đang xem) — App.vue đặt. */
export const trongPhongOnline = ref(false);
/** Đang chơi một ván offline — chỉ để danh sách của chủ phòng ghi "Đang chơi". */
export const dangChoiOffline = ref(false);

const WS_SANH = `${SERVER_URL.replace(/^http/, 'ws')}/ws/sanh`;
let ws: WebSocket | null = null;
let henNoi: ReturnType<typeof setTimeout> | undefined;
let henHet: ReturnType<typeof setTimeout> | undefined;
let lui = 3_000;
let daBatDau = false;

const nenMo = (): boolean => nhanLoiMoi.value && !trongPhongOnline.value
  && typeof document !== 'undefined' && document.visibilityState === 'visible';

function gui(tin: unknown): void { try { if (ws?.readyState === 1) ws.send(JSON.stringify(tin)); } catch { /* bỏ qua */ } }

function mo(): void {
  if (ws || !nenMo() || typeof WebSocket === 'undefined') return;
  clearTimeout(henNoi);
  const q = new URLSearchParams({ ten: store.playerNames()[0] ?? '', tt: dangChoiOffline.value ? 'choi' : 'chu' });
  let s: WebSocket;
  try { s = new WebSocket(`${WS_SANH}?${q}`); } catch { return; }
  ws = s;
  s.onmessage = (e) => {
    let m: Record<string, unknown>;
    try { m = JSON.parse(String(e.data)) as Record<string, unknown>; } catch { return; }
    if (m.t === 'chao') { lui = 3_000; return; }
    if (m.t === 'moi' && /^\d{6}$/.test(String(m.ma)) && !trongPhongOnline.value) {
      const han = Number(m.han) || 20_000;
      loiMoi.value = {
        id: String(m.id), ma: String(m.ma), han, het: Date.now() + han,
        tu: m.tu as LoiMoi['tu'], nguoi: Number(m.nguoi) || 0, toiDa: Number(m.toiDa) || 0, soThe: Number(m.soThe) || 0
      };
      clearTimeout(henHet);
      henHet = setTimeout(() => { if (loiMoi.value?.id === m.id) loiMoi.value = null; }, han);
    }
  };
  s.onclose = () => {
    if (ws === s) ws = null;
    // Server không có sảnh (bản Cloudflare) hay mất mạng: thử lại thưa dần, tối đa 60 giây/lần
    if (nenMo()) { henNoi = setTimeout(mo, lui); lui = Math.min(60_000, lui * 2); }
  };
}
function dong(): void {
  clearTimeout(henNoi);
  const s = ws; ws = null;
  try { s?.close(1000); } catch { /* đã đóng */ }
}
function canBang(): void { if (nenMo()) mo(); else dong(); }

/** Gọi MỘT lần lúc mở app (App.vue). Test không gọi → không có socket nào. */
export function batDauSanh(): void {
  if (daBatDau || typeof document === 'undefined') return;
  daBatDau = true;
  document.addEventListener('visibilitychange', canBang);
  watch([nhanLoiMoi, trongPhongOnline], canBang);
  watch(dangChoiOffline, (v) => gui({ t: 'tt', tt: v ? 'choi' : 'chu' }));
  // Vào phòng online thì thẻ mời cũ thôi hiện (đang ở phòng rồi)
  watch(trongPhongOnline, (v) => { if (v) loiMoi.value = null; });
  canBang();
}

/** Bấm "Vào phòng": báo server (gỡ treo) và trả mã phòng. */
export function nhanMoi(): string | null {
  const m = loiMoi.value;
  if (!m) return null;
  gui({ t: 'nhan', id: m.id });
  loiMoi.value = null;
  return m.ma;
}
/** Bấm "Để sau": phòng đó không mời lại mình được nữa. */
export function tuChoiMoi(): void {
  const m = loiMoi.value;
  if (!m) return;
  gui({ t: 'tuChoi', id: m.id });
  loiMoi.value = null;
}

/* ---------- phía chủ phòng ---------- */

export interface NguoiOnline { sid: string; ten: string; mat: string; tt: 'chu' | 'choi'; daMoi?: number; tuChoi?: true }
export type KetQuaMoi = { ok: true; han: number } | { loi: string; con?: number };

async function post<T>(duong: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${SERVER_URL}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 404) return null;
    return (await r.json()) as T;
  } catch { return null; }
}
/** null = server không có sảnh / mất mạng (ẩn nút). */
export async function dsOnline(ma: string, token: string): Promise<NguoiOnline[] | null> {
  const r = await post<{ ds?: NguoiOnline[] }>('/api/sanh/ds', { ma, token });
  return r?.ds ?? null;
}
export async function moiNguoi(ma: string, token: string, sid: string): Promise<KetQuaMoi> {
  return (await post<KetQuaMoi>('/api/sanh/moi', { ma, token, sid })) ?? { loi: 'mang' };
}
/** Tên hiện cho người chưa đặt tên: "Khách #1a2b" theo mã sảnh (ổn định suốt kết nối). */
export const tenKhach = (sid: string): string => `#${sid.slice(-4).toUpperCase()}`;
