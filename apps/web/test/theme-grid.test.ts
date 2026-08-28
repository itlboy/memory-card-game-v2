import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Lưới chọn theme được vẽ ở HAI màn: `MenuScreen.vue` (chơi thường) và
 * `OnlineScreen.vue` (tạo phòng online). Cùng một lưới, nên luật hiển thị phải
 * KHỚP — để lệch là một màn mất emoji còn màn kia không, và không có gì báo lỗi.
 *
 * Đây là lỗi đã xảy ra thật: ngưỡng ẩn emoji được hạ 74px → 45px ở MenuScreen,
 * còn OnlineScreen bị bỏ quên, nên phòng online mất emoji trên iPhone (Safari
 * còn ~740px cao, ô theme 78px, content box 58px < 74px → ẩn).
 */
const doc = (f: string) => readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');
const menu = doc('MenuScreen.vue');
const online = doc('OnlineScreen.vue');

/** Ngưỡng của `@container (max-height: Npx) { .theme-sample { display: none } }`. */
function nguongAnEmoji(src: string): number | null {
  const re = /@container \(max-height:\s*(\d+(?:\.\d+)?)px\)\s*\{[^}]*\.theme-sample\s*\{\s*display:\s*none/gs;
  const m = re.exec(src);
  return m ? Number(m[1]) : null;
}

describe('lưới theme: hai màn phải cùng luật', () => {
  it('cả hai màn đều có ngưỡng ẩn emoji', () => {
    expect(nguongAnEmoji(menu), 'MenuScreen thiếu ngưỡng').not.toBeNull();
    expect(nguongAnEmoji(online), 'OnlineScreen thiếu ngưỡng').not.toBeNull();
  });

  it('NGƯỠNG PHẢI KHỚP NHAU', () => {
    expect(nguongAnEmoji(online), 'ngưỡng hai màn lệch nhau — một màn sẽ mất emoji')
      .toBe(nguongAnEmoji(menu));
  });

  /**
   * Ngưỡng đo trên CONTENT BOX (`.option` có `container-type: size`), tức đã trừ
   * padding 8+8 và viền 2+2. Đo thật bằng CDP ở 430 rộng, dpr3: ô 70.4px →
   * content 50.4px vẫn xếp gọn không cắt chữ; ô 63.8px → content 43.8px là chỗ
   * bắt đầu chật. Ngưỡng quá cao là ẩn emoji ở máy còn thừa chỗ.
   */
  it('ngưỡng không được cao quá — 45px là mức đã đo', () => {
    const n = nguongAnEmoji(menu)!;
    expect(n).toBeLessThanOrEqual(48);
    expect(n).toBeGreaterThanOrEqual(40);
  });

  it('bình luận nhắc rõ ngưỡng đo trên content box, không phải chiều cao ô', () => {
    // Đây chính là chỗ hiểu sai gây ra lỗi, nên phải ghi lại tại chỗ.
    for (const [ten, src] of [['MenuScreen', menu], ['OnlineScreen', online]] as const) {
      expect(src, `${ten} thiếu ghi chú về content box`).toMatch(/CONTENT BOX/i);
    }
  });

  /**
   * Ngưỡng khớp nhau vẫn CHƯA đủ: nó đo content box, mà content box = chiều cao ô
   * trừ padding và viền. Hai màn để padding khác nhau là cùng một ngưỡng vẫn cho
   * hai hành vi khác nhau. Lưới theme ở hai màn còn mang tên class KHÁC nhau
   * (`grid2` bên MenuScreen, `wiz-themes` bên OnlineScreen) nên rất dễ lệch mà
   * không ai thấy — vì vậy khoá phần padding lại ở đây.
   */
  it('padding của ô theme phải khớp — nó quyết định content box', () => {
    const pad = (src: string) => {
      const m = /\.option\.theme-opt\s*\{([^}]*)\}/.exec(src);
      const p = m ? /padding:\s*([^;]+);/.exec(m[1]) : null;
      return p ? p[1].trim() : null;
    };
    expect(pad(menu), 'MenuScreen không khai padding cho .theme-opt').not.toBeNull();
    expect(pad(online), 'padding ô theme hai màn lệch nhau').toBe(pad(menu));
  });
});
