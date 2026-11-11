#!/usr/bin/env node
/**
 * THỐNG KÊ TẢI APP (chỉ đọc) — gọi API Apple + Google ngay trên máy, ghi daily.json · breakdown.json · status.json
 * cho dashboard "Lượt tải Lật Thẻ". Chạy trên máy hoặc qua .github/workflows/thongke-tai.yml — CI MÃ HOÁ
 * kết quả bằng age trước khi lưu (repo công khai: log/artifact ai cũng đọc được, nên KHÔNG in số ra log).
 *
 *   node thong-ke.mjs --out-dir <thư mục> [--ios-app com.hello314.flipmatch] [--android-pkg com.cozypi.flipmatch]
 *
 * Biến môi trường (nạp bằng my-secrets, không truyền khoá qua dòng lệnh):
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH [, ASC_VENDOR_NUMBER]   ← secrets run app-store-connect
 *   PLAY_SA_JSON [, PLAY_DEVELOPER_ID]                              ← secrets run google-play
 * Thiếu bộ nào thì bỏ store đó, ghi lý do vào data.json (không chết cả lượt).
 *
 * Nguồn iOS (lấy cái nào có):
 *   1. Analytics Reports API — đủ nhất (nguồn tải, lượt hiển thị, xem trang, xoá app).
 *      Cần key vai trò Admin để TẠO yêu cầu báo cáo một lần; Apple sinh dữ liệu sau 1–2 ngày.
 *   2. Sales and Trends (cần ASC_VENDOR_NUMBER) — tải mới/tải lại/cập nhật theo ngày,
 *      thiết bị, nước; có cả lịch sử từ ngày phát hành.
 * Nguồn Android: báo cáo hàng loạt Play tự đổ vào gs://pubsite_prod_<mã tài khoản>
 *   (CSV UTF-16LE có BOM, file theo tháng, trễ 1–2 ngày).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, createSign, sign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out-dir');
if (!OUT) { console.error('Cách dùng: node thong-ke.mjs --out-dir <thư mục>'); process.exit(2); }
const IOS_BUNDLE = arg('ios-app', 'com.hello314.flipmatch');
const ANDROID_PKG = arg('android-pkg', 'com.cozypi.flipmatch');
const DEV_ID = process.env.PLAY_DEVELOPER_ID || '7460338735480907891';

const log = (...a) => console.error(...a);
const cong = (o, k, v) => { if (!v) return; o[k || '?'] = (o[k || '?'] ?? 0) + v; };
const so = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
function docBang(txt, tach) {
  const dong = txt.replace(/^﻿/, '').trim().split(/\r?\n/).filter(Boolean)
    .map((l) => l.split(tach).map((o) => o.replace(/^"|"$/g, '').trim()));
  const dau = dong.shift() ?? [];
  return dong.map((d) => Object.fromEntries(dau.map((k, i) => [k, d[i] ?? ''])));
}
function theoNgay(map, ngay) { return (map[ngay] ??= {}); }
const sapNgay = (m) => Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, v]) => ({ date, ...v }));

// ───────────────────────────── iOS ─────────────────────────────
async function ios() {
  const { ASC_KEY_ID: kid, ASC_ISSUER_ID: iss, ASC_KEY_PATH: p8, ASC_VENDOR_NUMBER: vendor } = process.env;
  if (!kid || !iss || !p8) return { loi: 'Chưa có khoá App Store Connect trong my-secrets (secrets init app-store-connect).' };
  const khoa = createPrivateKey(readFileSync(p8));
  const jwt = () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const h = b64({ alg: 'ES256', kid, typ: 'JWT' }), p = b64({ iss, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
    return `${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), { key: khoa, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  const goi = async (path, init = {}) => {
    const r = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`,
      { ...init, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    return r;
  };
  const json = async (path) => { const r = await goi(path); if (!r.ok) throw new Error(`${path} → ${r.status} ${(await r.text()).slice(0, 200)}`); return r.json(); };

  const app = (await json(`/v1/apps?filter[bundleId]=${IOS_BUNDLE}`)).data?.[0];
  if (!app) return { loi: `Không thấy app ${IOS_BUNDLE} (key không có quyền app này?)` };
  const kq = { appId: app.id, ten: app.attributes.name, nguon: [], ghiChu: [] };

  // 1) Analytics Reports API
  let an = null;
  try { an = await iosAnalytics(app.id, goi, json, kq); } catch (e) { kq.ghiChu.push(`Analytics: ${e.message}`); }
  // 2) Sales and Trends
  let sales = null;
  if (vendor) { try { sales = await iosSales(app.id, vendor, goi); } catch (e) { kq.ghiChu.push(`Sales: ${e.message}`); } }
  else kq.ghiChu.push('Chưa có vendor_number → bỏ báo cáo Sales (lịch sử từ ngày phát hành).');

  // Gộp: Sales cho số tải (có lịch sử), Analytics bổ sung hiển thị/xem trang/xoá/nguồn.
  const ngay = {};
  if (sales) { kq.nguon.push('sales'); for (const d of sales.daily) Object.assign(theoNgay(ngay, d.date), d, { date: undefined }); }
  if (an) {
    kq.nguon.push('analytics');
    for (const d of an.daily) {
      const o = theoNgay(ngay, d.date);
      for (const [k, v] of Object.entries(d)) if (k !== 'date' && (o[k] === undefined || !sales || !['taiMoi', 'taiLai'].includes(k))) o[k] = v;
    }
  }
  for (const o of Object.values(ngay)) delete o.date;
  kq.daily = sapNgay(ngay);
  const chon = (k) => (sales?.[k] && Object.keys(sales[k]).length ? sales[k] : an?.[k]) ?? {};
  kq.theoThietBi = chon('theoThietBi');
  kq.theoNuoc = chon('theoNuoc');
  kq.theoNguon = an?.theoNguon ?? {};
  kq.theoPhienBan = chon('theoPhienBan');
  return kq;
}

async function iosAnalytics(appId, goi, json, kq) {
  let req = (await json(`/v1/apps/${appId}/analyticsReportRequests?filter[accessType]=ONGOING`)).data?.[0];
  if (!req) {
    const r = await goi('/v1/analyticsReportRequests', { method: 'POST', body: JSON.stringify({ data: {
      type: 'analyticsReportRequests', attributes: { accessType: 'ONGOING' },
      relationships: { app: { data: { type: 'apps', id: appId } } } } }) });
    if (r.status === 403) throw new Error('key không phải Admin nên không tạo được yêu cầu báo cáo — nhờ Admin tạo một lần, hoặc dùng key Admin.');
    if (!r.ok) throw new Error(`tạo yêu cầu báo cáo → ${r.status} ${(await r.text()).slice(0, 200)}`);
    kq.ghiChu.push('Vừa tạo yêu cầu báo cáo Analytics — Apple sinh dữ liệu sau 1–2 ngày, chạy lại sau.');
    return null;
  }
  const bao = (await json(`/v1/analyticsReportRequests/${req.id}/reports?limit=200`)).data ?? [];
  const tim = (ten) => bao.find((b) => b.attributes.name === ten);
  async function tai(ten) {
    const b = tim(ten);
    if (!b) return [];
    const inst = [];
    let url = `/v1/analyticsReports/${b.id}/instances?filter[granularity]=DAILY&limit=200`;
    while (url) { const j = await json(url); inst.push(...(j.data ?? [])); url = j.links?.next; }
    const hang = [];
    for (const i of inst) {
      const segs = (await json(`/v1/analyticsReportInstances/${i.id}/segments`)).data ?? [];
      for (const s of segs) {
        const r = await fetch(s.attributes.url);
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        const txt = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8');
        hang.push(...docBang(txt, '\t'));
      }
    }
    return hang;
  }
  const tai_ = await tai('App Downloads Standard');
  const kham = await tai('App Store Discovery and Engagement Standard');
  const caiXoa = await tai('App Store Installation and Deletion Standard');
  if (!tai_.length && !kham.length && !caiXoa.length) { kq.ghiChu.push('Analytics: yêu cầu đã có nhưng Apple chưa sinh dữ liệu (chờ 1–2 ngày).'); return null; }

  const ngay = {}, theoThietBi = {}, theoNuoc = {}, theoNguon = {}, theoPhienBan = {};
  for (const h of tai_) {
    const n = so(h.Counts), o = theoNgay(ngay, h.Date), loai = (h['Download Type'] || '').toLowerCase();
    if (loai.startsWith('first')) {
      o.taiMoi = (o.taiMoi ?? 0) + n;
      cong(theoThietBi, h.Device, n); cong(theoNuoc, h.Territory, n); cong(theoNguon, h['Source Type'], n);
      cong(theoPhienBan, h['Platform Version'], n);
    } else if (loai.startsWith('redownload')) o.taiLai = (o.taiLai ?? 0) + n;
  }
  for (const h of kham) {
    const o = theoNgay(ngay, h.Date), ev = (h.Event || '').toLowerCase(), n = so(h['Unique Counts'] || h.Counts);
    if (ev === 'impression') o.hienThi = (o.hienThi ?? 0) + n;
    else if (ev === 'page view') o.xemTrang = (o.xemTrang ?? 0) + n;
  }
  for (const h of caiXoa) {
    const o = theoNgay(ngay, h.Date), ev = (h.Event || '').toLowerCase(), n = so(h.Counts);
    if (ev === 'install') o.cai = (o.cai ?? 0) + n;
    else if (ev === 'delete') o.xoa = (o.xoa ?? 0) + n;
  }
  return { daily: sapNgay(ngay), theoThietBi, theoNuoc, theoNguon, theoPhienBan };
}

async function iosSales(appId, vendor, goi) {
  const ngay = {}, theoThietBi = {}, theoNuoc = {}, theoPhienBan = {};
  // Sales giữ báo cáo ngày ~1 năm; đi lùi tới khi gặp 30 ngày trống liền sau khi đã có dữ liệu.
  let trong = 0, daCo = false;
  for (let i = 1; i <= 365; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    let hang = null;
    for (const ver of ['1_1', '1_0']) {
      const q = new URLSearchParams({ 'filter[frequency]': 'DAILY', 'filter[reportType]': 'SALES', 'filter[reportSubType]': 'SUMMARY',
        'filter[vendorNumber]': vendor, 'filter[reportDate]': d, 'filter[version]': ver });
      const r = await goi(`/v1/salesReports?${q}`, { headers: { Accept: 'application/a-gzip' } });
      if (r.status === 404) { hang = []; break; }
      if (r.status === 403) throw new Error('403 — key cần vai trò Admin/Finance/Sales, hoặc sai Vendor Number.');
      if (r.status === 400 && ver === '1_1') continue;
      if (!r.ok) throw new Error(`salesReports ${d} → ${r.status} ${(await r.text()).slice(0, 200)}`);
      hang = docBang(gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8'), '\t');
      break;
    }
    hang = (hang ?? []).filter((h) => h['Apple Identifier'] === appId);
    if (!hang.length) { if (daCo && ++trong >= 30) break; continue; }
    daCo = true; trong = 0;
    const o = theoNgay(ngay, d);
    for (const h of hang) {
      const t = h['Product Type Identifier'] || '', n = so(h.Units);
      if (/^1/.test(t)) {
        o.taiMoi = (o.taiMoi ?? 0) + n;
        cong(theoThietBi, h.Device, n); cong(theoNuoc, h['Country Code'], n); cong(theoPhienBan, h.Version, n);
      } else if (/^3/.test(t)) o.taiLai = (o.taiLai ?? 0) + n;
      else if (/^7/.test(t)) o.capNhat = (o.capNhat ?? 0) + n;
    }
  }
  return { daily: sapNgay(ngay), theoThietBi, theoNuoc, theoPhienBan };
}

// ─────────────────────────── Android ───────────────────────────
async function android() {
  const saPath = process.env.PLAY_SA_JSON;
  if (!saPath) return { loi: 'Chưa có khoá Google Play trong my-secrets (secrets init google-play).' };
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', typ: 'JWT' });
  const p = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const ky = createSign('RSA-SHA256').update(`${h}.${p}`).sign(sa.private_key).toString('base64url');
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${p}.${ky}` }) })).json();
  if (!t.access_token) return { loi: `Google không cấp token: ${t.error_description || t.error}` };
  const auth = { Authorization: `Bearer ${t.access_token}` };
  const bucket = `pubsite_prod_${DEV_ID}`;

  async function liet(prefix) {
    const ten = []; let page = '';
    do {
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}${page ? `&pageToken=${page}` : ''}`, { headers: auth });
      if (r.status === 403) throw new Error(`403 ở ${bucket} — service account chưa có quyền "tải báo cáo hàng loạt" trên Play Console.`);
      const j = await r.json(); ten.push(...(j.items ?? []).map((i) => i.name)); page = j.nextPageToken;
    } while (page);
    return ten;
  }
  async function doc(ten) {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(ten)}?alt=media`, { headers: auth });
    if (!r.ok) return [];
    const buf = Buffer.from(await r.arrayBuffer());
    return docBang(buf[0] === 0xff && buf[1] === 0xfe ? buf.subarray(2).toString('utf16le') : buf.toString('utf8'), ',');
  }
  async function gom(thuMuc, duoi) {
    const ten = (await liet(`stats/${thuMuc}/${thuMuc}_${ANDROID_PKG}_`)).filter((n) => n.endsWith(`_${duoi}.csv`));
    return (await Promise.all(ten.map(doc))).flat();
  }
  const cot = (h, ...k) => { for (const x of k) if (x in h) return so(h[x]); return 0; };
  const CAI = ['Daily Device Installs', 'Install events'], GO = ['Daily Device Uninstalls', 'Uninstall events'];
  const nhom = (rows, khoa) => { const o = {}; for (const r of rows) cong(o, khoa.map((k) => r[k]).find(Boolean), cot(r, ...CAI)); return o; };

  const [tq, tb, nuoc, os, ver, store, kenh] = await Promise.all([
    gom('installs', 'overview'), gom('installs', 'device'), gom('installs', 'country'),
    gom('installs', 'os_version'), gom('installs', 'app_version'),
    gom('store_performance', 'country').catch(() => []), gom('store_performance', 'traffic_source').catch(() => []),
  ]);
  const ngay = {};
  for (const r of tq) {
    const o = theoNgay(ngay, r.Date);
    o.cai = (o.cai ?? 0) + cot(r, ...CAI); o.go = (o.go ?? 0) + cot(r, ...GO);
    o.nguoiDung = (o.nguoiDung ?? 0) + cot(r, 'Daily User Installs');
    o.capNhat = (o.capNhat ?? 0) + cot(r, 'Daily Device Upgrades', 'Update events');
    o.dangCo = cot(r, 'Active Device Installs');
  }
  for (const r of store) { const o = theoNgay(ngay, r.Date); o.xemTrang = (o.xemTrang ?? 0) + cot(r, 'Store listing visitors'); o.caiTuTrang = (o.caiTuTrang ?? 0) + cot(r, 'Store listing acquisitions'); }
  const theoNguon = {};
  for (const r of kenh) cong(theoNguon, r['Traffic source'] || r['Traffic Source'], cot(r, 'Store listing acquisitions'));
  return {
    pkg: ANDROID_PKG, nguon: ['play-bulk-reports'], ghiChu: ['Số Play trễ 1–2 ngày.'],
    daily: sapNgay(ngay),
    theoThietBi: nhom(tb, ['Device']), theoNuoc: nhom(nuoc, ['Country', 'Country / Region']),
    theoPhienBan: nhom(os, ['Android OS Version']), theoBanApp: nhom(ver, ['App Version Code']), theoNguon,
  };
}

// ─────────────── Xuất bảng dòng cho dashboard (3 file JSON) ───────────────
const bat = (p) => p.catch((e) => ({ loi: e.message }));
const [i, a] = await Promise.all([bat(ios()), bat(android())]);
const CONG_KHAI = { Android: '2026-11-03', iOS: '2026-11-07' };
const v = (x) => (x === undefined ? null : x);
const daily = [], breakdown = [], status = [];
for (const [store, s] of [['Android', a], ['iOS', i]]) {
  for (const d of s.daily ?? []) {
    daily.push({
      store, date: d.date,
      installs: v(store === 'iOS' ? d.taiMoi : d.cai), uninstalls: v(store === 'iOS' ? d.xoa : d.go),
      redownloads: v(d.taiLai), updates: v(d.capNhat), active: v(d.dangCo),
      impressions: v(d.hienThi), page_views: v(d.xemTrang),
    });
  }
  const chieu = { device: s.theoThietBi, country: s.theoNuoc, source: s.theoNguon, os: s.theoPhienBan, app_version: s.theoBanApp };
  for (const [dimension, o] of Object.entries(chieu)) for (const [value, installs] of Object.entries(o ?? {})) breakdown.push({ store, dimension, value, installs });
  const ngay = (s.daily ?? []).map((d) => d.date);
  status.push({
    store, public_since: CONG_KHAI[store], first_date: ngay[0] ?? null, last_date: ngay.at(-1) ?? null,
    sources: (s.nguon ?? []).join('+') || null, note: [s.loi, ...(s.ghiChu ?? [])].filter(Boolean).join(' ') || null, ok: !s.loi,
  });
}
const { mkdirSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });
for (const [ten, rows] of [['daily', daily], ['breakdown', breakdown], ['status', status]]) writeFileSync(`${OUT}/${ten}.json`, JSON.stringify(rows));
log(`✓ ghi ${OUT}/{daily,breakdown,status}.json — ${daily.length} dòng ngày, ${breakdown.length} dòng phân nhóm`);
for (const [k, v] of [['iOS', i], ['Android', a]]) log(`  ${k}: ${v.loi ? `✗ ${v.loi}` : `${v.daily.length} ngày · nguồn ${v.nguon.join('+')}`}${v.ghiChu?.length ? `\n    ${v.ghiChu.join('\n    ')}` : ''}`);
