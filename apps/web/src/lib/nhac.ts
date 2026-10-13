import { sfx } from './audio';

/*
 * NHẠC NỀN — TỔNG HỢP bằng Web Audio, cùng cách với mọi tiếng khác của app (13.10.2026).
 *
 * Vì sao không dùng file mp3: (1) không có chuyện bản quyền — App Store từng gỡ
 * app vì nhạc không rõ nguồn; (2) không tải thêm byte nào, app vẫn offline;
 * (3) cùng chất âm với tiếng lật thẻ.
 *
 * Bản nhạc: vòng 8 ô nhịp C–G–Am–F, bass + rải hợp âm kiểu marimba + giai điệu
 * ngũ cung. Hai "tâm trạng": `menu` vui (104 bpm, đủ giai điệu) và `van` lúc
 * chơi — chậm, thưa, lọc tối hơn: game trí nhớ cần tập trung, nhạc chỉ là nền.
 *
 * Đi qua `sfx.duongRa()` (master chung) nên theo đúng mức âm lượng và tắt âm
 * thanh là tắt luôn nhạc. Lập lịch kiểu "nhìn trước" (lookahead): mỗi 50ms đặt
 * các nốt của 0,3 giây tới vào đồng hồ của AudioContext — setInterval trễ vài
 * chục ms cũng không làm lệch nhịp.
 */
export type TamTrang = 'menu' | 'van';

const HOP_AM: Record<string, { bass: number; ton: [number, number, number] }> = {
  C: { bass: 48, ton: [60, 64, 67] },
  G: { bass: 43, ton: [59, 62, 67] },
  Am: { bass: 45, ton: [60, 64, 69] },
  F: { bass: 41, ton: [60, 65, 69] },
};
const VONG = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'] as const;
/** Giai điệu: 8 móc đơn mỗi ô, 0 = nghỉ. Ngũ cung C nên chồng lên hợp âm nào cũng êm. */
const GIAI_DIEU: number[][] = [
  [76, 0, 79, 0, 81, 79, 76, 0],
  [74, 0, 79, 0, 74, 0, 71, 0],
  [72, 0, 76, 0, 81, 0, 79, 76],
  [77, 0, 76, 0, 72, 0, 0, 0],
  [76, 79, 84, 0, 81, 79, 76, 0],
  [79, 0, 74, 0, 79, 81, 79, 0],
  [81, 0, 79, 76, 72, 0, 76, 0],
  [77, 76, 74, 72, 0, 0, 0, 0],
];
const RAI = [0, 1, 2, 3, 2, 1, 0, 1];   // thứ tự rải hợp âm; 3 = nốt gốc lên quãng tám

const TAM_TRANG = {
  menu: { bpm: 104, bpmMax: 104, loc: 5200, rai: 0.032, bass: 0.07, giai: 0.042 },
  van: { bpm: 84, bpmMax: 124, loc: 2200, rai: 0.022, bass: 0.055, giai: 0.026 },
} as const;
const AM_LUONG = 0.55;

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
  /**
   * ĐỘ GẤP của ván, 0..1 (App đặt): tiến độ cặp đã ghép, hoặc 1 khi đồng hồ
   * gần hết. Tempo trong ván đi từ `bpm` lên `bpmMax` theo đường cong mũ 1,6 —
   * nửa đầu ván gần như không đổi, càng về cuối càng dồn (chủ dự án 13.10.2026).
   * Đổi tempo áp từ MÓC NHẠC kế tiếp nên chuyển mượt, không gãy nhịp.
   */
  gap = 0;
  /** Đã có cử chỉ người dùng chưa — trước đó đừng đụng tới AudioContext (iOS chặn). */
  daCham = false;

  /** Bật/đổi tâm trạng. Gọi lại nhiều lần là vô hại. */
  chay(tam: TamTrang): void {
    this.tamCho = tam;
    if (!this.hen) {
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
      loc.frequency.value = TAM_TRANG[this.tam].loc;
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
      const moc = this.buoc % 8;
      // Đổi tâm trạng ở ĐẦU ô nhịp cho khỏi gãy câu nhạc
      if (moc === 0 && this.tamCho !== this.tam) {
        this.tam = this.tamCho;
        this.loc?.frequency.setTargetAtTime(TAM_TRANG[this.tam].loc, this.lucToi, 0.3);
      }
      this.datNot(this.lucToi);
      this.lucToi += 60 / this.bpm() / 2;
      this.buoc = (this.buoc + 1) % (8 * VONG.length);
    }
  }

  private bpm(): number {
    const tt = TAM_TRANG[this.tam];
    if (this.tam !== 'van') return tt.bpm;
    return tt.bpm + (tt.bpmMax - tt.bpm) * Math.max(0, Math.min(1, this.gap)) ** 1.6;
  }

  private datNot(t: number): void {
    const o = Math.floor(this.buoc / 8), moc = this.buoc % 8;
    const tt = TAM_TRANG[this.tam];
    const ha = HOP_AM[VONG[o]!]!;
    const van = this.tam === 'van';

    // Bass: phách 1 và 3 (lúc chơi chỉ phách 1)
    if (moc === 0 || (!van && moc === 4)) this.not(hz(ha.bass), t, 0.55, 'triangle', tt.bass);
    // Rải hợp âm kiểu marimba (lúc chơi: thưa một nửa)
    if (!van || moc % 2 === 0) {
      const i = RAI[moc]!;
      const midi = i === 3 ? ha.ton[0] + 12 : ha.ton[i]!;
      this.not(hz(midi + 12), t, 0.32, 'sine', tt.rai, true);
    }
    // Giai điệu (lúc chơi: chỉ các ô chẵn, như một câu hỏi lơ lửng)
    const g = GIAI_DIEU[o]![moc]!;
    // Về cuối ván (gấp ≥ 0,7) giai điệu chơi đủ mọi ô — nhạc dày lên cùng nhịp tim
    if (g && (!van || o % 2 === 0 || this.gap >= 0.7)) this.not(hz(g), t, 0.45, 'triangle', tt.giai);
  }

  /** Một nốt: lên nhanh, tắt dần theo hàm mũ. `marimba` thêm hoạ âm bậc 4 cho tiếng gõ gỗ. */
  private not(f: number, t: number, dai: number, kieu: OscillatorType, to: number, marimba = false): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    try {
      for (const [boi, he] of marimba ? [[1, 1], [4, 0.18]] as const : [[1, 1]] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = kieu;
        osc.frequency.value = f * boi;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(to * he, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dai * (boi > 1 ? 0.35 : 1));
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dai + 0.05);
      }
    } catch { /* context đóng giữa chừng */ }
  }
}

export const nhac = new NhacNen();
