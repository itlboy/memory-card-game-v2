import type { Summary } from '@mm/engine';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, byId, earned } from '@/lib/achievements';

const summary = (over: Partial<Summary> = {}): Summary => ({
  status: 'won', reason: 'cleared', score: 1000, moves: 8, seconds: 20,
  timeBonus: 0, bestStreak: 8, stars: 3, ranking: [], ...over
});

const ctx = (over = {}) => ({
  summary: summary(), mode: 'classic', cells: 16, misses: 2, livesLeft: Infinity, ...over
});

describe('xét thành tích', () => {
  it('thua thì không mở thành tích nào', () => {
    expect(earned(ctx({ summary: summary({ status: 'lost', reason: 'timeout' }), misses: 0 }))).toEqual([]);
  });

  it('Trí nhớ siêu phàm: thắng không lật sai lần nào', () => {
    expect(earned(ctx({ misses: 0 }))).toContain('flawless');
    expect(earned(ctx({ misses: 1 }))).not.toContain('flawless');
  });

  it('Tốc độ ánh sáng: xong lưới 4×4 dưới 30 giây', () => {
    expect(earned(ctx({ summary: summary({ seconds: 29 }), cells: 16 }))).toContain('lightspeed');
    expect(earned(ctx({ summary: summary({ seconds: 30 }), cells: 16 }))).not.toContain('lightspeed');
    // Lưới khác 4×4 không tính, dù nhanh hơn
    expect(earned(ctx({ summary: summary({ seconds: 5 }), cells: 36 }))).not.toContain('lightspeed');
  });

  it('Bậc thầy combo: chuỗi từ 6 cặp liên tiếp', () => {
    expect(earned(ctx({ summary: summary({ bestStreak: 6 }) }))).toContain('combo-master');
    expect(earned(ctx({ summary: summary({ bestStreak: 5 }) }))).not.toContain('combo-master');
  });

  it('Người sống sót: thắng Sinh tồn còn nguyên 5 mạng', () => {
    expect(earned(ctx({ mode: 'survival', livesLeft: 5 }))).toContain('survivor');
    expect(earned(ctx({ mode: 'survival', livesLeft: 4 }))).not.toContain('survivor');
    expect(earned(ctx({ mode: 'classic', livesLeft: 5 }))).not.toContain('survivor');
  });

  it('Thần nhãn: thắng chế độ Chớp nhoáng', () => {
    expect(earned(ctx({ mode: 'peek' }))).toContain('blind-seer');
    expect(earned(ctx({ mode: 'classic' }))).not.toContain('blind-seer');
  });

  it('Chiến dịch: mốc màn 10 và mốc 3 sao', () => {
    expect(earned(ctx({ mode: 'campaign', levelId: 10 }))).toContain('campaign-10');
    expect(earned(ctx({ mode: 'campaign', levelId: 9 }))).not.toContain('campaign-10');
    expect(earned(ctx({ mode: 'campaign', levelId: 1 }))).toContain('three-star');
    expect(earned(ctx({ mode: 'campaign', levelId: 1, summary: summary({ stars: 2 }) })))
      .not.toContain('three-star');
    // Chế độ khác không xét sao dù summary có stars = 3
    expect(earned(ctx({ mode: 'classic' }))).not.toContain('three-star');
  });

  it('một ván có thể mở nhiều thành tích cùng lúc', () => {
    const got = earned(ctx({ mode: 'campaign', levelId: 12, misses: 0, cells: 16 }));
    expect(got).toEqual(expect.arrayContaining(['flawless', 'lightspeed', 'combo-master', 'campaign-10', 'three-star']));
  });

  it('mọi id sinh ra đều có mô tả trong danh sách', () => {
    const ids = new Set([
      ...earned(ctx({ mode: 'campaign', levelId: 20, misses: 0, cells: 16 })),
      ...earned(ctx({ mode: 'survival', livesLeft: 5 })),
      ...earned(ctx({ mode: 'peek' }))
    ]);
    for (const id of ids) expect(byId(id), id).toBeDefined();
    expect(ACHIEVEMENTS.every((a) => a.name && a.hint)).toBe(true);
  });

  it('id không tồn tại thì trả về undefined', () => {
    expect(byId('khong-co')).toBeUndefined();
  });
});
