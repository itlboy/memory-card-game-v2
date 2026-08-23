import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AudioContext chết mà không báo — tình huống iOS hay gây ra khi người chơi rời
 * app rồi quay lại. Kiểm rằng app PHÁT HIỆN được và dựng context mới, thay vì
 * im lặng mãi.
 */
let created = 0;
let closed = 0;

/** Context giả: đóng băng được đồng hồ để mô phỏng context đã chết. */
class FakeCtx {
  state: 'running' | 'suspended' | 'closed' = 'running';
  frozen = false;
  private t = 0;
  constructor() { created++; }
  get currentTime(): number { return this.frozen ? this.t : (this.t += 0.05); }
  async resume(): Promise<void> { if (this.state !== 'closed') this.state = 'running'; }
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
  created = 0; closed = 0;
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
});
