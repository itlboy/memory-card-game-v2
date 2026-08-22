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

/** Âm lượng mặc định. Mọi tiếng trong file này dùng gain rất nhỏ (0,03–0,14)
 *  để chồng nhau không vỡ, nên nhân chung ở master. Chỉnh nhanh khi thử:
 *  gõ trong console `sfx.volume = 3`, hoặc mở app với `?vol=3`
 *  (giá trị được nhớ lại cho lần sau). */
const DEFAULT_VOLUME = 2.6;
/** Trần cao được vì đầu ra đi qua soft-clip: quá to thì tiếng "ấm" lại,
 *  không xé loa như clip cứng. */
const MAX_VOLUME = 8;
const VOLUME_KEY = 'mm.volume';

function initialVolume(): number {
  try {
    const q = Number(new URLSearchParams(location.search).get('vol'));
    if (Number.isFinite(q) && q > 0) {
      localStorage.setItem(VOLUME_KEY, String(q));
      return Math.min(MAX_VOLUME, q);
    }
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(saved) && saved > 0) return Math.min(MAX_VOLUME, saved);
  } catch { /* chế độ riêng tư */ }
  return DEFAULT_VOLUME;
}

/** Đường cong tanh cho WaveShaper: |x| nhỏ gần như giữ nguyên, càng gần biên
 *  càng bẹt dần về ±1 nên không bao giờ vượt ngưỡng và không sinh tiếng rè. */
function softClipCurve(steps = 1024, drive = 1.6): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(steps * 4));
  for (let i = 0; i < steps; i++) {
    const x = (i / (steps - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  private vol = initialVolume();

  /** 0–8. Ghi vào đây là đổi ngay và được nhớ cho lần mở sau. */
  get volume(): number { return this.vol; }
  set volume(v: number) {
    this.vol = Math.max(0, Math.min(MAX_VOLUME, v));
    if (this.master) this.master.gain.value = this.vol;
    try { localStorage.setItem(VOLUME_KEY, String(this.vol)); } catch { /* bỏ qua */ }
  }

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext =
          window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = this.vol;

        // Compressor MẶC ĐỊNH nén rất nặng (ngưỡng -24dB, tỉ lệ 12:1) nên đẩy
        // master lên bao nhiêu cũng bị bóp lại — đó là lý do tăng âm lượng mà
        // nghe không to thêm. Đặt tay: chỉ gom đỉnh, giữ nguyên độ động.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 3;
        comp.attack.value = 0.004;
        comp.release.value = 0.18;

        // Bù lại phần compressor đã nén — đây mới là chỗ làm tổng thể to lên
        const makeup = ctx.createGain();
        makeup.gain.value = 1.8;

        // Limiter chặn cứng đỉnh: WaveShaper chỉ nhận input trong [-1, 1] và
        // KẸP phần vượt (tức clip phẳng = đúng cái tiếng rè ta muốn tránh),
        // nên phải hạ đỉnh xuống dưới 1 TRƯỚC khi vào nó.
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -4;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        // Attack cực ngắn: tiếng nổ/chũm choẹ lên đỉnh trong ~1ms, chậm hơn là
        // đỉnh lọt qua trước khi limiter kịp kéo xuống
        limiter.attack.value = 0.001;
        limiter.release.value = 0.08;

        // Soft-clip (tanh) là chốt cuối: bẻ cong dần phần đỉnh còn lại nên
        // tiếng chỉ "ấm" lên chứ không xé.
        const shaper = ctx.createWaveShaper();
        shaper.curve = softClipCurve();
        shaper.oversample = '4x';

        // 0,85 chứ không phải 1: lọc nội suy của oversample '4x' làm sóng vọt
        // quá biên vài phần trăm, phải chừa chỗ cho phần vọt đó
        const out = ctx.createGain();
        out.gain.value = 0.8;

        master.connect(comp);
        comp.connect(makeup);
        makeup.connect(limiter);
        limiter.connect(shaper);
        shaper.connect(out);
        out.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => { /* chờ cử chỉ */ });
      return this.master ? this.ctx : null;
    } catch { return null; }
  }

  /** Bỏ hẳn AudioContext hiện tại để lần phát sau dựng cái mới. */
  private dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;      // buffer thuộc context cũ, không dùng lại được
    try { void ctx?.close(); } catch { /* đã đóng */ }
  }

  /** Gọi mỗi lần trang hiện lại. iOS treo AudioContext khi app xuống nền, và
   *  đôi khi giết hẳn: state vẫn báo 'running' nhưng currentTime đứng im và
   *  không ra tiếng nào. Trường hợp đó chỉ dựng context mới mới cứu được —
   *  resume() suông là lý do trước đây vẫn mất tiếng.
   *  Lưu ý: iOS chỉ cho resume trong cử chỉ người dùng, nên App còn gắn lại
   *  unlock() vào lần chạm kế tiếp; hai lớp này bù cho nhau. */
  resume(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'closed') { this.dispose(); return; }
    void ctx.resume().catch(() => { /* cần cử chỉ mới */ });
    // Đồng hồ của context phải chạy; đứng im nghĩa là nó đã chết
    const t0 = ctx.currentTime;
    setTimeout(() => {
      if (this.ctx !== ctx) return;
      if (ctx.state === 'closed' || (ctx.state === 'running' && ctx.currentTime === t0)) this.dispose();
    }, 350);
  }

  /** Gọi trong cử chỉ đầu tiên của người dùng — bắt buộc để iOS cho phát âm.
   *  Gọi lại được nhiều lần: sau khi quay lại app cần mở khoá lần nữa. */
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

  /** Fanfare thắng: kèn rải nhanh → chũm choẹ → hợp âm Đô trưởng chốt dày,
   *  có bass nâng và lớp lấp lánh cao ở đuôi cho ra chất "ăn mừng arcade". */
  win(): void {
    // Rải kèn C–E–G–C rồi vống lên D–G cao: câu nhạc có hướng đi lên rõ ràng
    [523, 659, 784, 1047, 1175, 1568].forEach((f, i) =>
      this.voice(f, { dur: 0.16, type: 'triangle', gain: 0.06, delay: i * 0.075, detune: 7 }));
    // Bass nâng cả hợp âm — thiếu nó fanfare nghe mỏng như tiếng điện thoại
    this.voice(131, { dur: 0.9, type: 'sawtooth', gain: 0.045, delay: 0.44 });
    this.voice(262, { dur: 0.9, type: 'triangle', gain: 0.035, delay: 0.44 });
    this.noise(0.6, { freq: 5000, gain: 0.05, delay: 0.42 });                 // chũm choẹ
    // Hợp âm chốt ngân dài
    [523, 659, 784, 1047].forEach((f) =>
      this.voice(f, { dur: 1.1, type: 'triangle', gain: 0.032, delay: 0.46, detune: 8 }));
    // Lấp lánh: ba nốt cao rơi xuống như bụi sao
    [2637, 2093, 1568].forEach((f, i) =>
      this.voice(f, { dur: 0.4, type: 'sine', gain: 0.03, delay: 0.85 + i * 0.12, detune: 4 }));
  }

  /** Tiếng vỗ tay: chuỗi "clap" = noise bandpass ngắn, nhịp ngẫu nhiên dày dần rồi thưa. */
  applause(duration = 2.4): void {
    let t = 0.05;
    while (t < duration) {
      const fade = 1 - Math.max(0, (t - duration * 0.55) / (duration * 0.45));   // nhỏ dần về cuối
      this.noise(0.03 + Math.random() * 0.025, {
        freq: 1400 + Math.random() * 1400,
        type: 'bandpass',
        gain: (0.02 + Math.random() * 0.035) * Math.max(0.15, fade),
        delay: t
      });
      t += 0.03 + Math.random() * 0.07;   // 10–30 tiếng vỗ mỗi giây
    }
  }

  /** Một quả pháo hoa: rít bay lên → nổ trầm → lách tách. */
  /** `level` nhân vào biên độ: pháo hoa còn nổ tiếp sau khi bảng kết quả hiện
   *  lên, nhưng phải nhỏ hẳn để không lấn tiếng bấm nút của người chơi. */
  firework(delay = 0, level = 1): void {
    this.voice(380, { dur: 0.55, type: 'sine', gain: 0.02 * level, delay, slideTo: 1250 });   // rít
    this.noise(0.45, { freq: 160, type: 'lowpass', gain: 0.12 * level, delay: delay + 0.6 }); // nổ
    this.voice(90, { dur: 0.5, type: 'sine', gain: 0.06 * level, delay: delay + 0.6, slideTo: 34 });
    for (let i = 0; i < 9; i++) {                                                            // lách tách
      this.noise(0.03, { freq: 5200 + Math.random() * 2500, gain: 0.02 * level, delay: delay + 0.72 + i * 0.05 + Math.random() * 0.03 });
    }
  }

  /** Đại tiệc chiến thắng: fanfare + vỗ tay + 5 quả pháo hoa so le, khớp với
   *  5 giây hiệu ứng hình trước khi popup kết quả hiện ra. */
  victory(): void {
    this.win();
    this.applause(3.4);
    for (const t of [0.2, 0.85, 1.45, 2.2, 2.9]) this.firework(t);
  }

  /** Thua: câu nhạc buồn — giai điệu La thứ đi xuống trên nền hợp âm Rê thứ,
   *  nốt cuối tụt cao độ như tiếng thở dài. Dùng chung cho mọi kiểu thua. */
  lose(): void {
    // Giai điệu xuống dần: A–G–F–D, nốt sau nhẹ hơn nốt trước
    const melody: [number, number][] = [[440, 0], [392, 0.34], [349, 0.68], [294, 1.02]];
    for (const [freq, delay] of melody) {
      this.voice(freq, { dur: 0.42, type: 'triangle', gain: 0.05, delay, detune: 9 });
    }
    // Nền hợp âm Rê thứ ngân suốt câu — cái làm nó "buồn" chứ không chỉ "sai"
    for (const f of [147, 175, 220]) {
      this.voice(f, { dur: 1.9, type: 'sine', gain: 0.03, delay: 0.04 });
    }
    // Nốt chốt tụt xuống: tiếng thở dài
    this.voice(294, { dur: 0.9, type: 'triangle', gain: 0.045, delay: 1.42, slideTo: 196 });
    this.noise(0.7, { freq: 400, type: 'lowpass', gain: 0.035, delay: 1.5 });
  }

  /** Thua khi đấu online: buồn hơn thua một mình — thêm tiếng xì xào thất vọng
   *  và hai nốt tụt hẳn ở cuối, vì có người thắng ngay trước mắt mình. */
  defeat(): void {
    this.lose();
    // Xì xào của "khán giả" — nhiễu lọc thấp dập dềnh, vào sau giai điệu
    for (let i = 0; i < 7; i++) {
      this.noise(0.34 + Math.random() * 0.2, {
        freq: 500 + Math.random() * 400,
        type: 'lowpass',
        gain: 0.016 + Math.random() * 0.012,
        delay: 1.6 + i * 0.16 + Math.random() * 0.1
      });
    }
    // Hai nốt cuối trượt sâu — hết hy vọng
    this.voice(233, { dur: 1.0, type: 'triangle', gain: 0.04, delay: 2.3, slideTo: 147 });
    this.voice(117, { dur: 1.3, type: 'sine', gain: 0.045, delay: 2.5, slideTo: 82 });
  }

  /** Từng ngôi sao hiện ra trong dialog kết quả. */
  star(n: number): void {
    this.voice(1047 * Math.pow(1.19, n), { dur: 0.22, type: 'sine', gain: 0.06, detune: 5 });
    this.noise(0.12, { freq: 6000, gain: 0.02, delay: 0.02 });
  }
}

export const sfx = new Sfx();
