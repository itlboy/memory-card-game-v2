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
  it('mã câu không trùng', () => {
    expect(QUICK_SAYS.length % 2).toBe(0);
    expect(new Set(QUICK_SAYS).size).toBe(QUICK_SAYS.length);
  });

  it('câu nào cũng có emoji riêng, không trùng nhau', () => {
    const e = QUICK_SAYS.map((id) => EMOJI_NOI[id]);
    expect(e.every(Boolean)).toBe(true);
    expect(new Set(e).size, 'hai câu cùng emoji thì không nhận ra trong một liếc').toBe(e.length);
  });

  // 22.11.2026: khung chọn và bong bóng vẽ ICON (Lucide trong vòng màu) — thiếu một câu là IconNoi vỡ lúc vẽ
  it('câu nào cũng có icon', async () => {
    const { ICON_NOI } = await import('@/lib/noi-nhanh');
    for (const id of QUICK_SAYS) expect(ICON_NOI[id]?.c, id).toBeTruthy();
  });

  it('câu nào cũng được dịch ở mọi ngôn ngữ', async () => {
    for (const { id: l } of NGON_NGU) {
      const tu = (await import(`../src/locales/${l}.ts`)).default as Record<string, unknown>;
      for (const id of QUICK_SAYS) expect(String(tu[`say.${id}`] ?? '').trim(), `${l}: say.${id}`).not.toBe('');
    }
  });

  // Nút nói nhanh CÓ LẠI (22.11.2026, mockup duyệt https://claude.ai/artifact/54TeMHuUCQA2pxs7FN7C4Q): ngoài cùng bên trái,
  // rồi tới ＋ — luật ẩn bớt chỉ đụng từ con thứ 6 nên cả hai luôn còn.
  it('nút nói chuyện là con ĐẦU của thanh, ＋ thứ hai, rồi mới tới hàng emoji', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/EmojiBar.vue'), 'utf8');
    const bar = src.slice(src.indexOf('class="emoji-bar"'));
    expect(bar.indexOf('emoji noi')).toBeGreaterThan(-1);
    expect(bar.indexOf('emoji noi')).toBeLessThan(bar.indexOf('emoji chon'));
    expect(bar.indexOf('emoji chon')).toBeLessThan(bar.indexOf('v-for="e in hangNgoai"'));
  });
  it('5 câu đúng chủ dự án chọn, đúng thứ tự', async () => {
    const { NOI_NHANH } = await import('@mm/engine');
    expect([...NOI_NHANH]).toEqual(['gioi', 'choiTiep', 'henGap', 'vuiChoi', 'dongY']);
    const vi = (await import('../src/locales/vi.ts')).default as Record<string, string>;
    expect(NOI_NHANH.map((id) => vi[`say.${id}`])).toEqual([
      'Bạn giỏi quá', 'Chúng ta chơi tiếp nhé', 'Tôi bận rồi, hẹn gặp lại sau nhé', 'Rất vui được chơi với bạn', 'Đồng ý'
    ]);
  });
});
