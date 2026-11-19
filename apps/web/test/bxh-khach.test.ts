// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { store } from '@/lib/storage';

/**
 * BẢNG XẾP HẠNG CÓ KHÁCH (19.11.2026): người chưa đăng nhập cũng lên bảng chung và biết hạng mình.
 * Canh: mã khách ngẫu nhiên + bền, gửi TỔNG (không nhân đôi), không gửi khi đã đăng nhập / đã ẩn /
 * đã gộp vào tài khoản; server chỉ giữ băm của mã và không cho điểm nhảy vọt.
 */

const goc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('client: khách trên bảng', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('mã khách: ngẫu nhiên, đủ dài cho server, sinh một lần rồi giữ nguyên', () => {
    expect(store.khach(false)).toBeNull();
    const a = store.khach()!.id;
    expect(a).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
    expect(store.khach()!.id).toBe(a);
    expect(a).not.toBe(store.clientId());
  });

  it('chưa chơi ván nào thì không gửi gì; có điểm thì gửi tổng + tên + số ván', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    await tk.guiKhach();
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach'))).toBe(false);

    store.addScore(500);
    store.ghiVanBoDem({ thang: true });
    store.savePlayerNames(['Bông']);
    await tk.ghiVan({ ketQua: 'thang', score: 500 });
    await new Promise((r) => setTimeout(r, 0));
    const gui = f.mock.calls.find(([u]) => String(u).endsWith('/api/khach'));
    expect(gui).toBeTruthy();
    const than = JSON.parse(String((gui![1] as RequestInit).body));
    expect(than).toMatchObject({ id: store.khach(false)!.id, name: 'Bông', totalScore: 500, wins: 1, matches: 1 });
  });

  it('đã ẩn khỏi bảng thì thôi gửi; bảng xếp hạng không mang mã khách', async () => {
    const f = vi.fn(async (u: string) => u.endsWith('/api/auth/config') ? json({ googleClientId: 'x' }) : json({ ok: true, top: [] }));
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    store.addScore(100);
    store.khach();
    await tk.anKhach(true);
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach/xoa'))).toBe(true);
    f.mockClear();
    await tk.bangXepHang();
    expect(f.mock.calls.some(([u]) => String(u).endsWith('/api/khach'))).toBe(false);
    const bxh = f.mock.calls.find(([u]) => String(u).endsWith('/api/bxh'))!;
    expect(JSON.parse(String((bxh[1] as RequestInit).body)).khach).toBeUndefined();
  });

  it('đồng bộ tài khoản mang mã khách lên để server gộp, rồi máy thôi lên bảng dạng khách', () => {
    const src = goc('src/lib/taikhoan.ts');
    expect(src).toMatch(/khach: store\.khach\(false\)\?\.id/);
    expect(src).toMatch(/ganKhach\(\{ daGop: true \}\)/);
  });

  it('viên đồng xu là NÚT mở bảng xếp hạng', () => {
    expect(goc('src/components/TopBar.vue')).toMatch(/<button class="total thach"[\s\S]{0,300}@click="emit\('xep-hang'\)"/);
    expect(goc('src/App.vue')).toMatch(/@xep-hang="showBxh = true"/);
  });
});

describe('server Node: khách', () => {
  it('maKhach: chỉ nhận mã đúng dạng, lưu BĂM (không lưu mã gốc)', async () => {
    const { maKhach } = await import('../../node-server/src/taikhoan');
    expect(maKhach('ngắn')).toBeNull();
    expect(maKhach(42)).toBeNull();
    expect(maKhach("x'; DROP TABLE khach; --".padEnd(30, 'x'))).toBeNull();
    const id = 'AbCdEfGhIjKlMnOpQrStUvWx';
    expect(maKhach(id)).toMatch(/^[0-9a-f]{64}$/);
    expect(maKhach(id)).not.toContain(id);
  });

  it('locTen: bỏ ký tự điều khiển và <>, cắt 16 ký tự', async () => {
    const { locTen } = await import('../../node-server/src/taikhoan');
    expect(locTen('  <b>Bông</b>\n ')).toBe('bBông/b');
    expect(locTen('a'.repeat(30))).toHaveLength(16);
    expect(locTen(null)).toBe('');
  });

  it('locDiemKhach: không bao giờ giảm, không nhảy vọt quá số ván chơi được trong khoảng đó', async () => {
    const { locDiemKhach } = await import('../../node-server/src/taikhoan');
    // Lần đầu: nhận cả lịch sử của máy (tới trần)
    expect(locDiemKhach({ totalScore: 250_000, wins: 40, matches: 10 }, null, 0)).toEqual({ total: 250_000, wins: 40, matches: 40 });
    const cu = { total: 1000, wins: 2, matches: 5, updatedAt: 0 };
    // Gửi lại số cũ / nhỏ hơn → giữ nguyên
    expect(locDiemKhach({ totalScore: 10, wins: 0, matches: 0 }, cu, 1000)).toEqual({ total: 1000, wins: 2, matches: 5 });
    // Ngay sau đó (1 ván) tăng 9 triệu → bị chặn ở một ván tối đa
    const r = locDiemKhach({ totalScore: 9_000_000, wins: 99, matches: 99 }, cu, 1000);
    expect(r.total).toBe(1000 + 100_000);
    expect(r.wins).toBe(3);
    // Tăng bình thường thì nhận đủ
    expect(locDiemKhach({ totalScore: 1800, wins: 3, matches: 6 }, cu, 60_000)).toEqual({ total: 1800, wins: 3, matches: 6 });
  });

  it('bảng xếp hạng nhận mã khách trong THÂN POST, không qua URL', () => {
    const src = goc('../node-server/src/taikhoan.ts');
    expect(src).toMatch(/p === '\/api\/bxh' && \(req\.method === 'GET' \|\| req\.method === 'POST'\)/);
    expect(src).not.toMatch(/searchParams\.get\('khach'\)/);
  });
});
