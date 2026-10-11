import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HIỆU ỨNG KẾT VÁN KHÔNG ĐƯỢC CHẠY MÃI.
 *
 * Bảng kết quả nằm đè lên hiệu ứng tới khi người chơi bấm. Bộ cũ có hàng trăm
 * hạt chạy animation `infinite` và người chơi báo "bấm chơi lại delay tới vài
 * chục giây". Bộ mới: mọi animation CSS đều kết thúc, hạt canvas tự dừng khi
 * hết và có trần số hạt.
 */
// Bỏ chú thích: chữ "infinite" trong lời giải thích không phải là luật CSS
const css = readFileSync(resolve(__dirname, '../src/styles/ketcuc-fx.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const so = readFileSync(resolve(__dirname, '../src/lib/ketcuc-fx.ts'), 'utf8');

describe('hiệu ứng kết ván có hạn', () => {
  it('không animation CSS nào chạy vô hạn', () => {
    expect(css).not.toMatch(/infinite/);
  });
  it('canvas hạt có trần và tự dừng khi hết hạt', () => {
    expect(so).toMatch(/TRAN_HAT = \d+/);
    expect(Number(/TRAN_HAT = (\d+)/.exec(so)![1])).toBeLessThanOrEqual(300);
    expect(so, 'chỉ xin khung hình kế tiếp khi còn hạt').toMatch(/if \(this\.hat\.length\) this\.raf = requestAnimationFrame/);
  });
  it('dọn cảnh huỷ MỌI animation đã gắn lên lá bài', () => {
    expect(so).toMatch(/for \(const a of anim\) \{ try \{ a\.cancel\(\)/);
  });
});
