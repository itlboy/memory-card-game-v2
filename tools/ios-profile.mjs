#!/usr/bin/env node
/**
 * BẬT CAPABILITY cho App ID iOS rồi CẤP LẠI provisioning profile App Store —
 * giữ nguyên chứng chỉ phân phối đang dùng (khác `tao-ky-ios.mjs`, cái đó tạo cả
 * chứng chỉ mới). Chạy trên CI qua `.github/workflows/ios-profile.yml`, vì khoá
 * API (.p8) chỉ nằm trong GitHub Secrets.
 *
 *   KID=… ISS=… KEY_B64=… node tools/ios-profile.mjs <thư mục ra> [CAPABILITY…]
 *
 * Vì sao phải cấp lại: Apple đánh dấu profile cũ là INVALID ngay khi App ID đổi
 * capability, và profile chỉ mang những capability có lúc nó được SINH ra. Bật
 * Associated Domains (link mời mở thẳng app) mà quên bước này là CI ký lỗi
 * "Provisioning profile doesn't include the com.apple.developer.associated-domains
 * entitlement".
 *
 * Ra: `<thư mục>/flipmatch-appstore.mobileprovision` + `team-id.txt` (Team ID là
 * secret ở GitHub nên log sẽ che nó thành ***; file thì không).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';

const BUNDLE_ID = 'com.hello314.flipmatch';
const TEN_PROFILE = 'Flip Match App Store (CI)';

const [ra, ...caps] = process.argv.slice(2);
const { KID, ISS, KEY_B64 } = process.env;
if (!ra || !KID || !ISS || !KEY_B64) {
  console.error('Cách dùng: KID=… ISS=… KEY_B64=… node tools/ios-profile.mjs <thư mục ra> [CAPABILITY…]');
  process.exit(2);
}
const khoa = createPrivateKey(Buffer.from(KEY_B64, 'base64'));
function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'ES256', kid: KID, typ: 'JWT' });
  const than = b64({ iss: ISS, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const ck = sign('sha256', Buffer.from(`${dau}.${than}`), { key: khoa, dsaEncoding: 'ieee-p1363' });
  return `${dau}.${than}.${ck.toString('base64url')}`;
}
async function api(method, path, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`${method} ${path} → ${r.status}\n${text}`), { status: r.status });
  return text ? JSON.parse(text) : null;
}

const bids = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&include=bundleIdCapabilities&limit=20`);
const bid = bids.data.find((b) => b.attributes.identifier === BUNDLE_ID);
if (!bid) throw new Error(`Không thấy App ID ${BUNDLE_ID}`);
const coSan = new Set((bids.included ?? []).filter((x) => x.type === 'bundleIdCapabilities')
  .map((x) => x.attributes.capabilityType));
console.log(`App ID ${BUNDLE_ID}: ${[...coSan].join(', ') || '(không capability)'}`);

for (const cap of caps) {
  if (coSan.has(cap)) { console.log(`= ${cap} đã bật`); continue; }
  await api('POST', '/v1/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: cap },
      relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } } },
    },
  });
  console.log(`✓ Bật ${cap}`);
}

// Giữ đúng chứng chỉ của profile đang dùng — .p12 trong GitHub Secrets ký bằng nó
const cu = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(TEN_PROFILE)}&include=certificates&limit=20`);
const certIds = [...new Set(cu.data.flatMap((p) => p.relationships?.certificates?.data?.map((c) => c.id) ?? []))];
if (!certIds.length) throw new Error(`Không thấy profile "${TEN_PROFILE}" hoặc nó không có chứng chỉ — chạy tools/tao-ky-ios.mjs`);
for (const p of cu.data) await api('DELETE', `/v1/profiles/${p.id}`);
const prof = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: TEN_PROFILE, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bid.id } },
      certificates: { data: certIds.map((id) => ({ type: 'certificates', id })) },
    },
  },
});
mkdirSync(ra, { recursive: true });
writeFileSync(join(ra, 'flipmatch-appstore.mobileprovision'), Buffer.from(prof.data.attributes.profileContent, 'base64'));
writeFileSync(join(ra, 'team-id.txt'), `${bid.attributes.seedId}\n`);
console.log(`✓ Profile mới ${prof.data.attributes.uuid}, hết hạn ${prof.data.attributes.expirationDate?.slice(0, 10)}`);
