#!/usr/bin/env node
/**
 * THỐNG KÊ GOOGLE PLAY (chỉ đọc) — lượt cài, gỡ, thiết bị đang dùng, người xem trang
 * store, theo ngày và theo nước. Đọc "báo cáo hàng loạt" Play Console tự đổ vào
 * Cloud Storage (bucket pubsite_prod_<mã tài khoản>), không phải chụp màn hình.
 *
 *   node tools/play-thongke.mjs <service-account.json> [số ngày=28] [bucket]
 *
 * CI: .github/workflows/play-thongke.yml (secret PLAY_SERVICE_ACCOUNT_JSON).
 * Service account cần quyền "Xem thông tin ứng dụng và tải báo cáo hàng loạt xuống"
 * (Play Console → Người dùng và quyền). Thiếu quyền thì GCS trả 403.
 * Bẫy: CSV của Play là UTF-16LE có BOM; số liệu trễ 1–2 ngày; file theo THÁNG nên
 * 28 ngày có thể vắt qua 2 file.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PKG = 'com.cozypi.flipmatch';
const TAI_KHOAN = '7460338735480907891';   // mã tài khoản nhà phát triển Cozy Pi
const [keyPath, soNgayArg, bucketArg] = process.argv.slice(2);
if (!keyPath) { console.error('Cách dùng: node tools/play-thongke.mjs <service-account.json> [số ngày] [bucket]'); process.exit(2); }
const SO_NGAY = Number(soNgayArg) || 28;
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

async function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'RS256', typ: 'JWT' });
  const than = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const ky = createSign('RSA-SHA256').update(`${dau}.${than}`).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${than}.${ky}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Không lấy được token: ${JSON.stringify(j)}`);
  return j.access_token;
}
const tk = await token();

/** Tải một object; 404 → null (tháng chưa có file). */
async function tai(bucket, ten) {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(ten)}?alt=media`, { headers: { Authorization: `Bearer ${tk}` } });
  if (r.status === 404) return null;
  if (r.status === 403) throw new Error(`403 ở bucket ${bucket} — service account ${sa.client_email} chưa có quyền "tải báo cáo hàng loạt" trên Play Console (hoặc sai tên bucket).`);
  if (!r.ok) throw new Error(`GET ${bucket}/${ten} → ${r.status}\n${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const laUtf16 = buf[0] === 0xff && buf[1] === 0xfe;
  return (laUtf16 ? buf.subarray(2).toString('utf16le') : buf.toString('utf8')).replace(/^﻿/, '');
}

function docCsv(txt) {
  const dong = txt.trim().split(/\r?\n/).map((l) => l.split(',').map((o) => o.replace(/^"|"$/g, '').trim()));
  const dau = dong.shift();
  return dong.map((d) => Object.fromEntries(dau.map((k, i) => [k, d[i]])));
}

// Bucket: thường là pubsite_prod_<mã tài khoản>; tài khoản cũ có dạng pubsite_prod_rev_<số> — truyền tay.
const BUCKET = bucketArg || `pubsite_prod_${TAI_KHOAN}`;
const homNay = new Date();
const tu = new Date(homNay.getTime() - SO_NGAY * 864e5).toISOString().slice(0, 10);
const thang = [];
for (let d = new Date(tu.slice(0, 7) + '-01'); d <= homNay; d.setUTCMonth(d.getUTCMonth() + 1)) thang.push(d.toISOString().slice(0, 7).replace('-', ''));

async function gom(thuMuc, ten) {
  const hang = [];
  for (const t of thang) {
    const txt = await tai(BUCKET, `stats/${thuMuc}/${ten.replace('{T}', t)}`);
    if (txt) hang.push(...docCsv(txt));
  }
  return hang.filter((h) => (h.Date ?? '') >= tu);
}
const so = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
const cot = (h, ...ten) => { for (const k of ten) if (k in h) return so(h[k]); return 0; };

const tongQuan = await gom('installs', `installs_${PKG}_{T}_overview.csv`);
const theoNuoc = await gom('installs', `installs_${PKG}_{T}_country.csv`);
const store = await gom('store_performance', `store_performance_${PKG}_{T}_country.csv`).catch(() => []);

const out = [];
const in_ = (s = '') => { out.push(s); console.log(s); };
in_(`## Google Play — ${PKG} · ${SO_NGAY} ngày (từ ${tu}) · bucket ${BUCKET}`);
if (!tongQuan.length) { in_('\nChưa có dữ liệu (file tháng chưa có, hoặc Play chưa đổ báo cáo — tài khoản mới có thể mất vài ngày).'); }
else {
  in_('\n| Ngày | Cài (thiết bị) | Gỡ | Cài (người dùng) | Thiết bị đang có app |\n|---|--:|--:|--:|--:|');
  let cai = 0, go = 0, nd = 0;
  for (const h of tongQuan.sort((a, b) => (a.Date < b.Date ? -1 : 1))) {
    const c = cot(h, 'Daily Device Installs', 'Install events'), g = cot(h, 'Daily Device Uninstalls', 'Uninstall events'), u = cot(h, 'Daily User Installs');
    cai += c; go += g; nd += u;
    in_(`| ${h.Date} | ${c} | ${g} | ${u} | ${cot(h, 'Active Device Installs')} |`);
  }
  in_(`| **Tổng** | **${cai}** | **${go}** | **${nd}** | |`);

  const nuoc = {};
  for (const h of theoNuoc) {
    const k = h.Country || h['Country / Region'] || '?';
    nuoc[k] ??= { cai: 0, go: 0 };
    nuoc[k].cai += cot(h, 'Daily Device Installs', 'Install events');
    nuoc[k].go += cot(h, 'Daily Device Uninstalls', 'Uninstall events');
  }
  const xep = Object.entries(nuoc).filter(([, v]) => v.cai || v.go).sort((a, b) => b[1].cai - a[1].cai);
  if (xep.length) {
    in_('\n### Theo nước\n\n| Nước | Cài | Gỡ |\n|---|--:|--:|');
    for (const [k, v] of xep) in_(`| ${k} | ${v.cai} | ${v.go} |`);
  }
}
if (store.length) {
  const tong = { xem: 0, cai: 0 };
  for (const h of store) { tong.xem += cot(h, 'Store listing visitors'); tong.cai += cot(h, 'Store listing acquisitions'); }
  in_(`\n### Trang store\n\nNgười xem: **${tong.xem}** · cài từ trang: **${tong.cai}** · chuyển đổi: **${tong.xem ? ((tong.cai / tong.xem) * 100).toFixed(1) : 0}%**`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
}
