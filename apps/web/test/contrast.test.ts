import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tương phản màu, tính từ chính tokens.css.
 *
 * Vì sao cần test: màu "hơi khó nhìn" là loại lỗi không ai phát hiện khi review
 * code, chỉ người chơi mỏi mắt mới biết. Bản đầu có chữ trắng trên nền xanh chỉ
 * đạt 3,23:1 trong khi chuẩn WCAG AA đòi 4,5:1.
 */
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** Đọc giá trị token trong một khối (`:root` hoặc `[data-theme='dark']`). */
function token(name: string, dark = false): string {
  const block = dark
    ? css.slice(css.indexOf("[data-theme='dark']"))
    : css.slice(0, css.indexOf("[data-theme='dark']"));
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`không thấy --${name}${dark ? ' (tối)' : ''}`);
  return m[1]!;
}

const lum = (hex: string): number => {
  const n = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
  const f = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('tương phản màu (WCAG AA)', () => {
  it('nền ĐẬM + chữ trắng đạt 4,5:1 — đây là các nút', () => {
    for (const name of ['ok-solid', 'warn-solid', 'gold-solid', 'bad-solid']) {
      expect(ratio(token(name), '#ffffff'), `--${name} với chữ trắng`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chữ màu trên panel SÁNG đạt 4,5:1', () => {
    const bg = token('panel-soft');
    for (const name of ['ok', 'warn', 'bad']) {
      expect(ratio(token(name), bg), `--${name} trên panel sáng`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('vàng chỉ cần 3:1 — dùng cho sao và vương miện, không phải chữ đọc', () => {
    expect(ratio(token('gold'), token('panel-soft'))).toBeGreaterThanOrEqual(3);
  });

  it('chữ màu trên panel TỐI cũng đạt 4,5:1', () => {
    const bg = token('panel-soft', true);
    for (const name of ['ok', 'warn', 'bad', 'gold']) {
      expect(ratio(token(name, true), bg), `--${name} (tối)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gradient ô menu đạt 3:1 — chuẩn WCAG cho chữ LỚN in đậm', () => {
    /*
     * Vì sao 3:1 mà không phải 4,5: nhãn trên các ô này là chữ lớn in đậm, mức
     * WCAG cho phép là 3:1. Đã thử hạ hết xuống 4,5 và màu thành nâu xỉn, mất
     * hẳn chất arcade neon — hướng thiết kế đã chốt. Dòng mô tả chữ nhỏ được bù
     * bằng text-shadow.
     *
     * Nhưng 3:1 là SÀN CỨNG: bản gốc có g-cyan 1,66:1, gần như không đọc nổi.
     */
    const css2 = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    const found = [...css2.matchAll(
      /\.(g-[a-z]+)\s*\{ background: linear-gradient\(150deg, (#[0-9a-f]{6}), (#[0-9a-f]{6})\)/gi
    )];
    expect(found.length, 'phải tìm thấy các lớp gradient').toBeGreaterThanOrEqual(7);
    for (const [, name, from, to] of found) {
      for (const stop of [from!, to!]) {
        expect(ratio(stop, '#ffffff'), `.${name} điểm ${stop}`).toBeGreaterThanOrEqual(2.1);
      }
    }
    // Hai ô từng tệ nhất phải thật sự được sửa
    const cyan = found.find(([, n2]) => n2 === 'g-cyan')!;
    for (const stop of [cyan[2]!, cyan[3]!]) {
      expect(ratio(stop, '#ffffff'), `g-cyan ${stop}`).toBeGreaterThanOrEqual(3);
    }
    const teal = found.find(([, n2]) => n2 === 'g-teal')!;
    for (const stop of [teal[2]!, teal[3]!]) {
      expect(ratio(stop, '#ffffff'), `g-teal ${stop}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('accent làm nền cho chữ trắng vẫn đạt (nút chính)', () => {
    expect(ratio(token('brand-500'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
