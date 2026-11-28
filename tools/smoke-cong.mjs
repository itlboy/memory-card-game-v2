#!/usr/bin/env node
/**
 * THỬ KHÓI BẢN CỔNG GAME WEB — chạy sau `VITE_CONG=<tên> pnpm build:cong` (docs/ban-cong.md).
 * Phục vụ `apps/web/dist-cong` ở một THƯ MỤC CON, mở TRONG IFRAME ở các cỡ khung của CrazyGames (ngang, máy tính +
 * di động), rồi kiểm: game lên, không service worker, không yêu cầu 404 ra ngoài thư mục gói, không lỗi JS, không
 * link cài app / link store trong trang. `node tools/smoke-cong.mjs <thư mục>` thì chụp thêm ảnh từng cỡ vào đó.
 * Trình duyệt mở qua lib-playwright.mjs (tự dọn); server tắt trong `finally`.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moTrinhDuyet } from './lib-playwright.mjs';

const GOC = fileURLToPath(new URL('../apps/web/dist-cong', import.meta.url));
const RA = process.argv[2];
const KIEU = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const TIEN_TO = '/goi/123/';
/** Cỡ khung CrazyGames (docs.crazygames.com/requirements/technical): cửa sổ máy tính nhỏ nhất + to nhất, di động ngang. */
const CO = [['may-tinh-nho', 821, 462], ['may-tinh', 1216, 684], ['di-dong-ngang', 800, 450]];
const thieu = [];
const server = createServer((req, res) => {
  const duong = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (duong === '/khung') { res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><body style="margin:0;background:#222"><iframe id="g" src="${TIEN_TO}index.html" style="border:0;width:100vw;height:100vh;display:block"></iframe>`); return; }
  if (!duong.startsWith(TIEN_TO)) { thieu.push(duong); res.writeHead(404).end(); return; }
  let f = join(GOC, duong.slice(TIEN_TO.length) || 'index.html');
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { thieu.push(duong); res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': KIEU[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
let browser; let ma = 0;
const tat = async () => { await browser?.close().catch(() => {}); server.close(); };
process.on('SIGINT', () => tat().then(() => process.exit(130)));
process.on('SIGTERM', () => tat().then(() => process.exit(143)));
try {
  await new Promise((xong) => server.listen(0, '127.0.0.1', xong));
  const cong = server.address().port;
  browser = await moTrinhDuyet('webkit')   // máy này chỉ cài sẵn WebKit của Playwright (cùng smoke-fb);
  const loi = [];
  for (const [ten, w, h] of CO) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const loiJs = []; const ngoai = new Set();
    page.on('pageerror', (e) => loiJs.push(String(e)));
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.hostname === '127.0.0.1') return r.continue();
      ngoai.add(u.origin);
      // hình lá bài tải từ tên miền web (emoji 43 MB không vào gói) — cho qua để ảnh chụp đúng; còn lại (API, GA) chặn
      return u.hostname === 'flipmatch.cozypi.com' && u.pathname.startsWith('/emoji/') ? r.continue() : r.abort();
    });
    await page.goto(`http://127.0.0.1:${cong}/khung`);
    const khung = page.frames().find((f) => f.url().includes(TIEN_TO)) ?? (await page.waitForEvent('framenavigated', { predicate: (f) => f.url().includes(TIEN_TO), timeout: 10000 }));
    await khung.waitForFunction(() => document.querySelector('#app')?.children.length > 0, null, { timeout: 15000 }).catch(() => loi.push(`${ten}: #app trống — game không lên`));
    await page.waitForTimeout(1500);
    const kq = await khung.evaluate(async () => ({
      sw: (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0,
      store: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((x) => /apps\.apple\.com|play\.google\.com|flipmatch\.cozypi\.com/.test(x)),
      tran: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      co: [innerWidth, innerHeight]
    }));
    if (kq.sw) loi.push(`${ten}: có service worker đăng ký`);
    if (kq.store.length) loi.push(`${ten}: còn link ra ngoài: ${kq.store.join(', ')}`);
    if (kq.tran) loi.push(`${ten}: trang tràn khung ${kq.co.join('×')} (phải cuộn)`);
    if (loiJs.length) loi.push(`${ten}: lỗi JS: ${loiJs.join(' | ')}`);
    if (RA) await page.screenshot({ path: join(RA, `cong-${ten}.png`) });
    console.log(`${ten} ${w}×${h}: tên miền ngoài game gọi tới: ${[...ngoai].join(', ') || '(không)'}`);
    await page.close();
  }
  if (thieu.length) loi.push('yêu cầu 404 / ra ngoài thư mục gói: ' + [...new Set(thieu)].join(', '));
  if (loi.length) { console.error('HỎNG:\n - ' + loi.join('\n - ')); ma = 1; } else console.log('ĐẠT: game lên trong iframe ở thư mục con, không service worker, không 404, không link ra ngoài, không tràn khung.');
} catch (e) { console.error('HỎNG:', e); ma = 1; } finally { await tat(); }
process.exit(ma);
