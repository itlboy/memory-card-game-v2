import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ĐỔI TÊN phải có nút LƯU rõ ràng.
 *
 * Trước đây chỉ có Enter và `blur`. Trên điện thoại, Enter nghĩa là phải tìm
 * nút xanh trên bàn phím ảo; còn `blur` thì chẳng có gì trên màn hình nói rằng
 * bấm ra ngoài sẽ lưu. Người ta gõ xong rồi đứng nhìn, không biết đã xong chưa.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');

describe('đổi tên trong phòng chờ', () => {
  it('có nút Lưu và nút Huỷ', () => {
    expect(src).toMatch(/aria-label="Lưu tên"/);
    expect(src).toMatch(/aria-label="Huỷ đổi tên"/);
  });

  it('không lưu khi tên rỗng', () => {
    expect(src).toMatch(/nut-luu[\s\S]{0,120}:disabled="!tenMoi\.trim\(\)"/);
  });

  it('Huỷ giữ nguyên tên cũ, không gửi gì lên server', () => {
    const i = src.indexOf('function huySuaTen()');
    expect(i, 'thiếu hàm huỷ').toBeGreaterThan(-1);
    const than = src.slice(i, i + 160);
    expect(than, 'huỷ mà vẫn gọi doiTen là mất tác dụng của nút').not.toContain('doiTen');
  });

  it('vùng chạm hai nút vẫn 44px dù hình chỉ 28px', () => {
    // Phình nút lên thì dòng người chơi cao thêm và danh sách ngắn đi một dòng.
    expect(src).toMatch(/\.nut-luu, \.nut-huy \{[\s\S]{0,200}width: 28px/);
    expect(src).toMatch(/\.nut-luu::after, \.nut-huy::after[^}]*inset: -8px/);
  });
});
