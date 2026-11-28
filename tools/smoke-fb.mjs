#!/usr/bin/env node
/**
 * THỬ KHÓI BẢN FACEBOOK — chạy sau `pnpm --filter @mm/web build:fb`.
 * Phục vụ `apps/web/dist-fb` ở một THƯ MỤC CON (như Meta host gói zip), thay SDK thật bằng SDK giả
 * ghi lại thứ tự gọi, rồi kiểm: game lên, gọi initializeAsync → setLoadingProgress → startGameAsync,
 * không đăng ký service worker, không yêu cầu nào tới gốc tên miền bị 404 (đường dẫn tuyệt đối sót).
 * Trình duyệt mở qua lib-playwright.mjs (tự dọn); server tắt trong `finally`.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moTrinhDuyet } from './lib-playwright.mjs';

const GOC = fileURLToPath(new URL('../apps/web/dist-fb', import.meta.url));
const KIEU = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const TIEN_TO = '/goi/123/';
const thieu = [];
const server = createServer((req, res) => {
  const duong = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!duong.startsWith(TIEN_TO)) { thieu.push(duong); res.writeHead(404).end(); return; }
  let f = join(GOC, duong.slice(TIEN_TO.length) || 'index.html');
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { thieu.push(duong); res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': KIEU[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
const SDK_GIA = `window.__fb=[];window.FBInstant={
  initializeAsync(){__fb.push('initializeAsync');return Promise.resolve()},
  setLoadingProgress(p){__fb.push('setLoadingProgress:'+p)},
  startGameAsync(){__fb.push('startGameAsync');return Promise.resolve()},
  getLocale(){return 'vi_VN'}};`;
let browser; let ma = 0;
const tat = async () => { await browser?.close().catch(() => {}); server.close(); };
process.on('SIGINT', () => tat().then(() => process.exit(130)));
process.on('SIGTERM', () => tat().then(() => process.exit(143)));
try {
  await new Promise((xong) => server.listen(0, '127.0.0.1', xong));
  const cong = server.address().port;
  browser = await moTrinhDuyet('webkit');   // một cửa mở trình duyệt của repo: tự dọn kể cả khi kill -9
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const loiJs = []; const ngoai = new Set();
  page.on('pageerror', (e) => loiJs.push(String(e)));
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'connect.facebook.net') return r.fulfill({ contentType: 'text/javascript', body: SDK_GIA });
    if (u.hostname !== '127.0.0.1') { ngoai.add(u.origin); return r.abort(); }
    return r.continue();
  });
  await page.goto(`http://127.0.0.1:${cong}${TIEN_TO}index.html`);
  await page.waitForFunction(() => window.__fb?.includes('startGameAsync'), null, { timeout: 15000 });
  const goi = await page.evaluate(() => window.__fb);
  const coNoiDung = await page.evaluate(() => document.querySelector('#app')?.children.length > 0);
  const sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0);
  const anhHong = await page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth && !/^https?:\/\/(?!127)/.test(i.src)).map((i) => i.src));
  const loi = [];
  if (goi[0] !== 'initializeAsync') loi.push('initializeAsync không phải lời gọi đầu: ' + goi.join(', '));
  if (goi.indexOf('startGameAsync') < goi.findIndex((g) => g.startsWith('setLoadingProgress'))) loi.push('startGameAsync trước setLoadingProgress');
  if (!coNoiDung) loi.push('#app trống — game không lên');
  if (sw) loi.push('có service worker đăng ký');
  if (thieu.length) loi.push('yêu cầu 404 / ra ngoài thư mục gói: ' + [...new Set(thieu)].join(', '));
  if (loiJs.length) loi.push('lỗi JS: ' + loiJs.join(' | '));
  if (anhHong.length) loi.push('ảnh hỏng: ' + anhHong.join(', '));
  console.log('SDK:', goi.join(' → '));
  console.log('Tên miền ngoài game gọi tới (phải khai trong CSP của Meta):', [...ngoai].join(', ') || '(không)');
  if (loi.length) { console.error('HỎNG:\n - ' + loi.join('\n - ')); ma = 1; } else console.log('ĐẠT: game lên trong thư mục con, đúng trình tự SDK, không service worker, không 404.');
} catch (e) { console.error('HỎNG:', e); ma = 1; } finally { await tat(); }
process.exit(ma);
