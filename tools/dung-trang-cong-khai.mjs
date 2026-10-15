#!/usr/bin/env node
/**
 * DỰNG TRANG CÔNG KHAI THEO NGÔN NGỮ (SEO) — chạy sau `vite build`, ghi vào apps/web/dist.
 *
 * Bản mẫu là trang tiếng Anh ở apps/web/public/{about,support,privacy,changes}.html
 * (vite đã chép sang dist). Mỗi ngôn ngữ khác ra một bản DỰNG SẴN ở dist/<mã>/<trang>.html
 * — chữ nằm thẳng trong HTML để Google đọc được (đổi chữ bằng JS lúc chạy thì Google chỉ
 * thấy MỘT bản). Mọi bản đều được gắn: <html lang>, <title>/mô tả đúng ngôn ngữ,
 * canonical, hreflang của đủ các ngôn ngữ + x-default, og:locale, và (trang about) dữ liệu
 * có cấu trúc schema.org. Ghi thêm sitemap.xml (kèm alternates) và robots.txt.
 *
 * Bản dịch: apps/web/site-i18n/<mã>.json (ngoài public — không phát lên mạng).
 * Danh sách ngôn ngữ đọc thẳng từ NGON_NGU ở apps/web/src/lib/i18n.ts — một nguồn.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WEB = new URL('../apps/web/', import.meta.url).pathname;
const DIST = join(WEB, 'dist');
const SITE = 'https://flipmatch.cozypi.com';
const TRANG = ['about', 'changes', 'support', 'privacy'];

// ── Ngôn ngữ (thứ tự + mã BCP-47) từ chính danh sách của app ──
const nguon = readFileSync(join(WEB, 'src/lib/i18n.ts'), 'utf8');
const khoi = nguon.slice(nguon.indexOf('export const NGON_NGU'), nguon.indexOf('] as const'));
const LANGS = [...khoi.matchAll(/id: '([^']+)', ten: '([^']+)', bcp: '([^']+)'/g)].map((m) => ({ id: m[1], ten: m[2], bcp: m[3] }));
if (LANGS.length < 12 || !LANGS.some((l) => l.id === 'en')) throw new Error('Không đọc được NGON_NGU từ i18n.ts');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const duong = (lang, trang) => (lang === 'en' ? `/${trang}.html` : `/${lang}/${trang}.html`);
const ogLocale = (bcp) => bcp.replace('-', '_');

function dich(lang) {
  if (lang === 'en') return null;
  const p = join(WEB, 'site-i18n', `${lang}.json`);
  if (!existsSync(p)) throw new Error(`Thiếu bản dịch trang công khai: site-i18n/${lang}.json`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Thay chữ theo data-t / data-th / data-t-alt trong HTML của CHÍNH ta (cấu trúc biết trước). */
function apDung(html, t) {
  let doi = 0;
  html = html.replace(/<(\w+)((?:\s[^>]*?)?\sdata-(t|th)="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, loai, k) => {
    if (!(k in t)) return m;
    doi++;
    return `<${tag}${attrs}>${loai === 't' ? esc(t[k]) : t[k]}</${tag}>`;
  });
  // Chốt: mọi chỗ có khoá dịch phải được thay — biểu thức trượt một kiểu thẻ là
  // trang ra nửa tiếng Anh mà không ai hay (đã xảy ra lúc viết: thẻ chỉ có data-t).
  const can = [...html.matchAll(/\sdata-(?:t|th)="([^"]+)"/g)].filter((m) => m[1] in t).length;
  if (doi !== can) throw new Error(`Chỉ thay được ${doi}/${can} chỗ có khoá dịch`);
  html = html.replace(/<img([^>]*?)\salt="[^"]*"([^>]*?)\sdata-t-alt="([^"]+)"([^>]*)>/g, (m, a, b, k, c) =>
    (k in t ? `<img${a} alt="${escAttr(t[k])}"${b} data-t-alt="${k}"${c}>` : m));
  return html;
}

function tieuDe(trang, t, lang) {
  const g = (k, en) => (t && t[k]) || en;
  const app = lang === 'vi' ? 'Lật Thẻ' : 'Flip Match';
  if (trang === 'about') return `${app} — ${g('about.eyebrow', 'The memory card game')}`;
  if (trang === 'support') return `${g('nav.support', 'Support')} · ${app}`;
  if (trang === 'privacy') return `${g('pv.h1', 'Privacy Policy')} · ${app}`;
  return `${g('ch.h1', "What's new")} · ${app}`;
}

function dauTrang(trang, lang, t, moTa) {
  const l = LANGS.find((x) => x.id === lang);
  const alt = LANGS.map((x) => `<link rel="alternate" hreflang="${x.bcp}" href="${SITE}${duong(x.id, trang)}">`).join('\n');
  let s = `<link rel="canonical" href="${SITE}${duong(lang, trang)}">\n${alt}\n<link rel="alternate" hreflang="x-default" href="${SITE}${duong('en', trang)}">
<meta property="og:locale" content="${ogLocale(l.bcp)}">
${LANGS.filter((x) => x.id !== lang).map((x) => `<meta property="og:locale:alternate" content="${ogLocale(x.bcp)}">`).join('\n')}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Flip Match">
<meta property="og:title" content="${escAttr(tieuDe(trang, t, lang))}">
<meta property="og:description" content="${escAttr(moTa)}">
<meta property="og:url" content="${SITE}${duong(lang, trang)}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta name="twitter:card" content="summary_large_image">`;
  if (trang === 'about') {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Flip Match',
      alternateName: 'Lật Thẻ',
      description: moTa,
      url: `${SITE}${duong(lang, 'about')}`,
      image: `${SITE}/og.jpg`,
      screenshot: ['03-home', '01-gameplay', '02-win', '05-themes'].map((f) => `${SITE}/site/img/${f}.webp`),
      applicationCategory: 'GameApplication',
      applicationSubCategory: 'Puzzle',
      operatingSystem: 'iOS, Android, Web',
      inLanguage: LANGS.map((x) => x.bcp),
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'Cozy Pi', url: 'https://cozypi.com', email: 'support@cozypi.com' }
    };
    s += `\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  }
  return s;
}

const sitemap = [];
for (const trang of TRANG) {
  const mau = readFileSync(join(DIST, `${trang}.html`), 'utf8');
  if (mau.includes('rel="canonical"')) throw new Error(`${trang}.html đã có canonical — chạy hai lần trên cùng dist?`);
  for (const { id: lang } of LANGS) {
    const t = dich(lang);
    let html = t ? apDung(mau, t) : mau;
    const moTa = (t && t[`${trang}.desc`]) || mau.match(/<meta name="description" content="([^"]*)"/)[1];
    html = html
      .replace('<html lang="en">', `<html lang="${LANGS.find((x) => x.id === lang).bcp}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(tieuDe(trang, t, lang))}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(moTa)}">`)
      .replace(/\n<meta property="og:[^>]*>/g, '')
      .replace('</head>', `${dauTrang(trang, lang, t, moTa)}\n</head>`);
    if (lang !== 'en') {
      html = html
        .replace(/(href|src)="(site\/|icon-192\.png)/g, '$1="../$2')
        .replace(/href="\/"/g, `href="/?lang=${lang}"`);
      mkdirSync(join(DIST, lang), { recursive: true });
      writeFileSync(join(DIST, lang, `${trang}.html`), html);
    } else {
      writeFileSync(join(DIST, `${trang}.html`), html);
    }
    // Chữ chưa dịch còn sót (khoá có trong trang mà thiếu trong json) → build đỏ, không lên mạng
    if (t) for (const m of mau.matchAll(/data-(?:t|th)="([^"]+)"/g)) if (!(m[1] in t) && m[1] !== 'brand') throw new Error(`${lang}: thiếu khoá "${m[1]}"`);
  }
  const alt = LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.bcp}" href="${SITE}${duong(x.id, trang)}"/>`).join('\n');
  for (const { id: lang } of LANGS) {
    sitemap.push(`  <url>\n    <loc>${SITE}${duong(lang, trang)}</loc>\n${alt}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${duong('en', trang)}"/>\n  </url>`);
  }
}
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${SITE}/</loc></url>
${sitemap.join('\n')}
</urlset>
`);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/
Disallow: /ws/
Disallow: /ota/

Sitemap: ${SITE}/sitemap.xml
`);
console.log(`✓ Trang công khai: ${TRANG.length} trang × ${LANGS.length} ngôn ngữ, sitemap ${sitemap.length + 1} địa chỉ`);
