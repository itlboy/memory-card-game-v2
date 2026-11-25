import { describe, expect, it } from 'vitest';
import { laTenTuSinh, taoTen, NGON_NGU_CO_TEN } from '@/lib/ten-goc';
import { AVATAR_HO_SO, MAU_HO_SO } from '@/lib/ho-so';

describe('hồ sơ người chơi (25.11.2026)', () => {
  it('nhận ra MỌI tên tự sinh ở mọi ngôn ngữ — người cũ mang tên đó phải gõ tên thật', () => {
    for (const l of NGON_NGU_CO_TEN) for (let i = 0; i < 40; i++) expect(laTenTuSinh(taoTen(l)), l).toBe(true);
  });
  it('tên tự gõ không bị coi là tự sinh', () => {
    for (const ten of ['Kiên', 'Mimi', 'Sóc', 'Sóc Đỏ', 'Sóc Đỏ Nhỏ Xíu', 'Bé Na', '']) expect(laTenTuSinh(ten), ten).toBe(false);
  });
  it('93 avatar không trùng, không có con gây khó chịu; 12 màu', () => {
    expect(AVATAR_HO_SO).toHaveLength(93);
    expect(new Set(AVATAR_HO_SO).size).toBe(93);
    for (const x of ['🪳', '🦟', '🪰', '🪱', '🐀', '🐁', '🐛', '🕷️', '🦂', '🐾', '🪶']) expect(AVATAR_HO_SO).not.toContain(x);
    expect(new Set(MAU_HO_SO).size).toBe(12);
  });
});
