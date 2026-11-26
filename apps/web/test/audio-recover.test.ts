import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AudioContext chết mà không báo — tình huống iOS hay gây ra khi người chơi rời
 * app rồi quay lại. Kiểm rằng app PHÁT HIỆN được và dựng context mới, thay vì
 * im lặng mãi.
 */
let created = 0;
let closed = 0;
/** Context dựng mới cũng chết luôn (phiên âm thanh iOS chưa bật lại). */
let moiCungChet = false;

/** Context giả: đóng băng được đồng hồ để mô phỏng context đã chết. */
class FakeCtx {
  state: 'running' | 'suspended' | 'interrupted' | 'closed' = 'running';
  frozen = false;
  /** iOS treo context ở 'interrupted': resume() gọi ngoài cử chỉ không đưa về 'running'. */
  ket = false;
  private t = 0;
  constructor() { created++; if (moiCungChet) { this.state = 'interrupted'; this.ket = true; } }
  get currentTime(): number { return this.frozen ? this.t : (this.t += 0.05); }
  async resume(): Promise<void> { if (this.state !== 'closed' && !this.ket) this.state = 'running'; }
  async close(): Promise<void> { this.state = 'closed'; closed++; }
  createGain(): unknown {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
  }
  createDynamicsCompressor(): unknown {
    const p = (): unknown => ({ value: 0, setValueAtTime() {} });
    return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(),
      connect() {}, disconnect() {} };
  }
  createWaveShaper(): unknown { return { curve: null, oversample: '', connect() {}, disconnect() {} }; }
  createBuffer(): unknown { return { getChannelData: () => new Float32Array(8) }; }
  createBufferSource(): unknown { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createOscillator(): unknown {
    return { type: '', frequency: { value: 0, setValueAtTime() {} }, detune: { value: 0 },
      connect() {}, start() {}, stop() {} };
  }
  get destination(): unknown { return {}; }
}

beforeEach(() => {
  created = 0; closed = 0; moiCungChet = false;
  vi.stubGlobal('AudioContext', FakeCtx);
  vi.useFakeTimers();
});

describe('phục hồi âm thanh khi context chết', () => {
  it('context đứng đồng hồ thì bị bỏ, cử chỉ sau dựng context mới', async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.unlock();
    expect(created).toBe(1);

    // iOS giết context: state vẫn 'running' nhưng đồng hồ đứng im
    const ctx = (sfx as unknown as { ctx: FakeCtx }).ctx;
    ctx.frozen = true;

    sfx.resume();
    await vi.advanceTimersByTimeAsync(400);
    expect(closed, 'context chết phải bị đóng').toBe(1);

    sfx.unlock();                       // cử chỉ kế tiếp
    expect(created, 'phải dựng context mới').toBe(2);
  });

  it('unlock() cũng tự kiểm — không chỉ resume()', async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.unlock();
    const ctx = (sfx as unknown as { ctx: FakeCtx }).ctx;
    ctx.frozen = true;
    // KHÔNG gọi resume(), chỉ mở khoá như một cú chạm bình thường
    sfx.unlock();
    await vi.advanceTimersByTimeAsync(400);
    expect(closed, 'lỗ hổng cũ: mở khoá xong không ai kiểm lại').toBe(1);
  });

  it('context còn sống thì KHÔNG bị bỏ oan', async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.unlock();
    sfx.resume();
    await vi.advanceTimersByTimeAsync(400);
    expect(closed).toBe(0);
    expect(created).toBe(1);
  });

  /*
   * 26.11.2026 — chủ dự án: "thoát ra vào lại bị mất âm thanh, phải bấm vào màn hình mới có".
   * iOS để context ở 'interrupted' sau khi app xuống nền; bản cũ chỉ bỏ 'suspended' nên nó nằm
   * im tới lần chạm kế. Trong app (không cần cử chỉ) phải tự dựng cái mới.
   */
  const treo = (sfx: unknown): void => {
    const ctx = (sfx as { ctx: FakeCtx }).ctx;
    ctx.state = 'interrupted'; ctx.ket = true;
  };

  it("trong app: context kẹt 'interrupted' thì tự dựng cái mới, KHÔNG chờ chạm", async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.tuDungLai = true;
    sfx.unlock();
    treo(sfx);

    sfx.resume();                       // app hiện lại
    await vi.advanceTimersByTimeAsync(400);
    expect(closed, 'context kẹt phải bị bỏ').toBe(1);
    expect(created, 'phải có context mới mà không cần cử chỉ').toBe(2);
    expect((sfx as unknown as { ctx: FakeCtx }).ctx.state).toBe('running');

    await vi.advanceTimersByTimeAsync(2000);
    expect(created, 'cái mới sống thì không dựng thêm').toBe(2);
  });

  it('trong app: cái mới dựng sớm quá cũng chết thì thử lại, có giới hạn', async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.tuDungLai = true;
    sfx.unlock();
    treo(sfx);
    moiCungChet = true;

    sfx.resume();
    await vi.advanceTimersByTimeAsync(800);
    expect(created).toBeGreaterThan(2);
    moiCungChet = false;                // phiên âm thanh bật lại
    await vi.advanceTimersByTimeAsync(400);
    expect((sfx as unknown as { ctx: FakeCtx }).ctx.state).toBe('running');

    // Chết mãi thì cũng dừng, không dựng context vô hạn
    treo(sfx); moiCungChet = true;
    const truoc = created;
    sfx.resume();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(created - truoc).toBeLessThanOrEqual(4);
  });

  it('trong app: context đã bị bỏ từ trước thì lúc hiện lại dựng luôn', async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.tuDungLai = true;
    sfx.unlock();
    (sfx as unknown as { dispose(): void }).dispose();
    sfx.resume();
    expect(created).toBe(2);
  });

  it("trình duyệt: context 'interrupted' bị bỏ nhưng KHÔNG dựng ngoài cử chỉ", async () => {
    vi.resetModules();
    const { sfx } = await import('@/lib/audio');
    sfx.unlock();
    treo(sfx);
    sfx.resume();
    await vi.advanceTimersByTimeAsync(2000);
    expect(closed).toBe(1);
    expect(created, 'chờ lần chạm kế mới dựng').toBe(1);
    sfx.unlock();
    expect(created).toBe(2);
  });
});
