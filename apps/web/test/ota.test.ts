import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CẬP NHẬT NÓNG (OTA, 14.10.2026): app gói tự lấy gói web mới từ /ota/manifest.json.
 * Canh: báo sẵn sàng NGAY (không thì plugin quay về gói cũ), bỏ qua khi đã đúng gói /
 * app quá cũ / gói từng hỏng, và chỉ áp ở lần MỞ LẠI app (`kill`).
 */
const goi = { notifyAppReady: vi.fn(async () => ({})), list: vi.fn(), download: vi.fn(), next: vi.fn(async () => ({})), setMultiDelay: vi.fn(async () => {}), set: vi.fn(async () => {}) };
let manifest: Record<string, string> | null = null;
let banApp = '1.3.0';
vi.mock('@/lib/native', () => ({ laApp: true, nenApp: 'ios', SITE_URL: 'https://flipmatch.cozypi.com' }));
vi.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: goi }));
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { get: vi.fn(async () => ({ status: manifest ? 200 : 404, data: manifest })) } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: banApp, build: '130' }) } }));

beforeEach(() => {
  for (const f of Object.values(goi)) f.mockClear();
  goi.list.mockResolvedValue({ bundles: [] });
  goi.download.mockResolvedValue({ id: 'b1', version: 'moi', status: 'success' });
  banApp = '1.3.0';
});
const MOI = { id: 'moi', url: '/ota/moi.zip', sha256: 'abc', minNative: '1.3.0' };

describe('cập nhật nóng', () => {
  it('mở app ở TRANG CHỦ, tải kịp: báo "đang cập nhật" rồi áp NGAY', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.set).toHaveBeenCalledWith({ id: 'b1' });
    expect(goi.next).not.toHaveBeenCalled();
    expect(document.querySelector('.bao-thoat')?.textContent).toBeTruthy();
  });

  it('đang trong ván / wizard: KHÔNG áp ngay, hẹn lần mở sau', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/?playing=1');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.set).not.toHaveBeenCalled();
    expect(goi.setMultiDelay).toHaveBeenCalledWith({ delayConditions: [{ kind: 'kill' }] });
    history.replaceState(null, '', '/');
  });

  it('nhận ra trang chủ qua URL', async () => {
    const { oTrangChu } = await import('@/lib/ota');
    expect(oTrangChu('')).toBe(true);
    for (const q of ['?playing=1', '?room=123456', '?online=1', '?w=theme']) expect(oTrangChu(q), q).toBe(false);
  });

  it('có gói mới (không ở trang chủ): báo sẵn sàng, tải đúng url + checksum, hẹn áp khi MỞ LẠI app', async () => {
    manifest = MOI;
    history.replaceState(null, '', '/?w=theme');
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).toHaveBeenCalledWith({ url: 'https://flipmatch.cozypi.com/ota/moi.zip', version: 'moi', checksum: 'abc' });
    expect(goi.next).toHaveBeenCalledWith({ id: 'b1' });
    expect(goi.setMultiDelay).toHaveBeenCalledWith({ delayConditions: [{ kind: 'kill' }] });
    history.replaceState(null, '', '/');
  });

  it('đang chạy đúng gói trên server: không tải', async () => {
    manifest = { ...MOI, id: __OTA_ID__ };
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('app native cũ hơn minNative: không nhận gói (gói cần plugin app chưa có)', async () => {
    manifest = { ...MOI, minNative: '1.4.0' };
    banApp = '1.3.0';
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('gói này từng hỏng trên máy: không tải lại (khỏi vòng tải/hỏng)', async () => {
    manifest = MOI;
    goi.list.mockResolvedValue({ bundles: [{ id: 'x', version: 'moi', status: 'error' }] });
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('đã tải sẵn từ lần trước: dùng lại, không tải lần nữa', async () => {
    manifest = MOI;
    goi.list.mockResolvedValue({ bundles: [{ id: 'cu', version: 'moi', status: 'success' }] });
    const { kiemOta } = await import('@/lib/ota');
    await kiemOta();
    expect(goi.download).not.toHaveBeenCalled();
    expect(goi.set).toHaveBeenCalledWith({ id: 'cu' });
  });

  it('server chưa có /ota (404): vẫn báo sẵn sàng, không lỗi', async () => {
    manifest = null;
    const { kiemOta } = await import('@/lib/ota');
    await expect(kiemOta()).resolves.toBeUndefined();
    expect(goi.notifyAppReady).toHaveBeenCalled();
    expect(goi.download).not.toHaveBeenCalled();
  });

  it('so phiên bản theo số, không theo chữ (1.10 > 1.9)', async () => {
    const { soSanhBan } = await import('@/lib/ota');
    expect(soSanhBan('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(soSanhBan('1.3', '1.3.0')).toBe(0);
    expect(soSanhBan('1.2.9', '1.3.0')).toBeLessThan(0);
  });

  it('không gửi thống kê về Capgo, không tự cập nhật theo đám mây', () => {
    const cfg = readFileSync(resolve(process.cwd(), 'capacitor.config.ts'), 'utf8');
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*autoUpdate:\s*false/);
    expect(cfg).toMatch(/CapacitorUpdater:\s*\{[^}]*statsUrl:\s*''/);
  });

  it('service worker KHÔNG chặn /ota/ (không thì link zip ra trang game) và Node trả đúng kiểu zip', () => {
    const vite = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/navigateFallbackDenylist:[^\n]*\\\/ota\\\//);
    const node = readFileSync(resolve(process.cwd(), '../node-server/src/index.ts'), 'utf8');
    expect(node).toMatch(/'\.zip':\s*'application\/zip'/);
  });

  it('bản build web luôn đóng gói OTA (cả Docker lẫn pnpm release đi qua lệnh này)', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toContain('dong-goi-ota.mjs');
  });
});
