#!/usr/bin/env node
/**
 * BẢN CỔNG GAME TỰ HOST (28.11.2026, chủ dự án: "nhúng đi" — CrazyGames chế độ "Externally hosted (iframe)"): dựng bản
 * cổng cho từng cổng nhúng và chép vào `apps/web/dist/cong/<tên>/` để Worker phục vụ cùng web chính tại
 * `https://flipmatch.cozypi.com/cong/<tên>/`. Mỗi lần deploy web là cổng có bản mới ngay — không phải tải zip lên lại.
 *
 * PHẢI chạy SAU `pnpm build` (lệnh `pnpm release` gọi đúng thứ tự):
 *  · gói OTA (`tools/dong-goi-ota.mjs`) gom MỌI file trong dist — chép trước là app phải tải thêm cả bản cổng;
 *  · precache service worker dựng trong `vite build` web — chép sau thì không lọt vào precache.
 * Service worker của web chính bỏ qua `/cong/` (navigateFallbackDenylist ở vite.config.ts) — thiếu là SW trả index.html
 * của web thay cho bản cổng ở trình duyệt từng vào web.
 *
 * Nội dung chép = đúng nội dung gói zip của cổng (tools/dong-goi-fb.mjs lọc sẵn: không emoji 43 MB, không trang công khai).
 * Cổng tải zip tay (không nhúng) KHÔNG cần ở đây. Thêm cổng nhúng = thêm tên vào NHUNG.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const NHUNG = ['crazygames'];
const WEB = fileURLToPath(new URL('../apps/web/', import.meta.url));
const DIST = join(WEB, 'dist');
const { unzipSync } = createRequire(join(WEB, 'package.json'))('fflate');

if (!existsSync(join(DIST, 'index.html')) || !existsSync(join(DIST, 'sw.js'))) {
  console.error('Chưa có apps/web/dist (web chính) — chạy `pnpm build` trước.'); process.exit(1);
}
const goc = join(DIST, 'cong');
rmSync(goc, { recursive: true, force: true });
for (const ten of NHUNG) {
  execFileSync('pnpm', ['--filter', '@mm/web', 'build:cong'], { stdio: 'inherit', env: { ...process.env, VITE_CONG: ten } });
  const files = unzipSync(readFileSync(join(WEB, `lat-the-cong-${ten}.zip`)));
  const ra = join(goc, ten);
  let n = 0;
  for (const [duong, du] of Object.entries(files)) {
    if (duong.endsWith('/')) continue;
    const f = join(ra, duong);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, du); n++;
  }
  console.log(`✓ /cong/${ten}/ — ${n} file`);
}
