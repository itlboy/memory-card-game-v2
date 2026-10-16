#!/usr/bin/env node
/**
 * SMOKE CẬP NHẬT NÓNG — `pnpm smoke:ota [server]` (mặc định https://flipmatch.cozypi.com).
 * Chạy SAU MỖI LẦN DEPLOY có đụng tới OTA (lib/ota.ts, tools/dong-goi-ota.mjs, tầng phục vụ
 * /ota/ của server/Worker). App ngoài kia tải gói từ đúng server này: hỏng ở đây = máy người
 * chơi kẹt bản cũ cho tới bản store kế tiếp (CLAUDE.md "ĐỪNG LÀM HỎNG CẬP NHẬT NÓNG").
 *
 * Kiểm: manifest đủ trường bản app cũ đọc (id, url, sha256, minNative) + no-cache; zip tải
 * được và đúng sha256; danh sách file hợp lệ, có index.html; MỌI file .js/.css/.html + 40
 * file ngẫu nhiên tải được, đúng sha256, cache immutable. SKIP_ZIP=1 bỏ tải zip (~33MB).
 */
import { createHash } from 'node:crypto';

const GOC = (process.argv[2] ?? 'https://flipmatch.cozypi.com').replace(/\/$/, '');
let loi = 0;
const ket = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) loi++; };
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const lay = async (p) => {
  const r = await fetch(GOC + p + (p.includes('?') ? '&' : '?') + 'cb=' + Date.now());
  return { r, buf: Buffer.from(await r.arrayBuffer()) };
};

const { r: rm, buf: bm } = await lay('/ota/manifest.json');
ket(rm.status === 200, `manifest HTTP ${rm.status}`);
let m = {};
try { m = JSON.parse(bm.toString('utf8')); } catch { ket(false, 'manifest không phải JSON (SPA fallback trả index.html?)'); process.exit(1); }
for (const k of ['id', 'url', 'sha256', 'minNative']) ket(typeof m[k] === 'string' && m[k].length > 0, `manifest có "${k}"`);
ket(/no-cache/.test(rm.headers.get('cache-control') ?? ''), `manifest no-cache (${rm.headers.get('cache-control')})`);
console.log(`  gói ${m.id} · cần app ≥ ${m.minNative}`);

if (process.env.SKIP_ZIP) console.log('  (bỏ qua tải zip)');
else {
  const { r, buf } = await lay(m.url);
  ket(r.status === 200 && buf.length > 0, `zip HTTP ${r.status}, ${(buf.length / 1e6).toFixed(1)}MB`);
  ket(sha(buf) === m.sha256, 'zip đúng sha256 trong manifest');
}

if (!m.files) ket(false, 'manifest thiếu "files" (tải chênh lệch) — app sẽ luôn tải zip');
else {
  const { r, buf } = await lay(m.files);
  let ds = [];
  try { ds = JSON.parse(buf.toString('utf8')); } catch { /* bắt ở dưới */ }
  ket(r.status === 200 && Array.isArray(ds) && ds.length > 0, `danh sách file HTTP ${r.status}, ${ds.length} file`);
  ket(ds.every((e) => Array.isArray(e) && typeof e[0] === 'string' && /^[0-9a-f]{64}$/.test(e[1])), 'mọi dòng là [đường dẫn, sha256]');
  ket(ds.some((e) => e[0] === 'index.html'), 'có index.html');
  // cùng luật đuôi với tools/dong-goi-ota.mjs / lib/ota.ts
  const duoi = (t) => t.match(/\.(js|mjs|css|json|svg|webmanifest|txt|xml|map)$/i)?.[0].toLowerCase() ?? '';
  const chu = ds.filter((e) => /\.(js|css|html)$/.test(e[0]));
  const ngauNhien = ds.filter((e) => !chu.includes(e)).sort(() => Math.random() - 0.5).slice(0, 40);
  let sai = 0, hdSai = 0;
  for (const [ten, h] of [...chu, ...ngauNhien]) {
    const { r: rf, buf: bf } = await lay(`/ota/f/${h}${duoi(ten)}`);
    if (rf.status !== 200 || sha(bf) !== h) { sai++; if (sai <= 5) console.log(`    ✗ ${ten} → HTTP ${rf.status}`); }
    if (!/immutable/.test(rf.headers.get('cache-control') ?? '')) hdSai++;
  }
  ket(sai === 0, `${chu.length + ngauNhien.length} file mẫu (mọi js/css/html + 40 ngẫu nhiên) tải được, đúng sha256`);
  ket(hdSai === 0, 'file theo mã băm cache immutable');
}

console.log(loi ? `\n✗ ${loi} lỗi — app KHÔNG cập nhật được từ ${GOC}` : `\n✓ cập nhật nóng ở ${GOC} chạy được`);
process.exit(loi ? 1 : 0);
