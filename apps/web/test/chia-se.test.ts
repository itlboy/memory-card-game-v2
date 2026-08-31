import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * HỘP CHIA SẺ PHÒNG — mã QR + mã 6 số + hai nút copy.
 *
 * Trước đây là một khối bung ra ngay trong phòng chờ, và bấm copy xong nó
 * không đóng. Nay là hộp riêng: mã QR cần chỗ, mà phòng chờ là màn KHÔNG ĐƯỢC
 * SCROLL và phải nhường chỗ cho tới 10 người chơi.
 */
const hop = readFileSync(resolve(process.cwd(), 'src/components/ChiaSeDialog.vue'), 'utf8');
const man = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('hộp chia sẻ phòng', () => {
  it('có đủ ba lối đóng: nút X, Esc, bấm nền', () => {
    expect(hop, 'thiếu nút đóng').toMatch(/aria-label="Đóng"/);
    expect(hop, 'Esc phải đóng').toMatch(/key === 'Escape'/);
    expect(hop, 'bấm ra ngoài phải đóng').toContain('@click.self="emit(\'close\')"');
  });

  it('nút Back đóng hộp TRƯỚC khi hỏi rời phòng', () => {
    // Đang mở hộp mà bấm Back thì thứ người ta muốn đóng là cái hộp.
    // Ưu tiên phải CAO HƠN lớp rời phòng (25).
    const m = /useBackCloser\((\d+), \(\) => moMoi\.value/.exec(man);
    expect(m, 'thiếu lớp Back cho hộp chia sẻ').not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(25);
  });

  it('QR sinh TẠI CHỖ, không gọi dịch vụ ngoài', () => {
    // Link phòng là chuyện riêng của nhóm bạn — không có lý do gì để nó đi qua
    // máy chủ người khác chỉ để vẽ một hình vuông.
    expect(hop).toMatch(/from 'qrcode'/);
    expect(hop, 'không được nhúng ảnh QR từ dịch vụ ngoài')
      .not.toMatch(/api\.qrserver|chart\.googleapis|qrcode\.tec-it/);
  });

  it('vùng chạm nút đóng vẫn 44px dù hình chỉ 32px', () => {
    expect(hop).toMatch(/\.dong::after[^}]*inset:\s*-6px/);
  });

  it('phòng dùng tất cả theme thì nói "tất cả", không để trống', () => {
    // themeIds RỖNG nghĩa là server dùng mọi theme (phòng tạo nhanh). Thiếu
    // nhánh này thì dòng tóm tắt cụt lủn: "16 thẻ · — chờ chủ phòng bắt đầu…"
    expect(man).toMatch(/if \(!ids\.length\)[\s\S]{0,140}tất cả/);
  });
});
