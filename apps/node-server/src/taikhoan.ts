import { createHmac, createHash, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify, type webcrypto } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'mysql2/promise';

/**
 * TÀI KHOẢN — đăng nhập Google hoặc Apple, điểm tích luỹ, kỷ lục, danh hiệu.
 *
 * CHỈ CÓ Ở SERVER NODE. Bản Cloudflare không có MySQL nên không có tài khoản;
 * client dò `GET /api/auth/config` lúc mở app — 404 là giấu nút đăng nhập và
 * mọi thứ chạy y như trước (chơi ẩn danh, thành tích nằm ở localStorage).
 *
 * Vì sao Google chứ không tự giữ mật khẩu: trò chơi với bạn bè, không ai muốn
 * nghĩ thêm một mật khẩu, và mình cũng không muốn giữ nó. Google trả về một
 * ID token; server xác minh token đó qua endpoint `tokeninfo` của Google rồi
 * cấp PHIÊN RIÊNG của mình (HMAC, 30 ngày) — client không bao giờ gửi lại token
 * Google lần hai.
 *
 * APPLE (bắt buộc với App Store, luật 4.8: app có đăng nhập Google thì phải có
 * Sign in with Apple). Apple KHÔNG có `tokeninfo`, nên ở đây tự kiểm chữ ký
 * RS256 bằng bộ khoá công khai `appleid.apple.com/auth/keys` (giữ 1 giờ, gặp
 * `kid` lạ thì nạp lại — Apple xoay khoá). `aud` là bundle id (app iOS) HOẶC
 * Services ID (web), nên server nhận một DANH SÁCH. Tên người chỉ có ở LẦN ĐẦU
 * đăng nhập và đi từ client chứ không nằm trong token — lần sau không được ghi
 * đè tên đã có bằng rỗng.
 *
 * XOÁ TÀI KHOẢN (`DELETE /api/me`, cả hai store bắt buộc): xoá hàng `users`,
 * kỷ lục và danh hiệu đi theo nhờ `ON DELETE CASCADE`. Apple còn đòi THU HỒI
 * token qua REST — cần khoá .p8 (`APPLE_TEAM_ID` + `APPLE_KEY_ID` +
 * `APPLE_PRIVATE_KEY`); có khoá thì lúc đăng nhập đổi `authorizationCode` lấy
 * refresh token, lúc xoá thì thu hồi nó. Thiếu khoá thì vẫn xoá được, chỉ bỏ
 * bước thu hồi.
 *
 * KHÔNG CHỐNG GIAN LẬN: kết quả ván offline do client báo lên, server chỉ kiểm
 * biên (điểm ≤ 100.000, kết quả thuộc ba giá trị). Cùng lý do với PREDEAL —
 * mở DevTools là sửa được, mà trò chơi với bạn bè nên không chống bằng code.
 * Chỉ chống LỖI CỦA MÌNH: mọi phép cộng đều idempotent ở phía bảng kỷ lục
 * (giữ MAX) và danh hiệu (INSERT IGNORE); riêng tổng điểm thì cộng dồn, nên
 * client chỉ gửi MỘT lần mỗi ván (sau khi watcher kết ván chạy).
 */

/** Hồ sơ gửi về client — đúng thứ màn tài khoản vẽ. */
export interface HoSo {
  id: number;
  name: string;
  avatar: string | null;
  totalScore: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  best: Record<string, { score: number; moves: number; seconds: number }>;
  achievements: string[];
}

export const HAN_PHIEN_MS = 30 * 24 * 60 * 60 * 1000;
const DIEM_TOI_DA = 100_000;
const THAN_TOI_DA = 16 * 1024;

export const TAO_BANG_TAI_KHOAN = [
  `CREATE TABLE IF NOT EXISTS users (
     id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
     google_sub  VARCHAR(64)  NULL,
     apple_sub   VARCHAR(64)  NULL,
     email       VARCHAR(190) NULL,
     name        VARCHAR(64)  NOT NULL,
     avatar_url  VARCHAR(512) NULL,
     total_score BIGINT       NOT NULL DEFAULT 0,
     matches     INT          NOT NULL DEFAULT 0,
     wins        INT          NOT NULL DEFAULT 0,
     losses      INT          NOT NULL DEFAULT 0,
     draws       INT          NOT NULL DEFAULT 0,
     created_at  BIGINT       NOT NULL DEFAULT 0,
     last_login  BIGINT       NOT NULL DEFAULT 0,
     apple_refresh VARCHAR(512) NULL,
     apple_client  VARCHAR(128) NULL,
     UNIQUE KEY uq_users_sub (google_sub),
     UNIQUE KEY uq_users_apple (apple_sub),
     INDEX idx_users_score (total_score)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS user_best (
     user_id   BIGINT      NOT NULL,
     board_key VARCHAR(32) NOT NULL,
     score     INT         NOT NULL DEFAULT 0,
     moves     INT         NOT NULL DEFAULT 0,
     seconds   INT         NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, board_key),
     CONSTRAINT fk_user_best_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS user_achievements (
     user_id        BIGINT      NOT NULL,
     achievement_id VARCHAR(32) NOT NULL,
     unlocked_at    BIGINT      NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, achievement_id),
     CONSTRAINT fk_user_ach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

/**
 * Nâng bảng `users` có từ trước Apple. MySQL không có `ADD COLUMN IF NOT EXISTS`
 * nên dò `information_schema` trước; chạy lại bao nhiêu lần cũng được.
 */
const NANG_CAP_USERS: [cot: string, cau: string][] = [
  ['apple_sub', 'ALTER TABLE users ADD COLUMN apple_sub VARCHAR(64) NULL AFTER google_sub, ADD UNIQUE KEY uq_users_apple (apple_sub)'],
  ['apple_refresh', 'ALTER TABLE users ADD COLUMN apple_refresh VARCHAR(512) NULL'],
  ['apple_client', 'ALTER TABLE users ADD COLUMN apple_client VARCHAR(128) NULL']
];

/* ---------- phiên: `uid.exp.chữký`, ký HMAC-SHA256 ---------- */

function ky(secret: string, than: string): string {
  return createHmac('sha256', secret).update(than).digest('base64url');
}

export function taoPhien(secret: string, uid: number, now: number): string {
  const than = `${uid}.${now + HAN_PHIEN_MS}`;
  return `${than}.${ky(secret, than)}`;
}

/** uid của phiên còn hạn, hoặc null. */
export function docPhien(secret: string, token: string | undefined, now: number): number | null {
  if (!token) return null;
  const m = /^(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!m) return null;
  const [, uid, exp, chuKy] = m;
  if (Number(exp) <= now) return null;
  const dung = Buffer.from(ky(secret, `${uid}.${exp}`));
  const nhan = Buffer.from(chuKy!);
  if (dung.length !== nhan.length || !timingSafeEqual(dung, nhan)) return null;
  return Number(uid);
}

/* ---------- xác minh ID token Google ---------- */

export interface NguoiGoogle { sub: string; email: string | null; name: string; picture: string | null }

/**
 * Hỏi Google thay vì tự kiểm chữ ký: không phải nạp bộ khoá công khai, không
 * phải xoay khoá. Mỗi lần đăng nhập một lượt gọi ra ngoài — đăng nhập là việc
 * hiếm (phiên 30 ngày), không nằm trên đường đi của ván chơi.
 */
export async function xacMinhGoogle(
  credential: string, clientId: string, now: number,
  layFetch: typeof fetch = fetch
): Promise<NguoiGoogle | null> {
  if (!/^[A-Za-z0-9_.-]{20,4096}$/.test(credential)) return null;
  const res = await layFetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const t = await res.json() as Record<string, string | undefined>;
  if (t.aud !== clientId || !t.sub) return null;
  if (Number(t.exp ?? 0) * 1000 <= now) return null;
  const name = (t.name ?? t.email?.split('@')[0] ?? 'Người chơi').slice(0, 64);
  return { sub: t.sub, email: t.email ?? null, name, picture: t.picture ?? null };
}

/* ---------- xác minh identity token Apple ---------- */

export interface NguoiApple { sub: string; email: string | null; aud: string }

type Jwk = webcrypto.JsonWebKey & { kid?: string };
let khoaApple: { luc: number; keys: Jwk[] } | null = null;
const GIU_KHOA_MS = 60 * 60 * 1000;

async function layKhoaApple(kid: string, now: number, layFetch: typeof fetch): Promise<Jwk | null> {
  const tim = () => khoaApple?.keys.find((k) => k.kid === kid) ?? null;
  if (khoaApple && now - khoaApple.luc < GIU_KHOA_MS && tim()) return tim();
  const res = await layFetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) return tim();
  khoaApple = { luc: now, keys: ((await res.json()) as { keys?: Jwk[] }).keys ?? [] };
  return tim();
}

/** Chỉ để test: quên bộ khoá đã giữ. */
export function _quenKhoaApple(): void { khoaApple = null; }

function docB64Json(s: string): Record<string, unknown> | null {
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<string, unknown>; } catch { return null; }
}

export async function xacMinhApple(
  idToken: string, audiences: string[], now: number,
  layFetch: typeof fetch = fetch
): Promise<NguoiApple | null> {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken) || idToken.length > 8192) return null;
  const [h, b, c] = idToken.split('.') as [string, string, string];
  const head = docB64Json(h);
  const t = docB64Json(b);
  if (!head || !t || head.alg !== 'RS256' || typeof head.kid !== 'string') return null;
  const jwk = await layKhoaApple(head.kid, now, layFetch);
  if (!jwk) return null;
  const dung = verify('RSA-SHA256', Buffer.from(`${h}.${b}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(c, 'base64url'));
  if (!dung) return null;
  if (t.iss !== 'https://appleid.apple.com' || typeof t.sub !== 'string' || !t.sub) return null;
  if (typeof t.aud !== 'string' || !audiences.includes(t.aud)) return null;
  if (Number(t.exp ?? 0) * 1000 <= now) return null;
  return { sub: t.sub, email: typeof t.email === 'string' ? t.email : null, aud: t.aud };
}

/* ---------- REST Apple: đổi mã lấy refresh token, thu hồi khi xoá tài khoản ---------- */

export interface KhoaApple { teamId: string; keyId: string; privateKey: string }

/** client_secret của Apple là một JWT ES256 tự ký bằng khoá .p8, sống tối đa 6 tháng. */
export function taoClientSecretApple(k: KhoaApple, clientId: string, now: number): string {
  const giay = Math.floor(now / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', kid: k.keyId })).toString('base64url');
  const b = Buffer.from(JSON.stringify({
    iss: k.teamId, iat: giay, exp: giay + 300, aud: 'https://appleid.apple.com', sub: clientId
  })).toString('base64url');
  const chuKy = sign('sha256', Buffer.from(`${h}.${b}`), {
    key: createPrivateKey(k.privateKey.replace(/\\n/g, '\n')), dsaEncoding: 'ieee-p1363'
  });
  return `${h}.${b}.${chuKy.toString('base64url')}`;
}

async function goiApple(path: string, form: Record<string, string>, layFetch: typeof fetch): Promise<Response> {
  return layFetch(`https://appleid.apple.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString()
  });
}

/* ---------- kết quả một ván do client báo ---------- */

export interface VanBao {
  ketQua: 'thang' | 'thua' | 'hoa';
  score: number;
  /** Khoá kỷ lục — ĐÚNG khoá của `store.best()` ở client (`mode:L<cấp>`), chỉ ván một mình. */
  boardKey?: string;
  moves?: number;
  seconds?: number;
  achievements?: string[];
}

/** Lọc một thân JSON tuỳ ý thành VanBao hợp lệ, hoặc null. */
export function locVan(x: unknown): VanBao | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ketQua !== 'thang' && o.ketQua !== 'thua' && o.ketQua !== 'hoa') return null;
  const score = Number(o.score);
  if (!Number.isFinite(score) || score < 0 || score > DIEM_TOI_DA) return null;
  const ra: VanBao = { ketQua: o.ketQua, score: Math.round(score) };
  if (typeof o.boardKey === 'string' && /^[a-z]+:L?\d{1,3}$/.test(o.boardKey)) ra.boardKey = o.boardKey;
  if (Number.isFinite(Number(o.moves))) ra.moves = Math.max(0, Math.round(Number(o.moves)));
  if (Number.isFinite(Number(o.seconds))) ra.seconds = Math.max(0, Math.round(Number(o.seconds)));
  if (Array.isArray(o.achievements)) {
    ra.achievements = o.achievements
      .filter((a): a is string => typeof a === 'string' && /^[a-z0-9-]{1,32}$/.test(a))
      .slice(0, 32);
  }
  return ra;
}

/* ---------- tầng HTTP ---------- */

function docThan(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c: Buffer) => {
      s += c.toString('utf8');
      if (s.length > THAN_TOI_DA) { resolve(null); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(s)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

export interface TaiKhoan {
  /** Trả true nếu đã xử lý request này. */
  xuLy(req: IncomingMessage, res: ServerResponse, url: URL, json: (res: ServerResponse, data: unknown, status?: number) => void): Promise<boolean>;
}

export interface EnvTaiKhoan {
  GOOGLE_CLIENT_ID?: string;
  /** Bundle id của app iOS (`com.hello314.flipmatch`) — bật đăng nhập Apple trong app. */
  APPLE_BUNDLE_ID?: string;
  /** Services ID — bật đăng nhập Apple trên WEB (cần đăng ký tên miền ở Apple). */
  APPLE_SERVICES_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  /** Nội dung file .p8 (xuống dòng thật hoặc `\\n`). */
  APPLE_PRIVATE_KEY?: string;
  AUTH_SECRET?: string;
  MYSQL_URL?: string;
}

/**
 * Mở tầng tài khoản. Trả null nếu thiếu MySQL hoặc không có cách đăng nhập nào
 * (cả GOOGLE_CLIENT_ID lẫn APPLE_BUNDLE_ID/APPLE_SERVICES_ID đều trống) — khi đó
 * mọi route `/api/auth/*`, `/api/me*`, `/api/bxh` không tồn tại (404), client
 * tự hiểu là server này không có tài khoản.
 */
export async function moTaiKhoan(
  pool: Pool | null, env: EnvTaiKhoan, layFetch: typeof fetch = fetch
): Promise<TaiKhoan | null> {
  const clientId = env.GOOGLE_CLIENT_ID ?? '';
  const appleAud = [env.APPLE_BUNDLE_ID, env.APPLE_SERVICES_ID].filter((x): x is string => !!x);
  if (!pool || (!clientId && !appleAud.length)) return null;
  const khoaRest: KhoaApple | null = env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
    ? { teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: env.APPLE_PRIVATE_KEY }
    : null;
  /*
   * Khoá ký phiên: AUTH_SECRET nếu có; không thì băm từ MYSQL_URL — chuỗi đó
   * đã là bí mật (chứa mật khẩu) và ổn định qua các lần khởi động, nên phiên
   * không chết theo pod. Khoá ngẫu nhiên mỗi lần chạy thì mỗi lần Keel thay
   * ảnh là mọi người bị đăng xuất.
   */
  const secret = env.AUTH_SECRET
    ?? createHash('sha256').update(`mm-auth:${env.MYSQL_URL ?? ''}`).digest('hex');
  for (const cau of TAO_BANG_TAI_KHOAN) await pool.query(cau);
  await pool.query('ALTER TABLE users MODIFY google_sub VARCHAR(64) NULL');
  for (const [cot, cau] of NANG_CAP_USERS) {
    const [co] = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`, [cot]
    );
    if (!(co as unknown[]).length) await pool.query(cau);
  }

  /** Thu hồi token Apple của một người (khi xoá tài khoản). Lỗi thì ghi log rồi bỏ qua — không được chặn việc xoá. */
  async function thuHoiApple(refresh: string, client: string, now: number): Promise<void> {
    if (!khoaRest) return;
    try {
      const res = await goiApple('/auth/revoke', {
        client_id: client, client_secret: taoClientSecretApple(khoaRest, client, now),
        token: refresh, token_type_hint: 'refresh_token'
      }, layFetch);
      if (!res.ok) console.error('[taikhoan] Apple thu hồi lỗi', res.status);
    } catch (e) { console.error('[taikhoan] Apple thu hồi lỗi:', (e as Error).message); }
  }

  /** Đổi authorizationCode lấy refresh token (chỉ khi có khoá .p8). */
  async function doiMaApple(code: string, client: string, now: number): Promise<string | null> {
    if (!khoaRest || !/^[A-Za-z0-9._-]{10,1024}$/.test(code)) return null;
    try {
      const res = await goiApple('/auth/token', {
        client_id: client, client_secret: taoClientSecretApple(khoaRest, client, now),
        code, grant_type: 'authorization_code'
      }, layFetch);
      if (!res.ok) { console.error('[taikhoan] Apple đổi mã lỗi', res.status); return null; }
      const r = await res.json() as { refresh_token?: string };
      return r.refresh_token ?? null;
    } catch (e) { console.error('[taikhoan] Apple đổi mã lỗi:', (e as Error).message); return null; }
  }

  async function hoSo(uid: number): Promise<HoSo | null> {
    const [rows] = await pool!.query('SELECT * FROM users WHERE id = ?', [uid]);
    const u = (rows as Record<string, unknown>[])[0];
    if (!u) return null;
    const [bests] = await pool!.query('SELECT board_key, score, moves, seconds FROM user_best WHERE user_id = ?', [uid]);
    const [achs] = await pool!.query('SELECT achievement_id FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at', [uid]);
    const best: HoSo['best'] = {};
    for (const b of bests as { board_key: string; score: number; moves: number; seconds: number }[]) {
      best[b.board_key] = { score: Number(b.score), moves: Number(b.moves), seconds: Number(b.seconds) };
    }
    return {
      id: Number(u.id), name: String(u.name), avatar: (u.avatar_url as string | null) ?? null,
      totalScore: Number(u.total_score), matches: Number(u.matches),
      wins: Number(u.wins), losses: Number(u.losses), draws: Number(u.draws),
      best, achievements: (achs as { achievement_id: string }[]).map((a) => a.achievement_id)
    };
  }

  /** Ghi kỷ lục (giữ MAX điểm) và danh hiệu (INSERT IGNORE) — cả hai gọi lại bao nhiêu lần cũng được. */
  async function ghiKyLucVaDanhHieu(
    uid: number, best: Record<string, { score: number; moves: number; seconds: number }>, achievements: string[], now: number
  ): Promise<void> {
    for (const [k, r] of Object.entries(best)) {
      if (!/^[a-z]+:L?\d{1,3}$/.test(k)) continue;
      await pool!.execute(
        `INSERT INTO user_best (user_id, board_key, score, moves, seconds) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           moves = IF(VALUES(score) > score, VALUES(moves), moves),
           seconds = IF(VALUES(score) > score, VALUES(seconds), seconds),
           score = GREATEST(score, VALUES(score))`,
        [uid, k, Math.min(DIEM_TOI_DA, Math.max(0, Math.round(Number(r.score) || 0))),
          Math.max(0, Math.round(Number(r.moves) || 0)), Math.max(0, Math.round(Number(r.seconds) || 0))]
      );
    }
    for (const a of achievements) {
      if (!/^[a-z0-9-]{1,32}$/.test(a)) continue;
      await pool!.execute(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)',
        [uid, a, now]
      );
    }
  }

  function uidTu(req: IncomingMessage, now: number): number | null {
    const h = req.headers.authorization ?? '';
    return docPhien(secret, h.startsWith('Bearer ') ? h.slice(7) : undefined, now);
  }

  return {
    async xuLy(req, res, url, json) {
      const p = url.pathname;
      const now = Date.now();

      if (p === '/api/auth/config' && req.method === 'GET') {
        json(res, {
          googleClientId: clientId || undefined,
          apple: appleAud.length ? { app: !!env.APPLE_BUNDLE_ID, webClientId: env.APPLE_SERVICES_ID || undefined } : undefined
        });
        return true;
      }

      if (p === '/api/auth/apple' && req.method === 'POST') {
        if (!appleAud.length) { json(res, { error: 'Server này không bật đăng nhập Apple' }, 404); return true; }
        const than = await docThan(req) as { idToken?: unknown; code?: unknown; name?: unknown } | null;
        const tok = typeof than?.idToken === 'string' ? than.idToken : '';
        let ng: NguoiApple | null = null;
        try { ng = await xacMinhApple(tok, appleAud, now, layFetch); } catch (e) {
          console.error('[taikhoan] kiểm token Apple lỗi:', (e as Error).message);
        }
        if (!ng) { json(res, { error: 'Apple không xác nhận được đăng nhập này' }, 401); return true; }
        // Tên chỉ có ở lần đầu (client gửi); không có thì lấy phần trước @ của email
        const tenGui = typeof than?.name === 'string' ? than.name.trim().slice(0, 64) : '';
        const tenMoi = tenGui || ng.email?.split('@')[0]?.slice(0, 64) || 'Người chơi';
        const refresh = typeof than?.code === 'string' ? await doiMaApple(than.code, ng.aud, now) : null;
        await pool!.execute(
          `INSERT INTO users (apple_sub, email, name, created_at, last_login, apple_refresh, apple_client)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email = COALESCE(VALUES(email), email),
             name = IF(? <> '', VALUES(name), name), last_login = VALUES(last_login),
             apple_refresh = COALESCE(VALUES(apple_refresh), apple_refresh),
             apple_client = COALESCE(VALUES(apple_client), apple_client)`,
          [ng.sub, ng.email, tenMoi, now, now, refresh, refresh ? ng.aud : null, tenGui]
        );
        const [rows] = await pool!.query('SELECT id FROM users WHERE apple_sub = ?', [ng.sub]);
        const uid = Number((rows as { id: number }[])[0]!.id);
        json(res, { token: taoPhien(secret, uid, now), me: await hoSo(uid) });
        return true;
      }

      if (p === '/api/auth/google' && req.method === 'POST') {
        if (!clientId) { json(res, { error: 'Server này không bật đăng nhập Google' }, 404); return true; }
        const than = await docThan(req) as { credential?: unknown } | null;
        const cred = typeof than?.credential === 'string' ? than.credential : '';
        let ng: NguoiGoogle | null = null;
        try { ng = await xacMinhGoogle(cred, clientId, now); } catch (e) {
          console.error('[taikhoan] hỏi Google lỗi:', (e as Error).message);
        }
        if (!ng) { json(res, { error: 'Google không xác nhận được đăng nhập này' }, 401); return true; }
        await pool!.execute(
          `INSERT INTO users (google_sub, email, name, avatar_url, created_at, last_login)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name),
             avatar_url = VALUES(avatar_url), last_login = VALUES(last_login)`,
          [ng.sub, ng.email, ng.name, ng.picture, now, now]
        );
        const [rows] = await pool!.query('SELECT id FROM users WHERE google_sub = ?', [ng.sub]);
        const uid = Number((rows as { id: number }[])[0]!.id);
        json(res, { token: taoPhien(secret, uid, now), me: await hoSo(uid) });
        return true;
      }

      if (p === '/api/bxh' && req.method === 'GET') {
        const [rows] = await pool!.query(
          `SELECT id, name, avatar_url, total_score, wins, matches FROM users
           WHERE matches > 0 ORDER BY total_score DESC, wins DESC LIMIT 20`
        );
        json(res, {
          top: (rows as Record<string, unknown>[]).map((r) => ({
            id: Number(r.id), name: String(r.name), avatar: (r.avatar_url as string | null) ?? null,
            totalScore: Number(r.total_score), wins: Number(r.wins), matches: Number(r.matches)
          }))
        });
        return true;
      }

      if (!p.startsWith('/api/me')) return false;
      const uid = uidTu(req, now);
      if (uid === null) { json(res, { error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }, 401); return true; }

      if (p === '/api/me' && req.method === 'GET') {
        const me = await hoSo(uid);
        if (!me) { json(res, { error: 'Tài khoản không còn' }, 401); return true; }
        json(res, { me });
        return true;
      }

      /*
       * XOÁ TÀI KHOẢN — App Store (5.1.1(v)) và Google Play đều bắt buộc.
       * Kỷ lục + danh hiệu đi theo nhờ ON DELETE CASCADE. Bản lưu cục bộ trên
       * máy KHÔNG đụng tới: đó là của máy, có từ trước khi đăng nhập.
       */
      if (p === '/api/me' && req.method === 'DELETE') {
        const [rows] = await pool!.query('SELECT apple_refresh, apple_client FROM users WHERE id = ?', [uid]);
        const u = (rows as { apple_refresh: string | null; apple_client: string | null }[])[0];
        await pool!.execute('DELETE FROM users WHERE id = ?', [uid]);
        if (u?.apple_refresh && u.apple_client) await thuHoiApple(u.apple_refresh, u.apple_client, now);
        json(res, { ok: true });
        return true;
      }

      // Một ván vừa xong
      if (p === '/api/me/van' && req.method === 'POST') {
        const van = locVan(await docThan(req));
        if (!van) { json(res, { error: 'Kết quả ván không hợp lệ' }, 400); return true; }
        const cot = van.ketQua === 'thang' ? 'wins' : van.ketQua === 'thua' ? 'losses' : 'draws';
        await pool!.execute(
          `UPDATE users SET total_score = total_score + ?, matches = matches + 1, \`${cot}\` = \`${cot}\` + 1 WHERE id = ?`,
          [van.score, uid]
        );
        const best = van.boardKey && van.ketQua === 'thang'
          ? { [van.boardKey]: { score: van.score, moves: van.moves ?? 0, seconds: van.seconds ?? 0 } }
          : {};
        await ghiKyLucVaDanhHieu(uid, best, van.achievements ?? [], now);
        json(res, { me: await hoSo(uid) });
        return true;
      }

      /*
       * Đồng bộ bản lưu cục bộ lên tài khoản — gọi SAU MỖI lần đăng nhập, nhờ
       * thế người chơi lâu năm không mất gì khi mới tạo tài khoản, và đổi máy
       * thì kéo được thành tích về. Kỷ lục và danh hiệu hợp theo MAX/hợp nhất
       * nên gọi lại không sao; tổng điểm chỉ nâng LÊN khi bản cục bộ cao hơn
       * (không cộng dồn — cộng dồn là mỗi lần đăng nhập điểm nhân đôi).
       */
      if (p === '/api/me/dongbo' && req.method === 'POST') {
        const than = await docThan(req) as Record<string, unknown> | null;
        if (!than) { json(res, { error: 'Thân không hợp lệ' }, 400); return true; }
        const tong = Math.min(10_000_000, Math.max(0, Math.round(Number(than.totalScore) || 0)));
        await pool!.execute('UPDATE users SET total_score = GREATEST(total_score, ?) WHERE id = ?', [tong, uid]);
        const best = (than.best && typeof than.best === 'object' ? than.best : {}) as HoSo['best'];
        const achs = Array.isArray(than.achievements) ? than.achievements.filter((a): a is string => typeof a === 'string') : [];
        await ghiKyLucVaDanhHieu(uid, best, achs, now);
        json(res, { me: await hoSo(uid) });
        return true;
      }

      json(res, { error: 'Không có đường này' }, 404);
      return true;
    }
  };
}
