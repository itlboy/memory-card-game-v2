import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * HỘP XÁC NHẬN PHẢI TỰ ĐÓNG sau khi bấm nút đồng ý.
 *
 * Lỗi đã xảy ra thật: `@confirm="confirm.action()"` chỉ chạy việc, không đóng
 * gì. Các việc khác (rời phòng, huỷ phòng) đều CHUYỂN MÀN nên hộp biến mất
 * theo — che mất chuyện nó chưa bao giờ tự đóng. Đến "mời người chơi ra" thì
 * lộ: việc đó xong vẫn ở nguyên phòng chờ, nên hộp nằm lại giữa màn hình.
 *
 * Kiểu lỗi này không có gì báo — chỉ nhìn mới thấy, và chỉ thấy ở đúng một
 * nhánh trong bốn.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('hộp xác nhận', () => {
  it('không gọi thẳng action() từ template', () => {
    expect(src, 'gọi thẳng action() là không có chỗ nào đóng hộp')
      .not.toContain('@confirm="confirm.action()"');
  });

  it('đi qua một hàm có đóng hộp', () => {
    expect(src).toContain('@confirm="xacNhan()"');
    const i = src.indexOf('function xacNhan()');
    expect(i, 'thiếu hàm xacNhan').toBeGreaterThan(-1);
    const than = src.slice(i, i + 260);
    expect(than, 'phải đặt confirm về null').toMatch(/confirm\.value\s*=\s*null/);
    // Đóng TRƯỚC khi chạy việc: việc có thể unmount component (rời phòng),
    // lúc đó gán vào ref đã chết thì chẳng còn tác dụng gì.
    const iNull = than.indexOf('confirm.value = null');
    const iChay = than.search(/viec\?\.\(\)/);
    expect(iNull, 'phải đóng hộp trước khi chạy việc').toBeLessThan(iChay);
  });
});
