/**
 * ĐO CHỮ TRÀN THEO NGÔN NGỮ — Chrome thật, iPhone SE (vùng web 375×553, máy hẹp nhất).
 *
 *   node tools/do-ngon-ngu.mjs [url]   (mặc định http://127.0.0.1:8080, cần dist mới)
 *
 * Tiếng Đức, Nga, Pháp dài hơn tiếng Việt/Anh tới 30–40%: nút vừa ở tiếng Việt có
 * thể lòi chữ ở tiếng Đức. Với MỖI ngôn ngữ, đi qua trang chủ, menu, các bước
 * wizard, bảng kết quả (sau một ván 4 thẻ thật) và báo:
 *  - phần tử có chữ tràn ngang (scrollWidth > clientWidth) mà KHÔNG cố ý cắt "…";
 *  - trang cuộn ngang;
 *  - nút chính nằm ngoài màn hình.
 */
import { moChrome } from './lib-chrome.mjs';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const URL_APP = process.argv[2] ?? 'http://127.0.0.1:8080/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LANGS = (process.env.LANGS ?? 'vi,en,es,pt,fr,de,it,tr,ja,ko,zh,zh-TW,ru,id,th').split(',');
const [W, H] = [375, 553];
const PORT = 9343, PROFILE = `/tmp/mm-cdp-nn-${process.pid}`;
const chrome = moChrome(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${PROFILE}`, 'about:blank'], PROFILE);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await goi('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await goi('Network.enable'); await goi('Network.setBypassServiceWorker', { bypass: true }); await goi('Network.setCacheDisabled', { cacheDisabled: true });
await goi('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });

/** Phần tử chữ tràn: tràn ngang mà không cố ý cắt bằng "…", hoặc nằm lòi khỏi màn. */
const DO = `(() => {
  const ra = [];
  for (const e of document.querySelectorAll('button, .option, .lt-chip, .seg-btn, .tab, h2, h3, strong, small, .pill, .total, .dh, .item span, label')) {
    if (!e.offsetParent || !e.textContent.trim()) continue;
    // Chữ chỉ cho trình đọc màn hình (.sr-only, khung 1px) — "tràn" là cố ý, không phải lỗi
    if (e.closest('.sr-only')) continue;
    const cs = getComputedStyle(e);
    if (cs.textOverflow === 'ellipsis') continue;
    // Ẩn kiểu sr-only nhưng không mang lớp đó (tên theme trong ô: clip 1px, 17.10.2026)
    { const k = e.getBoundingClientRect(); if (k.width <= 1 && k.height <= 1) continue; }
    /*
     * Đo HÌNH CHỮ (khung bao của phần chữ) so với khung phần tử. KHÔNG dùng
     * scrollWidth: (1) bỏ qua overflow:visible là bỏ sót đúng ca chữ lòi khỏi nút
     * (bản đầu báo sạch giả); (2) đo scrollWidth thì lớp ::after nới vùng chạm
     * của nút nhỏ (logo, viên 🏅, chip) làm báo tràn giả.
     */
    const r = e.getBoundingClientRect();
    // Chỉ đo đoạn chữ ĐANG HIỆN (bỏ chữ visibility:hidden, vd. tên app bị ẩn khi chật)
    let chu = { left: Infinity, right: -Infinity, width: 0 };
    const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim() || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
      // Chữ trong phần tử ẩn kiểu sr-only không mang lớp đó (tên theme trong ô: clip 1px, 17.10.2026)
      { const k = n.parentElement.getBoundingClientRect(); if (k.width <= 1 && k.height <= 1) continue; }
      const rg = document.createRange(); rg.selectNodeContents(n);
      const b = rg.getBoundingClientRect();
      if (b.width) chu = { left: Math.min(chu.left, b.left), right: Math.max(chu.right, b.right), width: 1 };
    }
    if (chu.width > 0 && (chu.right > r.right + 1 || chu.left < r.left - 1)) ra.push('tràn ngang: ' + e.textContent.trim().slice(0, 50));
    if (r.right > innerWidth + 1 || r.left < -1) ra.push('lòi khỏi màn: ' + e.textContent.trim().slice(0, 50));
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) ra.push('trang cuộn ngang');
  return [...new Set(ra)];
})()`;

// Mở trang một lần trước: localStorage ở about:blank không có origin, ghi tiến độ là mất
await goi('Page.navigate', { url: URL_APP }); await cho(1500);
let tong = 0;
for (const lang of LANGS) {
  const loi = [];
  const ghi = async (man) => { for (const l of await js(DO)) loi.push(`${man}: ${l}`); };
  // Mở sẵn Chiến dịch tới màn 12 để đo bản đồ có chú giải luật + khung "Luật màn này"
  await js(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mm.v2', JSON.stringify({ campaign: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 1, { stars: 2 }])) })); true`);
  await goi('Page.navigate', { url: `${URL_APP}?lang=${lang}&cb=${Date.now()}` });
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('.o-chien-dich')`)); i++) await cho(250);
  await cho(300); await ghi('trang chủ');
  await js(`document.querySelector('header .menu-btn').click()`); await cho(300); await ghi('menu');
  await js(`document.querySelector('header .menu-btn').click()`); await cho(200);
  // Màn danh hiệu: đo cả hai ngăn Chưa có · Đã có
  await js(`document.querySelector('header .dh').click()`); await cho(400); await ghi('danh hiệu');
  await js(`document.querySelectorAll('.tab')[1]?.click()`); await cho(300); await ghi('danh hiệu · đã có');
  await js(`document.querySelector('.overlay .head .btn').click()`); await cho(300);
  // Chiến dịch: bản đồ (chú giải luật) · màn tim (10) · màn trùm (12) — mỗi màn một luật, 27.10.2026
  await js(`document.querySelectorAll('.o-chien-dich, .o-vuong')[0].click()`);
  for (let i = 0; i < 20 && !(await js(`document.querySelectorAll('.node').length > 0`)); i++) await cho(200);
  await cho(300); await ghi('bản đồ Chiến dịch');
  if (!(await js(`document.querySelectorAll('.node .luat').length >= 48`))) loi.push('bản đồ Chiến dịch: thiếu nhãn luật');
  for (const man of [10, 12]) {
    await js(`document.querySelectorAll('.node')[${man - 1}].click()`);
    for (let i = 0; i < 20 && !(await js(`!!document.querySelector('.luat-man')`)); i++) await cho(200); await ghi(`bắt đầu màn ${man}`);
    if (!(await js(`!!document.querySelector('.luat-man')`))) loi.push(`bắt đầu màn ${man}: không thấy khung luật màn`);
    await js(`document.querySelector('.wizard-head .back')?.click()`); await cho(400);
  }
  await js(`document.querySelector('.wizard-head .back')?.click()`); await cho(400);
  await js(`document.querySelectorAll('.o-chien-dich, .o-vuong')[2].click()`); await cho(400); await ghi('bước mức máy');
  await js(`document.querySelector('.wizard-head .back')?.click()`); await cho(300);
  await js(`document.querySelectorAll('.o-chien-dich, .o-vuong')[1].click()`); await cho(400); await ghi('bước số người');
  await js(`document.querySelectorAll('.counts .option')[0].click()`); await cho(400); await ghi('bước số thẻ');
  await js(`document.querySelectorAll('.size-grid button')[0].click()`); await cho(400); await ghi('bước theme');
  await js(`document.querySelector('.btn-primary').click()`); await cho(400); await ghi('bước luật bàn');
  await js(`document.querySelector('.btn-primary').click()`); await cho(1800); await ghi('màn chơi');
  for (let lan = 0; lan < 8; lan++) {
    if (await js(`!!document.querySelector('[aria-labelledby="resTitle"]')`)) break;
    const c = await js(`[...document.querySelectorAll('button.card')].map((b, i) => b.classList.contains('done') ? -1 : i).filter((i) => i >= 0)`);
    if (c.length < 2) { await cho(800); continue; }
    await js(`document.querySelectorAll('button.card')[${c[0]}].click()`); await cho(450);
    await js(`document.querySelectorAll('button.card')[${c[1 + (lan % (c.length - 1))]}].click()`); await cho(1700);
  }
  for (let i = 0; i < 20 && !(await js(`!!document.querySelector('[aria-labelledby="resTitle"]')`)); i++) await cho(300);
  await cho(600); await ghi('bảng kết quả');
  const nutNgoai = await js(`[...document.querySelectorAll('[aria-labelledby="resTitle"] button')].filter((b) => b.offsetParent && b.getBoundingClientRect().bottom > innerHeight).map((b) => b.textContent.trim())`);
  for (const b of nutNgoai ?? []) loi.push(`bảng kết quả: nút ra ngoài màn: ${b}`);
  console.log(`${loi.length ? '✗' : '✓'} ${lang} (đo ${await js("document.querySelectorAll('button').length")} nút ở màn cuối)${loi.length ? '\n    ' + loi.join('\n    ') : ''}`);
  tong += loi.length;
}
ws.close(); chrome.kill();
try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* bỏ qua */ }
console.log(tong ? `\n${tong} chỗ tràn` : '\nmọi ngôn ngữ: không chỗ nào tràn');
process.exit(tong ? 1 : 0);
