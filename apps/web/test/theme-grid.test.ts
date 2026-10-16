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

  it('main.ts nạp file CSS chung', () => {
    expect(doc('src/main.ts')).toContain("styles/theme-grid.css");
  });
});

/*
 * Ô NHỎ — NHÌN ICON LÀ HIỂU (chủ dự án 17.10.2026 chọn phương án B sau khi xem ảnh so sánh:
 * ô ½ mỗi chiều, 6 cột, không tên; "chữ không quá quan trọng, họ sẽ nhìn icon"). Đánh đổi đã
 * chấp nhận: ô dưới ngưỡng chạm 44px. Đừng "sửa lại" về ô to / có tên khi chưa hỏi.
 */
describe('lưới theme: ô nhỏ, icon là chính', () => {
  it('6 CỘT (36 · 24 · 12 theme mỗi tab chia hết cho 6 — không lẻ hàng), tự tính theo bề rộng', () => {
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(max\(42px,\s*calc\(\(100% - 25px\) \/ 6\)\),\s*1fr\)\)/);
    expect(css, 'khe ngang 5px khớp 5 khe trong (100% - 25px)').toMatch(/gap:\s*6px 5px/);
  });

  it('CHIỀU CAO ô co theo màn nhưng vẫn XÁC ĐỊNH (container query cần thế)', () => {
    const m = /--o-cao:\s*clamp\((\d+)px,\s*calc\(var\(--app-h[^)]*\)[^)]*\),\s*(\d+)px\)/.exec(css);
    expect(m, 'ô theme phải co theo chiều cao app, kẹp trong clamp').not.toBeNull();
    const [san, tran] = [Number(m![1]), Number(m![2])];
    expect(san).toBeGreaterThanOrEqual(34);
    expect(tran).toBeGreaterThan(san);
  });

  it('ô CỐ ĐỊNH cỡ ở mọi tab, hết chỗ thì CUỘN — không giãn, không nén', () => {
    expect(css).toMatch(/grid-auto-rows:\s*var\(--o-cao\);/);
    expect(css).toMatch(/align-content:\s*start/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css).not.toMatch(/grid-auto-rows:\s*minmax\(0,\s*1fr\)/);
  });

  it('icon KHÔNG BAO GIỜ bị ẩn (chúng là nội dung chính); tên theme ẩn khỏi mắt nhưng còn cho trình đọc màn hình', () => {
    expect(css).not.toMatch(/\.theme-sample\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.theme-opt \.tname\s*\{[^}]*clip:/);
    const tp = doc('src/components/ThemePicker.vue');
    expect(tp, '4 icon 2×2').toContain('x.symbols.slice(0, 4)');
    expect(tp, 'icon vẽ như mặt bài (ảnh Noto 3D cỡ 128)').toMatch(/class="tm-anh" :src="anhEmoji\(s, undefined, 128\)!"/);
    expect(tp, 'tên vẫn có ở aria-label + title').toMatch(/:title="tenTheme\(x\.id, x\.name\)"/);
  });
});
