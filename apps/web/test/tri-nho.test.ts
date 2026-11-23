import { beforeEach, describe, expect, it } from 'vitest';
import { TRI_NHO_GIU_NGAY, store } from '@/lib/storage';
import { CO_HOI_MOI_VAN_MAC_DINH, MOC_TIN_CAY, dayNgay, theoNhomBan, tinCay, tomTat, triNhoVan, vanConThieu } from '@/lib/tri-nho';

beforeEach(() => localStorage.clear());

/** 12 nhớ, 3 quên → tỉ lệ 86% (ví dụ đã chốt 23.11.2026). */
const VAN = { nhoTheo: [4, 0, 5, 3, 0], quenTheo: [1, 0, 2, 0, 0], tamNho: 9 };

describe('nhật ký trí nhớ theo ngày', () => {
  it('ván không có cơ hội nhớ nào thì không ghi', () => {
    store.ghiTriNho(undefined, 8, '2026-11-23');
    store.ghiTriNho({}, 8, '2026-11-23');
    expect(store.nhatKyTriNho()).toEqual({});
  });

  it('cộng dồn theo ngày và theo cỡ bàn; giữ điểm ván cao nhất và tầm nhớ xa nhất', () => {
    store.ghiTriNho(VAN, 18, '2026-11-23');
    store.ghiTriNho(VAN, 18, '2026-11-23');
    store.ghiTriNho({ nhoTheo: [3], tamNho: 1 }, 6, '2026-11-23');
    const n = store.nhatKyTriNho()['2026-11-23']!;
    expect(n.ban['18']).toEqual({ van: 2, nho: [8, 0, 10, 6, 0], quen: [2, 0, 4, 0, 0] });
    expect(n.ban['6']!.van).toBe(1);
    expect(n.tam).toBe(9);
    expect(n.cao).toBe(550);
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

describe('gộp số liệu để hiện', () => {
  it('một ván: điểm = tỉ lệ × trần của bàn', () => {
    expect(triNhoVan(VAN, 18)).toEqual({ diem: 550, tiLe: 86, tam: 9, tran: 640 });
    expect(triNhoVan({ nhoTheo: [1], quenTheo: [1] }, 18)).toMatchObject({ diem: null, tiLe: null });
    expect(triNhoVan({}, 18)).toBeNull();
  });

  it('điểm kỳ = trung bình theo SỐ VÁN của từng cỡ bàn; cỡ bàn chưa đủ số liệu không kéo điểm', () => {
    store.ghiTriNho(VAN, 18, '2026-11-22');           // 550
    store.ghiTriNho({ nhoTheo: [0, 0, 0, 0, 5] }, 44, '2026-11-23');   // 1000
    store.ghiTriNho({ nhoTheo: [1] }, 4, '2026-11-23');                // chưa đủ để chấm
    const nk = store.nhatKyTriNho();
    const tt = tomTat([nk['2026-11-22'], nk['2026-11-23'], undefined]);
    expect(tt.diem).toBe(775);
    expect(tt.van).toBe(3);
    expect(tt.cao).toBe(1000);
    expect(tt.coHoi).toBe(21);
  });

  it('độ tin cậy theo số cơ hội nhớ', () => {
    expect([0, 1, MOC_TIN_CAY[0] - 1, MOC_TIN_CAY[0], MOC_TIN_CAY[1] - 1, MOC_TIN_CAY[1]].map(tinCay)).toEqual([0, 1, 1, 2, 2, 3]);
    expect(tomTat([]).tinCay).toBe(0);
  });

  it('còn thiếu mấy ván: đổi cơ hội nhớ ra ván theo trung bình của chính người chơi', () => {
    const rong = { coHoi: 0, van: 0 };
    expect(vanConThieu(rong, rong)).toBe(Math.ceil(MOC_TIN_CAY[0] / CO_HOI_MOI_VAN_MAC_DINH));
    expect(vanConThieu({ coHoi: 12 }, { coHoi: 40, van: 10 })).toBe(2);    // thiếu 8 để tới 20, mỗi ván 4
    expect(vanConThieu({ coHoi: 30 }, { coHoi: 100, van: 10 })).toBe(3);   // thiếu 30 để tới 60, mỗi ván 10
    expect(vanConThieu({ coHoi: 60 }, { coHoi: 100, van: 10 })).toBe(0);   // đã đáng tin
  });

  it('chia nhóm cỡ bàn: ≤8 · 9–18 · 19–30 · 31+', () => {
    store.ghiTriNho(VAN, 8, '2026-11-23');
    store.ghiTriNho(VAN, 9, '2026-11-23');
    store.ghiTriNho(VAN, 44, '2026-11-23');
    const n = theoNhomBan([store.nhatKyTriNho()['2026-11-23']]);
    expect(n.map((x) => x.van)).toEqual([1, 1, 0, 1]);
    expect(n.map((x) => x.tiLe)).toEqual([86, 86, null, 86]);
  });

  it('dãy ngày liên tiếp, cũ → mới, qua được ranh giới tháng', () => {
    expect(dayNgay(3, new Date(2026, 11, 1, 9))).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
});
