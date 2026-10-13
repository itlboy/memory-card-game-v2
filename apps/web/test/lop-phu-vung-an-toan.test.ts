import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LỚP PHỦ TOÀN MÀN HÌNH PHẢI TỰ CỘNG VÙNG AN TOÀN.
 *
 * `#app` đã đệm env(safe-area-inset-*), nhưng hộp thoại `position: fixed; inset: 0`
 * phủ CẢ cửa sổ nên không hưởng đệm đó. Trong app iOS (viewport-fit=cover) hộp
 * Danh hiệu cao chạm mép: nút ✕ chui dưới đồng hồ/pin, khó bấm (chủ dự án báo
 * 14.10.2026, ảnh iPhone). Sáu hộp thoại cùng lỗi — mỗi cái tự khai lớp phủ.
 * Test quét MỌI khối CSS `position: fixed` + `inset: 0` có `padding` trong
 * component, nên hộp thoại thêm sau cũng không quên được.
 */
const dir = resolve(__dirname, '../src/components');

describe('lớp phủ fixed toàn màn hình có đệm vùng an toàn', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.vue'))) {
    const css = readFileSync(join(dir, f), 'utf8').split('<style')[1] ?? '';
    const khoi = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , b]) => /position:\s*fixed/.test(b!) && /inset:\s*0\b/.test(b!) && /padding/.test(b!));
    for (const [, sel, b] of khoi) {
      it(`${f} · ${sel!.trim().slice(0, 40)}`, () => {
        expect(b, 'thiếu env(safe-area-inset-top)').toMatch(/safe-area-inset-top/);
        expect(b, 'thiếu env(safe-area-inset-bottom)').toMatch(/safe-area-inset-bottom/);
      });
    }
  }
});
