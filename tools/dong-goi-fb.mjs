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

/**
 * KHUNG THU NHỎ cho bản cổng (28.11.2026, chủ dự án chọn "thu nhỏ cả game theo chiều cao khung"): cổng game nhúng ở khung
 * NGANG THẤP (CrazyGames 800×450, 821×462…) mà game thiết kế cho màn dọc cao ≥ CAO_THIET_KE. Thay vì sửa CSS từng màn
 * (vh, lớp phủ fixed, Teleport ra body — thu bằng transform trên #app là vỡ), `index.html` của gói là một TRANG VỎ mang
 * game trong iframe con (`game.html`): iframe con luôn cao ≥ CAO_THIET_KE px CSS rồi được `transform: scale` cho vừa
 * khung thật. Trong iframe con mọi thứ (vh, fixed, media query) thấy đúng một màn cao như điện thoại → không sửa gì ở
 * game. Khung đủ cao (toàn màn hình, điện thoại dọc) thì tỉ lệ = 1, y như bản web. Chạy lại nhiều lần không sao.
 */
const CAO_THIET_KE = 640;
function dungKhungCong() {
  const goc = join(GOC, 'index.html'), game = join(GOC, 'game.html');
  const dangLaVo = readFileSync(goc, 'utf8').includes('id="khung-cong"');
  if (!dangLaVo) writeFileSync(game, readFileSync(goc));          // lần build mới: index.html của vite → game.html
  writeFileSync(goc, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Flip Match</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#0c0e1c}#khung-cong{position:absolute;left:0;top:0;border:0;transform-origin:0 0}</style>
</head>
<body>
<iframe id="khung-cong" title="Flip Match" allow="autoplay; clipboard-write; fullscreen"></iframe>
<script src="./khung-cong.js"></script>
</body>
</html>
`);
  writeFileSync(join(GOC, 'khung-cong.js'), `(function () {
  var CAO = ${CAO_THIET_KE}, k = document.getElementById('khung-cong');
  function xep() {
    var w = window.innerWidth, h = window.innerHeight, tl = Math.min(1, h / CAO);
    k.style.width = Math.ceil(w / tl) + 'px'; k.style.height = Math.ceil(h / tl) + 'px';
    k.style.transform = tl < 1 ? 'scale(' + tl + ')' : '';
  }
  xep(); window.addEventListener('resize', xep);
  k.src = './game.html' + location.search + location.hash;
  window.addEventListener('focus', function () { try { k.contentWindow.focus(); } catch (e) {} });
})();
`);
}
if (CONG) dungKhungCong();

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
const html = files[CONG ? 'game.html' : 'index.html'].toString('utf8');
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
