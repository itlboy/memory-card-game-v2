import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xuLyApi, type KhoNho } from '../src/api.ts';
import { GaLoi, type Ga } from '../src/ga.ts';
import { PHAN } from '../src/thongke.ts';

const ENV = { GA_TZ: 'Asia/Ho_Chi_Minh', NGAY_CONG_KHAI: '2026-10-15' };
const NOW = new Date(Date.UTC(2026, 10, 17, 3, 42));

/** Cache API giả: nhớ thân + max-age theo URL (không tự hết hạn — test tự xoá khi cần). */
function khoGia() {
  const m = new Map<string, { than: string; maxAge: number }>();
  const kho: KhoNho = {
    async match(req) { const x = m.get(req.url); return x ? new Response(x.than) : undefined; },
    async put(req, res) { m.set(req.url, { than: await res.text(), maxAge: Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1]) }); }
  };
  return { kho, m };
}

type Body = { dimensions?: { name: string }[] };
/** GA giả: `tl(body)` trả dòng hoặc ném. Đếm số lần gọi. */
function gaGia(tl: (b: Body, loai: 'report' | 'realtime') => { d: string[]; m: number[] }[]) {
  const dem = { report: 0, realtime: 0 };
  const ga = {
    async report(b: Body) { dem.report++; return tl(b, 'report'); },
    async realtime(b: Body) { dem.realtime++; return tl(b, 'realtime'); }
  } as unknown as Ga;
  return { ga, dem };
}

async function goi(duong: string, ga: Ga, kho: KhoNho) {
  const cho: Promise<unknown>[] = [];
  const r = await xuLyApi(new URL(`https://admin.cozypi.com${duong}`), ga, ENV, 'a@b.c', kho, (p) => { cho.push(p); }, NOW);
  await Promise.all(cho);
  return { r: r!, j: r ? await r.clone().json() as Record<string, any> : null };
}

const BAN = () => new GaLoi('GA 429: Exhausted concurrent requests quota.', 429, 'ban');

test('ô lạ → 404; đường không phải API → null', async () => {
  const { ga } = gaGia(() => []);
  const { kho } = khoGia();
  assert.equal((await goi('/api/o/xoa_het', ga, kho)).r.status, 404);
  assert.equal(await xuLyApi(new URL('https://admin.cozypi.com/api/khong-co'), ga, ENV, '', kho, () => {}, NOW), null);
});

test('mọi ô đều trả 200 với GA rỗng', async () => {
  for (const p of PHAN) {
    const { ga } = gaGia(() => []);
    const { r, j } = await goi(`/api/o/${p}?khoang=7`, ga, khoGia().kho);
    assert.equal(r.status, 200, p);
    assert.equal(j!.phan, p);
    assert.equal(j!.cu, false);
    assert.deepEqual(j!.loi, {}, p);
  }
});

test('ô heat: lần hai lấy từ bộ nhớ tạm, không hỏi lại GA', async () => {
  const { ga, dem } = gaGia(() => [{ d: ['1', '20'], m: [7] }]);
  const { kho } = khoGia();
  const a = await goi('/api/o/heat?khoang=7', ga, kho);
  assert.equal(a.j!.heat[1][20], 7);
  const b = await goi('/api/o/heat?khoang=7', ga, kho);
  assert.equal(b.j!.heat[1][20], 7);
  assert.equal(dem.report, 1);
});

test('GA bận: có bản cũ → trả bản cũ với cu: true; không có → 503 + Retry-After', async () => {
  const { kho } = khoGia();
  await goi('/api/o/heat?khoang=yday', gaGia(() => [{ d: ['0', '9'], m: [4] }]).ga, kho);
  const ban = gaGia(() => { throw BAN(); });
  const c = await goi('/api/o/heat?khoang=yday&moi=1', ban.ga, kho);   // bỏ qua bản tươi → hỏi GA → hỏng → bản cũ
  assert.equal(c.r.status, 200);
  assert.equal(c.j!.cu, true);
  assert.equal(c.j!.heat[0][9], 4);

  const d = await goi('/api/o/heat?khoang=30', ban.ga, khoGia().kho);
  assert.equal(d.r.status, 503);
  assert.equal(d.r.headers.get('retry-after'), '5');
});

test('hết hạn mức giờ → 429, Retry-After tới đầu giờ sau', async () => {
  const { ga } = gaGia(() => { throw new GaLoi('GA 429: Exhausted property tokens per hour', 429, 'het_quota'); });
  const { r } = await goi('/api/o/kpi?khoang=7', ga, khoGia().kho);
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get('retry-after')) >= 60);
});

test('một báo cáo lỗi (dimension chưa đăng ký) chỉ hỏng ô danh sách đó; nhớ tươi ≤ 60s, không đè bản cũ', async () => {
  const { ga } = gaGia((b) => {
    if (b.dimensions?.some((d) => d.name === 'customEvent:theme')) throw new GaLoi('GA 400: Field customEvent:theme is not a valid dimension.', 400, 'khac');
    return [{ d: ['online'], m: [5] }];
  });
  const { kho, m } = khoGia();
  const { r, j } = await goi('/api/o/choi?khoang=7', ga, kho);
  assert.equal(r.status, 200);
  assert.match(j!.loi.theme, /Chưa đăng ký custom dimension "theme"/);
  assert.deepEqual(j!.danhSach.che_do, [{ k: 'online', v: 5 }]);
  const ds = [...m.entries()];
  assert.equal(ds.length, 1);
  assert.match(ds[0]![0], /__nho\//);
  assert.equal(ds[0]![1].maxAge, 60);
});

test('lỗi JS: ngan_xep chưa đăng ký → hỏi lại không có nó, chỉ ghi chú (không lỗi ô)', async () => {
  const { ga, dem } = gaGia((b) => {
    if (b.dimensions?.some((d) => d.name === 'customEvent:ngan_xep')) throw new GaLoi('GA 400: Field customEvent:ngan_xep is not a valid dimension.', 400, 'khac');
    return [{ d: ['TypeError: x'], m: [3] }];
  });
  const { j } = await goi('/api/o/loi_js?khoang=7', ga, khoGia().kho);
  assert.deepEqual(j!.loi, {});
  assert.ok(j!.ghiChu.loi_js);
  assert.deepEqual(j!.danhSach.loi_js, [{ k: 'TypeError: x', v: 3 }]);
  assert.equal(dem.report, 2);
});

test('lỗi JS có ngan_xep → gộp theo thông điệp, kèm chỗ lỗi hay gặp nhất', async () => {
  const { ga } = gaGia(() => [
    { d: ['TypeError: x', 'index-a.js:1:20 < vendor.js:2:3'], m: [5] },
    { d: ['TypeError: x', 'index-a.js:9:9'], m: [1] },
    { d: ['RangeError', '(not set)'], m: [2] }
  ]);
  const { j } = await goi('/api/o/loi_js?khoang=7', ga, khoGia().kho);
  assert.deepEqual(j!.danhSach.loi_js, [
    { k: 'TypeError: x', v: 6, phu: 'index-a.js:1:20 < vendor.js:2:3 (+1 chỗ khác)' },
    { k: 'RangeError', v: 2 }
  ]);
});

test('30 phút: ô không có realtime trả khongCo, không gọi GA; ô kpi dùng realtime', async () => {
  const a = gaGia(() => []);
  const { j } = await goi('/api/o/online?khoang=30m', a.ga, khoGia().kho);
  assert.equal(j!.khongCo, true);
  assert.deepEqual(a.dem, { report: 0, realtime: 0 });
  const b = gaGia(() => [{ d: ['van_bat_dau'], m: [2] }]);
  const k = await goi('/api/o/kpi?khoang=30m', b.ga, khoGia().kho);
  assert.equal(k.j!.kpi.van.v, 2);
  assert.equal(b.dem.report, 0);
});

test('đang diễn ra: một ô hỏng không làm 502 cả dải', async () => {
  let i = 0;
  const { ga } = gaGia(() => { if (i++ === 1) throw BAN(); return [{ d: ['VN'], m: [3] }]; });
  const { r, j } = await goi('/api/dang-dien-ra', ga, khoGia().kho);
  assert.equal(r.status, 200);
  assert.equal(j!.nguoi, 3);
  assert.equal(j!.van, null);
  assert.ok(j!.loi.van);
});
