import { describe, expect, it } from 'vitest';
import {
  DEAL_ANIM_MS, DEAL_ROW_GAP_MS, DEAL_SETTLE_MS, DEAL_TOTAL_CAP_MS,
  dealDelay, dealRowGap, dealSpan
} from '@/lib/timing';

/**
 * NHỊP CHIA BÀI ĐI THEO HÀNG, KHÔNG THEO TỪNG THẺ.
 *
 * Bản trước so le 28ms một THẺ, nên bàn 88 thẻ có 88 animation lệch nhau chạy
 * cùng lúc — nhìn ra thành giật và không đọc được thứ tự nào. Nay cả một hàng
 * bay vào cùng lúc, hàng trên trước hàng dưới.
 */
describe('nhịp chia bài theo hàng', () => {
  it('hàng trên vào TRƯỚC hàng dưới', () => {
    const rows = 4;
    const moc = [0, 1, 2, 3].map((r) => dealDelay(r, rows));
    expect(moc).toEqual([...moc].sort((a, b) => a - b));
    expect(new Set(moc).size, 'hai hàng cùng mốc thì mất thứ tự').toBe(rows);
  });

  it('mọi cỡ bàn THẬT đều giữ đúng nhịp đã đặt', () => {
    // 12 cỡ bàn của game có nhiều nhất 11 hàng (88 thẻ, 8 cột). Ở nhịp 100ms thì
    // bàn to nhất cũng chỉ mất 1,0 giây nên không cỡ nào bị dồn.
    for (const rows of [2, 4, 6, 7, 9, 11]) {
      expect(dealRowGap(rows), `${rows} hàng`).toBe(DEAL_ROW_GAP_MS);
    }
    expect(dealSpan(11), 'bàn 88 thẻ').toBe(10 * DEAL_ROW_GAP_MS);
  });

  it('trần tổng vẫn chặn được khi nhịp bị nâng lên', () => {
    /*
     * Trần là CHỐT CHẶN, không phải mức thường dùng: ở 100ms nó không bao giờ
     * chạm. Nhưng nhịp là thứ hay được chỉnh — lúc thử 500ms thì bàn 88 thẻ mất
     * 5 giây, mà ván online thì 5 giây đó nằm TRƯỚC nước đi đầu tiên.
     */
    for (const rows of [2, 4, 11, 20, 40, 80]) {
      expect(dealSpan(rows), `${rows} hàng`).toBeLessThanOrEqual(DEAL_TOTAL_CAP_MS);
    }
    // Nhiều hàng hơn mọi bàn thật: trần phải bắt đầu dồn nhịp lại.
    expect(dealRowGap(40)).toBeLessThan(DEAL_ROW_GAP_MS);
  });

  it('dealSpan đúng bằng lúc HÀNG CUỐI bắt đầu bay vào', () => {
    for (const rows of [1, 4, 11]) {
      expect(dealSpan(rows)).toBe(dealDelay(rows - 1, rows));
    }
  });

  it('bàn một hàng không âm và không chia cho 0', () => {
    expect(dealSpan(1)).toBe(0);
    expect(dealDelay(0, 1)).toBe(0);
    expect(dealRowGap(0)).toBeGreaterThan(0);
    expect(dealDelay(-3, 4), 'hàng âm (dữ liệu hỏng) không được ra số âm').toBe(0);
  });

  it('CSS và JS dùng CÙNG một độ dài animation', () => {
    /*
     * `DEAL_ANIM_MS` là con số JS dùng để biết lúc nào lá đã nằm yên (bật
     * `settled`, tức mở lại hover). Lệch với CSS là hover bị khoá oan — bản cũ
     * khai 2,4s nên nó khoá hơn hai giây sau khi lá đã yên.
     */
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');
    const giay = Number(/animation: deal ([\d.]+)s/.exec(src)![1]);
    expect(giay * 1000).toBe(DEAL_ANIM_MS);
    expect(DEAL_SETTLE_MS, 'mốc "đã đáp" phải nằm trong animation').toBeLessThan(DEAL_ANIM_MS);
  });

  it('gợn sóng: lá LÚN rồi NỞ, không bay từ xa vào', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/components/CardTile.vue'), 'utf8');
    const kf = /@keyframes deal \{([\s\S]*?)\n\}/.exec(src)![1];
    // Khung đầu phải là cỡ LÚN (dưới 1), và phải nhỏ vừa phải — 0,72 như bản cũ
    // là "bay từ xa vào", không phải lún.
    const dau = Number(/0% \{[\s\S]*?scale\(([\d.]+)\)/.exec(kf)![1]);
    expect(dau).toBeGreaterThan(0.85);
    expect(dau).toBeLessThan(1);
    // Một chuyển động, một chiều: không lệch chỗ, không xoay.
    expect(kf, 'lá không được bay từ dưới lên nữa').not.toContain('translateY');
    expect(kf, 'xoay trong lúc chia là chuyển động thứ hai, đọc ra thành giật')
      .not.toContain('rotateY');
    // Nở QUÁ một chút rồi mới về 1, không thì cái nở dừng đột ngột.
    const dinh = [...kf.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(Math.max(...dinh), 'thiếu đoạn nở quá thì nhìn như hình bị cắt').toBeGreaterThan(1);
  });

  it('BoardGrid tính hàng từ số cột, không đoán', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/components/BoardGrid.vue'), 'utf8');
    expect(src).toMatch(/:row="Math\.floor\(card\.index \/ cols\)"/);
    expect(src).toMatch(/:rows="Math\.ceil\(cards\.length \/ cols\)"/);
  });
});
