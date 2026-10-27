/**
 * MƯA THẺ — chế độ thẻ rơi (thử nghiệm 27.10.2026, chỉ mở trong chế độ debug).
 *
 * Luật (chủ dự án duyệt bản chơi thử https://claude.ai/artifact/5LpTWHQCPjPBZnU2XQDDBh):
 *  · thẻ rơi theo `soCot` cột; ĐANG RƠI thì NGỬA, CHẠM ĐÁY thì ÚP. Đã thử úp sau vài giây kể cả khi
 *    đang rơi — chủ dự án chơi thấy "khó phết", quay về (27.10.2026); thời gian nhìn giờ do TỐC ĐỘ rơi lo;
 *  · chạm 2 thẻ cùng hình (rơi hay nằm đều được) là ăn, thẻ phía trên tụt xuống lấp chỗ;
 *  · cột chạm đỉnh thì ĐÓNG, lá chia tiếp vào cột còn chỗ; ĐẦY HẾT mọi cột mới thua (chủ dự án
 *    27.10.2026 — bản đầu một cột đầy là thua). Trong một ván bàn CỐ ĐỊNH, cái khó đến từ TỐC ĐỘ;
 *  · chạm sai KHÔNG khoá: hai lá sai lộ hình `LO_SAI` giây cho kịp nhìn, lá thứ ba chạm được ngay
 *    (chủ dự án: "chế độ này nhanh" — riêng Mưa Thẻ, bàn thường vẫn chờ);
 *  · LÊN CẤP THEO ĐIỂM (`mocCap`, chủ dự án 27.10.2026 — bản đầu theo thời gian): rơi nhanh hơn, dày
 *    hơn; điểm mỗi cặp = `pairScore` của chế độ thường (100 × hệ số combo 1 · 1,2 · 1,5 · 2) × CẤP;
 *    combo = ăn liền tay trong `COMBO_GIAY` giây, chạm sai là mất chuỗi; mốc tăng theo cấp nên mỗi cấp ~10 cặp
 *    (ăn liền tay trong `COMBO_GIAY` giây là combo tăng).
 *
 * File này là luật THUẦN: không DOM, không đồng hồ thật, ngẫu nhiên qua `rand` truyền vào — để test
 * được. Toạ độ tính theo Ô (1 = cao một hàng), `y` là mép trên của lá, 0 = đỉnh giếng.
 */
import { comboMultiplier, pairScore } from '@mm/engine';

export { comboMultiplier };

/** Số cột người chơi chọn được: 4 → 8 (8 = số cột lớn nhất của bàn thường, 88 thẻ 8×11). Mặc định 6
 *  (chủ dự án 27.10.2026: 4×6 "không có nhiều thẻ để nhớ", 6 cột "nhiều thẻ hơn sẽ sống lâu hơn").
 *  Lá VUÔNG: 6 cột trên iPhone SE ~50px; 7–8 cột (~42/36px) CỐ Ý dưới ngưỡng chạm 44px — mức siêu
 *  khó người chơi tự chọn, cùng ngoại lệ đã chốt cho bàn 72/88 thẻ. */
export const COT_CHON = [4, 5, 6, 7, 8] as const;
export const COT = 6;
/** Số hàng THAM CHIẾU: tốc độ rơi khai theo ô của bàn 7 hàng, bàn nhiều hàng hơn nhân lên cho cùng px/giây. */
export const HANG = 7;
/** Lá VUÔNG (chủ dự án 27.10.2026: trước "thẻ phải ngắn hơn" — 0,85 — rồi "để dạng hình vuông"). */
export const DANG_LA = 1;
/** Đệm quanh lá trong ô (px): ngang 4+4, dọc 2+2 — khớp `.o` ở MuaThe.vue. */
export const DEM_NGANG = 8;
export const DEM_DOC = 4;

/** Số hàng cho giếng `w`×`h` px với `soCot` cột: lá cao = `DANG_LA` × bề ngang (vuông).
 *  Máy cao hơn thì nhiều hàng hơn — bàn sống lâu hơn, đúng thứ chủ dự án muốn. */
export function hangChoGieng(w: number, h: number, soCot: number): number {
  const laW = w / soCot - DEM_NGANG;
  const oH = laW * DANG_LA + DEM_DOC;
  return Math.max(6, Math.min(14, Math.floor(h / oH)));
}
/** Điểm cần để LÊN cấp `cap` (cấp 1 = 0): 1.000 · 3.000 · 6.000 · 10.000 … — mỗi cặp ở cấp n được
 *  ≥ 100·n điểm, nên mỗi cấp cần ~10 cặp (bớt đi nếu ăn combo). */
export const mocCap = (cap: number): number => 500 * cap * (cap - 1);
export const COMBO_GIAY = 3;
/** Lá cặp tới sau [ít nhất, nhiều nhất] lá khác — xem `hinhKe`. */
export const CACH_CAP: [number, number] = [3, 8];
/** Lá rơi mới chỉ vào cột mà lá rơi trước đó đã đi quá đoạn này (ô), không thì hai lá chồng hình. */
const KHOANG_TRONG = 1.2;
/** Gia tốc lá tụt xuống lấp chỗ (ô/giây²) — nhanh, dứt khoát. */
const TRONG_LUC = 40;

/* Nhịp đầu ván (27.10.2026): 0,9 ô/giây + 2,2 giây/lá "chậm quá" → 1,6 + 1,1 "khó thật sự" → 1,1 + 1,6,
   tăng mạnh hơn theo cấp (cấp 3 ≈ bản 1,6). */
export const tocDo = (cap: number): number => Math.min(4, 1.1 + 0.3 * (cap - 1));      // ô mỗi giây
export const nhipRoi = (cap: number): number => Math.max(0.45, 1.6 - 0.15 * (cap - 1)); // giây giữa hai lá

export interface La {
  id: number;
  sym: string;
  cot: number;
  y: number;
  vy: number;
  roi: boolean;
  chon: boolean;
  /** Đang ăn (hiệu ứng nổ) — không chạm được, không còn chiếm chỗ trong cột. */
  an: boolean;
  /** Vừa chạm sai: còn lộ hình tới mốc `t` này. */
  loDen: number;
}

/** Hai lá chạm sai còn lộ hình bấy nhiêu giây (không chặn chạm). */
export const LO_SAI = 0.6;

export type KetQuaCham = 'chon' | 'bo' | 'an' | 'sai' | null;
export type SuKien = { loai: 'cham-day'; la: La } | { loai: 'len-cap'; cap: number } | { loai: 'thua' };

export class VanMuaThe {
  la: La[] = [];
  /** Lá đã nằm trong từng cột, từ ĐÁY lên. */
  cot: La[][];
  t = 0;
  cap = 1;
  diem = 0;
  soCap = 0;
  chuoi = 0;
  /** Điểm của cặp vừa ăn (chữ bay lên). */
  vuaCong = 0;
  ketThuc = false;
  private henRoi = 0.3;
  private lanAnCuoi = -99;
  private choCap: { sym: string; toi: number }[] = [];
  private soLaDaTha = 0;
  private idSo = 0;

  constructor(private readonly hinh: string[], private readonly rand: () => number = Math.random, readonly soCot: number = COT, readonly soHang: number = HANG) {
    this.cot = Array.from({ length: soCot }, () => []);
    if (hinh.length < 2) throw new Error('mua-the: need at least 2 symbols');
  }

  oY(k: number): number { return this.soHang - 1 - k; }

  get chon(): La[] { return this.la.filter((l) => l.chon); }

  /**
   * Hình của lá kế tiếp. Lá CẶP tới sau `CACH_CAP` lá (ngẫu nhiên 3–8): đủ xa để phải nhớ, đủ gần để
   * không ai chờ mãi. Bản đầu xáo đợt 4 lá = 2 cặp nên hai lá giống nhau hay rơi liền nhau (chủ dự
   * án 27.10.2026: "các thẻ trùng khá liền nhau"). Hình mới ưu tiên hình CHƯA có trên bàn.
   */
  private hinhKe(): string {
    const n = this.soLaDaTha++;
    const toi = this.choCap.findIndex((c) => c.toi <= n);
    if (toi >= 0) return this.choCap.splice(toi, 1)[0]!.sym;
    const tren = new Set([...this.la.filter((l) => !l.an).map((l) => l.sym), ...this.choCap.map((c) => c.sym)]);
    const moi = this.hinh.filter((s) => !tren.has(s));
    const choSan = new Set(this.choCap.map((c) => c.sym));
    const khongCho = this.hinh.filter((s) => !choSan.has(s));   // đừng mở cặp thứ hai khi cặp đầu còn chờ lá kia
    const kho = moi.length ? moi : khongCho.length ? khongCho : this.hinh;
    const sym = kho[Math.floor(this.rand() * kho.length)]!;
    const [it, nhieu] = CACH_CAP;
    this.choCap.push({ sym, toi: n + 1 + it + Math.floor(this.rand() * (nhieu - it + 1)) });
    return sym;
  }

  private thaLa(): La | null {
    const tai = (c: number): number => this.cot[c]!.length + this.la.filter((l) => l.roi && l.cot === c).length;
    const conCho = [...Array(this.soCot).keys()].filter((c) => tai(c) < this.soHang);   // cột đầy đã ĐÓNG
    const ranh = conCho.filter((c) => !this.la.some((l) => l.roi && l.cot === c && l.y < KHOANG_TRONG - 1));
    if (!ranh.length) return null;
    /* CHIA ĐỀU (chủ dự án 27.10.2026: "có cột cao cái là thua luôn"): chỉ thả vào cột đang thấp —
       tải (lá nằm + lá đang rơi) không quá cột thấp nhất 1 lá. Ngẫu nhiên thuần dồn một cột lên đỉnh
       trong khi bàn còn trống, người chơi thua mà không kịp làm gì. */
    const thap = Math.min(...conCho.map(tai));                    // trên mọi cột CÒN CHỖ, kể cả cột đang bận
    const deu = ranh.filter((c) => tai(c) <= thap + 1);
    if (!deu.length) return null;                                // cột thấp còn bận: chờ một nhịp, đừng dồn sang cột cao
    const la: La = { id: ++this.idSo, sym: this.hinhKe(), cot: deu[Math.floor(this.rand() * deu.length)]!, y: -1, vy: 0, roi: true, chon: false, an: false, loDen: 0 };
    this.la.push(la);
    return la;
  }

  /** Chạy thêm `dt` giây. Trả về các chuyện vừa xảy ra để giao diện phát tiếng / hiệu ứng. */
  buoc(dt: number): SuKien[] {
    if (this.ketThuc) return [];
    const ev: SuKien[] = [];
    this.t += dt;
    while (this.diem >= mocCap(this.cap + 1)) { this.cap++; ev.push({ loai: 'len-cap', cap: this.cap }); }
    this.henRoi -= dt;
    if (this.henRoi <= 0) this.henRoi = this.thaLa() ? nhipRoi(this.cap) : 0.05;
    const v = tocDo(this.cap) * (this.soHang / HANG);   // cùng px/giây dù bàn nhiều hàng
    for (const l of this.la) {
      if (l.an) continue;
      if (l.roi) {
        const dich = this.oY(this.cot[l.cot]!.length);
        l.y += v * dt;
        if (l.y >= dich) {
          l.y = dich; l.roi = false;
          this.cot[l.cot]!.push(l);
          ev.push({ loai: 'cham-day', la: l });
          if (this.cot.every((c) => c.length >= this.soHang)) { this.ketThuc = true; ev.push({ loai: 'thua' }); return ev; }
        }
      } else {
        const dich = this.oY(this.cot[l.cot]!.indexOf(l));
        if (l.y < dich) { l.vy += TRONG_LUC * dt; l.y = Math.min(dich, l.y + l.vy * dt); } else l.vy = 0;
      }
    }
    return ev;
  }

  /** Lá này đang cho thấy hình không: đang rơi, đang được chọn, đang ăn, hoặc ván đã xong (lộ hết). */
  ngua(l: La): boolean { return l.roi || l.chon || l.an || this.t < l.loDen || this.ketThuc; }

  /** Vừa chạm sai (còn lộ hình) — giao diện lắc + viền đỏ. */
  sai(l: La): boolean { return this.t < l.loDen; }

  cham(id: number): KetQuaCham {
    if (this.ketThuc) return null;
    const l = this.la.find((x) => x.id === id);
    if (!l || l.an) return null;
    if (l.chon) { l.chon = false; return 'bo'; }
    l.chon = true;
    const ds = this.chon;
    if (ds.length < 2) return 'chon';
    const [a, b] = ds as [La, La];
    if (a.sym !== b.sym) {
      for (const x of [a, b]) { x.chon = false; x.loDen = this.t + LO_SAI; }
      this.chuoi = 0;   // như chế độ thường: sai là đứt chuỗi
      return 'sai';
    }
    this.chuoi = this.t - this.lanAnCuoi < COMBO_GIAY ? this.chuoi + 1 : 1;
    this.lanAnCuoi = this.t;
    this.vuaCong = pairScore(this.chuoi, false) * this.cap;
    this.diem += this.vuaCong;
    this.soCap++;
    for (const x of [a, b]) {
      x.chon = false; x.an = true;
      const c = this.cot[x.cot]!, i = c.indexOf(x);
      if (i >= 0) c.splice(i, 1);   // lá phía trên tự tụt xuống ở các bước sau
    }
    return 'an';
  }

  /** Gỡ hẳn các lá đã ăn (sau khi hiệu ứng nổ chạy xong). */
  donLaAn(): void { this.la = this.la.filter((l) => !l.an); }
}
