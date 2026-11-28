import { beforeEach, describe, expect, it } from 'vitest';
import { byId, earnedTim, iconCua, mocDong, xetThongKe, type ThongKe, type VanTim } from '@/lib/achievements';
import { store } from '@/lib/storage';

/** DANH HIỆU TÌM THẺ (đợt 2, 29.11.2026): theo ván + đếm dồn (có mốc động), bộ đếm riêng trong bản lưu. */
const tk = (o: Partial<ThongKe> = {}): ThongKe => ({
  wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 0, stars3: 0, hoanHao: 0, soNgay: 0, soVan: 0,
  timVan: 0, timDung: 0, timOnline: 0, ...o
});
const van = (o: Partial<VanTim> = {}): VanTim => ({ soThe: 5, doKho: 'vua', dung: 6, soLuot: 10, doiThu: 'mot', ketQua: 'xong', thongKe: tk(), ...o });

beforeEach(() => { localStorage.clear(); });

describe('danh hiệu Tìm Thẻ theo ván', () => {
  it('ván đầu: Mắt tinh; chưa đúng lượt nào thì chưa tính', () => {
    expect(earnedTim(van())).toContain('tim-dau');
    expect(earnedTim(van({ dung: 0 }))).not.toContain('tim-dau');
  });

  it('10/10: "Không trượt" đúng cỡ bàn; tốc độ Nhanh + bàn ≥ 5 thêm Chớp nhoáng', () => {
    const a = earnedTim(van({ soThe: 7, dung: 10, doKho: 'kho' }));
    expect(a).toEqual(expect.arrayContaining(['tim-10-7', 'tim-nhanh']));
    expect(a).not.toContain('tim-10-5');
    expect(earnedTim(van({ soThe: 4, dung: 10, doKho: 'kho' }))).not.toContain('tim-nhanh');   // bàn 4 thẻ quá dễ
    expect(earnedTim(van({ soThe: 5, dung: 9 }))).not.toContain('tim-10-5');
  });

  it('Phản xạ: lượt đúng nhanh nhất dưới 1 giây', () => {
    expect(earnedTim(van({ nhanhNhatMs: 840 }))).toContain('tim-phan-xa');
    expect(earnedTim(van({ nhanhNhatMs: 1000 }))).not.toContain('tim-phan-xa');
    expect(earnedTim(van({ nhanhNhatMs: null }))).not.toContain('tim-phan-xa');
  });

  it('thắng máy mạnh (bàn ≥ 5): mức cao mở luôn mức thấp hơn; thua / online không tính', () => {
    expect(earnedTim(van({ doiThu: 'divine', ketQua: 'thang' }))).toEqual(expect.arrayContaining(['tim-may-hard', 'tim-may-insane', 'tim-may-divine']));
    expect(earnedTim(van({ doiThu: 'normal', ketQua: 'thang' }))).not.toContain('tim-may-hard');
    expect(earnedTim(van({ doiThu: 'hard', ketQua: 'thua' }))).not.toContain('tim-may-hard');
    expect(earnedTim(van({ doiThu: 'hard', ketQua: 'thang', soThe: 4 }))).not.toContain('tim-may-hard');
  });
});

describe('danh hiệu Tìm Thẻ đếm dồn + mốc động', () => {
  it('tổng lượt đúng / số ván / thắng online theo mốc cố định', () => {
    const a = xetThongKe(tk({ timDung: 260, timVan: 26, timOnline: 1 }));
    expect(a).toEqual(expect.arrayContaining(['tim-dung-50', 'tim-dung-100', 'tim-dung-250', 'tim-van-10', 'tim-van-25', 'tim-online-1']));
    expect(a).not.toContain('tim-dung-500');
  });

  it('không trần: vượt mốc cố định cuối vẫn có mốc động (lượt đúng +1000, ván +250, online +25)', () => {
    const a = xetThongKe(tk({ timDung: 13_000, timVan: 1_300, timOnline: 280 }));
    expect(a).toEqual(expect.arrayContaining(['tim-dung-11000', 'tim-dung-13000', 'tim-van-1250', 'tim-online-275']));
    expect(mocDong('tim-dung-11000')?.nhom).toBe('tim-the');
    expect(mocDong('tim-dung-1500')).toBeUndefined();      // không đúng bước
    expect(mocDong('tim-dung-1000')).toBeUndefined();      // trùng mốc cố định
    expect(byId('tim-dung-1000')?.nhom).toBe('tim-the');   // byId vẫn ra mốc cố định
  });

  it('mọi danh hiệu nhóm có tên, gợi ý và icon riêng (không rơi về 🏅)', () => {
    for (const id of ['tim-dau', 'tim-10-3', 'tim-nhanh', 'tim-phan-xa', 'tim-may-divine', 'tim-dung-50', 'tim-van-10', 'tim-online-1', 'tim-online-10']) {
      const a = byId(id)!;
      expect(a.name, id).not.toMatch(/^dh\./);
      expect(a.hint, id).not.toMatch(/^dh\./);
      expect(iconCua(a).chu, id).not.toBe('🏅');
    }
  });
});

describe('bộ đếm Tìm Thẻ trong bản lưu', () => {
  it('ván Tìm Thẻ cộng số ván + lượt đúng; thắng online cộng timOnline; ván ghép cặp không đụng', () => {
    store.ghiVanBoDem({ thang: false, tim: { dung: 7 } });
    store.ghiVanBoDem({ thang: true, online: true, tim: { dung: 9 } });
    store.ghiVanBoDem({ thang: true });
    const b = store.boDem();
    expect([b.timVan, b.timDung, b.timOnline, b.van]).toEqual([2, 16, 1, 3]);
  });
});
