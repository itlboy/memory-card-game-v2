import { describe, expect, it } from 'vitest';
import { EMOJI_NHOM, EMOJI_PHO_BIEN, QUICK_EMOJIS } from '@mm/engine';
import { xepHayDung } from '@/lib/emoji-hay-dung';

describe('emoji hay dùng (hàng ngoài thanh emoji)', () => {
  it('máy mới: đúng bộ phổ biến, đúng thứ tự', () => {
    expect(xepHayDung({}, 7)).toEqual(EMOJI_PHO_BIEN.slice(0, 7));
  });
  it('dùng nhiều thì lên đầu; hoà thì giữ thứ tự mặc định', () => {
    const r = xepHayDung({ '🐢': 5, '🔥': 2, '👍': 2 }, 4);
    expect(r).toEqual(['🐢', '👍', '🔥', '😂']);
  });
  it('mọi emoji trong bộ phổ biến đều được server nhận', () => {
    for (const e of EMOJI_PHO_BIEN) expect(QUICK_EMOJIS).toContain(e);
  });
  it('emoji cũ (bản app trước 07.11.2026 gửi) vẫn nằm trong danh sách', () => {
    for (const e of ['😂', '🐔', '🐌', '🐢', '💩', '😭', '😡', '🔥', '🎉']) expect(QUICK_EMOJIS).toContain(e);
  });
  it('không trùng emoji trong cùng một nhóm', () => {
    for (const ds of Object.values(EMOJI_NHOM)) expect(new Set(ds).size).toBe(ds.length);
  });
});
