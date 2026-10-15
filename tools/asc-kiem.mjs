#!/usr/bin/env node
/**
 * SOI TRANG APP STORE — CHỈ ĐỌC, không ghi gì lên App Store Connect. In ra bảng
 * những gì đã có / còn thiếu trước khi bấm "Submit for Review":
 * phiên bản đang soạn + build gắn vào, chữ từng ngôn ngữ, ảnh chụp từng bộ, phân
 * loại độ tuổi, giá, liên hệ App Review, In-App Purchase, lượt nộp duyệt đang mở.
 *
 *   node tools/asc-kiem.mjs <AuthKey_XXXXXXXXXX.p8> <Issuer ID>
 *
 * CI: workflow `asc-kiem.yml` (dùng chung secret ASC_* với mobile.yml). Phần API
 * KHÔNG đọc được (App Privacy) in nhắc ở cuối. Ghi trang thì dùng tools/asc-store.mjs.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';

const BUNDLE_ID = 'com.hello314.flipmatch';
const [p8Path, issuer] = process.argv.slice(2);
if (!p8Path || !issuer) { console.error('Cách dùng: node tools/asc-kiem.mjs <AuthKey_XXXX.p8> <Issuer ID>'); process.exit(2); }
const keyId = basename(p8Path).match(/^AuthKey_([A-Z0-9]+)\.p8$/)?.[1];
const khoa = createPrivateKey(readFileSync(p8Path));
function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const than = b64({ iss: issuer, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  return `${dau}.${than}.${sign('sha256', Buffer.from(`${dau}.${than}`), { key: khoa, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
async function get(path) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt()}` } });
  const text = await r.text();
  if (!r.ok) return { loi: `${r.status} ${text.slice(0, 200)}` };
  return text ? JSON.parse(text) : {};
}

const thieu = [];
const ok = (dk, chu) => { console.log(`${dk ? '✓' : '✗'} ${chu}`); if (!dk) thieu.push(chu); };

const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data?.[0];
if (!app) { console.log('✗ không thấy app'); process.exit(1); }
console.log(`App: ${app.attributes.name} · ${app.attributes.primaryLocale} · id ${app.id}`);

// ── Phiên bản + build ──
const vers = (await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data ?? [];
for (const v of vers) console.log(`  phiên bản ${v.attributes.versionString}: ${v.attributes.appStoreState} · copyright "${v.attributes.copyright ?? ''}" · phát hành: ${v.attributes.releaseType}`);
// Liên hệ + link CÔNG KHAI của phiên bản mới nhất (kể cả đang chờ duyệt) — in giá
// trị thật để đối chiếu với trang hỗ trợ / privacy (chủ dự án 15.10.2026).
if (vers[0]) {
  const rv0 = (await get(`/v1/appStoreVersions/${vers[0].id}/appStoreReviewDetail`)).data?.attributes ?? {};
  console.log(`  liên hệ App Review (${vers[0].attributes.versionString}): ${rv0.contactEmail ?? '—'} · ${rv0.contactFirstName ?? ''} ${rv0.contactLastName ?? ''}`);
  const l0 = (await get(`/v1/appStoreVersions/${vers[0].id}/appStoreVersionLocalizations?limit=50`)).data ?? [];
  for (const x of l0.filter((x) => ['en-US', 'vi'].includes(x.attributes.locale))) {
    console.log(`  ${x.attributes.locale}: support ${x.attributes.supportUrl ?? '—'} · marketing ${x.attributes.marketingUrl ?? '—'}`);
  }
}
const v = vers.find((x) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(x.attributes.appStoreState));
ok(!!v, 'có phiên bản đang soạn (Prepare for Submission)');
if (v) {
  const b = (await get(`/v1/appStoreVersions/${v.id}/build`)).data;
  ok(!!b, `build gắn vào phiên bản ${v.attributes.versionString}${b ? ` (build ${b.attributes.version}, ${b.attributes.processingState}, tải lên ${b.attributes.uploadedDate})` : ''}`);
  const moi = (await get(`/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${v.attributes.versionString}&sort=-uploadedDate&limit=1`)).data?.[0];
  if (moi) console.log(`  build MỚI NHẤT trên ASC: ${moi.attributes.version} (${moi.attributes.processingState}, ${moi.attributes.uploadedDate})`);
  if (b && moi && b.id !== moi.id) thieu.push(`build gắn (${b.attributes.version}) chưa phải mới nhất (${moi.attributes.version})`);

  // ── Chữ + ảnh từng ngôn ngữ ──
  const locs = (await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`)).data ?? [];
  console.log(`\nNgôn ngữ trang (phiên bản): ${locs.length}`);
  for (const l of locs) {
    const a = l.attributes;
    const sets = (await get(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=20`));
    const shots = sets.included ?? [];
    const loiAnh = shots.filter((x) => x.attributes.assetDeliveryState?.state && x.attributes.assetDeliveryState.state !== 'COMPLETE');
    const theoBo = (sets.data ?? []).map((s) => `${s.attributes.screenshotDisplayType}×${s.relationships?.appScreenshots?.data?.length ?? '?'}`).join(', ');
    const du = a.description && a.keywords && a.supportUrl;
    console.log(`  ${du && shots.length ? '✓' : '✗'} ${a.locale.padEnd(8)} mô tả ${a.description?.length ?? 0} · từ khoá ${a.keywords?.length ?? 0} · support ${a.supportUrl ? 'có' : 'THIẾU'} · ảnh [${theoBo || 'KHÔNG CÓ'}]${loiAnh.length ? ` · ${loiAnh.length} ảnh chưa xử lý xong/lỗi` : ''}`);
    if (!du) thieu.push(`${a.locale}: thiếu chữ (mô tả/từ khoá/support URL)`);
    if (!shots.length) thieu.push(`${a.locale}: chưa có ảnh chụp`);
    if (loiAnh.length) thieu.push(`${a.locale}: ${loiAnh.length} ảnh lỗi/chưa xử lý`);
  }

  // ── Liên hệ App Review ──
  const rv = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  ok(!!(rv?.attributes?.contactEmail && rv?.attributes?.contactPhone), `App Review: liên hệ (email ${rv?.attributes?.contactEmail ? 'có' : 'THIẾU'}, điện thoại ${rv?.attributes?.contactPhone ? 'có' : 'THIẾU'})`);
}

// ── App info: tên/phụ đề/privacy, danh mục, độ tuổi ──
const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data ?? [];
const info = infos.find((i) => (i.attributes.appStoreState ?? i.attributes.state) !== 'READY_FOR_DISTRIBUTION') ?? infos[0];
if (info) {
  const il = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`)).data ?? [];
  const thieuPriv = il.filter((x) => !x.attributes.privacyPolicyUrl).map((x) => x.attributes.locale);
  ok(il.length > 0 && !thieuPriv.length, `tên + privacy URL ${il.length} ngôn ngữ${thieuPriv.length ? ` (thiếu privacy: ${thieuPriv.join(', ')})` : ''}`);
  const cat = (await get(`/v1/appInfos/${info.id}/primaryCategory`)).data;
  ok(!!cat, `danh mục chính: ${cat?.id ?? 'CHƯA CHỌN'}`);
  const age = (await get(`/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  const tl = age?.attributes ?? {};
  const daKhai = Object.values(tl).some((x) => x !== null);
  ok(daKhai, `phân loại độ tuổi${daKhai ? '' : ' — CHƯA KHAI (bấm trên web: App Information → Age Rating)'}`);
}

// ── Giá ──
const gia = await get(`/v1/apps/${app.id}/appPriceSchedule?include=manualPrices`);
ok(!gia.loi && !!gia.data, `lịch giá${gia.loi ? ` — ${gia.loi.slice(0, 80)}` : ''}`);

// ── In-App Purchase ──
const iap = await get(`/v2/apps/${app.id}/inAppPurchasesV2?limit=20`);
const dsIap = iap.data ?? (await get(`/v1/apps/${app.id}/inAppPurchasesV2?limit=20`)).data ?? [];
console.log(`\nIn-App Purchase: ${dsIap.length ? dsIap.map((x) => `${x.attributes.productId} (${x.attributes.state})`).join(', ') : 'chưa có'}`);

// ── Lượt nộp duyệt ──
const sub = (await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5`)).data ?? [];
console.log(`Lượt nộp duyệt: ${sub.length ? sub.map((x) => `${x.attributes.state} (${x.attributes.submittedDate ?? 'chưa nộp'})`).join(', ') : 'chưa có'}`);

console.log(`\n${thieu.length ? `CÒN THIẾU ${thieu.length}:` : 'API không thấy gì thiếu.'}`);
for (const x of thieu) console.log(`  • ${x}`);
console.log(`
API không đọc được — tự xem trên web:
  • App Privacy (nhãn dữ liệu) · Pricing and Availability → Free + quốc gia · trader status (EU)`);
