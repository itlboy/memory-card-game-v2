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

/**
 * Bàn 88 thẻ ONLINE lag (người chơi báo 08.09.2026). Gốc: server gửi lại cả
 * view mỗi nhịp đồng hồ lượt, nên mỗi giây Vue patch lại 88 component dù bàn
 * không đổi gì — offline cùng chi phí mà không thấy, vì bàn chỉ đổi khi bấm.
 * Đo trên bàn 8×11: 1,38ms style+layout mỗi nhịp ở máy tính, điện thoại chậm
 * hơn nhiều lần.
 */
describe('bàn 88 thẻ online không phải dựng lại mỗi nhịp đồng hồ', () => {
  const src = readFileSync(resolve(__dirname, '../src/components/OnlineGame.vue'), 'utf8');

  it('cards / faceUp / matchedSet giữ nguyên tham chiếu khi nội dung không đổi', () => {
    expect((src.match(/giuNeuGiong\(/g) ?? []).length,
      'thiếu một chỗ là nhịp đồng hồ lại render cả bàn thẻ').toBeGreaterThanOrEqual(3);
  });

  it('mặt sau vẽ bằng ảnh nền, không mask — mask là một lớp đệm cho MỖI lá', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles/card-backs.css'), 'utf8');
    expect(css).not.toMatch(/^\s*(-webkit-)?mask:/m);
  });

  it('bàn từ 56 thẻ trở lên không chạy cú lắc 2,2 giây sau khi lật', () => {
    const card = readFileSync(resolve(__dirname, '../src/components/CardTile.vue'), 'utf8');
    expect(card).toMatch(/banLon\s*=\s*computed\(\(\)\s*=>\s*\(props\.cardCount \?\? 0\) >= 56\)/);
    expect((card.match(/if \(banLon\.value\) return;/g) ?? []).length).toBe(2);
  });
});
