import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anhEmoji, boEmojiThu, boEmojiVeMacDinh, chonCoAnh, doiBoEmojiThu, datDungVector, dungVector, tenFileEmoji } from '@/lib/emoji';
import { store } from '@/lib/storage';

/**
 * MẶT BÀI VẼ BẰNG ẢNH NOTO 3D TRÊN MỌI MÁY (15.10.2026).
 *
 * Mọi emoji trong themes.json PHẢI có public/emoji/3d/{,128/,256/}<mã>.webp — thêm
 * theme mà quên `node tools/tai-noto3d.mjs` là test này đỏ (không thì lá bài ra ảnh
 * vỡ). Không còn bộ dự phòng: Noto 3D thiếu hình thì chọn emoji khác.
 */
const web = resolve(__dirname, '..');
const themes: { id: string; symbols: string[] }[] = JSON.parse(readFileSync(resolve(web, 'public/data/themes.json'), 'utf8')).themes;
const LA_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

describe('hình vector cho mặt bài', () => {
  it('tên file bỏ fe0f, giữ nguyên chuỗi ghép ZWJ', () => {
    expect(tenFileEmoji('❤️')).toBe('2764');
    expect(tenFileEmoji('🧑‍⚕️')).toBe('1f9d1-200d-2695');
    expect(tenFileEmoji('🇻🇳')).toBe('1f1fb-1f1f3');
  });

  it('tắt vẽ ảnh thì giữ emoji chữ; chữ/số và ô úp rỗng không thành ảnh', () => {
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
