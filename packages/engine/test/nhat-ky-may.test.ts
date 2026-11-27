import { describe, expect, it } from 'vitest';
import { dongNhatKy } from '../src/nhat-ky-may.js';

const may = { an: -1, hien: -1, nen: 0, matMang: -1, coMang: -1, treo: 0, treoMs: 0 };

describe('dongNhatKy — nhật ký máy gửi lên khi có sự cố online', () => {
  it('ghi gọn: bỏ những mốc không xảy ra', () => {
    expect(dongNhatKy('noi_lai', 1006, 3, may)).toBe('noi_lai · mã 1006 · 3s');
  });

  it('đủ mốc: nền, mất mạng, treo, chạm, lỗi', () => {
    const d = dongNhatKy('tim_bo_luot', undefined, 7, { ...may, an: 12, hien: 2, nen: 1, matMang: 9, treo: 2, treoMs: 3400, cham: 0, loi: 'TypeError: x is null' });
    expect(d).toBe('tim_bo_luot · 7s · ẩn 12s trước · hiện 2s trước · đang ở nền · mất mạng 9s trước · treo 2 lần, dài nhất 3400ms · chạm 0 · lỗi "TypeError: x is null"');
  });

  it('không tin client: loại lạ, thiếu nhật ký → bỏ', () => {
    expect(dongNhatKy('xoa_db', 1006, 1, may)).toBeNull();
    expect(dongNhatKy('noi_lai', 1006, 1, null)).toBeNull();
    expect(dongNhatKy('noi_lai', 1006, 1, 'chuỗi')).toBeNull();
  });

  it('kẹp số, lọc ký tự lạ trong lỗi (không chèn được dòng log giả)', () => {
    const d = dongNhatKy('noi_lai', 99999, -5, { ...may, treo: 1e9, treoMs: 1e12, loi: 'a\n[phòng] 123 giả\u0000"x"' + 'y'.repeat(300) })!;
    expect(d).toContain('mã 4999');
    expect(d).toContain('· 0s');
    expect(d).toContain('treo 99 lần, dài nhất 600000ms');
    expect(d).not.toContain('\n');
    expect(d).not.toContain('[');
    expect(d.length).toBeLessThan(220);
  });
});
