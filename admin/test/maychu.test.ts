import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layMayChu } from '../src/maychu.ts';

const KHOA = 'khoa-quan-tri-thu';
test('ô Máy chủ: chưa nạp khoá → 503 chuaCauHinh', async () => {
  const r = await layMayChu({ GAME_API: 'https://g' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { chuaCauHinh: true });
});

test('ô Máy chủ: gửi khoá qua header, KHÔNG trả khoá về trình duyệt, gộp tổng + phòng', async () => {
  const goi: { url: string; khoa: string | null }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    goi.push({ url, khoa: new Headers(init?.headers).get('x-quantri-key') });
    return new Response(JSON.stringify(url.includes('/tong') ? { online: { sanh: 3 } } : { so: 1, phong: [{ ma: '123456' }] }));
  }) as typeof fetch;
  const r = await layMayChu({ GAME_API: 'https://g/', QUANTRI_KEY: ` ${KHOA} ` }, f);
  const body = await r.text();
  assert.equal(r.status, 200);
  assert.deepEqual(goi.map((x) => x.url).sort(), ['https://g/api/quantri/phong?boMa=1', 'https://g/api/quantri/tong']);
  assert.ok(goi.every((x) => x.khoa === KHOA));
  assert.ok(!body.includes(KHOA));
  assert.deepEqual(JSON.parse(body), { tong: { online: { sanh: 3 } }, phong: { so: 1, phong: [{ ma: '123456' }] } });
});

test('ô Máy chủ: máy chủ game trả lỗi → 502 kèm mã', async () => {
  const r = await layMayChu({ GAME_API: 'https://g', QUANTRI_KEY: KHOA }, (async () => new Response('', { status: 404 })) as typeof fetch);
  assert.equal(r.status, 502);
  assert.match((await r.json() as { loi: string }).loi, /404/);
});
