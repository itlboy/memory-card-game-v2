/**
 * DỰNG ICON APP từ MỘT bản vẽ SVG gốc (phương án B "Cặp lá", chủ dự án chọn
 * 13.10.2026: một lá úp sao vàng + một lá ngửa tim, nền vàng, viền mực kiểu Kẹo).
 *
 *   node tools/tao-icon.mjs
 *
 * Ghi đè: public/icon.svg (favicon) + icon-192/512 + apple-touch-icon; iOS
 * AppIcon 1024; Android ic_launcher / _round / _foreground mọi mật độ + màu nền
 * adaptive. Đổi icon = sửa hàm `svg()` dưới đây rồi chạy lại.
 *
 * Ba luật:
 *  · iOS: KHÔNG kênh alpha, không bo góc (iOS tự bo) — App Store từ chối icon
 *    có alpha, nên ảnh iOS đi qua JPEG một lượt để chắc chắn mất alpha.
 *  · Android adaptive: foreground nền TRONG, hình nằm trong vùng an toàn 66/108
 *    ở giữa (launcher cắt hình tròn/vuông/giọt nước tuỳ máy).
 *  · Favicon SVG: dùng chính bản vẽ này, nét đủ dày để còn đọc được ở 16px.
 */
import { execFileSync } from 'node:child_process';
import { moChrome } from './lib-chrome.mjs';
import { createRequire } from 'node:module';
import { rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const WebSocket = require('ws');

const WEB = new URL('../apps/web/', import.meta.url).pathname;
const NEN = '#ffcb2e', MUC = '#1d2a5a';

const SAO = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const TIM = 'M12 21s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z';
/** Một lá: hình chữ nhật bo góc + gờ mực lệch xuống, xoay quanh tâm lá. */
const la = (cx, cy, goc, nen, hinh, mauHinh, coHinh, go = 0) => {
  const w = 370, h = 505, r = 78, s = coHinh / 24;
  return `<g transform="rotate(${goc} ${cx} ${cy})">
    ${go ? `<rect x="${cx - w / 2}" y="${cy - h / 2 + go}" width="${w}" height="${h}" rx="${r}" fill="${MUC}"/>` : ''}
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${r}" fill="${nen}" stroke="${MUC}" stroke-width="30"/>
    <g transform="translate(${cx - coHinh / 2} ${cy - coHinh / 2}) scale(${s})"><path d="${hinh}" fill="${mauHinh}" stroke="${MUC}" stroke-width="1.5" stroke-linejoin="round"/></g>
  </g>`;
};
/** @param nen có nền vàng không  @param tiLe thu nhỏ quanh tâm (foreground Android) */
function svg({ nen = true, tiLe = 1, tron = false } = {}) {
  const ve = `<g transform="translate(512 512) scale(${tiLe}) translate(-512 -512)">
    ${la(352, 548, -14, '#2b4c9b', SAO, NEN, 200)}
    ${la(668, 482, 10, '#fffbea', TIM, '#ff4d6d', 236, 30)}
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${tron ? '<defs><clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath></defs><g clip-path="url(#c)">' : '<g>'}
  ${nen ? `<rect width="1024" height="1024" fill="${NEN}"/>` : ''}
  ${ve}
  </g></svg>`;
}

/* ---------- đích ---------- */
const andRes = join(WEB, 'android/app/src/main/res');
const MAT_DO = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const viec = [
  { file: join(WEB, 'public/icon-192.png'), co: 192, v: svg() },
  { file: join(WEB, 'public/icon-512.png'), co: 512, v: svg() },
  { file: join(WEB, 'public/apple-touch-icon.png'), co: 180, v: svg() },
  { file: join(WEB, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), co: 1024, v: svg(), boAlpha: true },
];
for (const [ten, k] of Object.entries(MAT_DO)) {
  const d = join(andRes, `mipmap-${ten}`);
  if (!existsSync(d)) continue;
  viec.push({ file: join(d, 'ic_launcher.png'), co: 48 * k, v: svg() });
  viec.push({ file: join(d, 'ic_launcher_round.png'), co: 48 * k, v: svg({ tron: true }) });
  // 108dp, hình gói trong vùng an toàn 66dp → thu còn ~0,6
  viec.push({ file: join(d, 'ic_launcher_foreground.png'), co: 108 * k, v: svg({ nen: false, tiLe: 0.6 }) });
}

writeFileSync(join(WEB, 'public/icon.svg'), svg() + '\n');
writeFileSync(join(andRes, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${NEN.toUpperCase()}</color>\n</resources>\n`);

/* ---------- chụp bằng Chrome ---------- */
const PORT = 9500 + (process.pid % 300), PROFILE = `/tmp/mm-icon-${process.pid}`;
const chrome = moChrome('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${PROFILE}`, 'about:blank'], PROFILE);
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await cho(250); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0; const dang = new Map();
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && dang.has(d.id)) { dang.get(d.id)(d); dang.delete(d.id); } });
const goi = (method, params = {}) => new Promise((r) => { const i = ++id; dang.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await goi('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

for (const { file, co, v, boAlpha } of viec) {
  const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${co}px;height:${co}px}</style>${v}`;
  await goi('Emulation.setDeviceMetricsOverride', { width: co, height: co, deviceScaleFactor: 1, mobile: false });
  await goi('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await cho(300);
  const d = await goi('Page.captureScreenshot', { format: 'png', omitBackground: true });
  writeFileSync(file, Buffer.from(d.result.data, 'base64'));
  if (boAlpha) {   // PNG → JPEG → PNG: chắc chắn không còn kênh alpha (App Store từ chối)
    const tam = file + '.jpg';
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', file, '--out', tam]);
    execFileSync('sips', ['-s', 'format', 'png', tam, '--out', file]);
    rmSync(tam);
  }
  console.log(`✓ ${co}px  ${file.replace(WEB, '')}`);
}
process.exit(0);
