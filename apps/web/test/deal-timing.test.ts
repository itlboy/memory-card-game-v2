import { describe, expect, it } from 'vitest';
import { DEAL_WINDOW_MS, dealSpan, dealStep } from '@/lib/timing';

/**
 * Nhịp chia bài (chỉ còn phần HÌNH — tiếng chia bài đã bỏ theo yêu cầu, nó gây
 * khó chịu; `dealSpan` giữ lại vì nó là mốc "thẻ cuối đã bay vào", CardTile dùng
 * để biết lúc nào chia xong).
 */
describe('nhịp chia bài', () => {
  it('bàn nhỏ giữ độ so le 28ms, bàn lớn nén lại', () => {
    expect(dealStep(4)).toBe(28);
    expect(dealStep(16)).toBe(28);
    expect(dealStep(50)).toBeLessThan(28);
  });

  it('tổng thời gian chia bài không vượt cửa sổ, bàn to cỡ nào cũng vậy', () => {
    for (const n of [2, 4, 8, 16, 24, 36, 50, 100]) {
      expect(dealSpan(n), `${n} thẻ`).toBeLessThanOrEqual(DEAL_WINDOW_MS);
    }
  });

  it('dealSpan đúng bằng lúc thẻ CUỐI bay vào', () => {
    for (const n of [4, 16, 50]) {
      expect(dealStep(n) * (n - 1)).toBeCloseTo(dealSpan(n), 6);
    }
  });

  it('bàn 1 thẻ không âm và không chia cho 0', () => {
    expect(dealSpan(1)).toBe(0);
    expect(dealStep(0)).toBeGreaterThan(0);
  });
});
