import { beforeEach, describe, expect, it } from 'vitest';
import { TRI_NHO_GIU_NGAY, mayUocLuong, store, type NgayTriNho } from '@/lib/storage';
import {
  CO_HOI_MOI_VAN_MAC_DINH, MOC_CO_DIEM, SO_NGAY_KY, chiSo, chiSoHomNay, chiSoTai, daXemTriNho, dayNgay, ghiVanTriNho, ngayTuKhoa,
  phienTriNho, theConThieu, theNenLuyen, tienDoCoDiem, vanConThieu, vuaDoi
} from '@/lib/tri-nho';

beforeEach(() => { localStorage.clear(); vuaDoi.value = null; });

/** Một ván có đủ số liệu engine mới: 15 cơ hội, kèm phần ăn may. */
const VAN = { nhoTheo: [4, 0, 5, 3, 0], quenTheo: [1, 0, 2, 0, 0], mayTheo: [0.5, 0, 0.7, 0.3, 0], tamNho: 9 };
/** Ván bàn lớn (72 thẻ) KHÔNG có cơ hội nhớ nào — chỉ để đủ ván bắt buộc mà không đổi điểm. */
const LON0 = { van: 3, nho: [0, 0, 0, 0, 0], quen: [0, 0, 0, 0, 0], may: [0, 0, 0, 0, 0] };
/** Một ngày, một cỡ bàn (+ một ván bàn lớn rỗng để đủ ván bắt buộc, `du = false` thì bỏ). */
const ngay = (nho: number[], quen: number[], may?: number[], soCap = 18, van = 5, du = true): NgayTriNho =>
  ({ ban: { [soCap]: { van, nho, quen, ...(may ? { may } : {}) }, ...(du ? { 36: LON0 } : {}) }, tam: 0 });

describe('nhật ký trí nhớ theo ngày', () => {
  it('ván không có cơ hội nhớ nào thì không ghi', () => {
    store.ghiTriNho(undefined, 8, '2026-11-23');
    store.ghiTriNho({}, 8, '2026-11-23');
    expect(store.nhatKyTriNho()).toEqual({});
  });

  it('cộng dồn theo ngày và theo cỡ bàn — cả phần ăn may; giữ tầm nhớ xa nhất', () => {
    store.ghiTriNho(VAN, 18, '2026-11-23');
    store.ghiTriNho(VAN, 18, '2026-11-23');
    store.ghiTriNho({ nhoTheo: [3], mayTheo: [0.4], tamNho: 1 }, 6, '2026-11-23');
    const n = store.nhatKyTriNho()['2026-11-23']!;
    expect(n.ban['18']).toEqual({ van: 2, nho: [8, 0, 10, 6, 0], quen: [2, 0, 4, 0, 0], may: [1, 0, 1.4, 0.6, 0] });
    expect(n.ban['6']!.van).toBe(1);
    expect(n.tam).toBe(9);
  });

  it('ván KHÔNG mang phần ăn may (server cũ) → ước lượng 1/(số cặp + 1) mỗi cơ hội, để ô luôn đủ `may`', () => {
    store.ghiTriNho({ nhoTheo: [0, 6], quenTheo: [0, 3] }, 8, '2026-11-23');
    expect(store.nhatKyTriNho()['2026-11-23']!.ban['8']!.may![1]).toBeCloseTo(9 / 9, 10);
    expect(mayUocLuong([4], [4], 15)[0]).toBeCloseTo(8 / 16, 10);
  });

  it('chỉ giữ số ngày gần nhất', () => {
    const d = new Date(2024, 0, 1, 12);
    for (let i = 0; i < TRI_NHO_GIU_NGAY + 5; i++) {
      store.ghiTriNho({ nhoTheo: [1] }, 8, dayNgay(1, new Date(d.getFullYear(), d.getMonth(), d.getDate() + i))[0]);
    }
    const k = Object.keys(store.nhatKyTriNho()).sort();
    expect(k).toHaveLength(TRI_NHO_GIU_NGAY);
    expect(k[0]).toBe('2024-01-06');
  });
});

describe('chỉ số của một kỳ', () => {
  it('dưới mốc cơ hội nhớ thì CHƯA có điểm, dù đã có chặng mở', () => {
    const k = chiSo([ngay([10, 5, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0])]);
    expect(k.coHoi).toBe(15);
    expect(k.coHoi).toBeLessThan(MOC_CO_DIEM);
    expect(k.diem).toBeNull();
    expect(k.bac).toBeNull();
    expect(k.chang[0]!.mo).toBe(true);   // chặng vẫn hiện để người chơi thấy mình đang gom số liệu
  });

  it('gộp mọi ngày + mọi cỡ bàn rồi mới chấm: điểm, bậc, còn bao nhiêu tới bậc kế, tiến độ trong bậc', () => {
    const k = chiSo([
      ngay([10, 8, 0, 0, 0], [0, 2, 0, 0, 0], [0, 0, 0, 0, 0], 18),
      undefined,
      ngay([0, 0, 5, 0, 0], [0, 0, 5, 5, 0], [0, 0, 0, 0, 0], 30)
    ]);
    // vừa thấy 100% → 50 · 2–3 lượt 80% → 120 · 4–7 lượt 50% → 100 · 8–15 lượt 0% → 0 · 16+ chưa mở
    expect(k.chang.map((c) => c.diem)).toEqual([50, 120, 100, 0, 0]);
    expect(k.diem).toBe(270);
    expect(k.bac).toBe(1);                 // Bạc: 200–399
    expect(k.conToiBac).toBe(130);
    expect(k.tienBac).toBeCloseTo(70 / 200, 10);
    expect(k.van).toBe(16);
  });

  it('bậc cao nhất: không còn "tới bậc kế", tiến độ đầy', () => {
    const k = chiSo([ngay([9, 9, 9, 9, 9], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0])]);
    expect(k.diem).toBe(1000);
    expect(k.bac).toBe(4);
    expect(k.conToiBac).toBeNull();
    expect(k.tienBac).toBe(1);
  });

  it('số liệu cũ không có phần ăn may: ước lượng theo cỡ bàn — bàn nhỏ bị trừ nhiều hơn bàn to', () => {
    const nho = [0, 12, 0, 0, 0], quen = [0, 12, 0, 0, 0];
    const nhoBan = chiSo([ngay(nho, quen, undefined, 6)]).chang[1]!.tiLe!;
    const toBan = chiSo([ngay(nho, quen, undefined, 44)]).chang[1]!.tiLe!;
    expect(nhoBan).toBeLessThan(toBan);
    expect(toBan).toBeLessThan(0.5);      // 50% thô, trừ ăn may thì dưới 50%
  });

  it('kỳ = ĐÚNG MỘT NGÀY (27.11.2026: "hôm nào hiện điểm hôm đó") — ngày không chơi là chưa có điểm', () => {
    const nk: Record<string, NgayTriNho> = {
      '2026-11-10': ngay([10, 10, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]),
      '2026-11-20': ngay([10, 0, 0, 0, 0], [0, 10, 0, 0, 0], [0, 0, 0, 0, 0])
    };
    expect(SO_NGAY_KY).toBe(1);
    expect(chiSoTai(nk, ngayTuKhoa('2026-11-10')).diem).toBe(200);
    expect(chiSoTai(nk, ngayTuKhoa('2026-11-11')).diem, 'hôm sau bắt đầu lại').toBeNull();
    expect(chiSoTai(nk, ngayTuKhoa('2026-11-20')).diem).toBe(50);
  });

  it('còn thiếu mấy ván: đổi cơ hội nhớ ra ván theo trung bình của chính người chơi', () => {
    const D = [true, true, true];   // đủ 3 nhóm bàn — chỉ còn xét cơ hội nhớ
    expect(vanConThieu({ coHoi: 0, van: 0, duNhom: D })).toBe(Math.ceil(MOC_CO_DIEM / CO_HOI_MOI_VAN_MAC_DINH));
    expect(vanConThieu({ coHoi: 10, van: 2, duNhom: D })).toBe(2);              // 5 cơ hội/ván, còn thiếu 10
    expect(vanConThieu({ coHoi: MOC_CO_DIEM, van: 3, duNhom: D })).toBe(0);
  });

  it('nên luyện bàn nào: chặng đầu tiên CHƯA MỞ quyết định; mở hết thì luyện chặng yếu nhất', () => {
    const mo = (tiLe: number) => ({ n: 9, mo: true, tiLe, diem: 0, toiDa: 0 });
    const dong = { n: 0, mo: false, tiLe: null, diem: 0, toiDa: 0 };
    expect(theNenLuyen([mo(1), mo(1), dong, dong, dong])).toBe(24);
    expect(theNenLuyen([mo(1), mo(1), mo(1), mo(1), dong])).toBe(36);   // chặng 16+ lượt cần bàn to
    expect(theNenLuyen([mo(1), mo(.4), mo(.8), mo(.9), mo(.7)])).toBe(16);
  });

  it('VÁN BẮT BUỘC MỖI NGÀY (27.11.2026): 1 ván nhỏ 16–24 · 1 vừa 30–59 · 1 lớn từ 70 thẻ; ván to dư bù nhóm nhỏ hơn', () => {
    const N = [10, 10, 0, 0, 0], Q = [0, 0, 0, 0, 0];
    const ban = (b: Record<number, number>): NgayTriNho =>
      ({ ban: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { van: v, nho: N, quen: Q, may: Q }])), tam: 0 });
    const k1 = chiSo([ban({ 18: 5 })]);                     // 5 ván 36 thẻ
    expect(k1.diem).toBeNull();
    expect(k1.diemTho, 'vẫn có điểm thô để vẽ MỜ').toBe(200);
    expect([k1.duNhom, vanConThieu(k1), theConThieu(k1)], 'ván vừa dư bù bàn nhỏ').toEqual([[true, true, false], 1, 72]);
    const k2 = chiSo([ban({ 8: 1, 36: 1 })]);               // 16 + 72 thẻ: thiếu bàn vừa
    expect([k2.diem, k2.duNhom, theConThieu(k2)]).toEqual([null, [true, false, true], 36]);
    expect(chiSo([ban({ 10: 1, 21: 1, 44: 1 })]).diem, '20 + 42 + 88 thẻ là đủ').toBe(200);
    expect(chiSo([ban({ 36: 3 })]).diem, '3 ván 72 thẻ: ván lớn dư bù nhỏ + vừa').toBe(200);
    expect(chiSo([ban({ 6: 1, 18: 1, 36: 1 })]).diem, 'bàn 12 thẻ không tính là bàn nhỏ').toBeNull();
    expect(chiSo([ban({ 8: 3, 36: 1 })]).duNhom, 'bàn nhỏ dư KHÔNG bù bàn vừa').toEqual([true, false, true]);
    expect(chiSo([]).diemTho).toBeNull();
    expect(tienDoCoDiem(k2)).toBeCloseTo(2 / 3, 5);
  });

  it('dãy ngày liên tiếp, cũ → mới, qua được ranh giới tháng', () => {
    expect(dayNgay(3, new Date(2026, 11, 1, 9))).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
});

describe('vừa đổi sau ván + đã xem', () => {
  const NHIEU = { nhoTheo: [10, 10, 0, 0, 0], quenTheo: [0, 0, 0, 0, 0], mayTheo: [0, 0, 0, 0, 0] };

  it('ván đủ yêu cầu đầu tiên: trước chưa có điểm, sau có → "lần đầu"; ván sau báo chênh lệch', () => {
    ghiVanTriNho(NHIEU, 18);
    ghiVanTriNho(NHIEU, 18);
    expect(vuaDoi.value, '2 ván 36 thẻ (một ván bù bàn nhỏ), còn thiếu bàn lớn').toMatchObject({ truoc: null, sau: null });
    ghiVanTriNho(NHIEU, 36);
    expect(vuaDoi.value).toEqual({ truoc: null, sau: 200, bacTruoc: null, bacSau: 1, van: 1000 });
    ghiVanTriNho({ nhoTheo: [0, 0, 10], quenTheo: [], mayTheo: [0, 0, 0] }, 18);
    expect(vuaDoi.value).toMatchObject({ truoc: 200, sau: 400, bacTruoc: 1, bacSau: 2 });   // lên bậc Vàng
    expect(chiSoHomNay().diem).toBe(400);
  });

  it('ván KHÔNG được chấm (không có người / không cơ hội nhớ) → xoá số của ván trước, không ghi gì', () => {
    ghiVanTriNho(NHIEU, 18);
    const truoc = JSON.stringify(store.nhatKyTriNho());
    ghiVanTriNho(undefined, 18);
    expect(vuaDoi.value).toBeNull();
    ghiVanTriNho({}, 18);
    expect(vuaDoi.value).toBeNull();
    expect(JSON.stringify(store.nhatKyTriNho())).toBe(truoc);
  });

  it('mở màn chỉ số = đã xem điểm hiện tại; ghi ván / xem đều báo các chỗ đang hiện tính lại', () => {
    const p0 = phienTriNho.value;
    ghiVanTriNho(NHIEU, 18); ghiVanTriNho(NHIEU, 18); ghiVanTriNho(NHIEU, 36);
    expect(phienTriNho.value).toBe(p0 + 3);
    expect(store.prefs().triNhoXem).toBeUndefined();
    daXemTriNho();
    expect(store.prefs().triNhoXem).toBe(200);
    expect(phienTriNho.value).toBe(p0 + 4);
  });
});
