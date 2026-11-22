import { randomBytes } from 'node:crypto';
import { THI_DAU_SO_THE, chiaTran } from '@mm/engine';

/**
 * THI ĐẤU — GỌI MỌI NGƯỜI, TỰ CHIA TRẬN (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 4).
 * Chạy TRÊN sảnh (sanh.ts): dùng chung kết nối `/ws/sanh`, chỉ nằm trong RAM. Không có chủ phòng ở bất kỳ bước nào.
 *
 * MỘT ĐỢT GỌI: có từ 2 người rảnh (đang ở TRANG CHỦ, bật "Gợi ý thi đấu", app hiểu thi đấu) → mọi người cùng nhận
 * `td_hoi`, đợt mở `GOM_MS`. Ai trả lời "tham gia" vào nhóm; hết giờ chia nhóm thành các trận 2–3 người (`chiaTran`).
 * Mỗi trận: xem mặt nhau `XEM_MS`, mỗi người chọn số thẻ trong `CHON_MS` (danh sách theo số người — `THI_DAU_SO_THE`),
 * khác nhau thì BỐC NGẪU NHIÊN trong các số đã chọn → lập phòng thi đấu (`taoPhong`) → `td_vao` kèm mã phòng.
 *
 * CHƯA ĐỦ NGƯỜI: người duy nhất tham gia được GIỮ CHỜ `CHO_MS` (không phải bấm lại). Có người mới rảnh là mở đợt
 * "có người đang chờ": người mới bấm tham gia → thành trận NGAY. `baoCho` = cửa gửi thông báo đẩy cho người đã đóng app.
 *
 * MỨC HỎI LẠI (chủ dự án 22.11.2026: đang ít người online, cần đẩy mạnh → đặt lỏng; `td_tat` trong thống kê cho biết khi
 * nào phải siết): bỏ qua thẻ hỏi → `NGHI_BO_QUA_MS`; bấm "Để sau" → `NGHI_DE_SAU_MS`. Đang giữa ván (`choi`) không hỏi.
 */
export const GOM_MS = 15_000;
export const XEM_MS = 3_000;
export const CHON_MS = 10_000;
export const CHO_MS = 10 * 60_000;
export const NGHI_BO_QUA_MS = 3 * 60_000;
export const NGHI_DE_SAU_MS = 10 * 60_000;
/** Đợt đang mở còn ít hơn chừng này thì người vừa rảnh không được hỏi nữa (không kịp đọc thẻ). */
const HOI_MUON_MS = 5_000;

/** Phần thi đấu gắn trên mỗi kết nối sảnh. */
export interface TdNguoi {
  /** App hiểu thi đấu (`?td=1` lúc nối) — app cũ không bao giờ được hỏi. */
  ho: boolean;
  /** Công tắc "Gợi ý thi đấu" của người đó. */
  gy: boolean;
  /** Không hỏi trước mốc này. */
  nghi: number;
  /** Mã đợt đang hỏi người này (chưa trả lời). */
  hoi: string | null;
  /** Mã trận đang ở (xem mặt / chọn số thẻ). */
  tran: string | null;
  /** Hết hạn giữ chờ (0 = không chờ). */
  cho: number;
  /** Số lần đã hỏi trong ngày (chỉ để thống kê). */
  lan: number;
  /**
   * Đang chơi offline MỘT MÌNH (app khai trong tin `tt`). 23.11.2026, chủ dự án: "giới hạn ở trang chủ thì ít quá, nên cho
   * cả đang chơi offline 1 người" — người này vẫn được hỏi và được xếp trận; app chỉ rời ván khi trận THẬT SỰ thành.
   * Chơi nhiều người cùng máy thì KHÔNG (rời ván là bỏ rơi người ngồi cạnh).
   */
  mot: boolean;
}
export const tdMoi = (ho: boolean, mot = false): TdNguoi => ({ ho, gy: true, nghi: 0, hoi: null, tran: null, cho: 0, lan: 0, mot });

export interface NguoiTd { sid: string; ten: string; mat: string; tt: string; td: TdNguoi; ai?: string | null }
export type GhiTd = (loai: string, sid: string | null, duLieu: Record<string, unknown>) => void;

interface Dot { id: string; het: number; coCho: boolean; hoi: Set<string>; thamGia: string[]; hen: ReturnType<typeof setTimeout> }
interface Tran { id: string; nguoi: string[]; ds: readonly number[]; chon: Map<string, number>; hen: ReturnType<typeof setTimeout>; chot: boolean; luc: number }

export interface ThiDau {
  /** Xét lại: có nên mở đợt gọi / ghép người đang chờ không. Gọi khi ai đó nối, đổi trạng thái, đổi công tắc. */
  xet(): void;
  /** Xử lý một tin `td_*` / `gy` từ client. Trả true nếu là tin của thi đấu. */
  tin(k: NguoiTd, m: Record<string, unknown>): boolean;
  /** Kết nối đóng. */
  roi(k: NguoiTd): void;
  /** Nhịp dọn (người chờ hết hạn). */
  nhip(): void;
  soLieu(): { cho: number; tran: number; dot: boolean };
  dong(): void;
}

export function moThiDau(o: {
  ketNoi: Map<string, NguoiTd>;
  gui(k: NguoiTd, tin: unknown): void;
  now(): number;
  /** Lập phòng thi đấu cho `n` người với bàn `soThe` thẻ → mã phòng (null = không lập được). */
  taoPhong(soThe: number, n: number): Promise<string | null>;
  ghi?: GhiTd;
  /**
   * Điểm TUẦN theo danh tính sảnh (`ai`) — để xếp người gần hạng nhau vào cùng trận. Thiếu / lỗi / quá 400 ms thì coi như
   * mọi người 0 điểm (xếp ngẫu nhiên như trước).
   */
  diemTuan?(ai: string[]): Promise<Record<string, number>>;
  /** Có người đang chờ mà trong app không còn ai để hỏi → thông báo đẩy. */
  baoCho?(ten: string): void;
  /** Hẹn giờ — test thay bằng đồng hồ giả. */
  hen?: (f: () => void, ms: number) => ReturnType<typeof setTimeout>;
  ngauNhien?: () => number;
}): ThiDau {
  const hen = o.hen ?? ((f, ms) => { const h = setTimeout(f, ms); h.unref?.(); return h; });
  const rnd = o.ngauNhien ?? Math.random;
  const ghi: GhiTd = (loai, sid, d) => { try { o.ghi?.(loai, sid, d); } catch { /* thống kê hỏng không được làm hỏng trận */ } };
  let dot: Dot | null = null;
  const tran = new Map<string, Tran>();
  /** sid → những sid vừa đấu cùng (đợt sau ưu tiên tách). */
  const vuaDau = new Map<string, Set<string>>();
  let henXet: ReturnType<typeof setTimeout> | null = null;

  const ma = (): string => randomBytes(4).toString('hex');
  const mat = (k: NguoiTd) => ({ sid: k.sid, ten: k.ten, mat: k.mat });
  const dangCho = (k: NguoiTd, t: number): boolean => k.td.cho > t;
  /** Xếp trận được ngay: ở trang chủ, hoặc đang chơi offline MỘT MÌNH. */
  const sanSang = (k: NguoiTd): boolean => k.tt === 'chu' || (k.tt === 'choi' && k.td.mot);
  /** Được tính là "người rảnh": sẵn sàng, bật gợi ý, app hiểu thi đấu, không trong trận. */
  const ranh = (k: NguoiTd): boolean => k.td.ho && k.td.gy && sanSang(k) && !k.td.tran;
  const hoiDuoc = (k: NguoiTd, t: number): boolean => ranh(k) && k.td.nghi <= t && !k.td.hoi && !dangCho(k, t);

  function guiGom(): void {
    if (!dot) return;
    const ds = dot.thamGia.map((s) => o.ketNoi.get(s)).filter((k): k is NguoiTd => !!k);
    const tin = { t: 'td_gom', id: dot.id, con: Math.max(0, dot.het - o.now()), n: ds.length, ds: ds.slice(0, 5).map((k) => k.mat) };
    for (const k of ds) o.gui(k, tin);
  }

  function hoi(k: NguoiTd, d: Dot, soRanh: number, cho?: NguoiTd): void {
    k.td.hoi = d.id;
    k.td.lan++;
    d.hoi.add(k.sid);
    o.gui(k, { t: 'td_hoi', id: d.id, han: Math.max(0, d.het - o.now()), n: soRanh, ...(cho ? { cho: { ten: cho.ten, mat: cho.mat } } : {}) });
    ghi('td_hoi', k.sid, { kenh: cho ? 'coNguoiCho' : 'theHoi', dot: d.id, ranh: soRanh, lan: k.td.lan });
  }

  function xetNgay(): void {
    henXet = null;
    const t = o.now();
    const tat = [...o.ketNoi.values()];
    const soRanh = tat.filter((k) => ranh(k) || (k.td.ho && dangCho(k, t) && !k.td.tran)).length;
    const cho = tat.filter((k) => k.td.ho && dangCho(k, t) && !k.td.tran);
    const choSan = cho.filter(sanSang);
    // Đợt đang mở: người vừa rảnh được hỏi thêm nếu còn kịp
    if (dot) {
      if (dot.het - t < HOI_MUON_MS) return;
      const d = dot;
      const nguoiCho = d.coCho ? choSan[0] : undefined;
      for (const k of tat) if (hoiDuoc(k, t) && !d.thamGia.includes(k.sid)) hoi(k, d, soRanh, nguoiCho);
      return;
    }
    // Hai người cùng đang chờ và cùng rảnh (một người vừa chơi xong ván một mình) → thành trận luôn
    if (choSan.length >= 2) { for (const k of choSan) k.td.cho = 0; lapCacTran(choSan); return; }
    const ungVien = tat.filter((k) => hoiDuoc(k, t));
    if (choSan.length === 1 && ungVien.length >= 1) {
      const d: Dot = { id: ma(), het: t + GOM_MS, coCho: true, hoi: new Set(), thamGia: [choSan[0]!.sid], hen: hen(() => ketDot(), GOM_MS) };
      dot = d;
      for (const k of ungVien) hoi(k, d, soRanh, choSan[0]);
      return;
    }
    if (!cho.length && ungVien.length >= 2) {
      const d: Dot = { id: ma(), het: t + GOM_MS, coCho: false, hoi: new Set(), thamGia: [], hen: hen(() => ketDot(), GOM_MS) };
      dot = d;
      for (const k of ungVien) hoi(k, d, soRanh);
      ghi('td_dot', null, { dot: d.id, hoi: ungVien.length });
    }
  }

  function ketDot(): void {
    const d = dot;
    if (!d) return;
    dot = null;
    clearTimeout(d.hen);
    const t = o.now();
    // Ai được hỏi mà không trả lời: nghỉ ngắn rồi mới hỏi lại
    for (const s of d.hoi) {
      const k = o.ketNoi.get(s);
      if (!k || k.td.hoi !== d.id) continue;
      k.td.hoi = null;
      k.td.nghi = t + NGHI_BO_QUA_MS;
      ghi('td_tra_loi', s, { dot: d.id, tra: 'boQua' });
    }
    const a = d.thamGia.map((s) => o.ketNoi.get(s)).filter((k): k is NguoiTd => !!k && k.td.ho && sanSang(k) && !k.td.tran);
    ghi('td_chia', null, { dot: d.id, thamGia: a.length, tran2: chiaTran(a.length).filter((x) => x === 2).length, tran3: chiaTran(a.length).filter((x) => x === 3).length, du: a.length >= 2 });
    if (a.length >= 2) { for (const k of a) k.td.cho = 0; lapCacTran(a); }
    else if (a.length === 1) giuCho(a[0]!, d.coCho && d.thamGia[0] === a[0]!.sid);
    xet();
  }

  /** Giữ một người ở trạng thái chờ. `dangChoSan` = họ vốn đang chờ (đợt "có người chờ" không ai nhận) → giữ nguyên hạn. */
  function giuCho(k: NguoiTd, dangChoSan = false): void {
    const t = o.now();
    if (!dangChoSan || k.td.cho <= t) {
      k.td.cho = t + CHO_MS;
      ghi('td_cho', k.sid, { viec: 'batDau' });
      o.baoCho?.(k.ten);
    }
    o.gui(k, { t: 'td_cho', con: k.td.cho - t });
  }

  /**
   * XẾP NHÓM (mockup duyệt mục "Ai vào trận nào"): xếp theo ĐIỂM TUẦN rồi cắt thành nhóm → người gần hạng nhau gặp nhau.
   * Hai người vừa đấu nhau ở đợt trước thì ưu tiên tách: thử thêm các cách đổi chỗ hai người kề nhau, lấy cách ít cặp
   * "vừa đấu" nhất (hoà thì giữ cách sát điểm nhất). Hoà điểm (kể cả không lấy được điểm) thì thứ tự là ngẫu nhiên.
   */
  function lapCacTran(ds: NguoiTd[]): void {
    for (const k of ds) k.td.tran = 'dang-xep';   // giữ chỗ trong lúc chờ điểm: không bị đợt khác hỏi / xếp lần nữa
    const ai = ds.map((k) => k.ai).filter((x): x is string => !!x);
    const lay = ai.length && o.diemTuan
      ? Promise.race([o.diemTuan(ai).catch(() => ({} as Record<string, number>)), new Promise<Record<string, number>>((r) => { hen(() => r({}), 400); })])
      : Promise.resolve({} as Record<string, number>);
    const xepVaLap = (diemAi: Record<string, number>): void => {
      const con = ds.filter((k) => o.ketNoi.get(k.sid) === k && k.td.tran === 'dang-xep');
      for (const k of con) k.td.tran = null;
      if (con.length < 2) { if (con.length === 1 && sanSang(con[0]!)) giuCho(con[0]!); xet(); return; }
      const ngau = new Map(con.map((k) => [k.sid, rnd()]));
      const xep = [...con].sort((a, b) => (diemAi[b.ai ?? ''] ?? 0) - (diemAi[a.ai ?? ''] ?? 0) || ngau.get(a.sid)! - ngau.get(b.sid)!);
      const co = chiaTran(xep.length);
      const cat = (x: NguoiTd[]): NguoiTd[][] => { const nhom: NguoiTd[][] = []; let c = 0; for (const n of co) { nhom.push(x.slice(c, c + n)); c += n; } return nhom; };
      const trung = (nhom: NguoiTd[][]): number => { let d = 0; for (const g of nhom) for (const p of g) for (const q of g) if (p !== q && vuaDau.get(p.sid)?.has(q.sid)) d++; return d; };
      let tot = cat(xep), it = trung(tot);
      for (let i = 0; i + 1 < xep.length && it > 0; i++) {
        const x = [...xep]; [x[i], x[i + 1]] = [x[i + 1]!, x[i]!];
        const nhom = cat(x), d = trung(nhom);
        if (d < it) { it = d; tot = nhom; }
      }
      for (const g of tot) lapTran(g);
    };
    // Không có nguồn điểm (hoặc chưa ai có danh tính): xếp NGAY, đồng bộ — trận thành tức thì như trước
    if (!ai.length || !o.diemTuan) { xepVaLap({}); return; }
    void lay.then(xepVaLap);
  }

  function lapTran(g: NguoiTd[]): void {
    const n = g.length as 2 | 3;
    const id = ma();
    const tr: Tran = { id, nguoi: g.map((k) => k.sid), ds: THI_DAU_SO_THE[n], chon: new Map(), chot: false, luc: o.now(), hen: hen(() => { void chot(id); }, XEM_MS + CHON_MS) };
    tran.set(id, tr);
    for (const k of g) {
      k.td.tran = id; k.td.hoi = null;
      vuaDau.set(k.sid, new Set(g.filter((x) => x !== k).map((x) => x.sid)));
    }
    const nguoi = g.map(mat);
    for (const k of g) o.gui(k, { t: 'td_tran', id, toi: k.sid, nguoi, soThe: tr.ds, xem: XEM_MS, chon: CHON_MS });
  }

  const conLai = (tr: Tran): NguoiTd[] => tr.nguoi.map((s) => o.ketNoi.get(s)).filter((k): k is NguoiTd => !!k && k.td.tran === tr.id);

  /** Trận rã trước khi vào phòng (người rời / rớt mạng): báo người còn lại; còn đúng 1 thì giữ chờ. */
  function huyTran(tr: Tran, lyDo: string): void {
    tran.delete(tr.id);
    clearTimeout(tr.hen);
    const con = conLai(tr);
    for (const k of con) { k.td.tran = null; o.gui(k, { t: 'td_huy', id: tr.id, lyDo }); }
    if (con.length === 1 && sanSang(con[0]!)) giuCho(con[0]!);
    xet();
  }

  async function chot(id: string): Promise<void> {
    const tr = tran.get(id);
    if (!tr || tr.chot) return;
    tr.chot = true;
    clearTimeout(tr.hen);
    const con = conLai(tr);
    if (con.length < 2) { huyTran(tr, 'thieu'); return; }
    // Số thẻ theo số người CÒN LẠI lúc lập trận (bàn đã chốt giữ nguyên dù có người rời sau đó)
    const phieu = con.map((k) => tr.chon.get(k.sid)).filter((x): x is number => typeof x === 'number');
    const soThe = phieu.length ? phieu[Math.floor(rnd() * phieu.length)]! : tr.ds[0]!;
    const maPhong = await o.taoPhong(soThe, con.length).catch(() => null);
    const conSau = conLai(tr);
    tran.delete(id);
    if (!maPhong || conSau.length < 2) {
      for (const k of conSau) { k.td.tran = null; o.gui(k, { t: 'td_huy', id, lyDo: maPhong ? 'thieu' : 'loi' }); }
      if (conSau.length === 1 && sanSang(conSau[0]!)) giuCho(conSau[0]!);
      xet();
      return;
    }
    const chon = conSau.map((k) => ({ sid: k.sid, n: tr.chon.get(k.sid) ?? 0 }));
    ghi('td_chon_the', null, { tran: id, nguoi: conSau.length, chon: chon.map((c) => c.n), boc: soThe, giay: Math.round((o.now() - tr.luc) / 1000) });
    for (const k of conSau) { k.td.tran = null; o.gui(k, { t: 'td_vao', id, ma: maPhong, soThe, chon }); }
  }

  function xet(): void { if (!henXet) henXet = hen(xetNgay, 300); }

  return {
    xet,
    tin(k, m) {
      const t = o.now();
      if (m.t === 'gy') {
        const bat = m.bat !== false;
        if (k.td.gy && !bat) ghi('td_tat', k.sid, { lan: k.td.lan });
        k.td.gy = bat;
        if (!bat && k.td.cho > t) { k.td.cho = 0; ghi('td_cho', k.sid, { viec: 'thoi' }); }
        xet();
        return true;
      }
      if (m.t === 'td_tra') {
        const d = dot;
        if (!d || m.id !== d.id || k.td.hoi !== d.id) return true;
        k.td.hoi = null;
        const dong = m.dong === true;
        ghi('td_tra_loi', k.sid, { dot: d.id, tra: dong ? 'thamGia' : 'deSau', giay: Math.round((GOM_MS - (d.het - t)) / 1000) });
        if (!dong) { k.td.nghi = t + NGHI_DE_SAU_MS; return true; }
        if (!ranh(k)) return true;
        d.thamGia.push(k.sid);
        // Có người đang chờ sẵn: không gom thêm — thành trận ngay
        if (d.coCho) ketDot(); else guiGom();
        return true;
      }
      if (m.t === 'td_thoi') {
        if (dot) {
          const i = dot.thamGia.indexOf(k.sid);
          if (i >= 0) { dot.thamGia.splice(i, 1); guiGom(); }
        }
        if (k.td.cho > t) { k.td.cho = 0; ghi('td_cho', k.sid, { viec: 'thoi', giay: Math.round((CHO_MS - (k.td.cho - t)) / 1000) }); }
        k.td.cho = 0;
        return true;
      }
      if (m.t === 'td_chon') {
        const tr = tran.get(String(m.id));
        const n = Number(m.n);
        if (!tr || tr.chot || k.td.tran !== tr.id || !tr.ds.includes(n)) return true;
        tr.chon.set(k.sid, n);
        for (const x of conLai(tr)) o.gui(x, { t: 'td_da_chon', id: tr.id, sid: k.sid, n });
        // Ai cũng chốt rồi thì khỏi chờ hết giờ (để nửa giây cho người cuối thấy mình đã chốt)
        if (conLai(tr).every((x) => tr.chon.has(x.sid))) { clearTimeout(tr.hen); tr.hen = hen(() => { void chot(tr.id); }, 600); }
        return true;
      }
      if (m.t === 'td_roi') {
        const tr = k.td.tran ? tran.get(k.td.tran) : undefined;
        if (!tr || tr.chot) return true;
        k.td.tran = null;
        const con = conLai(tr);
        if (con.length < 2) huyTran(tr, 'roi');
        else for (const x of con) o.gui(x, { t: 'td_bot', id: tr.id, sid: k.sid });
        return true;
      }
      return false;
    },
    roi(k) {
      if (dot) {
        const i = dot.thamGia.indexOf(k.sid);
        if (i >= 0) { dot.thamGia.splice(i, 1); guiGom(); }
        dot.hoi.delete(k.sid);
      }
      if (k.td.cho > o.now()) ghi('td_cho', k.sid, { viec: 'dongApp' });
      const tr = k.td.tran ? tran.get(k.td.tran) : undefined;
      k.td.tran = null; k.td.cho = 0;
      if (tr && !tr.chot) {
        const con = conLai(tr);
        if (con.length < 2) huyTran(tr, 'roi');
        else for (const x of con) o.gui(x, { t: 'td_bot', id: tr.id, sid: k.sid });
      }
      vuaDau.delete(k.sid);
    },
    nhip() {
      const t = o.now();
      for (const k of o.ketNoi.values()) {
        if (k.td.cho && k.td.cho <= t) { k.td.cho = 0; o.gui(k, { t: 'td_het_cho' }); ghi('td_cho', k.sid, { viec: 'hetGio' }); }
      }
      xet();
    },
    soLieu: () => ({ cho: [...o.ketNoi.values()].filter((k) => k.td.cho > o.now()).length, tran: tran.size, dot: !!dot }),
    dong() {
      if (dot) clearTimeout(dot.hen);
      for (const tr of tran.values()) clearTimeout(tr.hen);
      if (henXet) clearTimeout(henXet);
    }
  };
}
