import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Ga, GaLoi, CAU_HINH, phanLoai, _datLaiToken } from '../src/ga.ts';

// Khoá RSA thật (sinh lúc chạy) để layToken ký JWT được — fetch thì giả.
const cap = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', cap.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
const SA = { client_email: 'thu@vi-du.iam.gserviceaccount.com', private_key: pem };

const fetchGoc = globalThis.fetch;
const treGoc = CAU_HINH.tre;
let soLanToken = 0;
let dangGoi = 0, dinh = 0, soLanGa = 0;
/** Mỗi lần gọi GA lấy câu trả lời kế tiếp trong danh sách (hết thì 200 rỗng). */
let traLoi: (() => Response)[] = [];

const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));
const loiGa = (status: number, message: string) => () =>
  new Response(JSON.stringify({ error: { code: status, message, status: 'RESOURCE_EXHAUSTED' } }), { status });

beforeEach(() => {
  _datLaiToken();
  soLanToken = 0; dangGoi = 0; dinh = 0; soLanGa = 0; traLoi = [];
  CAU_HINH.tre = [1, 1, 1];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://oauth2.googleapis.com/')) {
      soLanToken++;
      await ngu(5);
      return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }));
    }
    soLanGa++; dangGoi++; dinh = Math.max(dinh, dangGoi);
    try {
      await ngu(10);
      const f = traLoi.shift();
      return f ? f() : new Response(JSON.stringify({ rows: [{ dimensionValues: [{ value: 'a' }], metricValues: [{ value: '3' }] }] }));
    } finally { dangGoi--; }
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = fetchGoc; CAU_HINH.tre = treGoc; });

test('hàng đợi: 12 báo cáo cùng lúc → tối đa 4 request GA đồng thời, token chỉ xin MỘT lần', async () => {
  const ga = new Ga(SA, '1');
  const kq = await Promise.all(Array.from({ length: 12 }, () => ga.report({})));
  assert.equal(kq.length, 12);
  assert.deepEqual(kq[0], [{ d: ['a'], m: [3] }]);
  assert.equal(dinh, 4);
  assert.equal(soLanGa, 12);
  assert.equal(soLanToken, 1);
  assert.deepEqual(ga.hang.trangThai(), { dangChay: 0, cho: 0 });
});

test('429 vì quá số request đồng thời → thử lại rồi được', async () => {
  traLoi = [loiGa(429, 'Exhausted concurrent requests quota.'), loiGa(503, 'The service is currently unavailable.')];
  const kq = await new Ga(SA, '1').report({});
  assert.equal(kq.length, 1);
  assert.equal(soLanGa, 3);
});

test('429 vì hết token theo giờ → KHÔNG thử lại, ném GaLoi het_quota', async () => {
  traLoi = [loiGa(429, 'Exhausted property tokens per hour. Wait until the next hour.')];
  await assert.rejects(new Ga(SA, '1').report({}), (e: unknown) => e instanceof GaLoi && e.loai === 'het_quota' && e.status === 429);
  assert.equal(soLanGa, 1);
});

test('bận mãi → thử tối đa 3 lần nữa rồi ném GaLoi ban', async () => {
  traLoi = Array.from({ length: 10 }, () => loiGa(429, 'Exhausted concurrent requests quota.'));
  const ga = new Ga(SA, '1');
  await assert.rejects(ga.report({}), (e: unknown) => e instanceof GaLoi && e.loai === 'ban');
  assert.equal(soLanGa, 4);
  assert.deepEqual(ga.hang.trangThai(), { dangChay: 0, cho: 0 });
});

test('400 (dimension chưa đăng ký) → không thử lại, loại khac', async () => {
  traLoi = [loiGa(400, 'Field customEvent:ngan_xep is not a valid dimension.')];
  await assert.rejects(new Ga(SA, '1').report({}), (e: unknown) => e instanceof GaLoi && e.loai === 'khac');
  assert.equal(soLanGa, 1);
});

test('phân loại lỗi', () => {
  assert.equal(phanLoai(429, 'Exhausted concurrent requests quota'), 'ban');
  assert.equal(phanLoai(429, 'Exhausted property tokens per day'), 'het_quota');
  assert.equal(phanLoai(429, 'Too many requests'), 'ban');
  assert.equal(phanLoai(503, 'unavailable'), 'ban');
  assert.equal(phanLoai(500, 'internal'), 'khac');
});

test('hàng đợi KHÔNG dùng chung giữa hai Ga (mỗi request một Ga — Workers cấm chờ promise của request khác)', async () => {
  const a = new Ga(SA, '1'), b = new Ga(SA, '1');
  assert.notEqual(a.hang, b.hang);
  await Promise.all([...Array.from({ length: 6 }, () => a.report({})), ...Array.from({ length: 6 }, () => b.report({}))]);
  assert.ok(dinh <= 8);
  assert.equal(soLanToken, 2, 'hai request cùng lúc mỗi bên tự xin (không chờ promise của nhau)');
  await new Ga(SA, '1').report({});
  assert.equal(soLanToken, 2, 'token đã có thì request sau dùng lại giá trị nhớ');
});
