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
/**
 * Khoảng chờ trước khi phát tiếng bấm mặc định (ms), tính TỪ LÚC `click`.
 *
 * Bản cũ đếm 90ms từ `pointerdown` — giữ tay quá 90ms (thường gặp trên điện thoại,
 * nhất là nút thạch lún xuống khi nhấn) là tiếng mặc định kêu TRƯỚC, rồi lúc nhả tay
 * handler `click` phát tiếng riêng của nút → hai tiếng (chủ dự án báo 18.10.2026, nút
 * "Chơi nhanh"). Nay quyết sau `click`: handler đồng bộ đã chạy xong, 40ms chỉ để đón
 * tiếng riêng phát trễ (sau một `await` ngắn).
 */
const CHO_MS = 40;

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
  /** Mốc (performance.now) lần CUỐI có tiếng thật được xếp lịch. Tiếng bấm mặc
   *  định đọc con số này để biết nút vừa bấm có tự phát tiếng riêng hay không. */
  private mocPhat = -1;

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
  /**
   * Đường ra cho NHẠC NỀN (lib/nhac.ts): context + nút master, để nhạc đi chung
   * chuỗi compressor/limiter và theo đúng mức âm lượng. KHÔNG đụng `mocPhat` —
   * mốc đó để `clickMacDinh` biết nút vừa bấm đã tự kêu chưa; nhạc mà nhích nó
   * là mọi nút bấm trong lúc có nhạc đều câm.
   */
  duongRa(): { ctx: AudioContext; dich: AudioNode } | null {
    if (!this.enabled) return null;
    const ctx = this.ac();
    return ctx && this.master ? { ctx, dich: this.master } : null;
  }

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
    this.verifyAlive(ctx);
  }

  /**
   * Kiểm context có SỐNG THẬT không, chết thì bỏ để lần sau dựng cái mới.
   *
   * Vì sao phải kiểm bằng đồng hồ: iOS đôi khi giết context nhưng `state` vẫn
   * báo 'running' và `resume()` vẫn resolve như thường — chỉ có `currentTime`
   * đứng im. Không có phép kiểm này thì người chơi chạm mãi mà vẫn im lặng, và
   * không có gì tự phục hồi.
   */
  private verifyAlive(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    setTimeout(() => {
      if (this.ctx !== ctx) return;
      const stuck = ctx.state === 'running' && ctx.currentTime === t0;
      // 'suspended' sau khi đã cố resume trong một cử chỉ cũng là chết: iOS
      // không bao giờ cho nó chạy lại nữa
      if (ctx.state === 'closed' || stuck || ctx.state === 'suspended') this.dispose();
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
    // Mở khoá xong PHẢI kiểm lại. Thiếu bước này là lỗ hổng đã gây "thỉnh
    // thoảng iPhone mất tiếng mà không rõ vì sao": cử chỉ gọi resume() thành
    // công trên giấy tờ, context vẫn chết, và không còn gì phát hiện ra.
    this.verifyAlive(ctx);
  }

  /** Một nốt nhạc với envelope mềm; detune tạo cảm giác "dày" hai lớp. */
  private voice(freq: number, o: VoiceOpts = {}): void {
    if (!this.enabled) return;
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    this.mocPhat = performance.now();
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
  private noise(dur: number, opts: { freq?: number; type?: BiquadFilterType; gain?: number; delay?: number; q?: number } = {}): void {
    if (!this.enabled) return;
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    this.mocPhat = performance.now();
    try {
      const { freq = 2400, type = 'highpass', gain = 0.05, delay = 0, q } = opts;
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
      // Q hẹp = tiếng đục, mềm; Q rộng = sáng và sắc. Tiếng chia bài cần đục.
      if (q !== undefined) filter.Q.value = q;
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

  /** Tráo hai thẻ: hai tiếng giấy trượt qua nhau, cao rồi thấp — nghe ra "đổi
   *  chỗ" chứ không phải một tiếng bấm đơn lẻ. */
  swap(): void {
    this.noise(0.09, { freq: 3200, gain: 0.05 });
    this.noise(0.09, { freq: 1800, gain: 0.05, delay: 0.11 });
    this.voice(880, { dur: 0.07, type: 'triangle', gain: 0.035 });
    this.voice(660, { dur: 0.09, type: 'triangle', gain: 0.035, delay: 0.11 });
  }

  /** Có người bấm sẵn sàng — hai nốt đi LÊN, nghe ra "xong rồi". */
  ready(): void {
    this.voice(660, { dur: 0.08, type: 'triangle', gain: 0.05 });
    this.voice(990, { dur: 0.12, type: 'triangle', gain: 0.045, delay: 0.08 });
  }

  /** Có người huỷ sẵn sàng — hai nốt đi XUỐNG, ngược chiều với ready(). */
  unready(): void {
    this.voice(660, { dur: 0.08, type: 'triangle', gain: 0.045 });
    this.voice(440, { dur: 0.12, type: 'triangle', gain: 0.04, delay: 0.08 });
  }

  /**
   * Tiếng bấm CHUNG cho mọi nút — CÙNG CHẤT với `select()` (hai nốt mềm đi lên,
   * triangle rồi sine), chỉ nhẹ hơn vì nó phát ở khắp nơi: nút thoát, đóng hộp
   * thoại, mũi tên quay lại.
   *
   * KHÔNG dùng dải nhiễu (`noise`) ở đây. Bản đầu là một nốt ngắn 45ms cộng một
   * vệt nhiễu 3200Hz — đó chính là tiếng "tạch" khô, và khi nó phát ở hơn 60 nút
   * thì nghe ra như bấm bàn phím cơ, khó chịu (chủ dự án báo). Tiếng của game
   * vốn là nốt nhạc mềm; tiếng bấm mặc định phải nằm trong cùng bộ đó.
   */
  click(): void {
    this.voice(700, { dur: 0.055, type: 'triangle', gain: 0.033 });
    this.voice(1050, { dur: 0.075, type: 'sine', gain: 0.026, delay: 0.04 });
  }

  /**
   * Tiếng bấm MẶC ĐỊNH: chỉ phát khi nút vừa bấm KHÔNG tự phát tiếng gì.
   *
   * Vì sao làm ở một chỗ thay vì gắn `sfx` vào từng nút: đã đếm được hơn 60 nút
   * trong app và số đó còn tăng, nên "gắn tay từng nút" nghĩa là mỗi nút mới
   * thêm sau này lại là một nút im lặng — đúng cái lỗi người chơi vừa báo (nút
   * thoát bàn không kêu gì). Ở đây nút nào cũng có tiếng theo mặc định.
   *
   * Cách tránh phát HAI tiếng: chờ `CHO_MS` rồi mới xét — nút có tiếng riêng
   * (lật thẻ, sẵn sàng, đổi âm lượng) đã kịp xếp lịch tiếng của nó trong khoảng
   * đó và `mocPhat` nhích lên, ta im. Không đảo lại thành "phát trước rồi huỷ":
   * WebAudio đã xếp lịch thì không rút lại được.
   */
  /** Mốc tiếng lúc NGÓN TAY CHẠM XUỐNG (pointerdown/keydown) — `clickMacDinh` so với mốc
   *  này nên tiếng riêng phát lúc chạm (vd. lá bài) cũng được tính là "nút đã tự kêu". */
  private mocCham: number | null = null;
  ghiMocCham(): void { this.mocCham = this.mocPhat; }

  /** Gọi ở `click` (sau khi nút đã xử lý cú bấm): nút chưa tự kêu thì kêu "tách". */
  clickMacDinh(): void {
    if (!this.enabled) return;
    const truoc = this.mocCham ?? this.mocPhat;
    this.mocCham = null;
    setTimeout(() => { if (this.mocPhat === truoc) this.click(); }, CHO_MS);
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

  /**
   * MẤT MỘT MẠNG — nặng hơn tiếng ghép sai hẳn một bậc, vì đây là mất mát thật
   * chứ không phải một nước hụt.
   *
   * Hai nhịp trầm rơi xuống như tiếng tim hụt, cộng một tiếng "rắc" khô: người
   * chơi đang nhìn bàn thẻ chứ không nhìn HUD, nên con số tim bớt đi một là thứ
   * gần như không ai để ý — âm thanh mới là cái kéo mắt họ lên.
   */
  lifeLost(): void {
    this.voice(320, { dur: 0.16, type: 'sine', gain: 0.075, slideTo: 180 });
    this.voice(240, { dur: 0.26, type: 'sine', gain: 0.06, slideTo: 110, delay: 0.14 });
    this.noise(0.16, { freq: 300, type: 'lowpass', gain: 0.08, delay: 0.02 });
  }

  /** Hồi lại một mạng: ngược chiều tiếng mất mạng — hai nhịp đi LÊN. */
  lifeGain(): void {
    this.voice(392, { dur: 0.14, type: 'triangle', gain: 0.05, slideTo: 523 });
    this.voice(523, { dur: 0.22, type: 'triangle', gain: 0.045, slideTo: 784, delay: 0.12 });
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

  /**
   * Đếm ngược vào ván: mỗi giây một nốt của gam ngũ cung ĐI LÊN, tới nốt cuối
   * thì `go()` giải quyết lên quãng tám. Nghe ra một câu nhạc ngắn có hướng —
   * biết ván sắp bắt đầu mà không bị giục.
   *
   * Vì sao không dùng `tick()`: sóng VUÔNG ở 1000Hz đầy hoạ âm bậc lẻ, đúng dải
   * tai người nhạy nhất (2–4kHz), nên nghe như tiếng báo lỗi lò vi sóng. Sóng
   * tam giác mềm hơn nhiều, cộng một nốt quãng tám rất nhẹ cho ra tiếng chuông.
   */
  countdown(secLeft: number): void {
    const SCALE = [523.25, 587.33, 659.25, 783.99, 880];   // C5 D5 E5 G5 A5
    const f = SCALE[Math.min(SCALE.length - 1, Math.max(0, 5 - secLeft))] ?? 523.25;
    this.voice(f, { dur: 0.26, type: 'triangle', gain: 0.05 });
    this.voice(f * 2, { dur: 0.14, type: 'sine', gain: 0.018, delay: 0.01 });
  }

  /**
   * Vào ván: hợp âm trưởng rải nhanh rồi đọng lại ở quãng tám — câu nhạc mà
   * `countdown()` dựng lên được giải quyết ở đây, nên nghe ra "bắt đầu!" chứ
   * không phải một tiếng bíp nữa.
   */
  go(): void {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this.voice(f, { dur: 0.5, type: 'triangle', gain: 0.045, delay: i * 0.055, detune: 6 });
    });
    this.voice(1046.5, { dur: 0.6, type: 'sine', gain: 0.035, delay: 0.165 });
    // Hơi gió rất nhẹ ở dưới cho hợp âm có thân, không để nó trơ trọi
    this.noise(0.22, { type: 'bandpass', q: 0.9, freq: 420, gain: 0.02 });
  }

  /** Chuyển lượt: "ding-dong" hai nốt gọi sự chú ý. */
  turn(): void {
    this.voice(784, { dur: 0.12, type: 'triangle', gain: 0.05 });
    this.voice(988, { dur: 0.2, type: 'triangle', gain: 0.05, delay: 0.11 });
  }

  unlockTheme(): void {
    [660, 830, 990].forEach((f) => this.voice(f, { dur: 0.35, gain: 0.03 }));
  }

  /*
   * TIẾNG KẾT VÁN — bộ mới theo mockup đã duyệt 11.10.2026
   * (https://claude.ai/artifact/YQ6amnuWjzsHQeisNB1iC4). Mốc thời gian khớp
   * với cảnh hình ở `lib/ketcuc-fx.ts`: chữ CHIẾN THẮNG đập ở ~0,35s.
   */

  /** HOÀ: hai nốt vang cùng lúc thành quãng năm đúng (cân bằng, không buồn
   *  không vui) đúng lúc hai nửa màn chạm nhau, rồi hợp âm trưởng nhẹ. */
  win(): void {
    this.voice(392, { dur: 0.9, type: 'triangle', gain: 0.05, delay: 0.55 });
    this.voice(587, { dur: 0.9, type: 'triangle', gain: 0.05, delay: 0.55 });
    [523, 659, 784].forEach((f) => this.voice(f, { dur: 1, type: 'sine', gain: 0.035, delay: 1.25 }));
  }

  /** Tiếng vỗ tay: chuỗi "clap" = noise bandpass ngắn, nhịp ngẫu nhiên dày dần rồi thưa. */
  applause(duration = 2.4, delay = 0): void {
    let t = 0.05;
    while (t < duration) {
      const fade = 1 - Math.max(0, (t - duration * 0.55) / (duration * 0.45));   // nhỏ dần về cuối
      this.noise(0.03 + Math.random() * 0.025, {
        freq: 1400 + Math.random() * 1400,
        type: 'bandpass',
        gain: (0.02 + Math.random() * 0.035) * Math.max(0.15, fade),
        delay: delay + t
      });
      t += 0.03 + Math.random() * 0.07;   // 10–30 tiếng vỗ mỗi giây
    }
  }

  /** Một quả pháo hoa: nổ trầm → lách tách. */
  firework(delay = 0, level = 1): void {
    this.noise(0.4, { freq: 140, type: 'lowpass', gain: 0.16 * level, delay });
    this.voice(90, { dur: 0.5, type: 'sine', gain: 0.06 * level, delay, slideTo: 34 });
    for (let i = 0; i < 8; i++) {
      this.noise(0.03, { freq: 5200 + Math.random() * 2500, gain: 0.02 * level, delay: delay + 0.1 + i * 0.04 + Math.random() * 0.03 });
    }
  }

  /** THẮNG: kèn ba nốt đi lên + hợp âm trưởng ngân dài đúng lúc chữ đập,
   *  chũm choẹ, hai tiếng "bụp" của hai ống pháo giấy, vỗ tay nền. */
  victory(): void {
    const T = 0.35;                                  // khớp lúc chữ CHIẾN THẮNG đập
    this.noise(0.5, { freq: 5000, gain: 0.06, delay: T });                         // chũm choẹ
    this.noise(0.25, { freq: 160, type: 'lowpass', gain: 0.2, delay: T + 0.02 });  // ống pháo trái
    this.noise(0.25, { freq: 160, type: 'lowpass', gain: 0.16, delay: T + 0.12 }); // ống pháo phải
    [523, 659, 784].forEach((f, i) => this.voice(f, { dur: 0.3, type: 'sawtooth', gain: 0.045, delay: T + i * 0.12 }));
    [523, 659, 784, 1047].forEach((f) => this.voice(f, { dur: 1.4, type: 'sawtooth', gain: 0.03, delay: T + 0.36 }));
    [262, 392].forEach((f) => this.voice(f, { dur: 1.4, type: 'triangle', gain: 0.055, delay: T + 0.36 }));
    this.applause(2, T + 0.15);
  }

  /** KỶ LỤC MỚI: ba quả pháo hoa trầm + hợp âm cao hơn một quãng, lúc băng
   *  vàng vắt ngang màn (~1,5s sau khi ván xong). */
  kyLuc(delay = 1.5): void {
    [0, 0.14, 0.28].forEach((t) => this.firework(delay + t));
    [784, 988, 1175, 1568].forEach((f) => this.voice(f, { dur: 1, type: 'triangle', gain: 0.035, delay: delay + 0.1 }));
  }

  /** THUA · MÈO KHÓC (18.10.2026): kèn buồn kiểu hài + tiếng "meo~" trượt xuống lúc mèo
   *  hiện (0,25s), bốn cú nấc khớp `fx-meo-nac` (0,8s + 0,5s/nhịp), giọt nước mắt "tách".
   *  Thua phải nghe VUI để còn muốn bấm Chơi lại. */
  meoKhoc(): void {
    this.trombone();
    this.voice(780, { dur: 0.7, type: 'triangle', gain: 0.05, delay: 0.25, slideTo: 420 });
    for (let k = 0; k < 4; k++) this.voice(560 - k * 20, { dur: 0.13, type: 'triangle', gain: 0.04, delay: 0.85 + k * 0.5, slideTo: 430 - k * 20 });
    [0.95, 1.45, 1.95, 2.45].forEach((t) => this.voice(1500, { dur: 0.08, type: 'sine', gain: 0.028, delay: t, slideTo: 700 }));
  }

  /** THẮNG: mèo cười "hí hí" — bốn cặp tiếng ríu khớp bốn nhịp `fx-meo-cuoi` (0,8s + 0,42s). */
  meoCuoi(): void {
    for (let k = 0; k < 4; k++) {
      const t = 0.85 + k * 0.42;
      this.voice(820 + k * 30, { dur: 0.11, type: 'triangle', gain: 0.045, delay: t, slideTo: 1250 + k * 30 });
      this.voice(900 + k * 30, { dur: 0.12, type: 'triangle', gain: 0.04, delay: t + 0.15, slideTo: 1350 + k * 30 });
    }
  }

  /** HOÀ: hai mèo "meo" một trầm một bổng + tiếng "cộp" mỗi lần cụng đầu (0,9s + 0,5s). */
  meoHoa(): void {
    for (let k = 0; k < 3; k++) {
      const t = 0.9 + k * 0.5;
      this.voice(600, { dur: 0.18, type: 'triangle', gain: 0.04, delay: t, slideTo: 900 });
      this.voice(760, { dur: 0.18, type: 'triangle', gain: 0.04, delay: t + 0.22, slideTo: 1100 });
      this.noise(0.08, { freq: 300, type: 'lowpass', gain: 0.1, delay: t + 0.25 });
    }
  }

  /** Kèn trombone buồn kiểu hài — phần GỐC chung của các biến thể thua có kèn. */
  private trombone(): void {
    [392, 370, 349].forEach((f, i) => this.voice(f, { dur: 0.3, type: 'sawtooth', gain: 0.05, delay: 0.1 + i * 0.32 }));
    for (let i = 0; i < 6; i++) {
      this.voice(i % 2 ? 318 : 334, { dur: 0.19, type: 'sawtooth', gain: 0.045, delay: 1.06 + i * 0.16, slideTo: i % 2 ? 334 : 318 });
    }
  }

  /** THẮNG · PHÁO HOA ĐÊM: sáu quả nổ khớp sáu chùm sáng trên trời (0,3s + 0,3s/quả). */
  phaoHoaDem(): void {
    for (let i = 0; i < 6; i++) this.firework(0.3 + i * 0.3, 0.75);
  }

  /** THẮNG · VƯƠNG MIỆN: tiếng chuông vàng lúc vương miện cắm xuống (1,0s), rồi mưa xu leng keng. */
  vuongMien(): void {
    [1568, 2093, 2637].forEach((f, i) => this.voice(f, { dur: 1.1 - i * 0.2, type: 'sine', gain: 0.05 - i * 0.012, delay: 1.0 }));
    this.voice(784, { dur: 0.8, type: 'triangle', gain: 0.04, delay: 1.0 });
    for (let t = 1.15; t < 2.6; t += 0.07 + Math.random() * 0.08) {
      this.voice(2400 + Math.random() * 900, { dur: 0.09, type: 'triangle', gain: 0.018, delay: t });
    }
  }

  /** THUA MÁY: máy cười "he he he" (ba nốt nảy đi xuống) rồi tiếng còi đồ
   *  chơi. Khác hẳn thua đồng hồ: có một đối thủ đang trêu mình. */
  defeat(): void {
    this.voice(659, { dur: 0.15, type: 'triangle', gain: 0.05 });                 // máy dọn cặp cuối
    [0, 1, 2].forEach((i) => {
      const f = 784 * 2 ** (-i * 2 / 12);
      this.voice(f, { dur: 0.1, type: 'square', gain: 0.04, delay: 0.85 + i * 0.16, slideTo: f * 0.8 });
    });
    this.voice(1319, { dur: 0.35, type: 'square', gain: 0.028, delay: 1.5, slideTo: 659 });
  }

  /** MỞ KHOÁ DANH HIỆU: chuỗi nốt đi lên, số nốt theo bậc. Bí mật mở bằng
   *  hợp âm thứ bí ẩn rồi giải về trưởng. */
  moKhoa(bac: 'dong' | 'bac' | 'vang' | 'bi-mat'): void {
    const goc = 523;
    const chuoi = { dong: [0, 4, 7], bac: [0, 4, 7, 12], vang: [0, 4, 7, 12, 16], 'bi-mat': [0, 3, 7, 12, 16] }[bac];
    const tre = bac === 'bi-mat' ? 0.55 : 0;
    if (bac === 'bi-mat') [262, 311, 392].forEach((f) => this.voice(f, { dur: 0.9, type: 'sine', gain: 0.04 }));
    chuoi.forEach((n, i) => this.voice(goc * 2 ** (n / 12), { dur: 0.5, type: 'triangle', gain: 0.06, delay: tre + i * 0.09 }));
    if (bac === 'vang' || bac === 'bi-mat') {
      for (let i = 0; i < 10; i++) this.voice(2093 * 2 ** (((i % 5) * 2) / 12), { dur: 0.2, type: 'sine', gain: 0.018, delay: 0.5 + i * 0.05 });
    }
  }

  /** "Đinh" nhỏ khi huy hiệu chạm viên 🏅 trên thanh trên. */
  dinh(): void {
    this.voice(2093, { dur: 0.25, type: 'sine', gain: 0.05 });
  }

  /** Từng ngôi sao hiện ra trong dialog kết quả. */
  star(n: number): void {
    this.voice(1047 * Math.pow(1.19, n), { dur: 0.22, type: 'sine', gain: 0.06, detune: 5 });
    this.noise(0.12, { freq: 6000, gain: 0.02, delay: 0.02 });
  }
}

export const sfx = new Sfx();
