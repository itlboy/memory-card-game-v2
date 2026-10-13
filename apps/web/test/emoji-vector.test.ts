import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anhEmoji, tenFileEmoji } from '@/lib/emoji';

/**
 * MẶT BÀI VẼ BẰNG SVG TRÊN MÁY KHÔNG PHẢI APPLE (phương án B, 14.10.2026).
 *
 * Android vẽ emoji bằng bitmap ~136px → mờ trên mặt bài; Windows không có emoji
 * cờ. Mọi emoji trong themes.json PHẢI có file public/emoji/<mã>.svg — thêm theme
 * mà quên `node tools/tai-twemoji.mjs` là test này đỏ (không thì lá bài ra ảnh vỡ).
 */
const web = resolve(__dirname, '..');
const themes: { id: string; symbols: string[] }[] = JSON.parse(readFileSync(resolve(web, 'public/data/themes.json'), 'utf8')).themes;
const LA_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

describe('hình vector cho mặt bài', () => {
  it('mọi emoji của mọi theme đều có file SVG', () => {
    const thieu = themes.flatMap((t) => t.symbols.filter((s) => LA_EMOJI.test(s))
      .filter((s) => !existsSync(resolve(web, 'public/emoji', `${tenFileEmoji(s)}.svg`))).map((s) => `${t.id}: ${s}`));
    expect(thieu, 'chạy `node tools/tai-twemoji.mjs`').toEqual([]);
  });

  it('tên file bỏ fe0f, giữ nguyên chuỗi ghép ZWJ', () => {
    expect(tenFileEmoji('❤️')).toBe('2764');
    expect(tenFileEmoji('🧑‍⚕️')).toBe('1f9d1-200d-2695');
    expect(tenFileEmoji('🇻🇳')).toBe('1f1fb-1f1f3');
  });

  it('máy Apple giữ emoji chữ; chữ/số và ô úp rỗng không thành ảnh', () => {
    expect(anhEmoji('🐼', false)).toBeNull();
    expect(anhEmoji('🐼', true)).toBe('/emoji/1f43c.svg');
    expect(anhEmoji('A', true)).toBeNull();
    expect(anhEmoji('7', true)).toBeNull();
    expect(anhEmoji('', true)).toBeNull();
    expect(anhEmoji(undefined, true)).toBeNull();
  });
});
