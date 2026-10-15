import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anhEmoji, chonCoAnh, datDungVector, dungVector, tenFileEmoji } from '@/lib/emoji';
import { store } from '@/lib/storage';

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

  it('mọi emoji của mọi theme đều có ảnh Noto 3D (hoặc nằm trong thieu.json)', () => {
    const chuaCo = new Set<string>(JSON.parse(readFileSync(resolve(web, 'public/emoji/3d/thieu.json'), 'utf8')));
    const thieu = themes.flatMap((t) => t.symbols.filter((s) => LA_EMOJI.test(s))
      .filter((s) => !chuaCo.has(tenFileEmoji(s)) && !['', '128/', '256/'].every((d) => existsSync(resolve(web, 'public/emoji/3d', `${d}${tenFileEmoji(s)}.webp`)))).map((s) => `${t.id}: ${s}`));
    expect(thieu, 'chạy `node tools/tai-noto3d.mjs`').toEqual([]);
  });

  it('lá nhỏ lấy ảnh nhỏ: chọn cỡ nhỏ nhất đủ nét', () => {
    expect(chonCoAnh(30, 3)).toBe(128);   // bàn 88 thẻ
    expect(chonCoAnh(70, 2.75)).toBe(256);
    expect(chonCoAnh(140, 3)).toBe(512); // quạt lá / bàn 4 thẻ
    expect(chonCoAnh(400, 3)).toBe(512);
    expect(anhEmoji('🐼', true, 128)).toBe('/emoji/3d/128/1f43c.webp');
    expect(anhEmoji('🐼', true, 512)).toBe('/emoji/3d/1f43c.webp');
  });

  it('tên file bỏ fe0f, giữ nguyên chuỗi ghép ZWJ', () => {
    expect(tenFileEmoji('❤️')).toBe('2764');
    expect(tenFileEmoji('🧑‍⚕️')).toBe('1f9d1-200d-2695');
    expect(tenFileEmoji('🇻🇳')).toBe('1f1fb-1f1f3');
  });

  it('máy Apple giữ emoji chữ; chữ/số và ô úp rỗng không thành ảnh', () => {
    expect(anhEmoji('🐼', false)).toBeNull();
    expect(anhEmoji('🐼', true)).toBe('/emoji/3d/1f43c.webp');
    expect(anhEmoji('A', true)).toBeNull();
    expect(anhEmoji('7', true)).toBeNull();
    expect(anhEmoji('', true)).toBeNull();
    expect(anhEmoji(undefined, true)).toBeNull();
  });

  it('công tắc ở menu đổi TỨC THÌ và được lưu lại', () => {
    datDungVector(true);
    expect(anhEmoji('🐼')).toBe('/emoji/3d/1f43c.webp');
    expect(store.prefs().kieuEmoji).toBe('vector');
    datDungVector(false);
    expect(dungVector.value).toBe(false);
    expect(anhEmoji('🐼')).toBeNull();
    expect(store.prefs().kieuEmoji).toBe('may');
  });
});
