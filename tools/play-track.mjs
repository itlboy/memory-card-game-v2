/**
 * ĐƯA MỘT BUILD ANDROID SANG KÊNH THỬ KHÁC trên Google Play (vd. nội bộ → khép kín).
 *
 *   node tools/play-track.mjs <service-account.json>                    → liệt kê các kênh + build đang ở đó
 *   node tools/play-track.mjs <service-account.json> <versionCode> <kênh> → đặt build đó làm bản phát hành của kênh
 *
 * CI: .github/workflows/play-track.yml (secret PLAY_SERVICE_ACCOUNT_JSON).
 * mobile.yml (phat_hanh) tải lên kênh `internal` rồi TỰ gọi công cụ này đưa sang `alpha` (thử nghiệm
 * khép kín) — biến repo PLAY_KENH_THEM đổi kênh đích, `none` để tắt. Chạy tay khi cần đưa
 * một build cũ sang kênh khác.
 * Build phải ĐÃ được tải lên Play (đã có ở kênh nào đó) — công cụ không tải AAB.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PKG = 'com.cozypi.flipmatch';
const [keyPath, versionCode, kenh] = process.argv.slice(2);
if (!keyPath) { console.error('Cách dùng: node tools/play-track.mjs <service-account.json> [versionCode kênh]'); process.exit(2); }
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

async function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = b64({ alg: 'RS256', typ: 'JWT' });
  const than = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
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
const GOC = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
async function api(method, path, body) {
  const r = await fetch(GOC + path, {
    method, headers: { Authorization: `Bearer ${tk}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const edit = await api('POST', '/edits');
const E = `/edits/${edit.id}`;
const { tracks = [] } = await api('GET', `${E}/tracks`);
console.log('Các kênh hiện có:');
for (const t of tracks) {
  const ds = (t.releases ?? []).map((r) => `${r.name ?? '?'} [${(r.versionCodes ?? []).join(',')}] ${r.status}`).join(' · ');
  console.log(`  ${t.track.padEnd(28)} ${ds || '(trống)'}`);
}

if (!versionCode) { await api('DELETE', E); process.exit(0); }
if (!tracks.some((t) => t.track === kenh)) {
  await api('DELETE', E);
  console.error(`✗ Không có kênh "${kenh}" — chọn một tên trong danh sách trên.`); process.exit(1);
}
const nguon = tracks.flatMap((t) => t.releases ?? []).find((r) => (r.versionCodes ?? []).includes(String(versionCode)));
if (!nguon) {
  await api('DELETE', E);
  console.error(`✗ Build ${versionCode} chưa có ở kênh nào — phải tải lên trước (mobile.yml phat_hanh=true).`); process.exit(1);
}
await api('PUT', `${E}/tracks/${kenh}`, {
  track: kenh,
  releases: [{ name: nguon.name, versionCodes: [String(versionCode)], status: 'completed', ...(nguon.releaseNotes ? { releaseNotes: nguon.releaseNotes } : {}) }],
});
const xong = await api('POST', `${E}:commit`);
console.log(`✓ Build ${versionCode} (${nguon.name ?? ''}) → kênh ${kenh} · edit ${xong.id}`);
