#!/usr/bin/env node
/**
 * ĐIỀN TRANG APP STORE qua App Store Connect API: tên, phụ đề, mô tả, từ khoá,
 * promotional text, URL, danh mục, ảnh chụp màn hình (en-US + vi), và gắn bản
 * build mới nhất vào phiên bản đang soạn. Chạy lại được (ảnh cũ trong bộ bị
 * thay, chữ bị ghi đè) — sửa docs/store-listing.md rồi chạy lại là cập nhật.
 *
 *   node tools/asc-store.mjs <AuthKey_XXXXXXXXXX.p8> <Issuer ID> [thư mục ảnh]
 *     thư mục ảnh mặc định ~/Downloads/flipmatch-screenshots (con: en/, vi/)
 *
 * Điền cả App Review Information (ghi chú ở mục "## App Review", số điện thoại
 * từ biến ASC_REVIEW_PHONE). Chạy trên CI: workflow `asc-store.yml`.
 *
 * KHÔNG làm được qua API (phải bấm trên web): App Privacy, phân loại độ tuổi,
 * giá (Free), trader status EU, và nút Submit for Review — script in nhắc cuối.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { createPrivateKey, sign, createHash } from 'node:crypto';

const BUNDLE_ID = 'com.hello314.flipmatch';
const [p8Path, issuer, thuMucAnh = join(homedir(), 'Downloads', 'flipmatch-screenshots')] = process.argv.slice(2);
if (!p8Path || !issuer) { console.error('Cách dùng: node tools/asc-store.mjs <AuthKey_XXXX.p8> <Issuer ID> [thư mục ảnh]'); process.exit(2); }
const keyId = basename(p8Path).match(/^AuthKey_([A-Z0-9]+)\.p8$/)?.[1];
if (!keyId) { console.error('Tên file phải dạng AuthKey_<KeyID>.p8'); process.exit(2); }

const khoa = createPrivateKey(readFileSync(p8Path));
function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const than = b64({ iss: issuer, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  return `${dau}.${than}.${sign('sha256', Buffer.from(`${dau}.${than}`), { key: khoa, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
async function api(method, path, body) {
  const r = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Đọc nội dung từ docs/store-listing.md (một nguồn duy nhất) ──
const md = readFileSync(new URL('../docs/store-listing.md', import.meta.url), 'utf8');
function phan(tieuDe) {
  const i = md.indexOf(`## ${tieuDe}`);
  if (i < 0) throw new Error(`store-listing.md thiếu mục "## ${tieuDe}"`);
  const j = md.indexOf('\n## ', i + 3);
  const s = md.slice(i, j < 0 ? undefined : j);
  const f = {};
  for (const m of s.matchAll(/\*\*([^*]+)\*\* \((\d+)\)[^\n]*\n```\n(.*?)\n```/gs)) {
    if (m[3].length > Number(m[2])) throw new Error(`${tieuDe} / ${m[1]}: ${m[3].length} ký tự > ${m[2]}`);
    f[m[1]] = m[3];
  }
  return f;
}
const URLS = {
  support: 'https://flipmatch.cozypi.com/support.html',
  marketing: 'https://cozypi.com',
  privacy: 'https://flipmatch.cozypi.com/privacy.html',
};
const NGON_NGU = [
  { locale: 'en-US', noiDung: phan('English (U.S.)'), anh: 'en' },
  { locale: 'vi', noiDung: phan('Tiếng Việt'), anh: 'vi' },
  // 10 ngôn ngữ còn lại của app (13.10.2026) — thư mục ảnh trùng mã ngôn ngữ trong app
  { locale: 'es-ES', noiDung: phan('Español'), anh: 'es' },
  { locale: 'pt-BR', noiDung: phan('Português (Brasil)'), anh: 'pt' },
  { locale: 'fr-FR', noiDung: phan('Français'), anh: 'fr' },
  { locale: 'de-DE', noiDung: phan('Deutsch'), anh: 'de' },
  { locale: 'ja', noiDung: phan('日本語'), anh: 'ja' },
  { locale: 'ko', noiDung: phan('한국어'), anh: 'ko' },
  { locale: 'zh-Hans', noiDung: phan('简体中文'), anh: 'zh' },
  { locale: 'ru', noiDung: phan('Русский'), anh: 'ru' },
  { locale: 'id', noiDung: phan('Bahasa Indonesia'), anh: 'id' },
  { locale: 'th', noiDung: phan('ไทย'), anh: 'th' },
];

// ── App + appInfo đang soạn + phiên bản đang soạn ──
const app = (await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data.find((a) => a.attributes.bundleId === BUNDLE_ID);
if (!app) throw new Error(`Chưa có app ${BUNDLE_ID} trên App Store Connect`);
console.log(`App: ${app.attributes.name} (${app.id})`);
const SUA_DUOC = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'WAITING_FOR_REVIEW', 'INVALID_BINARY'];
const appInfo = (await api('GET', `/v1/apps/${app.id}/appInfos`)).data
  .find((i) => SUA_DUOC.includes(i.attributes.appStoreState ?? i.attributes.state)) ?? (await api('GET', `/v1/apps/${app.id}/appInfos`)).data[0];
const version = (await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data
  .find((v) => SUA_DUOC.includes(v.attributes.appStoreState ?? v.attributes.appVersionState));
if (!version) throw new Error('Không có phiên bản iOS nào đang soạn (Prepare for Submission)');

// Phiên bản hiển thị khớp package.json, bản quyền
const pkgVer = JSON.parse(readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8')).version;
await api('PATCH', `/v1/appStoreVersions/${version.id}`, {
  data: { type: 'appStoreVersions', id: version.id, attributes: { versionString: pkgVer, copyright: `${new Date().getFullYear()} Cozy Pi` } },
});
console.log(`✓ Phiên bản ${pkgVer}`);

// Danh mục: Games → Puzzle (+ Board)
await api('PATCH', `/v1/appInfos/${appInfo.id}`, {
  data: {
    type: 'appInfos', id: appInfo.id,
    relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'GAMES' } },
      primarySubcategoryOne: { data: { type: 'appCategories', id: 'GAMES_PUZZLE' } },
      primarySubcategoryTwo: { data: { type: 'appCategories', id: 'GAMES_BOARD' } },
    },
  },
});
console.log('✓ Danh mục Games / Puzzle, Board');

const infoLocs = (await api('GET', `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`)).data;

for (const { locale, noiDung: n, anh } of NGON_NGU) {
  // Tên + phụ đề + privacy URL (cấp app)
  const infoAttr = { name: n.Name, subtitle: n.Subtitle, privacyPolicyUrl: URLS.privacy };
  const il = infoLocs.find((l) => l.attributes.locale === locale);
  if (il) await api('PATCH', `/v1/appInfoLocalizations/${il.id}`, { data: { type: 'appInfoLocalizations', id: il.id, attributes: infoAttr } });
  else await api('POST', '/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale, ...infoAttr }, relationships: { appInfo: { data: { type: 'appInfos', id: appInfo.id } } } } });

  // Mô tả + từ khoá + promo + URL (cấp phiên bản)
  const verAttr = { description: n.Description, keywords: n.Keywords, promotionalText: n['Promotional text'], supportUrl: URLS.support, marketingUrl: URLS.marketing };
  // Đọc lại NGAY ĐÂY, không đọc một lần từ đầu: tạo bản cấp app (appInfoLocalization)
  // cho một ngôn ngữ mới là Apple tự sinh luôn bản cấp phiên bản — danh sách đọc từ
  // trước thành cũ, POST trùng ra 409 "locale vi already exists" (đã dính trên CI).
  const verLocs = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;
  let vl = verLocs.find((l) => l.attributes.locale === locale);
  if (vl) await api('PATCH', `/v1/appStoreVersionLocalizations/${vl.id}`, { data: { type: 'appStoreVersionLocalizations', id: vl.id, attributes: verAttr } });
  else vl = (await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale, ...verAttr }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } })).data;
  console.log(`✓ ${locale}: ${n.Name} — chữ`);

  // Ảnh: bộ iPhone 6.7"/6.9" (1320×2868 thuộc APP_IPHONE_67)
  const dir = join(thuMucAnh, anh);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d.*\.png$/.test(f)).sort() : [];
  if (!files.length) { console.log(`  (bỏ qua ảnh: không có ${dir}/0*.png)`); continue; }
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`)).data;
  let set = sets.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: 'APP_IPHONE_67' }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vl.id } } } } })).data;
  for (const cu of (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api('DELETE', `/v1/appScreenshots/${cu.id}`);
  for (const f of files.slice(0, 10)) {
    const buf = readFileSync(join(dir, f));
    const shot = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: statSync(join(dir, f)).size }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`Tải ${f} lỗi ${r.status}`);
    }
    await api('PATCH', `/v1/appScreenshots/${shot.id}`, { data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(buf).digest('hex') } } });
  }
  console.log(`✓ ${locale}: ${files.length} ảnh`);
}

// App Review Information: liên hệ + ghi chú cho người duyệt. Số điện thoại lấy từ
// biến môi trường (repo công khai, không ghi vào store-listing.md).
{
  const rv = phan('App Review');
  const attr = { contactFirstName: rv['First name'], contactLastName: rv['Last name'], contactEmail: rv.Email, demoAccountRequired: false, notes: rv.Notes };
  if (process.env.ASC_REVIEW_PHONE) attr.contactPhone = process.env.ASC_REVIEW_PHONE;
  // Chưa có thì API có thể trả data: null HOẶC 404 — coi cả hai là chưa có
  const cur = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null))?.data;
  if (cur) await api('PATCH', `/v1/appStoreReviewDetails/${cur.id}`, { data: { type: 'appStoreReviewDetails', id: cur.id, attributes: attr } });
  else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: attr, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
  console.log(`✓ App Review Information${attr.contactPhone ? '' : ' (THIẾU số điện thoại — đặt secret ASC_REVIEW_PHONE, Apple bắt buộc)'}`);
}

// Gắn bản build mới nhất (đã xử lý xong) của đúng phiên bản này
const builds = (await api('GET', `/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${pkgVer}&filter[processingState]=VALID&sort=-uploadedDate&limit=1`)).data;
if (builds[0]) {
  await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: builds[0].id } });
  console.log(`✓ Gắn build ${builds[0].attributes.version} (phiên bản ${pkgVer})`);
} else console.log(`  (chưa có build ${pkgVer} xử lý xong — chạy lại script sau khi TestFlight báo xong)`);

console.log(`
Còn phải bấm trên web (API không làm được):
  • App Privacy  — theo bảng trong docs/store-listing.md
  • Age Rating   — theo mục "Phân loại độ tuổi" trong docs/store-listing.md
  • Pricing and Availability → Free
  • Business → trader status (EU)
  • Submit for Review`);
