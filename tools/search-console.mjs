#!/usr/bin/env node
/**
 * GOOGLE SEARCH CONSOLE QUA API — không cần giao diện web.
 *
 *   node tools/search-console.mjs token      → mã xác minh DNS TXT cho miền cozypi.com
 *   node tools/search-console.mjs xac-minh   → xác minh + thêm thuộc tính sc-domain:cozypi.com
 *                                              + thêm chủ sở hữu (OWNER_EMAIL) + nộp sitemap
 *   node tools/search-console.mjs trang-thai → thuộc tính + tình trạng từng sitemap
 *
 * Chạy trong GitHub Actions (workflow search-console.yml) bằng secret
 * PLAY_SERVICE_ACCOUNT_JSON — tài khoản dịch vụ của project CÁ NHÂN `lat-the-nkien`
 * (dùng chung với Google Play). Bản ghi TXT thêm ở Cloudflare qua API (sổ my-secrets).
 * Một THUỘC TÍNH MIỀN `cozypi.com` phủ mọi tên miền con: app mới chỉ cần thêm sitemap
 * vào SITEMAPS rồi chạy lại `xac-minh`.
 *
 * Repo CÔNG KHAI: không in khoá, không in email (OWNER_EMAIL là secret, Actions che đi).
 */
import { createSign } from 'node:crypto';

const MIEN = 'cozypi.com';
const SITE = `sc-domain:${MIEN}`;
const SITEMAPS = [
  'https://flipmatch.cozypi.com/sitemap.xml',
  'https://cozypi.com/sitemap.xml',
  'https://safe.cozypi.com/sitemap.xml' // Cozy Safe (repo cozy-pi/cozysafe, website/build.py)
];
const SA = JSON.parse(process.env.SA_JSON ?? '{}');
if (!SA.client_email) { console.error('Thiếu SA_JSON (khoá tài khoản dịch vụ)'); process.exit(2); }

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function layToken() {
  const now = Math.floor(Date.now() / 1000);
  const than = b64({
    iss: SA.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: ['https://www.googleapis.com/auth/siteverification', 'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/cloud-platform'].join(' ')
  });
  const dau = b64({ alg: 'RS256', typ: 'JWT' });
  const ky = createSign('RSA-SHA256').update(`${dau}.${than}`).sign(SA.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${than}.${ky}` })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Không lấy được token: ${JSON.stringify(j)}`);
  return j.access_token;
}
const TOKEN = await layToken();
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if (!r.ok) { const e = new Error(`${method} ${url.split('?')[0]} → ${r.status}: ${j.error?.message ?? text}`); e.status = r.status; throw e; }
  return j;
}

/** Bật hai API cho project của tài khoản dịch vụ (bỏ qua nếu thiếu quyền — báo ra để bật tay). */
async function batApi() {
  for (const s of ['siteverification.googleapis.com', 'searchconsole.googleapis.com']) {
    try {
      await api('POST', `https://serviceusage.googleapis.com/v1/projects/${SA.project_id}/services/${s}:enable`, {});
      console.log(`✓ API ${s} đã bật`);
    } catch (e) { console.log(`• Không tự bật được ${s} (${e.status}) — nếu bước sau báo SERVICE_DISABLED thì bật tay trong Google Cloud Console`); }
  }
}

const buoc = process.argv[2];
const site = { type: 'INET_DOMAIN', identifier: MIEN };

if (buoc === 'token') {
  await batApi();
  const j = await api('POST', 'https://www.googleapis.com/siteVerification/v1/token', { site, verificationMethod: 'DNS_TXT' });
  console.log(`\nThêm bản ghi DNS cho ${MIEN}:\n  Loại: TXT   Tên: @   Giá trị: ${j.token}\n`);
} else if (buoc === 'xac-minh') {
  const wr = await api('POST', 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT', { site });
  console.log(`✓ Đã xác minh ${MIEN} — chủ sở hữu: ${wr.owners.length}`);
  const email = process.env.OWNER_EMAIL;
  if (email && !wr.owners.includes(email)) {
    await api('PUT', `https://www.googleapis.com/siteVerification/v1/webResource/${encodeURIComponent(wr.id)}`, { site, owners: [...wr.owners, email] });
    console.log('✓ Đã thêm chủ sở hữu (OWNER_EMAIL)');
  }
  await api('PUT', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`);
  console.log(`✓ Thuộc tính ${SITE} đã có trong Search Console`);
  for (const sm of SITEMAPS) {
    await api('PUT', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps/${encodeURIComponent(sm)}`);
    console.log(`✓ Đã nộp ${sm}`);
  }
} else if (buoc === 'trang-thai') {
  const ds = await api('GET', 'https://www.googleapis.com/webmasters/v3/sites');
  for (const s of ds.siteEntry ?? []) console.log(`• ${s.siteUrl} — ${s.permissionLevel}`);
  const sm = await api('GET', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps`);
  for (const s of sm.sitemap ?? []) {
    const so = (s.contents ?? []).map((c) => `${c.submitted} gửi`).join(', ');
    console.log(`• ${s.path} — lần đọc cuối ${s.lastDownloaded ?? 'chưa'} · lỗi ${s.errors ?? 0} · cảnh báo ${s.warnings ?? 0}${so ? ' · ' + so : ''}`);
  }
} else if (buoc === 'luot-tim') {
  // Lượt hiện + lượt bấm từ Google Search, 28 ngày (số liệu trễ ~2 ngày), theo trang / từ khoá / nước.
  const den = new Date(); const tu = new Date(Date.now() - 28 * 864e5);
  const ngay = (d) => d.toISOString().slice(0, 10);
  for (const dim of [['page'], ['query'], ['country'], ['date']]) {
    const r = await api('POST', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
      { startDate: ngay(tu), endDate: ngay(den), dimensions: dim, rowLimit: 25 });
    console.log(`\n== theo ${dim[0]} (${ngay(tu)} → ${ngay(den)}) ==`);
    if (!r.rows?.length) console.log('  (chưa có dữ liệu)');
    for (const x of r.rows ?? []) console.log(`  ${String(x.clicks).padStart(4)} bấm · ${String(x.impressions).padStart(5)} hiện · hạng ${x.position.toFixed(1)} · ${x.keys[0]}`);
  }
} else {
  console.error('Cách dùng: node tools/search-console.mjs token | xac-minh | trang-thai | luot-tim'); process.exit(2);
}
