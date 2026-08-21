/**
 * Hiệu ứng âm thanh tổng hợp bằng WebAudio — không cần tải file, tắt được (NF-05).
 * Mỗi nốt có envelope attack/release riêng để nghe tròn tiếng thay vì "bíp" khô.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }

  private tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.06, delay = 0): void {
    if (!this.enabled) return;
    const ctx = this.ac();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);        // attack ngắn
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);        // release
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio bị chặn hoặc node không hỗ trợ */ }
  }

  /** Hợp âm — nhiều nốt cùng lúc, âm lượng chia đều. */
  private chord(freqs: number[], dur: number, delay = 0, gain = 0.05): void {
    for (const f of freqs) this.tone(f, dur, 'sine', gain / Math.max(1, freqs.length - 1), delay);
  }

  flip(): void { this.tone(560, 0.07, 'triangle', 0.05); }

  /** Ghép đúng — cao độ leo theo chuỗi combo (streak 1 → 5+), nghe "đang thăng hoa". */
  match(streak = 1): void {
    const step = Math.min(streak - 1, 5);
    const base = 523 * Math.pow(1.122, step);       // mỗi bậc combo cao hơn một cung
    this.tone(base, 0.09, 'triangle', 0.055);
    this.tone(base * 1.25, 0.12, 'triangle', 0.055, 0.07);
    if (streak >= 4) this.tone(base * 1.5, 0.16, 'sine', 0.05, 0.14);   // combo trần: thêm nốt thứ ba
  }

  miss(): void {
    this.tone(220, 0.12, 'sawtooth', 0.035);
    this.tone(165, 0.18, 'sawtooth', 0.03, 0.09);
  }

  power(): void { this.tone(880, 0.08, 'square', 0.03); this.tone(1320, 0.14, 'sine', 0.05, 0.06); }
  bomb(): void { this.tone(82, 0.4, 'sawtooth', 0.08); this.tone(55, 0.5, 'square', 0.05, 0.05); }
  freeze(): void { this.tone(1560, 0.2, 'sine', 0.04); this.tone(1040, 0.3, 'sine', 0.035, 0.1); }

  /** Đồng hồ sắp cạn — tick khô, gọi mỗi giây trong 10 giây cuối. */
  tick(): void { this.tone(1000, 0.03, 'square', 0.025); }

  turn(): void { this.tone(700, 0.06, 'square', 0.028); }
  unlock(): void { this.chord([660, 830, 990], 0.35); }

  /** Fanfare thắng ván: rải hợp âm trưởng rồi chốt bằng hợp âm đầy. */
  win(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.055, i * 0.09));
    this.chord([523, 659, 784, 1047], 0.5, 0.32, 0.09);
  }

  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.04, i * 0.16));
  }

  /** Từng ngôi sao hiện ra trong dialog kết quả. */
  star(n: number): void { this.tone(1047 * Math.pow(1.19, n), 0.18, 'sine', 0.06); }
}

export const sfx = new Sfx();
