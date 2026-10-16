import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RulesDialog from '@/components/RulesDialog.vue';
import TopBar from '@/components/TopBar.vue';
import DebugMenu from '@/components/DebugMenu.vue';
import { datPingSo, pingSo } from '@/lib/ping-so';

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
    for (let i = 0; i < 6; i++) await dong.trigger('pointerup');
    expect(w.emitted('update:debug')).toBeUndefined();
    await dong.trigger('pointerup');
    expect(w.emitted('update:debug')).toEqual([[true]]);
  });

  it('đếm bằng pointerup, KHÔNG click — iOS không phát click trên <p>', async () => {
    const w = mount(RulesDialog, { props: { debug: false } });
    for (let i = 0; i < 7; i++) await w.find('p.build').trigger('click');
    expect(w.emitted('update:debug')).toBeUndefined();
  });

  it('đang bật thì có nút để tắt', async () => {
    const w = mount(RulesDialog, { props: { debug: true } });
    await w.find('.nut-do').trigger('click');
    expect(w.emitted('update:debug')).toEqual([[false]]);
  });
});

/** 16.10.2026: bật bằng 7 chạm vào chữ "Cài đặt" trong menu; công cụ debug nằm ngay trong menu. */
describe('chế độ debug trong menu Cài đặt', () => {
  const props = { nen: 'tu' as const, soundLevel: 'high' as const, totalScore: 0 };
  async function moMenu(debug: boolean) {
    const w = mount(TopBar, { props: { ...props, debug }, attachTo: document.body });
    await w.find('.menu-btn').trigger('click');
    return w;
  }

  it('chạm 7 lần vào "Cài đặt" thì bật — 6 lần thì chưa; click không tính', async () => {
    const w = await moMenu(false);
    const nhom = w.find('.menu p.nhom');
    for (let i = 0; i < 7; i++) await nhom.trigger('click');
    for (let i = 0; i < 6; i++) await nhom.trigger('pointerup');
    expect(w.emitted('update:debug')).toBeUndefined();
    await nhom.trigger('pointerup');
    expect(w.emitted('update:debug')).toEqual([[true]]);
    w.unmount();
  });

  it('chạm 7 lần vào dòng "Giao diện" cũng bật debug (chữ Cài đặt nhỏ, hay trượt)', async () => {
    const w = await moMenu(false);
    const gd = w.find('.menu .cham-debug');
    for (let i = 0; i < 6; i++) await gd.trigger('pointerup');
    expect(w.emitted('update:debug')).toBeUndefined();
    await gd.trigger('pointerup');
    expect(w.emitted('update:debug')).toEqual([[true]]);
    w.unmount();
  });

  it('menu KHÔNG chứa công cụ debug; debug bật thì chỉ có nút "🐞 Debug" mở trang riêng', async () => {
    const tat = await moMenu(false);
    expect(tat.find('.nut-debug').exists()).toBe(false);
    tat.unmount();
    const bat = await moMenu(true);
    expect(bat.find('.dbg').exists()).toBe(false);
    await bat.find('.nut-debug').trigger('click');
    expect(bat.emitted('mo-debug')).toHaveLength(1);
    bat.unmount();
  });

  it('bảng đo fps là công tắc riêng; "Về mặc định" tắt hết công tắc thử, "Tắt" tắt debug', async () => {
    datPingSo(true);
    const w = mount(DebugMenu, { props: { doNhip: false } });
    const fps = w.findAll('.dbg-cong').find((b) => /fps/i.test(b.text()))!;
    expect(fps.attributes('aria-checked')).toBe('false');
    await fps.trigger('click');
    expect(w.emitted('update:doNhip')).toEqual([[true]]);
    await w.findAll('.dbg-dau button')[0]!.trigger('click');
    expect(pingSo.value).toBe(false);
    expect(w.emitted('update:doNhip')!.at(-1)).toEqual([false]);
    await w.findAll('.dbg-dau button')[1]!.trigger('click');
    expect(w.emitted('tat')).toHaveLength(1);
  });
});
