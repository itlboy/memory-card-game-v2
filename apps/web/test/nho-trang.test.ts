import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 26.11.2026 — chủ dự án: "bấm cập nhật ở trang bất kỳ hay bị load về trang chủ… reload ngay trang
 * hiện tại là được mà". Áp gói OTA mở gói mới ở URL trần; `nhoTrang()` + `khoiPhucTrang()` (lib/appUrl)
 * đặt lại query để App dựng đúng màn đang đứng.
 */
const nap = async (): Promise<typeof import('@/lib/appUrl')> => { vi.resetModules(); return import('@/lib/appUrl'); };

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('cập nhật xong về đúng trang đang đứng', () => {
  it('nhớ query trước khi áp, lần nạp kế (URL trần) đặt lại TRƯỚC khi app đọc URL', async () => {
    const a = await nap();
    a.ghiQuery('room=123456');
    a.nhoTrang();
    history.replaceState(null, '', '/');          // WebView mở gói mới ở URL trần
    const b = await nap();                        // gói mới nạp module
    expect(location.search).toBe('?room=123456');
    expect(b.urlApp()).toBe('/?room=123456');
  });

  it('WebView nạp lại HAI lần liền (máy thật, 28.11.2026): lần hai vẫn về đúng trang', async () => {
    const a = await nap();
    a.ghiQuery('room=123456');
    a.nhoTrang();
    history.replaceState(null, '', '/');
    await nap();
    expect(location.search).toBe('?room=123456');
    history.replaceState(null, '', '/');
    await nap();
    expect(location.search).toBe('?room=123456');
  });

  it('quá 15 giây sau lần nạp đầu: lần mở sau KHÔNG bị kéo lại trang cũ', async () => {
    const a = await nap();
    a.ghiQuery('online=1');
    a.nhoTrang();
    history.replaceState(null, '', '/');
    vi.useFakeTimers({ toFake: ['Date'] });
    await nap();
    vi.setSystemTime(Date.now() + 16_000);
    history.replaceState(null, '', '/');
    await nap();
    vi.useRealTimers();
    expect(location.search).toBe('');
  });

  it('nhớ lúc BẤM rồi địa chỉ bị kéo về trang chủ trước khi áp gói: vẫn về đúng trang (28.11.2026)', async () => {
    const a = await nap();
    a.ghiQuery('w=nhanh');
    a.nhoTrang();                 // TopBar: lúc bấm "Cập nhật"
    a.ghiQuery(null);             // đóng menu kéo địa chỉ lùi về trang chủ
    a.nhoTrang();                 // lib/ota: lúc áp gói — KHÔNG được xoá dấu tốt
    history.replaceState(null, '', '/');
    await nap();
    expect(location.search).toBe('?w=nhanh');
  });

  it('nhớ cả menu / trang Cài đặt (không có địa chỉ)', async () => {
    const a = await nap();
    a.nhoMenu('cd');
    a.nhoTrang();
    const b = await nap();
    expect(b.menuKhoiPhuc).toBe('cd');
  });

  it('quá hạn (app bị tắt hẳn rồi mở lại sau) thì mở ở trang chủ', async () => {
    const a = await nap();
    a.ghiQuery('mua=1');
    a.nhoTrang();
    history.replaceState(null, '', '/');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await nap();
    expect(location.search).toBe('');
  });

  it('URL đã có query (link mời) thì URL thắng; đang ở trang chủ thì không nhớ gì', async () => {
    const a = await nap();
    a.ghiQuery('online=1');
    a.nhoTrang();
    history.replaceState(null, '', '/?room=654321');
    await nap();
    expect(location.search).toBe('?room=654321');

    const c = await nap();
    c.ghiQuery(null);
    c.nhoTrang();
    expect(localStorage.getItem('mm.otaTrang')).toBeNull();
  });

  it('dữ liệu lạ trong bộ nhớ không được đưa lên URL', async () => {
    localStorage.setItem('mm.otaTrang', JSON.stringify({ q: 'a=1#<script>', luc: Date.now() }));
    await nap();
    expect(location.search).toBe('');
  });

  it('lib/ota gọi nhoTrang() trước MỌI lần áp gói khi người chơi đang nhìn', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/ota.ts'), 'utf8');
    expect(src).toMatch(/async function apGoi[\s\S]{0,600}nhoTrang\(\);[\s\S]{0,300}CapacitorUpdater\.set/);
    expect(src).toMatch(/async function apOtaNgay[\s\S]{0,300}nhoTrang\(\);[\s\S]{0,60}CapacitorUpdater\.set/);
  });
});
