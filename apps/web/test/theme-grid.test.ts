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
  it('cả hai màn đều gắn class `theme-grid`', () => {
    for (const [ten, src] of man) {
      expect(src, `${ten} không dùng lưới chung`).toMatch(/class="options theme-grid"/);
    }
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

describe('lưới theme: co giãn khi thêm theme', () => {
  it('SỐ CỘT tự tính theo bề rộng, không cứng 3 cột', () => {
    // `repeat(3, 1fr)` cứng nghĩa là thêm theme thì ô nào cũng bé lại; auto-fill
    // thì máy rộng xếp thêm cột.
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\((\d+)px,\s*1fr\)\)/);
    const min = Number(/minmax\((\d+)px, 1fr\)/.exec(css)![1]);
    // Không hẹp quá (tên theme hai chữ vỡ dòng) và không rộng quá (SE còn 3 cột).
    expect(min).toBeGreaterThanOrEqual(76);
    expect(min).toBeLessThanOrEqual(110);
  });

  it('CHIỀU CAO ô co theo màn nhưng vẫn XÁC ĐỊNH (container query cần thế)', () => {
    const m = /--o-cao:\s*clamp\((\d+)px,\s*calc\(var\(--app-h[^)]*\)[^)]*\),\s*(\d+)px\)/.exec(css);
    expect(m, 'ô theme phải co theo chiều cao app, kẹp trong clamp').not.toBeNull();
    const [san, tran] = [Number(m![1]), Number(m![2])];
    // Sàn phải ≥ ngưỡng chạm 44px, và đủ để content box vượt ngưỡng ẩn emoji.
    expect(san, 'ô thấp hơn ngưỡng chạm là bấm không trúng').toBeGreaterThanOrEqual(60);
    expect(tran).toBeGreaterThan(san);
    const nguong = Number(/@container \(max-height:\s*(\d+)px\)/.exec(css)![1]);
    expect(san - 20, 'content box ở cỡ ô nhỏ nhất phải trên ngưỡng ẩn emoji')
      .toBeGreaterThan(nguong);
  });

  it('còn chỗ thì ô GIÃN, hết chỗ thì CUỘN — không nén ô xuống dưới sàn', () => {
    // `minmax(sàn, 1fr)`: giãn khi thừa chỗ, dừng ở sàn khi thiếu rồi cuộn.
    expect(css).toMatch(/grid-auto-rows:\s*minmax\(var\(--o-cao\),\s*1fr\)/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css, 'nén xuống 0 là luật của các bước khác, không phải của theme')
      .not.toMatch(/grid-auto-rows:\s*minmax\(0,\s*1fr\)/);
  });

  it('ngưỡng ẩn emoji vẫn ở mức đã đo (45px trên content box)', () => {
    const n = Number(/@container \(max-height:\s*(\d+)px\)/.exec(css)![1]);
    expect(n).toBeLessThanOrEqual(48);
    expect(n).toBeGreaterThanOrEqual(40);
    // Chú thích thì soi bản CÓ chú thích — đây chính là chỗ hiểu sai gây lỗi cũ.
    expect(doc('src/styles/theme-grid.css'),
      'thiếu ghi chú thì lần sau lại hiểu ngưỡng là chiều cao Ô').toMatch(/CONTENT BOX/i);
  });

  it('có KHOẢNG CÁCH giữa các ô — ô theme là khối gradient đậm, dính nhau đọc thành một khối', () => {
    const m = /gap:\s*(\d+)px(?:\s+(\d+)px)?/.exec(css);
    expect(m).not.toBeNull();
    expect(Number(m![1]), 'khoảng cách dọc quá nhỏ').toBeGreaterThanOrEqual(10);
  });
});
