#!/usr/bin/env node
/**
 * ĐÓNG GÓI WEB CHO CẬP NHẬT NÓNG (OTA) — chạy cuối `pnpm --filter @mm/web build`.
 *
 * Dựng THÊM một bản web kiểu APP (VITE_SERVER_URL trỏ server công khai, giống
 * `build:ios`/`build:android`) vào dist-ota/, nén zip, rồi đặt vào dist/ota/ kèm
 * manifest.json. Vì nằm trong dist nên CẢ HAI server (Node qua Docker, Cloudflare qua
 * `pnpm release`) tự phục vụ /ota/* — không có đường deploy riêng nào để quên.
 *
 * App (lib/ota.ts) đọc /ota/manifest.json, khác gói đang chạy thì tải zip ngầm và
 * áp ở lần MỞ LẠI app. `minNative` lấy từ apps/web/ota.json.
 *   OTA_ID=<chuỗi> để ép mã gói (mặc định <version>-<giờ build UTC>).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
// fflate cài ở apps/web (devDependency) — nạp từ đó, không từ gốc repo
const { zipSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('fflate');

const web = new URL('../apps/web/', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8'));
const { minNative } = JSON.parse(readFileSync(join(web, 'ota.json'), 'utf8'));
const id = process.env.OTA_ID ?? `${pkg.version}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
const SRC = join(web, 'dist-ota');

rmSync(SRC, { recursive: true, force: true });
const r = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-ota', '--emptyOutDir', '--logLevel', 'warn'], {
  cwd: web, stdio: 'inherit',
  env: { ...process.env, OTA_ID: id, VITE_SERVER_URL: process.env.VITE_SERVER_URL ?? 'https://flipmatch.cozypi.com' }
});
if (r.status) process.exit(r.status ?? 1);

const files = {};
(function gom(dir) {
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) gom(p);
    else files[relative(SRC, p)] = new Uint8Array(readFileSync(p));
  }
})(SRC);
if (!files['index.html']) { console.error('✗ gói OTA thiếu index.html'); process.exit(1); }

const zip = zipSync(files, { level: 6 });
const sha256 = createHash('sha256').update(zip).digest('hex');
const ra = join(web, 'dist', 'ota');
mkdirSync(ra, { recursive: true });
writeFileSync(join(ra, `${id}.zip`), zip);
writeFileSync(join(ra, 'manifest.json'), JSON.stringify({ id, url: `/ota/${id}.zip`, sha256, minNative, builtAt: new Date().toISOString() }, null, 2));
rmSync(SRC, { recursive: true, force: true });
console.log(`✓ OTA ${id} · ${(zip.length / 1e6).toFixed(1)} MB · ${Object.keys(files).length} file · cần app ≥ ${minNative}`);
