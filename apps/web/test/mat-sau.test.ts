import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_BACKS, backForSeed } from '@mm/engine';

/**
 * MỖI TÊN MẶT SAU PHẢI CÓ CSS.
 *
 * `CARD_BACKS` nằm ở engine (server suy mặt sau từ seed để cả phòng thấy giống
 * nhau), còn hình thì nằm ở CSS của CardTile.vue. Hai chỗ khác nhau nên thêm
 * tên mà quên hình là lá bài ra một ô TRẮNG TRƠN — không test nào khác đỏ.
 */
// Hình mặt sau nay ở file CSS riêng, không còn nằm trong component.
const css = readFileSync(resolve(process.cwd(), 'src/styles/card-backs.css'), 'utf8');

describe('mặt sau lá bài', () => {
  it('có đủ 6 kiểu', () => {
    expect(CARD_BACKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(CARD_BACKS).size, 'tên trùng nhau').toBe(CARD_BACKS.length);
  });

  for (const back of CARD_BACKS) {
    it(`"${back}" có class .back.bk-${back} kèm nền`, () => {
      const i = css.indexOf(`.back.bk-${back} {`);
      expect(i, 'thiếu CSS thì mặt sau ra ô trắng trơn').toBeGreaterThan(-1);
      const khoi = css.slice(i, css.indexOf('}', i));
      expect(khoi, 'phải có gradient nền').toContain('linear-gradient');
      // Cùng khuôn `center / 100% 100%` cho MỌI lá — khác đi là đánh dấu bài.
      expect(khoi).toContain('center / 100% 100% no-repeat');
    });
  }

  it('backForSeed chỉ trả tên nằm trong danh sách, và tất định', () => {
    for (let seed = 0; seed < 400; seed++) {
      expect(CARD_BACKS).toContain(backForSeed(seed));
      expect(backForSeed(seed)).toBe(backForSeed(seed));
    }
  });

  it('mọi kiểu đều bốc được ra (không có kiểu chết)', () => {
    const thay = new Set(Array.from({ length: 3000 }, (_, s) => backForSeed(s)));
    expect(thay.size, 'có kiểu không bao giờ xuất hiện').toBe(CARD_BACKS.length);
  });
});
