import { describe, expect, it } from 'vitest';
import { byId, mocDong, xetThongKe, type ThongKe } from '@/lib/achievements';

const tk = (o: Partial<ThongKe> = {}): ThongKe => ({
  wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 0, stars3: 0, hoanHao: 0, soNgay: 0, soVan: 0, ...o
});

describe('mốc động (28.11.2026): mỗi bước một danh hiệu, không trần', () => {
  it('980 nghìn xu: đủ các ô 100k…900k, không trùng mốc cố định', () => {
    const co = xetThongKe(tk({ totalScore: 980_000 }));
    for (const n of [200_000, 300_000, 400_000, 600_000, 700_000, 800_000, 900_000]) expect(co).toContain(`score-${n}`);
    // 100k / 500k là mốc cố định (score-100k, score-500000) — không sinh bản động trùng
    expect(co).toContain('score-100k');
    expect(co).toContain('score-500000');
    expect(co.filter((id) => id === 'score-500000')).toHaveLength(1);
    expect(co).not.toContain('score-1000000');
  });

  it('id động hợp lệ dựng được, id sai bước / trùng mốc cố định thì không', () => {
    expect(mocDong('score-1100000')?.name).toBeTruthy();
    expect(mocDong('wins-600')?.nhom).toBe('thang');
    expect(mocDong('bot-wins-75')?.nhom).toBe('may');
    expect(mocDong('so-van-1250')?.nhom).toBe('chuyen-can');
    expect(mocDong('score-150000')).toBeUndefined();    // không chia hết bước
    expect(mocDong('score-500000')).toBeUndefined();    // trùng mốc cố định
    expect(mocDong('wins-abc')).toBeUndefined();
    expect(byId('score-500000')?.id).toBe('score-500000');   // byId vẫn ra mốc cố định
  });

  it('không trần: 123 triệu xu vẫn có mốc', () => {
    expect(xetThongKe(tk({ totalScore: 123_000_000 }))).toContain('score-123000000');
    expect(mocDong('score-123100000')).toBeTruthy();
  });

  it('bậc theo ngưỡng của dãy', () => {
    expect(mocDong('score-200000')?.bac).toBe('bac');
    expect(mocDong('score-8000000')?.bac).toBe('vang');
    expect(mocDong('wins-600')?.bac).toBe('vang');
  });
});
