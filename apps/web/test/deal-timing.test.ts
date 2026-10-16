import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as timing from '@/lib/timing';
import { DEAL_ANIM_MS, DEAL_SETTLE_MS } from '@/lib/timing';

/**
 * CẢ BÀN HIỆN CÙNG LÚC (chủ dự án 16.10.2026). Lịch sử: so le 28ms mỗi THẺ (giật) →
 * lệch 100ms mỗi HÀNG (gợn sóng, "không mượt") → nay mọi lá chung một nhịp, không trễ.
 */
const doc = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('nhịp chia bài: cả bàn cùng lúc', () => {
  it('không còn độ trễ theo hàng / theo thẻ', () => {
    expect(Object.keys(timing)).not.toContain('dealDelay');
    expect(Object.keys(timing)).not.toContain('DEAL_ROW_GAP_MS');
    const tile = doc('src/components/CardTile.vue');
    expect(tile, 'animation deal không được có delay riêng từng lá').not.toMatch(/animation-delay:\s*var\(--deal/);
    expect(tile).not.toContain("'--deal'");
    expect(doc('src/components/BoardGrid.vue'), 'BoardGrid không còn truyền hàng cho CardTile').not.toMatch(/:rows?="/);
  });

  it('CSS và JS dùng CÙNG một độ dài animation', () => {
    /*
     * `DEAL_ANIM_MS` là con số JS dùng để biết lúc nào lá đã nằm yên (bật
     * `settled`, tức mở lại hover). Lệch với CSS là hover bị khoá oan — bản cũ
     * khai 2,4s nên nó khoá hơn hai giây sau khi lá đã yên.
     */
    const src = doc('src/components/CardTile.vue');
    const giay = Number(/animation: deal ([\d.]+)s/.exec(src)![1]);
    expect(giay * 1000).toBe(DEAL_ANIM_MS);
    expect(DEAL_SETTLE_MS, 'mốc "đã đáp" phải nằm trong animation').toBeLessThan(DEAL_ANIM_MS);
  });

  it('gợn sóng: lá LÚN rồi NỞ, không bay từ xa vào', () => {
    const src = doc('src/components/CardTile.vue');
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

});
