import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Summary } from '@mm/engine';
import ResultDialog from '@/components/ResultDialog.vue';

/**
 * BẢNG KẾT QUẢ NÓI KẾT CỤC CỦA MÌNH, KHÔNG NÓI TÊN NGƯỜI THẮNG (khi có "mình").
 *
 * Chủ dự án báo 13.10.2026, có ảnh: thua máy mà bảng ghi "Bot gà cứng thắng! 🏆"
 * kèm BA SAO — đọc lướt như chính mình thắng. `summary.status === 'won'` chỉ nói
 * BÀN ĐÃ SẠCH (CLAUDE.md), nên kết cục của mình phải đi riêng qua `minhKetCuc`.
 */
const thuaMay: Summary = {
  status: 'won', reason: 'cleared', score: 0, moves: 6, seconds: 20, timeBonus: 0, bestStreak: 0, stars: 3,
  ranking: [
    { id: 'bot', name: 'Bot gà cứng', score: 970, pairs: 6, bestStreak: 6 },
    { id: 'p1', name: 'Bạn', score: 0, pairs: 0, bestStreak: 0 }
  ]
};
const dung = (props: Record<string, unknown>) => mount(ResultDialog, {
  props: {
    summary: thuaMay, isRecord: false, showStars: true, multiplayer: true, freshAchievements: [],
    totalBefore: 0, totalAfter: 0, hasNext: true, levelId: 3, ...props
  }
});

describe('bảng kết quả theo góc nhìn của mình', () => {
  it('thua máy: "Bạn thua", không nêu tên máy, không hiện sao', () => {
    const w = dung({ minhKetCuc: 'thua' });
    expect(w.find('#resTitle').text()).toBe('Bạn thua rồi 😢');
    expect(w.find('#resTitle').text()).not.toContain('Bot');
    expect(w.find('.stars').exists()).toBe(false);
  });

  it('thắng máy: "Bạn thắng"', () => {
    const w = dung({ minhKetCuc: 'thang', summary: { ...thuaMay, ranking: [...thuaMay.ranking].reverse() } });
    expect(w.find('#resTitle').text()).toBe('Bạn thắng! 🏆');
  });

  it('hoà là kết cục thứ ba, không rơi vào nhánh thua', () => {
    expect(dung({ minhKetCuc: 'hoa' }).find('#resTitle').text()).toBe('Hoà rồi! 🤝');
  });

  it('nhiều người chung máy (không có "mình"): vẫn nêu tên người thắng', () => {
    const w = dung({ summary: { ...thuaMay, ranking: [
      { id: 'p1', name: 'An', score: 300, pairs: 3, bestStreak: 2 },
      { id: 'p2', name: 'Bình', score: 100, pairs: 1, bestStreak: 1 }] } });
    expect(w.find('#resTitle').text()).toContain('An');
  });
});
