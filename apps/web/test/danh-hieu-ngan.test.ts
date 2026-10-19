import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import DanhHieuDialog from '@/components/DanhHieuDialog.vue';
import { ACHIEVEMENTS } from '@/lib/achievements';

/**
 * Hai ngăn "Chưa có" · "Đã có" KHÔNG chồng nhau (chủ dự án 12.10.2026: bản cũ
 * "Chưa có" · "Tất cả" thì ngăn thứ hai lặp lại cả ngăn thứ nhất).
 */
const tk = { wins: 3, botWins: 0, onlineWins: 0, totalScore: 600, chuoiNgay: 2, campaignMax: 3, stars3: 1 };

describe('màn danh hiệu: hai ngăn chưa có / đã có', () => {
  it('ngăn Đã có chỉ hiện đúng danh hiệu đã có; hai ngăn cộng lại đủ cả bộ', async () => {
    const daCo = new Set(['first-win', 'giay-cuoi']);
    const w = mount(DanhHieuDialog, { props: { daCo, tk, themeKhoa: new Set<string>() }, attachTo: document.body });
    const tabs = w.findAll('.tab');
    expect(tabs).toHaveLength(2);
    // Ngăn Đã có đứng TRƯỚC và mở sẵn (chủ dự án 19.10.2026)
    expect(tabs[0]!.text()).toContain('Đã có (2)');
    expect(tabs[0]!.attributes('aria-selected')).toBe('true');
    const co = w.html();
    expect(w.findAll('section').length).toBeLessThanOrEqual(2);   // ngăn Đã có: chỉ nhóm có danh hiệu
    await tabs[1]!.trigger('click'); await nextTick();
    const chua = w.html();
    // Cả hai danh hiệu đã có nằm ở ngăn Đã có, không ở ngăn Chưa có
    for (const id of daCo) {
      const ten = ACHIEVEMENTS.find((a) => a.id === id)!.name;
      expect(co).toContain(ten);
      expect(chua).not.toContain(ten);
    }
    w.unmount();
  });

  it('chưa có danh hiệu nào: mở sẵn ngăn Chưa có (không màn trống); bấm Đã có thì báo trống, không báo "có hết"', async () => {
    const w = mount(DanhHieuDialog, { props: { daCo: new Set<string>(), tk, themeKhoa: new Set<string>() }, attachTo: document.body });
    expect(w.findAll('.tab')[1]!.attributes('aria-selected')).toBe('true');
    expect(w.findAll('section').length).toBeGreaterThan(0);
    await w.findAll('.tab')[0]!.trigger('click'); await nextTick();
    expect(w.findAll('section')).toHaveLength(0);
    expect(w.find('.xong').text()).toContain('Chưa có danh hiệu nào');
    w.unmount();
  });
});
