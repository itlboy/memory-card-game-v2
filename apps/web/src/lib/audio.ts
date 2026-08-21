/**
 * Hiệu ứng âm thanh tổng hợp bằng WebAudio — không cần tải file, tắt được (NF-05).
 *
 * Mobile (đặc biệt iOS/Safari) chỉ cho phát âm sau một cử chỉ của người dùng:
 * App gọi `sfx.unlock()` ở pointerdown/keydown đầu tiên để mở khoá AudioContext.
 * Lưu ý: iPhone gạt sang chế độ im lặng (mute switch) thì WebAudio cũng bị tắt —
 * đó là hành vi của hệ điều hành, không xử lý được từ web.
 *
 * Mọi tiếng đều đi qua master gain + compressor để nhiều nốt chồng nhau không vỡ.
 */

interface VoiceOpts {
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** Lệch tần số (cent) — hai dao động lệch nhau nghe "dày" hơn một. */
  detune?: number;
  /** Trượt cao độ tới tần số này trong suốt thời lượng nốt. */
  slideTo?: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const comp = ctx.createDynamicsCompressor();
        const master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(comp);
        comp.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.master ? this.ctx : null;
    } catch { return null; }
  }

  /** Gọi trong cử chỉ đầu tiên của người dùng — bắt buộc để iOS cho phát âm. */
  unlock(): void {
    const ctx = this.ac();
    if (!ctx) return;
    try {
      // Phát một mẫu câm để iOS "ghi nhận" audio đã được người dùng cho phép
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* bỏ qua */ }
  }

  /** Một nốt nhạc với envelope mềm; detune tạo cảm giác "dày" hai lớp. */
  private voice(freq: number, o: VoiceOpts = {}): void {
    if (!this.enabled) return;
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    try {
      const { dur = 0.12, type = 'sine', gain = 0.06, delay = 0, detune = 0, slideTo } = o;
      const t0 = ctx.currentTime + delay;
      for (const cents of detune ? [-detune, detune] : [0]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        osc.detune.value = cents;
        const amp = detune ? gain / 2 : gain;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(amp, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      }
    } catch { /* audio bị chặn */ }
  }

  /** Tiếng "gió/giấy" từ nhiễu trắng qua lọc — cho lật thẻ, chia bài, nổ. */
  private noise(dur: number, opts: { freq?: number; type?: BiquadFilterType; gain?: number; delay?: number } = {}): void {
    if (!this.enabled) return;
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    try {
      const { freq = 2400, type = 'highpass', gain = 0.05, delay = 0 } = opts;
      if (!this.noiseBuf) {
        const len = Math.floor(ctx.sampleRate * 0.5);
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      const t0 = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch { /* bỏ qua */ }
  }

  /* ---------- bộ tiếng của game ---------- */

  /** Lật thẻ: tiếng giấy "phật" + tick gỗ nhẹ. */
  flip(): void {
    this.noise(0.07, { freq: 2800, gain: 0.06 });
    this.voice(640, { dur: 0.05, type: 'triangle', gain: 0.035 });
  }

  /** Chia bài đầu ván: chuỗi tiếng giấy so le theo số thẻ. */
  deal(cards: number): void {
    const n = Math.min(cards, 10);
    for (let i = 0; i < n; i++) {
      this.noise(0.05, { freq: 2200 + i * 120, gain: 0.03, delay: i * 0.035 });
    }
  }

  /** Chọn mục trong menu. */
  select(): void {
    this.voice(700, { dur: 0.06, type: 'triangle', gain: 0.045 });
    this.voice(1050, { dur: 0.08, type: 'sine', gain: 0.035, delay: 0.04 });
  }

  /** Ghép đúng — hợp âm dày leo cao theo combo, kèm "lấp lánh" ở đuôi. */
  match(streak = 1): void {
    const step = Math.min(streak - 1, 5);
    const base = 523 * Math.pow(1.122, step);
    this.voice(base, { dur: 0.1, type: 'triangle', gain: 0.06, detune: 7 });
    this.voice(base * 1.25, { dur: 0.13, type: 'triangle', gain: 0.055, delay: 0.07, detune: 7 });
    this.voice(base * 2, { dur: 0.16, type: 'sine', gain: 0.03, delay: 0.13 });        // lấp lánh
    if (streak >= 4) this.voice(base * 1.5, { dur: 0.2, type: 'sine', gain: 0.05, delay: 0.17 });
  }

  /** Ghép sai: trượt xuống + tiếng "bịch" trầm. */
  miss(): void {
    this.voice(300, { dur: 0.22, type: 'sawtooth', gain: 0.035, slideTo: 140 });
    this.noise(0.12, { freq: 240, type: 'lowpass', gain: 0.07, delay: 0.02 });
  }

  power(): void {
    [660, 880, 1320].forEach((f, i) => this.voice(f, { dur: 0.09, type: 'square', gain: 0.03, delay: i * 0.05 }));
  }

  /** Bom: tiếng nổ nhiễu trầm + cao độ rơi tự do. */
  bomb(): void {
    this.noise(0.5, { freq: 420, type: 'lowpass', gain: 0.14 });
    this.voice(150, { dur: 0.5, type: 'sawtooth', gain: 0.07, slideTo: 35 });
  }

  /** Đóng băng: chuỗi chuông thuỷ tinh rơi dần. */
  freeze(): void {
    [2093, 1568, 1244].forEach((f, i) =>
      this.voice(f, { dur: 0.3, type: 'sine', gain: 0.035, delay: i * 0.09, detune: 5 }));
  }

  /** Đồng hồ sắp cạn — tick khô, gọi mỗi giây trong 10 giây cuối. */
  tick(): void { this.voice(1000, { dur: 0.035, type: 'square', gain: 0.028 }); }

  /** Chuyển lượt: "ding-dong" hai nốt gọi sự chú ý. */
  turn(): void {
    this.voice(784, { dur: 0.12, type: 'triangle', gain: 0.05 });
    this.voice(988, { dur: 0.2, type: 'triangle', gain: 0.05, delay: 0.11 });
  }

  unlockTheme(): void {
    [660, 830, 990].forEach((f) => this.voice(f, { dur: 0.35, gain: 0.03 }));
  }

  /** Fanfare thắng: rải hợp âm + chũm choẹ nhiễu + hợp âm chốt dày. */
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.voice(f, { dur: 0.18, type: 'triangle', gain: 0.055, delay: i * 0.09, detune: 6 }));
    this.noise(0.5, { freq: 5200, gain: 0.035, delay: 0.36 });
    [523, 659, 784, 1047].forEach((f) =>
      this.voice(f, { dur: 0.55, type: 'sine', gain: 0.028, delay: 0.42 }));
  }

  lose(): void {
    this.voice(392, { dur: 0.5, type: 'sawtooth', gain: 0.04, slideTo: 196 });
    this.noise(0.3, { freq: 300, type: 'lowpass', gain: 0.05, delay: 0.15 });
  }

  /** Từng ngôi sao hiện ra trong dialog kết quả. */
  star(n: number): void {
    this.voice(1047 * Math.pow(1.19, n), { dur: 0.22, type: 'sine', gain: 0.06, detune: 5 });
    this.noise(0.12, { freq: 6000, gain: 0.02, delay: 0.02 });
  }
}

export const sfx = new Sfx();
