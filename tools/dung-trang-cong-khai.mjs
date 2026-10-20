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
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
// Địa chỉ CHUẨN không đuôi .html: Cloudflare (html_handling) chuyển hướng 307 `/about.html` → `/about`,
// canonical/hreflang/sitemap trỏ vào địa chỉ bị chuyển hướng là Google chấm lỗi + mất ~0,85s (18.10.2026).
// File vẫn ghi `<trang>.html`; link `.html` cũ (store, bài đã chia sẻ) vẫn vào được.
const duong = (lang, trang) => (lang === 'en' ? `/${trang}` : `/${lang}/${trang}`);
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
      screenshot: ['03-home', '01-gameplay', '02-win', '05-themes'].map((f) => `${SITE}/site/img/${f}-k3d-464.webp`),
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

/*
 * Mã phiên bản theo NỘI DUNG cho site.css / site.js (`?v=<8 ký tự>`): Cloudflare của tên
 * miền ép trình duyệt giữ file tĩnh 4 TIẾNG (Browser Cache TTL), đè mức 5 phút server
 * đặt — sửa CSS xong người xem vẫn thấy bản cũ (chủ dự án báo 15.10.2026). File đổi
 * thì đường dẫn đổi, trình duyệt buộc tải lại.
 */
const phienBan = (f) => createHash('sha256').update(readFileSync(join(DIST, 'site', f))).digest('hex').slice(0, 8);
const V = { css: phienBan('site.css'), js: phienBan('site.js') };
const ganPhienBan = (h) => h.replace(/(site\/site\.css)"/g, `$1?v=${V.css}"`).replace(/(site\/site\.js)"/g, `$1?v=${V.js}"`);

const sitemap = [];
for (const trang of TRANG) {
  const mau = readFileSync(join(DIST, `${trang}.html`), 'utf8');
  if (mau.includes('rel="canonical"')) throw new Error(`${trang}.html đã có canonical — chạy hai lần trên cùng dist?`);
  for (const { id: lang } of LANGS) {
    const t = dich(lang);
    let html = ganPhienBan(t ? apDung(mau, t) : mau);
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
        // srcset có NHIỀU đường dẫn trong một thuộc tính — thiếu dòng này là trang
        // /<mã>/ tìm ảnh ở /<mã>/site/img/… và ra ảnh vỡ (chủ dự án báo 15.10.2026)
        .replace(/srcset="([^"]*)"/g, (_, v) => `srcset="${v.replace(/(^|,\s*)site\//g, '$1../site/')}"`)
        .replace(/href="\/"/g, `href="${lang === 'vi' ? '/' : `/${lang}/`}"`);
      // Chốt: trang ở thư mục con mà còn đường dẫn `site/` tương đối là ảnh/CSS vỡ
      if (/(?:src|href)="site\/|srcset="(?:[^"]*,\s*)?site\//.test(html)) throw new Error(`${lang}/${trang}.html còn đường dẫn site/ chưa thêm ../`);
      mkdirSync(join(DIST, lang), { recursive: true });
      writeFileSync(join(DIST, lang, `${trang}.html`), html);
    } else {
      // Nút "Chơi" của bản English về trang chơi tiếng Anh (`/` là tiếng Việt)
      writeFileSync(join(DIST, `${trang}.html`), html.replace(/href="\/"/g, 'href="/en/"'));
    }
    // Chữ chưa dịch còn sót (khoá có trong trang mà thiếu trong json) → build đỏ, không lên mạng
    if (t) for (const m of mau.matchAll(/data-(?:t|th)="([^"]+)"/g)) if (!(m[1] in t) && m[1] !== 'brand') throw new Error(`${lang}: thiếu khoá "${m[1]}"`);
  }
  const alt = LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.bcp}" href="${SITE}${duong(x.id, trang)}"/>`).join('\n');
  for (const { id: lang } of LANGS) {
    sitemap.push(`  <url>\n    <loc>${SITE}${duong(lang, trang)}</loc>\n${alt}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${duong('en', trang)}"/>\n  </url>`);
  }
}
/*
 * TRANG CHƠI THEO NGÔN NGỮ (SEO, 18.10.2026): `/` = tiếng Việt (mặc định của game), `/<mã>/` = ngôn
 * ngữ khác — CÙNG index.html của Vite (cùng app, cùng /assets), chỉ khác phần <head>: lang, tiêu đề,
 * mô tả, og, canonical, hreflang, dữ liệu có cấu trúc. App đọc ngôn ngữ từ đường dẫn (lib/i18n.ts
 * `duongChoi`). Chữ ở khoá `game.title` / `game.desc` của site-i18n (English: GAME_EN dưới đây).
 * Tiêu đề/mô tả là chỗ nhét TỪ KHOÁ người ta thật sự gõ — xem docs/seo.md.
 */
const GAME_EN = {
  'game.title': 'Flip Match – Free Memory Game Online with Friends',
  'game.desc': 'Play the classic memory card game free in your browser or app: flip cards, match pairs, play solo, vs computer or online with friends. No ads, kid-safe.'
};
const duongChoi = (lang) => (lang === 'vi' ? '/' : `/${lang}/`);
const mauChoi = readFileSync(join(DIST, 'index.html'), 'utf8');
if (mauChoi.includes('rel="canonical"')) throw new Error('index.html đã có canonical — chạy hai lần trên cùng dist?');
const altChoi = LANGS.map((x) => `<link rel="alternate" hreflang="${x.bcp}" href="${SITE}${duongChoi(x.id)}">`).join('\n');
for (const { id: lang, bcp } of LANGS) {
  const t = lang === 'en' ? GAME_EN : dich(lang);
  for (const k of ['game.title', 'game.desc']) if (!t[k]) throw new Error(`${lang}: thiếu khoá "${k}" (trang chơi)`);
  const tieu = t['game.title'], moTa = t['game.desc'], url = `${SITE}${duongChoi(lang)}`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'VideoGame',
    name: lang === 'vi' ? 'Lật Thẻ' : 'Flip Match', alternateName: lang === 'vi' ? 'Flip Match' : 'Lật Thẻ',
    description: moTa, url, image: `${SITE}/og.jpg`, inLanguage: bcp,
    genre: ['Puzzle', 'Memory', 'Card game'], playMode: ['SinglePlayer', 'MultiPlayer'],
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4 },
    gamePlatform: ['Web browser', 'iOS', 'Android'], applicationCategory: 'GameApplication',
    operatingSystem: 'Any (web browser), iOS, Android', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, contentRating: 'Everyone',
    publisher: { '@type': 'Organization', name: 'Cozy Pi', url: 'https://cozypi.com' }
  }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Flip Match', alternateName: 'Lật Thẻ', url: `${SITE}/`, inLanguage: bcp }];
  const og = `<meta property="og:locale" content="${ogLocale(bcp)}">`;
  // Từ điển ngôn ngữ là chunk riêng (lib/i18n.ts napTuDien) — báo trước để tải SONG SONG với gói chính,
  // không nối đuôi sau khi JS chạy (Lighthouse: chặng chờ nối tiếp). Tiếng Việt nằm sẵn trong gói chính.
  const chunk = lang === 'vi' ? null : readdirSync(join(DIST, 'assets')).find((f) => new RegExp(`^${lang}-[\\w-]{8}\\.js$`).test(f));
  if (lang !== 'vi' && !chunk) throw new Error(`${lang}: không thấy chunk từ điển trong dist/assets`);
  const napTruoc = chunk ? `<link rel="modulepreload" crossorigin href="/assets/${chunk}">\n` : '';
  let html = mauChoi
    .replace(/<html lang="[^"]*">/, `<html lang="${bcp}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(tieu)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(moTa)}">`)
    .replace(/<meta property="og:locale" content="[^"]*">/, og)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escAttr(tieu)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escAttr(moTa)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escAttr(tieu)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escAttr(moTa)}">`)
    .replace('</head>', `${napTruoc}<link rel="canonical" href="${url}">\n${altChoi}\n<link rel="alternate" hreflang="x-default" href="${SITE}/en/">\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
  // Chốt: mọi thẻ phải được thay — Vite đổi định dạng một thẻ là trang ra nửa tiếng Việt mà không ai hay
  for (const c of [tieu, url]) if (!html.includes(escAttr(c))) throw new Error(`${lang}: trang chơi không thay được "${c}"`);
  if (lang === 'vi') writeFileSync(join(DIST, 'index.html'), html);
  else { mkdirSync(join(DIST, lang), { recursive: true }); writeFileSync(join(DIST, lang, 'index.html'), html); }
}
const altChoiSm = LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.bcp}" href="${SITE}${duongChoi(x.id)}"/>`).join('\n');
const sitemapChoi = LANGS.map((x) => `  <url>\n    <loc>${SITE}${duongChoi(x.id)}</loc>\n${altChoiSm}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en/"/>\n  </url>`);

writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapChoi.join('\n')}
${sitemap.join('\n')}
</urlset>
`);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/
Disallow: /ws/
Disallow: /ota/

# Bot AI (ChatGPT/Claude/Perplexity/Gemini) ĐƯỢC đọc — AI search trích dẫn trang (SEO 20.10.2026). Tóm tắt: /llms.txt
Sitemap: ${SITE}/sitemap.xml
`);
console.log(`✓ Trang công khai: ${TRANG.length} trang × ${LANGS.length} ngôn ngữ + ${LANGS.length} trang chơi, sitemap ${sitemap.length + sitemapChoi.length} địa chỉ`);
