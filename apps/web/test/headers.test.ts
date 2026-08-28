import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * public/_headers là luật cache Cloudflare Pages đọc lúc deploy. Sai hoặc mất
 * file thì KHÔNG có gì báo lỗi — chỉ người chơi âm thầm chạy bản cũ. Nên khoá
 * lại bằng test đọc file thật.
 */
// Dùng cwd chứ không dùng import.meta.url: test chạy trong happy-dom nên
// import.meta.url là URL http, fileURLToPath ném lỗi.
const raw = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');

/** Đọc Cache-Control của một đường dẫn trong _headers. */
function cacheControl(path: string): string | null {
  const lines = raw.split('\n').map((l) => l.replace(/#.*$/, '').trimEnd());
  const i = lines.findIndex((l) => l === path);
  if (i < 0) return null;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (!l.trim()) continue;
    if (!l.startsWith(' ')) return null;                 // sang khối khác mà chưa thấy
    const m = /^\s*Cache-Control:\s*(.+)$/i.exec(l);
    if (m) return m[1]!.trim();
  }
  return null;
}

describe('luật cache (public/_headers)', () => {
  it('index.html và trang gốc không bao giờ được dùng lại mà không hỏi server', () => {
    for (const p of ['/', '/index.html']) {
      const cc = cacheControl(p);
      expect(cc, `thiếu luật cho ${p}`).toBeTruthy();
      expect(cc, p).toMatch(/no-cache|no-store|max-age=0/);
    }
  });

  it('service worker không được cache — cache thì người chơi mắc kẹt ở bản cũ', () => {
    expect(cacheControl('/sw.js')).toMatch(/no-cache|no-store|max-age=0/);
  });

  it('asset có hash trong tên thì cache dài và immutable', () => {
    const cc = cacheControl('/assets/*');
    expect(cc).toContain('immutable');
    expect(cc).toMatch(/max-age=\d{7,}/);                // ít nhất vài tháng
  });

  it('KHÔNG dùng no-store cho index.html — service worker sẽ không precache được', () => {
    // no-store cấm lưu hẳn, PWA mất khả năng chạy offline. no-cache mới đúng:
    // vẫn lưu nhưng luôn hỏi lại, không có bản mới thì server trả 304.
    expect(cacheControl('/index.html')).not.toContain('no-store');
  });
});

/**
 * `_headers` chỉ Cloudflare đọc — server Node bỏ qua hoàn toàn. Nên bản Node
 * phải tự đặt Cache-Control, và luật hai bên phải KHỚP. Lệch nhau là hai nơi
 * hành xử khác nhau: đã xảy ra thật trên thebai2.hello314.com — ảnh mới lên pod
 * rồi mà trình duyệt vẫn chạy bản cũ, vì Node trả index.html không kèm
 * Cache-Control.
 */
describe('server Node đặt cùng luật cache với _headers', () => {
  const nodeSrc = readFileSync(
    resolve(process.cwd(), '../node-server/src/index.ts'), 'utf8',
  );

  it('có hàm đặt Cache-Control cho file tĩnh', () => {
    expect(nodeSrc).toMatch(/Cache-Control/);
    expect(nodeSrc).toMatch(/function cacheControl/);
  });

  it('index.html / sw.js / manifest đều no-cache, giống _headers', () => {
    const m = /if \(\/\(index\\.html\|sw\\.js\|manifest\\.webmanifest\)\$\/\.test\(file\)\) return '([^']+)'/.exec(nodeSrc);
    expect(m, 'không thấy luật no-cache cho index.html/sw.js/manifest').toBeTruthy();
    expect(m![1]).toBe(cacheControl('/index.html'));
    expect(m![1]).toBe(cacheControl('/sw.js'));
  });

  it('asset có hash cache dài và immutable, giống _headers', () => {
    const m = /assets\[\/\\\\\]\/\.test\(file\)\) return '([^']+)'/.exec(nodeSrc)
      ?? /return '(public, max-age=\d+, immutable)'/.exec(nodeSrc);
    expect(m, 'không thấy luật immutable cho /assets/').toBeTruthy();
    expect(m![1]).toBe(cacheControl('/assets/*'));
  });
});
