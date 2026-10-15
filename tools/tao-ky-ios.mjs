#!/usr/bin/env node
/**
 * Tạo CHỨNG CHỈ PHÂN PHỐI + PROVISIONING PROFILE App Store cho app iOS, rồi
 * (tuỳ chọn) nạp thẳng vào GitHub Secrets để .github/workflows/mobile.yml ký.
 * Chạy lại MỖI NĂM MỘT LẦN (chứng chỉ và profile cùng hết hạn sau 1 năm).
 *
 *   node tools/tao-ky-ios.mjs <AuthKey_XXXXXXXXXX.p8> <Issuer ID> [--gh]
 *
 * Vì sao phải có (thay vì để Xcode tự ký trên CI): ký tự động đòi team có
 * iPhone đăng ký, còn ký lại lúc xuất từ một archive ký tạm thì Apple từ chối
 * lúc nhận bản ("Invalid Signature") — đã thử cả hai, xem mobile.yml.
 *
 * Khoá riêng của chứng chỉ sinh NGAY TRÊN MÁY NÀY bằng openssl và không đi đâu
 * ngoài file .p12 (cạnh file .p8) và secret GitHub. Apple chỉ nhận CSR.
 * Cần: Node ≥ 20, openssl, và `gh` đã đăng nhập nếu dùng --gh.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, sign, randomBytes } from 'node:crypto';

const BUNDLE_ID = 'com.hello314.flipmatch';
const TEN_PROFILE = 'Flip Match App Store (CI)';

const [p8Path, issuer, co] = process.argv.slice(2);
if (!p8Path || !issuer) {
  console.error('Cách dùng: node tools/tao-ky-ios.mjs <AuthKey_XXXXXXXXXX.p8> <Issuer ID> [--gh]');
  process.exit(2);
}
const keyId = basename(p8Path).match(/^AuthKey_([A-Z0-9]+)\.p8$/)?.[1];
if (!keyId) { console.error('Tên file phải dạng AuthKey_<KeyID>.p8 (giữ nguyên tên Apple đặt).'); process.exit(2); }
const OUT = dirname(p8Path);
const P12 = join(OUT, 'ios-distribution.p12');
const MOBILEPROVISION = join(OUT, 'flipmatch-appstore.mobileprovision');
const MATKHAU = join(OUT, 'ios-distribution.password');

// ── JWT ES256 cho App Store Connect API (sống 15 phút) ──
const khoaApi = createPrivateKey(readFileSync(p8Path));
function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const than = b64({ iss: issuer, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const chuKy = sign('sha256', Buffer.from(`${dau}.${than}`), { key: khoaApi, dsaEncoding: 'ieee-p1363' });
  return `${dau}.${than}.${chuKy.toString('base64url')}`;
}
async function api(method, path, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}
const openssl = (...args) => execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'] });

if (existsSync(P12)) {
  console.error(`Đã có ${P12} — xoá/đổi tên nó trước nếu thật sự muốn tạo bộ mới (bộ cũ vẫn sống tới khi hết hạn).`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'ky-ios-'));
try {
  // 1. Khoá + CSR (khoá không rời máy)
  openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(tmp, 'key.pem'),
    '-out', join(tmp, 'csr.pem'), '-subj', '/CN=Cozy Pi CI/O=Cozy Pi/C=VN');

  // 2. Chứng chỉ Apple Distribution
  const cert = await api('POST', '/v1/certificates', {
    data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: readFileSync(join(tmp, 'csr.pem'), 'utf8') } },
  }).catch((e) => {
    if (/limit|maximum|already/i.test(String(e))) {
      throw new Error(`${e}\n\nĐã đủ số chứng chỉ phân phối tối đa. Vào developer.apple.com → Certificates, thu hồi (Revoke) cái không dùng rồi chạy lại.`);
    }
    throw e;
  });
  const certId = cert.data.id;
  writeFileSync(join(tmp, 'cert.der'), Buffer.from(cert.data.attributes.certificateContent, 'base64'));
  openssl('x509', '-inform', 'DER', '-in', join(tmp, 'cert.der'), '-out', join(tmp, 'cert.pem'));
  console.log(`✓ Chứng chỉ phân phối: ${cert.data.attributes.name} (hết hạn ${cert.data.attributes.expirationDate?.slice(0, 10)})`);

  // 3. App ID
  const bids = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=20`);
  const bid = bids.data.find((b) => b.attributes.identifier === BUNDLE_ID);
  if (!bid) throw new Error(`Chưa có App ID ${BUNDLE_ID} — đăng ký ở developer.apple.com → Identifiers trước.`);

  // 4. Profile App Store (xoá bản cùng tên cũ để CI luôn trỏ đúng một cái)
  const cu = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(TEN_PROFILE)}&limit=20`);
  for (const p of cu.data) await api('DELETE', `/v1/profiles/${p.id}`);
  const prof = await api('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: TEN_PROFILE, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bid.id } },
        certificates: { data: [{ type: 'certificates', id: certId }] },
      },
    },
  });
  writeFileSync(MOBILEPROVISION, Buffer.from(prof.data.attributes.profileContent, 'base64'), { mode: 0o600 });
  console.log(`✓ Profile: ${TEN_PROFILE} (${prof.data.attributes.uuid})`);

  // 5. .p12 — mã hoá kiểu 3DES/SHA1 vì Keychain của macOS không mở được kiểu
  // AES mặc định của OpenSSL 3 ("MAC verification failed" lúc `security import`).
  const mk = randomBytes(18).toString('base64url');
  execFileSync('openssl', ['pkcs12', '-export', '-inkey', join(tmp, 'key.pem'), '-in', join(tmp, 'cert.pem'),
    '-name', 'Cozy Pi Apple Distribution', '-out', P12, '-passout', 'env:MK',
    '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1'],
  { env: { ...process.env, MK: mk }, stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(MATKHAU, mk + '\n', { mode: 0o600 });
  console.log(`✓ Đã lưu: ${P12}, ${MOBILEPROVISION}, ${MATKHAU}`);

  if (co === '--gh') {
    // Giá trị đi qua stdin của gh — không lên dòng lệnh, không vào shell history
    const nap = (ten, giaTri) => execFileSync('gh', ['secret', 'set', ten], { input: giaTri, stdio: ['pipe', 'inherit', 'inherit'] });
    nap('IOS_DIST_P12_BASE64', readFileSync(P12).toString('base64'));
    nap('IOS_DIST_P12_PASSWORD', mk);
    nap('IOS_PROFILE_BASE64', readFileSync(MOBILEPROVISION).toString('base64'));
    console.log('✓ Đã nạp IOS_DIST_P12_BASE64, IOS_DIST_P12_PASSWORD, IOS_PROFILE_BASE64 vào GitHub.');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
