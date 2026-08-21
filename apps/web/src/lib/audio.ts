/** Hiệu ứng âm thanh tổng hợp bằng WebAudio — không cần tải file, tắt được (NF-05). */
class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  private tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.06): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const { ctx } = this;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* trình duyệt chặn audio */ }
  }

  private melody(notes: number[], step = 110, dur = 0.18): void {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, dur), i * step));
  }

  flip(): void { this.tone(520, 0.08, 'triangle'); }
  match(): void { this.tone(660, 0.1); setTimeout(() => this.tone(880, 0.14), 90); }
  miss(): void { this.tone(200, 0.16, 'sawtooth', 0.04); }
  power(): void { this.melody([880, 1180], 70, 0.1); }
  bomb(): void { this.tone(90, 0.35, 'sawtooth', 0.07); }
  win(): void { this.melody([523, 659, 784, 1047]); }
  lose(): void { [400, 330, 260].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.05), i * 140)); }
  turn(): void { this.tone(700, 0.07, 'square', 0.03); }
}

export const sfx = new Sfx();
