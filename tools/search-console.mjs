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
      'https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/analytics.readonly'].join(' ')
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
} else if (buoc === 'chi-muc') {
  // Google đã lập chỉ mục trang nào (URL Inspection API): trang chơi theo ngôn ngữ + trang giới thiệu.
  const HOST = 'https://flipmatch.cozypi.com';
  const ds = ['/', '/en/', '/es/', '/pt/', '/fr/', '/de/', '/ja/', '/ko/', '/zh/', '/ru/', '/id/', '/th/', '/it/', '/tr/', '/zh-TW/',
    '/about', '/vi/about', '/es/about', '/ja/about'].map((p) => HOST + p);
  ds.push('https://cozypi.com/');
  for (const u of ds) {
    try {
      const r = await api('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: u, siteUrl: SITE });
      const x = r.inspectionResult?.indexStatusResult ?? {};
      console.log(`  ${(x.verdict ?? '?').padEnd(8)} ${String(x.coverageState ?? '').slice(0, 42).padEnd(42)} lần bò: ${x.lastCrawlTime?.slice(0, 10) ?? '—'} · ${u}`);
    } catch (e) { console.log(`  LỖI ${u}: ${e.message.slice(0, 120)}`); }
  }
} else if (buoc === 'ga') {
  // GA4 (thuộc tính "Flip Match"): người dùng NGOÀI Việt Nam, 14 ngày — thời gian tương tác, nguồn, số ván.
  // Tài khoản dịch vụ phải được thêm làm Viewer ở GA (Admin → Property access management).
  for (const s of ['analyticsdata.googleapis.com', 'analyticsadmin.googleapis.com']) {
    try { await api('POST', `https://serviceusage.googleapis.com/v1/projects/${SA.project_id}/services/${s}:enable`, {}); }
    catch (e) { console.log(`• Không tự bật được ${s} (${e.status})`); }
  }
  const tk = await api('GET', 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  const ts = (tk.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? []);
  if (!ts.length) { console.log(`Tài khoản dịch vụ ${SA.client_email} chưa thấy thuộc tính GA nào — thêm nó làm Viewer trong GA.`); process.exit(1); }
  const khongVN = { notExpression: { filter: { fieldName: 'country', stringFilter: { value: 'Vietnam' } } } };
  const bao = (prop, dims, mets, loc) => api('POST', `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`, {
    dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }], dimensions: dims.map((name) => ({ name })),
    metrics: mets.map((name) => ({ name })), dimensionFilter: loc ?? khongVN, limit: 50,
    orderBys: [{ metric: { metricName: mets[0] }, desc: true }]
  });
  const in_ = (tieuDe, r, dims, mets) => {
    console.log(`\n== ${tieuDe} ==\n  ${[...dims, ...mets].join(' | ')}`);
    if (!r.rows?.length) console.log('  (chưa có dữ liệu)');
    for (const x of r.rows ?? []) console.log('  ' + [...x.dimensionValues.map((v) => v.value), ...x.metricValues.map((v) => (+v.value % 1 ? (+v.value).toFixed(1) : v.value))].join(' | '));
  };
  for (const t of ts) {
    console.log(`\n##### ${t.displayName} (${t.property}) — ngoài Việt Nam, 14 ngày #####`);
    let d = ['country', 'hostName'], m = ['activeUsers', 'sessions', 'userEngagementDuration', 'averageSessionDuration'];
    in_('theo nước (thời gian tính bằng giây)', await bao(t.property, d, m), d, m);
    d = ['sessionSource', 'country']; m = ['sessions', 'userEngagementDuration'];
    in_('theo nguồn', await bao(t.property, d, m), d, m);
    d = ['country', 'eventName']; m = ['eventCount'];
    in_('số ván bắt đầu / kết thúc', await bao(t.property, d, m, { andGroup: { expressions: [khongVN,
      { filter: { fieldName: 'eventName', inListFilter: { values: ['van_bat_dau', 'van_ket_thuc'] } } }] } }), d, m);
  }
} else if (buoc === 'ga-tong') {
  // GA4 MỌI nước (kể cả Việt Nam), 28 ngày: tổng quan, nước, nguồn, thiết bị, người mới/quay lại, sự kiện.
  const tk = await api('GET', 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  const ts = (tk.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? []);
  const bao = (prop, dims, mets) => api('POST', `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`, {
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }], dimensions: dims.map((name) => ({ name })),
    metrics: mets.map((name) => ({ name })), limit: 30,
    ...(dims.length ? { orderBys: [{ metric: { metricName: mets[0] }, desc: true }] } : {})
  });
  const in_ = (tieuDe, r, dims, mets) => {
    console.log(`\n== ${tieuDe} ==\n  ${[...dims, ...mets].join(' | ')}`);
    if (!r.rows?.length) console.log('  (chưa có dữ liệu)');
    for (const x of r.rows ?? []) console.log('  ' + [...(x.dimensionValues ?? []).map((v) => v.value), ...x.metricValues.map((v) => (+v.value % 1 ? (+v.value).toFixed(1) : v.value))].join(' | '));
  };
  const u = ['activeUsers', 'sessions', 'engagedSessions', 'averageSessionDuration'];
  const bang = [['tổng', [], [...u, 'newUsers', 'screenPageViews']], ['theo nước', ['country'], u],
    ['theo nguồn / kênh', ['sessionSource', 'sessionMedium'], u], ['theo nhóm kênh', ['sessionDefaultChannelGroup'], u],
    ['theo tên miền', ['hostName'], u], ['theo thiết bị', ['deviceCategory', 'operatingSystem'], u],
    ['theo ngôn ngữ', ['language'], u], ['mới / quay lại', ['newVsReturning'], u],
    ['trang đích', ['landingPage'], ['sessions', 'engagedSessions']], ['theo ngày', ['date'], ['activeUsers', 'sessions']],
    ['sự kiện', ['eventName'], ['eventCount', 'totalUsers']]];
  for (const t of ts) {
    console.log(`\n##### ${t.displayName} (${t.property}) — mọi nước, 28 ngày #####`);
    for (const [tieuDe, d, m] of bang) {
      try { in_(tieuDe, await bao(t.property, d, m), d, m); } catch (e) { console.log(`\n== ${tieuDe} == LỖI ${e.message.slice(0, 150)}`); }
    }
  }
} else if (buoc === 'ga-chien-dich') {
  // Ván Chiến dịch THẬT theo màn (mọi nước, 90 ngày): kết quả, sao, giây — cần custom dimension
  // man / ket_qua / sao ở GA (Admin → Custom definitions); thiếu thì API báo lỗi tên trường.
  const tk = await api('GET', 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  const ts = (tk.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? []).filter((t) => /flip/i.test(t.displayName));
  for (const t of ts) {
    const md = await api('GET', `https://analyticsdata.googleapis.com/v1beta/${t.property}/metadata`);
    const tuy = (md.dimensions ?? []).filter((d) => d.apiName.startsWith('customEvent:')).map((d) => d.apiName);
    console.log(`${t.displayName}: custom dimension có sẵn: ${tuy.join(', ') || '(chưa có)'}`);
    const can = ['customEvent:man', 'customEvent:ket_qua', 'customEvent:sao'].filter((d) => tuy.includes(d));
    if (!can.includes('customEvent:man')) continue;
    const r = await api('POST', `https://analyticsdata.googleapis.com/v1beta/${t.property}:runReport`, {
      dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }], dimensions: can.map((name) => ({ name })),
      metrics: [{ name: 'eventCount' }], limit: 500,
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'van_ket_thuc' } } }
    });
    for (const x of r.rows ?? []) console.log('  ' + [...x.dimensionValues.map((v) => v.value), x.metricValues[0].value].join(' | '));
  }
} else {
  console.error('Cách dùng: node tools/search-console.mjs token | xac-minh | trang-thai | luot-tim | chi-muc | ga | ga-tong | ga-chien-dich'); process.exit(2);
}
