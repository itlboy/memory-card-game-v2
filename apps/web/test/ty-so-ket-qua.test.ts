import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Summary } from '@mm/engine';
import ResultDialog from '@/components/ResultDialog.vue';

/*
 * BẢNG TỶ SỐ CẢ LOẠT Ở MÀN KẾT QUẢ (mockup duyệt 17.11.2026, thay bảng tím 16.11.2026).
 * Hiện ngay từ ván đầu (1 – 0). Mỗi cột một con số to; người dẫn số đậm, người kém số MỜ
 * (`lui`) — không ô màu. Người thắng ván có "+1". Số cặp/chuỗi ẩn sau "Chi tiết ván".
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
    hasNext: false, ...props
  }
});
const so = (w: ReturnType<typeof dung>) => w.findAll('.loat .o-so b').map((o) => [o.text(), !o.classes('lui')]);

describe('tỷ số loạt ở màn kết quả', () => {
  it('hết VÁN ĐẦU đã hiện 1 – 0, người kém số mờ, không chữ "Tỷ số"', () => {
    const w = dung({ seriesWins: { Kiên: 1 } });
    expect(w.find('.loat').exists()).toBe(true);
    expect(so(w)).toEqual([['1', true], ['0', false]]);
    expect(w.text()).not.toContain('🏅');
    expect(w.text()).not.toContain('Tỷ số');
  });

  it('hoà loạt 1 – 1: không ai mờ', () => {
    expect(so(dung({ seriesWins: { Kiên: 1, An: 1 } }))).toEqual([['1', true], ['1', true]]);
  });

  it('người thắng ván này: số CUỘN từ số cũ lên (data-cu), không còn viên "+1"; điểm ván là chữ nhỏ dưới số', () => {
    const w = dung({ seriesWins: { Kiên: 1 } });
    const cot = w.findAll('.loat .cot');
    expect(cot[0]!.find('b.cuon').attributes('data-cu')).toBe('0');
    expect(cot[1]!.find('b.cuon').exists()).toBe(false);
    expect(w.find('.cong').exists()).toBe(false);
    expect(cot[0]!.find('.dm').text()).toBe('320 điểm');
  });

  it('ván hoà: không số nào cuộn', () => {
    const w = dung({ summary: van([kien, { ...an, score: 320, pairs: 8, bestStreak: 3 }]), seriesWins: { Kiên: 1 } });
    expect(w.find('b.cuon').exists()).toBe(false);
  });

  it('số cặp/chuỗi ẩn sau "Chi tiết ván", bấm thì lật chỗ với bảng tỷ số', async () => {
    const w = dung({ seriesWins: { Kiên: 1 }, soVan: 3 });
    expect(w.text()).toContain('Ván 3');
    // Ẩn bằng class `an` (visibility), KHÔNG display:none — hai bảng chồng một ô để khung không nhảy
    const an = (sel: string): boolean => w.find(sel).classes().includes('an');
    expect(an('.ranking')).toBe(true);
    expect(an('.loat')).toBe(false);
    await w.find('.nut-ct').trigger('click');
    expect(an('.ranking')).toBe(false);
    expect(an('.loat')).toBe(true);
    expect(w.find('.ranking small').text()).toBe('8 cặp · chuỗi 3');
    expect(w.find('.nut-ct').text()).toContain('Thu gọn');
  });

  it('chung máy: không sao; không chỗ nào nhắc lại Tổng điểm (TopBar có rồi)', () => {
    const chung = dung({ seriesWins: {}, showStars: true });
    expect(chung.find('.stars').exists()).toBe(false);
    const may = dung({ seriesWins: {}, minhKetCuc: 'thang', showStars: true });
    expect(may.find('.total-row').exists()).toBe(false);
  });

  it('đội: mặt từng thành viên mang neo emoji riêng, ✓ cho người đã bấm Chơi lại', () => {
    const d1 = { id: 'doi-1', name: 'Đội 1', score: 600, pairs: 5, bestStreak: 3, thanhVien: ['a', 'b'] };
    const d2 = { id: 'doi-2', name: 'Đội 2', score: 300, pairs: 3, bestStreak: 2, thanhVien: ['c'] };
    const w = dung({
      summary: van([d1, d2] as never), seriesWins: { 'Đội 1': 2 }, multiplayerOnline: true,
      thanhVienCua: (id: string) => ({ mat: '🐼', ten: id.toUpperCase() }), phieuChoiLai: ['a']
    });
    const cot = w.findAll('.loat .cot');
    expect(cot[0]!.classes()).toContain('d1');
    expect(cot[0]!.findAll('[data-kq-for]').map((e) => e.attributes('data-kq-for'))).toEqual(['a', 'b']);
    expect(cot[0]!.findAll('.mat.ok')).toHaveLength(1);
    expect(cot[0]!.find('.tv').text()).toBe('A · B');
  });

  it('xếp theo CHỖ NGỒI, không theo hạng ván (cột không nhảy chỗ)', () => {
    const w = dung({ summary: van([an, kien]), nguoiChoi: [kien, an], seriesWins: { Kiên: 1, An: 2 } });
    expect(w.findAll('.loat .ten').map((e) => e.text())).toEqual(['Kiên', 'An']);
    expect(so(w)).toEqual([['1', false], ['2', true]]);
  });

  it('bàn 3 người: mỗi người một cột, có cả người 0', () => {
    const w = dung({ summary: van([kien, binh, an]), nguoiChoi: [kien, an, binh], seriesWins: { Kiên: 2, Bình: 1 } });
    expect(w.findAll('.loat .cot')).toHaveLength(3);
    expect(so(w)).toEqual([['2', true], ['0', false], ['1', false]]);
  });

  it('hai chữ số vẫn đủ', () => {
    expect(so(dung({ seriesWins: { Kiên: 12, An: 10 } }))).toEqual([['12', true], ['10', false]]);
  });

  it('chơi một mình: không có bảng', () => {
    expect(dung({ multiplayer: false, summary: van([kien]), seriesWins: { Kiên: 3 } }).find('.loat').exists()).toBe(false);
  });
});
