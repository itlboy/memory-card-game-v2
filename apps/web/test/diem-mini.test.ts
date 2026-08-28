import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ĐIỂM TRONG Ô MINI phải biến mất khi ô hẹp quá, không được tràn sang ô bên.
 *
 * Đo trên iPhone SE (VÙNG WEB 375×553, xem bảng kích thước trong CLAUDE.md)
 * với 10 người: mỗi ô chỉ còn 17,2px, mà "100" đã cần 18px — cả chín ô đều
 * tràn, số càng lớn càng thò sang ô bên cạnh (12345 thò 6,4px). Chữ chồng lên
 * nhau đọc còn tệ hơn không có chữ.
 *
 * Không mất thông tin: bảng đầy đủ vẫn có điểm mọi người, và người đang đi thì
 * điểm nằm ngay trên chip lượt.
 */
const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineGame.vue'), 'utf8');

describe('điểm trong ô mini', () => {
  it('ô mini là container để tự biết mình rộng bao nhiêu', () => {
    const khoi = src.slice(src.indexOf('.mini {'), src.indexOf('.mini.next'));
    expect(khoi, 'thiếu container-type thì @container bên dưới không chạy')
      .toMatch(/container-type:\s*inline-size/);
  });

  it('ô hẹp thì ẩn điểm, không để tràn', () => {
    expect(src).toMatch(/@container \(max-width: 22px\)[\s\S]{0,120}\.mpts\s*\{\s*display:\s*none/);
  });
});
