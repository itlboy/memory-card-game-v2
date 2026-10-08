/**
 * ĐO MENU THANH TRÊN BẰNG CHROME THẬT (CDP), không đoán bằng mắt.
 *
 *   node tools/do-menu-tren.mjs [url]   (mặc định http://127.0.0.1:8080)
 *
 * Ba phép đo, ở ba cỡ máy (vùng web, xem CLAUDE.md):
 *  1. viên điểm KHÔNG chờm lên chữ "Lật Thẻ";
 *  2. mở menu xong, tâm MỖI mục là chính mục đó theo `elementFromPoint` — tức
 *     không bị màn bên dưới đè (lỗi đã xảy ra: header là stacking context
 *     không z-index, <main> vẽ đè menu);
 *  3. menu nằm trọn trong viewport.
 * Cần Chrome; dùng `ws` của node-server để nói chuyện CDP.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const URL_APP = process.argv[2] ?? 'http://127.0.0.1:8080/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAY = [['SE', 375, 553], ['iPhone 14', 390, 664], ['15 Pro Max', 430, 745]];
const PORT = 9333;

import { rmSync } from 'node:fs';
const PROFILE = `/tmp/mm-cdp-${process.pid}`;
// Profile MỚI mỗi lần và bỏ qua service worker: PWA precache index.html, dùng
// lại profile là đo bản build CŨ mà không hay (đã dính: đo xanh/đỏ ngược nhau).
rmSync(PROFILE, { recursive: true, force: true });
process.on('exit', () => { try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* Chrome còn ghi, lần sau xoá */ } });
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--disable-gpu', '--no-first-run',
  '--no-sandbox', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
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

await goi('Network.enable');
await goi('Network.setBypassServiceWorker', { bypass: true });
await goi('Network.setCacheDisabled', { cacheDisabled: true });
let loi = 0;
const ok = (dk, msg) => { console.log(`${dk ? '✓' : '✗'} ${msg}`); if (!dk) loi++; };

for (const [ten, w, h] of MAY) {
  await goi('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true });
  await goi('Page.navigate', { url: URL_APP + (URL_APP.includes('?') ? '&' : '?') + 'cb=' + Date.now() });
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('header [aria-label="Menu"]')`)); i++) await cho(250);
  // Click rồi chờ Vue vẽ menu ở nhịp sau — đo cùng nhịp là thấy 0 mục
  await js(`document.querySelector('header [aria-label="Menu"]').click()`);
  await cho(200);
  const kq = await js(`(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const ten = document.querySelector('header .brand .name'), diem = document.querySelector('header .total');
    const header = r(document.querySelector('header'));
    const items = [...document.querySelectorAll('header .menu .item')];
    const menu = document.querySelector('header .menu');
    const mucTren = items.map((it) => {
      const b = it.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return { label: it.getAttribute('aria-label'), tren: top ? top.closest('.item') === it : false };
    });
    return { header, ten: r(ten), diem: r(diem), menu: menu ? r(menu) : null, mucTren, soMuc: items.length };
  })()`);
  const chom = kq.diem.l < kq.ten.r - 1;
  ok(!chom, `${ten} ${w}×${h}: viên điểm không chờm chữ (chữ tới ${kq.ten.r.toFixed(1)}px, điểm từ ${kq.diem.l.toFixed(1)}px); header cao ${kq.header.h.toFixed(1)}px`);
  ok(kq.soMuc >= 3, `${ten}: menu có ${kq.soMuc} mục`);
  const bi = kq.mucTren.filter((m) => !m.tren).map((m) => m.label);
  ok(bi.length === 0, `${ten}: mọi mục menu ở trên cùng tại tâm${bi.length ? ' — BỊ ĐÈ: ' + bi.join(', ') : ''}`);
  ok(kq.menu && kq.menu.r <= w + 0.5 && kq.menu.b <= h && kq.menu.l >= 0, `${ten}: menu nằm trọn trong viewport (${kq.menu?.l.toFixed(0)}..${kq.menu?.r.toFixed(0)} × ${kq.menu?.t.toFixed(0)}..${kq.menu?.b.toFixed(0)})`);

  // Màn Tài khoản (nếu server có tài khoản): hộp nằm trọn viewport, nút "Chinh phục" không tràn
  const coTk = await js(`!!document.querySelector('header .menu .item[aria-label="Đăng nhập"], header .menu .item[aria-label="Tài khoản của bạn"]')`);
  if (coTk) {
    await js(`document.querySelector('header .menu .item[aria-label="Đăng nhập"], header .menu .item[aria-label="Tài khoản của bạn"]').click()`);
    await cho(300);
    const tk = await js(`(() => {
      const p = document.querySelector('[aria-label="Tài khoản"] .panel'); if (!p) return null;
      const b = p.getBoundingClientRect();
      const body = p.querySelector('.body');
      const di = [...p.querySelectorAll('.di')].map((x) => x.getBoundingClientRect());
      const tran = di.filter((r) => r.right > b.right - 8 || r.left < b.left + 8).length;
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, scrollW: body.scrollWidth, clientW: body.clientWidth, soDi: di.length, tran,
        hangThap: [...p.querySelectorAll('.danh-hieu li')].filter((li) => li.getBoundingClientRect().height < 44).length };
    })()`);
    ok(tk && tk.l >= 0 && tk.r <= w + 0.5 && tk.t >= 0 && tk.b <= h + 0.5, `${ten}: hộp Tài khoản nằm trọn viewport`);
    ok(tk && tk.scrollW <= tk.clientW, `${ten}: hộp Tài khoản không tràn ngang (${tk?.scrollW}/${tk?.clientW})`);
    ok(tk && tk.soDi > 0 && tk.tran === 0, `${ten}: ${tk?.soDi} nút Chinh phục đều nằm trong hộp`);
    ok(tk && tk.hangThap === 0, `${ten}: mọi hàng danh hiệu cao ≥44px (vùng chạm)`);
  }
}
ws.close(); chrome.kill();
console.log(loi ? `\n${loi} lỗi` : '\nmenu thanh trên: sạch');
process.exit(loi ? 1 : 0);
