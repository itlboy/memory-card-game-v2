import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DK, duDieuKien } from '@/lib/xin-danh-gia';

/** XIN ĐÁNH GIÁ APP (26.11.2026, chủ dự án duyệt): hộp đánh giá của hệ điều hành, hỏi lúc vui, đủ gắn bó, thưa. */
const NGAY = 86_400_000;
const T = 1_800_000_000_000;
const doc = (f: string): string => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('xin đánh giá', () => {
  it('luật: ≥ 3 ngày dùng, ≥ 5 ván, cách lần trước ≥ 120 ngày, tối đa 3 lần', () => {
    expect(DK).toEqual({ ngayDung: 3, vanToiThieu: 5, cachNgay: 120, toiDa: 3 });
    const mo = T - 4 * NGAY;
    expect(duDieuKien(T, mo, 5, { lan: 0, luc: 0 })).toBe(true);
    expect(duDieuKien(T, T - 2 * NGAY, 50, { lan: 0, luc: 0 }), 'mới dùng 2 ngày').toBe(false);
    expect(duDieuKien(T, mo, 4, { lan: 0, luc: 0 }), 'mới 4 ván').toBe(false);
    expect(duDieuKien(T, 0, 50, { lan: 0, luc: 0 }), 'không biết ngày bắt đầu').toBe(false);
    expect(duDieuKien(T, mo, 50, { lan: 1, luc: T - 100 * NGAY }), 'mới hỏi 100 ngày trước').toBe(false);
    expect(duDieuKien(T, mo, 50, { lan: 1, luc: T - 121 * NGAY })).toBe(true);
    expect(duDieuKien(T, mo, 50, { lan: 3, luc: T - 400 * NGAY }), 'đã hỏi đủ 3 lần').toBe(false);
  });

  it('chỉ sau ván THẮNG, xin khi về trang chủ (không giữa ván); bản app chưa có plugin thì im lặng', () => {
    const app = doc('src/App.vue');
    expect(app).toContain("if (s.status === 'won') ghiVuaThang();");
    expect(app).toContain('if (thangMay) ghiVuaThang();');
    // Về trang chủ (sc === 'menu', từ màn khác) → sau 900 ms: giờ vàng hỏi bật nhắc NẾU đủ điều kiện, không thì xin đánh giá
    expect(app).toMatch(/watch\(screen, \(sc, cu\) => \{\s*if \(sc !== 'menu' \|\| cu === 'menu'\) return;/);
    expect(app).toMatch(/void thuXinDanhGia\(\);\s*\}, 900\);/);
    expect(doc('src/components/OnlineGame.vue').match(/if \(loaiKetCuc\.value === 'thang'\) ghiVuaThang\(\);/g)).toHaveLength(2);
    const lib = doc('src/lib/xin-danh-gia.ts');
    expect(lib).toContain("cap?.isPluginAvailable?.('InAppReview') === true");
    expect(lib, 'không đổi quà lấy đánh giá (xu / Premium)').not.toMatch(/congXu|nhanQuaTang|from '\.\/premium'/);
  });

  it('plugin nằm trong dự án native (iOS SPM + Android gradle)', () => {
    expect(doc('ios/App/CapApp-SPM/Package.swift')).toContain('CapacitorCommunityInAppReview');
    expect(doc('android/capacitor.settings.gradle')).toContain(':capacitor-community-in-app-review');
  });
});
