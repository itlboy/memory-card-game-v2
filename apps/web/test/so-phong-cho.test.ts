import { describe, expect, it } from 'vitest';
import { demPhongCho, nhanSoPhong } from '@/lib/so-phong-cho';
import type { PublicRoom } from '@mm/engine';

/** Số phòng chờ trên ô Online (20.11.2026, mockup C): chỉ phòng CÒN CHỖ và CHƯA vào ván. */
const p = (x: Partial<PublicRoom>): PublicRoom => ({ code: '1', chuPhong: 'A', avatar: '🦊', nguoi: 1, toiDa: 4, the: 16, luc: 0, ...x });
describe('số phòng đang chờ', () => {
  it('bỏ phòng đầy và phòng đang chơi (phòng để xem)', () => {
    expect(demPhongCho([p({}), p({ nguoi: 4 }), p({ dangChoi: true }), p({ nguoi: 2 })])).toBe(2);
  });
  it('0 thì ẩn, từ 10 là "9+"', () => {
    expect(nhanSoPhong(0)).toBe('');
    expect(nhanSoPhong(3)).toBe('3');
    expect(nhanSoPhong(12)).toBe('9+');
  });
});
