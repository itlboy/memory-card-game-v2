import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (f: string) => readFileSync(resolve(__dirname, '../src/components', f), 'utf8');

/**
 * Bàn 88 thẻ online từng TRÀN xuống dưới thanh emoji (người chơi báo, có ảnh).
 * Gốc: `computeFit` tính chiều cao thẻ vừa KHÍT chỗ trống — không chừa lấy một
 * px — nên chỉ cần số đo lệch một nhịp (dải người chơi mọc thêm chip ping,
 * dòng "mạng có vấn đề", view online về sau lần đo đầu) là cả bàn cao quá khung.
 *
 * Cách chữa là ĐỔI NGƯỜI QUYẾT ĐỊNH: chiều cao do KHUNG BAO quyết định (hàng
 * `1fr`, bàn cao 100% khung, thẻ lấp trọn hàng), còn số của JS chỉ còn quyết
 * định bề rộng. Ba chốt dưới đây là ba nửa của cùng một luật — thiếu bất kỳ nửa
 * nào thì chiều cao quay về phụ thuộc số đo và bàn tràn lại.
 */
describe('bàn thẻ không tràn ra ngoài khung', () => {
  it('hàng của lưới là 1fr, không phải hàng tự co theo nội dung', () => {
    expect(src('BoardGrid.vue')).toMatch(/gridTemplateRows:\s*`repeat\(\$\{[^}]+\}, minmax\(0, 1fr\)\)`/);
  });

  it('bàn cao đúng bằng khung bao và không rộng hơn khung', () => {
    const s = src('BoardGrid.vue').slice(src('BoardGrid.vue').indexOf('<style'));
    expect(s).toMatch(/height:\s*100%/);
    expect(s).toMatch(/max-width:\s*100%/);
  });

  it('lá bài lấp trọn hàng, không tự cao theo tỉ lệ', () => {
    const s = src('CardTile.vue');
    expect(s.slice(s.indexOf('.card {'), s.indexOf('.card {') + 900)).toMatch(/height:\s*100%/);
  });
});
