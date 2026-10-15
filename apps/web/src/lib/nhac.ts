import { computed } from 'vue';
import { sfx } from './audio';
import { daMuaPremium, hienPremium } from './premium';

/*
 * NHẠC NỀN — TỔNG HỢP bằng Web Audio, cùng cách với mọi tiếng khác của app (13.10.2026).
 *
 * Vì sao không dùng file mp3: (1) không có chuyện bản quyền — App Store từng gỡ
 * app vì nhạc không rõ nguồn; (2) không tải thêm byte nào, app vẫn offline;
 * (3) cùng chất âm với tiếng lật thẻ.
 *
 * BA BÀI (15.10.2026, chủ dự án: "nhỏ hơn, chậm hơn, cho đổi bài như âm thanh"),
 * chọn ở menu → Nhạc nền (Tắt · 🎹 · 🌙 · 🐋 · 🌿 · 🎐), nhớ ở `prefs.baiNhac`; 🎐 là PREMIUM:
 *  · `keo`    — "Vui": marimba C–G–Am–F, bản gốc (mã giữ `keo` — bản lưu cũ đọc nó);
 *  · `dem`    — lo-fi: NHỊP LẮC, hợp âm bảy piano điện đánh lệch phách;
 *  · `sau`    — Biển sâu: giọng thứ Dm–B♭–Gm–A, âm vực thấp, hợp âm vào CHẬM rồi ngân
 *    như lớp sương (pad) — khác KHUÔN với ba bài kia (gõ nhanh, rải đều), không chỉ khác giọng;
 *  · `vuon`   — QUẠT CHẢ cả hợp âm kiểu ukulele, G–Em–C–D;
 *  · `chuong` — hộp nhạc NHỊP 3/4: Am–F–C–G, tiếng chuông có hoạ âm lệch (răng lược thép).
 * Luật (chủ dự án 15.10.2026): mỗi bài phải khác nhau ở NHỊP ĐIỆU + KẾT CẤU, không chỉ ở
 * tiếng — bốn bài cùng khuôn "rải đều mỗi móc" bị chê na ná nhau.
 * Mỗi bài là một bộ DỮ LIỆU (`BAI`) chạy chung một bộ máy: thêm bài = thêm một mục.
 *
 * Hai "tâm trạng" `menu` và `van` nghe Y HỆT nhau lúc vừa vào ván (chủ dự án
 * 15.10.2026: "nhạc nền bên ngoài và khi bắt đầu ván phải giống nhau" — bản cũ
 * vào ván là thưa + tối hẳn đi). Khác biệt DUY NHẤT: trong ván nhịp dồn dần
 * theo `gap` khi thẻ vơi đi. Đừng thêm lại chuyện thưa/tối/nhỏ cho `van`.
 *
 * Đi qua `sfx.duongRa()` (master chung) nên theo đúng mức âm lượng và tắt âm
 * thanh là tắt luôn nhạc. Lập lịch kiểu "nhìn trước" (lookahead): mỗi 50ms đặt
 * các nốt của 0,3 giây tới vào đồng hồ của AudioContext — setInterval trễ vài
 * chục ms cũng không làm lệch nhịp.
 */
export type TamTrang = 'menu' | 'van';
export const BAI_NHAC = ['keo', 'dem', 'sau', 'vuon', 'chuong'] as const;
export type BaiNhac = typeof BAI_NHAC[number];
/** Nhãn trên nút chọn — biểu tượng thay chữ: khỏi dịch, khỏi tràn menu ở 15 ngôn ngữ. */
export const ICON_BAI: Record<BaiNhac, string> = { keo: '🎹', dem: '🌙', sau: '🐋', vuon: '🌿', chuong: '🎐' };

/**
 * Bài PREMIUM — cùng gói với theme/skin premium (lib/premium.ts), cùng luật: chưa mở
 * bán (`banPremium`) thì ẨN hẳn khỏi menu; mở bán mà chưa mua thì đeo vương miện,
 * chạm vào báo "sắp ra mắt" chứ không đổi.
 */
export const BAI_PREMIUM: ReadonlySet<BaiNhac> = new Set<BaiNhac>(['vuon', 'chuong']);
export const baiHien = computed(() => BAI_NHAC.filter((b) => !BAI_PREMIUM.has(b) || hienPremium.value));
export const baiChoiDuoc = (b: BaiNhac): boolean => !BAI_PREMIUM.has(b) || daMuaPremium.value;
export const laBaiNhac = (x: unknown): x is BaiNhac => (BAI_NHAC as readonly unknown[]).includes(x);

/** Một bè: dạng sóng, độ ngân (giây), độ to, hoạ âm [bội số, độ to], độ vào (giây, mặc định 0,012 = gõ). */
interface Be { kieu: OscillatorType; dai: number; to: number; hoa: readonly (readonly [number, number])[]; vao?: number }
interface Bai {
  /** Hợp âm từng ô nhịp: nốt bass + các nốt để rải (MIDI). */
  vong: readonly { bass: number; ton: readonly number[] }[];
  /** Giai điệu: 8 móc đơn mỗi ô, 0 = nghỉ. */
  giai: readonly (readonly number[])[];
  /** Thứ tự rải hợp âm (chỉ số vào `ton`), 8 móc. */
  rai: readonly number[];
  /** Số móc đơn mỗi ô nhịp: 8 (4/4) hoặc 6 (3/4 — valse). Mặc định 8. */
  moc?: number;
  /** Móc có bass (mặc định phách 1 và giữa ô). */
  bassMoc?: readonly number[];
  /** Nhịp lắc: móc lẻ trễ bao nhiêu phần một móc (0 = đều). */
  swing?: number;
  /** Quạt hợp âm: khoảng cách giữa các dây (giây), như quạt đàn. */
  quet?: number;
  /** Móc nào có bè rải (mặc định mọi móc). */
  raiMoc?: readonly number[];
  /** Bè rải đánh CẢ hợp âm một lúc (pad) thay vì từng nốt. */
  caHopAm?: boolean;
  /** Nâng quãng cho bè rải (bán cung). */
  quangRai: number;
  /** Nhân nhịp so với `BPM` — bài êm thì chậm hơn nữa. */
  nhip: number;
  /** Tần số lọc (Hz). */
  loc: number;
  bass: Be; raiBe: Be; giaiBe: Be;
}

const MARIMBA = [[1, 1], [4, 0.18]] as const;
const DON = [[1, 1]] as const;
/** Răng lược thép của hộp nhạc: hoạ âm KHÔNG nguyên lần — đó là cái làm ra tiếng "chuông". */
const CHUONG = [[1, 1], [2.76, 0.22], [5.4, 0.07]] as const;

const BAI: Record<BaiNhac, Bai> = {
  keo: {
    // Vòng 4 hợp âm chơi hai lượt (8 ô) cho khớp 8 câu giai điệu
    vong: [0, 1].flatMap(() => [
      { bass: 48, ton: [60, 64, 67, 72] },   // C
      { bass: 43, ton: [59, 62, 67, 71] },   // G
      { bass: 45, ton: [60, 64, 69, 69] },   // Am
      { bass: 41, ton: [60, 65, 69, 65] },   // F
    ]),
    // Ngũ cung C nên chồng lên hợp âm nào cũng êm
    giai: [
      [76, 0, 79, 0, 81, 79, 76, 0],
      [74, 0, 79, 0, 74, 0, 71, 0],
      [72, 0, 76, 0, 81, 0, 79, 76],
      [77, 0, 76, 0, 72, 0, 0, 0],
      [76, 79, 84, 0, 81, 79, 76, 0],
      [79, 0, 74, 0, 79, 81, 79, 0],
      [81, 0, 79, 76, 72, 0, 76, 0],
      [77, 76, 74, 72, 0, 0, 0, 0],
    ],
    rai: [0, 1, 2, 3, 2, 1, 0, 1],
    quangRai: 12, nhip: 1, loc: 5200,
    bass: { kieu: 'triangle', dai: 0.55, to: 0.07, hoa: DON },
    raiBe: { kieu: 'sine', dai: 0.32, to: 0.032, hoa: MARIMBA },
    giaiBe: { kieu: 'triangle', dai: 0.45, to: 0.042, hoa: DON },
  },
  dem: {
    vong: [
      { bass: 41, ton: [57, 60, 64, 65] },   // Fmaj7
      { bass: 40, ton: [55, 59, 62, 64] },   // Em7
      { bass: 38, ton: [57, 60, 62, 65] },   // Dm7
      { bass: 48, ton: [59, 60, 64, 67] },   // Cmaj7
      { bass: 41, ton: [57, 60, 64, 65] },
      { bass: 40, ton: [55, 59, 62, 64] },
      { bass: 38, ton: [57, 60, 62, 65] },
      { bass: 43, ton: [55, 59, 62, 65] },   // G7 — kéo về đầu vòng
    ],
    // Thưa, nhiều khoảng nghỉ: nghe như ai đó gõ phím đàn lúc khuya
    giai: [
      [76, 0, 0, 0, 72, 0, 74, 0],
      [71, 0, 0, 0, 0, 0, 67, 0],
      [69, 0, 72, 0, 74, 0, 0, 0],
      [72, 0, 0, 0, 0, 0, 0, 0],
      [76, 0, 77, 0, 76, 0, 72, 0],
      [74, 0, 0, 0, 71, 0, 0, 0],
      [72, 0, 74, 0, 69, 0, 0, 0],
      [71, 0, 0, 0, 74, 0, 0, 0],
    ],
    // Piano điện: cả hợp âm (lăn nhẹ) đánh LỆCH phách 1 · 2½ · 4, nhịp lắc
    rai: [0, 0, 0, 0, 0, 0, 0, 0], raiMoc: [0, 3, 6], caHopAm: true, quet: 0.012, swing: 0.33,
    bassMoc: [0, 5],
    quangRai: 0, nhip: 0.85, loc: 2600,
    bass: { kieu: 'sine', dai: 1.4, to: 0.08, hoa: DON },
    raiBe: { kieu: 'sine', dai: 1.3, to: 0.014, hoa: [[1, 1], [2, 0.12]], vao: 0.02 },
    giaiBe: { kieu: 'sine', dai: 1.1, to: 0.04, hoa: [[1, 1], [3, 0.05]] },
  },
  sau: {
    vong: [0, 1].flatMap(() => [
      { bass: 38, ton: [50, 53, 57, 62] },   // Dm
      { bass: 46, ton: [50, 53, 58, 62] },   // B♭
      { bass: 43, ton: [50, 55, 58, 62] },   // Gm
      { bass: 45, ton: [49, 52, 57, 61] },   // A — nốt Đô thăng kéo về Rê
    ]),
    // Ngũ cung Rê thứ (D F G A C), ba bốn nốt một ô: như tiếng vọng dưới nước
    giai: [
      [69, 0, 0, 0, 0, 0, 65, 0],
      [62, 0, 0, 0, 0, 0, 0, 0],
      [67, 0, 0, 0, 65, 0, 62, 0],
      [64, 0, 0, 0, 0, 0, 0, 0],
      [69, 0, 0, 72, 0, 0, 69, 0],
      [65, 0, 0, 0, 62, 0, 0, 0],
      [67, 0, 0, 0, 70, 0, 67, 0],
      [69, 0, 0, 0, 0, 0, 0, 0],
    ],
    rai: [0, 0, 0, 0, 0, 0, 0, 0], raiMoc: [0], caHopAm: true, bassMoc: [0],
    quangRai: 0, nhip: 0.8, loc: 1500,
    bass: { kieu: 'sine', dai: 1.6, to: 0.09, hoa: [[1, 1], [2, 0.2]], vao: 0.04 },
    raiBe: { kieu: 'triangle', dai: 4.2, to: 0.016, hoa: [[1, 1], [1.004, 0.8]], vao: 0.9 },
    giaiBe: { kieu: 'sine', dai: 1.8, to: 0.035, hoa: [[1, 1], [2, 0.08]], vao: 0.1 },
  },
  vuon: {
    vong: [0, 1].flatMap(() => [
      { bass: 43, ton: [55, 59, 62, 67] },   // G
      { bass: 40, ton: [55, 59, 64, 67] },   // Em
      { bass: 48, ton: [55, 60, 64, 67] },   // C
      { bass: 50, ton: [54, 57, 62, 66] },   // D
    ]),
    // Ngũ cung Sol (G A B D E): câu hát nhẹ như huýt sáo ngoài vườn
    giai: [
      [79, 0, 76, 0, 74, 0, 76, 0],
      [79, 0, 0, 0, 76, 74, 71, 0],
      [72, 0, 76, 0, 79, 0, 76, 0],
      [74, 0, 69, 0, 74, 0, 0, 0],
      [79, 81, 79, 0, 76, 0, 74, 0],
      [76, 0, 79, 0, 83, 0, 79, 0],
      [76, 0, 74, 0, 72, 0, 71, 0],
      [69, 0, 71, 0, 74, 0, 0, 0],
    ],
    // Quạt chả cả hợp âm: XUỐNG · XUỐNG LÊN · LÊN XUỐNG LÊN (móc 0 · 2 3 · 5 6 7)
    rai: [0, 0, 0, 0, 0, 0, 0, 0], raiMoc: [0, 2, 3, 5, 6, 7], caHopAm: true, quet: 0.016,
    quangRai: 0, nhip: 1, loc: 4500,
    bass: { kieu: 'triangle', dai: 0.6, to: 0.06, hoa: DON },
    raiBe: { kieu: 'triangle', dai: 0.35, to: 0.016, hoa: [[1, 1], [2, 0.25], [3, 0.1]] },
    giaiBe: { kieu: 'sine', dai: 0.5, to: 0.04, hoa: [[1, 1], [2, 0.15]] },
  },
  chuong: {
    vong: [
      { bass: 45, ton: [57, 60, 64, 69] },   // Am
      { bass: 41, ton: [57, 60, 65, 69] },   // F
      { bass: 48, ton: [55, 60, 64, 67] },   // C
      { bass: 43, ton: [55, 59, 62, 67] },   // G
      { bass: 45, ton: [57, 60, 64, 69] },
      { bass: 41, ton: [57, 60, 65, 69] },
      { bass: 43, ton: [55, 59, 62, 67] },
      { bass: 45, ton: [57, 60, 64, 69] },
    ],
    // NHỊP 3/4 (valse, 6 móc mỗi ô): hộp nhạc chơi giai điệu ru, ngũ cung La thứ
    moc: 6, bassMoc: [0],
    giai: [
      [76, 0, 0, 0, 81, 0],
      [77, 0, 76, 0, 72, 0],
      [79, 0, 0, 0, 76, 0],
      [74, 0, 0, 0, 0, 0],
      [76, 0, 81, 0, 84, 0],
      [77, 0, 76, 0, 72, 0],
      [74, 0, 76, 0, 79, 0],
      [81, 0, 0, 0, 0, 0],
    ],
    rai: [0, 1, 2, 3, 2, 1],
    quangRai: 12, nhip: 0.9, loc: 6000,
    bass: { kieu: 'sine', dai: 0.9, to: 0.045, hoa: DON },
    raiBe: { kieu: 'sine', dai: 0.7, to: 0.022, hoa: CHUONG },
    giaiBe: { kieu: 'sine', dai: 1.2, to: 0.034, hoa: CHUONG },
  },
};

/** Nhịp gốc (menu và lúc vừa vào ván) → nhịp cuối ván. 72 → 62 (15.10.2026: "chậm hơn"). */
const BPM = 62;
const BPM_MAX = 86;
// Nhạc nền nằm DƯỚI tiếng lật/ghép thẻ. 0,55 → 0,33 (13.10.2026) → 0,15 (15.10.2026:
// "nhỏ hơn", hai lần). Chỉnh nhạc nền ở đây, đừng đụng âm lượng chung của sfx.
const AM_LUONG = 0.15;

const soMoc = (b: Bai): number => b.moc ?? 8;
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

class NhacNen {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private loc: BiquadFilterNode | null = null;
  private hen: ReturnType<typeof setInterval> | undefined;
  private buoc = 0;
  private lucToi = 0;
  private tam: TamTrang = 'menu';
  private tamCho: TamTrang = 'menu';
  private bai: BaiNhac = 'keo';
  private baiCho: BaiNhac = 'keo';
  /**
   * ĐỘ GẤP của ván, 0..1 (App đặt): tiến độ cặp đã ghép, hoặc 1 khi đồng hồ
   * gần hết. Tempo trong ván đi từ `bpm` lên `bpmMax` theo đường cong mũ 1,6 —
   * nửa đầu ván gần như không đổi, càng về cuối càng dồn (chủ dự án 13.10.2026).
   * Đổi tempo áp từ MÓC NHẠC kế tiếp nên chuyển mượt, không gãy nhịp.
   */
  gap = 0;
  /** Đã có cử chỉ người dùng chưa — trước đó đừng đụng tới AudioContext (iOS chặn). */
  daCham = false;

  /** Bật/đổi tâm trạng (và bài). Gọi lại nhiều lần là vô hại. */
  chay(tam: TamTrang, bai: BaiNhac = this.baiCho): void {
    this.tamCho = tam;
    if (bai !== this.baiCho) {
      this.baiCho = bai;
      // Đang chạy mà đổi bài: vào bài mới từ đầu câu, không chờ hết ô nhịp
      if (this.hen) this.buoc = 0;
    }
    if (!this.hen) {
      this.bai = this.baiCho; this.buoc = 0;
      this.hen = setInterval(() => this.nhip(), 50);
      this.nhip();
    }
  }

  /** Tắt (mờ dần 0,4 giây). */
  dung(): void {
    if (this.hen) clearInterval(this.hen);
    this.hen = undefined;
    const { bus, ctx } = this;
    if (bus && ctx) {
      try {
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      } catch { /* context đã đóng */ }
      setTimeout(() => { try { bus.disconnect(); } catch { /* */ } }, 600);
    }
    this.bus = null; this.loc = null; this.ctx = null;
  }

  private tanSoLoc(): number { return BAI[this.bai].loc; }

  /** Dựng (hoặc dựng lại khi sfx đổi context — iOS hay giết context lúc xuống nền). */
  private noi(): AudioContext | null {
    const ra = sfx.duongRa();
    if (!ra) return null;
    if (ra.ctx !== this.ctx || !this.bus) {
      try { this.bus?.disconnect(); } catch { /* */ }
      const bus = ra.ctx.createGain();
      bus.gain.value = 0;
      bus.gain.setTargetAtTime(AM_LUONG, ra.ctx.currentTime, 0.6);   // vào nhẹ, không đập vào tai
      const loc = ra.ctx.createBiquadFilter();
      loc.type = 'lowpass';
      loc.frequency.value = this.tanSoLoc();
      bus.connect(loc); loc.connect(ra.dich);
      this.ctx = ra.ctx; this.bus = bus; this.loc = loc;
      this.lucToi = ra.ctx.currentTime + 0.1;
    }
    return this.ctx;
  }

  private nhip(): void {
    if (!this.daCham || (typeof document !== 'undefined' && document.hidden)) return;
    const ctx = this.noi();
    if (!ctx || ctx.state !== 'running') return;
    // Bị treo lâu (tab nền) thì đừng dồn cả tràng nốt bù vào một lúc
    if (this.lucToi < ctx.currentTime) this.lucToi = ctx.currentTime + 0.05;
    while (this.lucToi < ctx.currentTime + 0.3) {
      const moc = this.buoc % soMoc(BAI[this.bai]);
      // Đổi bài ở ĐẦU ô nhịp cho khỏi gãy câu nhạc (bài mới có thể khác số móc mỗi ô)
      if (moc === 0 && (this.tamCho !== this.tam || this.baiCho !== this.bai)) {
        if (this.baiCho !== this.bai) this.buoc = 0;
        this.tam = this.tamCho; this.bai = this.baiCho;
        this.loc?.frequency.setTargetAtTime(this.tanSoLoc(), this.lucToi, 0.3);
      }
      const mocDai = 60 / this.bpm() / 2;
      this.datNot(this.lucToi, mocDai);
      this.lucToi += mocDai;
      this.buoc = (this.buoc + 1) % (soMoc(BAI[this.bai]) * BAI[this.bai].vong.length);
    }
  }

  private bpm(): number {
    const goc = this.tam !== 'van' ? BPM
      : BPM + (BPM_MAX - BPM) * Math.max(0, Math.min(1, this.gap)) ** 1.6;
    return goc * BAI[this.bai].nhip;
  }

  private datNot(t0: number, mocDai: number): void {
    const b = BAI[this.bai];
    const n = soMoc(b);
    const o = Math.floor(this.buoc / n), moc = this.buoc % n;
    const ha = b.vong[o]!;
    // Nhịp lắc (swing): móc lẻ đánh trễ một chút — cái "lười" của lo-fi
    const t = t0 + (moc % 2 ? (b.swing ?? 0) * mocDai : 0);

    if ((b.bassMoc ?? [0, n / 2]).includes(moc)) this.not(hz(ha.bass), t, b.bass);
    if (!b.raiMoc || b.raiMoc.includes(moc)) {
      const nots = b.caHopAm ? ha.ton : [ha.ton[b.rai[moc]!]!];
      // Quạt chả: phách xuôi quạt xuống (trầm → cao), phách ngược quạt lên
      const thuTu = b.quet && moc % 2 ? [...nots].reverse() : nots;
      thuTu.forEach((m, i) => this.not(hz(m + b.quangRai), t + i * (b.quet ?? 0), b.raiBe));
    }
    const g = b.giai[o]![moc]!;
    if (g) this.not(hz(g), t, b.giaiBe);
  }

  /** Một nốt: lên nhanh, tắt dần theo hàm mũ; hoạ âm cao tắt nhanh hơn (tiếng gõ). */
  private not(f: number, t: number, be: Be): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    try {
      for (const [boi, muc] of be.hoa) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        // Hoạ âm cao tắt nhanh hơn (tiếng gõ) — trừ hoạ âm gần 1 (dày tiếng pad)
        const dai = be.dai * (boi > 1.5 ? 0.35 : 1);
        const vao = be.vao ?? 0.012;
        osc.type = be.kieu;
        osc.frequency.value = f * boi;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(be.to * muc, t + vao);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dai, vao + 0.05));
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dai + 0.05);
      }
    } catch { /* context đóng giữa chừng */ }
  }
}

export const nhac = new NhacNen();
