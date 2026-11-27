/**
 * TÌM THẺ — kiểu chơi thứ hai, KHÔNG ghép cặp (chủ dự án duyệt 26.11.2026,
 * bản chơi thử https://claude.ai/artifact/ESzywRX1pBqhx72tD1u1tz).
 *
 * Một LƯỢT = một bàn thẻ mới: cả bàn ngửa cho xem → úp hết → hỏi MỘT thẻ → mỗi người chọn MỘT lần →
 * cả bàn lật ngửa, chấm điểm → sang bàn khác. Ván = `soLuot` lượt, không có đồng hồ cả ván.
 *
 * ĐÃ CHỐT (đừng đảo lại khi chưa hỏi):
 *  · số thẻ 3 · 4 · 5 · 6 · 7 · 8 · 9 — bàn VÒNG TRÒN (27.11.2026: bỏ 12 và 16, chủ dự án: "khó quá, không ai giải được");
 *  · độ khó x = giây xem MỖI thẻ: Dễ 1 · Vừa 0,75 · Khó 0,5 → giờ xem = x × số thẻ;
 *  · giờ chọn = NỬA giờ xem, sàn 2 giây (2 thẻ mức Khó mà không sàn là 0,5 giây — không kịp chạm);
 *  · điểm lượt đúng = 10 × số thẻ × (1 + phần giờ chọn còn lại) × hệ số chuỗi (như ghép cặp:
 *    1 · 1,2 · 1,5 · 2) × hệ số độ khó (1 · 1,25 · 1,5). Tính theo SỐ THẺ vì điểm = xu: để 100 điểm
 *    cố định thì bàn 3 thẻ thành chỗ cày xu;
 *  · nhiều người: chờ CẢ PHÒNG chọn xong (hoặc hết giờ) mới chấm; đúng NHANH NHẤT thêm 5 × số thẻ
 *    (cộng ngoài, không nhân); trùng điểm thì ĐỒNG HẠNG, không có luật phụ;
 *  · sai hoặc hết giờ là mất chuỗi; KHÔNG có tim/mạng — giới hạn số lượt là đủ.
 *
 * File này là luật THUẦN và TẤT ĐỊNH: không DOM, không đồng hồ thật (thời gian do nơi gọi đưa vào bằng
 * ms), ngẫu nhiên qua `Rng` — client chơi offline và server phòng online dùng CHUNG.
 */
import type { BotLevel } from './bot.js';
import { Rng } from './rng.js';
import { comboMultiplier } from './scoring.js';

export const TIM_THE_SO_THE = [3, 4, 5, 6, 7, 8, 9] as const;
export type TimTheDoKho = 'de' | 'vua' | 'kho';
export const TIM_THE_DO_KHO: readonly TimTheDoKho[] = ['de', 'vua', 'kho'];
/** x = giây xem mỗi thẻ. */
export const TIM_THE_X: Record<TimTheDoKho, number> = { de: 1, vua: 0.75, kho: 0.5 };
/** Chọn khó thì có lợi — không thì ai cũng chọn Dễ. */
export const TIM_THE_HE_SO_KHO: Record<TimTheDoKho, number> = { de: 1, vua: 1.25, kho: 1.5 };
export const TIM_THE_SO_LUOT = 10;
export const TIM_THE_CHON_SAN_MS = 2000;
/** Nhịp úp bài trước khi hiện câu hỏi, và nhịp xem đáp án trước khi sang bàn mới. */
export const TIM_THE_UP_MS = 800;
/** Đầu MỖI lượt (kể cả lượt đầu): bàn mới nằm ÚP chừng này rồi mới lật cho xem (chủ dự án 27.11.2026: "úp khoảng 2 giây rồi lật"). */
export const TIM_THE_CHO_MS = 2000;
/** 3 giây (27.11.2026, bàn vòng tròn): ai chưa chọn thì vòng sáng quay ~1 giây về đáp án rồi mới lật — cần chỗ để nhìn kết quả. */
export const TIM_THE_DAP_AN_MS = 3000;
/**
 * Nhịp THẺ GIỮA LẬT NGỬA trước khi cho chọn — NGOÀI giờ chọn. Bàn vòng tròn (27.11.2026): thẻ cần tìm nằm ở tâm, ngửa suốt
 * nhịp chọn, nên chỉ cần đủ cho cú lật (trước là 3 giây vì thẻ hiện to trên lớp mờ rồi tan). Phòng online dùng chung.
 */
export const TIM_THE_NOI_MS = 600;

export interface TimTheConfig {
  soThe: number;
  doKho: TimTheDoKho;
  /** Mặc định `TIM_THE_SO_LUOT`. */
  soLuot?: number;
}

/** Ép cấu hình lạ (URL, localStorage, tin từ client) về giá trị hợp lệ. */
export function timTheHopLe(raw: Partial<TimTheConfig> | null | undefined): Required<TimTheConfig> {
  const soThe = (TIM_THE_SO_THE as readonly number[]).includes(Number(raw?.soThe)) ? Number(raw!.soThe) : 9;
  const doKho = TIM_THE_DO_KHO.includes(raw?.doKho as TimTheDoKho) ? (raw!.doKho as TimTheDoKho) : 'vua';
  const luot = Math.trunc(Number(raw?.soLuot));
  return { soThe, doKho, soLuot: luot >= 1 && luot <= 30 ? luot : TIM_THE_SO_LUOT };
}

export const timTheXemMs = (cfg: TimTheConfig): number => Math.round(TIM_THE_X[cfg.doKho] * cfg.soThe * 1000);
export const timTheChonMs = (cfg: TimTheConfig): number => Math.max(TIM_THE_CHON_SAN_MS, Math.round(timTheXemMs(cfg) / 2));
/** Số cột của bàn — 4 thẻ xếp 2×2, 12 thẻ 4×3. */
export const timTheSoCot = (soThe: number): number => (soThe === 3 ? 3 : soThe <= 4 ? 2 : soThe <= 9 ? 3 : 4);
/** Ước lượng một ván dài bao lâu (ms) — cho dòng mô tả ở màn cấu hình. */
export function timTheUocMs(cfg: TimTheConfig): number {
  const luot = cfg.soLuot ?? TIM_THE_SO_LUOT;
  return luot * (TIM_THE_CHO_MS + timTheXemMs(cfg) + TIM_THE_UP_MS + TIM_THE_NOI_MS + timTheChonMs(cfg) / 2 + TIM_THE_DAP_AN_MS);
}

/** Thưởng đúng nhanh nhất phòng. */
export const timTheThuongNhanh = (soThe: number): number => 5 * soThe;

/**
 * Điểm một lượt ĐÚNG. `chuoi` là chuỗi SAU khi tính lượt này (như `pairScore`), `msChon` là lúc chọn
 * tính từ khi hiện câu hỏi. Chưa gồm thưởng nhanh nhất.
 */
export function timTheDiem(cfg: TimTheConfig, chuoi: number, msChon: number): number {
  const han = timTheChonMs(cfg);
  const conLai = Math.max(0, Math.min(1, 1 - msChon / han));
  return Math.round(10 * cfg.soThe * (1 + conLai) * comboMultiplier(chuoi) * TIM_THE_HE_SO_KHO[cfg.doKho]);
}

/* ---------- máy ---------- */

/**
 * Máy "nhớ chắc" bấy nhiêu thẻ, phần còn lại đoán mò — bàn càng nhiều thẻ càng dễ sai, y như người.
 * Cùng nguyên tắc với bot ghép cặp: khó dễ đến từ GIỚI HẠN KÝ ỨC, không phải cố tình chọn sai.
 */
export const TIM_THE_MAY_NHO: Record<BotLevel, number> = { easy: 2, normal: 3, hard: 5, insane: 8, divine: 11 };
/** Máy chọn sau bao nhiêu PHẦN giờ chọn (khoảng, rút ngẫu nhiên) — mức cao thì nhanh tay hơn. */
export const TIM_THE_MAY_NHIP: Record<BotLevel, readonly [number, number]> = {
  easy: [0.6, 0.95], normal: [0.5, 0.85], hard: [0.4, 0.7], insane: [0.3, 0.55], divine: [0.2, 0.45]
};
/** Giờ xem ngắn thì máy cũng nhớ kém đi — không thì mức Khó máy mạnh lên so với người. */
export const TIM_THE_MAY_HE_SO: Record<TimTheDoKho, number> = { de: 1, vua: 0.85, kho: 0.7 };
/** Không bao giờ đúng tuyệt đối: Rồng thần vẫn có lúc sẩy tay. */
export const TIM_THE_MAY_TRAN = 0.97;

/** Xác suất máy chọn ĐÚNG: nhớ k thẻ thì trúng k/n, không nhớ thì đoán 1 trong (n−k) thẻ còn lại → (k+1)/n. */
export function timTheMayDung(level: BotLevel, cfg: TimTheConfig): number {
  const k = TIM_THE_MAY_NHO[level] * TIM_THE_MAY_HE_SO[cfg.doKho];
  return Math.max(1 / cfg.soThe, Math.min(TIM_THE_MAY_TRAN, (k + 1) / cfg.soThe));
}

/** Nước của máy trong một lượt: chọn ô nào, lúc nào (ms từ khi hiện câu hỏi). */
export function timTheMayChon(level: BotLevel, cfg: TimTheConfig, dich: number, rng: Rng): { viTri: number; ms: number } {
  const [lo, hi] = TIM_THE_MAY_NHIP[level];
  const ms = Math.round(timTheChonMs(cfg) * (lo + rng.next() * (hi - lo)));
  if (rng.next() < timTheMayDung(level, cfg)) return { viTri: dich, ms };
  const sai = rng.int(cfg.soThe - 1);
  return { viTri: sai >= dich ? sai + 1 : sai, ms };
}

/* ---------- ván ---------- */

export interface TimTheNguoiVao { id: string; ten: string; may?: BotLevel }
export interface TimTheNguoi extends TimTheNguoiVao {
  diem: number;
  chuoi: number;
  chuoiDai: number;
  /** Số lượt chọn đúng. */
  dung: number;
  /** Lần chọn đúng nhanh nhất của người này (ms), `null` = chưa đúng lượt nào. */
  nhanhNhatMs: number | null;
}
export type TimTheKetCuc = 'dung' | 'sai' | 'het-gio';
export interface TimTheKetQua {
  id: string;
  ketCuc: TimTheKetCuc;
  viTri: number | null;
  ms: number | null;
  /** Điểm lượt này (đã gồm thưởng nhanh nhất). */
  diem: number;
  nhanhNhat: boolean;
  /** Chuỗi SAU lượt này và hệ số đã dùng. */
  chuoi: number;
  heSo: number;
}
export interface TimTheKetLuot { luot: number; dich: number; ketQua: TimTheKetQua[] }
export type TimThePha = 'xem' | 'hoi' | 'dap-an' | 'xong';

export class VanTimThe {
  readonly cfg: Required<TimTheConfig>;
  readonly nguoi: TimTheNguoi[];
  /** Lượt hiện tại, đếm từ 0. */
  luot = 0;
  pha: TimThePha = 'xem';
  /** Hình trên bàn của lượt này, theo vị trí. */
  the: string[] = [];
  /** Vị trí thẻ được hỏi. KHÔNG gửi cho client online trước khi vào pha `hoi` (lộ hình là đủ; vị trí
   *  thì không bao giờ gửi trước pha `dap-an`). */
  dich = 0;
  ketLuot: TimTheKetLuot | null = null;
  private readonly hinh: readonly string[];
  private readonly rng: Rng;
  private chonCua = new Map<string, { viTri: number; ms: number }>();

  constructor(cfg: TimTheConfig, nguoi: readonly TimTheNguoiVao[], hinh: readonly string[], seed: number) {
    this.cfg = timTheHopLe(cfg);
    const khac = [...new Set(hinh)];
    if (khac.length < this.cfg.soThe) throw new Error(`Tìm Thẻ cần ít nhất ${this.cfg.soThe} hình khác nhau`);
    if (!nguoi.length) throw new Error('Tìm Thẻ cần ít nhất một người chơi');
    this.hinh = khac;
    this.rng = new Rng(seed);
    this.nguoi = nguoi.map((p) => ({ ...p, diem: 0, chuoi: 0, chuoiDai: 0, dung: 0, nhanhNhatMs: null }));
    this.chiaBan();
  }

  get xemMs(): number { return timTheXemMs(this.cfg); }
  get chonMs(): number { return timTheChonMs(this.cfg); }
  get nhieuNguoi(): boolean { return this.nguoi.length > 1; }
  /** Hình của thẻ đang được hỏi. */
  get hinhDich(): string { return this.the[this.dich]!; }
  /** Hệ số chuỗi của lượt SẮP chấm, nếu người này chọn đúng (cho HUD). */
  heSoKe(id: string): number {
    return comboMultiplier((this.nguoi.find((p) => p.id === id)?.chuoi ?? 0) + 1);
  }

  private chiaBan(): void {
    this.the = this.rng.sample(this.hinh, this.cfg.soThe);
    this.dich = this.rng.int(this.cfg.soThe);
    this.chonCua = new Map();
    this.ketLuot = null;
    this.pha = 'xem';
  }

  /** Hết giờ xem, bài đã úp: hiện câu hỏi. Máy quyết nước của nó NGAY lúc này (tất định theo seed). */
  moHoi(): void {
    if (this.pha !== 'xem') return;
    this.pha = 'hoi';
    for (const p of this.nguoi) {
      if (!p.may) continue;
      const nuoc = timTheMayChon(p.may, this.cfg, this.dich, this.rng);
      if (nuoc.ms < this.chonMs) this.chonCua.set(p.id, nuoc);
    }
  }

  /** Người chọn một ô lúc `ms` (tính từ khi hiện câu hỏi). Mỗi lượt MỘT lần; quá giờ thì bỏ. */
  chon(id: string, viTri: number, ms: number): boolean {
    if (this.pha !== 'hoi' || this.chonCua.has(id)) return false;
    const p = this.nguoi.find((x) => x.id === id);
    if (!p || p.may) return false;
    if (!Number.isInteger(viTri) || viTri < 0 || viTri >= this.cfg.soThe) return false;
    if (!(ms >= 0) || ms > this.chonMs) return false;
    this.chonCua.set(id, { viTri, ms: Math.round(ms) });
    return true;
  }

  /** Lúc người này chọn (ms từ khi hỏi), `null` = chưa chọn. Máy: mốc đã định sẵn ở `moHoi` (server hẹn alarm theo nó). */
  lucChon(id: string): number | null { return this.chonCua.get(id)?.ms ?? null; }

  /** Ai đã chọn tính tới lúc `ms` — máy "chọn" đúng thời điểm đã định, không lộ trước. */
  daChon(id: string, ms: number): boolean {
    const c = this.chonCua.get(id);
    return !!c && c.ms <= ms;
  }

  /**
   * Lúc chấm được (ms từ khi hiện câu hỏi): khi MỌI người đã chọn thì là lần chọn muộn nhất, còn không
   * thì hết giờ. Nơi gọi hẹn giờ theo số này rồi gọi `chot()`.
   */
  get chotLuc(): number {
    if (this.nguoi.some((p) => !this.chonCua.has(p.id))) return this.chonMs;
    return Math.max(...[...this.chonCua.values()].map((c) => c.ms));
  }

  /** Chấm lượt: cộng điểm, cập nhật chuỗi, sang pha `dap-an`. */
  chot(): TimTheKetLuot {
    if (this.pha !== 'hoi') return this.ketLuot!;
    const dung = this.nguoi.filter((p) => this.chonCua.get(p.id)?.viTri === this.dich);
    // Nhanh nhất chỉ có nghĩa khi có đối thủ. Trùng ms tới từng mili giây thì cùng được thưởng.
    const msNhanh = this.nhieuNguoi && dung.length ? Math.min(...dung.map((p) => this.chonCua.get(p.id)!.ms)) : null;
    const ketQua = this.nguoi.map((p): TimTheKetQua => {
      const c = this.chonCua.get(p.id);
      if (!c || c.viTri !== this.dich) {
        p.chuoi = 0;
        return { id: p.id, ketCuc: c ? 'sai' : 'het-gio', viTri: c?.viTri ?? null, ms: c?.ms ?? null, diem: 0, nhanhNhat: false, chuoi: 0, heSo: 1 };
      }
      p.chuoi++;
      p.chuoiDai = Math.max(p.chuoiDai, p.chuoi);
      p.dung++;
      p.nhanhNhatMs = p.nhanhNhatMs == null ? c.ms : Math.min(p.nhanhNhatMs, c.ms);
      const nhanhNhat = c.ms === msNhanh;
      const diem = timTheDiem(this.cfg, p.chuoi, c.ms) + (nhanhNhat ? timTheThuongNhanh(this.cfg.soThe) : 0);
      p.diem += diem;
      return { id: p.id, ketCuc: 'dung', viTri: c.viTri, ms: c.ms, diem, nhanhNhat, chuoi: p.chuoi, heSo: comboMultiplier(p.chuoi) };
    });
    this.pha = 'dap-an';
    this.ketLuot = { luot: this.luot, dich: this.dich, ketQua };
    return this.ketLuot;
  }

  /** Xem đáp án xong: chia bàn mới, hoặc hết ván. Trả `true` nếu còn lượt. */
  tiep(): boolean {
    if (this.pha !== 'dap-an') return this.pha !== 'xong';
    this.luot++;
    if (this.luot >= this.cfg.soLuot) { this.pha = 'xong'; return false; }
    this.chiaBan();
    return true;
  }

  /** Xếp hạng: điểm cao trước; TRÙNG điểm thì đồng hạng (1, 1, 3…). */
  xepHang(): (TimTheNguoi & { hang: number })[] {
    const xep = [...this.nguoi].sort((a, b) => b.diem - a.diem);
    return xep.map((p) => ({ ...p, hang: xep.findIndex((q) => q.diem === p.diem) + 1 }));
  }
}
