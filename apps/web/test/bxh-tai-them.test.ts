import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { catTrangBxh, ghepTop } from '../../node-server/src/taikhoan';

/**
 * BẢNG XẾP HẠNG TẢI THÊM KHI CUỘN + LỌC NGƯỜI ONLINE (23.11.2026, chủ dự án: "bảng xếp hạng có thể lazyload để load thêm
 * những người đang ẩn", "filter đi để mời thách đấu cho dễ").
 */
const nguoi = (i: number, diem: number, khach = false) => ({ k: String(i), la_khach: khach ? 1 : 0, name: `N${i}`, total_score: diem, wins: i % 3, matches: 9 });

describe('server: cắt trang tải thêm', () => {
  // 63 người, NHIỀU chỗ hoà điểm (điểm chia nhóm 4) — chỗ dễ lặp/hụt nhất
  const tat = Array.from({ length: 63 }, (_, i) => nguoi(i + 1, 1000 - Math.floor(i / 4) * 10, i % 2 === 0));
  const xep = [...tat].sort((a, b) => b.total_score - a.total_score || b.wins - a.wins);
  const top = ghepTop(tat);
  const cuoi = [...tat].sort((a, b) => a.total_score - b.total_score || a.wins - b.wins).slice(0, 3).reverse();
  const khoa = (r: Record<string, unknown>) => `${r.la_khach}:${r.k}`;

  it('các trang nối nhau: không lặp ai, không hụt ai, hạng liền nhau, không đụng top và 3 người chót', () => {
    const thay = new Map<string, number>();
    top.forEach((r, i) => thay.set(khoa(r), i + 1));
    cuoi.forEach((r, i) => thay.set(khoa(r), 61 + i));
    let tu = 20, vong = 0, het = false;
    while (!het && vong++ < 10) {
      // server lấy `tu + 25` dòng đầu mỗi bảng — ở đây đưa đủ cả bảng theo thứ tự KHÁC (đảo) để thử chỗ hoà điểm
      const t = catTrangBxh([...xep].reverse(), top, cuoi, tat.length, tu);
      t.dong.forEach(({ r, hang }, i) => {
        expect(hang).toBe(tu + i + 1);
        expect(thay.has(khoa(r)), `lặp ${khoa(r)} ở hạng ${hang}`).toBe(false);
        thay.set(khoa(r), hang);
      });
      het = t.het; tu += t.dong.length;
      if (!t.dong.length) break;
    }
    expect(het).toBe(true);
    expect(thay.size).toBe(63);
    expect([...thay.values()].sort((a, b) => a - b)).toEqual(Array.from({ length: 63 }, (_, i) => i + 1));
  });

  it('điểm không tăng khi đi xuống các trang', () => {
    const t1 = catTrangBxh(xep, top, cuoi, tat.length, 20), t2 = catTrangBxh(xep, top, cuoi, tat.length, 40);
    const diem = [...t1.dong, ...t2.dong].map((x) => Number(x.r.total_score));
    expect(diem).toEqual([...diem].sort((a, b) => b - a));
    expect(Number(top[top.length - 1]!.total_score)).toBeGreaterThanOrEqual(diem[0]!);
    expect(t1.het).toBe(false);
    expect(t2.het).toBe(true);     // 40 người giữa = 2 trang
  });

  it('bảng ngắn (≤ top + 3) thì không có trang nào; app cũ không gửi `tu` không chạy vào đây', () => {
    const it8 = tat.slice(0, 8);
    expect(catTrangBxh(it8, ghepTop(it8), it8.slice(-3), 8, 20)).toEqual({ dong: [], het: true });
    expect(catTrangBxh(tat, top, cuoi, tat.length, 0).dong).toEqual([]);
  });
});

describe('app: bảng xếp hạng', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('@/lib/taikhoan'); });

  async function dung(opts: { toiHang?: number } = {}) {
    vi.resetModules();
    const dong = (h: number, them: Record<string, unknown> = {}) => ({ name: `N${h}`, mat: '🦊', totalScore: 2000 - h * 10, wins: 5, matches: 9, ...them });
    const top = Array.from({ length: 20 }, (_, i) => dong(i + 1));
    const cuoi = [58, 59, 60].map((h) => ({ ...dong(h), hang: h }));
    const goi: number[] = [];
    const quanSat: (() => void)[] = [];
    vi.stubGlobal('IntersectionObserver', class { constructor(private f: (e: { isIntersecting: boolean }[]) => void) {} observe() { quanSat.push(() => this.f([{ isIntersecting: true }])); } disconnect() {} });
    vi.doMock('@/lib/taikhoan', async (goc) => ({
      ...(await goc<typeof import('@/lib/taikhoan')>()),
      bxhLanTruoc: () => null,
      bangXepHang: async () => ({ top, cuoi, toi: opts.toiHang ? { hang: opts.toiHang, tong: 60, ...dong(opts.toiHang), tren: null, duoi: null } : undefined }),
      bxhOnline: async () => [{ ...dong(33, { ol: { sid: 's33', ban: false } }), hang: 33 }, { ...dong(2, { ol: { ban: true } }), hang: 2 }],
      trangBxh: async (_l: string, _w: unknown, tu: number) => {
        goi.push(tu);
        const ds = Array.from({ length: 20 }, (_, i) => tu + i + 1).filter((h) => h < 58).map((h) => ({ ...dong(h, h === opts.toiHang ? { toi: true } : {}), hang: h }));
        return { ds, het: tu + 20 >= 57 };
      }
    }));
    const { default: BangXepHang } = await import('@/components/BangXepHang.vue');
    const w = mount(BangXepHang, { global: { stubs: { teleport: true } }, attachTo: document.body });
    const cho = async () => { await new Promise((r) => setTimeout(r, 20)); await w.vm.$nextTick(); };
    await cho();
    const cuon = async () => { const f = quanSat.pop(); quanSat.length = 0; f?.(); await cho(); };
    return { w, goi, cuon, cho };
  }
  const hangHien = (w: { findAll(s: string): { find(s: string): { text(): string } }[] }) => w.findAll('ol.bxh > li:not(.cho-them):not(.cham)').map((li) => li.find('.hang').text());

  it('giữa top và 3 người chót là vùng xương tự tải; cuộn tới thì nối 20 dòng một, giáp người chót thì vùng đó mất', async () => {
    const { w, goi, cuon } = await dung();
    expect(w.find('li.cho-them').exists(), 'chưa tải: có vùng xương thay dòng ···').toBe(true);
    expect(w.find('li.cham').exists()).toBe(false);
    expect(w.html()).not.toMatch(/Tải thêm|Load more/);     // KHÔNG có nút bấm
    await cuon();
    expect(goi).toEqual([20]);
    expect(hangHien(w).slice(-4)).toEqual(['40', '58', '59', '60']);
    expect(w.find('li.cho-them').exists()).toBe(true);
    await cuon();
    expect(goi).toEqual([20, 40]);
    const h = hangHien(w).map(Number);
    expect(h).toEqual(Array.from({ length: 57 }, (_, i) => i + 4));          // 4…60 liền nhau, không lặp với 3 người chót
    expect(w.find('li.cho-them').exists(), 'giáp 3 người chót: hết vùng tải').toBe(false);
    w.unmount();
  });

  it('dòng mình ngoài top: ghim ở đáy cho tới khi tải tới đúng vị trí thì ghim ẩn (không hiện hai lần)', async () => {
    const { w, cuon } = await dung({ toiHang: 35 });
    expect(w.find('.ghim').exists()).toBe(true);
    await cuon();
    expect(w.find('.ghim').exists()).toBe(false);
    expect(w.findAll('ol.bxh li.toi').length).toBe(1);
    w.unmount();
  });

  it('nút lọc luôn hiện; bật thì ra MỌI người online kèm hạng thật (cả người ngoài top 20) + nút Thách cho người rảnh', async () => {
    const { w } = await dung();
    const nut = w.find('button.loc');
    expect(nut.exists()).toBe(true);
    expect(nut.attributes('disabled')).toBeUndefined();
    await nut.trigger('click');
    expect(w.find('.buc').exists()).toBe(false);
    expect(w.findAll('ol.bxh li').map((li) => li.find('.hang').text())).toEqual(['33', '2']);
    expect(w.findAll('ol.bxh li').map((li) => li.find('button.td').exists())).toEqual([true, false]);
    w.unmount();
  });
});
