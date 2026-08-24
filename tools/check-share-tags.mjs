/**
 * Kiểm thẻ chia sẻ trên bản ĐÃ DEPLOY.
 *
 * Vì sao cần dù đã có unit test: test chỉ biết index.html dùng biến chứ không
 * biết giá trị của biến có còn sống hay không. Đã dính lỗi thật — đổi tên miền,
 * thẻ og vẫn trỏ tên miền cũ, tên miền cũ trả 530, mọi link chia sẻ mất ảnh mà
 * KHÔNG có gì báo vì trang vẫn chạy tốt. Chỉ có gọi thật mới phát hiện.
 *
 *   node tools/check-share-tags.mjs                 # kiểm VITE_SITE_URL trong .env
 *   node tools/check-share-tags.mjs https://... # kiểm địa chỉ chỉ định
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(here, '../apps/web/.env'), 'utf8');
const envVal = (k) => (new RegExp(`^${k}=(.+)$`, 'm').exec(env)?.[1] ?? '').trim();

const site = (process.argv[2] ?? envVal('VITE_SITE_URL')).replace(/\/$/, '');
if (!site) { console.error('✗ Không biết kiểm địa chỉ nào: thiếu VITE_SITE_URL'); process.exit(1); }

const loi = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const xau = (m) => { loi.push(m); console.log(`  ✗ ${m}`); };

console.log(`Kiểm thẻ chia sẻ trên ${site}`);

let html = '';
try {
  const res = await fetch(site, { redirect: 'follow' });
  if (!res.ok) { xau(`trang chính trả ${res.status}`); }
  else ok(`trang chính 200`);
  html = await res.text();
} catch (e) {
  xau(`không gọi được trang chính: ${e.message}`);
}

const tag = (name) => {
  const attr = name.startsWith('og:') ? 'property' : 'name';
  return new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1] ?? null;
};

for (const name of ['og:url', 'og:image', 'twitter:image', 'og:title', 'og:description']) {
  const v = tag(name);
  if (!v) { xau(`thiếu thẻ ${name}`); continue; }
  if (v.includes('%VITE_')) { xau(`${name} còn nguyên placeholder: ${v}` ); continue; }
  ok(`${name} = ${v}`);
}

// og:url phải TRỎ VỀ CHÍNH trang đang kiểm — sai thì người bấm link đi sang
// origin khác và mất sạch điểm đang lưu trong localStorage
const ogUrl = tag('og:url');
if (ogUrl) {
  const a = new URL(ogUrl).host;
  const b = new URL(site).host;
  if (a !== b) xau(`og:url trỏ "${a}" mà trang đang ở "${b}" — link chia sẻ sẽ đưa người chơi sang origin khác`);
  else ok('og:url trỏ về đúng trang này');
}

// Ảnh phải tải được THẬT
for (const name of ['og:image', 'twitter:image']) {
  const url = tag(name);
  if (!url || url.includes('%VITE_')) continue;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const kieu = r.headers.get('content-type') ?? '';
    if (!r.ok) xau(`${name} trả ${r.status}: ${url}`);
    else if (!kieu.startsWith('image/')) xau(`${name} không phải ảnh (${kieu}): ${url}`);
    else ok(`${name} tải được, ${kieu}`);
  } catch (e) {
    xau(`${name} không gọi được (${e.message}): ${url}`);
  }
}

console.log(loi.length ? `\n✗ ${loi.length} vấn đề` : '\n✓ Thẻ chia sẻ ổn');
process.exit(loi.length ? 1 : 0);
