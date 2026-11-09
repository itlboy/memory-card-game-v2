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
import { MOI } from './asc-moi.mjs';
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
async function api(method, path, body, lan = 0) {
  const r = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  // Apple hay trả 500/503 THOÁNG QUA giữa lúc đẩy 300 ảnh (dính 09.11.2026 ở ảnh tiếng Nga) — thử lại,
  // không thì cả lượt 25 phút chụp ảnh đổ sông.
  if (r.status >= 500 && lan < 4) {
    console.log(`  (Apple ${r.status} ở ${method} ${path} — thử lại sau ${5 * (lan + 1)}s)`);
    await new Promise((ok) => setTimeout(ok, 5000 * (lan + 1)));
    return api(method, path, body, lan + 1);
  }
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
  // Thêm 15.10.2026 — mã App Store: it, tr, zh-Hant (Trung phồn thể)
  { locale: 'it', noiDung: phan('Italiano'), anh: 'it' },
  { locale: 'tr', noiDung: phan('Türkçe'), anh: 'tr' },
  { locale: 'zh-Hant', noiDung: phan('繁體中文'), anh: 'zh-TW' },
];

// ── App + appInfo đang soạn + phiên bản đang soạn ──
const app = (await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data.find((a) => a.attributes.bundleId === BUNDLE_ID);
if (!app) throw new Error(`Chưa có app ${BUNDLE_ID} trên App Store Connect`);
console.log(`App: ${app.attributes.name} (${app.id})`);
const SUA_DUOC = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'WAITING_FOR_REVIEW', 'INVALID_BINARY'];
// Phiên bản hiển thị khớp package.json, bản quyền
const pkgVer = JSON.parse(readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8')).version;
let version = (await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data
  .find((v) => SUA_DUOC.includes(v.attributes.appStoreState ?? v.attributes.appVersionState));
// Chưa có phiên bản đang soạn (bản trước đã công khai) → TẠO phiên bản mới = số trong package.json
// (09.11.2026: trước đây phải bấm tay "+ Version" trên App Store Connect).
if (!version) {
  version = (await api('POST', '/v1/appStoreVersions', {
    data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: pkgVer }, relationships: { app: { data: { type: 'apps', id: app.id } } } }
  })).data;
  console.log(`✓ Tạo phiên bản mới ${pkgVer}`);
}
// Đọc appInfo SAU khi tạo phiên bản: phiên bản mới kéo theo một appInfo đang soạn; đọc trước thì
// lấy nhầm appInfo của bản ĐANG BÁN → PATCH danh mục ra 409 INVALID_STATE (dính 09.11.2026).
const dsInfo = (await api('GET', `/v1/apps/${app.id}/appInfos`)).data;
const appInfo = dsInfo.find((i) => SUA_DUOC.includes(i.attributes.appStoreState ?? i.attributes.state)) ?? dsInfo[0];
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
  // "Có gì mới" — Apple bắt buộc với bản cập nhật, CẤM gửi ở bản đầu tiên (đã có bản công khai ⇒ cập nhật)
  if (MOI[anh]) verAttr.whatsNew = MOI[anh];
  // Đọc lại NGAY ĐÂY, không đọc một lần từ đầu: tạo bản cấp app (appInfoLocalization)
  // cho một ngôn ngữ mới là Apple tự sinh luôn bản cấp phiên bản — danh sách đọc từ
  // trước thành cũ, POST trùng ra 409 "locale vi already exists" (đã dính trên CI).
  const verLocs = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;
  let vl = verLocs.find((l) => l.attributes.locale === locale);
  if (vl) await api('PATCH', `/v1/appStoreVersionLocalizations/${vl.id}`, { data: { type: 'appStoreVersionLocalizations', id: vl.id, attributes: verAttr } });
  else vl = (await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale, ...verAttr }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } })).data;
  console.log(`✓ ${locale}: ${n.Name} — chữ`);

  // Ảnh: bộ iPhone 6.7"/6.9" (1320×2868 thuộc APP_IPHONE_67) ở <lang>/, bộ iPad 13"
  // (2064×2752, APP_IPAD_PRO_3GEN_129) ở <lang>-ipad/ — bắt buộc vì app khai hỗ trợ
  // iPad. Thư mục nào không có thì giữ nguyên bộ đang có trên ASC.
  await dayAnh(locale, vl, join(thuMucAnh, anh), 'APP_IPHONE_67');
  await dayAnh(locale, vl, join(thuMucAnh, `${anh}-ipad`), 'APP_IPAD_PRO_3GEN_129');
}

async function dayAnh(locale, vl, dir, loai) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d.*\.png$/.test(f)).sort() : [];
  if (!files.length) { console.log(`  (bỏ qua ${loai}: không có ${dir}/0*.png)`); return; }
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`)).data;
  let set = sets.find((s) => s.attributes.screenshotDisplayType === loai);
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: loai }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vl.id } } } } })).data;
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
  console.log(`✓ ${locale}: ${files.length} ảnh ${loai}`);
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

/*
 * NỘP APPLE DUYỆT (09.11.2026) — chỉ khi NOP_DUYET=1 (workflow: -f nop_duyet=true). Chỉ chạy khi đã
 * gắn được build; dùng API reviewSubmissions (gom phiên bản vào một lượt nộp rồi bấm gửi).
 */
if (process.env.NOP_DUYET === '1') {
  if (!builds[0]) throw new Error(`Chưa có build ${pkgVer} xử lý xong — chưa nộp được`);
  const cu = (await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES`)).data?.[0];
  const sub = cu ?? (await api('POST', '/v1/reviewSubmissions', {
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } }
  })).data;
  // Ảnh VỪA tải lên Apple còn xử lý (ASSET_IN_POST_PROCESSING) thì chưa nộp được — chờ tới 15 phút.
  for (let lan = 0; ; lan++) {
    try {
      await api('POST', '/v1/reviewSubmissionItems', {
        data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } }
      });
      break;
    } catch (e) {
      if (/ASSET_IN_POST_PROCESSING/.test(String(e)) && lan < 30) {
        console.log(`  (Apple còn xử lý ảnh — chờ 30s, lần ${lan + 1})`);
        await new Promise((ok) => setTimeout(ok, 30000));
        continue;
      }
      throw e;
    }
  }
  try { /* giữ khối catch cũ cho lỗi 'đã có' */ } catch (e) {
    // Đã có trong lượt nộp thì bỏ qua; lỗi khác (thiếu thông tin…) PHẢI in ra — trước đây nuốt mất
    // nên chỉ thấy "does not have any items" ở bước sau (09.11.2026).
    if (!/already|ENTITY_ERROR\.RELATIONSHIP\.UNIQUE|duplicate/i.test(String(e))) throw e;
  }
  await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
  console.log(`✓ ĐÃ NỘP APPLE DUYỆT phiên bản ${pkgVer} (build ${builds[0].attributes.version})`);
}
