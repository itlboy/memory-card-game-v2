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
    expect(html).toMatch(/og:image" content="%VITE_ASSET_URL%\/og\.jpg\?v=\d+"/);
    expect(html).toMatch(/twitter:image" content="%VITE_ASSET_URL%\/og\.jpg\?v=\d+"/);
  });

  it('ảnh og có thật trong public/, đúng cỡ đã khai 1200×630', () => {
    expect(existsSync(resolve(process.cwd(), 'public/og.jpg')), 'thiếu public/og.jpg').toBe(true);
    // Nguồn dựng ảnh phải còn trong repo: ảnh nhị phân không xem được lịch sử
    // thay đổi, còn HTML thì sửa chữ là xong.
    expect(existsSync(resolve(process.cwd(), '../../tools/og/og.html')), 'thiếu nguồn dựng ảnh og').toBe(true);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });
});

describe('nội dung ảnh og không được chứa con số', () => {
  it('nguồn dựng ảnh không ghi số cấp/mức/chế độ — số đổi mà ảnh bị cache rất lâu', () => {
    const src = readFileSync(resolve(process.cwd(), '../../tools/og/og.html'), 'utf8');
    // Chỉ soi phần <body>: phần chú thích ở đầu file có nhắc số để giải thích lý do
    const body = src.slice(src.indexOf('<body>'));
    const co = [...body.matchAll(/\d+\s*(cấp|mức|chế độ|số|thẻ|người)/g)].map((m) => m[0]);
    expect(co, 'ảnh chia sẻ nói "nhiều …", không nói con số').toEqual([]);
  });
});
