/**
 * CHỤP ẢNH STORE bằng Chrome thật (CDP) — khung iPhone 6.9" mà App Store bắt
 * buộc: 440×956 điểm × 3 = 1320×2868 px. Google Play nhận luôn bộ này.
 *
 *   node tools/chup-store.mjs <url server> <thư mục ra> [lang=en] [buoc...]
 *
 * Server phải chạy bản build mới (vd. `pnpm node:dev` → :8080) vì ảnh phòng
 * online cần API thật. Profile sạch + bỏ service worker, cùng lý do do-menu-tren.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const [URL_APP = 'http://127.0.0.1:8080', OUT = 'store-shots', LANG = 'en', ...BUOC] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// KHUNG=android: 360×640 × 3 = 1080×1920 (9:16). Google Play từ chối ảnh dài hơn
// 2:1, mà khung iPhone 6.9" là 2,17:1 — nên Android cần bộ riêng.
const KHUNG = process.env.KHUNG === 'android' ? { W: 360, H: 640 } : { W: 440, H: 956 };
const { W, H } = KHUNG, PORT = 9334;
mkdirSync(OUT, { recursive: true });
const PROFILE = `/tmp/mm-shot-${process.pid}`;
rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--hide-scrollbars',
  '--no-sandbox', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { chrome.kill(); try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ } });
export const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => {
  const d = await goi('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (d.result?.exceptionDetails) throw new Error('JS: ' + (d.result.exceptionDetails.exception?.description ?? d.result.exceptionDetails.text));
  return d.result?.result?.value;
};
const chup = async (ten) => {
  const d = await goi('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${OUT}/${ten}.png`, Buffer.from(d.result.data, 'base64'));
  console.log(`✓ ${OUT}/${ten}.png`);
};
/** Bấm phần tử có chữ chứa `chu` (nút, ô chọn), KHÔNG phân biệt hoa thường — nhãn
 *  English từng đổi "Quick play" → "Quick Play" và kịch bản gãy. */
const bam = (chu, sel = 'button, [role=button], .option, a') => js(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.offsetParent && e.textContent.toLowerCase().includes(${JSON.stringify(chu.toLowerCase())}));
  if (!el) throw new Error('không thấy: ' + ${JSON.stringify(chu)});
  el.click(); return true;
})()`);
/** Bấm phần tử có chữ ĐÚNG BẰNG `chu` (bỏ khoảng trắng) — "4cards" không được trúng "24cards". */
const bamDung = (chu, sel = 'button, [role=button], .option') => js(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.offsetParent && e.textContent.replace(/\\s+/g, '').toLowerCase() === ${JSON.stringify(chu.toLowerCase())});
  if (!el) throw new Error('không thấy (đúng): ' + ${JSON.stringify(chu)});
  el.click(); return true;
})()`);
const chuTrenMan = () => js(`[...document.querySelectorAll('button, .option')].filter((e) => e.offsetParent).map((e) => e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 50))`);

await goi('Network.enable');
await goi('Network.setBypassServiceWorker', { bypass: true });
await goi('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true });
await goi('Emulation.setTouchEmulationEnabled', { enabled: true });
await goi('Page.navigate', { url: `${URL_APP}/?lang=${LANG}` });
await cho(1500);
await js(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mm.lang', ${JSON.stringify(LANG)}); true`);
await goi('Page.reload', { ignoreCache: true });
await cho(2000);

export const ctx = { goi, js, chup, bam, bamDung, cho, chuTrenMan };
if (BUOC[0] === 'do') { console.log(JSON.stringify(await chuTrenMan(), null, 1)); await chup('do'); process.exit(0); }
// KICHBAN=<đường dẫn> để chạy kịch bản khác (vd. chụp hiệu ứng theo mốc thời gian)
const kichBan = await import(process.env.KICHBAN ? new URL(`file://${process.env.KICHBAN}`) : new URL('./chup-store-kichban.mjs', import.meta.url));
await kichBan.chay(ctx);
process.exit(0);
