/**
 * DỰNG ẢNH SPLASH (màn chờ lúc mở app) cho iOS + Android bằng Chrome thật.
 *
 *   node tools/tao-splash.mjs
 *
 * Thay ảnh mặc định của Capacitor (dấu X xanh trên nền trắng — logo của bộ đóng
 * gói, không phải của mình). Theo khuyến nghị của Apple, màn chờ GIỐNG màn đầu
 * tiên của app chứ không phải quảng cáo logo: trời Kẹo + mây + đồi + quạt ba lá
 * như trang chủ, nên lúc web hiện lên không có cú giật. KHÔNG có chữ — một ảnh
 * cho cả 12 ngôn ngữ.
 *
 * iOS hiện ảnh vuông 2732 bằng `scaleAspectFill` (LaunchScreen.storyboard): máy
 * dọc chỉ thấy dải giữa, nên mọi thứ quan trọng nằm trong khoảng giữa ~40% bề
 * ngang. Bố cục dùng vmin để mọi cỡ Android cũng ra cùng một hình.
 * Đổi thiết kế: sửa HTML dưới đây rồi chạy lại, xong `cap sync` (đã có trong build:ios).
 */
import { moChrome } from './lib-chrome.mjs';
import { createRequire } from 'node:module';
import { rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const WEB = new URL('../apps/web/', import.meta.url).pathname;
const IOS = join(WEB, 'ios/App/App/Assets.xcassets/Splash.imageset');
const AND = join(WEB, 'android/app/src/main/res');

/** Mọi file đích kèm kích thước thật của nó (đọc từ file đang có). */
const dich = [];
for (const f of readdirSync(IOS).filter((f) => f.endsWith('.png'))) dich.push(join(IOS, f));
for (const d of readdirSync(AND).filter((d) => d.startsWith('drawable'))) {
  const p = join(AND, d, 'splash.png');
  try { statSync(p); dich.push(p); } catch { /* thư mục không có splash */ }
}
const co = (p) => {
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p]).toString();
  return [Number(o.match(/pixelWidth: (\d+)/)[1]), Number(o.match(/pixelHeight: (\d+)/)[1])];
};

const SAO = '<svg viewBox="0 0 100 100"><defs><radialGradient id="g" cx=".5" cy=".25" r=".8"><stop offset="0" stop-color="#fff2a8"/><stop offset=".6" stop-color="#ffc21a"/></radialGradient></defs><path d="M50 4 61 37h35L68 58l11 34-29-21-29 21 11-34L4 37h35z" fill="#b07800" transform="translate(0 4)"/><path d="M50 4 61 37h35L68 58l11 34-29-21-29 21 11-34L4 37h35z" fill="url(#g)"/></svg>';
const TIM = '<svg viewBox="0 0 24 24"><defs><radialGradient id="t" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ff9cb2"/><stop offset=".7" stop-color="#ee3a5e"/></radialGradient></defs><path d="M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" fill="#c21f42" transform="translate(0 .8)"/><path d="M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" fill="url(#t)"/><path d="M7 9.5a2.5 2.5 0 0 1 2.5-1.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/></svg>';
/* Giao diện "Thạch" của Kẹo (17.10.2026): trời gradient, mặt trời tia NGẮN, mây có bụng, đồi cỏ
   xanh hai tầng, ba LÁ BÀI THẬT (viền giấy trắng, lưới quả trám, đường chỉ vàng, sao vàng) — khớp
   quạt lá trang chủ (styles/skins/keo.css). */
const HTML = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%}
body{position:relative;overflow:hidden;background:
  radial-gradient(10vmin 3.6vmin at 30% 30%,#fff 97%,transparent),
  radial-gradient(6vmin 2.8vmin at 37.5% 28.3%,#fff 97%,transparent),
  radial-gradient(11vmin 3.2vmin at 32% 31.4%,#cfeeff 97%,transparent),
  radial-gradient(8.5vmin 3.2vmin at 69% 68%,#fff 97%,transparent),
  radial-gradient(5.4vmin 2.6vmin at 63% 67%,#fff 97%,transparent),
  radial-gradient(9.5vmin 3vmin at 67% 69.2%,#cfeeff 97%,transparent),
  radial-gradient(circle 4vmin at 66% 27%,#ffe066 92%,#ffc93a 96%,transparent),
  radial-gradient(circle 9vmin at 66% 27%,rgba(255,232,130,.5) 50%,transparent),
  linear-gradient(#45b3ef,#7fd3fb 70%,#b5e8ff)}
.nang{position:absolute;left:66%;top:27%;width:24vmin;height:24vmin;translate:-50% -50%;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3CradialGradient id='g'%3E%3Cstop offset='.25' stop-color='%23fff' stop-opacity='.55'/%3E%3Cstop offset='1' stop-color='%23fff' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath fill='url%28%23g%29' d='M100 100L199.6 91.3L199.6 108.7ZM100 100L195.4 130.1L188.7 146.2ZM100 100L176.6 164.3L164.3 176.6ZM100 100L146.2 188.7L130.1 195.4ZM100 100L108.7 199.6L91.3 199.6ZM100 100L69.9 195.4L53.8 188.7ZM100 100L35.7 176.6L23.4 164.3ZM100 100L11.3 146.2L4.6 130.1ZM100 100L0.4 108.7L0.4 91.3ZM100 100L4.6 69.9L11.3 53.8ZM100 100L23.4 35.7L35.7 23.4ZM100 100L53.8 11.3L69.9 4.6ZM100 100L91.3 0.4L108.7 0.4ZM100 100L130.1 4.6L146.2 11.3ZM100 100L164.3 23.4L176.6 35.7ZM100 100L188.7 53.8L195.4 69.9Z'/%3E%3C/svg%3E") center/contain no-repeat}
.doi{position:absolute;inset:0;background:
  radial-gradient(100vmax 26vh at 20% 106%,#5cc23f 60%,#4aa832 61.5%,transparent 62%),
  radial-gradient(120vmax 34vh at 82% 108%,#8fdc5f 60%,#79c94c 61.5%,transparent 62%)}
.la{position:absolute;left:50%;top:50%;width:16vmin;height:21.3vmin;box-sizing:border-box;border:.6vmin solid #fdfdfb;border-radius:1.8vmin;display:flex;align-items:center;justify-content:center;
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 .25vmin,transparent .25vmin 1.8vmin),repeating-linear-gradient(-45deg,rgba(255,255,255,.12) 0 .25vmin,transparent .25vmin 1.8vmin),radial-gradient(90% 70% at 50% 45%,#4d78dc,#2a48a0);
  box-shadow:inset 0 0 0 .5vmin #2a48a0,inset 0 0 0 .75vmin rgba(255,215,90,.85),0 0 0 .15vmin rgba(20,30,70,.15),0 .35vmin 0 #d6dcea,0 2.2vmin 3.6vmin rgba(10,20,60,.3)}
.la svg{width:40%}
.trai{transform:translate(-112%,-46%) rotate(-14deg)}
.phai{transform:translate(12%,-48%) rotate(12deg)}
.giua{transform:translate(-50%,-52%) rotate(-3deg);border-color:#6d8fdc;background:radial-gradient(110% 80% at 50% 35%,#fffdf2,#fff1c9 90%);z-index:1;
  box-shadow:inset 0 0 0 .3vmin rgba(232,178,40,.7),0 0 0 .15vmin rgba(20,30,70,.14),0 .35vmin 0 #5577c4,0 .7vmin 0 #4563ad,0 2.6vmin 4vmin rgba(10,20,60,.32)}
.giua svg{width:56%}
</style><body><div class="nang"></div><div class="doi"></div><div class="la trai">${SAO}</div><div class="la phai">${SAO}</div><div class="la giua">${TIM}</div></body>`;

const PORT = 9400 + (process.pid % 300), PROFILE = `/tmp/mm-splash-${process.pid}`;
const chrome = moChrome('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${PROFILE}`, 'about:blank'], PROFILE);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await goi('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(HTML).toString('base64') });
await cho(800);
for (const p of dich) {
  const [w, h] = co(p);
  await goi('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await cho(250);
  const d = await goi('Page.captureScreenshot', { format: 'png' });
  writeFileSync(p, Buffer.from(d.result.data, 'base64'));
  console.log(`✓ ${w}×${h}  ${p.replace(WEB, '')}`);
}
process.exit(0);
