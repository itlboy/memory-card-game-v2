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
import { spawn } from 'node:child_process';
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

const SAO = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#ffcb2e" stroke="#1d2a5a" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const TIM = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" fill="#ff4d6d" stroke="#1d2a5a" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 9.5a2.5 2.5 0 0 1 2.5-1.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>';
const HTML = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%}
body{position:relative;overflow:hidden;background:
  radial-gradient(9vmin 3.6vmin at 30% 30%,#fff 97%,transparent),
  radial-gradient(6vmin 3vmin at 36.5% 28.5%,#fff 97%,transparent),
  radial-gradient(8vmin 3.2vmin at 69% 68%,#fff 97%,transparent),
  radial-gradient(5.4vmin 2.6vmin at 63.5% 67%,#fff 97%,transparent),
  radial-gradient(circle 4vmin at 66% 27%,#ffd84d 95%,transparent),
  radial-gradient(circle 8vmin at 66% 27%,rgba(255,228,120,.45) 55%,transparent),
  radial-gradient(90vmax 18vmin at 25% 104%,#4fb0ea 60%,transparent 61%),
  radial-gradient(120vmax 22vmin at 80% 108%,#3e9be0 60%,transparent 61%),
  #5cc2f2}
.la{position:absolute;left:50%;top:50%;width:16vmin;height:21.3vmin;box-sizing:border-box;border:.55vmin solid #1d2a5a;border-radius:2.2vmin;box-shadow:0 1vmin 0 #1d2a5a;display:flex;align-items:center;justify-content:center;background:#2b4c9b}
.la::before{content:'';position:absolute;inset:1.1vmin;border-radius:1.4vmin;border:.4vmin dotted rgba(255,255,255,.55)}
.la svg{width:42%}
.trai{transform:translate(-112%,-46%) rotate(-14deg)}
.phai{transform:translate(12%,-48%) rotate(12deg)}
.giua{transform:translate(-50%,-52%) rotate(-3deg);background:#fffbea;z-index:1}
.giua::before{display:none}.giua svg{width:58%}
</style><body><div class="la trai">${SAO}</div><div class="la phai">${SAO}</div><div class="la giua">${TIM}</div></body>`;

const PORT = 9400 + (process.pid % 300), PROFILE = `/tmp/mm-splash-${process.pid}`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { chrome.kill(); try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* Chrome còn giữ file */ } });
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
