import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RulesDialog from '@/components/RulesDialog.vue';

/**
 * NÚT DEBUG KHÔNG NẰM SẴN TRÊN MÀN (14.10.2026: "lộ quá"). Bật bằng 7 chạm liên
 * tiếp vào dòng phiên bản; đang bật thì nút hiện ra để tắt.
 */
describe('cửa bí mật vào chế độ debug', () => {
  it('debug tắt thì không có nút bật nào trên màn', () => {
    const w = mount(RulesDialog, { props: { debug: false } });
    expect(w.find('.nut-do').exists()).toBe(false);
  });

  it('chạm 7 lần vào dòng phiên bản thì bật — 6 lần thì chưa', async () => {
    const w = mount(RulesDialog, { props: { debug: false } });
    const dong = w.find('p.build');
    for (let i = 0; i < 6; i++) await dong.trigger('click');
    expect(w.emitted('update:debug')).toBeUndefined();
    await dong.trigger('click');
    expect(w.emitted('update:debug')).toEqual([[true]]);
  });

  it('đang bật thì có nút để tắt', async () => {
    const w = mount(RulesDialog, { props: { debug: true } });
    await w.find('.nut-do').trigger('click');
    expect(w.emitted('update:debug')).toEqual([[false]]);
  });
});
