import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * DẢI NGƯỜI CHƠI KHÔNG ĐƯỢC ĐỔI CHIỀU CAO KHI CHUYỂN LƯỢT.
 *
 * Bàn thẻ bị chặn bởi chiều cao, nên dải cao thêm 3px là bàn hẹp đi 2px — và
 * đo được đúng thế trên iPhone 15 Pro Max, bàn 3 người: chip đang đi 46,1px,
 * chip chờ 39,8px, chuyển lượt là dải 48,5 → 45,5 → 48,5 và bàn 356 → 358 → 356
 * ("bàn đổi kích thước xíu khi chuyển lượt", người chơi báo). Chốt: chip có
 * chiều cao CỐ ĐỊNH ở cả hai màn, nội dung chip ra sao cũng không đụng tới bàn.
 */
const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');

describe('chip người chơi cao cố định', () => {
  it.each([
    ['PlayerStrip.vue', '.player'],
    ['OnlineGame.vue', '.pchip']
  ])('%s: %s khoá height', (f, sel) => {
    const css = doc(f);
    const re = new RegExp(`^\\${sel} \\{ height: 44px; \\}`, 'm');
    expect(css, `${f} thiếu "${sel} { height: 44px; }"`).toMatch(re);
  });
});
