import { computed, ref, watch } from 'vue';
import { SERVER_URL, nenApp } from './native';
import { store } from './storage';
import { danhTinhSanh, me } from './taikhoan';
import { ngonNgu } from './i18n';
import { maMayHienTai } from './thong-bao';
import { coThiDau, datCuaGui, goiYThiDau, nhanTinThiDau, quenThiDau } from './thidau';

/**
 * SẢNH — MỜI NGƯỜI ĐANG ONLINE (21.11.2026, mockup duyệt https://claude.ai/artifact/GGvThzwyg8EtsVTE6p7YpU
 * mục 3; server: apps/node-server/src/sanh.ts).
 *
 * PHÍA NGƯỜI ĐƯỢC MỜI: app giữ MỘT WebSocket nhẹ tới `/ws/sanh` khi (1) app đang hiện, (2) bật "Nhận lời
 * mời chơi". Trạng thái gửi kèm: `chu` trang chủ / `choi` chơi offline (đều MỜI ĐƯỢC, chủ dự án) / `phong` đang ở
 * phòng chờ hay ván online (App.vue đặt `trongPhongOnline`) — từ 21.11.2026 vẫn giữ kết nối lúc đó để bảng xếp hạng
 * hiện "Đang chơi", server không mời người `phong`. Sau khi nối, app gửi danh tính (`danhTinhSanh`) để server
 * khớp với dòng bảng xếp hạng (chấm online + nút Thách). App vào nền → đóng; quay lại → mở lại. Lời mời tới →
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
  tu: { ten: string; mat: string; anh?: string; mau?: string };
  nguoi: number; toiDa: number; soThe: number;
  /** Đến từ nút "Thách" ở bảng xếp hạng — thẻ ghi "… thách đấu bạn". */
  thach?: boolean;
}
export const loiMoi = ref<LoiMoi | null>(null);
/**
 * Server NÀY có sảnh (đã nhận `chao` hoặc `/api/sanh/ds` từng trả danh sách). Màn phòng chờ dựa vào đây để hiện nút
 * "Mời người online" NGAY lúc tạo phòng (chủ dự án 22.11.2026: nút "một lúc sau mới hiện" vì phải chờ lượt hỏi danh
 * sách đầu tiên). Bản Cloudflare không có sảnh → 404 → false, nút ẩn như cũ.
 */
const KHOA_CO_SANH = 'mm.coSanh';
export const coSanh = ref((() => { try { return localStorage.getItem(KHOA_CO_SANH) === '1'; } catch { return false; } })());
// Nhớ qua các lần mở app: người tắt "Nhận lời mời" không nối sảnh nên không bao giờ nhận `chao`
watch(coSanh, (v) => { try { localStorage.setItem(KHOA_CO_SANH, v ? '1' : '0'); } catch { /* bỏ qua */ } });
/** Đang ở phòng chờ / ván online (kể cả đang xem) — App.vue đặt. */
export const trongPhongOnline = ref(false);
/** Đang chơi một ván offline — chỉ để danh sách của chủ phòng ghi "Đang chơi". */
export const dangChoiOffline = ref(false);
/** Ván offline đó chỉ có MỘT người thật (một mình / đấu máy / Mưa Thẻ) — thi đấu vẫn hỏi người này (thidau.ts `mot`). */
export const choiMotMinh = ref(false);
/** Kết nối sảnh đang mở (đã nhận `chao`) — để trừ chính mình khỏi "N người đang online". */
export const dangNoiSanh = ref(false);
/** `sid` server đặt cho kết nối sảnh của CHÍNH MÌNH (lời chào) — bảng mời nhận ra dòng "Bạn". */
export const sidToi = ref<string | null>(null);
/**
 * Số NGƯỜI KHÁC đang online = số app đang nối sảnh (server gửi kèm danh sách phòng công khai, `/api/rooms/public` →
 * `online`) TRỪ chính mình. Hiện ở ô Chơi online (trang chủ) và đầu màn Chơi online.
 *
 * TÍNH LẠI MỖI KHI TRẠNG THÁI KẾT NỐI ĐỔI (23.11.2026, chủ dự án: trang chủ không hiện ai mà vào sảnh lại ghi "1 người
 * đang online" — "số liệu không khớp"). Bản cũ trừ MỘT LẦN lúc nhận số: hỏi danh sách phòng đúng lúc sảnh vừa nối
 * (server đã đếm mình nhưng lời chào chưa về) thì không trừ, và mình bị đếm thành một người online tới lần hỏi kế.
 * Nay giữ số THÔ của server và trừ mình khi đang nối sảnh HOẶC đã nối lúc hỏi (vừa rớt sảnh thì số thô vẫn còn tính mình).
 */
const soOnlineTho = ref(0);
const noiLucHoi = ref(false);
/**
 * TÍNH CẢ CHÍNH MÌNH (23.11.2026, chủ dự án: số ở phòng chờ và ở bảng xếp hạng "không nhất quán, bảng xếp hạng đang bỏ tôi,
 * cho thêm vào đi"). Trước đó con số này là "người KHÁC" nên một mình thì ô trang chủ trống trơn. Nay MỌI nơi (ô Chơi online,
 * đầu màn Chơi online, nút lọc ở bảng xếp hạng) cùng một nghĩa: số người đang online KỂ CẢ BẠN = người khác + 1.
 */
export const soNguoiKhacOnline = computed(() => Math.max(0, soOnlineTho.value - (dangNoiSanh.value || noiLucHoi.value ? 1 : 0)));
export const soNguoiOnline = computed(() => soNguoiKhacOnline.value + 1);
export function ghiSoOnline(n: unknown): void {
  const so = Number(n);
  if (!Number.isFinite(so)) return;
  soOnlineTho.value = Math.max(0, Math.round(so));
  noiLucHoi.value = dangNoiSanh.value;
}

const WS_SANH = `${SERVER_URL.replace(/^http/, 'ws')}/ws/sanh`;
let ws: WebSocket | null = null;
let henNoi: ReturnType<typeof setTimeout> | undefined;
let henHet: ReturnType<typeof setTimeout> | undefined;
let lui = 3_000;
let daBatDau = false;

// Nối khi bật MỘT trong hai: nhận lời mời hoặc gợi ý thi đấu (22.11.2026). Tắt "nhận lời mời" mà còn nối vì thi đấu
// thì khai `nm=0` — server không đưa mình lên danh sách mời / bảng xếp hạng.
const nenMo = (): boolean => (nhanLoiMoi.value || goiYThiDau.value)
  && typeof document !== 'undefined' && document.visibilityState === 'visible';
const guiGy = (): void => gui({ t: 'gy', bat: goiYThiDau.value, ...(maMayHienTai() ? { tb: maMayHienTai() } : {}) });
const ttHienTai = (): 'chu' | 'choi' | 'phong' => (trongPhongOnline.value ? 'phong' : dangChoiOffline.value ? 'choi' : 'chu');

function gui(tin: unknown): void { try { if (ws?.readyState === 1) ws.send(JSON.stringify(tin)); } catch { /* bỏ qua */ } }

function mo(): void {
  if (ws || !nenMo() || typeof WebSocket === 'undefined') return;
  clearTimeout(henNoi);
  const q = new URLSearchParams({ ten: store.playerNames()[0] ?? '', tt: ttHienTai(), mot: choiMotMinh.value ? '1' : '0', td: '1', nt: nenApp, nn: ngonNgu.value, nm: nhanLoiMoi.value ? '1' : '0' });
  // Hồ sơ người chơi: con vật + màu mình chọn hiện ở danh sách "Đang online" và lời mời của người khác (server ≥ 1.10.3)
  const hs = store.hoSo();
  if (hs?.xong) { q.set('mat', hs.mat); q.set('mau', hs.mau); }
  let s: WebSocket;
  try { s = new WebSocket(`${WS_SANH}?${q}`); } catch { return; }
  ws = s;
  s.onmessage = (e) => {
    let m: Record<string, unknown>;
    try { m = JSON.parse(String(e.data)) as Record<string, unknown>; } catch { return; }
    if (m.t === 'chao') {
      lui = 3_000;
      sidToi.value = typeof m.sid === 'string' ? m.sid : null;
      coSanh.value = true;
      dangNoiSanh.value = true;
      coThiDau.value = m.td === 1;
      if (typeof m.tong === 'number') ghiSoOnline(m.tong);
      guiGy();
      // Gửi LẠI trạng thái lúc đã nối: đổi trạng thái khi socket còn đang mở thì tin `tt` bị rơi (gui() bỏ qua khi
      // chưa OPEN) — chủ phòng từng hiện trong danh sách mời của chính mình là "Ở trang chủ" (chụp kiểm 21.11.2026)
      gui({ t: 'tt', tt: ttHienTai(), mot: choiMotMinh.value });
      gui({ t: 'ai', ...danhTinhSanh() });
      return;
    }
    // Số online server đẩy ngay khi có người vào / ra sảnh (28.11.2026) — không chờ lần hỏi 20 giây
    if (m.t === 'so') { ghiSoOnline(m.tong); return; }
    if (nhanTinThiDau(m)) return;
    if (m.t === 'moi' && /^\d{6}$/.test(String(m.ma)) && !trongPhongOnline.value) {
      const han = Number(m.han) || 20_000;
      loiMoi.value = {
        id: String(m.id), ma: String(m.ma), han, het: Date.now() + han,
        tu: m.tu as LoiMoi['tu'], nguoi: Number(m.nguoi) || 0, toiDa: Number(m.toiDa) || 0, soThe: Number(m.soThe) || 0,
        ...(m.thach === true ? { thach: true } : {})
      };
      clearTimeout(henHet);
      henHet = setTimeout(() => { if (loiMoi.value?.id === m.id) loiMoi.value = null; }, han);
    }
  };
  s.onclose = () => {
    if (ws === s) { ws = null; dangNoiSanh.value = false; quenThiDau(); }
    // Server không có sảnh (bản Cloudflare) hay mất mạng: thử lại thưa dần, tối đa 60 giây/lần
    if (nenMo()) { henNoi = setTimeout(mo, lui); lui = Math.min(60_000, lui * 2); }
  };
}
function dong(): void {
  clearTimeout(henNoi);
  const s = ws; ws = null;
  dangNoiSanh.value = false;
  quenThiDau();
  try { s?.close(1000); } catch { /* đã đóng */ }
}
function canBang(): void { if (nenMo()) mo(); else dong(); }

/** Gọi MỘT lần lúc mở app (App.vue). Test không gọi → không có socket nào. */
export function batDauSanh(): void {
  if (daBatDau || typeof document === 'undefined') return;
  daBatDau = true;
  document.addEventListener('visibilitychange', canBang);
  // Đổi công tắc "nhận lời mời": nối lại để server nhận `nm` mới (khai trên URL lúc nối)
  watch(nhanLoiMoi, () => { dong(); canBang(); });
  watch(goiYThiDau, () => { canBang(); guiGy(); });
  datCuaGui(gui);
  watch([trongPhongOnline, dangChoiOffline, choiMotMinh], () => gui({ t: 'tt', tt: ttHienTai(), mot: choiMotMinh.value }));
  // Đăng nhập / đăng xuất: danh tính trên bảng đổi theo
  watch(me, () => gui({ t: 'ai', ...danhTinhSanh() }));
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

/** `tt: 'phong'` = đang ở phòng / ván online — KHÔNG mời được (server chỉ gửi cho client `v: 2`). */
export interface NguoiOnline { sid: string; ten: string; mat: string; mau?: string; tt: 'chu' | 'choi' | 'phong'; daMoi?: number; choMoi?: number; tuChoi?: true }
/** Lần tải danh sách mời gần nhất: TỔNG số đang online (khớp ô Chơi online) và số người tắt nhận lời mời (chỉ đếm). */
export const dsTong = ref(0);
export const dsAn = ref(0);
export type KetQuaMoi = { ok: true; han: number; cach?: number } | { loi: string; con?: number };
/** Khoảng phải chờ giữa hai lần mời cùng một người (server gửi `cach`; bản server cũ thì dùng số này). */
export const CACH_MOI_LAI_MS = 2 * 60_000;

async function post<T>(duong: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${SERVER_URL}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 404) { if (duong.startsWith('/api/sanh/')) coSanh.value = false; return null; }
    return (await r.json()) as T;
  } catch { return null; }
}
/** null = server không có sảnh / mất mạng (ẩn nút). */
export async function dsOnline(ma: string, token: string): Promise<NguoiOnline[] | null> {
  const r = await post<{ ds?: NguoiOnline[]; tong?: number; an?: number }>('/api/sanh/ds', { ma, token, v: 2 });
  if (r?.ds) coSanh.value = true;
  if (r?.ds) { dsTong.value = Math.max(r.tong ?? 0, r.ds.length + (r.an ?? 0)); dsAn.value = r.an ?? 0; ghiSoOnline(r.tong); }
  return r?.ds ?? null;
}
export async function moiNguoi(ma: string, token: string, sid: string, thach = false): Promise<KetQuaMoi> {
  return (await post<KetQuaMoi>('/api/sanh/moi', { ma, token, sid, ...(thach ? { thach: true } : {}) })) ?? { loi: 'mang' };
}

/*
 * THÁCH ĐẤU TỪ BẢNG XẾP HẠNG (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1).
 * Bấm "Thách" → App.vue đặt `thachCho` rồi mở màn online; OnlineScreen tạo phòng RIÊNG TƯ (bàn lần trước), vào
 * phòng chờ thì mời đúng người đó (`moiNguoi(..., thach = true)`). `daThach` nhớ lúc đã thách ai để nút "Thách"
 * hiện vạch chờ (cùng khoảng `CACH_MOI_LAI_MS` như nút Mời) — nhớ theo TÊN vì `sid` đổi mỗi lần người kia nối lại.
 */
export interface ThachDau { sid: string; ten: string; mat: string }
export const thachCho = ref<ThachDau | null>(null);
export const daThach = ref<Record<string, number>>({});
export function ghiDaThach(ten: string, het = Date.now() + CACH_MOI_LAI_MS): void { daThach.value = { ...daThach.value, [ten]: het }; }
/** Tên hiện cho người chưa đặt tên: "Khách #1a2b" theo mã sảnh (ổn định suốt kết nối). */
export const tenKhach = (sid: string): string => `#${sid.slice(-4).toUpperCase()}`;
