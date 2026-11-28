#!/usr/bin/env node
/**
 * ĐÓNG GÓI BẢN FACEBOOK INSTANT GAMES — chạy SAU `vite build` với `VITE_NEN=facebook`
 * (lệnh gộp: `pnpm --filter @mm/web build:fb`). Đọc `apps/web/dist-fb`, ghi `apps/web/lat-the-fb.zip`.
 *
 * Meta yêu cầu (tài liệu bundle-configuration + upload-bundle):
 *  · zip có `index.html` và `fbapp-config.json` NGAY Ở GỐC (không bọc trong thư mục);
 *  · gói đầu nên dưới 5 MB — nên BỎ khỏi zip mọi thứ game không cần lúc chạy trong Facebook:
 *    `emoji/` (43 MB, tải từ tên miền web — lib/nen-fb.ts `tn()`), trang công khai, ảnh og, file SEO.
 *
 * KHÔNG đụng `dist` (bản web đang deploy) hay `dist-ota`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// fflate cài ở apps/web (devDependency) — nạp từ đó, không từ gốc repo
const { zipSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('fflate');

/**
 * `node tools/dong-goi-fb.mjs cong` = gói BẢN CỔNG GAME WEB (28.11.2026, `pnpm build:cong`, docs/ban-cong.md): đọc `dist-cong`,
 * ghi `lat-the-cong-<VITE_CONG>.zip`, KHÔNG có fbapp-config/SDK. Cùng danh sách bỏ (emoji tải từ tên miền web).
 */
const CONG = process.argv[2] === 'cong';
const TEN_CONG = (process.env.VITE_CONG ?? '').replace(/[^a-z0-9-]/g, '') || 'khac';
const GOC = fileURLToPath(new URL(CONG ? '../apps/web/dist-cong' : '../apps/web/dist-fb', import.meta.url));
const ZIP = fileURLToPath(new URL(CONG ? `../apps/web/lat-the-cong-${TEN_CONG}.zip` : '../apps/web/lat-the-fb.zip', import.meta.url));

/** Cấu hình Meta đọc ở gốc zip. Giá trị PHẢI viết hoa ("portrait" bị từ chối). */
const CAU_HINH = {
  instant_games: {
    platform_version: 'RICH_GAMEPLAY',
    navigation_menu_version: 'NAV_FLOATING',
    orientation: 'PORTRAIT'
  }
};

/** Bỏ khỏi zip: thư mục (so theo phần đầu đường dẫn) và file ở gốc. */
const BO_THU_MUC = ['emoji', 'site', 'ota', '.well-known'];
const BO_FILE = /^(about|changes|privacy|support)\.html$|^og[-.].*|^sitemap\.xml$|^robots\.txt$|^llms\.txt$|^credits\.txt$|^_headers$|^[0-9a-f]{32}\.txt$|\.map$/;

if (!existsSync(join(GOC, 'index.html'))) {
  console.error(`Không thấy ${join(GOC, 'index.html')} — chạy vite build với VITE_NEN=facebook trước.`);
  process.exit(1);
}

function* duyet(thuMuc) {
  for (const ten of readdirSync(thuMuc)) {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) yield* duyet(duong); else yield duong;
  }
}

const files = {};
let tong = 0;
for (const duong of duyet(GOC)) {
  const ten = relative(GOC, duong).split(sep).join('/');
  const dau = ten.split('/')[0];
  if (BO_THU_MUC.includes(dau)) continue;
  // Trang chơi dựng sẵn theo ngôn ngữ (`vi/index.html`…) chỉ có ở build web; phòng khi lọt vào
  if (/^[a-z]{2}(-[A-Z]{2})?\//.test(ten)) continue;
  if (!ten.includes('/') && BO_FILE.test(ten)) continue;
  const du = readFileSync(duong);
  files[ten] = du;
  tong += du.length;
}
if (!CONG) files['fbapp-config.json'] = Buffer.from(JSON.stringify(CAU_HINH, null, 2));

// Kiểm ngay tại đây thứ Meta sẽ từ chối, thay vì đợi tải lên mới biết
const html = files['index.html'].toString('utf8');
const loi = [];
if (!CONG && !html.includes('connect.facebook.net/en_US/fbinstant.')) loi.push('index.html thiếu thẻ SDK fbinstant');
if (CONG && /fbinstant|apple-itunes-app|apps\.apple\.com|play\.google\.com/.test(html)) loi.push('index.html bản cổng còn SDK Facebook / thẻ cài app');
if (/(src|href)="\/(?!\/)/.test(html)) loi.push('index.html còn đường dẫn tuyệt đối (src="/…" hoặc href="/…")');
if (!CONG && html.indexOf('fbinstant.') > html.indexOf('type="module"')) loi.push('SDK phải nằm TRƯỚC script game');
if (loi.length) { console.error('Gói KHÔNG hợp lệ:\n - ' + loi.join('\n - ')); process.exit(1); }

const zip = zipSync(files, { level: 9 });
writeFileSync(ZIP, zip);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`Gói ${CONG ? 'cổng ' + TEN_CONG : 'Facebook'}: ${Object.keys(files).length} file, ${mb(tong)} chưa nén → ${mb(zip.length)} (${ZIP})`);
if (!CONG && zip.length > 5 * 1048576) console.warn('CẢNH BÁO: zip trên 5 MB — Meta khuyến nghị gói đầu dưới 5 MB.');
if (CONG && Object.keys(files).length > 1500) { console.error('Quá 1500 file — CrazyGames từ chối.'); process.exit(1); }
if (CONG && tong > 20 * 1048576) console.warn('CẢNH BÁO: trên 20 MB — CrazyGames không đưa lên trang chủ di động (trần cứng 50 MB).');
