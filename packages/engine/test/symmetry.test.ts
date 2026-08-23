import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, gridForPairs, levelSpec } from '../src/campaign.js';
import { buildDeck } from '../src/deck.js';
import { Rng } from '../src/rng.js';

const SYMBOLS = Array.from({ length: 30 }, (_, i) => `s${i}`);

/** Ô trống lệch về một bên làm bàn trông như bị khuyết — rất khó chịu lúc chia
 *  bài. Mọi cấp phải xếp được bàn đối xứng theo trục dọc. */
describe('ô trống luôn đối xứng', () => {
  const boards = Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => {
    const spec = levelSpec(i + 1);
    const cards = buildDeck({
      cols: spec.cols, rows: spec.rows, pairs: spec.pairs,
      symbols: SYMBOLS, rng: new Rng(i + 1)
    });
    return { spec, cards };
  });

  it('mỗi bàn đối xứng khi lật gương theo trục dọc', () => {
    for (const { spec, cards } of boards) {
      const { cols, rows } = spec;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const here = !!cards[r * cols + c]!.blank;
          const mirrored = !!cards[r * cols + (cols - 1 - c)]!.blank;
          expect(here, `cấp ${spec.id} · ô (${r},${c})`).toBe(mirrored);
        }
      }
    }
  });

  it('số ô trống chỉ có thể là 0, 1, hoặc một số chẵn', () => {
    for (const { spec, cards } of boards) {
      const blanks = cards.filter((c) => c.blank).length;
      expect(blanks % 2 === 0 || blanks === 1, `cấp ${spec.id} có ${blanks} ô trống`).toBe(true);
    }
  });

  it('một ô trống thì nằm đúng tâm bàn', () => {
    for (const { spec, cards } of boards) {
      const idx = cards.findIndex((c) => c.blank);
      if (cards.filter((c) => c.blank).length !== 1) continue;
      expect(idx % spec.cols, `cấp ${spec.id}`).toBe((spec.cols - 1) / 2);
      expect(Math.floor(idx / spec.cols), `cấp ${spec.id}`).toBe((spec.rows - 1) / 2);
    }
  });

  it('nhiều ô trống thì đều nằm ở HÀNG CUỐI, chia đều hai đầu', () => {
    for (const { spec, cards } of boards) {
      const blankRows = new Set(
        cards.map((c, i) => (c.blank ? Math.floor(i / spec.cols) : -1)).filter((r) => r >= 0)
      );
      if (cards.filter((c) => c.blank).length < 2) continue;
      expect([...blankRows], `cấp ${spec.id}`).toEqual([spec.rows - 1]);
    }
  });

  it('mọi số cặp trong tầm đều xếp được bàn không lệch', () => {
    for (let pairs = 2; pairs <= 25; pairs++) {
      const { cols, rows } = gridForPairs(pairs);
      const waste = cols * rows - pairs * 2;
      expect(waste % 2 === 0 || waste === 1, `${pairs} cặp thừa ${waste} ô`).toBe(true);
    }
  });
});
