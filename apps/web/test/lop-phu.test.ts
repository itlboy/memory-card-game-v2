import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * LỚP PHỦ PHẢI KÍN MÀN (14.11.2026, chủ dự án: "kết thúc chơi online lớp phủ đen hình như chưa bao
 * kín"). Đo thật: thanh trên cùng (TopBar, z-index 15 — để menu thả xuống nổi trên màn chính) nằm
 * ĐÈ lên lớp tối cảnh kết ván (9), bảng kết quả (10) và đếm ngược vào ván (7), cả offline lẫn online;
 * riêng online cảnh kết ván còn nằm trong <main> nên hở thêm hai bên và đáy.
 * Chuỗi đúng: TopBar 15 < đếm ngược / cảnh kết ván 16 < bảng kết quả 17 < TamDung 18 < MoKhoaFx 19
 * < hộp thoại 20.
 */
const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
const z = (src: string, re: RegExp): number => Number(re.exec(src)![1]);

describe('lớp phủ nằm TRÊN thanh trên cùng', () => {
  const zTopBar = z(doc('components/TopBar.vue'), /position: relative; z-index: (\d+);/);

  it('cảnh kết ván, bảng kết quả, đếm ngược (offline + online) đều trên TopBar', () => {
    const zFx = z(doc('styles/ketcuc-fx.css'), /\.ketcuc-fx \{[\s\S]*?z-index: (\d+)/);
    const zKq = z(doc('components/ResultDialog.vue'), /position: fixed; inset: 0; z-index: (\d+)/);
    const zDemOff = z(doc('components/GameScreen.vue'), /\.countdown \{[\s\S]*?z-index: (\d+)/);
    const zDemOn = z(doc('components/OnlineGame.vue'), /\.countdown \{[\s\S]*?z-index: (\d+)/);
    for (const [ten, v] of [['cảnh kết ván', zFx], ['bảng kết quả', zKq], ['đếm ngược offline', zDemOff], ['đếm ngược online', zDemOn]] as const) {
      expect(v, `${ten} phải nằm trên TopBar (${zTopBar})`).toBeGreaterThan(zTopBar);
    }
    expect(zFx, 'cảnh kết ván vẫn phải DƯỚI bảng kết quả').toBeLessThan(zKq);
    expect(zKq, 'bảng kết quả dưới hộp thoại (20)').toBeLessThan(20);
  });

  it('"Chỉnh bàn" sau ván online (wizard phủ) nằm TRÊN bảng kết quả', () => {
    // Suýt vỡ khi nâng bảng kết quả 10 → 17: wizard ở 15 sẽ chui xuống dưới bảng.
    const zKq = z(doc('components/ResultDialog.vue'), /position: fixed; inset: 0; z-index: (\d+)/);
    const zWiz = z(doc('components/OnlineScreen.vue'), /\.panel\.wiz-phu \{[^}]*z-index: (\d+)/);
    expect(zWiz).toBeGreaterThan(zKq);
    expect(zWiz).toBeLessThan(20);
  });

  it('cảnh kết ván online teleport ra #app — trong <main> thì hở viền', () => {
    expect(doc('components/OnlineGame.vue')).toMatch(/<Teleport to="#app"[^>]*>\s*<KetCucFx/);
  });
});
