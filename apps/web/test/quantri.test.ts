import { describe, expect, it } from 'vitest';
import { moQuanTri } from '../../node-server/src/quantri';

/** API quản trị cụm (28.11.2026): khoá, chặn đoán khoá, KHÔNG lộ token. Pool + request giả, không cần MySQL. */
const KHOA = 'khoa-thu-quan-tri-32-ky-tu-abcdefgh';
const t = 1_800_000_000_000;
const pool = {
  async query(sql: string) {
    if (sql.includes('COUNT(*)')) return [[{ n: 2 }]];
    if (sql.includes('FROM rooms')) return [[
      { id: 1, code: '111111', status: 'lobby', is_public: 1, level: 6, opened_at: t - 60_000, empty_at: null },
      { id: 2, code: '222222', status: 'lobby', is_public: 0, level: 6, opened_at: t - 3_600_000, empty_at: t }
    ]];
    return [[
      { room_id: 1, name: 'An', bot_level: null, disconnected_at: null, last_seen: t, token: 'BI-MAT', client_id: 'MA-MAY-RIENG' },
      { room_id: 2, name: 'Bình', bot_level: null, disconnected_at: t - 3_000_000, last_seen: t - 3_000_000, token: 'BI-MAT' }
    ]];
  }
};
const qt = moQuanTri({ pool: pool as never, cum: () => null, khoa: KHOA, now: () => t, podNay: () => ({ pod: 'mot-pod', phong: 2, sanhKetNoi: 0 }) });

function goi(duong: string, khoa?: string, ip = '1.2.3.4'): Promise<{ status: number; body: unknown }> {
  return new Promise((xong) => {
    const req = { method: 'GET', headers: { ...(khoa ? { 'x-quantri-key': khoa } : {}), 'cf-connecting-ip': ip }, socket: {} } as never;
    const res = { setHeader() { /* bỏ */ }, headersSent: false } as never;
    const daXuLy = qt.xuLy(req, res, new URL(`https://x${duong}`), (_r, body, status = 200) => xong({ status, body }));
    if (!daXuLy) xong({ status: -1, body: null });
  });
}

describe('API quản trị cụm', () => {
  it('đường khác không đụng tới', async () => { expect((await goi('/api/me')).status).toBe(-1); });

  it('thiếu / sai khoá → 404 (giấu luôn việc có API)', async () => {
    expect((await goi('/api/quantri/cum', undefined, '9.9.9.1')).status).toBe(404);
    expect((await goi('/api/quantri/cum', 'sai', '9.9.9.1')).status).toBe(404);
    expect((await goi('/api/quantri/cum', KHOA.slice(0, -1), '9.9.9.1')).status).toBe(404);
  });

  it('sai quá 20 lần từ một IP → 429, kể cả khi lần sau đúng khoá; IP khác không bị vạ lây', async () => {
    for (let i = 0; i < 20; i++) await goi('/api/quantri/cum', 'sai', '6.6.6.6');
    expect((await goi('/api/quantri/cum', KHOA, '6.6.6.6')).status).toBe(429);
    expect((await goi('/api/quantri/cum', KHOA, '7.7.7.7')).status).toBe(200);
  });

  it('đúng khoá: danh sách phòng có người, đánh dấu phòng ma, KHÔNG lộ token / mã máy', async () => {
    const r = await goi('/api/quantri/phong', KHOA, '8.8.8.8');
    expect(r.status).toBe(200);
    const s = JSON.stringify(r.body);
    expect(s).not.toMatch(/BI-MAT|MA-MAY-RIENG|"token"|client/);
    const ds = (r.body as { phong: { ma: string; phongMa?: boolean; nguoi: { dangNoi: boolean }[] }[] }).phong;
    expect(ds.find((p) => p.ma === '111111')).toMatchObject({ congKhai: true, nguoi: [{ ten: 'An', dangNoi: true, may: false }] });
    expect(ds.find((p) => p.ma === '111111')?.phongMa).toBeUndefined();
    expect(ds.find((p) => p.ma === '222222')?.phongMa).toBe(true);
  });

  it('một pod (không Redis): /cum vẫn trả MySQL + pod này', async () => {
    const r = await goi('/api/quantri/cum', KHOA, '8.8.8.9');
    expect(r.body).toMatchObject({ cum: false, mysql: { song: true, phongMo: 2 }, pod: { pod: 'mot-pod' } });
  });

  it('không cấu hình khoá → API tắt hẳn', async () => {
    const tat = moQuanTri({ pool: pool as never, cum: () => null, khoa: undefined, podNay: () => ({ pod: 'x', phong: 0, sanhKetNoi: 0 }) });
    const kq = await new Promise<number>((xong) => {
      tat.xuLy({ method: 'GET', headers: { 'x-quantri-key': '' }, socket: {} } as never, { setHeader() { /* bỏ */ } } as never,
        new URL('https://x/api/quantri/cum'), (_r, _b, st = 200) => xong(st));
    });
    expect(kq).toBe(404);
  });
});
