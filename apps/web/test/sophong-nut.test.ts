import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * NÚT CÔNG KHAI / RIÊNG TƯ trong phòng chờ.
 *
 * Bản cũ là một công tắc có nhãn TỰ ĐỔI theo trạng thái ("Phòng công khai" ↔
 * "Phòng riêng tư"): đọc dòng chữ đó không biết được nó tả trạng thái HIỆN TẠI
 * hay thứ sẽ thành sau khi bấm. Nay là HAI Ô cạnh nhau, cả hai lựa chọn cùng
 * hiện, ô đang chọn bùng gradient.
 *
 * Ba chốt dưới đây đều là lỗi đã xảy ra thật hoặc luật trong CLAUDE.md:
 *  1. Tên class không được trùng tên đã dùng ở nơi khác trong CÙNG file — rule
 *     `.hint` mới bị một rule `.hint` cũ ở cuối file ghi đè, không có gì báo.
 *  2. Ô đang chọn đổi màu TỨC THÌ: không transition trên màu/nền.
 *  3. Khách vẫn phải ĐỌC được trạng thái, nên ô đang chọn không được mờ đi —
 *     chỉ ô không chọn mới mờ.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

/** Mọi tên class xuất hiện trong khối <style> của file. */
function demRule(ten: string): number {
  const style = src.slice(src.indexOf('<style'));
  return [...style.matchAll(new RegExp(`^\\.${ten}\\s*\\{`, 'gm'))].length;
}

describe('nút công khai / riêng tư', () => {
  it('bày CẢ HAI lựa chọn, không phải một công tắc có nhãn tự đổi', () => {
    expect(src, 'phải có nhóm radio hai ô').toContain('role="radiogroup"');
    expect(src.match(/role="radio"/g)?.length, 'đúng hai ô').toBe(2);
    expect(src).toContain('Công khai');
    expect(src).toContain('Riêng tư');
    // Nhãn không còn là biểu thức ba ngôi đổi giữa hai tên phòng
    expect(src, 'nhãn nút không được tự đổi theo trạng thái')
      .not.toMatch(/\?\s*'Phòng công khai'\s*:\s*'Phòng riêng tư'/);
  });

  it('mỗi tên class chỉ có ĐÚNG MỘT rule — rule trùng ghi đè im lặng', () => {
    for (const ten of ['sp-seg', 'sp-hint', 'sp-rotag', 'sophong']) {
      expect(demRule(ten), `.${ten} bị khai nhiều lần`).toBeLessThanOrEqual(1);
    }
    // Và không được quay lại những tên đã có chủ trong file này
    expect(src, 'đừng dùng lại .hint — cuối file đã có một rule .hint khác')
      .not.toContain('<p class="hint" :class="{ priv:');
  });

  it('ô đang chọn đổi màu tức thì, không transition', () => {
    const khoi = src.slice(src.indexOf('.sp-seg {'), src.indexOf('.sp-rotag {'));
    expect(khoi, 'không được có transition trên ô chọn').not.toContain('transition');
  });

  it('khách đọc được trạng thái: chỉ ô KHÔNG chọn mới mờ', () => {
    expect(src).toContain('.sophong.ro .sp-opt:not(.sel)');
    expect(src, 'không được làm mờ cả khối — khách vẫn cần đọc trạng thái')
      .not.toMatch(/\.sophong\.ro\s*\{[^}]*opacity/);
  });

  it('hai nhánh có hai màu khác nhau, liếc là biết đang ở đâu', () => {
    expect(src, 'công khai: gradient cyan như bản cũ').toContain('#109edb');
    expect(src, 'riêng tư: gradient tím').toContain('#8f4fd0');
  });
});
