/**
 * Chụp tools/og/og.html thành apps/web/public/og.jpg (1200×630).
 *
 *   node tools/og/render.mjs
 *
 * Vì sao chụp từ HTML: nội dung thẻ chia sẻ phải đổi theo tính năng, mà sửa chữ
 * trong HTML thì ai cũng làm được và xem được lịch sử thay đổi trong git — ảnh
 * nhị phân thì không.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { statSync } from 'node:fs';

const require = createRequire('/Users/KienNT/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../apps/web/public/og.jpg');

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(`file://${resolve(here, 'og.html')}`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);                       // chờ font hiện đúng mặt chữ
await p.screenshot({ path: out, type: 'jpeg', quality: 90 });
await b.close();

const kb = (statSync(out).size / 1024).toFixed(0);
console.log(`✓ ${out} — 1200×630, ${kb}KB`);
if (statSync(out).size > 300 * 1024) console.log('⚠ hơi nặng, hạ quality xuống');
