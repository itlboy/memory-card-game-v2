import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NGON_NGU } from '@/lib/i18n';

/**
 * TRANG CÔNG KHAI (about/support/privacy/changes) — 12 ngôn ngữ như app (chủ dự
 * án 15.10.2026). Tiếng Anh viết sẵn trong HTML, ngôn ngữ khác ở
 * apps/web/site-i18n/<mã>.json (tools/dung-trang-cong-khai.mjs dựng sẵn từng bản lúc build). Canh:
 *  1. thêm chữ mới (data-t) mà quên dịch → trang lẫn tiếng Anh;
 *  2. bản dịch làm hỏng thẻ HTML / link / email trong chữ có định dạng (data-th).
 */
const PUB = resolve(process.cwd(), 'public');
const TRANG = ['about', 'support', 'privacy', 'changes'];
const html = TRANG.map((p) => readFileSync(resolve(PUB, `${p}.html`), 'utf8'));

/** Khoá → chữ tiếng Anh gốc (data-th giữ nguyên HTML để so thẻ). */
const goc = new Map<string, string>();
for (const s of html) {
  for (const m of s.matchAll(/<(\w+)[^>]*?\sdata-(t|th)="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (!goc.has(m[3]!)) goc.set(m[3]!, m[4]!.trim());
  }
}
for (const p of TRANG) goc.set(`${p}.desc`, '');
// Tên app: chỉ tiếng Việt đổi ("Lật Thẻ"), mọi ngôn ngữ khác giữ "Flip Match" như app.
goc.delete('brand');
const THE = (s: string): string[] => [...s.matchAll(/<\/?[a-z][^>]*>|<!--[^>]*-->/gi)].map((m) => m[0]);

const I18N = resolve(process.cwd(), 'site-i18n');
const files = readdirSync(I18N).filter((f) => f.endsWith('.json'));

describe('trang công khai: đủ bản dịch', () => {
  it('đủ mọi ngôn ngữ của app ngoài tiếng Anh (khớp NGON_NGU)', () => {
    const app = NGON_NGU.map((l) => l.id).filter((l) => l !== 'en').sort();
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(app);
  });

  for (const f of files) {
    const t = JSON.parse(readFileSync(resolve(I18N, f), 'utf8')) as Record<string, string>;
    it(`${f}: có mọi khoá của trang, không rỗng`, () => {
      const thieu = [...goc.keys()].filter((k) => !t[k]?.trim());
      expect(thieu, 'khoá chưa dịch').toEqual([]);
    });
    it(`${f}: chữ có định dạng giữ nguyên thẻ HTML, link và email`, () => {
      for (const [k, en] of goc) {
        if (!/<|<!--/.test(en)) continue;
        expect(THE(t[k] ?? ''), `khoá ${k}`).toEqual(THE(en));
      }
    });
  }
});
