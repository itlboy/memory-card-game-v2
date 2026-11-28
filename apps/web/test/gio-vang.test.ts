import { describe, expect, it } from 'vitest';
import { HOI_CACH_MS, dinhDangCon, nenHoiNhac, trangThaiGioVang } from '@/lib/gio-vang';

/** GIỜ VÀNG — 20:00–21:00 theo giờ máy; huy hiệu đếm ngược trong 3 tiếng trước; tấm hỏi bật nhắc tối đa 2 lần cách ≥ 7 ngày. */
describe('lib/gio-vang.ts', () => {
  const luc = (h: number, m: number) => new Date(2026, 11, 4, h, m);

  it('đang diễn ra trong 20:00–20:59, còn bao nhiêu phút', () => {
    expect(trangThaiGioVang(luc(19, 59))).toEqual({ dang: false, conPhut: 0, truocPhut: 1 });
    expect(trangThaiGioVang(luc(20, 0))).toEqual({ dang: true, conPhut: 60, truocPhut: null });
    expect(trangThaiGioVang(luc(20, 59))).toEqual({ dang: true, conPhut: 1, truocPhut: null });
    expect(trangThaiGioVang(luc(21, 0))).toEqual({ dang: false, conPhut: 0, truocPhut: null });
  });

  it('đếm ngược chỉ trong 3 tiếng trước', () => {
    expect(trangThaiGioVang(luc(16, 59)).truocPhut).toBeNull();
    expect(trangThaiGioVang(luc(17, 0)).truocPhut).toBe(180);
    expect(trangThaiGioVang(luc(18, 45)).truocPhut).toBe(75);
    expect(dinhDangCon(75)).toBe('1:15');
    expect(dinhDangCon(5)).toBe('0:05');
  });

  it('hỏi bật nhắc: chỉ app có chuông, chưa bật, vừa thắng; tối đa 2 lần, cách ≥ 7 ngày', () => {
    const co = { coChuong: true, gvBat: false, vuaThang: true, laApp: true, now: 1_000_000_000_000 };
    expect(nenHoiNhac({ ...co, daHoi: { lan: 0, luc: 0 } })).toBe(true);
    expect(nenHoiNhac({ ...co, laApp: false, daHoi: { lan: 0, luc: 0 } })).toBe(false);
    expect(nenHoiNhac({ ...co, coChuong: false, daHoi: { lan: 0, luc: 0 } })).toBe(false);
    expect(nenHoiNhac({ ...co, gvBat: true, daHoi: { lan: 0, luc: 0 } })).toBe(false);
    expect(nenHoiNhac({ ...co, vuaThang: false, daHoi: { lan: 0, luc: 0 } })).toBe(false);
    expect(nenHoiNhac({ ...co, daHoi: { lan: 1, luc: co.now - HOI_CACH_MS + 1 } })).toBe(false);
    expect(nenHoiNhac({ ...co, daHoi: { lan: 1, luc: co.now - HOI_CACH_MS } })).toBe(true);
    expect(nenHoiNhac({ ...co, daHoi: { lan: 2, luc: 0 } })).toBe(false);
  });
});
