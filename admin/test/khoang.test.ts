import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lapKeHoach, tuanIso } from '../src/khoang.ts';

const TZ = 'Asia/Ho_Chi_Minh';
// 17.11.2026 10:42 giờ VN = 03:42 UTC
const NOW = new Date(Date.UTC(2026, 10, 17, 3, 42));
const kh = (v: Record<string, string>) => lapKeHoach(v, NOW, TZ, '2026-10-15');

test('24 giờ: 24 cột giờ, cột cuối là giờ đang chạy theo giờ VN, kỳ trước là 24 giờ liền trước', () => {
  const k = kh({ khoang: '24h' });
  assert.equal(k.hat, '1h');
  assert.equal(k.cot.length, 24);
  assert.equal(k.cot.at(-1)!.k, '2026111710');
  assert.equal(k.cot[0]!.k, '2026111611');
  assert.deepEqual(k.ky, { startDate: '2026-11-16', endDate: '2026-11-17' });
  assert.equal(k.gioTruoc!.at(-1), '2026111610');
  assert.equal(k.gioTruoc!.length, 24);
  assert.equal(k.dangChay, true);
});

test('Hôm nay: cột 00h → giờ hiện tại, không so kỳ trước', () => {
  const k = kh({ khoang: 'today' });
  assert.equal(k.cot.length, 11);
  assert.equal(k.cot[0]!.k, '2026111700');
  assert.equal(k.kyTruoc, null);
});

test('Hôm qua: đủ 24 giờ, so với hôm kia, đã chốt', () => {
  const k = kh({ khoang: 'yday' });
  assert.equal(k.cot.length, 24);
  assert.deepEqual(k.ky, { startDate: '2026-11-16', endDate: '2026-11-16' });
  assert.deepEqual(k.kyTruoc, { startDate: '2026-11-15', endDate: '2026-11-15' });
  assert.equal(k.dangChay, false);
});

test('7 ngày tự chọn hạt ngày, đổi được sang giờ; 90 ngày theo tuần', () => {
  const k = kh({ khoang: '7' });
  assert.equal(k.hat, '1d');
  assert.equal(k.cot.length, 7);
  assert.deepEqual(k.kyTruoc, { startDate: '2026-11-04', endDate: '2026-11-10' });
  assert.equal(kh({ khoang: '7', hat: '1h' }).cot.length, 6 * 24 + 11);
  assert.equal(kh({ khoang: '90' }).hat, '1w');
  assert.equal(kh({ khoang: '90', hat: '1h' }).hat, '1w');   // giờ không cho với 90 ngày
});

test('Tuỳ chọn: đảo ngày ngược, chặn ngày tương lai', () => {
  const k = kh({ khoang: 'custom', tu: '2026-11-20', den: '2026-11-10' });
  assert.deepEqual(k.ky, { startDate: '2026-11-10', endDate: '2026-11-17' });
});

test('30 phút: 6 cột realtime', () => {
  const k = kh({ khoang: '30m' });
  assert.equal(k.realtime, true);
  assert.equal(k.cot.length, 6);
  assert.equal(k.cot.at(-1)!.nhan, '10:42');
});

test('khoảng lạ rơi về 24 giờ', () => assert.equal(kh({ khoang: 'x' }).khoang, '24h'));

test('tuần ISO', () => {
  assert.deepEqual(tuanIso(new Date(Date.UTC(2026, 10, 17))), { y: 2026, w: 47 });
  assert.deepEqual(tuanIso(new Date(Date.UTC(2027, 0, 1))), { y: 2026, w: 53 });
});
