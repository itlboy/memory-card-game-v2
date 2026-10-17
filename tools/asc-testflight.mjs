#!/usr/bin/env node
/**
 * TESTFLIGHT CÔNG KHAI — dựng nhóm người thử BÊN NGOÀI "Public Testers" có link
 * mời công khai (https://testflight.apple.com/join/…), gắn build hợp lệ mới nhất,
 * điền phần Apple bắt buộc cho thử nghiệm ngoài (mô tả beta, email góp ý, liên
 * hệ Beta App Review, "What to Test") rồi nộp Beta App Review. Chạy lại được:
 * thứ đã có thì cập nhật, build đã nộp thì bỏ qua.
 *
 *   node tools/asc-testflight.mjs <AuthKey_XXXXXXXXXX.p8> <Issuer ID>
 *
 * CI: workflow `asc-testflight.yml` (secret ASC_* + ASC_REVIEW_PHONE như asc-store).
 * Link công khai chỉ BẬT được sau khi Apple duyệt build đầu tiên của nhóm — lần
 * đầu chạy là nộp duyệt, duyệt xong chạy lại để bật link.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';

const BUNDLE_ID = 'com.hello314.flipmatch';
const TEN_NHOM = 'Public Testers';
const LIEN_HE = { contactFirstName: 'Kien', contactLastName: 'Nguyen', contactEmail: 'support@cozypi.com' };
const MO_TA = 'Flip Match is a cozy memory card game: flip two cards, find the pairs. Play solo through 60 campaign levels, against the computer, or online with friends. Free, no ads, for all ages.';
const CAN_THU = 'Play a few rounds solo and vs the computer, try an online room with a friend, and tell us anything that looks wrong or feels slow. Feedback: support@cozypi.com';

const [p8Path, issuer] = process.argv.slice(2);
if (!p8Path || !issuer) { console.error('Cách dùng: node tools/asc-testflight.mjs <AuthKey_XXXX.p8> <Issuer ID>'); process.exit(2); }
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
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

const app = (await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data?.[0];
if (!app) throw new Error('không thấy app');
const lienKetApp = { app: { data: { type: 'apps', id: app.id } } };

// 1. Thông tin beta của app (bắt buộc cho người thử bên ngoài).
const locs = (await api('GET', `/v1/apps/${app.id}/betaAppLocalizations`)).data;
const locEn = locs.find((l) => l.attributes.locale === 'en-US');
const attrLoc = { feedbackEmail: LIEN_HE.contactEmail, description: MO_TA, marketingUrl: 'https://cozypi.com', privacyPolicyUrl: 'https://flipmatch.cozypi.com/privacy.html' };
if (locEn) await api('PATCH', `/v1/betaAppLocalizations/${locEn.id}`, { data: { type: 'betaAppLocalizations', id: locEn.id, attributes: attrLoc } });
else await api('POST', '/v1/betaAppLocalizations', { data: { type: 'betaAppLocalizations', attributes: { locale: 'en-US', ...attrLoc }, relationships: lienKetApp } });
console.log('✓ mô tả beta + email góp ý');

// 2. Liên hệ cho Beta App Review.
const rd = (await api('GET', `/v1/apps/${app.id}/betaAppReviewDetail`)).data;
const attrRd = { ...LIEN_HE, demoAccountRequired: false, notes: 'No login required. Online mode: tap Online, create a room; a second device can join with the 6-digit code.' };
if (process.env.ASC_REVIEW_PHONE) attrRd.contactPhone = process.env.ASC_REVIEW_PHONE;
await api('PATCH', `/v1/betaAppReviewDetails/${rd.id}`, { data: { type: 'betaAppReviewDetails', id: rd.id, attributes: attrRd } });
console.log(`✓ liên hệ Beta App Review${attrRd.contactPhone ? '' : ' (THIẾU số điện thoại — secret ASC_REVIEW_PHONE)'}`);

// 3. Build hợp lệ mới nhất.
const build = (await api('GET', `/v1/builds?filter[app]=${app.id}&filter[processingState]=VALID&filter[expired]=false&sort=-uploadedDate&limit=1&include=preReleaseVersion`));
const b = build.data?.[0];
if (!b) throw new Error('không có build hợp lệ nào');
const phienBan = build.included?.find((x) => x.type === 'preReleaseVersions')?.attributes.version;
console.log(`✓ build ${phienBan} (${b.attributes.version})`);

const bl = (await api('GET', `/v1/builds/${b.id}/betaBuildLocalizations`)).data.find((l) => l.attributes.locale === 'en-US');
if (bl) await api('PATCH', `/v1/betaBuildLocalizations/${bl.id}`, { data: { type: 'betaBuildLocalizations', id: bl.id, attributes: { whatsNew: CAN_THU } } });
else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', whatsNew: CAN_THU }, relationships: { build: { data: { type: 'builds', id: b.id } } } } });
console.log('✓ What to Test');

// 4. Nhóm bên ngoài + gắn build.
let nhom = (await api('GET', `/v1/betaGroups?filter[app]=${app.id}&filter[name]=${encodeURIComponent(TEN_NHOM)}`)).data?.[0];
if (!nhom) {
  nhom = (await api('POST', '/v1/betaGroups', { data: { type: 'betaGroups', attributes: { name: TEN_NHOM, feedbackEnabled: true }, relationships: lienKetApp } })).data;
  console.log(`✓ tạo nhóm "${TEN_NHOM}"`);
}
await api('POST', `/v1/betaGroups/${nhom.id}/relationships/builds`, { data: [{ type: 'builds', id: b.id }] });
console.log('✓ gắn build vào nhóm');

// 5. Nộp Beta App Review (bỏ qua nếu build đã nộp / đã duyệt).
const nop = await api('GET', `/v1/builds/${b.id}/betaAppReviewSubmission`).catch(() => null);
if (nop?.data) console.log(`• Beta App Review: ${nop.data.attributes.betaReviewState}`);
else {
  const r = await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: b.id } } } } });
  console.log(`✓ đã nộp Beta App Review: ${r.data.attributes.betaReviewState}`);
}

// 6. Link công khai (Apple chỉ cho bật sau khi build đầu tiên của nhóm được duyệt).
try {
  const r = await api('PATCH', `/v1/betaGroups/${nhom.id}`, { data: { type: 'betaGroups', id: nhom.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false } } });
  console.log(`\nLINK CÔNG KHAI: ${r.data.attributes.publicLink ?? '(chưa có — chạy lại sau khi duyệt)'}`);
} catch (e) {
  console.log(`\n• Chưa bật được link công khai (thường do build chưa được duyệt) — chạy lại workflow sau khi Apple duyệt.\n${String(e.message).slice(0, 300)}`);
}
