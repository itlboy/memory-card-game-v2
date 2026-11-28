import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lapNhom, nenCua, tangTruong, tenKenh } from '../src/tangtruong.ts';
import { GaLoi, type Ga, type Dong } from '../src/ga.ts';

const NOW = new Date('2026-11-28T05:00:00Z');   // 12:00 giờ VN ngày 28.11

test('nhóm tuần: 5 nhóm đủ 7 ngày (cũ → mới) + 1 nhóm đang chạy, không chồng nhau', () => {
  const ds = lapNhom(new Date(Date.UTC(2026, 10, 28)));
  assert.equal(ds.length, 6);
  assert.deepEqual(ds.at(-2), { id: 't0', nhan: '14.11–20.11', tu: '2026-11-14', den: '2026-11-20', du7: true });
  assert.deepEqual(ds.at(-1), { id: 'moi', nhan: '21.11–26.11', tu: '2026-11-21', den: '2026-11-26', du7: false });
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i - 1]!.den < ds[i]!.tu);
});

test('kênh: app theo trang vào, web theo nguồn', () => {
  assert.equal(nenCua('/app/ios'), 'ios');
  assert.equal(nenCua('/vi/about'), 'web');
  assert.equal(tenKenh('(direct)', '(none)', '/app/android'), 'Google Play (app Android)');
  assert.equal(tenKenh('(direct)', '(none)', '/'), 'Web · gõ thẳng / không rõ');
  assert.equal(tenKenh('(direct)', '(none)', '/zh-TW'), 'Web · trang ngôn ngữ, gõ thẳng');
  assert.equal(tenKenh('m.facebook.com', 'referral', '/'), 'Facebook');
  assert.equal(tenKenh('google', 'organic', '/'), 'Tìm kiếm · google');
});

/** Ga giả: trả theo chiều đầu tiên của báo cáo. */
const gaGia = (tra: (b: Record<string, any>) => Dong[]) => ({ report: async (b: Record<string, any>) => tra(b) }) as unknown as Ga;
const chieu = (b: Record<string, any>) => (b.dimensions as { name: string }[]).map((x) => x.name).join(',');

test('gói tăng trưởng: online trung bình = giây chơi / 86 400, giờ đỉnh, giữ chân theo nền tảng', async () => {
  const g = await tangTruong(gaGia((b) => {
    switch (chieu(b)) {
      case 'date': return [{ d: ['20261127'], m: [86400 * 2, 60, 20] }, { d: ['20261120'], m: [86400, 30, 10] }];
      case 'dateHour': return [{ d: ['2026112720'], m: [3600 * 5] }, { d: ['2026112709'], m: [3600 * 3] }];
      case 'cohort,cohortNthDay': {
        const ios = JSON.stringify(b.dimensionFilter).includes('/app/ios');
        return ios ? [{ d: ['t0', '0000'], m: [50] }, { d: ['t0', '0001'], m: [20] }, { d: ['t0', '0007'], m: [5] }, { d: ['moi', '0000'], m: [40] }, { d: ['moi', '0001'], m: [10] }] : [];
      }
      case 'eventName,pagePath': return [{ d: ['first_visit', '/app/ios'], m: [10] }, { d: ['van_ket_thuc', '/app/ios'], m: [8] }, { d: ['first_visit', '/'], m: [4] }, { d: ['first_visit', '/en/'], m: [3] }];
      case 'firstUserSource,firstUserMedium,landingPage': return [{ d: ['(direct)', '(none)', '/app/ios'], m: [10, 6000] }, { d: ['facebook.com', 'referral', '/'], m: [2, 0] }, { d: ['m.facebook.com', 'referral', '/'], m: [2, 240] }];
      case 'countryId': return [{ d: ['VN'], m: [100, 50, 36000] }];
      case 'eventName': return [{ d: ['chia_se'], m: [17, 8] }];
      case 'customEvent:chuc_nang': return [{ d: ['online_moi_ban'], m: [29, 9] }];
    }
    return [];
  }), NOW, 'Asia/Ho_Chi_Minh');
  assert.deepEqual(g.ky, { startDate: '2026-10-31', endDate: '2026-11-27' });
  assert.equal(g.ngay!.length, 28);
  assert.deepEqual(g.ngay!.at(-1), { k: '20261127', nhan: '27.11', tb: 2, dinh: 5, nguoi: 60, moi: 20 });
  assert.equal(g.tong!.tb7, 0.3);          // 2 người·ngày / 7 ngày
  assert.equal(g.tong!.tb7Truoc, 0.1);
  assert.equal(g.tong!.moi7, 20);
  assert.deepEqual(g.giuChan![0], { id: 'moi', nhan: '21.11–26.11', du7: false, nen: { ios: { moi: 40, n1: 10, n7: null }, android: { moi: 0, n1: 0, n7: null }, web: { moi: 0, n1: 0, n7: null } } });
  assert.deepEqual(g.giuChan![1]!.nen.ios, { moi: 50, n1: 20, n7: 5 });
  assert.deepEqual(g.kichHoat, [{ id: 'ios', ten: 'iOS', moi: 10, batDau: 0, xong: 8 }, { id: 'android', ten: 'Android', moi: 0, batDau: 0, xong: 0 }, { id: 'web', ten: 'Web', moi: 7, batDau: 0, xong: 0 }]);
  assert.deepEqual(g.nguon, [{ k: 'App Store (app iOS)', moi: 10, phut: 10 }, { k: 'Facebook', moi: 4, phut: 1 }]);
  assert.deepEqual(g.quocGia, [{ k: 'VN', nguoi: 100, moi: 50, gio: 10 }]);
  assert.deepEqual(g.lanTruyen!.find((x) => x.k === 'online_moi_ban'), { k: 'online_moi_ban', luot: 29, nguoi: 9 });
  assert.deepEqual(g.loi, {});
});

test('gói tăng trưởng: hỏng một báo cáo thì ghi lỗi báo cáo đó; GA bận thì ném ra để dùng bản cũ', async () => {
  const g = await tangTruong(gaGia((b) => { if (chieu(b) === 'countryId') throw new GaLoi('GA 400: sai', 400, 'khac'); return []; }), NOW, 'Asia/Ho_Chi_Minh');
  assert.equal(g.loi.quoc_gia, 'GA 400: sai');
  assert.equal(g.quocGia, undefined);
  await assert.rejects(tangTruong(gaGia(() => { throw new GaLoi('GA 429', 429, 'ban'); }), NOW, 'Asia/Ho_Chi_Minh'), GaLoi);
});
