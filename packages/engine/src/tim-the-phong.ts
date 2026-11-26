/**
 * TÌM THẺ ONLINE — NHỊP VÁN PHÍA SERVER (27.11.2026, chủ dự án duyệt mockup
 * https://claude.ai/artifact/5rwkt1SVgamVqoED4nEWz6). Luật vẫn là `VanTimThe`; lớp này chỉ thêm ĐỒNG HỒ: mỗi lượt đi
 * `xem` → `up` → `noi` (thẻ cần tìm giữa bàn) → `hoi` (chọn) → `dap-an` → lượt sau, hết thì `xong`.
 *
 * Thuần + tất định: mọi hàm nhận `now` từ ngoài (server truyền `Date.now()`, test truyền số), không tự đọc giờ, không
 * hẹn giờ. Server hỏi `henKe(now)` để đặt alarm, alarm nổ thì gọi `tick(now)`. Mốc pha tính CỘNG DỒN từ mốc trước (không
 * lấy `now`) để alarm trễ vài chục ms không làm ván trôi dần.
 *
 * Bảo mật (ON-09): `view()` KHÔNG BAO GIỜ gửi hình trên bàn khi bài úp, và chỉ lộ vị trí thẻ đúng ở `dap-an`. Ai chọn ô
 * nào cũng chỉ lộ ở `dap-an` — trong lúc chọn chỉ biết ai ĐÃ chọn.
 */
import type { BotLevel } from './bot.js';
import {
  TIM_THE_DAP_AN_MS, TIM_THE_NOI_MS, TIM_THE_UP_MS, VanTimThe, timTheHopLe,
  type TimTheConfig, type TimTheKetCuc
} from './tim-the.js';

export type TimPha = 'xem' | 'up' | 'noi' | 'hoi' | 'dap-an' | 'xong';

/** Lời chọn của client tới trễ vì đường truyền: vẫn nhận thêm bấy nhiêu sau hết giờ (giờ chọn ghi theo MÁY người chơi). */
export const TIM_PHONG_TRE_MS = 600;
/** Giờ máy người chơi báo lên không được sớm hơn giờ server quá mức này (chặn sửa tay báo "0 giây"). */
export const TIM_PHONG_LECH_MS = 1500;

export interface TimNguoiView {
  id: string;
  ten: string;
  may?: BotLevel;
  diem: number;
  /** Đang `hoi`: người này đã chọn chưa (không lộ chọn ô nào). */
  da: boolean;
  /** Chỉ ở `dap-an` / `xong`. */
  kq?: { ketCuc: TimTheKetCuc; viTri: number | null; ms: number | null; diem: number; nhanhNhat: boolean; chuoi: number };
  dung: number;
  chuoiDai: number;
}
export interface TimView {
  /** Đổi mỗi ván — client biết là ván mới (dọn hiệu ứng). */
  van: number;
  luot: number;
  soLuot: number;
  soThe: number;
  doKho: TimTheConfig['doKho'];
  pha: TimPha;
  /** Còn bao lâu tới hết pha (ms, tính lúc server gửi). */
  conMs: number;
  /** Độ dài cả pha (ms) — cho vạch giờ nếu cần. */
  daiMs: number;
  /** Hình trên bàn theo vị trí — CHỈ khi bài ngửa (`xem`, `dap-an`, `xong`). */
  the: string[] | null;
  /** Hình cần tìm — từ `noi`. */
  hinhDich: string | null;
  /** Vị trí thẻ đúng — CHỈ ở `dap-an` / `xong`. */
  dich: number | null;
  nguoi: TimNguoiView[];
}

export class PhongTimThe {
  readonly van: VanTimThe;
  pha: TimPha = 'xem';
  /** Mốc bắt đầu pha hiện tại (ms, giờ server). */
  tu = 0;
  /** Đã báo cho client bao nhiêu người đã chọn (để biết khi nào phải phát lại). */
  private soDaBao = 0;

  constructor(
    cfg: TimTheConfig,
    nguoi: readonly { id: string; ten: string; may?: BotLevel }[],
    hinh: readonly string[],
    seed: number,
    /** Số thứ tự ván trong phòng — đi vào view để client phân biệt ván mới. */
    readonly soVan = 0
  ) {
    this.van = new VanTimThe(timTheHopLe(cfg), nguoi, hinh, seed);
  }

  /** Bắt đầu lượt đầu (hết đếm ngược). */
  batDau(now: number): void { this.pha = 'xem'; this.tu = now; }

  get xong(): boolean { return this.pha === 'xong'; }

  /** Độ dài pha hiện tại; ở `hoi` = lúc chấm được (mọi người đã chọn thì sớm hơn hết giờ). */
  private daiPha(): number {
    switch (this.pha) {
      case 'xem': return this.van.xemMs;
      case 'up': return TIM_THE_UP_MS;
      case 'noi': return TIM_THE_NOI_MS;
      // Chưa đủ người chọn: thêm `TIM_PHONG_TRE_MS` cho lời chọn đang trên đường tới (client tự khoá ở `chonMs`)
      case 'hoi': return this.van.nguoi.every((p) => this.van.lucChon(p.id) !== null) ? this.van.chotLuc : this.van.chonMs + TIM_PHONG_TRE_MS;
      case 'dap-an': return TIM_THE_DAP_AN_MS;
      default: return 0;
    }
  }

  /**
   * Cho ván chạy tới `now`. Trả `true` khi có gì client cần biết (đổi pha, hoặc thêm người — kể cả máy — đã chọn).
   * Gọi thừa vô hại.
   */
  tick(now: number): boolean {
    let doi = false;
    // Vòng: alarm trễ cả giây (DO ngủ) thì đi qua đủ các pha đã lỡ, mỗi pha một lần
    for (let i = 0; i < 12 && this.pha !== 'xong'; i++) {
      const het = this.tu + this.daiPha();
      if (now < het) break;
      this.sangPha(het);
      doi = true;
    }
    if (this.pha === 'hoi') {
      const k = this.van.nguoi.filter((p) => this.van.daChon(p.id, now - this.tu)).length;
      if (k !== this.soDaBao) { this.soDaBao = k; doi = true; }
    }
    return doi;
  }

  private sangPha(moc: number): void {
    this.tu = moc;
    switch (this.pha) {
      case 'xem': this.pha = 'up'; break;
      case 'up': this.pha = 'noi'; break;
      case 'noi': this.van.moHoi(); this.soDaBao = 0; this.pha = 'hoi'; break;
      case 'hoi': this.van.chot(); this.pha = 'dap-an'; break;
      case 'dap-an': this.pha = this.van.tiep() ? 'xem' : 'xong'; break;
      default: break;
    }
  }

  /**
   * Người chơi chọn ô `viTri`. `msMay` = giờ chọn do MÁY NGƯỜI CHƠI đo (từ lúc nó thấy câu hỏi) — dùng nó để đường
   * truyền không ăn vào điểm, nhưng kẹp: không quá giờ server đã trôi, không sớm hơn giờ server quá `TIM_PHONG_LECH_MS`.
   * Trả `true` nếu nhận.
   */
  chon(id: string, viTri: number, msMay: number | undefined, now: number): boolean {
    if (this.pha !== 'hoi') return false;
    const troi = now - this.tu;
    if (troi > this.van.chonMs + TIM_PHONG_TRE_MS) return false;
    const may = typeof msMay === 'number' && Number.isFinite(msMay) ? msMay : troi;
    const ms = Math.max(0, Math.min(this.van.chonMs, troi, Math.max(may, troi - TIM_PHONG_LECH_MS)));
    return this.van.chon(id, viTri, ms);
  }

  /** Mốc alarm kế tiếp: hết pha, hoặc (đang chọn) lúc máy kế tiếp "bấm". `null` = ván xong. */
  henKe(now: number): number | null {
    if (this.pha === 'xong') return null;
    let moc = this.tu + this.daiPha();
    if (this.pha === 'hoi') {
      // Máy "bấm" đúng mốc đã định: thức dậy lúc đó để cả phòng thấy máy đã chọn
      for (const p of this.van.nguoi) {
        const ms = p.may ? this.van.lucChon(p.id) : null;
        if (ms !== null && this.tu + ms > now && this.tu + ms < moc) moc = this.tu + ms;
      }
    }
    return Math.max(moc, now + 10);
  }

  view(now: number): TimView {
    const v = this.van;
    const ngua = this.pha === 'xem' || this.pha === 'dap-an' || this.pha === 'xong';
    const lo = this.pha === 'dap-an' || this.pha === 'xong';
    const dai = this.daiPha();
    const kq = lo ? v.ketLuot?.ketQua : undefined;
    return {
      van: this.soVan,
      luot: v.luot,
      soLuot: v.cfg.soLuot,
      soThe: v.cfg.soThe,
      doKho: v.cfg.doKho,
      pha: this.pha,
      conMs: Math.max(0, this.tu + (this.pha === 'hoi' ? v.chonMs : dai) - now),
      daiMs: this.pha === 'hoi' ? v.chonMs : dai,
      the: ngua ? [...v.the] : null,
      hinhDich: this.pha === 'noi' || this.pha === 'hoi' || lo ? v.hinhDich : null,
      dich: lo ? v.dich : null,
      nguoi: v.nguoi.map((p) => {
        const k = kq?.find((x) => x.id === p.id);
        return {
          id: p.id, ten: p.ten, ...(p.may ? { may: p.may } : {}), diem: p.diem, dung: p.dung, chuoiDai: p.chuoiDai,
          da: this.pha === 'hoi' && v.daChon(p.id, now - this.tu),
          ...(k ? { kq: { ketCuc: k.ketCuc, viTri: k.viTri, ms: k.ms, diem: k.diem, nhanhNhat: k.nhanhNhat, chuoi: k.chuoi } } : {})
        };
      })
    };
  }

  /** Xếp hạng cuối ván (trùng điểm = đồng hạng). */
  xepHang(): { id: string; diem: number; hang: number }[] {
    return this.van.xepHang().map((p) => ({ id: p.id, diem: p.diem, hang: p.hang }));
  }
}
