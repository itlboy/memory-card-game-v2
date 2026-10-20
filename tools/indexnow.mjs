#!/usr/bin/env node
/**
 * INDEXNOW — báo Bing (và mọi máy tìm kiếm dùng IndexNow: Yandex, Naver, Seznam…) danh sách trang
 * ngay sau mỗi lần `pnpm release`, thay vì chờ chúng tự bò lại (SEO 20.10.2026). Bing cũng là nguồn
 * của ChatGPT search, DuckDuckGo, Yahoo. Cloudflare Crawler Hints (tự gửi IndexNow) không bật được
 * qua API ở gói miễn phí nên tự gửi ở đây.
 *
 *   node tools/indexnow.mjs            → gửi mọi địa chỉ trong apps/web/dist/sitemap.xml
 *
 * Khoá = tên file `<khoá>.txt` ở apps/web/public/ (nội dung đúng bằng khoá) — IndexNow tải file đó để
 * xác minh tên miền. Lỗi mạng KHÔNG làm release đỏ (chỉ in cảnh báo): deploy đã xong rồi.
 */
import { readFileSync, readdirSync } from 'node:fs';
const PUB = new URL('../apps/web/public/', import.meta.url).pathname;
const KHOA = readdirSync(PUB).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, 32);
const HOST = 'flipmatch.cozypi.com';
if (!KHOA) { console.log('⚠ IndexNow: không thấy file khoá trong apps/web/public'); process.exit(0); }
const sm = readFileSync(new URL('../apps/web/dist/sitemap.xml', import.meta.url), 'utf8');
const urlList = [...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))];
try {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KHOA, keyLocation: `https://${HOST}/${KHOA}.txt`, urlList })
  });
  // 200 = nhận · 202 = nhận, đang xác minh khoá · 4xx = sai khoá/host
  console.log(`${r.ok ? '✓' : '⚠'} IndexNow: ${urlList.length} địa chỉ → HTTP ${r.status}`);
} catch (e) { console.log(`⚠ IndexNow: ${e.message}`); }
