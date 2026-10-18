// SEO (docs/seo.md): trang chơi theo ngôn ngữ + chữ store. Canh thứ build không bắt được.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NGON_NGU, duongChoi } from '@/lib/i18n';

const doc = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('trang chơi theo ngôn ngữ', () => {
  it('tiếng Việt ở gốc, ngôn ngữ khác ở /<mã>/', () => {
    expect(duongChoi('vi')).toBe('/');
    expect(duongChoi('en')).toBe('/en/');
    expect(duongChoi('zh-TW')).toBe('/zh-TW/');
  });
  it('mọi ngôn ngữ (trừ English, nằm trong công cụ) có game.title ≤ 62 + game.desc ≤ 160', () => {
    for (const { id } of NGON_NGU) {
      if (id === 'en') continue;
      const t = JSON.parse(doc(`site-i18n/${id}.json`));
      expect(t['game.title']?.length, id).toBeGreaterThan(10);
      expect(t['game.title'].length, id).toBeLessThanOrEqual(62);
      expect(t['game.desc'].length, id).toBeLessThanOrEqual(160);
    }
    expect(doc('../../tools/dung-trang-cong-khai.mjs')).toMatch(/'game\.title': '[^']{20,}'/);
  });
});

describe('nhãn hiệu "Memory" (Ravensburger) — không dùng ở DE/FR/IT', () => {
  it('trang chơi', () => {
    for (const id of ['de', 'fr', 'it']) {
      const t = JSON.parse(doc(`site-i18n/${id}.json`));
      expect(`${t['game.title']} ${t['game.desc']}`, id).not.toMatch(/memory/i);
    }
  });
  it('store: Name / Subtitle / Keywords / Play title / Short description', () => {
    const md = doc('../../docs/store-listing.md');
    for (const muc of ['Deutsch', 'Français', 'Italiano']) {
      const i = md.indexOf(`## ${muc}\n`), j = md.indexOf('\n## ', i + 3);
      const phan = md.slice(i, j);
      for (const m of phan.matchAll(/\*\*(Name|Subtitle|Keywords|Play title|Short description)\*\* \(\d+\)[^\n]*\n```\n(.*?)\n```/gs)) {
        expect(m[2], `${muc} / ${m[1]}`).not.toMatch(/memory/i);
      }
    }
  });
});
