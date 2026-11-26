// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THẺ MÁY (26.11.2026): đăng xuất rồi máy vẫn gắn với tài khoản — bảng xếp hạng nhận ra dòng mình và
 * ván mới vẫn cộng vào tài khoản. Phiên bị bỏ, thẻ ở lại.
 */
const hoSo = { id: 1, name: 'Kiên', avatar: null, totalScore: 900, matches: 3, wins: 2, losses: 1, draws: 0, best: {}, achievements: [] };

describe('thẻ máy — client', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const dung = (van = 200) => {
    const goi: { url: string; auth?: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      goi.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      if (url.endsWith('/api/auth/google')) return Response.json({ token: 'tk-1', may: 'm1.9.x', me: hoSo });
      if (url.endsWith('/api/me/dongbo')) return Response.json({ me: hoSo, may: 'm1.9.y' });
      if (url.endsWith('/api/me/van')) return van === 200 ? Response.json({ me: hoSo }) : new Response('', { status: van });
      if (url.endsWith('/api/bxh')) return Response.json({ top: [] });
      return new Response('', { status: 404 });
    }));
    return goi;
  };

  it('đăng xuất: bỏ phiên, GIỮ thẻ; ván mới và bảng xếp hạng đi bằng thẻ, giao diện vẫn là đã đăng xuất', async () => {
    const goi = dung();
    const tk = await import('@/lib/taikhoan');
    await tk.dangNhap('cred');
    expect(localStorage.getItem('mm.auth.may')).toBe('m1.9.y');
    tk.dangXuat();
    expect(localStorage.getItem('mm.auth')).toBeNull();
    expect(tk.conTheMay.value).toBe(true);
    goi.length = 0;
    await tk.ghiVan({ ketQua: 'thang', score: 100 });
    await tk.bangXepHang();
    expect(goi.map((g) => g.url.replace(/^.*\/api/, '/api'))).toEqual(['/api/me/van', '/api/bxh']);
    expect(goi.every((g) => g.auth === 'Bearer m1.9.y')).toBe(true);
    expect(tk.me.value).toBeNull();
  });

  it('server từ chối thẻ ở đường ghi ván (tài khoản đã xoá) → bỏ thẻ, về khách', async () => {
    dung(401);
    localStorage.setItem('mm.auth.may', 'm1.9.cu');
    const tk = await import('@/lib/taikhoan');
    await tk.ghiVan({ ketQua: 'thua', score: 10 });
    expect(localStorage.getItem('mm.auth.may')).toBeNull();
    expect(tk.conTheMay.value).toBe(false);
  });

  it('xoá tài khoản thì thẻ đi theo', async () => {
    dung();
    const tk = await import('@/lib/taikhoan');
    await tk.dangNhap('cred');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })));
    await tk.xoaTaiKhoan();
    expect(localStorage.getItem('mm.auth.may')).toBeNull();
  });
});

describe('thẻ máy — server', () => {
  it('thẻ và phiên không đổi qua lại được; thẻ sửa uid / hết hạn bị loại', async () => {
    const { taoPhien, docPhien, taoTheMay, docTheMay, HAN_THE_MAY_MS } = await import('../../node-server/src/taikhoan');
    const the = taoTheMay('bi-mat', 42, 1000), phien = taoPhien('bi-mat', 42, 1000);
    expect(docTheMay('bi-mat', the, 2000)).toBe(42);
    expect(docPhien('bi-mat', the, 2000)).toBeNull();
    expect(docTheMay('bi-mat', phien, 2000)).toBeNull();
    expect(docTheMay('bi-mat', `m${phien}`, 2000)).toBeNull();   // chữ ký phiên không hợp với thẻ
    expect(docTheMay('bi-mat', the.replace('m42.', 'm43.'), 2000)).toBeNull();
    expect(docTheMay('khac', the, 2000)).toBeNull();
    expect(docTheMay('bi-mat', the, 1000 + HAN_THE_MAY_MS)).toBeNull();
  });

  it('thẻ chỉ mở bảng xếp hạng + ghi ván: mọi đường /api/me khác vẫn đòi phiên', async () => {
    const { readFileSync } = await import('node:fs');
    const sv = readFileSync('../node-server/src/taikhoan.ts', 'utf8');
    expect(sv).toContain("uidTu(req, now, p === '/api/me/van')");
    expect(sv.match(/uidTu\(req, now, true\)/g)?.length).toBe(3);   // cả ba chỗ đều trong /api/bxh
  });
});
