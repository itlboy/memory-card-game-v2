/**
 * HIỆU ỨNG KẾT VÁN PHẢI NẰM GỌN TRONG CỘT GAME — đo bằng Chrome thật (CDP).
 *
 *   node tools/do-fx-khung.mjs [url]   (mặc định http://127.0.0.1:8080)
 *
 * Lỗi đã xảy ra (12.10.2026, có ảnh): trên máy tính cột game rộng ~600px giữa
 * cửa sổ, nhưng lớp hiệu ứng `position: fixed; inset: 0` nên băng "KỶ LỤC MỚI!",
 * tia vàng vương miện, pháo giấy trải ra CẢ CỬA SỔ. Harness bật chế độ debug,
 * chạy từng cảnh "Xem thử" ở cửa sổ 1280×900 và kiểm:
 *  1. khung `.ketcuc-fx` / `.mk-fx` trùng khung #app;
 *  2. canvas hạt đúng bề rộng cột (không phải innerWidth);
 *  3. điểm bên NGOÀI cột (trái/phải) không trúng phần tử nào của hiệu ứng.
 * Chụp ảnh từng cảnh vào thư mục tạm để nhìn lại.
 */
import { moChrome } from './lib-chrome.mjs';
import { createRequire } from 'node:module';
import { rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const URL_APP = process.argv[2] ?? 'http://127.0.0.1:8080/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const PROFILE = `/tmp/mm-cdp-fx-${process.pid}`;
const ANH = mkdtempSync(join(tmpdir(), 'mm-fx-'));
const chrome = moChrome(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--disable-gpu', '--no-first-run',
  '--no-sandbox', `--user-data-dir=${PROFILE}`, 'about:blank'], PROFILE);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => {
  const d = await goi('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (d.result?.exceptionDetails) throw new Error('JS trong trang: ' + (d.result.exceptionDetails.exception?.description ?? d.result.exceptionDetails.text));
  return d.result?.result?.value;
};
let loi = 0;
const ok = (dk, msg) => { console.log(`${dk ? '✓' : '✗'} ${msg}`); if (!dk) loi++; };

await goi('Network.enable');
await goi('Network.setBypassServiceWorker', { bypass: true });
await goi('Network.setCacheDisabled', { cacheDisabled: true });
await goi('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await goi('Page.navigate', { url: URL_APP + (URL_APP.includes('?') ? '&' : '?') + 'lang=vi&cb=' + Date.now() });
for (let i = 0; i < 40 && !(await js(`!!document.querySelector('header .menu-btn')`)); i++) await cho(250);
await js('localStorage.clear(); sessionStorage.clear(); true');
await goi('Page.reload');
for (let i = 0; i < 40 && !(await js(`!!document.querySelector('header .menu-btn')`)); i++) await cho(250);
await cho(600);

const bam = (sel, chu) => js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
  .find((e) => ${chu ? `e.textContent.includes(${JSON.stringify(chu)})` : 'true'}); el?.click(); return !!el; })()`);
// Mở luật chơi → bật debug → lấy danh sách nút "Xem thử"
await bam('header .menu-btn'); await cho(300);
await bam('header .menu .item:nth-child(n)', 'Luật'); await cho(400);
await bam('button', 'Bật chế độ debug'); await cho(300);
const ten = await js(`[...document.querySelectorAll('.xem-fx .nut-do')].map((b) => b.textContent.trim())`);
ok(ten?.length >= 6, `có ${ten?.length} cảnh xem thử`);

for (const t of ten ?? []) {
  if (!(await js(`!!document.querySelector('.xem-fx')`))) {
    await bam('header .menu-btn'); await cho(300); await bam('header .menu .item', 'Luật'); await cho(400);
  }
  await bam('.xem-fx .nut-do', t);
  await cho(1600);
  const kq = await js(`(() => {
    // So với vùng TRONG VIỀN của cột (#app có viền 1px trên máy tính)
    const g = document.getElementById('app'), b0 = g.getBoundingClientRect();
    const a = { left: b0.left + g.clientLeft, top: b0.top + g.clientTop, width: g.clientWidth, height: g.clientHeight,
      right: b0.left + g.clientLeft + g.clientWidth };
    const fx = document.querySelector('.ketcuc-fx'), mk = document.querySelector('.mk-fx');
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; };
    const ngoai = [[a.left / 2, innerHeight * 0.3], [a.left / 2, innerHeight * 0.6], [(a.right + innerWidth) / 2, innerHeight * 0.3], [(a.right + innerWidth) / 2, innerHeight * 0.6]]
      .map(([x, y]) => document.elementFromPoint(x, y)).filter((e) => e && e.closest('.ketcuc-fx, .mk-fx')).length;
    const cv = fx?.querySelector('canvas');
    return { app: { l: a.left, t: a.top, w: a.width, h: a.height }, fx: fx && r(fx), mk: mk && r(mk), cvW: cv?.width / Math.min(2, devicePixelRatio), ngoai };
  })()`);
  const trung = (b) => b && Math.abs(b.l - kq.app.l) < 1 && Math.abs(b.w - kq.app.w) < 1 && Math.abs(b.t - kq.app.t) < 1 && Math.abs(b.h - kq.app.h) < 1;
  ok(trung(kq.fx), `${t}: lớp hiệu ứng trùng cột game (${kq.fx?.w.toFixed(0)}×${kq.fx?.h.toFixed(0)} so với cột ${kq.app.w.toFixed(0)}×${kq.app.h.toFixed(0)})`);
  ok(Math.abs(kq.cvW - kq.app.w) < 2, `${t}: canvas hạt rộng ${kq.cvW} = cột`);
  ok(kq.ngoai === 0, `${t}: ngoài cột không có gì của hiệu ứng (${kq.ngoai} điểm trúng)`);
  ok(trung(kq.mk), `${t}: lớp khoe danh hiệu trùng cột game`);
  const shot = await goi('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ANH, `${t.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`), Buffer.from(shot.result.data, 'base64'));
  await cho(3200);
}
console.log(`ảnh: ${ANH}`);
console.log(loi ? `✗ ${loi} lỗi` : '✓ mọi cảnh nằm gọn trong cột');
ws.close(); chrome.kill();
process.exit(loi ? 1 : 0);
