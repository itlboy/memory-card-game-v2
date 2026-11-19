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
  /*
   * KHÁCH TRÊN BẢNG XẾP HẠNG (19.11.2026, mockup duyệt https://claude.ai/artifact/CYPTEG9edvmDEgEGFuEnzy):
   * người chưa đăng nhập cũng lên bảng chung. Máy tự sinh một MÃ NGẪU NHIÊN (không phải mã thiết bị);
   * server chỉ giữ SHA-256 của mã (`guest_hash`), nên lộ bảng này cũng không giả được khách nào. `name` rỗng
   * = chưa đặt tên → client hiện "Khách 4821" theo ngôn ngữ của người xem.
   */
  `CREATE TABLE IF NOT EXISTS guest_scores (
     guest_hash  CHAR(64)     NOT NULL PRIMARY KEY,
     name        VARCHAR(64)  NOT NULL DEFAULT '',
     total_score BIGINT       NOT NULL DEFAULT 0,
     wins        INT          NOT NULL DEFAULT 0,
     matches     INT          NOT NULL DEFAULT 0,
     created_at  BIGINT       NOT NULL DEFAULT 0,
     updated_at  BIGINT       NOT NULL DEFAULT 0,
     INDEX idx_guest_scores_score (total_score)
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

/** Client OAuth iOS của Lật Thẻ (dự án Google Cloud `lat-the-nkien`, tạo 09.11.2026). */
export const GOOGLE_IOS_MAC_DINH = '43109043290-lfla0jfjm3kllm8t67uk2u60aqou08l5.apps.googleusercontent.com';

export interface NguoiGoogle { sub: string; email: string | null; name: string; picture: string | null }

/**
 * Hỏi Google thay vì tự kiểm chữ ký: không phải nạp bộ khoá công khai, không
 * phải xoay khoá. Mỗi lần đăng nhập một lượt gọi ra ngoài — đăng nhập là việc
 * hiếm (phiên 30 ngày), không nằm trên đường đi của ván chơi.
 */
export async function xacMinhGoogle(
  credential: string, audiences: string[], now: number,
  layFetch: typeof fetch = fetch
): Promise<NguoiGoogle | null> {
  if (!/^[A-Za-z0-9_.-]{20,4096}$/.test(credential)) return null;
  const res = await layFetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const t = await res.json() as Record<string, string | undefined>;
  if (!t.aud || !audiences.includes(t.aud) || !t.sub) return null;
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

/* ---------- khách trên bảng xếp hạng ---------- */

/** Khách không chơi quá 60 ngày thì rơi khỏi bảng chung (vẫn thấy hạng của chính mình). */
/** Top 20 trên bảng xếp hạng giữ trong RAM bao lâu (dùng chung mọi người hỏi). */
export const BXH_CACHE_MS = 30_000;

/**
 * Xếp + cắt top 20 (điểm giảm dần, hoà thì nhiều ván thắng hơn đứng trên). Có `toi` → bỏ dòng CŨ của người
 * hỏi trong bản cache rồi chèn dòng MỚI theo điểm hiện tại — cache 30 giây không làm người vừa chơi xong
 * thấy mình sai chỗ / vắng mặt.
 */
export function ghepTop(ds: Record<string, unknown>[], toi?: Record<string, unknown>, k?: string | null, laKhach?: boolean): Record<string, unknown>[] {
  const cungNguoi = (r: Record<string, unknown>) => k != null && String(r.k) === k && (Number(r.la_khach) === 1) === !!laKhach;
  const kq = ds.filter((r) => !toi || !cungNguoi(r));
  if (toi) kq.push(toi);
  return kq.sort((a, b) => Number(b.total_score) - Number(a.total_score) || Number(b.wins) - Number(a.wins)).slice(0, 20);
}

export const KHACH_HET_HAN_MS = 60 * 24 * 60 * 60 * 1000;
/**
 * Mặt thú trên bảng: tài khoản theo id, khách theo mã băm — ổn định giữa các lần mở.
 * 49 MẶT (20.11.2026, chủ dự án: "trên bảng xếp hạng thấy bị trùng lặp… thêm hết đi"): 16 cũ + 8 đầu thú còn lại
 * + 25 thú nguyên con rõ dáng ở cỡ nhỏ. TRÁNH: 🐣🐥 (mặt máy Gà mờ/Gà cứng), 🐲 (nhầm máy Rồng thần), thú đáng sợ
 * (app 4+), emoji Unicode 15+ (🫎🪿🪼 — Android cũ ra ô vuông). Đổi số phần tử là đổi mặt của MỌI người (mod) —
 * chỉ THÊM vào cuối danh sách cũng vẫn đổi; chấp nhận một lần.
 */
export const MAT_BXH = [
  '🦊', '🐼', '🐯', '🐸', '🐵', '🐨', '🦁', '🐷', '🐧', '🐙', '🐰', '🐶', '🐱', '🐻', '🦉', '🐮',
  '🐭', '🐹', '🐻‍❄️', '🐔', '🐺', '🐗', '🐴', '🦄',
  '🐳', '🐬', '🐠', '🦀', '🐢', '🦭', '🐿️', '🦔', '🦝', '🦦', '🦥', '🐘', '🦒', '🦓', '🦘', '🐊', '🦖',
  '🦆', '🦜', '🦚', '🦩', '🐝', '🐞', '🦋', '🐌'
];

/** Mã khách (chuỗi ngẫu nhiên do máy sinh) → khoá lưu: SHA-256 hex. Mã sai dạng → null. */
export function maKhach(id: unknown): string | null {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{22,64}$/.test(id)) return null;
  return createHash('sha256').update(`mm-khach:${id}`).digest('hex');
}

/** Số hiện sau chữ "Khách" khi chưa đặt tên (1000–9999), lấy từ mã băm. */
export function soKhach(ma: string): number { return (parseInt(ma.slice(0, 8), 16) % 9000) + 1000; }
export function matTuMa(ma: string): string { return MAT_BXH[parseInt(ma.slice(8, 16), 16) % MAT_BXH.length]!; }

/** Tên hiện công khai: bỏ ký tự điều khiển và `<>`, cắt 16 ký tự (như tên phòng online). */
export function locTen(x: unknown): string {
  if (typeof x !== 'string') return '';
  return [...x.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim();
}

export interface DongKhach { total: number; wins: number; matches: number; updatedAt: number }

/**
 * Điểm khách gửi lên là TỔNG trên máy (không phải từng ván) → gọi lại không nhân đôi.
 * Chống sửa tay ở mức vừa phải: không bao giờ giảm, và mỗi lần chỉ tăng tối đa bằng
 * số ván có thể chơi trong khoảng thời gian đó (một ván ≥ 30 giây, ≤ DIEM_TOI_DA điểm).
 * Lần đầu (máy đã chơi từ trước khi có bảng) nhận tới trần như `/api/me/dongbo`.
 */
export function locDiemKhach(than: { totalScore?: unknown; wins?: unknown; matches?: unknown }, cu: DongKhach | null, now: number): Omit<DongKhach, 'updatedAt'> {
  const so = (v: unknown, tran: number) => Math.min(tran, Math.max(0, Math.round(Number(v) || 0)));
  let total = so(than.totalScore, 10_000_000);
  let wins = so(than.wins, 1_000_000);
  let matches = Math.max(so(than.matches, 1_000_000), wins);
  if (cu) {
    const van = 1 + Math.floor(Math.max(0, now - cu.updatedAt) / 30_000);
    total = Math.max(cu.total, Math.min(total, cu.total + van * DIEM_TOI_DA));
    wins = Math.max(cu.wins, Math.min(wins, cu.wins + van));
    matches = Math.max(cu.matches, Math.min(matches, cu.matches + van), wins);
  }
  return { total, wins, matches };
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
  /**
   * Client OAuth của APP iOS (đăng nhập Google native, bản app từ 1.5.0). Token Google ký trên
   * iPhone mang `aud` = client iOS, không phải client web. Android dùng client web nên không cần.
   * Mặc định là client của dự án `lat-the-nkien` (công khai, không phải bí mật).
   */
  GOOGLE_IOS_CLIENT_ID?: string;
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
  const googleAud = clientId
    ? [clientId, env.GOOGLE_IOS_CLIENT_ID ?? GOOGLE_IOS_MAC_DINH].filter(Boolean)
    : [];
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
  /*
   * ĐỔI TÊN `khach` → `guest_scores` (19.11.2026, chủ dự án: tên bảng tiếng Việt lạc giữa users/players/rooms).
   * Chạy TRƯỚC khi tạo bảng: còn bảng cũ mà chưa có bảng mới thì đổi tên + đổi cột `ma` → `guest_hash` (giữ dữ
   * liệu). Không dùng `RENAME TABLE IF EXISTS` (MariaDB có, MySQL 8 của CI không).
   */
  const [cu] = await pool.query(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('khach', 'guest_scores')`
  );
  const coBang = new Set((cu as { t: string }[]).map((r) => r.t));
  if (coBang.has('khach') && !coBang.has('guest_scores')) {
    await pool.query('RENAME TABLE khach TO guest_scores');
    await pool.query('ALTER TABLE guest_scores CHANGE ma guest_hash CHAR(64) NOT NULL, RENAME INDEX idx_khach_score TO idx_guest_scores_score');
  }
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

  /*
   * BẢNG XẾP HẠNG CÔNG KHAI (không cần đăng nhập) nên CHỈ trả tên tắt (`tenTat`) của tài khoản,
   * KHÔNG ảnh Google, KHÔNG id nội bộ — app là 4+, trẻ em đăng nhập bằng tài khoản thật thì tên
   * thật + ảnh không được lộ cho người lạ (soát bảo mật 15.10.2026). Khách mang tên tự đặt
   * (cũng là tên khi chơi online). Người đang xem nhận ra dòng mình qua `toi`.
   */
  /*
   * TRUY VẤN TỪNG BẢNG RIÊNG + CACHE (19.11.2026). Bản đầu gộp `users UNION ALL khach` rồi mới sắp/đếm:
   * EXPLAIN trên production ra `type ALL` + `Using filesort` ở CẢ HAI bảng — index điểm có mà không dùng
   * được qua bảng gộp, mỗi lần mở app / xong ván là quét sạch hai bảng 3 lượt. Nay:
   *  - mỗi bảng một câu theo `idx_*_score` (ORDER BY total_score DESC LIMIT / đếm `total_score > ?`) rồi
   *    ghép trong code — câu đếm hạng chỉ duyệt phần index PHÍA TRÊN mình;
   *  - top 20 + tổng số người giữ trong RAM `BXH_CACHE_MS`, mọi người dùng chung. Dòng của NGƯỜI HỎI luôn
   *    ghép lại theo điểm mới nhất (`ghepTop`) — vừa chơi xong là thấy mình đúng chỗ, chỉ người khác trễ ≤30s.
   * Một pod (Deployment replicas 1) nên RAM là đủ; nhiều pod thì mỗi pod một bản, vẫn đúng tới 30 giây.
   */
  const COT_U = "CAST(id AS CHAR) AS k, 0 AS la_khach, name, total_score, wins, matches";
  const COT_K = "guest_hash AS k, 1 AS la_khach, name, total_score, wins, matches";
  let bxhCache: { luc: number; top: Record<string, unknown>[]; tong: number } | null = null;
  function dongCongKhai(r: Record<string, unknown>) {
    const khach = Number(r.la_khach) === 1, k = String(r.k);
    const ten = khach ? String(r.name ?? '') : tenTat(String(r.name ?? ''));
    return {
      name: ten, avatar: null, mat: khach ? matTuMa(k) : MAT_BXH[Number(k) % MAT_BXH.length]!,
      khach: khach && !ten ? soKhach(k) : undefined,
      totalScore: Number(r.total_score), wins: Number(r.wins), matches: Number(r.matches)
    };
  }
  async function topVaTong(now: number) {
    if (bxhCache && now - bxhCache.luc < BXH_CACHE_MS) return bxhCache;
    const tu = now - KHACH_HET_HAN_MS;
    // Lấy dư 5 dòng mỗi bảng: index chỉ có total_score, hoà điểm thì xếp tiếp theo wins trong code
    const [[u], [kh], [[du]], [[dk]]] = await Promise.all([
      pool!.query(`SELECT ${COT_U} FROM users WHERE matches > 0 ORDER BY total_score DESC LIMIT 25`),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE matches > 0 AND updated_at > ? ORDER BY total_score DESC LIMIT 25`, [tu]),
      pool!.query('SELECT COUNT(*) AS n FROM users WHERE matches > 0'),
      pool!.query('SELECT COUNT(*) AS n FROM guest_scores WHERE matches > 0 AND updated_at > ?', [tu]),
    ]) as unknown as [[Record<string, unknown>[]], [Record<string, unknown>[]], [[{ n: number }]], [[{ n: number }]]];
    bxhCache = { luc: now, top: ghepTop([...u, ...kh]), tong: Number(du.n) + Number(dk.n) };
    return bxhCache;
  }
  async function bangXepHang(uid: number | null, ma: string | null, now: number) {
    const tu = now - KHACH_HET_HAN_MS;
    const chung = await topVaTong(now);
    const [mine] = uid !== null
      ? await pool!.query(`SELECT ${COT_U} FROM users WHERE id = ?`, [uid])
      : ma ? await pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE guest_hash = ?`, [ma]) : [[]];
    const m = (mine as Record<string, unknown>[])[0];
    const coMat = !!m && Number(m.matches) > 0;
    const k = m ? String(m.k) : null, laKhach = m ? Number(m.la_khach) === 1 : false;
    const top = ghepTop(chung.top, coMat ? m : undefined, k, laKhach)
      .map((r) => ({ ...dongCongKhai(r), toi: k !== null && String(r.k) === k && (Number(r.la_khach) === 1) === laKhach }));
    if (!m) return { top };

    const diem = Number(m.total_score);
    const [[[tu1]], [[tk1]], [tren1], [tren2], [duoi1], [duoi2]] = await Promise.all([
      pool!.query('SELECT COUNT(*) AS n FROM users WHERE total_score > ? AND matches > 0', [diem]),
      pool!.query('SELECT COUNT(*) AS n FROM guest_scores WHERE total_score > ? AND matches > 0 AND updated_at > ?', [diem, tu]),
      pool!.query(`SELECT ${COT_U} FROM users WHERE total_score > ? AND matches > 0 ORDER BY total_score ASC LIMIT 1`, [diem]),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE total_score > ? AND matches > 0 AND updated_at > ? ORDER BY total_score ASC LIMIT 1`, [diem, tu]),
      pool!.query(`SELECT ${COT_U} FROM users WHERE total_score <= ? AND matches > 0 AND NOT (id = ? AND ? = 0) ORDER BY total_score DESC LIMIT 1`, [diem, k, laKhach ? 1 : 0]),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE total_score <= ? AND matches > 0 AND updated_at > ? AND NOT (guest_hash = ? AND ? = 1) ORDER BY total_score DESC LIMIT 1`, [diem, tu, k, laKhach ? 1 : 0]),
    ]) as unknown as [[[{ n: number }]], [[{ n: number }]], [Record<string, unknown>[]], [Record<string, unknown>[]], [Record<string, unknown>[]], [Record<string, unknown>[]]];
    const hang = Number(tu1.n) + Number(tk1.n) + 1;
    // Tổng lấy từ cache (trễ ≤30s) — nhưng không bao giờ nhỏ hơn hạng của chính mình; chưa chơi ván nào
    // thì chưa có trong tổng, vẫn đếm mình vào để "hạng X / Y" không vô lý
    const tong = Math.max(hang, chung.tong + (coMat ? 0 : 1));
    const tren = [...tren1, ...tren2].sort((a, b) => Number(a.total_score) - Number(b.total_score))[0];
    const duoi = [...duoi1, ...duoi2].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
    return {
      top,
      toi: {
        hang, tong, ...dongCongKhai(m),
        tren: tren ? { ...dongCongKhai(tren), hang: hang - 1 } : null,
        duoi: duoi ? { ...dongCongKhai(duoi), hang: hang + 1 } : null
      }
    };
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
        try { ng = await xacMinhGoogle(cred, googleAud, now); } catch (e) {
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

      if (p === '/api/bxh' && (req.method === 'GET' || req.method === 'POST')) {
        /*
         * GET (bản app cũ): chỉ top. POST `{ khach }`: thêm `toi` = hạng của người đang xem
         * (tài khoản qua phiên, hoặc khách qua mã) — mã khách đi trong THÂN, không lên URL/log.
         */
        const than = req.method === 'POST' ? await docThan(req) as { khach?: unknown } | null : null;
        json(res, await bangXepHang(uidTu(req, now), maKhach(than?.khach), now));
        return true;
      }

      /*
       * TÊN NGẪU NHIÊN CHƯA AI DÙNG (19.11.2026): app gửi ≤10 tên tự tạo ("Sóc Đỏ Nhỏ"), trả những tên chưa có trên
       * bảng xếp hạng (khách + tài khoản). So bằng collation của bảng (không phân biệt hoa/thường, dấu) — "Soc Do
       * Nho" cũng tính là trùng. Chỉ đọc; không cần đăng nhập.
       */
      if (p === '/api/ten/trong' && req.method === 'POST') {
        const than = await docThan(req) as { ds?: unknown } | null;
        const ds = [...new Set((Array.isArray(than?.ds) ? than.ds : []).map(locTen).filter(Boolean))].slice(0, 10);
        if (!ds.length) { json(res, { trong: [] }); return true; }
        const [rows] = await pool!.query(
          `SELECT name FROM guest_scores WHERE name IN (?) UNION SELECT name FROM users WHERE name IN (?)`, [ds, ds]
        );
        const daCo = (rows as { name: string }[]).map((r) => r.name.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, ''));
        const bo = (x: string) => x.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '');
        json(res, { trong: ds.filter((x) => !daCo.includes(bo(x))) });
        return true;
      }

      /* Khách gửi tổng điểm trên máy (sau mỗi ván, và lúc đổi tên). */
      if (p === '/api/khach' && req.method === 'POST') {
        const than = await docThan(req) as Record<string, unknown> | null;
        const ma = maKhach(than?.id);
        if (!than || !ma) { json(res, { error: 'Mã khách không hợp lệ' }, 400); return true; }
        const [rows] = await pool!.query('SELECT total_score, wins, matches, updated_at FROM guest_scores WHERE guest_hash = ?', [ma]);
        const r = (rows as Record<string, unknown>[])[0];
        const cu: DongKhach | null = r ? { total: Number(r.total_score), wins: Number(r.wins), matches: Number(r.matches), updatedAt: Number(r.updated_at) } : null;
        const d = locDiemKhach(than, cu, now);
        await pool!.execute(
          `INSERT INTO guest_scores (guest_hash, name, total_score, wins, matches, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), total_score = VALUES(total_score), wins = VALUES(wins),
             matches = VALUES(matches), updated_at = VALUES(updated_at)`,
          [ma, locTen(than.name), d.total, d.wins, d.matches, now, now]
        );
        json(res, { ok: true });
        return true;
      }

      /* Khách tự xoá mình khỏi bảng (nút trong hộp Bảng xếp hạng — chính sách quyền riêng tư hứa điều này). */
      if (p === '/api/khach/xoa' && req.method === 'POST') {
        const ma = maKhach((await docThan(req) as { id?: unknown } | null)?.id);
        if (ma) await pool!.execute('DELETE FROM guest_scores WHERE guest_hash = ?', [ma]);
        json(res, { ok: true });
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
        // Máy này từng lên bảng dưới dạng khách → điểm đã gộp ở trên, bỏ dòng khách (không trùng hai dòng)
        const ma = maKhach(than.khach);
        if (ma) await pool!.execute('DELETE FROM guest_scores WHERE guest_hash = ?', [ma]);
        json(res, { me: await hoSo(uid) });
        return true;
      }

      json(res, { error: 'Không có đường này' }, 404);
      return true;
    }
  };
}

/** Tên tắt cho bảng xếp hạng công khai: "Nguyễn Trung Kiên" → "Nguyễn K.", một chữ giữ nguyên. */
export function tenTat(ten: string): string {
  const chu = ten.trim().split(/\s+/).filter(Boolean);
  if (!chu.length) return '?';
  if (chu.length === 1) return chu[0]!.slice(0, 16);
  return `${chu[0]!.slice(0, 16)} ${[...chu[chu.length - 1]!][0]!.toUpperCase()}.`;
}
