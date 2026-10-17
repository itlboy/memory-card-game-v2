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
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const WEB = new URL('../apps/web/', import.meta.url).pathname;
const IOS = join(WEB, 'ios/App/App/Assets.xcassets/Splash.imageset');
const AND = join(WEB, 'android/app/src/main/res');

/** Mọi file đích kèm kích thước thật của nó (đọc từ file đang có). */
const dich = [];
for (const f of readdirSync(IOS).filter((f) => f.endsWith('.png') && !f.endsWith('-toi.png'))) dich.push(join(IOS, f));
for (const d of readdirSync(AND).filter((d) => d.startsWith('drawable') && !d.includes('night'))) {
  const p = join(AND, d, 'splash.png');
  try { statSync(p); dich.push(p); } catch { /* thư mục không có splash */ }
}
const co = (p) => {
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p]).toString();
  return [Number(o.match(/pixelWidth: (\d+)/)[1]), Number(o.match(/pixelHeight: (\d+)/)[1])];
};

const SAO = '<svg viewBox="0 0 100 100"><defs><radialGradient id="g" cx=".5" cy=".25" r=".8"><stop offset="0" stop-color="#fff2a8"/><stop offset=".6" stop-color="#ffc21a"/></radialGradient></defs><path d="M50 4 61 37h35L68 58l11 34-29-21-29 21 11-34L4 37h35z" fill="#b07800" transform="translate(0 4)"/><path d="M50 4 61 37h35L68 58l11 34-29-21-29 21 11-34L4 37h35z" fill="url(#g)"/></svg>';
const TIM = '<svg viewBox="0 0 24 24"><defs><radialGradient id="t" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ff9cb2"/><stop offset=".7" stop-color="#ee3a5e"/></radialGradient></defs><path d="M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" fill="#c21f42" transform="translate(0 .8)"/><path d="M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" fill="url(#t)"/><path d="M7 9.5a2.5 2.5 0 0 1 2.5-1.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/></svg>';
/* Giao diện "Thạch" của Kẹo (17.10.2026), HAI bản theo SÁNG/TỐI CỦA MÁY (chủ dự án: "splash thay đổi
   theo sáng tối"): splash hiện TRƯỚC khi app chạy nên chỉ biết cài đặt của hệ điều hành, không biết
   công tắc Sáng/Tối trong app. Android: thư mục `drawable-…-night-…`; iOS: biến thể Dark Appearance
   trong Splash.imageset. Cả hai khớp trang chủ (styles/skins/keo*.css): trời, MỘT đám mây nhỏ mờ,
   mặt trời không tia (tối: trăng + sao), đồi hai tầng, ba lá bài thật — lưng xanh thẫm trơn + sao. */
const html = (toi) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%}
body{position:relative;overflow:hidden;background:${toi ? `
  radial-gradient(circle 10vmin at 66% 27%,rgba(255,238,170,.2) 55%,transparent),
  radial-gradient(circle .35vmin at 24% 20%,#fff 95%,transparent),
  radial-gradient(circle .3vmin at 44% 14%,#fff 95%,transparent),
  radial-gradient(circle .4vmin at 80% 38%,#ffe9a6 95%,transparent),
  radial-gradient(circle .3vmin at 30% 64%,#fff 95%,transparent),
  radial-gradient(circle .35vmin at 74% 72%,#fff 95%,transparent),
  radial-gradient(circle .3vmin at 52% 80%,#fff 95%,transparent),
  radial-gradient(70% 18% at 30% 30%,rgba(110,230,200,.12),transparent 70%),
  linear-gradient(#0f1640,#1f2b66 75%,#2c3a7c)` : `
  radial-gradient(7vmin 2.6vmin at 30% 30%,rgba(255,255,255,.55) 97%,transparent),
  radial-gradient(4.5vmin 2vmin at 36% 28.6%,rgba(255,255,255,.55) 97%,transparent),
  radial-gradient(circle 4vmin at 66% 27%,#ffe066 92%,#ffc93a 96%,transparent),
  radial-gradient(circle 9vmin at 66% 27%,rgba(255,232,130,.5) 50%,transparent),
  linear-gradient(#45b3ef,#7fd3fb 70%,#b5e8ff)`}}
.trang{position:absolute;left:66%;top:27%;width:7.6vmin;height:7.6vmin;translate:-50% -50%;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3CradialGradient id='t' cx='.38' cy='.32' r='.75'%3E%3Cstop offset='0' stop-color='%23fffbe6'/%3E%3Cstop offset='.7' stop-color='%23fbe8a6'/%3E%3Cstop offset='1' stop-color='%23efd07a'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='48' fill='url%28%23t%29'/%3E%3Ccircle cx='34' cy='38' r='9' fill='%23e6c76a' opacity='.45'/%3E%3Ccircle cx='62' cy='62' r='12' fill='%23e6c76a' opacity='.4'/%3E%3Ccircle cx='66' cy='30' r='5.5' fill='%23e6c76a' opacity='.4'/%3E%3Ccircle cx='36' cy='68' r='5' fill='%23e6c76a' opacity='.35'/%3E%3C/svg%3E") center/contain no-repeat}
.doi{position:absolute;inset:0;background:${toi ? `
  radial-gradient(100vmax 26vh at 20% 106%,#1b2760 60%,#141d4d 61.5%,transparent 62%),
  radial-gradient(120vmax 34vh at 82% 108%,#2a3678 60%,#222d68 61.5%,transparent 62%)` : `
  radial-gradient(100vmax 26vh at 20% 106%,#5cc23f 60%,#4aa832 61.5%,transparent 62%),
  radial-gradient(120vmax 34vh at 82% 108%,#8fdc5f 60%,#79c94c 61.5%,transparent 62%)`}}
.la{position:absolute;left:50%;top:50%;width:16vmin;height:21.3vmin;box-sizing:border-box;border:.6vmin solid ${toi ? '#d9deeb' : '#fdfdfb'};border-radius:1.8vmin;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(90% 70% at 50% 40%,#2f4fa6,#1a3172);
  box-shadow:inset 0 0 0 .5vmin #1a3172,inset 0 0 0 .75vmin rgba(255,215,90,.8),0 0 0 .15vmin rgba(20,30,70,.15),0 .35vmin 0 ${toi ? '#9aa6c6' : '#d6dcea'},0 2.2vmin 3.6vmin rgba(0,0,0,${toi ? '.45' : '.28'})}
.la svg{width:40%}
.trai{transform:translate(-112%,-46%) rotate(-14deg)}
.phai{transform:translate(12%,-48%) rotate(12deg)}
.giua{transform:translate(-50%,-52%) rotate(-3deg);z-index:1;${toi
  ? `border-color:#9aa6d6;background:radial-gradient(110% 80% at 50% 35%,#f6efd9,#e6dcbd 85%);
  box-shadow:inset 0 0 0 .3vmin rgba(255,210,80,.6),0 0 0 .15vmin rgba(0,0,0,.3),0 .35vmin 0 #9aa6c6,0 2.6vmin 4vmin rgba(0,0,0,.45)}`
  : `border-color:#6d8fdc;background:radial-gradient(110% 80% at 50% 35%,#fffdf2,#fff1c9 90%);
  box-shadow:inset 0 0 0 .3vmin rgba(232,178,40,.7),0 0 0 .15vmin rgba(20,30,70,.14),0 .35vmin 0 #5577c4,0 .7vmin 0 #4563ad,0 2.6vmin 4vmin rgba(10,20,60,.32)}`}
.giua svg{width:56%}
</style><body>${toi ? '<div class="trang"></div>' : ''}<div class="doi"></div><div class="la trai">${SAO}</div><div class="la phai">${SAO}</div><div class="la giua">${TIM}</div></body>`;

/* Đích bản TỐI: Android chèn `night` đúng thứ tự qualifier (sau port/land, trước mật độ);
   iOS thêm hậu tố `-toi` + khai Dark Appearance trong Contents.json. */
const dichToi = (p) => p.includes('/res/drawable')
  ? p.replace(/\/res\/drawable(-port|-land)?(-[a-z]*dpi)?\//, (_m, o = '', d = '') => `/res/drawable${o}-night${d}/`)
  : p.replace(/\.png$/, '-toi.png');

const PORT = 9400 + (process.pid % 300), PROFILE = `/tmp/mm-splash-${process.pid}`;
const chrome = moChrome('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${PROFILE}`, 'about:blank'], PROFILE);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

for (const toi of [false, true]) {
  await goi('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html(toi)).toString('base64') });
  await cho(800);
  for (const goc of dich) {
    const [w, h] = co(goc);
    const p = toi ? dichToi(goc) : goc;
    mkdirSync(dirname(p), { recursive: true });
    await goi('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await cho(250);
    const d = await goi('Page.captureScreenshot', { format: 'png' });
    writeFileSync(p, Buffer.from(d.result.data, 'base64'));
    console.log(`✓ ${toi ? 'tối' : 'sáng'} ${w}×${h}  ${p.replace(WEB, '')}`);
  }
}
// iOS: khai bản tối (Dark Appearance) cho từng cỡ trong Contents.json
const json = join(IOS, 'Contents.json');
const cj = JSON.parse(readFileSync(json, 'utf8'));
const sang = cj.images.filter((i) => !i.appearances);
cj.images = [...sang, ...sang.map((i) => ({ ...i, filename: i.filename.replace(/\.png$/, '-toi.png'), appearances: [{ appearance: 'luminosity', value: 'dark' }] }))];
writeFileSync(json, JSON.stringify(cj, null, 2) + '\n');
process.exit(0);
