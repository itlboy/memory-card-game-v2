#!/usr/bin/env node
/**
 * TẢI HÌNH VECTOR (Twemoji, CC-BY 4.0) cho mọi emoji trong themes.json vào
 * apps/web/public/emoji/<mã>.svg. Chạy lại mỗi khi thêm/sửa theme:
 *
 *   node tools/tai-twemoji.mjs
 *
 * Vì sao: emoji trên Android là ẢNH BITMAP ~136px (Noto Color Emoji) — phóng lên
 * mặt bài 250px+ là mờ (chủ dự án báo 14.10.2026); Windows thì không có emoji cờ.
 * Máy KHÔNG phải Apple vẽ mặt bài bằng SVG này (lib/emoji.ts); iPhone/Mac giữ
 * emoji Apple. Test `emoji-vector` canh mọi emoji trong themes.json đều có file.
 *
 * Tên file = mã điểm (hex, nối "-") BỎ fe0f — đúng phép tính của lib/emoji.ts.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const GOC = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg';
const web = new URL('../apps/web/', import.meta.url).pathname;
const RA = join(web, 'public/emoji');
const themes = JSON.parse(readFileSync(join(web, 'public/data/themes.json'), 'utf8')).themes;

const ten = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');
const laEmoji = (s) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);

const can = new Map();
for (const t of themes) for (const s of t.symbols) if (laEmoji(s)) can.set(ten(s), s);

mkdirSync(RA, { recursive: true });
const co = new Set(readdirSync(RA).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
let moi = 0, loi = 0;
for (const [ma, e] of can) {
  if (co.has(ma)) continue;
  // Twemoji giữ fe0f trong tên file của chuỗi ghép ZWJ, bỏ ở emoji đơn — thử cả hai
  const raw = [...e].map((c) => c.codePointAt(0).toString(16)).join('-');
  let svg = null;
  for (const thu of [...new Set([ma, raw])]) {
    const r = await fetch(`${GOC}/${thu}.svg`);
    if (r.ok) { svg = await r.text(); break; }
  }
  if (!svg) { console.error(`✗ không có trên Twemoji: ${e} (${ma})`); loi++; continue; }
  writeFileSync(join(RA, `${ma}.svg`), svg);
  moi++;
}
// Dọn file không còn theme nào dùng
let xoa = 0;
for (const ma of co) if (!can.has(ma)) { unlinkSync(join(RA, `${ma}.svg`)); xoa++; }
writeFileSync(join(RA, 'LICENSE.txt'),
  'Emoji graphics: Twemoji by Twitter, Inc and other contributors (https://github.com/jdecked/twemoji),\n' +
  'licensed under CC-BY 4.0: https://creativecommons.org/licenses/by/4.0/\n');
console.log(`${can.size} emoji · tải mới ${moi} · xoá ${xoa} · lỗi ${loi}`);
process.exit(loi ? 1 : 0);
