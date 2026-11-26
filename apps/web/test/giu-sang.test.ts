import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 26.11.2026 — "đang xem ván màn hình hay bị tối": giữ sáng khi rời menu (lib/giu-sang.ts). */
let xin = 0;
let nha = 0;
let hienThi: DocumentVisibilityState = 'visible';
class KhoaGia {
  released = false;
  private f: (() => void) | null = null;
  addEventListener(_: string, f: () => void): void { this.f = f; }
  async release(): Promise<void> { if (this.released) return; this.released = true; nha++; this.f?.(); }
}
let khoaCuoi: KhoaGia | null = null;
const nap = async (): Promise<typeof import('@/lib/giu-sang')> => { vi.resetModules(); return import('@/lib/giu-sang'); };
const cho = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  xin = 0; nha = 0; hienThi = 'visible'; khoaCuoi = null;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hienThi });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true,
    value: { request: async () => { xin++; return (khoaCuoi = new KhoaGia()); } } });
});

describe('giữ màn hình sáng', () => {
  it('bật thì xin khoá, tắt thì nhả; gọi lặp không xin trùng', async () => {
    const { giuSang } = await nap();
    giuSang(true); await cho();
    giuSang(true); await cho();
    expect(xin).toBe(1);
    giuSang(false); await cho();
    expect(nha).toBe(1);
  });

  it('hệ điều hành nhả khoá khi app xuống nền → hiện lại phải XIN LẠI', async () => {
    const { giuSang } = await nap();
    giuSang(true); await cho();
    hienThi = 'hidden';
    await khoaCuoi!.release();           // OS tự nhả
    document.dispatchEvent(new Event('visibilitychange'));
    await cho();
    expect(xin, 'đang ẩn thì chưa xin').toBe(1);
    hienThi = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await cho();
    expect(xin).toBe(2);
  });

  it('đã về menu thì hiện lại KHÔNG xin nữa', async () => {
    const { giuSang } = await nap();
    giuSang(true); await cho();
    giuSang(false); await cho();
    document.dispatchEvent(new Event('visibilitychange'));
    await cho();
    expect(xin).toBe(1);
  });

  it('máy không có wakeLock hoặc bị từ chối thì im lặng bỏ qua', async () => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
    const a = await nap();
    expect(() => a.giuSang(true)).not.toThrow();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { throw new Error('NotAllowedError'); } } });
    const b = await nap();
    b.giuSang(true); await cho();
    b.giuSang(false);
  });
});
