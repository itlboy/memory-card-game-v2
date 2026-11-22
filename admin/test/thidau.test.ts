import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gopThiDau, layThiDau, type DongTd } from '../src/thidau.ts';

const T = Date.UTC(2026, 10, 22, 3, 0);   // 10:00 giờ VN ngày 22.11
const d = (phut: number, kind: string, who: string | null, data: object, platform = 'ios', country = 'VN'): DongTd => [T + phut * 60_000, kind, who, platform, 'vi', country, JSON.stringify(data)];

test('gộp phễu thi đấu: hỏi → tham gia → chia trận → ván', () => {
  const g = gopThiDau([
    d(0, 'td_dot', null, { dot: 'a', hoi: 3 }),
    d(0, 'td_hoi', 'u1', { kenh: 'theHoi' }), d(0, 'td_hoi', 'u2', { kenh: 'theHoi' }), d(0, 'td_hoi', 'u3', { kenh: 'theHoi' }, 'android', 'US'),
    d(1, 'td_tra_loi', 'u1', { tra: 'thamGia' }), d(1, 'td_tra_loi', 'u2', { tra: 'thamGia' }), d(1, 'td_tra_loi', 'u3', { tra: 'deSau' }, 'android', 'US'),
    d(1, 'td_chia', null, { thamGia: 2, tran2: 1, tran3: 0, du: true }),
    d(2, 'td_van', null, { viec: 'batDau', nguoi: 2 }), d(5, 'td_van', null, { viec: 'xong', nguoi: 2, roi: 0 }),
    d(6, 'td_choi_lai', null, { nguoi: 2 }), d(7, 'td_push', null, { gui: 4, loi: 0 }),
    d(60 * 20, 'td_hoi', 'u1', { kenh: 'coNguoiCho' }), ['x' as unknown as number, 'td_hoi', null, '', '', '', '{hỏng'] as DongTd
  ], 30, T);
  assert.equal(g.tong.dotGoi, 1);
  assert.equal(g.tong.hoi, 4);          // dòng hỏng (mốc giờ không hợp lệ) bị bỏ, không làm sập cả ô
  assert.equal(g.tong.nguoiDuocHoi, 3);
  assert.equal(g.tong.hoiCoNguoiCho, 1);
  assert.deepEqual([g.tong.thamGia, g.tong.deSau, g.tong.boQua], [2, 1, 0]);
  assert.deepEqual([g.tong.dotChia, g.tong.dotDuNguoi, g.tong.tran2, g.tong.nguoiVaoTran], [1, 1, 1, 2]);
  assert.deepEqual([g.tong.vanBatDau, g.tong.vanXong, g.tong.choiLai, g.tong.pushGui], [1, 1, 1, 4]);
  // 20 giờ sau 10:00 VN = 06:00 ngày 23 → hai ngày, mới nhất trước
  assert.deepEqual(g.ngay.filter((x) => /^2026/.test(x.ngay)).map((x) => [x.ngay, x.hoi]), [['2026-11-23', 1], ['2026-11-22', 3]]);
  assert.deepEqual(g.nenTang.find((x) => x.ten === 'android'), { ten: 'android', hoi: 1, thamGia: 0, nguoi: 1 });
});

test('thiếu khoá → 503 chuaCauHinh, không gọi máy chủ game; máy chủ lỗi → 502 kèm lý do', async () => {
  let goi = 0;
  const gia = (async () => { goi++; return new Response('x', { status: 404 }); }) as unknown as typeof fetch;
  const a = await layThiDau({ GAME_API: 'https://g' }, 30, gia);
  assert.equal(a.status, 503); assert.equal(goi, 0);
  const b = await layThiDau({ GAME_API: 'https://g', THONGKE_KEY: 'k' }, 30, gia);
  assert.equal(b.status, 502); assert.match((await b.json() as { loi: string }).loi, /404/);
});

test('gọi đúng đường, kèm khoá ở header (không lên URL), trần 90 ngày', async () => {
  let thay: { url: string; khoa: string | null } | null = null;
  const gia = (async (u: string, o: { headers: Record<string, string> }) => { thay = { url: u, khoa: o.headers['x-thongke-key'] ?? null }; return new Response(JSON.stringify({ ds: [] })); }) as unknown as typeof fetch;
  const r = await layThiDau({ GAME_API: 'https://g/', THONGKE_KEY: ' k ' }, 400, gia);
  assert.equal(r.status, 200);
  assert.deepEqual(thay, { url: 'https://g/api/thongke/thidau?ngay=90', khoa: 'k' });
  assert.equal((await r.json() as { suKien: number }).suKien, 0);
});
