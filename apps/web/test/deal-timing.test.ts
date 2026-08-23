import { describe, expect, it } from 'vitest';
import { DEAL_WINDOW_MS, dealSpan, dealStep } from '@/lib/timing';

/** Hình và tiếng chia bài từng lấy hai công thức khác nhau nên lệch hẳn:
 *  bàn 4 thẻ hình xong sau 84ms mà tiếng kêu tới 350ms. Test này khoá lại. */
describe('nhịp chia bài (hình và tiếng dùng chung)', () => {
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

  it('thẻ cuối bay vào đúng lúc tiếng cuối vang — cùng một dealSpan', () => {
    for (const n of [4, 16, 50]) {
      // Hình: thẻ thứ n-1 có delay = dealStep * (n-1)
      const lastCardDelay = dealStep(n) * (n - 1);
      // Tiếng: tiếng thứ 12 (cuối) có delay = dealSpan
      expect(lastCardDelay).toBeCloseTo(dealSpan(n), 6);
    }
  });

  it('bàn 1 thẻ không âm và không chia cho 0', () => {
    expect(dealSpan(1)).toBe(0);
    expect(dealStep(0)).toBeGreaterThan(0);
  });
});
