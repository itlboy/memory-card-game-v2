import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * LƯỚI CHỌN THEME — MỘT bản CSS cho CẢ HAI màn.
 *
 * Trước đây `MenuScreen.vue` và `OnlineScreen.vue` mỗi màn giữ một bản CSS
 * riêng cho cùng một lưới, và chúng lệch nhau ở đúng những chỗ khó thấy nhất:
 *  · ngưỡng ẩn emoji hạ 74 → 45px ở MenuScreen mà quên OnlineScreen, nên phòng
 *    online mất emoji trên iPhone;
 *  · cơ chế "ô giữ cỡ, danh sách tự cuộn" chỉ thêm ở MenuScreen, nên bên online
 *    24 theme bóp ô còn ~30px, dính sát nhau và bấm không trúng.
 * Cả hai lỗi đều KHÔNG có test nào đỏ. Nay CSS về `styles/theme-grid.css`; test
 * này canh (1) hai màn đều dùng class chung và (2) không màn nào viết lại luật
 * riêng của lưới theme.
 */
const doc = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
const menu = doc('src/components/MenuScreen.vue');
const online = doc('src/components/OnlineScreen.vue');
/* Bỏ chú thích: chúng nhắc lại tên các thuộc tính nên soi thẳng là khớp oan. */
const css = doc('src/styles/theme-grid.css').replace(/\/\*[\s\S]*?\*\//g, '');
const man = [['MenuScreen', menu], ['OnlineScreen', online]] as const;

describe('lưới theme dùng chung một bản CSS', () => {
  it('cả hai màn đều dùng ThemePicker (lưới `theme-grid` chung + tab premium)', () => {
    for (const [ten, src] of man) {
      expect(src, `${ten} không dùng ThemePicker`).toMatch(/<ThemePicker\b/);
      expect(src, `${ten} tự vẽ lưới theme riêng`).not.toMatch(/class="options theme-grid"/);
    }
    expect(doc('src/components/ThemePicker.vue')).toMatch(/class="options theme-grid"/);
  });

  it('không màn nào giữ luật riêng của lưới theme', () => {
    for (const [ten, src] of man) {
      const style = src.slice(src.indexOf('<style'));
      // Ngưỡng ẩn emoji: đúng một chỗ khai, và chỗ đó là file chung.
      expect(style, `${ten} còn khai ngưỡng ẩn emoji riêng`).not.toMatch(/\.theme-sample\s*\{\s*display:\s*none/);
      // Cỡ ô / số cột: khai lại là hai màn lệch nhau trở lại.
      expect(style, `${ten} còn khai chiều cao ô theme riêng`)
        .not.toMatch(/\.option\.theme-opt\s*\{[^}]*height:/);
      expect(style, `${ten} còn khai số cột riêng cho lưới theme`)
        .not.toMatch(/wiz-themes|options\.grid2/);
    }
  });

  it('ngoặc nhọn cân (04.11.2026 sót một `}` khi thay khối @container — build chỉ cảnh báo)', () => {
    let sau = 0;
    for (const c of css) { if (c === '{') sau++; else if (c === '}') { sau--; expect(sau, 'thừa }').toBeGreaterThanOrEqual(0); } }
    expect(sau, 'thiếu }').toBe(0);
  });

  it('main.ts nạp file CSS chung', () => {
    expect(doc('src/main.ts')).toContain("styles/theme-grid.css");
  });
});

/*
 * 12 THEME → Ô TO 3×4 CÓ TÊN (chủ dự án 04.11.2026, sau khi gộp 72 theme còn 12). Trước đó
 * (17.10.2026) là ô tí hon 6 cột không tên cho 72 theme — với 12 theme lưới đó chỉ kín 2 hàng.
 * Đừng quay lại ô nhỏ / bỏ tên khi chưa hỏi.
 */
describe('lưới theme: ô to có tên, 12 theme lấp kín khung', () => {
  it('3 cột ở điện thoại, trần 4 cột ở máy rộng (12 chia hết cho 3 và 4 — không lẻ hàng)', () => {
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(max\(92px,\s*calc\(\(100% - 30px\) \/ 4\)\),\s*1fr\)\)/);
    expect(css, 'khe 10px khớp 3 khe trong (100% - 30px)').toMatch(/gap:\s*10px/);
  });

  it('CHIỀU CAO ô có sàn XÁC ĐỊNH (container query cần thế), sàn đủ cho icon + tên hai dòng', () => {
    const m = /--o-cao:\s*clamp\((\d+)px,\s*calc\(var\(--app-h[^)]*\)[^)]*\),\s*(\d+)px\)/.exec(css);
    expect(m, 'ô theme phải co theo chiều cao app, kẹp trong clamp').not.toBeNull();
    const [san, tran] = [Number(m![1]), Number(m![2])];
    expect(san, 'dưới 62px là tên hai dòng đè lên icon (iPhone SE, tiếng Nga)').toBeGreaterThanOrEqual(62);
    expect(tran).toBeGreaterThan(san);
  });

  it('hàng GIÃN lấp khung, màn thấp thì giữ sàn và CUỘN trong khung — không nén dưới sàn', () => {
    expect(css).toMatch(/grid-auto-rows:\s*minmax\(var\(--o-cao\),\s*1fr\);/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css).not.toMatch(/grid-auto-rows:\s*minmax\(0,\s*1fr\)/);
  });

  it('icon KHÔNG BAO GIỜ bị ẩn; tên theme HIỆN trong ô', () => {
    expect(css).not.toMatch(/\.theme-sample\s*\{\s*display:\s*none/);
    expect(css, 'tên không còn bị ẩn khỏi mắt').not.toMatch(/\.theme-opt \.tname\s*\{[^}]*clip:/);
    const tp = doc('src/components/ThemePicker.vue');
    expect(tp, 'render sẵn 12 icon, CSS chọn số hiện theo cỡ ô').toContain('x.symbols.slice(0, 12)');
    expect(tp, 'icon vẽ như mặt bài (ảnh Noto 3D cỡ 128)').toMatch(/class="tm-anh" :src="anhEmoji\(s, undefined, 128\)!"/);
    expect(tp, 'tên có trong ô').toMatch(/<strong class="tname">/);
  });
});
