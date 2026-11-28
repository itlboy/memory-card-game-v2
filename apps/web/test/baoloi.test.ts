import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { moBaoLoi } from '../../node-server/src/baoloi';

/** Báo lỗi trong app (28.11.2026): kiểm đầu vào, chống spam. Pool giả ghi lại câu INSERT. */
function taoPool() {
  const ghi: unknown[][] = [];
  return {
    ghi,
    pool: {
      async query() { return [[]]; },
      async execute(_sql: string, v: unknown[]) { ghi.push(v); return [{ insertId: ghi.length }]; }
    }
  };
}
function goi(bl: Awaited<ReturnType<typeof moBaoLoi>>, than: unknown, ip = '1.1.1.1'): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((xong) => {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(than))]), { method: 'POST', headers: { 'cf-connecting-ip': ip }, socket: {} }) as never;
    bl!.xuLy(req, {} as never, new URL('https://x/api/baoloi'), (_r, body, status = 200) => xong({ status, body: body as Record<string, unknown> }));
  });
}
const may = { may: 'iPhone 15 Pro Max', heDieuHanh: 'iOS', banHdh: '18.1', manHinh: '430x932', 'khoa lạ!': 'x', loiJs: 'TypeError: a' };

describe('POST /api/baoloi', () => {
  it('thư hợp lệ: ghi đúng cột, bỏ chip lạ, bỏ email sai, giữ thông tin máy hợp lệ', async () => {
    const { pool, ghi } = taoPool();
    const bl = await moBaoLoi(pool as never);
    const r = await goi(bl, { loai: 'loi', noi: 'online', vanDe: ['matKetNoi', 'hack', 'matKetNoi'], noiDung: '  rớt mạng\u0007 giữa ván ', email: 'không-phải-email', may, cid: 'abc' });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    const [, kind, place, issues, body, email, device] = ghi[0] as string[];
    expect([kind, place, issues, body, email]).toEqual(['loi', 'online', 'matKetNoi', 'rớt mạng giữa ván', null]);
    expect(JSON.parse(device)).toMatchObject({ may: 'iPhone 15 Pro Max', banHdh: '18.1' });
    expect(JSON.parse(device)['khoa lạ!']).toBeUndefined();
  });

  it('chặn: loại / nơi lạ, thư trống (lỗi không chip không chữ), ảnh quá lớn', async () => {
    const { pool } = taoPool();
    const bl = await moBaoLoi(pool as never);
    expect((await goi(bl, { loai: 'spam', noi: 'online', vanDe: ['dung'] }, '2.2.2.1')).status).toBe(400);
    expect((await goi(bl, { loai: 'loi', noi: 'trangChu', vanDe: ['dung'] }, '2.2.2.2')).status).toBe(400);
    expect((await goi(bl, { loai: 'loi', noi: 'online', vanDe: [] }, '2.2.2.3')).status).toBe(400);
    const anhTo = 'data:image/jpeg;base64,' + Buffer.alloc(900 * 1024, 1).toString('base64');
    expect((await goi(bl, { loai: 'loi', noi: 'online', vanDe: ['dung'], anh: anhTo }, '2.2.2.4')).status).toBe(413);
  });

  it('chống spam: thư thứ 6 trong một giờ từ cùng IP → 429', async () => {
    const { pool } = taoPool();
    const bl = await moBaoLoi(pool as never);
    for (let i = 0; i < 5; i++) expect((await goi(bl, { loai: 'gopy', noi: 'khac', vanDe: ['giaoDien'] }, '3.3.3.3')).status).toBe(200);
    expect((await goi(bl, { loai: 'gopy', noi: 'khac', vanDe: ['giaoDien'] }, '3.3.3.3')).status).toBe(429);
    expect((await goi(bl, { loai: 'gopy', noi: 'khac', vanDe: ['giaoDien'] }, '4.4.4.4')).status).toBe(200);
  });

  it('không có MySQL → tắt (null)', async () => { expect(await moBaoLoi(null)).toBeNull(); });
});
