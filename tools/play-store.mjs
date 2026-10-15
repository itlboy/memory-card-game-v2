#!/usr/bin/env node
/**
 * ĐIỀN TRANG GOOGLE PLAY qua Play Developer API: tên, mô tả ngắn, mô tả đầy đủ
 * (12 ngôn ngữ), ảnh chụp điện thoại, ảnh bìa, icon. Chạy lại được (ảnh cũ bị
 * thay, chữ bị ghi đè) — sửa docs/store-listing.md rồi chạy lại là cập nhật.
 *
 *   node tools/play-store.mjs <service-account.json> [thư mục ảnh]
 *     thư mục ảnh: con <lang>/0*.png (KHUNG=android tools/chup-store.mjs)
 *
 * CI: .github/workflows/play-store.yml (secret PLAY_SERVICE_ACCOUNT_JSON).
 * KHÔNG làm được qua API (bấm trên Play Console): phân loại nội dung, Data safety,
 * đối tượng mục tiêu, quảng cáo, quyền truy cập app, chính sách quyền riêng tư.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSign } from 'node:crypto';

const PKG = 'com.cozypi.flipmatch';
const [keyPath, thuMucAnh] = process.argv.slice(2);
if (!keyPath) { console.error('Cách dùng: node tools/play-store.mjs <service-account.json> [thư mục ảnh]'); process.exit(2); }
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

// ── OAuth2 cho service account (JWT RS256 → access token) ──
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
async function api(method, path, body, headers = {}) {
  const r = await fetch(path.startsWith('http') ? path : GOC + path, {
    method, headers: { Authorization: `Bearer ${tk}`, ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Nội dung từ docs/store-listing.md (cùng nguồn với App Store) ──
const md = readFileSync(new URL('../docs/store-listing.md', import.meta.url), 'utf8');
function phan(tieuDe) {
  const i = md.indexOf(`## ${tieuDe}`);
  if (i < 0) throw new Error(`store-listing.md thiếu mục "## ${tieuDe}"`);
  const j = md.indexOf('\n## ', i + 3);
  const f = {};
  for (const m of md.slice(i, j < 0 ? undefined : j).matchAll(/\*\*([^*]+)\*\* \((\d+)\)[^\n]*\n```\n(.*?)\n```/gs)) {
    if (m[3].length > Number(m[2])) throw new Error(`${tieuDe} / ${m[1]}: ${m[3].length} ký tự > ${m[2]}`);
    f[m[1]] = m[3];
  }
  return f;
}
// Mã ngôn ngữ của Play (khác App Store ở vài chỗ: zh-CN, ja-JP, ko-KR, ru-RU)
const NGON_NGU = [
  ['en-US', 'English (U.S.)', 'en'], ['vi', 'Tiếng Việt', 'vi'], ['es-ES', 'Español', 'es'],
  ['pt-BR', 'Português (Brasil)', 'pt'], ['fr-FR', 'Français', 'fr'], ['de-DE', 'Deutsch', 'de'],
  ['ja-JP', '日本語', 'ja'], ['ko-KR', '한국어', 'ko'], ['zh-CN', '简体中文', 'zh'],
  ['ru-RU', 'Русский', 'ru'], ['id', 'Bahasa Indonesia', 'id'], ['th', 'ไทย', 'th'],
  ['it-IT', 'Italiano', 'it'], ['tr-TR', 'Türkçe', 'tr'], ['zh-TW', '繁體中文', 'zh-TW'],
];

const edit = await api('POST', '/edits', {});
const E = `/edits/${edit.id}`;
console.log(`Edit ${edit.id}`);

async function tai(lang, loai, file) {
  await api('POST', `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}${E}/listings/${lang}/${loai}?uploadType=media`,
    readFileSync(file), { 'Content-Type': 'image/png' });
}

for (const [lang, tieuDe, anh] of NGON_NGU) {
  const n = phan(tieuDe);
  await api('PUT', `${E}/listings/${lang}`, { language: lang, title: n.Name, shortDescription: n['Short description'], fullDescription: n.Description });
  let soAnh = 0;
  const dir = thuMucAnh ? join(thuMucAnh, anh) : '';
  if (dir && existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => /^\d.*\.png$/.test(f)).sort().slice(0, 8);   // Play: tối đa 8
    if (files.length >= 2) {
      await api('DELETE', `${E}/listings/${lang}/phoneScreenshots`);
      for (const f of files) await tai(lang, 'phoneScreenshots', join(dir, f));
      soAnh = files.length;
    }
  }
  console.log(`✓ ${lang}: ${n.Name} — chữ${soAnh ? ` + ${soAnh} ảnh` : ''}`);
}

// Ảnh bìa + icon: đặt cho ngôn ngữ mặc định, ngôn ngữ khác dùng chung
const goc = new URL('../', import.meta.url).pathname;
await api('DELETE', `${E}/listings/en-US/featureGraphic`);
await tai('en-US', 'featureGraphic', join(goc, 'docs/store-assets/play-feature-graphic.png'));
await api('DELETE', `${E}/listings/en-US/icon`);
await tai('en-US', 'icon', join(goc, 'apps/web/public/icon-512.png'));
console.log('✓ ảnh bìa + icon');

await api('POST', `${E}:commit`);
console.log(`✓ Đã lưu trang Google Play (${PKG})

Còn phải bấm trên Play Console: phân loại nội dung, Data safety, đối tượng mục tiêu,
quảng cáo, quyền truy cập ứng dụng, URL chính sách quyền riêng tư.`);
