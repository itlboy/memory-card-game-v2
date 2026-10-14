import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUICK_SAYS } from '@mm/engine';
import { EMOJI_NOI } from '@/lib/noi-nhanh';
import { NGON_NGU } from '@/lib/i18n';

/**
 * NÓI NHANH (14.10.2026): chỉ câu CÓ SẴN, mã đi trên dây, mỗi máy tự dịch.
 * Thiếu emoji / bản dịch của một câu là bảng chọn hiện ra ô trống hoặc mã thô.
 */
describe('nói nhanh', () => {
  it('đúng 12 câu — bảng 2 cột tròn hàng', () => {
    expect(QUICK_SAYS.length % 2).toBe(0);
    expect(new Set(QUICK_SAYS).size).toBe(QUICK_SAYS.length);
  });

  it('câu nào cũng có emoji riêng, không trùng nhau', () => {
    const e = QUICK_SAYS.map((id) => EMOJI_NOI[id]);
    expect(e.every(Boolean)).toBe(true);
    expect(new Set(e).size, 'hai câu cùng emoji thì không nhận ra trong một liếc').toBe(e.length);
  });

  it('câu nào cũng được dịch ở mọi ngôn ngữ', async () => {
    for (const { id: l } of NGON_NGU) {
      const tu = (await import(`../src/locales/${l}.ts`)).default as Record<string, unknown>;
      for (const id of QUICK_SAYS) expect(String(tu[`say.${id}`] ?? '').trim(), `${l}: say.${id}`).not.toBe('');
    }
  });

  it('nút 💬 là con ĐẦU của thanh — luật ẩn bớt emoji không bao giờ ẩn nó', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    const bar = src.slice(src.indexOf('class="emoji-bar"'));
    expect(bar.indexOf('emoji say')).toBeLessThan(bar.indexOf('v-for="e in QUICK_EMOJIS"'));
  });
});
