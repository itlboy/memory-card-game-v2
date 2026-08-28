import { describe, expect, it } from 'vitest';
import { MAX_ASPECT, MIN_ASPECT, computeFit } from '@/composables/useBoardFit';
import { allLevels } from '@mm/engine';

/** Chỗ trống thật của bàn, đo trên máy nhỏ nhất và máy phổ thông. */
const AREAS = { 'iPhone SE': [351, 510], 'iPhone 14': [366, 618] } as const;

describe('tính cỡ bàn thẻ', () => {
  it('tỷ lệ lá bài luôn nằm trong khoảng cho phép', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { aspect } = computeFit(w, h, l.cols, l.rows);
        expect(aspect, `cấp ${l.id} @ ${name}`).toBeGreaterThanOrEqual(MIN_ASPECT);
        expect(aspect, `cấp ${l.id} @ ${name}`).toBeLessThanOrEqual(MAX_ASPECT);
      }
    }
  });

  it('bàn không bao giờ rộng hơn chỗ được chia', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        expect(computeFit(w, h, l.cols, l.rows).width, `cấp ${l.id} @ ${name}`)
          .toBeLessThanOrEqual(w);
      }
    }
  });

  it('mọi cấp đều lấp ít nhất 95% bề rộng — không còn hai dải trống hai bên', () => {
    for (const l of allLevels()) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const used = computeFit(w, h, l.cols, l.rows).width / w;
        expect(used, `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}`).toBeGreaterThan(0.95);
      }
    }
  });

  /* Hai cỡ lớn nhất (72 và 88 thẻ) CỐ Ý phá ngưỡng — bàn siêu khó người chơi
     tự chọn, xem chú thích BOARDS trong campaign.ts. Mọi cỡ còn lại vẫn phải
     giữ 44px, nên chốt này lọc theo số thẻ chứ không bỏ hẳn. */
  it('lá bài không bao giờ dưới ngưỡng chạm 44px (NF-07), trừ hai cỡ lớn nhất', () => {
    for (const l of allLevels().filter((x) => x.pairs * 2 <= 56)) {
      for (const [name, [w, h]] of Object.entries(AREAS)) {
        const { width } = computeFit(w, h, l.cols, l.rows);
        const gap = w < 420 ? 6 : 8;
        const cardW = (width - gap * (l.cols - 1)) / l.cols;
        expect(cardW, `cấp ${l.id} (${l.cols}×${l.rows}) @ ${name}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it('chỗ trống ít hơn thì bàn nhỏ theo, không tràn ra ngoài', () => {
    // Màn online có thêm bảng người chơi nên chiều cao ít hơn chơi đơn
    const solo = computeFit(366, 618, 4, 5);
    const online = computeFit(366, 530, 4, 5);
    expect(online.width).toBeLessThanOrEqual(solo.width);
    expect(online.width).toBeLessThanOrEqual(366);
  });
});
