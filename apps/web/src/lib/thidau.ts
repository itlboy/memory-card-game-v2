import { ref } from 'vue';

/**
 * THI ĐẤU — PHÍA APP (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 4; server:
 * apps/node-server/src/thidau.ts). Chạy trên kết nối sảnh (lib/sanh.ts chuyển mọi tin `td_*` vào `nhanTinThiDau`).
 *
 * Các trạng thái (ThiDau.vue vẽ): `hoi` thẻ hỏi "Thi đấu online?" → bấm Tham gia → `gom` (đang gom người) →
 * `tran` (trận của bạn → chọn số thẻ → chốt bàn) → App.vue vào phòng thi đấu bằng mã. Chỉ một mình tham gia → `thieu`
 * (báo ngắn) rồi `cho` (viên "Đang chờ người", server giữ 10 phút). Không có chủ phòng ở bước nào.
 */
const KHOA_GY = 'mm.goiYThiDau';
function docGy(): boolean { try { return localStorage.getItem(KHOA_GY) !== '0'; } catch { return true; } }
/** Công tắc "Gợi ý thi đấu" ở trang Cài đặt — mặc định BẬT. */
export const goiYThiDau = ref(docGy());
export function datGoiYThiDau(v: boolean): void {
  goiYThiDau.value = v;
  try { localStorage.setItem(KHOA_GY, v ? '1' : '0'); } catch { /* bỏ qua */ }
}

export interface NguoiTran { sid: string; ten: string; mat: string }
export interface TdHoi { id: string; het: number; han: number; n: number; cho?: { ten: string; mat: string } }
export interface TdGom { id: string; het: number; han: number; n: number; ds: string[] }
export interface TdTran {
  id: string; toi: string; nguoi: NguoiTran[]; soThe: number[];
  /** Mốc hết bước xem mặt / hết giờ chọn (ms tuyệt đối). */
  hetXem: number; hetChon: number; hanChon: number;
  chon: Record<string, number>;
  /** Server đã chốt: mã phòng + số thẻ được bốc. */
  kq?: { ma: string; soThe: number };
}

/** Server này có thi đấu (tin `chao` kèm `td: 1`) — bản Cloudflare không có. */
export const coThiDau = ref(false);
export const tdHoi = ref<TdHoi | null>(null);
export const tdGom = ref<TdGom | null>(null);
/** Mốc hết hạn giữ chờ (0 = không chờ). */
export const tdCho = ref(0);
/** Dòng báo ngắn: `thieu` chỉ mình bạn tham gia · `hetCho` hết 10 phút · `huy` trận rã trước khi vào bàn. */
export const tdBao = ref<null | 'thieu' | 'hetCho' | 'huy'>(null);
export const tdTran = ref<TdTran | null>(null);
/** Mặt sảnh cấp cho mình ở trận vừa chốt — gửi kèm lúc vào phòng (`?mat=`) để trong ván vẫn là mặt đã thấy ở màn "Trận của bạn". */
export const matVaoPhong = ref<{ ma: string; mat: string } | null>(null);

let guiDi: (tin: unknown) => void = () => { /* chưa nối */ };
/** lib/sanh.ts đưa cửa gửi vào đây (tránh import vòng). */
export function datCuaGui(f: (tin: unknown) => void): void { guiDi = f; }

let henHoi: ReturnType<typeof setTimeout> | undefined;
let henBao: ReturnType<typeof setTimeout> | undefined;
function bao(loai: 'thieu' | 'hetCho' | 'huy', ms = 4000): void {
  tdBao.value = loai;
  clearTimeout(henBao);
  henBao = setTimeout(() => { if (tdBao.value === loai) tdBao.value = null; }, ms);
}

/** Mất kết nối sảnh: mọi thứ đang treo đều không còn đúng. */
export function quenThiDau(): void {
  clearTimeout(henHoi);
  tdHoi.value = null; tdGom.value = null; tdCho.value = 0;
  // Trận đã có mã phòng thì cứ để ThiDau.vue đưa vào phòng — phòng sống độc lập với sảnh
  if (tdTran.value && !tdTran.value.kq) tdTran.value = null;
}

export function nhanTinThiDau(m: Record<string, unknown>): boolean {
  const now = Date.now();
  switch (m.t) {
    case 'td_hoi': {
      const han = Number(m.han) || 15_000;
      const cho = m.cho as TdHoi['cho'] | undefined;
      tdHoi.value = { id: String(m.id), han, het: now + han, n: Number(m.n) || 0, ...(cho ? { cho: { ten: String(cho.ten ?? ''), mat: String(cho.mat ?? '🙂') } } : {}) };
      tdBao.value = null;
      clearTimeout(henHoi);
      henHoi = setTimeout(() => { if (tdHoi.value?.id === m.id) tdHoi.value = null; }, han);
      return true;
    }
    case 'td_gom': {
      const con = Number(m.con) || 0;
      const cu = tdGom.value?.id === m.id ? tdGom.value : null;
      tdGom.value = { id: String(m.id), het: now + con, han: cu?.han ?? Math.max(con, 1), n: Number(m.n) || 0, ds: Array.isArray(m.ds) ? (m.ds as unknown[]).map(String) : [] };
      tdHoi.value = null; tdCho.value = 0;
      return true;
    }
    case 'td_cho':
      tdGom.value = null; tdHoi.value = null;
      // Vừa gom xong mà chỉ có một mình: báo ngắn trước, viên chờ hiện sau
      if (!tdCho.value) bao('thieu');
      tdCho.value = now + (Number(m.con) || 0);
      return true;
    case 'td_het_cho':
      tdCho.value = 0; bao('hetCho');
      return true;
    case 'td_tran': {
      const xem = Number(m.xem) || 3000, chon = Number(m.chon) || 10_000;
      tdHoi.value = null; tdGom.value = null; tdCho.value = 0; tdBao.value = null;
      tdTran.value = {
        id: String(m.id), toi: String(m.toi), nguoi: (m.nguoi as NguoiTran[]) ?? [], soThe: (m.soThe as number[]) ?? [],
        hetXem: now + xem, hetChon: now + xem + chon, hanChon: chon, chon: {}
      };
      return true;
    }
    case 'td_da_chon': {
      const tr = tdTran.value;
      if (tr && tr.id === m.id) tdTran.value = { ...tr, chon: { ...tr.chon, [String(m.sid)]: Number(m.n) } };
      return true;
    }
    case 'td_bot': {
      const tr = tdTran.value;
      if (tr && tr.id === m.id) tdTran.value = { ...tr, nguoi: tr.nguoi.filter((x) => x.sid !== m.sid) };
      return true;
    }
    case 'td_vao': {
      const tr = tdTran.value;
      if (tr && tr.id === m.id) {
        const ds = (m.chon as { sid: string; n: number }[] | undefined) ?? [];
        const chon: Record<string, number> = { ...tr.chon };
        for (const c of ds) if (c.n) chon[c.sid] = c.n;
        tdTran.value = { ...tr, chon, nguoi: tr.nguoi.filter((x) => ds.some((c) => c.sid === x.sid)), kq: { ma: String(m.ma), soThe: Number(m.soThe) } };
        const toi = tr.nguoi.find((x) => x.sid === tr.toi);
        if (toi) matVaoPhong.value = { ma: String(m.ma), mat: toi.mat };
      }
      return true;
    }
    case 'td_huy': {
      const tr = tdTran.value;
      if (tr && tr.id === m.id) { tdTran.value = null; bao('huy'); }
      return true;
    }
    default:
      return false;
  }
}

/** Bấm "Tham gia" / "Để sau" trên thẻ hỏi. */
export function traLoiHoi(dong: boolean): void {
  const h = tdHoi.value;
  if (!h) return;
  guiDi({ t: 'td_tra', id: h.id, dong });
  clearTimeout(henHoi);
  tdHoi.value = null;
  // Hiện ngay trạng thái gom, không chờ server hồi âm (server gửi `td_gom` / `td_tran` đè lên sau)
  if (dong && !h.cho) tdGom.value = { id: h.id, het: h.het, han: h.han, n: 1, ds: [] };
}
/** Rời đợt gom / thôi chờ. */
export function thoiThiDau(): void {
  guiDi({ t: 'td_thoi' });
  tdGom.value = null; tdCho.value = 0;
}
export function chonSoThe(n: number): void {
  const tr = tdTran.value;
  if (!tr || tr.kq) return;
  guiDi({ t: 'td_chon', id: tr.id, n });
  tdTran.value = { ...tr, chon: { ...tr.chon, [tr.toi]: n } };
}
export function roiTran(): void {
  const tr = tdTran.value;
  if (!tr) return;
  if (!tr.kq) guiDi({ t: 'td_roi', id: tr.id });
  tdTran.value = null;
}
