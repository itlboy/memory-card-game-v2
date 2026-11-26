import { createHmac, createHash, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify, type webcrypto } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'mysql2/promise';
import { matHoSo, mauHoSo } from '@mm/engine';

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
  /*
   * XẾP HẠNG TUẦN (20.11.2026, mockup duyệt https://claude.ai/artifact/WqxQ9L7SgMRzERfoqkCgxP): mỗi người mỗi tuần một
   * dòng — điểm KIẾM ĐƯỢC trong tuần đó. Tuần = thứ Hai 00:00 UTC (`week_start`). Dòng tuần cũ không bao giờ xoá →
   * chính là lịch sử các tuần. `player` = users.id (dạng chuỗi) hoặc guest_scores.guest_hash. Không có khoá ngoại
   * (một cột trỏ hai bảng) → xoá tài khoản / gộp khách phải tự dọn ở đây.
   */
  `CREATE TABLE IF NOT EXISTS weekly_scores (
     week_start DATE        NOT NULL,
     is_guest   TINYINT     NOT NULL,
     player     VARCHAR(64) NOT NULL,
     score      BIGINT      NOT NULL DEFAULT 0,
     wins       INT         NOT NULL DEFAULT 0,
     matches    INT         NOT NULL DEFAULT 0,
     updated_at BIGINT      NOT NULL DEFAULT 0,
     PRIMARY KEY (week_start, is_guest, player),
     INDEX idx_weekly_rank (week_start, score)
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

/*
 * THẺ MÁY (26.11.2026, chủ dự án: "đăng xuất ra không thấy mình trên bảng… điểm chơi thêm vẫn cộng vào tài khoản"):
 * máy từng đăng nhập giữ một thẻ dài hạn `m<uid>.<exp>.<chữ ký>`. Đăng xuất chỉ bỏ PHIÊN; thẻ ở lại để máy vẫn
 * (1) nhận ra dòng của mình trên bảng xếp hạng và (2) cộng điểm ván mới vào tài khoản. Thẻ KHÔNG mở được hồ sơ,
 * đồng bộ, đổi hồ sơ hay xoá tài khoản — chỉ `/api/bxh`, `/api/me/van` và danh tính sảnh nhận nó. Ký trên chuỗi
 * có tiền tố riêng nên không đổi qua lại với phiên được.
 */
export const HAN_THE_MAY_MS = 365 * 24 * 60 * 60 * 1000;
export function taoTheMay(secret: string, uid: number, now: number): string {
  const than = `${uid}.${now + HAN_THE_MAY_MS}`;
  return `m${than}.${ky(secret, `may:${than}`)}`;
}
export function docTheMay(secret: string, the: string | undefined, now: number): number | null {
  if (!the) return null;
  const m = /^m(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(the);
  if (!m) return null;
  const [, uid, exp, chuKy] = m;
  if (Number(exp) <= now) return null;
  const dung = Buffer.from(ky(secret, `may:${uid}.${exp}`));
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

/**
 * CẮT MỘT TRANG "tải thêm" của bảng xếp hạng — thuần, có test. `ds` = các dòng đầu bảng (đủ dài để chứa trang cần), `top` =
 * top đang cache, `cuoi` = 3 người chót đang cache, `tong` = tổng số người. Bỏ khoá đã có ở top + 3 người chót (chỗ hoà
 * điểm, thứ tự của hai lần truy vấn có thể lệch) rồi mới cắt: các trang nối nhau KHÔNG lặp, KHÔNG hụt ai, hạng liền nhau.
 */
export function catTrangBxh(ds: Record<string, unknown>[], top: Record<string, unknown>[], cuoiGoc: Record<string, unknown>[], tong: number, tu: number, co = 20): { dong: { r: Record<string, unknown>; hang: number }[]; het: boolean } {
  const khoa = (r: Record<string, unknown>): string => `${Number(r.la_khach) === 1 ? 'k' : 'u'}:${String(r.k)}`;
  const soTop = top.length;
  // 3 người chót chỉ hiện (và chỉ bị loại khỏi phần "giữa") khi nằm DƯỚI top — cùng luật với `cuoiCongKhai`
  const cuoi = cuoiGoc.filter((_, i) => tong - (cuoiGoc.length - 1 - i) > soTop);
  const bo = new Set([...top, ...cuoi].map(khoa));
  const tongGiua = Math.max(0, tong - soTop - cuoi.length);
  const batDau = tu - soTop;
  if (batDau < 0) return { dong: [], het: true };
  const giua = [...ds].sort((a, b) => Number(b.total_score) - Number(a.total_score) || Number(b.wins) - Number(a.wins)).filter((r) => !bo.has(khoa(r)));
  const cat = giua.slice(batDau, Math.min(batDau + co, tongGiua));
  return { dong: cat.map((r, i) => ({ r, hang: tu + i + 1 })), het: batDau + cat.length >= tongGiua || cat.length < co };
}

/** Thứ Hai 00:00 UTC của tuần chứa `now`, dạng 'YYYY-MM-DD'. */
export function dauTuan(now: number): string {
  const d = new Date(now);
  const lui = (d.getUTCDay() + 6) % 7;   // CN=0 → lùi 6 ngày
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - lui)).toISOString().slice(0, 10);
}
/** Mốc kết thúc (ms) của tuần bắt đầu `tuan` = thứ Hai tuần sau 00:00 UTC. */
export const hetTuan = (tuan: string): number => Date.parse(`${tuan}T00:00:00Z`) + 7 * 86_400_000;
/** Tuần client xin xem: phải là một thứ Hai hợp lệ, không ở tương lai; sai thì về tuần hiện tại. */
export function tuanHopLe(v: unknown, now: number): string {
  const nay = dauTuan(now);
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return nay;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t) || dauTuan(t) !== v || v > nay) return nay;
  return v;
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
  /**
   * Danh tính trên bảng xếp hạng từ phiên đăng nhập (ưu tiên) hoặc mã khách: `u:<id>` / `k:<mã băm>`.
   * Sảnh (sanh.ts) dùng để biết dòng nào trên bảng đang online.
   */
  aiTu(khach: unknown, token: unknown): string | null;
  /** Gắn nguồn trạng thái online (sảnh) — mỗi dòng bảng xếp hạng mang `ol` khi người đó đang mở app. */
  datOnline(f: (ai: string) => { sid?: string; ban: boolean } | null): void;
  /** Sảnh đưa danh sách danh tính đang online (`u:<id>` / `k:<mã băm>`) — cho bộ lọc "người đang online" của bảng xếp hạng. */
  datDsOnline(f: () => string[]): void;
  /** Điểm TUẦN NÀY theo danh tính sảnh (`u:<id>` / `k:<mã băm>`) — thi đấu dùng để xếp người gần hạng nhau. */
  diemTuan(ai: string[]): Promise<Record<string, number>>;
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
  /*
   * "Ẩn tôi" (20.11.2026, chủ dự án: "ẩn thôi ko xóa, sau họ thích thì cho họ hiện lại"): trước đây XOÁ dòng khách,
   * nay chỉ bật `hidden` — điểm + lịch sử tuần còn nguyên, bấm "Hiện lại" là về bảng.
   */
  const [coAn] = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'guest_scores' AND column_name = 'hidden'`
  );
  if (!(coAn as unknown[]).length) await pool.query('ALTER TABLE guest_scores ADD COLUMN hidden TINYINT NOT NULL DEFAULT 0');
  /*
   * HỒ SƠ NGƯỜI CHƠI (25.11.2026): avatar + màu người chơi tự chọn, hiện ở bảng xếp hạng. NULL = chưa chọn (app cũ) →
   * vẫn bốc mặt theo mã như trước (`MAT_BXH`). Chỉ nhận giá trị trong danh sách chung (`matHoSo`/`mauHoSo`).
   */
  for (const bang of ['users', 'guest_scores']) {
    // `ten_hien` (chỉ users): TÊN HỒ SƠ người chơi tự đặt — bảng xếp hạng hiện tên này thay tên Google (chủ dự án 25.11.2026)
    for (const [cot, kieu] of [['mat', 'VARCHAR(16) NULL'], ['mau', 'CHAR(7) NULL'], ...(bang === 'users' ? [['ten_hien', 'VARCHAR(32) NULL'] as const] : [])] as const) {
      const [co] = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [bang, cot]
      );
      if (!(co as unknown[]).length) await pool.query(`ALTER TABLE ${bang} ADD COLUMN ${cot} ${kieu}`);
    }
  }
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
  const COT_U = "CAST(id AS CHAR) AS k, 0 AS la_khach, name, ten_hien, mat, mau, total_score, wins, matches";
  const COT_K = "guest_hash AS k, 1 AS la_khach, name, mat, mau, total_score, wins, matches";
  let bxhCache: { luc: number; top: Record<string, unknown>[]; tong: number; cuoi: Record<string, unknown>[] } | null = null;
  /** 3 người CHÓT (hạng tong-2..tong), xếp giảm dần — chủ dự án 20.11.2026: nhìn là biết bảng có bao nhiêu người. */
  const baCuoi = (ds: Record<string, unknown>[]) =>
    ds.sort((a, b) => Number(a.total_score) - Number(b.total_score) || Number(a.wins) - Number(b.wins)).slice(0, 3).reverse();
  /** Gắn hạng cho 3 người chót, chỉ giữ những ai nằm DƯỚI top đang hiện (không lặp dòng). */
  function cuoiCongKhai(cuoi: Record<string, unknown>[], tong: number, soTop: number, k: string | null, laKhach: boolean) {
    return cuoi.map((r, i) => ({ r, hang: tong - (cuoi.length - 1 - i) }))
      .filter((x) => x.hang > soTop)
      .map(({ r, hang }) => ({ ...dongCongKhai(r), hang, toi: k !== null && String(r.k) === k && (Number(r.la_khach) === 1) === laKhach }));
  }
  /*
   * ONLINE + THÁCH ĐẤU (21.11.2026, mockup duyệt https://claude.ai/artifact/9DrmCWLCmnfSRy3JYnNiiG mục 1): gắn SAU cache
   * (mỗi lần đọc), nên chấm online luôn mới dù top giữ 30 giây. `ol.sid` = mã kết nối sảnh (ngẫu nhiên, đổi mỗi lần
   * nối lại — không phải định danh bền), chỉ có khi rảnh. Ai tắt "Nhận lời mời chơi" thì app không nối sảnh → không online.
   */
  let online: ((ai: string) => { sid?: string; ban: boolean } | null) | null = null;
  function dongCongKhai(r: Record<string, unknown>) {
    const khach = Number(r.la_khach) === 1, k = String(r.k);
    // Tài khoản đã đặt TÊN HỒ SƠ (25.11.2026) → hiện đúng tên đó; chưa đặt → tên Google rút gọn như cũ
    const ten = khach ? String(r.name ?? '') : (r.ten_hien ? String(r.ten_hien) : tenTat(String(r.name ?? '')));
    const ol = online?.(`${khach ? 'k' : 'u'}:${k}`) ?? undefined;
    return {
      name: ten, avatar: null, mat: matHoSo(r.mat) ?? (khach ? matTuMa(k) : MAT_BXH[Number(k) % MAT_BXH.length]!),
      ...(mauHoSo(r.mau) ? { mau: mauHoSo(r.mau) } : {}),
      khach: khach && !ten ? soKhach(k) : undefined,
      totalScore: Number(r.total_score), wins: Number(r.wins), matches: Number(r.matches),
      ...(ol ? { ol } : {})
    };
  }
  async function topVaTong(now: number) {
    if (bxhCache && now - bxhCache.luc < BXH_CACHE_MS) return bxhCache;
    const tu = now - KHACH_HET_HAN_MS;
    // Lấy dư 5 dòng mỗi bảng: index chỉ có total_score, hoà điểm thì xếp tiếp theo wins trong code
    const [[u], [kh], [[du]], [[dk]], [cu1], [cu2]] = await Promise.all([
      pool!.query(`SELECT ${COT_U} FROM users WHERE matches > 0 ORDER BY total_score DESC LIMIT 25`),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE matches > 0 AND hidden = 0 AND updated_at > ? ORDER BY total_score DESC LIMIT 25`, [tu]),
      pool!.query('SELECT COUNT(*) AS n FROM users WHERE matches > 0'),
      pool!.query('SELECT COUNT(*) AS n FROM guest_scores WHERE matches > 0 AND hidden = 0 AND updated_at > ?', [tu]),
      pool!.query(`SELECT ${COT_U} FROM users WHERE matches > 0 ORDER BY total_score ASC LIMIT 3`),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE matches > 0 AND hidden = 0 AND updated_at > ? ORDER BY total_score ASC LIMIT 3`, [tu]),
    ]) as unknown as [[Record<string, unknown>[]], [Record<string, unknown>[]], [[{ n: number }]], [[{ n: number }]], [Record<string, unknown>[]], [Record<string, unknown>[]]];
    bxhCache = { luc: now, top: ghepTop([...u, ...kh]), tong: Number(du.n) + Number(dk.n), cuoi: baCuoi([...cu1, ...cu2]) };
    return bxhCache;
  }
  /*
   * TẢI THÊM KHI CUỘN + LỌC NGƯỜI ONLINE (23.11.2026, chủ dự án: "bảng xếp hạng có thể lazyload để load thêm những người
   * đang ẩn", "filter đi để mời thách đấu cho dễ").
   *
   * `trangBxh`: 20 dòng kế tiếp từ hạng `tu + 1` (tu = 20, 40… tối đa `TU_TOI_DA`), cho cả Mọi lúc lẫn Tuần. KHÔNG dùng
   * UNION + sắp toàn bảng (EXPLAIN 19.11: quét hết + filesort): mỗi bảng lấy `tu + 25` dòng đầu theo index điểm rồi gộp,
   * xếp trong code bằng ĐÚNG luật của top (`xepBxh`). Để các trang không lặp/hụt người ở chỗ hoà điểm: bỏ hẳn những
   * khoá đã nằm trong top đang cache và trong 3 người chót, phần còn lại ("giữa") mới cắt trang — hạng = tu + thứ tự.
   * Không cache (ít người cuộn tới). `het` = đã giáp 3 người chót.
   *
   * `bangOnline`: mọi danh tính đang nối sảnh (kể cả ngoài top 20) kèm hạng thật, xếp theo hạng.
   */
  const TRANG_BXH = 20, TU_TOI_DA = 500, ONLINE_TOI_DA = 60;
  let dsOnline: (() => string[]) | null = null;
  const khoaDong = (r: Record<string, unknown>): string => `${Number(r.la_khach) === 1 ? 'k' : 'u'}:${String(r.k)}`;
  const khoaNguoiXem = (uid: number | null, ma: string | null): string | null => (uid !== null ? `u:${uid}` : ma ? `k:${ma}` : null);

  async function trangBxh(loai: 'tat' | 'tuan', tuan: string, tuTho: unknown, uid: number | null, ma: string | null, now: number) {
    const tu = Math.min(TU_TOI_DA, Math.max(TRANG_BXH, Math.floor(Number(tuTho) || 0)));
    const can = tu + TRANG_BXH + 5;
    let chung: { top: Record<string, unknown>[]; tong: number; cuoi: Record<string, unknown>[] };
    let ds: Record<string, unknown>[];
    if (loai === 'tuan') {
      chung = await topTuan(tuan, now);
      [ds] = await pool!.query(`SELECT ${COT_TUAN} ${TU_TUAN} ORDER BY w.score DESC LIMIT ?`, [tuan, can]) as unknown as [Record<string, unknown>[]];
    } else {
      chung = await topVaTong(now);
      const moc = now - KHACH_HET_HAN_MS;
      const [[u], [kh]] = await Promise.all([
        pool!.query(`SELECT ${COT_U} FROM users WHERE matches > 0 ORDER BY total_score DESC LIMIT ?`, [can]),
        pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE matches > 0 AND hidden = 0 AND updated_at > ? ORDER BY total_score DESC LIMIT ?`, [moc, can]),
      ]) as unknown as [[Record<string, unknown>[]], [Record<string, unknown>[]]];
      ds = [...u, ...kh];
    }
    const toi = khoaNguoiXem(uid, ma);
    const { dong, het } = catTrangBxh(ds, chung.top, chung.cuoi, chung.tong, tu, TRANG_BXH);
    return {
      ds: dong.map(({ r, hang }) => ({ ...dongCongKhai(r), hang, toi: toi !== null && khoaDong(r) === toi })),
      het: het || tu >= TU_TOI_DA
    };
  }

  async function bangOnline(loai: 'tat' | 'tuan', tuan: string, uid: number | null, ma: string | null, now: number) {
    const ai = (dsOnline?.() ?? []).slice(0, ONLINE_TOI_DA);
    const idU = ai.filter((x) => x.startsWith('u:')).map((x) => x.slice(2)).filter((x) => /^\d+$/.test(x));
    const maK = ai.filter((x) => x.startsWith('k:')).map((x) => x.slice(2));
    if (!idU.length && !maK.length) return { ds: [] };
    const moc = now - KHACH_HET_HAN_MS;
    const u0 = idU.length ? idU : ['0'], k0 = maK.length ? maK : ['-'];
    let rows: Record<string, unknown>[];
    if (loai === 'tuan') {
      [rows] = await pool!.query(
        `SELECT ${COT_TUAN} ${TU_TUAN} AND ((w.is_guest = 0 AND w.player IN (?)) OR (w.is_guest = 1 AND w.player IN (?)))`, [tuan, u0, k0]
      ) as unknown as [Record<string, unknown>[]];
    } else {
      const [[u], [kh]] = await Promise.all([
        pool!.query(`SELECT ${COT_U} FROM users WHERE matches > 0 AND id IN (?)`, [u0]),
        pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE matches > 0 AND hidden = 0 AND updated_at > ? AND guest_hash IN (?)`, [moc, k0]),
      ]) as unknown as [[Record<string, unknown>[]], [Record<string, unknown>[]]];
      rows = [...u, ...kh];
    }
    const toi = khoaNguoiXem(uid, ma);
    const ds = await Promise.all(rows.map(async (r) => {
      const diem = Number(r.total_score);
      let tren: number;
      if (loai === 'tuan') {
        const [[[c]]] = [await pool!.query(`SELECT COUNT(*) AS n ${TU_TUAN} AND w.score > ?`, [tuan, diem])] as unknown as [[[{ n: number }]]];
        tren = Number(c.n);
      } else {
        const [[[a]], [[b]]] = await Promise.all([
          pool!.query('SELECT COUNT(*) AS n FROM users WHERE total_score > ? AND matches > 0', [diem]),
          pool!.query('SELECT COUNT(*) AS n FROM guest_scores WHERE total_score > ? AND matches > 0 AND hidden = 0 AND updated_at > ?', [diem, moc]),
        ]) as unknown as [[[{ n: number }]], [[{ n: number }]]];
        tren = Number(a.n) + Number(b.n);
      }
      return { ...dongCongKhai(r), hang: tren + 1, toi: toi !== null && khoaDong(r) === toi };
    }));
    // Chỉ người còn đang online lúc trả lời (dongCongKhai gắn `ol` theo sảnh); xếp theo hạng
    return { ds: ds.filter((d) => d.ol).sort((x, y) => x.hang - y.hang) };
  }

  async function bangXepHang(uid: number | null, ma: string | null, now: number) {
    const tu = now - KHACH_HET_HAN_MS;
    const chung = await topVaTong(now);
    const [mine] = uid !== null
      ? await pool!.query(`SELECT ${COT_U} FROM users WHERE id = ?`, [uid])
      : ma ? await pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE guest_hash = ? AND hidden = 0`, [ma]) : [[]];
    const m = (mine as Record<string, unknown>[])[0];
    const coMat = !!m && Number(m.matches) > 0;
    const k = m ? String(m.k) : null, laKhach = m ? Number(m.la_khach) === 1 : false;
    const top = ghepTop(chung.top, coMat ? m : undefined, k, laKhach)
      .map((r) => ({ ...dongCongKhai(r), toi: k !== null && String(r.k) === k && (Number(r.la_khach) === 1) === laKhach }));
    const cuoi = cuoiCongKhai(chung.cuoi, chung.tong, top.length, k, laKhach);
    if (!m) return { top, cuoi };

    const diem = Number(m.total_score);
    const [[[tu1]], [[tk1]], [tren1], [tren2], [duoi1], [duoi2]] = await Promise.all([
      pool!.query('SELECT COUNT(*) AS n FROM users WHERE total_score > ? AND matches > 0', [diem]),
      pool!.query('SELECT COUNT(*) AS n FROM guest_scores WHERE total_score > ? AND matches > 0 AND hidden = 0 AND updated_at > ?', [diem, tu]),
      pool!.query(`SELECT ${COT_U} FROM users WHERE total_score > ? AND matches > 0 ORDER BY total_score ASC LIMIT 1`, [diem]),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE total_score > ? AND matches > 0 AND hidden = 0 AND updated_at > ? ORDER BY total_score ASC LIMIT 1`, [diem, tu]),
      pool!.query(`SELECT ${COT_U} FROM users WHERE total_score <= ? AND matches > 0 AND NOT (id = ? AND ? = 0) ORDER BY total_score DESC LIMIT 1`, [diem, k, laKhach ? 1 : 0]),
      pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE total_score <= ? AND matches > 0 AND hidden = 0 AND updated_at > ? AND NOT (guest_hash = ? AND ? = 1) ORDER BY total_score DESC LIMIT 1`, [diem, tu, k, laKhach ? 1 : 0]),
    ]) as unknown as [[[{ n: number }]], [[{ n: number }]], [Record<string, unknown>[]], [Record<string, unknown>[]], [Record<string, unknown>[]], [Record<string, unknown>[]]];
    const hang = Number(tu1.n) + Number(tk1.n) + 1;
    // Tổng lấy từ cache (trễ ≤30s) — nhưng không bao giờ nhỏ hơn hạng của chính mình; chưa chơi ván nào
    // thì chưa có trong tổng, vẫn đếm mình vào để "hạng X / Y" không vô lý
    const tong = Math.max(hang, chung.tong + (coMat ? 0 : 1));
    const tren = [...tren1, ...tren2].sort((a, b) => Number(a.total_score) - Number(b.total_score))[0];
    const duoi = [...duoi1, ...duoi2].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
    return {
      top, cuoi,
      toi: {
        hang, tong, ...dongCongKhai(m),
        tren: tren ? { ...dongCongKhai(tren), hang: hang - 1 } : null,
        duoi: duoi ? { ...dongCongKhai(duoi), hang: hang + 1 } : null
      }
    };
  }

  /*
   * BẢNG TUẦN. Dòng tuần chỉ có điểm; tên lấy từ users / guest_scores lúc đọc (đổi tên là đổi cả tuần cũ), khách
   * đang ẩn thì không hiện. Cache theo tuần: tuần đang chạy 30 giây như bảng Mọi lúc, tuần cũ đã đứng yên → 10 phút.
   */
  const TU_TUAN = `FROM weekly_scores w
     LEFT JOIN users u ON w.is_guest = 0 AND u.id = CAST(w.player AS UNSIGNED)
     LEFT JOIN guest_scores g ON w.is_guest = 1 AND g.guest_hash = w.player
     WHERE w.week_start = ? AND w.matches > 0 AND ((w.is_guest = 0 AND u.id IS NOT NULL) OR (w.is_guest = 1 AND g.hidden = 0))`;
  const COT_TUAN = "w.player AS k, w.is_guest AS la_khach, COALESCE(u.name, g.name, '') AS name, u.ten_hien AS ten_hien, COALESCE(u.mat, g.mat) AS mat, COALESCE(u.mau, g.mau) AS mau, w.score AS total_score, w.wins, w.matches";
  const tuanCache = new Map<string, { luc: number; top: Record<string, unknown>[]; tong: number; cuoi: Record<string, unknown>[]; coTruoc: boolean }>();
  async function topTuan(tuan: string, now: number) {
    const c = tuanCache.get(tuan);
    if (c && now - c.luc < (tuan === dauTuan(now) ? BXH_CACHE_MS : 600_000)) return c;
    const [[top], [[dem]], [cuoi], [truoc]] = await Promise.all([
      pool!.query(`SELECT ${COT_TUAN} ${TU_TUAN} ORDER BY w.score DESC LIMIT 25`, [tuan]),
      pool!.query(`SELECT COUNT(*) AS n ${TU_TUAN}`, [tuan]),
      pool!.query(`SELECT ${COT_TUAN} ${TU_TUAN} ORDER BY w.score ASC LIMIT 3`, [tuan]),
      pool!.query('SELECT 1 FROM weekly_scores WHERE week_start < ? LIMIT 1', [tuan]),
    ]) as unknown as [[Record<string, unknown>[]], [[{ n: number }]], [Record<string, unknown>[]], [unknown[]]];
    const v = { luc: now, top: ghepTop(top), tong: Number(dem.n), cuoi: baCuoi(cuoi), coTruoc: truoc.length > 0 };
    if (tuanCache.size > 60) tuanCache.clear();
    tuanCache.set(tuan, v);
    return v;
  }
  async function bangTuan(uid: number | null, ma: string | null, tuan: string, now: number) {
    const chung = await topTuan(tuan, now);
    const tuanInfo = { batDau: tuan, het: hetTuan(tuan), nay: tuan === dauTuan(now), coTruoc: chung.coTruoc };
    // Người đang xem: dòng tuần (nếu có) + tên/mặt từ bảng gốc. Khách đang ẩn = không có trên bảng.
    const goc = uid !== null
      ? (await pool!.query(`SELECT ${COT_U} FROM users WHERE id = ?`, [uid]))[0] as Record<string, unknown>[]
      : ma ? (await pool!.query(`SELECT ${COT_K} FROM guest_scores WHERE guest_hash = ? AND hidden = 0`, [ma]))[0] as Record<string, unknown>[] : [];
    const g = goc[0];
    const k = g ? String(g.k) : null, laKhach = g ? Number(g.la_khach) === 1 : false;
    let m: Record<string, unknown> | undefined;
    if (g) {
      const [r] = await pool!.query('SELECT score, wins, matches FROM weekly_scores WHERE week_start = ? AND is_guest = ? AND player = ?', [tuan, laKhach ? 1 : 0, k]);
      const w = (r as Record<string, unknown>[])[0];
      m = { ...g, total_score: w ? Number(w.score) : 0, wins: w ? Number(w.wins) : 0, matches: w ? Number(w.matches) : 0 };
    }
    const coMat = !!m && Number(m.matches) > 0;
    const top = ghepTop(chung.top, coMat ? m : undefined, k, laKhach)
      .map((r) => ({ ...dongCongKhai(r), toi: k !== null && String(r.k) === k && (Number(r.la_khach) === 1) === laKhach }));
    const tong = chung.tong;
    const cuoi = cuoiCongKhai(chung.cuoi, tong, top.length, k, laKhach);
    if (!m) return { top, cuoi, tuan: tuanInfo };
    // Chưa có điểm tuần này: vẫn hiện dòng mình (chủ dự án: "luôn phải hiện vị trí người chơi hiện tại"), hạng trống
    if (!coMat) return { top, cuoi, tuan: tuanInfo, toi: { hang: null, tong, ...dongCongKhai(m), tren: null, duoi: null } };
    const diem = Number(m.total_score);
    const [[[tren1]], [tren]] = await Promise.all([
      pool!.query(`SELECT COUNT(*) AS n ${TU_TUAN} AND w.score > ?`, [tuan, diem]),
      pool!.query(`SELECT ${COT_TUAN} ${TU_TUAN} AND w.score > ? ORDER BY w.score ASC LIMIT 1`, [tuan, diem]),
    ]) as unknown as [[[{ n: number }]], [Record<string, unknown>[]]];
    const hang = Number(tren1.n) + 1;
    const tren0 = tren[0];
    return {
      top, cuoi, tuan: tuanInfo,
      toi: { hang, tong: Math.max(hang, tong), ...dongCongKhai(m), tren: tren0 ? { ...dongCongKhai(tren0), hang: hang - 1 } : null, duoi: null }
    };
  }
  /** Cộng điểm một ván (hoặc phần chênh của khách) vào dòng tuần hiện tại. */
  async function congTuan(laKhach: boolean, player: string, diem: number, thang: number, van: number, now: number): Promise<void> {
    if (diem <= 0 && van <= 0) return;
    await pool!.execute(
      `INSERT INTO weekly_scores (week_start, is_guest, player, score, wins, matches, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE score = score + VALUES(score), wins = wins + VALUES(wins), matches = matches + VALUES(matches), updated_at = VALUES(updated_at)`,
      [dauTuan(now), laKhach ? 1 : 0, player, Math.max(0, diem), Math.max(0, thang), Math.max(0, van), now]
    );
  }

  /** `choMay`: đường này nhận cả THẺ MÁY (máy đã đăng xuất) — chỉ bảng xếp hạng và ghi ván. */
  function uidTu(req: IncomingMessage, now: number, choMay = false): number | null {
    const h = req.headers.authorization ?? '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : undefined;
    return docPhien(secret, t, now) ?? (choMay ? docTheMay(secret, t, now) : null);
  }

  return {
    aiTu(khach, token) {
      const uid = typeof token === 'string' && token ? docPhien(secret, token, Date.now()) ?? docTheMay(secret, token, Date.now()) : null;
      if (uid !== null) return `u:${uid}`;
      const ma = maKhach(khach);
      return ma ? `k:${ma}` : null;
    },
    datOnline(f) { online = f; },
    datDsOnline(f) { dsOnline = f; },
    async diemTuan(ai) {
      const u = ai.filter((x) => /^u:\d+$/.test(x)).map((x) => x.slice(2)), k = ai.filter((x) => x.startsWith('k:')).map((x) => x.slice(2));
      if (!u.length && !k.length) return {};
      const [rows] = await pool!.query(
        'SELECT player, is_guest, score FROM weekly_scores WHERE week_start = ? AND ((is_guest = 0 AND player IN (?)) OR (is_guest = 1 AND player IN (?)))',
        [dauTuan(Date.now()), u.length ? u : ['0'], k.length ? k : ['-']]);
      const ra: Record<string, number> = {};
      for (const r of rows as { player: string; is_guest: number; score: number }[]) ra[`${Number(r.is_guest) === 1 ? 'k' : 'u'}:${r.player}`] = Number(r.score);
      return ra;
    },
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
        json(res, { token: taoPhien(secret, uid, now), may: taoTheMay(secret, uid, now), me: await hoSo(uid) });
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
        json(res, { token: taoPhien(secret, uid, now), may: taoTheMay(secret, uid, now), me: await hoSo(uid) });
        return true;
      }

      if (p === '/api/bxh' && (req.method === 'GET' || req.method === 'POST')) {
        /*
         * GET (bản app cũ): chỉ top. POST `{ khach }`: thêm `toi` = hạng của người đang xem
         * (tài khoản qua phiên, hoặc khách qua mã) — mã khách đi trong THÂN, không lên URL/log.
         */
        const than = req.method === 'POST' ? await docThan(req) as { khach?: unknown; loai?: unknown; tuan?: unknown; tu?: unknown; online?: unknown } | null : null;
        // Bản app cũ không gửi `tu` / `online` → chạy y như trước
        if (than && (than.online === true || than.tu !== undefined)) {
          const loai = than.loai === 'tuan' ? 'tuan' as const : 'tat' as const;
          const tuan = tuanHopLe(than.tuan, now), uid = uidTu(req, now, true), ma = maKhach(than.khach);
          json(res, than.online === true ? await bangOnline(loai, tuan, uid, ma, now) : await trangBxh(loai, tuan, than.tu, uid, ma, now));
          return true;
        }
        json(res, than?.loai === 'tuan'
          ? await bangTuan(uidTu(req, now, true), maKhach(than?.khach), tuanHopLe(than?.tuan, now), now)
          : await bangXepHang(uidTu(req, now, true), maKhach(than?.khach), now));
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
        // `an` (app ≥ 1.9.5): khách đang ẩn vẫn gửi điểm (ẩn chứ không mất); bản cũ không gửi trường này = đang hiện
        const r = (rows as Record<string, unknown>[])[0];
        const cu: DongKhach | null = r ? { total: Number(r.total_score), wins: Number(r.wins), matches: Number(r.matches), updatedAt: Number(r.updated_at) } : null;
        const d = locDiemKhach(than, cu, now);
        await pool!.execute(
          `INSERT INTO guest_scores (guest_hash, name, total_score, wins, matches, created_at, updated_at, hidden, mat, mau) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), total_score = VALUES(total_score), wins = VALUES(wins),
             matches = VALUES(matches), updated_at = VALUES(updated_at), hidden = VALUES(hidden),
             mat = COALESCE(VALUES(mat), mat), mau = COALESCE(VALUES(mau), mau)`,
          // `mat`/`mau` (app ≥ 1.9.50): hồ sơ người chơi; app cũ không gửi → giữ giá trị cũ
          [ma, locTen(than.name), d.total, d.wins, d.matches, now, now, than.an === true ? 1 : 0, matHoSo(than.mat) ?? null, mauHoSo(than.mau) ?? null]
        );
        /*
         * Điểm tuần của khách = phần CHÊNH so với lần gửi trước (máy gửi tổng). Lần gửi đầu tiên: máy có thể đã tích
         * điểm từ trước khi có bảng → chỉ tính tối đa một ván, không ai mang cả kho điểm cũ vào top tuần.
         */
        await congTuan(true, ma,
          cu ? d.total - cu.total : Math.min(d.total, DIEM_TOI_DA),
          cu ? d.wins - cu.wins : Math.min(d.wins, 1),
          cu ? d.matches - cu.matches : Math.min(d.matches, 1), now);
        json(res, { ok: true });
        return true;
      }

      /* Khách ẩn mình khỏi bảng (nút "Ẩn tôi"). Tên đường giữ nguyên cho app cũ; từ 20.11.2026 chỉ ẨN, không xoá. */
      if (p === '/api/khach/xoa' && req.method === 'POST') {
        const ma = maKhach((await docThan(req) as { id?: unknown } | null)?.id);
        if (ma) await pool!.execute('UPDATE guest_scores SET hidden = 1 WHERE guest_hash = ?', [ma]);
        json(res, { ok: true });
        return true;
      }

      if (!p.startsWith('/api/me')) return false;
      const uid = uidTu(req, now, p === '/api/me/van');   // ghi ván: máy đã đăng xuất vẫn cộng điểm bằng thẻ máy
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
        await pool!.execute('DELETE FROM weekly_scores WHERE is_guest = 0 AND player = ?', [String(uid)]);
        if (u?.apple_refresh && u.apple_client) await thuHoiApple(u.apple_refresh, u.apple_client, now);
        json(res, { ok: true });
        return true;
      }

      // HỒ SƠ (25.11.2026): avatar + màu tự chọn của người đã đăng nhập — hiện ở bảng xếp hạng thay mặt bốc theo id
      if (p === '/api/me/ho-so' && req.method === 'POST') {
        const than = await docThan(req) as Record<string, unknown> | null;
        const mat = matHoSo(than?.mat), mau = mauHoSo(than?.mau);
        if (!mat || !mau) { json(res, { error: 'Hồ sơ không hợp lệ' }, 400); return true; }
        const ten = locTen(than?.ten) || null;   // tên hồ sơ — bảng xếp hạng hiện tên này thay tên Google
        await pool!.execute('UPDATE users SET mat = ?, mau = ?, ten_hien = COALESCE(?, ten_hien) WHERE id = ?', [mat, mau, ten, uid]);
        bxhCache = null;
        json(res, { ok: true });
        return true;
      }

      // Một ván vừa xong
      if (p === '/api/me/van' && req.method === 'POST') {
        const van = locVan(await docThan(req));
        if (!van) { json(res, { error: 'Kết quả ván không hợp lệ' }, 400); return true; }
        const cot = van.ketQua === 'thang' ? 'wins' : van.ketQua === 'thua' ? 'losses' : 'draws';
        const [kq] = await pool!.execute(
          `UPDATE users SET total_score = total_score + ?, matches = matches + 1, \`${cot}\` = \`${cot}\` + 1 WHERE id = ?`,
          [van.score, uid]
        );
        // Thẻ máy của tài khoản đã xoá: không còn dòng nào để cộng → 401 cho máy bỏ thẻ
        if ((kq as { affectedRows?: number }).affectedRows === 0) { json(res, { error: 'Tài khoản không còn' }, 401); return true; }
        await congTuan(false, String(uid), van.score, van.ketQua === 'thang' ? 1 : 0, 1, now);
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
        if (ma) {
          // Điểm tuần của khách (mọi tuần) gộp sang tài khoản, cộng dồn nếu trùng tuần; rồi bỏ dòng khách
          // (Từng dòng một: `INSERT … SELECT` từ chính bảng này + ON DUPLICATE thì MariaDB báo cột mơ hồ — đã thử.)
          const [tuanKhach] = await pool!.query("SELECT DATE_FORMAT(week_start, '%Y-%m-%d') AS week_start, score, wins, matches, updated_at FROM weekly_scores WHERE is_guest = 1 AND player = ?", [ma]);
          for (const r of tuanKhach as Record<string, unknown>[]) {
            await pool!.execute(
              `INSERT INTO weekly_scores (week_start, is_guest, player, score, wins, matches, updated_at) VALUES (?, 0, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE score = score + VALUES(score), wins = wins + VALUES(wins), matches = matches + VALUES(matches),
                 updated_at = GREATEST(updated_at, VALUES(updated_at))`,
              [String(r.week_start), String(uid), Number(r.score), Number(r.wins), Number(r.matches), Number(r.updated_at)]
            );
          }
          await pool!.execute('DELETE FROM weekly_scores WHERE is_guest = 1 AND player = ?', [ma]);
          await pool!.execute('DELETE FROM guest_scores WHERE guest_hash = ?', [ma]);
        }
        // `may`: thẻ máy — app đang đăng nhập từ trước bản này nhận thẻ ở lần đồng bộ lúc mở app, khỏi đăng nhập lại
        json(res, { me: await hoSo(uid), may: taoTheMay(secret, uid, now) });
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
