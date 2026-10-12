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

  it('trên web: Google hiện khi server có Google; Apple chỉ hiện khi server khai Services ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ googleClientId: 'g', apple: { app: true } })));
    let tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect([tk.san.value, tk.coGoogle.value, tk.coApple.value]).toEqual([true, true, false]);
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ apple: { app: true, webClientId: 'svc' } })));
    tk = await import('@/lib/taikhoan');
    await tk.khoiDong();
    expect([tk.san.value, tk.coGoogle.value, tk.coApple.value]).toEqual([true, false, true]);
  });

  it('xoá tài khoản: DELETE /api/me rồi về ẩn danh, bản lưu trên máy giữ nguyên', async () => {
    store.addScore(300);
    localStorage.setItem('mm.auth', 'tk-1');
    const goi: { url: string; method?: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      goi.push({ url, method: init?.method });
      return Response.json({ ok: true });
    }));
    const tk = await import('@/lib/taikhoan');
    tk.me.value = { id: 1, name: 'A', avatar: null, totalScore: 0, matches: 0, wins: 0, losses: 0, draws: 0, best: {}, achievements: [] };
    await tk.xoaTaiKhoan();
    expect(goi.at(-1)).toEqual({ url: expect.stringMatching(/\/api\/me$/), method: 'DELETE' });
    expect(tk.me.value).toBeNull();
    expect(localStorage.getItem('mm.auth')).toBeNull();
    expect(store.totalScore()).toBe(300);
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

  it('CORS cho phép DELETE ở cả hai server (xoá tài khoản từ app capacitor://localhost)', () => {
    expect(node).toMatch(/Allow-Methods': 'GET, POST, DELETE, OPTIONS'/);
    expect(goc('../server/src/index.ts')).toMatch(/Allow-Methods': 'GET, POST, DELETE, OPTIONS'/);
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

  /*
   * APPLE: tự kiểm chữ ký RS256 (Apple không có tokeninfo). Ký token bằng một
   * cặp khoá tự sinh và đưa khoá công khai qua JWKS giả — nên kiểm được cả
   * chữ ký sai, aud sai, iss sai, hết hạn mà không cần tài khoản Apple.
   */
  it('xác minh Apple: chữ ký + iss + aud + exp', async () => {
    const { generateKeyPairSync, sign } = await import('node:crypto');
    const { xacMinhApple, _quenKhoaApple } = await import('../../node-server/src/taikhoan');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const ky = (than: Record<string, unknown>, kid = 'k1', khoa = privateKey) => {
      const hb = `${b64({ alg: 'RS256', kid })}.${b64(than)}`;
      return `${hb}.${sign('RSA-SHA256', Buffer.from(hb), khoa).toString('base64url')}`;
    };
    const jwks = vi.fn(async () => Response.json({ keys: [jwk] })) as unknown as typeof fetch;
    const tot = { iss: 'https://appleid.apple.com', aud: 'com.hello314.thebai', sub: '001.abc', exp: 2000, email: 'x@privaterelay.appleid.com' };
    const aud = ['com.hello314.thebai', 'com.hello314.thebai.web'];
    _quenKhoaApple();
    expect(await xacMinhApple(ky(tot), aud, 1_000_000, jwks)).toEqual({ sub: '001.abc', email: tot.email, aud: 'com.hello314.thebai' });
    expect(await xacMinhApple(ky({ ...tot, aud: 'com.hello314.thebai.web' }), aud, 1_000_000, jwks)).toMatchObject({ aud: 'com.hello314.thebai.web' });
    expect(await xacMinhApple(ky({ ...tot, aud: 'app.khac' }), aud, 1_000_000, jwks), 'aud lạ').toBeNull();
    expect(await xacMinhApple(ky({ ...tot, iss: 'https://evil' }), aud, 1_000_000, jwks), 'iss lạ').toBeNull();
    expect(await xacMinhApple(ky(tot), aud, 3_000_000, jwks), 'hết hạn').toBeNull();
    const khoaLa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    expect(await xacMinhApple(ky(tot, 'k1', khoaLa), aud, 1_000_000, jwks), 'chữ ký giả').toBeNull();
    expect(await xacMinhApple(ky(tot, 'k-moi'), aud, 1_000_000, jwks), 'kid không có trong JWKS').toBeNull();
    // sửa thân giữ nguyên chữ ký
    const [h, , c] = ky(tot).split('.');
    expect(await xacMinhApple(`${h}.${b64({ ...tot, sub: 'nguoi-khac' })}.${c}`, aud, 1_000_000, jwks)).toBeNull();
    expect(await xacMinhApple('rac', aud, 1_000_000, jwks)).toBeNull();
  });

  it('client_secret Apple: JWT ES256 kiểm lại được bằng khoá công khai', async () => {
    const { generateKeyPairSync, verify } = await import('node:crypto');
    const { taoClientSecretApple } = await import('../../node-server/src/taikhoan');
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    // .p8 dán vào biến môi trường hay bị biến xuống dòng thành "\n"
    for (const khoa of [pem, pem.replace(/\n/g, '\\n')]) {
      const jwt = taoClientSecretApple({ teamId: 'TEAM', keyId: 'KID', privateKey: khoa }, 'com.hello314.thebai', 1_000_000);
      const [h, b, c] = jwt.split('.') as [string, string, string];
      expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KID' });
      expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toMatchObject({ iss: 'TEAM', sub: 'com.hello314.thebai', aud: 'https://appleid.apple.com' });
      expect(verify('sha256', Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(c, 'base64url'))).toBe(true);
    }
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
