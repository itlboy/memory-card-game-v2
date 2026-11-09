import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import DanhHieuDialog from '@/components/DanhHieuDialog.vue';
import { ACHIEVEMENTS } from '@/lib/achievements';

/**
 * MÀN DANH HIỆU LÀM LẠI (09.11.2026, mockup duyệt https://claude.ai/artifact/S6iPWAV8MkwtHe22t58qPf):
 * bộ lọc Tất cả · Đã có · Chưa có (mặc định Tất cả), lưới huy chương, KHÔNG nút trong lưới —
 * chạm huy chương mới mở tờ chi tiết có nút "Chinh phục".
 */
const tk = { wins: 3, botWins: 0, onlineWins: 0, totalScore: 600, chuoiNgay: 2, campaignMax: 3, stars3: 1 };
const ten = (id: string): string => ACHIEVEMENTS.find((a) => a.id === id)!.name;

describe('màn danh hiệu', () => {
  it('mặc định Tất cả; lọc Đã có / Chưa có không chồng nhau', async () => {
    const daCo = new Set(['first-win', 'giay-cuoi']);
    const w = mount(DanhHieuDialog, { props: { daCo, tk, themeKhoa: new Set<string>() }, attachTo: document.body });
    const tabs = w.findAll('.tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.attributes('aria-selected')).toBe('true');
    // Sắp đạt: có tiến độ dở (3 ván thắng / mốc 10) thì hiện, tối đa 3 dòng
    const gan = w.findAll('.gan li');
    expect(gan.length).toBeGreaterThan(0);
    expect(gan.length).toBeLessThanOrEqual(3);
    expect(tabs[1]!.text()).toContain('Đã có (2)');
    const tatCa = w.html();
    for (const id of daCo) expect(tatCa).toContain(ten(id));
    await tabs[1]!.trigger('click'); await nextTick();
    const co = w.html();
    expect(w.findAll('.luoi li')).toHaveLength(2);
    await tabs[2]!.trigger('click'); await nextTick();
    const chua = w.html();
    for (const id of daCo) {
      expect(co).toContain(ten(id));
      expect(chua).not.toContain(ten(id));
    }
    w.unmount();
  });

  it('lưới không có nút Chinh phục; chạm huy chương mới mở tờ chi tiết có nút', async () => {
    const w = mount(DanhHieuDialog, { props: { daCo: new Set<string>(), tk, themeKhoa: new Set<string>() }, attachTo: document.body });
    expect(w.find('.luoi .thach').exists()).toBe(false);
    expect(w.find('.to').exists()).toBe(false);
    await w.find('.luoi .o').trigger('click'); await nextTick();
    expect(w.find('.to').exists()).toBe(true);
    expect(w.find('.to .nut-di').exists()).toBe(true);
    w.unmount();
  });

  it('chưa có danh hiệu nào: lọc Đã có thì báo trống, không báo "có hết"', async () => {
    const w = mount(DanhHieuDialog, { props: { daCo: new Set<string>(), tk, themeKhoa: new Set<string>() }, attachTo: document.body });
    await w.findAll('.tab')[1]!.trigger('click'); await nextTick();
    expect(w.findAll('section')).toHaveLength(0);
    expect(w.find('.xong').text()).toContain('Chưa có danh hiệu nào');
    w.unmount();
  });
});
