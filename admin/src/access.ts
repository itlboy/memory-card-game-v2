/**
 * Kiểm JWT của Cloudflare Access (header `Cf-Access-Jwt-Assertion`).
 *
 * Access đã chắn ở cạnh Cloudflare, nhưng Worker vẫn tự kiểm lại: lỡ ai gỡ ứng dụng Access,
 * thêm route khác, hay bật lại *.workers.dev thì trang KHÔNG tự mở toang. Thiếu cấu hình
 * (ACCESS_AUD rỗng) → từ chối hết, không bao giờ "cho qua vì chưa cấu hình".
 */

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

const khoaCache = new Map<string, { het: number; keys: Jwk[] }>();   // theo từng nhóm Access

const b64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function layKhoa(team: string, epMoi = false): Promise<Jwk[]> {
  const co = khoaCache.get(team);
  if (!epMoi && co && co.het > Date.now()) return co.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`certs ${r.status}`);
  const j = (await r.json()) as { keys: Jwk[] };
  khoaCache.set(team, { het: Date.now() + 3600_000, keys: j.keys });
  return j.keys;
}

export interface NguoiXem { email: string }

/** `teams` có thể là danh sách cách nhau bởi dấu phẩy (lúc đổi tên miền nhóm Access, chấp nhận cả cũ lẫn mới).
 *  Nhóm được chọn theo `iss` của JWT, rồi mới lấy khoá của ĐÚNG nhóm đó. */
export async function kiemAccess(req: Request, teams: string, aud: string): Promise<NguoiXem | null> {
  const dsTeam = teams.split(',').map((t) => t.trim()).filter(Boolean);
  if (!dsTeam.length || !aud) return null;
  const jwt = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) return null;
  let head: { kid?: string; alg?: string };
  let body: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
  try {
    head = JSON.parse(new TextDecoder().decode(b64url(h)));
    body = JSON.parse(new TextDecoder().decode(b64url(p)));
  } catch { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  const team = dsTeam.find((t) => body.iss === `https://${t}`);
  if (!team) return null;

  let keys = await layKhoa(team);
  let jwk = keys.find((k) => k.kid === head.kid);
  if (!jwk) { keys = await layKhoa(team, true); jwk = keys.find((k) => k.kid === head.kid); }   // Access xoay khoá
  if (!jwk) return null;

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!auds.includes(aud)) return null;
  if (body.iss !== `https://${team}`) return null;
  if (!body.exp || body.exp < now - 30) return null;
  if (body.nbf && body.nbf > now + 30) return null;
  return { email: body.email ?? '' };
}
