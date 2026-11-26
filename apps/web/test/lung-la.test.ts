import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MẶT LƯNG LÁ THEO HÌNH NỀN (26.11.2026, mockup duyệt https://claude.ai/artifact/DMXKhwABieKhBdT9vV4Gij) — chủ dự án:
 * "khi người dùng chọn hình nền nào thì sẽ dùng mặt lưng đó, ngẫu nhiên nếu có nhiều", "cho cả trong ván".
 */
const nap = async (canh: string | null) => {
  localStorage.clear();
  localStorage.setItem('mm.premium', '1');
  if (canh) localStorage.setItem('mm.canh', canh);
  delete document.documentElement.dataset.lung;
  vi.resetModules();
  return { ll: await import('@/lib/lung-la'), c: await import('@/lib/canh') };
};
const doc = (f: string): string => readFileSync(resolve(process.cwd(), 'src', f), 'utf8');

beforeEach(() => { vi.restoreAllMocks(); });

describe('mặt lưng lá theo hình nền', () => {
  it('Thiên hà: Mặt Trời + 8 hành tinh; Hoa anh đào: 5 hình; cảnh gốc không có bộ riêng', async () => {
    const { ll } = await nap(null);
    expect(ll.LUNG['thien-ha']).toHaveLength(9);
    expect(ll.LUNG['anh-dao']).toHaveLength(5);
    expect(ll.bocLungVan(false)).toBeNull();
    expect(document.documentElement.dataset.lung, 'cảnh gốc giữ lưng ngôi sao').toBeUndefined();
  });

  it('mỗi ván bốc MỘT mặt lưng thuộc đúng bộ của hình nền, gắn lên <html> cho cả bàn', async () => {
    const { ll } = await nap('thien-ha');
    for (let i = 0; i < 30; i++) {
      const m = ll.bocLungVan(false)!;
      expect(ll.LUNG['thien-ha']).toContain(m);
      expect(document.documentElement.dataset.lung).toBe(m);
    }
  });

  it('hai ván liền nhau không trùng mặt lưng', async () => {
    const { ll } = await nap('anh-dao');
    let truoc = ll.bocLungVan(false);
    for (let i = 0; i < 40; i++) { const m = ll.bocLungVan(false); expect(m).not.toBe(truoc); truoc = m; }
  });

  it('đổi hình nền thì mặt lưng đổi theo ngay; về cảnh gốc thì gỡ', async () => {
    const { ll, c } = await nap('thien-ha');
    ll.ganLung();
    expect(document.documentElement.dataset.lung).toMatch(/^ht-/);
    c.datCanh('anh-dao');
    await Promise.resolve();
    expect(document.documentElement.dataset.lung).toMatch(/^ad-/);
    c.datCanh('goc');
    await Promise.resolve();
    expect(document.documentElement.dataset.lung).toBeUndefined();
  });

  it('bocNhieu trả các hình KHÁC NHAU (hai lá quay ở trang chủ không trùng)', async () => {
    const { ll } = await nap('thien-ha');
    for (let i = 0; i < 30; i++) { const [a, b] = ll.bocNhieu('thien-ha', 2); expect(a).not.toBe(b); }
    expect(ll.bocNhieu('goc', 2)).toEqual([]);
  });

  it('mọi mã trong LUNG đều có hình + cỡ ở keo-lung.css, và không mã thừa', async () => {
    const { ll } = await nap(null);
    const css = doc('styles/skins/keo-lung.css');
    const ma = [...ll.LUNG['thien-ha'], ...ll.LUNG['anh-dao']];
    for (const m of ma) {
      expect(css, m).toContain(`--lg-${m}: `);
      expect(css, m).toContain(`[data-lung='${m}'] { --lung-hinh: var(--lg-${m}); --lung-co: `);
    }
    expect(css.match(/^\[data-lung='/gm)).toHaveLength(ma.length);
  });

  it('luật hình: mọi thiên thể cùng cỡ khung (39,5%), không quầng sáng, Sao Thổ không vành', () => {
    const css = doc('styles/skins/keo-lung.css');   // data URL còn mã hoá %xx: # là %23
    for (const m of css.matchAll(/^\[data-lung='ht-[a-z]+'\] \{[^}]*--lung-co: ([^;]+);/gm)) expect(m[1]).toBe('39.5%');
    expect(css, 'quầng sáng #q của hình hành tinh gốc phải bị gỡ').not.toMatch(/fill='url\((%23|#)q\)'/);
    const tho = css.slice(css.indexOf('--lg-ht-tho:'), css.indexOf('--lg-ht-thien:'));
    expect(tho, 'vành Sao Thổ').not.toContain('rotate(-16');
  });

  it('lá trong ván, hai lá quay Thiên hà và lá rơi Hoa anh đào đều đọc --lung-hinh', () => {
    expect(doc('styles/skins/keo-lung.css')).toMatch(/\[data-canh\]\[data-lung\] \.card \.face\.back \{\s*background: var\(--lung-hinh\)/);
    expect(doc('styles/skins/keo-canh.css')).toMatch(/\.la-quat:not\(\.giua\) \.lac \{ background: var\(--lung-hinh/);
    expect(doc('components/LaRoi.vue')).toMatch(/\.lat \.lung \{[\s\S]{0,160}background: var\(--lung-hinh/);
    expect(doc('components/QuatLa.vue')).toContain(':data-lung="lungHaiLa[0]"');
  });
});
