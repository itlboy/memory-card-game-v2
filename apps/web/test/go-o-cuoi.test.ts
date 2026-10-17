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
const doc = (f: string) => readFileSync(resolve(__dirname, `../src/styles/skins/${f}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const keo = doc('keo.css');
// Từ 17.10.2026 độ dày đế của mọi nút nằm ở keo-thach.css, khai bằng biến `--th-d`
const thach = doc('keo-thach.css');

describe('gờ ô cuối của wizard (skin Kẹo)', () => {
  it('đệm đáy lưới ≥ đế dày nhất của nút (--th-d)', () => {
    const bong = [...thach.matchAll(/--th-d:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(bong.length, 'không đọc được --th-d ở keo-thach.css').toBeGreaterThan(0);
    const dem = keo.match(/:is\(\.step-body\.options, \.options\.fill\)\s*\{[^}]*padding-block:\s*\d+px\s+(\d+)px/);
    expect(dem, 'thiếu padding-block cho lưới lựa chọn').toBeTruthy();
    expect(Number(dem![1])).toBeGreaterThanOrEqual(Math.max(...bong));
  });
});
