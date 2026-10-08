// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { store } from '@/lib/storage';

/**
 * TÀI KHOẢN LÀ LỚP PHỦ: không đăng nhập, hay server không có tài khoản (bản
 * Cloudflare), thì game chạy y như cũ. Test này canh đúng điều đó ở client, và
 * canh tầng server Node (đọc nguồn + gọi thẳng các hàm thuần của taikhoan.ts).
 */

const goc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('client: taikhoan.ts', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('server không có tài khoản (404) → san=false, không ném lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not found', { status: 404 })));
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect(tk.san.value).toBe(false);
    expect(tk.me.value).toBeNull();
  });

  it('mạng hỏng lúc dò → vẫn im lặng, san=false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const tk = await import('@/lib/taikhoan');
    await expect(tk.khoiDong()).resolves.toBeUndefined();
    expect(tk.san.value).toBe(false);
  });

  it('chưa đăng nhập thì ghiVan không gọi mạng', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const tk = await import('@/lib/taikhoan');
    await tk.ghiVan({ ketQua: 'thang', score: 100 });
    expect(f).not.toHaveBeenCalled();
  });

  it('đăng nhập: giữ phiên ở localStorage, đồng bộ bản lưu cục bộ, kéo điểm cao hơn về máy', async () => {
    store.addScore(500);
    store.unlockAchievements(['flawless']);
    const hoSo = {
      id: 1, name: 'Kiên', avatar: null, totalScore: 900, matches: 3, wins: 2, losses: 1, draws: 0,
      best: {}, achievements: ['flawless', 'combo-master']
    };
    const goi: { url: string; body?: unknown; auth?: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      goi.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: h?.Authorization });
      if (url.endsWith('/api/auth/google')) return Response.json({ token: 'tk-1', me: hoSo });
      if (url.endsWith('/api/me/dongbo')) return Response.json({ me: hoSo });
      return new Response('', { status: 404 });
    }));
    const tk = await import('@/lib/taikhoan');
    await tk.dangNhap('cred-abc');
    expect(localStorage.getItem(tk.AUTH_KEY)).toBe('tk-1');
    expect(tk.me.value?.name).toBe('Kiên');
    const db = goi.find((g) => g.url.endsWith('/api/me/dongbo'))!;
    expect(db.auth).toBe('Bearer tk-1');
    expect(db.body).toMatchObject({ totalScore: 500, achievements: ['flawless'] });
    // Tài khoản cao hơn máy: máy được NÂNG lên, không hạ
    expect(store.totalScore()).toBe(900);
    expect(store.achievements()).toContain('combo-master');
  });

  it('401 → về ẩn danh, xoá phiên', async () => {
    localStorage.setItem('mm.auth', 'cu');
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/api/auth/config') ? Response.json({ googleClientId: 'x' }) : new Response('', { status: 401 })));
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect(tk.san.value).toBe(true);
    expect(tk.me.value).toBeNull();
    expect(localStorage.getItem('mm.auth')).toBeNull();
  });

  it('khoá kỷ lục gửi lên trùng khoá của store.best() — server lọc theo đúng mẫu đó', () => {
    const storage = goc('src/lib/storage.ts');
    expect(storage).toMatch(/`\$\{mode\}:L\$\{level\}`/);
    const app = goc('src/App.vue');
    expect(app, 'App gửi boardKey đúng dạng mode:L<cấp>').toMatch(/boardKey: `\$\{game\.config\.mode\}:L\$\{id\}`/);
    const sv = goc('../node-server/src/taikhoan.ts');
    expect(sv).toMatch(/\^\[a-z\]\+:L\?\\d\{1,3\}\$/);
  });
});

describe('server Node: tầng tài khoản', () => {
  const node = goc('../node-server/src/index.ts');

  it('route tài khoản đứng TRƯỚC fallback tĩnh và cho phép header Authorization', () => {
    expect(node.indexOf('taiKhoan.xuLy')).toBeLessThan(node.indexOf('traFileTinh(url, res)'));
    expect(node).toMatch(/'Content-Type, Authorization'/);
  });

  it('không có MySQL hay GOOGLE_CLIENT_ID thì tầng tài khoản là null', async () => {
    const { moTaiKhoan } = await import('../../node-server/src/taikhoan');
    expect(await moTaiKhoan(null, { GOOGLE_CLIENT_ID: 'x' })).toBeNull();
    expect(await moTaiKhoan({} as never, {})).toBeNull();
  });

  it('phiên: ký và đọc lại đúng uid; hết hạn hay sửa chữ ký là null', async () => {
    const { taoPhien, docPhien, HAN_PHIEN_MS } = await import('../../node-server/src/taikhoan');
    const t = taoPhien('bi-mat', 42, 1000);
    expect(docPhien('bi-mat', t, 2000)).toBe(42);
    expect(docPhien('bi-mat', t, 1000 + HAN_PHIEN_MS)).toBeNull();
    expect(docPhien('khac', t, 2000)).toBeNull();
    expect(docPhien('bi-mat', t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a'), 2000)).toBeNull();
    expect(docPhien('bi-mat', undefined, 2000)).toBeNull();
  });

  it('locVan: chỉ nhận kết quả hợp lệ, cắt bỏ rác', async () => {
    const { locVan } = await import('../../node-server/src/taikhoan');
    expect(locVan(null)).toBeNull();
    expect(locVan({ ketQua: 'win', score: 1 })).toBeNull();
    expect(locVan({ ketQua: 'thang', score: 1e9 })).toBeNull();
    expect(locVan({ ketQua: 'thang', score: -1 })).toBeNull();
    expect(locVan({
      ketQua: 'thang', score: 120.4, boardKey: 'classic:L3', moves: 7, seconds: 12.6,
      achievements: ['flawless', 'DROP TABLE', 'x'.repeat(40)]
    })).toEqual({
      ketQua: 'thang', score: 120, boardKey: 'classic:L3', moves: 7, seconds: 13, achievements: ['flawless']
    });
    expect(locVan({ ketQua: 'hoa', score: 0, boardKey: '../etc' })).toEqual({ ketQua: 'hoa', score: 0 });
  });

  it('xác minh Google: sai aud hay hết hạn là từ chối', async () => {
    const { xacMinhGoogle } = await import('../../node-server/src/taikhoan');
    const cred = 'a'.repeat(40);
    const gia = (t: Record<string, string>) => (async () => Response.json(t)) as unknown as typeof fetch;
    const tot = { aud: 'cid', sub: '9', exp: '2000', name: 'An', email: 'an@x.vn', picture: 'p' };
    expect(await xacMinhGoogle(cred, 'cid', 1_000_000, gia(tot))).toMatchObject({ sub: '9', name: 'An' });
    expect(await xacMinhGoogle(cred, 'cid-khac', 1_000_000, gia(tot))).toBeNull();
    expect(await xacMinhGoogle(cred, 'cid', 3_000_000, gia(tot))).toBeNull();
    expect(await xacMinhGoogle('ngan', 'cid', 1_000_000, gia(tot))).toBeNull();
  });
});

describe('đồng bộ nhiều máy', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('mở app có phiên → đồng bộ ngay (không chỉ lúc đăng nhập), kéo điểm/kỷ lục máy kia về', async () => {
    localStorage.setItem('mm.auth', 'tk');
    store.addScore(100);
    const hoSo = {
      id: 1, name: 'A', avatar: null, totalScore: 2500, matches: 9, wins: 5, losses: 4, draws: 0,
      best: { 'classic:L3': { score: 700, moves: 4, seconds: 9 } }, achievements: ['board-36']
    };
    const goi: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      goi.push(url.replace(/^.*\/api/, '/api'));
      if (url.endsWith('/api/auth/config')) return Response.json({ googleClientId: 'x' });
      return Response.json({ me: hoSo });
    }));
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect(goi).toContain('/api/me/dongbo');
    expect(store.totalScore()).toBe(2500);
    expect(store.best('classic', 3)?.score).toBe(700);
    expect(store.achievements()).toContain('board-36');
  });

  it('quay lại tab → lamMoi kéo hồ sơ mới; ghiVan cũng kéo về', async () => {
    localStorage.setItem('mm.auth', 'tk');
    let tong = 100;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/auth/config')) return Response.json({ googleClientId: 'x' });
      return Response.json({ me: { id: 1, name: 'A', avatar: null, totalScore: tong, matches: 1, wins: 1, losses: 0, draws: 0, best: {}, achievements: [] } });
    }));
    const tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect(store.totalScore()).toBe(100);
    tong = 900;                       // máy kia vừa chơi
    await tk.lamMoi();
    expect(store.totalScore()).toBe(900);
    tong = 1300;
    await tk.ghiVan({ ketQua: 'thang', score: 50 });
    expect(store.totalScore()).toBe(1300);
  });
});
