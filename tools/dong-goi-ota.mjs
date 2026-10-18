#!/usr/bin/env node
/**
 * ĐÓNG GÓI WEB CHO CẬP NHẬT NÓNG (OTA) — chạy cuối `pnpm --filter @mm/web build`.
 *
 * Dựng THÊM một bản web kiểu APP (VITE_SERVER_URL trỏ server công khai, giống
 * `build:ios`/`build:android`) vào dist-ota/, nén zip, rồi đặt vào dist/ota/ kèm
 * manifest.json. Vì nằm trong dist nên CẢ HAI server (Node qua Docker, Cloudflare qua
 * `pnpm release`) tự phục vụ /ota/* — không có đường deploy riêng nào để quên.
 *
 * App (lib/ota.ts) đọc /ota/manifest.json, khác gói đang chạy thì tải ngầm và
 * áp ở lần MỞ LẠI app. `minNative` lấy từ apps/web/ota.json.
 *
 * TẢI CHÊNH LỆCH (16.10.2026, chủ dự án: "cần cơ chế thật nhẹ nhàng" — gói zip đã 33MB vì
 * bộ emoji Noto 3D): ngoài zip còn xuất DANH SÁCH FILE `/ota/<id>.files.json` ([đường
 * dẫn, sha256]) và từng file ở `/ota/f/<sha256><đuôi>` (địa chỉ theo nội dung → cache mãi, file
 * không đổi giữa hai bản thì cùng địa chỉ). Plugin lấy file trùng mã băm từ bản app cài
 * sẵn hoặc kho đệm của nó, CHỈ tải file khác → mỗi lần cập nhật chỉ vài file JS/CSS.
 * Zip GIỮ LẠI: client cũ chỉ biết zip, và client mới quay về zip khi tải chênh lệch lỗi.
 *   Mã gói: tools/ma-goi-ota.mjs (theo commit; chung với vite.config) — OTA_ID=<chuỗi> để ép.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { maGoiOta } from './ma-goi-ota.mjs';
// fflate cài ở apps/web (devDependency) — nạp từ đó, không từ gốc repo
const { zipSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('fflate');

const web = new URL('../apps/web/', import.meta.url).pathname;
const { minNative } = JSON.parse(readFileSync(join(web, 'ota.json'), 'utf8'));
const id = maGoiOta();
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

/*
 * ZIP (đường DỰ PHÒNG + bản app cũ chỉ biết zip) BỎ ẢNH EMOJI 512 (16.10.2026): cả gói ~33MB
 * vượt giới hạn 25MiB MỖI FILE của Cloudflare Worker (gói miễn phí, không dùng R2). Bỏ 512
 * (~20MB) còn ~18MB. App cài bằng zip tự nhận ra thiếu 512 và dùng 256 (lib/emoji.ts
 * `kiemCo512`). Đường CHÍNH (tải chênh lệch) vẫn đủ cả 3 cỡ.
 */
const LA_512 = /^emoji\/3d\/[^/]+\.webp$/;
const choZip = Object.fromEntries(Object.entries(files).filter(([ten]) => !LA_512.test(ten.split('\\').join('/'))));
const zip = zipSync(choZip, { level: 6 });
const TRAN_ZIP = 24 * 1024 * 1024;   // chừa 1MiB dưới trần 25MiB của Worker
if (zip.length > TRAN_ZIP) {
  console.error(`✗ zip OTA ${(zip.length / 1048576).toFixed(1)}MiB > 24MiB — Cloudflare Worker không phục vụ được (giới hạn 25MiB/file). Bớt thứ gì đó khỏi zip.`);
  process.exit(1);
}
const sha256 = createHash('sha256').update(zip).digest('hex');
const ra = join(web, 'dist', 'ota');
mkdirSync(join(ra, 'f'), { recursive: true });
writeFileSync(join(ra, `${id}.zip`), zip);
/*
 * Đuôi file ở `/ota/f/<sha256><đuôi>` — PHẢI KHỚP `duoiOta` trong apps/web/src/lib/ota.ts.
 * Chỉ giữ đuôi cho loại Cloudflare NÉN mà KHÔNG SỬA nội dung (js/css/json/svg…: JS 808KB →
 * ~200KB khi truyền). HTML thì KHÔNG: Cloudflare sửa HTML trên đường đi (làm rối email…) →
 * lệch sha256 → plugin bỏ cả lượt tải chênh lệch (smoke:ota bắt được 16.10.2026 ở about.html).
 * Loại khác (ảnh, font) để trống đuôi: octet-stream, trả nguyên văn.
 */
const DUOI_GIU = /\.(js|mjs|css|json|svg|webmanifest|txt|xml|map)$/i;
const duoiOta = (duong) => duong.match(DUOI_GIU)?.[0].toLowerCase() ?? '';
// Danh sách file cho tải chênh lệch: [đường dẫn trong gói, sha256 nội dung]
const ds = [];
for (const [ten, du] of Object.entries(files)) {
  const h = createHash('sha256').update(du).digest('hex');
  const duong = ten.split('\\').join('/');
  ds.push([duong, h]);
  writeFileSync(join(ra, 'f', h + duoiOta(duong)), du);
}
writeFileSync(join(ra, `${id}.files.json`), JSON.stringify(ds));
writeFileSync(join(ra, 'manifest.json'), JSON.stringify({ id, url: `/ota/${id}.zip`, sha256, files: `/ota/${id}.files.json`, minNative, builtAt: new Date().toISOString() }, null, 2));
rmSync(SRC, { recursive: true, force: true });
console.log(`✓ OTA ${id} · zip ${(zip.length / 1e6).toFixed(1)} MB (${Object.keys(choZip).length} file, bỏ ảnh 512) · chênh lệch ${Object.keys(files).length} file · cần app ≥ ${minNative}`);
