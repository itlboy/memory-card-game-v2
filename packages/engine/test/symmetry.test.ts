import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, allLevels } from '../src/campaign.js';
import { buildDeck } from '../src/deck.js';
import { Rng } from '../src/rng.js';

// Đủ cho cấp cuối (bàn 10×10 = 50 cặp) — bộ 30 cũ chết ngay ở bàn 8×9.
const SYMBOLS = Array.from({ length: 50 }, (_, i) => `s${i}`);

/**
 * Thang cấp chỉ dùng bàn ĐẦY: mọi ô đều có thẻ. Ô trống lệch một bên làm bàn
 * trông như bị khuyết, mà bàn khuyết đối xứng cũng vẫn là chỗ hở giữa các thẻ.
 */
describe('bàn của mọi cấp đều đầy và cân', () => {
  const boards = Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => {
    const spec = allLevels()[i]!;
    return {
      spec,
      cards: buildDeck({
        cols: spec.cols, rows: spec.rows, pairs: spec.pairs,
        symbols: SYMBOLS, rng: new Rng(i + 1)
      })
    };
  });

  it('không cấp nào có ô trống', () => {
    for (const { spec, cards } of boards) {
      expect(cards.filter((c) => c.blank).length, `cấp ${spec.id}`).toBe(0);
    }
  });

  it('số ô đúng bằng số thẻ — cols × rows = pairs × 2', () => {
    for (const { spec, cards } of boards) {
      expect(spec.cols * spec.rows, `cấp ${spec.id}`).toBe(spec.pairs * 2);
      expect(cards).toHaveLength(spec.pairs * 2);
    }
  });

  it('bàn không dài quá gấp đôi — 2×5 kiểu dải là loại bỏ', () => {
    for (const { spec } of boards) {
      expect(spec.rows / spec.cols, `cấp ${spec.id} (${spec.cols}×${spec.rows})`)
        .toBeLessThanOrEqual(2);
    }
  });

  /**
   * Trần 100 thẻ (10×10). Hai cỡ cuối — 72 và 100 thẻ — CỐ Ý phá ngưỡng chạm
   * 44px (quyết định của chủ dự án, xem chú thích BOARDS trong campaign.ts):
   * đó là bàn siêu khó người chơi tự chọn. Mọi cỡ TỪ 56 THẺ TRỞ XUỐNG vẫn phải
   * giữ ngưỡng — chốt này canh không ai lén thêm cỡ mới ở khoảng giữa.
   */
  it('trần 100 thẻ, và chỉ hai cỡ cuối được phá ngưỡng 44px', () => {
    const sizes = [...new Set(boards.map((b) => b.spec.pairs * 2))].sort((a, b) => a - b);
    expect(Math.max(...sizes)).toBe(100);
    expect(sizes.filter((n) => n > 56)).toEqual([72, 100]);
  });
});
