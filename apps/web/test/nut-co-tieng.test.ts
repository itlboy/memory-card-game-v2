import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MỌI NÚT PHẢI CÓ TIẾNG.
 *
 * Người chơi báo nút thoát bàn bấm mà im lặng — rà lại thì còn cả loạt nút khác
 * cùng cảnh. Chữa bằng một bộ bắt `pointerdown` ở PHA CAPTURE của document
 * (App.vue) chứ không gắn tay từng nút: gắn tay thì nút mới thêm sau này lại im.
 *
 * Ở đây kiểm hai nửa của cơ chế: tiếng mặc định có phát, và nút TỰ có tiếng
 * riêng thì không kêu hai lần.
 */
class FakeCtx {
  state = 'running' as const;
  private t = 0;
  get currentTime(): number { return (this.t += 0.05); }
  async resume(): Promise<void> {}
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
    return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      detune: { value: 0 }, connect() {}, start() {}, stop() {} };
  }
  createBiquadFilter(): unknown {
    return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {}, disconnect() {} };
  }
  get destination(): unknown { return {}; }
  get sampleRate(): number { return 48_000; }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeCtx);
  vi.useFakeTimers();
});

async function nap() {
  vi.resetModules();
  const { sfx } = await import('@/lib/audio');
  sfx.unlock();
  const oscs: number[] = [];
  const goc = (sfx as unknown as { voice: (f: number, o?: unknown) => void }).voice;
  (sfx as unknown as { voice: (f: number, o?: unknown) => void }).voice =
    function (f, o) { oscs.push(f); goc.call(this, f, o); };
  return { sfx, oscs };
}

describe('mọi nút đều có tiếng', () => {
  it('nút KHÔNG có tiếng riêng thì phát tiếng bấm mặc định', async () => {
    const { sfx, oscs } = await nap();
    sfx.clickMacDinh();
    expect(oscs.length, 'chưa hết khoảng chờ mà đã kêu').toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(oscs.length, 'nút im lặng — đúng lỗi người chơi báo').toBeGreaterThan(0);
  });

  it('nút CÓ tiếng riêng thì KHÔNG kêu hai lần', async () => {
    const { sfx, oscs } = await nap();
    sfx.clickMacDinh();
    sfx.ready();                       // tiếng riêng của nút, như handler click
    const sauTiengRieng = oscs.length;
    await vi.advanceTimersByTimeAsync(200);
    expect(oscs.length, 'kêu chồng lên tiếng riêng của nút').toBe(sauTiengRieng);
  });

  it('tắt tiếng thì im hẳn', async () => {
    const { sfx, oscs } = await nap();
    sfx.enabled = false;
    sfx.clickMacDinh();
    await vi.advanceTimersByTimeAsync(200);
    expect(oscs.length).toBe(0);
  });

  it('App.vue bắt ở PHA CAPTURE của document, không gắn tay từng nút', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
    expect(src, 'thiếu bộ bắt chung thì mỗi nút mới lại là một nút im lặng')
      .toMatch(/addEventListener\('pointerdown',\s*chamNut,\s*\{\s*capture:\s*true/);
    expect(src, 'phải phủ cả bàn phím (Enter/Space trên nút)').toContain("e.key === 'Enter'");
    // Nút bị vô hiệu hoá không được kêu — kêu là hứa hẹn một hành động không xảy ra.
    expect(src).toContain('el.disabled');
  });
});
