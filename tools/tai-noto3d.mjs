#!/usr/bin/env node
/**
 * TẢI NOTO 3D (Google, OFL 1.1) cho mọi emoji trong themes.json vào
 * apps/web/public/emoji/3d/<mã>.webp. Chạy lại mỗi khi thêm/sửa theme:
 *
 *   node tools/tai-noto3d.mjs
 *
 * Vì sao: chủ dự án chốt 15.10.2026 — máy KHÔNG phải Apple vẽ mặt bài bằng Noto 3D
 * (khối nổi, gần emoji Apple nhất). Gốc là PNG 512px ~250 KB; nén WebP GIỮ 512px
 * còn ~18 KB. ĐỪNG thu về 256: lá to nhất (quạt lá trang chủ, bàn 4 thẻ) vẽ hình
 * ~130px CSS × DPR 2,75–3 ≈ 360–390px — 256 là mờ. Emoji Noto 3D chưa có là LỖI (thoát mã 1):
 * không còn bộ dự phòng (Twemoji đã gỡ 15.10.2026) — chọn emoji khác cho theme.
 * Cần `cwebp` (brew install webp).
 *
 * Tên file = mã điểm (hex, nối "-") BỎ fe0f — đúng phép tính của lib/emoji.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GOC = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/3D/png/512';
const web = new URL('../apps/web/', import.meta.url).pathname;
const RA = join(web, 'public/emoji/3d');
const themes = JSON.parse(readFileSync(join(web, 'public/data/themes.json'), 'utf8')).themes;

const ten = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');
const laEmoji = (s) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);

const can = new Map();
for (const t of themes) for (const s of t.symbols) if (laEmoji(s)) can.set(ten(s), s);
// Icon GIAO DIỆN (ô trang chủ skin Kẹo — MenuScreen `ICO3D`), không thuộc theme nào. Thiếu dòng
// này là bước dọn file thừa xoá mất chúng.
for (const s of ['⭐', '🚀', '🌍', '📱', '👆', '👇']) can.set(ten(s), s);   // + hộp cài lên màn hình chính (CaiAppDialog)

mkdirSync(RA, { recursive: true });
const tam = join(tmpdir(), `noto3d-${process.pid}.png`);
const thieu = [];
let moi = 0;
// Ba cỡ: 512 gốc + hai cỡ nhỏ cho lá nhỏ (lib/emoji.ts `CO_ANH_3D` — đổi là đổi cả hai)
const CO_NHO = [128, 256];
for (const co of CO_NHO) mkdirSync(join(RA, String(co)), { recursive: true });
const du = (ma) => [join(RA, `${ma}.webp`), ...CO_NHO.map((co) => join(RA, String(co), `${ma}.webp`))].every(existsSync);
const viec = [...can].filter(([ma]) => !du(ma));
async function tai([ma, e]) {
  // Noto bỏ fe0f trong tên file; vài chuỗi vẫn giữ — thử cả hai
  const raw = [...e].map((c) => c.codePointAt(0).toString(16)).join('_');
  for (const thu of [...new Set([ma.replaceAll('-', '_'), raw])]) {
    const r = await fetch(`${GOC}/emoji_u${thu}.png`);
    if (!r.ok) continue;
    const f = `${tam}-${ma}`;
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    execFileSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', f, '-o', join(RA, `${ma}.webp`)]);
    for (const co of CO_NHO) execFileSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', '-resize', String(co), '0', f, '-o', join(RA, String(co), `${ma}.webp`)]);
    unlinkSync(f);
    moi++;
    return;
  }
  thieu.push(ma);
  console.error(`✗ Noto 3D chưa có: ${e} (${ma}) — chọn emoji khác`);
}
for (let i = 0; i < viec.length; i += 12) await Promise.all(viec.slice(i, i + 12).map(tai));

let xoa = 0;
for (const thu of [RA, ...CO_NHO.map((co) => join(RA, String(co)))])
  for (const f of readdirSync(thu).filter((f) => f.endsWith('.webp'))) if (!can.has(f.slice(0, -5))) { unlinkSync(join(thu, f)); xoa++; }
writeFileSync(join(RA, 'LICENSE.txt'),
  'Emoji graphics: Noto Emoji 3D by Google (https://github.com/googlefonts/noto-emoji),\n' +
  'licensed under the SIL Open Font License 1.1: https://openfontlicense.org\n');
console.log(`${can.size} emoji · tải mới ${moi} · thiếu ${thieu.length} · xoá ${xoa}`);
process.exit(thieu.length ? 1 : 0);
