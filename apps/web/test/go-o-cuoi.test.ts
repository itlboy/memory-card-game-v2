import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ô HÀNG CUỐI CỦA WIZARD KHÔNG ĐƯỢC CỤT GỜ TRÊN IPHONE.
 *
 * Lưới lựa chọn `overflow: clip` (luật KHÔNG SCROLL) cắt mất bóng/gờ lệch xuống
 * của ô cuối. Bản trước chữa bằng `overflow-clip-margin` — Safari KHÔNG hỗ trợ,
 * nên trên iPhone vẫn cụt (báo hai lần: bước số người, rồi bước mức máy
 * 14.10.2026). Chữa đúng là ĐỆM ĐÁY thật; test này bắt đệm đáy của skin Kẹo
 * ≥ bóng lớn nhất mà skin đó vẽ cho `.option` (kể cả lúc hover).
 */
const keo = readFileSync(resolve(__dirname, '../src/styles/skins/keo.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('gờ ô cuối của wizard (skin Kẹo)', () => {
  it('đệm đáy lưới ≥ bóng đổ lớn nhất của .option', () => {
    const bong = [...keo.matchAll(/\.option[^{]*\{[^}]*box-shadow:\s*0 (\d+)px 0/g)].map((m) => Number(m[1]));
    expect(bong.length, 'không đọc được bóng của .option').toBeGreaterThan(0);
    const dem = keo.match(/:is\(\.step-body\.options, \.options\.fill\)\s*\{[^}]*padding-block:\s*\d+px\s+(\d+)px/);
    expect(dem, 'thiếu padding-block cho lưới lựa chọn').toBeTruthy();
    expect(Number(dem![1])).toBeGreaterThanOrEqual(Math.max(...bong));
  });
});
