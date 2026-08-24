import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Thẻ chia sẻ (og / twitter).
 *
 * Lỗi thật đã xảy ra: đổi tên miền sang thebai.hello314.com nhưng ba dòng og
 * trong index.html vẫn viết cứng tên miền cũ, mà tên miền cũ đã chết (530) — nên
 * mọi link chia sẻ mất ảnh và sai URL chuẩn tắc, âm thầm, không có gì báo.
 */
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');

describe('thẻ chia sẻ', () => {
  it('KHÔNG viết cứng tên miền — lấy từ VITE_SITE_URL', () => {
    const cung = [...html.matchAll(/(og:(?:url|image)|twitter:image)" content="(https?:\/\/[^"]*)"/g)];
    expect(cung.map((m) => `${m[1]} = ${m[2]}`), 'phải dùng %VITE_SITE_URL%').toEqual([]);
    for (const tag of ['og:url', 'og:image', 'twitter:image']) {
      expect(html, `${tag} phải lấy tên miền từ env`).toMatch(
        new RegExp(`${tag}" content="%VITE_SITE_URL%`)
      );
    }
  });

  it('VITE_SITE_URL là URL tuyệt đối, https, không có dấu / ở cuối', () => {
    const m = /^VITE_SITE_URL=(.+)$/m.exec(env);
    expect(m, '.env phải khai VITE_SITE_URL').toBeTruthy();
    const url = m![1]!.trim();
    expect(url).toMatch(/^https:\/\//);
    expect(url.endsWith('/'), 'không để / ở cuối, các thẻ đã tự thêm').toBe(false);
    expect(() => new URL(url)).not.toThrow();
  });

  it('ảnh og có thật trong public/, đúng cỡ đã khai 1200×630', () => {
    expect(existsSync(resolve(process.cwd(), 'public/og.jpg')), 'thiếu public/og.jpg').toBe(true);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });
});
