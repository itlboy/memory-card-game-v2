import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.sr-only` PHẢI Ở TOÀN CỤC.
 *
 * Lỗi đã xảy ra thật: luật này nằm trong `<style scoped>` của PlayerStrip, mà
 * OnlineGame cũng dùng cùng cái class — scoped chỉ áp cho component khai nó,
 * nên ở màn kia chữ dành cho trình đọc màn hình hiện thẳng ra. Dải người chơi
 * từ 5 người trở lên đổ ra "Tên: 0 điểm" dưới mỗi avatar.
 *
 * Không có gì báo lỗi khi chuyện đó xảy ra — chỉ nhìn mới thấy. Nên chốt ở đây.
 */
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const thuMuc = resolve(process.cwd(), 'src/components');

describe('.sr-only', () => {
  it('được khai ở global.css, không phải trong một component', () => {
    expect(css, 'thiếu .sr-only ở global.css').toMatch(/^\.sr-only\s*\{/m);
    // và phải thật sự ẩn, không chỉ có tên
    const khoi = css.slice(css.search(/^\.sr-only\s*\{/m));
    expect(khoi.slice(0, 200)).toContain('position: absolute');
    expect(khoi.slice(0, 200)).toMatch(/width:\s*1px/);
  });

  it('KHÔNG component nào khai lại nó trong style scoped', () => {
    const pham: string[] = [];
    for (const f of readdirSync(thuMuc).filter((x) => x.endsWith('.vue'))) {
      const src = readFileSync(resolve(thuMuc, f), 'utf8');
      const style = src.slice(src.indexOf('<style'));
      if (/^\.sr-only\s*\{/m.test(style)) pham.push(f);
    }
    expect(pham, `khai lại .sr-only trong scoped: ${pham.join(', ')}`).toEqual([]);
  });
});
