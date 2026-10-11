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
  // Mỗi cỡ máy là một người chơi MỚI: xoá bản lưu của lượt máy trước rồi tải lại
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('header')`)); i++) await cho(250);
  await js('localStorage.clear(); sessionStorage.clear(); true');
  await goi('Page.reload', { ignoreCache: true });
  await cho(500);
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
  const dhViên = await js(`(() => { const d = document.querySelector('header .dh'); if (!d) return null; const b = d.getBoundingClientRect(); return { l: b.left, r: b.right, h: b.height }; })()`);
  const menuL = await js(`document.querySelector('header .menu-btn').getBoundingClientRect().left`);
  ok(dhViên && dhViên.l >= kq.diem.r - 0.5 && dhViên.r <= menuL + 0.5,
    `${ten}: viên 🏅 nằm giữa viên điểm và nút menu, không chờm (điểm tới ${kq.diem.r.toFixed(1)}, 🏅 ${dhViên?.l.toFixed(1)}..${dhViên?.r.toFixed(1)}, menu từ ${menuL.toFixed(1)})`);
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
    // Danh sách danh hiệu đã chuyển sang màn riêng; ở đây chỉ còn nút trỏ sang
    const nutDh = await js(`(() => { const b = document.querySelector('[aria-label="Tài khoản"] .nut-dh'); if (!b) return null; const r = b.getBoundingClientRect(); return { h: r.height, tren: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.nut-dh') === b }; })()`);
    ok(nutDh && nutDh.h >= 44 && nutDh.tren, `${ten}: màn Tài khoản có nút Danh hiệu cao ≥44px, bấm được`);
  }
}
/* ---------- màn Danh hiệu + một ván thật tới bảng kết quả ---------- */
for (const [ten, w, h] of MAY) {
  await goi('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true });
  await js('localStorage.clear(); sessionStorage.clear(); true');
  await goi('Page.navigate', { url: URL_APP + '?cb=' + Date.now() });
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('header .dh')`)); i++) await cho(250);
  await js(`document.querySelector('header .dh').click()`);
  await cho(300);
  const dh = await js(`(() => {
    const p = document.querySelector('[aria-label="Danh hiệu"] .panel'); if (!p) return null;
    const b = p.getBoundingClientRect(), body = p.querySelector('.body');
    const di = [...p.querySelectorAll('.di')];
    const ngoai = di.filter((x) => { const r = x.getBoundingClientRect(); return r.right > b.right - 8 || r.left < b.left + 8; }).length;
    const d = di[0]?.getBoundingClientRect();
    const tren = d ? document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2) === di[0] : false;
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, sw: body.scrollWidth, cw: body.clientWidth, so: di.length, ngoai, tren,
      tieuDe: p.querySelector('h2').textContent.trim() };
  })()`);
  ok(dh && dh.l >= 0 && dh.r <= w + 0.5 && dh.t >= 0 && dh.b <= h + 0.5, `${ten}: màn Danh hiệu mở từ viên 🏅, nằm trọn viewport (${dh?.tieuDe})`);
  ok(dh && dh.sw <= dh.cw && dh.ngoai === 0 && dh.tren, `${ten}: ${dh?.so} nút Chinh phục nằm trong hộp, nút đầu bấm được, không tràn ngang`);

  // Chinh phục "Bàn 4 thẻ" → vào ván 2×2 → lật tới khi xong
  const vao = await js(`(() => { const b = document.querySelector('[aria-label="Chinh phục: Bàn 4 thẻ"]'); if (!b) return false; b.click(); return true; })()`);
  ok(vao, `${ten}: có nút "Chinh phục: Bàn 4 thẻ" và bấm được`);
  await cho(1800);
  const soLa = await js(`document.querySelectorAll('button.card').length`);
  ok(soLa === 4, `${ten}: bấm Chinh phục mở đúng bàn 4 thẻ (thấy ${soLa} lá)`);
  for (let lan = 0; lan < 8; lan++) {
    if (await js(`!!document.querySelector('[aria-labelledby="resTitle"]')`)) break;
    const conLai = await js(`[...document.querySelectorAll('button.card')].map((b, i) => b.classList.contains('done') ? -1 : i).filter((i) => i >= 0)`);
    if (conLai.length < 2) { await cho(800); continue; }
    const a = conLai[0], b = conLai[1 + (lan % (conLai.length - 1))];
    await js(`document.querySelectorAll('button.card')[${a}].click()`); await cho(450);
    await js(`document.querySelectorAll('button.card')[${b}].click()`); await cho(1700);
  }
  for (let i = 0; i < 20 && !(await js(`!!document.querySelector('[aria-labelledby="resTitle"]')`)); i++) await cho(300);
  await cho(600);
  const kqv = await js(`(() => {
    const o = document.querySelector('[aria-labelledby="resTitle"]'); if (!o) return null;
    const p = o.querySelector('.panel'), b = p.getBoundingClientRect();
    const nut = [...p.querySelectorAll('button')].filter((x) => x.offsetParent);
    const ngoaiMan = nut.filter((x) => { const r = x.getBoundingClientRect(); return r.bottom > innerHeight || r.top < 0; }).map((x) => x.textContent.trim());
    const gy = p.querySelector('.goi-y .di'); let gyTren = null;
    if (gy) { const r = gy.getBoundingClientRect(); gyTren = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === gy; }
    return { t: b.top, b: b.bottom, ngoaiMan, coGoiY: !!gy, gyTren, goiY: p.querySelector('.goi-y b')?.textContent };
  })()`);
  ok(kqv, `${ten}: chơi hết ván, bảng kết quả hiện`);
  ok(kqv && kqv.ngoaiMan.length === 0, `${ten}: mọi nút bảng kết quả nằm trong màn hình${kqv?.ngoaiMan.length ? ' — RA NGOÀI: ' + kqv.ngoaiMan.join(', ') : ''}`);
  ok(kqv && kqv.coGoiY && kqv.gyTren, `${ten}: có gợi ý danh hiệu kế tiếp ("${kqv?.goiY}") và nút Chinh phục bấm được`);
  const huy = await js(`document.querySelector('header .dh b')?.textContent`);
  ok(/^[1-9]\d*\//.test(huy ?? ''), `${ten}: viên 🏅 cộng lên sau ván (${huy})`);
}

ws.close(); chrome.kill();
console.log(loi ? `\n${loi} lỗi` : '\nmenu thanh trên: sạch');
process.exit(loi ? 1 : 0);
