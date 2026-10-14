import { describe, expect, it } from 'vitest';
import { NGON_NGU, TU_DIEN } from '../src/lib/i18n';

/**
 * Hai bộ hình KHÔNG được trùng tên trong cùng một ngôn ngữ: bản tiếng Pháp từng có
 * hai ô "Cuisine" (food + kitchen) cạnh nhau ở bước chọn theme (chủ dự án báo, có ảnh).
 */
describe('tên bộ hình không trùng', () => {
  for (const { id } of NGON_NGU) {
    it(id, () => {
      const tu = TU_DIEN[id] as Record<string, unknown>;
      const ten = Object.entries(tu)
        .filter(([k, v]) => k.startsWith('theme.') && typeof v === 'string')
        .map(([k, v]) => [k, (v as string).trim().toLocaleLowerCase()] as const);
      expect(ten.length).toBeGreaterThanOrEqual(48);   // chốt chống xanh rỗng
      const gap = new Map<string, string[]>();
      for (const [k, v] of ten) gap.set(v, [...(gap.get(v) ?? []), k]);
      expect([...gap.values()].filter((ks) => ks.length > 1)).toEqual([]);
    });
  }
});
