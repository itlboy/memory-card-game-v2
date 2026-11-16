import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Summary } from '@mm/engine';
import ResultDialog from '@/components/ResultDialog.vue';

/*
 * BẢNG TỶ SỐ CẢ LOẠT Ở MÀN KẾT QUẢ (mockup duyệt 16.11.2026).
 * Lỗi cũ: chỉ hiện từ ván 2 (`total < 2` thì ẩn) và là dòng chữ nhạt có 🏅 — hết ván 1 không
 * thấy tỷ số, sang ván 2 bàn chơi lại hiện 1–0. Giờ hiện ngay từ ván đầu, cùng luật màu bàn chơi.
 */
const van = (ranking: Summary['ranking']): Summary => ({
  status: 'won', reason: 'cleared', score: 0, moves: 6, seconds: 20, timeBonus: 0, bestStreak: 0, stars: 0, ranking
});
const kien = { id: 'p1', name: 'Kiên', score: 320, pairs: 8, bestStreak: 3 };
const an = { id: 'p2', name: 'An', score: 180, pairs: 4, bestStreak: 2 };
const binh = { id: 'p3', name: 'Bình', score: 90, pairs: 2, bestStreak: 1 };
const dung = (props: Record<string, unknown>) => mount(ResultDialog, {
  props: {
    summary: van([kien, an]), isRecord: false, showStars: false, multiplayer: true, freshAchievements: [],
    totalBefore: 0, totalAfter: 0, hasNext: false, ...props
  }
});
const so = (w: ReturnType<typeof dung>) => w.findAll('.loat-o').map((o) => [o.text(), o.classes('dan')]);

describe('tỷ số loạt ở màn kết quả', () => {
  it('hết VÁN ĐẦU đã hiện 1 – 0, người dẫn xanh', () => {
    const w = dung({ seriesWins: { Kiên: 1 } });
    expect(w.find('.loat').exists()).toBe(true);
    expect(so(w)).toEqual([['1', true], ['0', false]]);
    expect(w.text()).not.toContain('🏅');
  });

  it('hoà loạt 1 – 1: không ai xanh', () => {
    expect(so(dung({ seriesWins: { Kiên: 1, An: 1 } }))).toEqual([['1', false], ['1', false]]);
  });

  it('xếp theo CHỖ NGỒI, không theo hạng ván (cột không nhảy chỗ)', () => {
    const w = dung({ summary: van([an, kien]), nguoiChoi: [kien, an], seriesWins: { Kiên: 1, An: 2 } });
    expect(w.findAll('.loat-ten').map((e) => e.text())).toEqual(['Kiên', 'An']);
    expect(so(w)).toEqual([['1', false], ['2', true]]);
  });

  it('bàn 3 người: mỗi người một cột, có cả người 0', () => {
    const w = dung({ summary: van([kien, binh, an]), nguoiChoi: [kien, an, binh], seriesWins: { Kiên: 2, Bình: 1 } });
    expect(w.find('.loat-nhieu').exists()).toBe(true);
    expect(so(w)).toEqual([['2', true], ['0', false], ['1', false]]);
  });

  it('hai chữ số vẫn đủ', () => {
    expect(so(dung({ seriesWins: { Kiên: 12, An: 10 } }))).toEqual([['12', true], ['10', false]]);
  });

  it('chơi một mình: không có bảng', () => {
    expect(dung({ multiplayer: false, summary: van([kien]), seriesWins: { Kiên: 3 } }).find('.loat').exists()).toBe(false);
  });
});
