import { beforeEach, describe, expect, it } from 'vitest';
import { CHANG_TIM, MAN_TIM, SO_MAN_TIM, moToiTim, quaManTim, saoTim, thieuSaoKe, tongSaoTim } from '@/lib/chien-dich-tim';
import { byId, iconCua, xetThongKe, thongKeHienTai } from '@/lib/achievements';
import { store } from '@/lib/storage';

/** CHIẾN DỊCH TÌM THẺ (đợt 3, 28.11.2026, mockup duyệt https://claude.ai/artifact/BZWf4m2Ma6Tp6rGvnBWJrV). */
beforeEach(() => { localStorage.clear(); });

describe('30 màn, 3 chặng', () => {
  it('đủ 30 màn, 3 chặng × 10, trùm ở 10/20/30, mọi màn 3–7 thẻ', () => {
    expect(SO_MAN_TIM).toBe(30);
    expect(CHANG_TIM.map((c) => [c.from, c.to])).toEqual([[1, 10], [11, 20], [21, 30]]);
    expect(MAN_TIM.filter((m) => m.trum).map((m) => m.id)).toEqual([10, 20, 30]);
    for (const m of MAN_TIM) expect(m.soThe).toBeGreaterThanOrEqual(3), expect(m.soThe).toBeLessThanOrEqual(7);
    expect(MAN_TIM.every((m) => !m.trum || m.may)).toBe(true);   // trùm luôn có máy
  });
});

describe('sao + qua màn', () => {
  it('★ 6 · ★★ 8 · ★★★ 10', () => {
    expect([5, 6, 7, 8, 9, 10].map(saoTim)).toEqual([0, 1, 1, 2, 2, 3]);
    expect(thieuSaoKe(7)).toEqual({ sao: 2, thieu: 1 });
    expect(thieuSaoKe(10)).toBeNull();
  });
  it('màn có máy phải THẮNG máy; một mình chỉ cần ≥ 1★', () => {
    const mot = MAN_TIM[0]!, may = MAN_TIM[8]!;
    expect(quaManTim(mot, 6, 'xong')).toBe(true);
    expect(quaManTim(mot, 5, 'xong')).toBe(false);
    expect(quaManTim(may, 10, 'thua')).toBe(false);
    expect(quaManTim(may, 10, 'hoa')).toBe(false);
    expect(quaManTim(may, 6, 'thang')).toBe(true);
  });
});

describe('tiến độ + danh hiệu', () => {
  it('qua màn n mở màn n+1; chỉ ghi khi tốt hơn', () => {
    expect(moToiTim(store.timCD())).toBe(1);
    store.ghiTimCD(1, 2, 100);
    store.ghiTimCD(1, 1, 50);
    expect(store.timCD()['1']).toEqual({ stars: 2, score: 100 });
    expect(moToiTim(store.timCD())).toBe(2);
    expect(tongSaoTim(store.timCD())).toBe(2);
  });
  it('không lẫn với Chiến dịch Lật cặp', () => {
    store.ghiTimCD(5, 3, 100);
    expect(store.unlockedLevel()).toBe(1);
  });
  it('qua màn 10 → danh hiệu Qua màn 10; đủ 90 sao → Mắt thần toàn năng', () => {
    for (let i = 1; i <= 10; i++) store.ghiTimCD(i, 3, 100);
    expect(xetThongKe(thongKeHienTai())).toContain('tim-cd-10');
    expect(xetThongKe(thongKeHienTai())).not.toContain('tim-cd-20');
    for (let i = 11; i <= 30; i++) store.ghiTimCD(i, 3, 100);
    expect(xetThongKe(thongKeHienTai())).toEqual(expect.arrayContaining(['tim-cd-20', 'tim-cd-30', 'tim-cd-sao']));
    for (const id of ['tim-cd-10', 'tim-cd-sao']) {
      expect(byId(id)?.nhom).toBe('tim-the');
      expect(byId(id)!.name).not.toMatch(/^dh\./);
      expect(iconCua(byId(id)!).chu).not.toBe('🏅');
    }
  });
});
