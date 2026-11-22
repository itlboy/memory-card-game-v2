import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import VachCho from '@/components/VachCho.vue';
import MoiOnline from '@/components/MoiOnline.vue';
import type { NguoiOnline } from '@/lib/sanh';

/**
 * THÁCH ĐẤU Ở BẢNG XẾP HẠNG + NÚT MỜI CHỜ + THANH EMOJI CỐ ĐỊNH (21.11.2026, mockup duyệt
 * https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG).
 */
const doc = (p: string): string => readFileSync(resolve(__dirname, '../src', p), 'utf8');

describe('nút chờ mời lại (VachCho) — chủ dự án: "mời rồi mà vẫn hiện chữ mời"', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => vi.useRealTimers());

  it('20 giây đầu ghi số giây lời mời còn treo, sau đó đếm tới lúc mời lại; vạch lấp dần; hết giờ báo `xong`', async () => {
    const w = mount(VachCho, { props: { moiDen: 1_000_000 + 20_000, het: 1_000_000 + 120_000, tong: 120_000 } });
    expect(w.text()).toMatch(/20/);
    expect(w.find('i').attributes('style')).toContain('width: 0.0%');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(w.text()).toContain('1:30');
    expect(w.find('i').attributes('style')).toContain('width: 25.0%');
    expect(w.emitted('xong')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(w.emitted('xong')).toHaveLength(1);
  });
});

describe('bảng mời người online', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(5_000_000); });
  afterEach(() => vi.useRealTimers());
  const ds: NguoiOnline[] = [
    { sid: 'a', ten: 'Vừa mời', mat: '🐯', tt: 'chu', daMoi: 14_000, choMoi: 114_000 },
    { sid: 'b', ten: 'Chờ mời lại', mat: '🐧', tt: 'choi', choMoi: 46_000 },
    { sid: 'c', ten: 'Rảnh', mat: '🦁', tt: 'chu' },
    { sid: 'd', ten: 'Để sau', mat: '🐰', tt: 'chu', tuChoi: true }
  ];

  it('người đang trong khoảng chờ thì KHÔNG có nút Mời (vạch chờ thay chỗ); người đã "Để sau" không có nút', () => {
    const w = mount(MoiOnline, { props: { ds, ma: '482913', token: 't' }, global: { stubs: { teleport: true } } });
    const dong = w.findAll('.mo-ds li');
    expect(dong).toHaveLength(4);
    expect(dong[0]!.find('.vach-cho').exists()).toBe(true);
    expect(dong[0]!.find('button').exists()).toBe(false);
    expect(dong[1]!.find('.vach-cho').text()).toContain('0:46');
    expect(dong[2]!.find('button.mo-nut').exists()).toBe(true);
    expect(dong[3]!.find('button').exists()).toBe(false);
    expect(dong[3]!.find('.mo-tc').exists()).toBe(true);
  });

  it('đếm ngược chạy theo đồng hồ (số server đổi ra mốc tuyệt đối lúc nhận, không đứng yên)', async () => {
    const w = mount(MoiOnline, { props: { ds, ma: '482913', token: 't' }, global: { stubs: { teleport: true } } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(w.findAll('.mo-ds li')[1]!.find('.vach-cho').text()).toContain('0:36');
    // hết chờ → nút Mời sáng lại
    await vi.advanceTimersByTimeAsync(40_000);
    expect(w.findAll('.mo-ds li')[1]!.find('button.mo-nut').exists()).toBe(true);
  });
});

describe('bảng xếp hạng: chữ gọn, online, thách đấu (cấu trúc)', () => {
  const b = doc('components/BangXepHang.vue');
  it('nút Thách chỉ ở người rảnh (có sid), không ở dòng mình, ẩn khi mình đang ở phòng online', () => {
    expect(b).toContain('const thachDuoc = (d: DongBxh): boolean => !!d.ol?.sid && !d.toi && !trongPhongOnline.value;');
    expect(b.match(/v-if="thachDuoc\(/g)?.length).toBe(4);   // bục, top, 3 người chót, danh sách lọc người online (22.11.2026)
    // Lọc người online: dòng "N người đang online" là nút bật/tắt, bật thì chỉ còn người online kèm hạng thật
    expect(b).toContain(':aria-pressed="chiOnline"');
    expect(b).toMatch(/const dsOnline = computed[\s\S]{0,400}filter\(\(x\) => x\.d\.ol && !x\.d\.toi\)/);
  });
  it('chữ dòng bằng cỡ tên trên bục; chấm online nhỏ 6px; "Đang chơi" nằm trong ô tên (bên phải tên)', () => {
    expect(b).toMatch(/\.bxh \.ten, \.toi-dong \.ten \{ font-size: 12\.5px; font-weight: 800; \}/);
    expect(b).toMatch(/\.bn \.tn \{ font-weight: 800; font-size: 12px;/);
    expect(b).toMatch(/\.dot \{[^}]*width: 6px; height: 6px;/);
    expect(b).toMatch(/<span class="ten"><span class="tt">\{\{ ten\(d\) \}\}<\/span>[^\n]*class="dang-choi"/);
  });
  it('server gắn trạng thái online SAU cache (mỗi lần đọc) và không lộ định danh bền', () => {
    const tk = readFileSync(resolve(__dirname, '../../node-server/src/taikhoan.ts'), 'utf8');
    expect(tk).toMatch(/function dongCongKhai[\s\S]*?const ol = online\?\.\(`\$\{khach \? 'k' : 'u'\}:\$\{k\}`\)/);
    const sanh = readFileSync(resolve(__dirname, '../../node-server/src/sanh.ts'), 'utf8');
    expect(sanh).toContain("return k.tt === 'phong' ? { ban: true } : { sid: k.sid, ban: false };");
  });
  it('thách xong: phòng GIỮ công khai (chủ dự án) và mời đúng người với cờ thách', () => {
    const o = doc('components/OnlineScreen.vue');
    expect(o).toContain('const kq = await moiNguoi(ma, o.layToken(), n.sid, true);');
    const khoi = o.slice(o.indexOf('const LOI_THACH'), o.indexOf('const kq = await moiNguoi(ma, o.layToken(), n.sid, true);'));
    expect(khoi).not.toContain('datCongKhai');
  });
});

describe('thanh emoji cố định đáy màn (một chỗ cho phòng chờ, ván, kết quả)', () => {
  it('phòng chờ và ván online dùng EmojiDock + chừa chỗ; hộp kết quả không còn thanh riêng', () => {
    const os = doc('components/OnlineScreen.vue');
    const og = doc('components/OnlineGame.vue');
    const rd = doc('components/ResultDialog.vue');
    for (const s of [os, og]) {
      expect(s).toContain('<EmojiDock :o="o" />');
      expect(s).toContain('class="eb-cho"');
      expect(s).not.toContain('<EmojiBar');
    }
    expect(rd).not.toContain('slot name="chat"');
    expect(rd).toContain(".overlay.co-dock { padding-bottom: calc(20px + var(--eb-dock-h, 42px)");
  });
  it('thanh nằm trong #app, đáy cột, trên lớp phủ kết quả (17), dưới hộp thoại khác (≥20)', () => {
    const d = doc('components/EmojiDock.vue');
    expect(d).toContain('<Teleport to="#app"');
    expect(d).toMatch(/\.eb-dock \{\s*position: absolute; left: 0; right: 0; bottom: 0; z-index: 18;/);
    // 23.11.2026: thanh chỉ là hàng nút (42px), KHÔNG dải nền — dải nền cộng vùng an toàn đáy iPhone thành 82px và đè nút
    expect(doc('styles/global.css')).toMatch(/--eb-dock-h: 42px;/);
    expect(d.slice(d.indexOf('.eb-dock {'))).not.toMatch(/background|border-top|backdrop-filter/);
    // lún vào vùng an toàn đáy tối đa 18px; chỗ chừa của màn trên trừ đúng phần đó
    expect(doc('styles/global.css')).toContain('--eb-lun: min(18px, env(safe-area-inset-bottom, 0px));');
    expect(doc('styles/global.css')).toContain('.eb-cho { flex: none; height: calc(var(--eb-dock-h, 42px) - var(--eb-lun, 0px)); }');
  });
});

// LỌC NGƯỜI ONLINE (22.11.2026): dựng bảng thật với dữ liệu giả, bấm nút "N người đang online"
describe('bảng xếp hạng: lọc người online', () => {
  it('bật lọc → chỉ còn người online (kể cả top 3 và người chót) kèm hạng thật + nút Thách; tắt lọc → bảng đủ', async () => {
    vi.resetModules();
    const dong = (i: number, ol?: { sid?: string; ban: boolean }, toi = false) => ({ name: `N${i}`, mat: '🦊', totalScore: 1000 - i * 10, wins: 5, matches: 9, ...(ol ? { ol } : {}), ...(toi ? { toi: true } : {}) });
    const top = [dong(1), dong(2, { sid: 's2', ban: false }), dong(3), dong(4, undefined, true), dong(5, { ban: true }), dong(6)];
    const cuoi = [{ ...dong(40, { sid: 's40', ban: false }), hang: 40 }, { ...dong(41), hang: 41 }];
    vi.doMock('@/lib/taikhoan', async (goc) => ({
      ...(await goc<typeof import('@/lib/taikhoan')>()),
      bxhLanTruoc: () => null,
      bangXepHang: async () => ({ top, cuoi, tong: 41, toi: null })
    }));
    const { default: BangXepHang } = await import('@/components/BangXepHang.vue');
    const w = mount(BangXepHang, { global: { stubs: { teleport: true } } });
    await new Promise((r) => setTimeout(r, 30));
    await w.vm.$nextTick();
    const nut = w.find('button.loc');
    expect(nut.exists(), 'có người online thì có nút lọc').toBe(true);
    expect(nut.attributes('aria-pressed')).toBe('false');
    expect(w.find('.buc').exists()).toBe(true);
    await nut.trigger('click');
    expect(w.find('button.loc').attributes('aria-pressed')).toBe('true');
    expect(w.find('.buc').exists(), 'đang lọc thì bục top 3 ẩn').toBe(false);
    const hang = w.findAll('ol.bxh li').map((li) => li.find('.hang').text());
    expect(hang).toEqual(['2', '5', '40']);
    // Người rảnh có nút Thách; người "Đang chơi" thì không
    expect(w.findAll('ol.bxh li').map((li) => li.find('button.td').exists())).toEqual([true, false, true]);
    await w.find('button.loc').trigger('click');
    expect(w.find('.buc').exists()).toBe(true);
    w.unmount();
    vi.doUnmock('@/lib/taikhoan');
  });
});
