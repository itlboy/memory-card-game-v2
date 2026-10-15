/**
 * ẢNH TRÊN TRANG CÔNG KHAI KHÔNG ĐƯỢC TO HƠN KHUNG HIỂN THỊ QUÁ NHIỀU (chủ dự án 15.10.2026:
 * ảnh 540px/900px trong khung ~230/300px — máy thường tải thừa gấp 2–3 lần).
 *
 * Luật: mỗi ảnh chụp có HAI cỡ — 1x (≈ bề rộng khung) và 2x (máy Retina) — gắn bằng
 * `srcset` + `sizes`, để trình duyệt tự chọn. Trần cỡ lớn nhất = 2 × khung lớn nhất
 * (điện thoại 232px → 464, iPad 300px → 600). Đổi bố cục làm khung to ra thì đo lại
 * (bề rộng thật của <img>) rồi mới nâng trần ở đây.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(__dirname, '..', 'public');
const IMG = join(PUB, 'site', 'img');
// px — 2 × khung lớn nhất: ảnh iPad (khung ≤300px) và ảnh điện thoại (khung ≤232px)
const tran = (f: string): number => (f.startsWith('ipad-') ? 600 : 464);

/** Bề rộng ảnh WebP đọc thẳng từ header (VP8 / VP8L / VP8X) — không cần công cụ ngoài. */
function rongWebp(f: string): number {
  const b = readFileSync(f);
  const loai = b.toString('ascii', 12, 16);
  if (loai === 'VP8X') return 1 + b.readUIntLE(24, 3);
  if (loai === 'VP8 ') return b.readUInt16LE(26) & 0x3fff;
  if (loai === 'VP8L') return 1 + (((b[22] & 0x3f) << 8) | b[21]);
  throw new Error(`${f}: không đọc được header WebP (${loai})`);
}

describe('ảnh trang công khai vừa với khung', () => {
  const anh = readdirSync(IMG).filter((f) => f.endsWith('.webp'));

  it.each(anh)('%s không rộng quá trần', (f) => {
    expect(rongWebp(join(IMG, f))).toBeLessThanOrEqual(tran(f));
  });

  it('mọi <img> ảnh chụp có srcset + sizes, trỏ tới file có thật', () => {
    const co = new Set(anh);
    for (const trang of readdirSync(PUB).filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(PUB, trang), 'utf8');
      for (const [the] of html.matchAll(/<img\b[^>]*site\/img\/[^>]*>/g)) {
        expect(the, `${trang}: ${the.slice(0, 80)}`).toMatch(/\ssrcset="[^"]+"/);
        expect(the, `${trang}: ${the.slice(0, 80)}`).toMatch(/\ssizes="[^"]+"/);
        for (const [, ten] of the.matchAll(/site\/img\/([\w-]+\.webp)/g)) {
          expect(co.has(ten), `${trang} trỏ tới ${ten} không có thật`).toBe(true);
        }
      }
    }
  });

  it('JSON-LD (dung-trang-cong-khai.mjs) chỉ nhắc ảnh có thật', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', 'tools', 'dung-trang-cong-khai.mjs'), 'utf8');
    const m = src.match(/screenshot:\s*\[([^\]]+)\]\.map\(\(f\) => `\$\{SITE\}\/site\/img\/\$\{f\}([^`]*)`\)/);
    expect(m, 'không tìm thấy danh sách screenshot').toBeTruthy();
    const duoi = m![2];
    for (const [, ten] of m![1].matchAll(/'([\w-]+)'/g)) {
      expect(anh.includes(`${ten}${duoi}`), `${ten}${duoi}`).toBe(true);
    }
  });
});
