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
        new RegExp(`${tag}" content="%VITE_(SITE|ASSET)_URL%`)
      );
    }
  });

  it('cả hai biến đều là URL tuyệt đối, https, không có dấu / ở cuối', () => {
    for (const key of ['VITE_SITE_URL', 'VITE_ASSET_URL']) {
      const m = new RegExp(`^${key}=(.+)$`, 'm').exec(env);
      expect(m, `.env phải khai ${key}`).toBeTruthy();
      const url = m![1]!.trim();
      expect(url, key).toMatch(/^https:\/\//);
      expect(url.endsWith('/'), `${key}: không để / ở cuối, các thẻ đã tự thêm`).toBe(false);
      expect(() => new URL(url), key).not.toThrow();
    }
  });

  it('og:url dùng SITE (trang người chơi vào), ảnh dùng ASSET (địa chỉ ổn định)', () => {
    // Trỏ og:url sang địa chỉ khác là đẩy người bấm link sang origin khác — mất
    // sạch điểm và kỷ lục đang lưu trong localStorage của origin cũ.
    expect(html).toContain('<meta property="og:url" content="%VITE_SITE_URL%/">');
    expect(html).toContain('<meta property="og:image" content="%VITE_ASSET_URL%/og.jpg">');
    expect(html).toContain('<meta name="twitter:image" content="%VITE_ASSET_URL%/og.jpg">');
  });

  it('ảnh og có thật trong public/, đúng cỡ đã khai 1200×630', () => {
    expect(existsSync(resolve(process.cwd(), 'public/og.jpg')), 'thiếu public/og.jpg').toBe(true);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });
});
