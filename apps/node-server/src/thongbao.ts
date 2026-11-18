import { connect, constants as h2 } from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'mysql2/promise';
import type { PublicRoom } from '@mm/engine';

/**
 * THÔNG BÁO "CÓ PHÒNG MỚI" (18.11.2026) — CHỈ Ở BẢN NODE, là lớp phủ như tài khoản.
 *
 * Người chơi bấm chuông ở màn Online → app xin quyền, lấy mã máy (APNs token ở iOS,
 * FCM token ở Android) và gửi lên đây. Có phòng CÔNG KHAI mới mà sau `TRE_MS` vẫn còn
 * chờ người thì gửi một thông báo tới các máy đã đăng ký.
 *
 * iOS gửi THẲNG APNs (HTTP/2 + JWT ES256 từ khoá .p8), Android qua FCM HTTP v1 — không
 * dùng Firebase cho iOS để khỏi gói thêm SDK Firebase vào app.
 *
 * CHỐNG LÀM PHIỀN — đây là thứ dễ khiến người ta gỡ app nhất, nên giữ chặt:
 *  - cả game gửi tối đa một đợt mỗi `CACH_DOT_MS` (phòng mở liên tục không thành bão tin);
 *  - mỗi máy nhận tối đa một tin mỗi `CACH_MAY_MS`;
 *  - không gửi trong giờ ngủ 22h–7h THEO GIỜ CỦA MÁY ĐÓ (`lech_phut` máy tự khai);
 *  - phòng phải còn chờ người sau `TRE_MS` — phòng vừa mở đã đủ người/đóng thì thôi;
 *  - tắt chuông là xoá hẳn mã máy khỏi bảng, không chỉ đánh dấu.
 *
 * Bật khi có MySQL VÀ ít nhất một trong hai cách gửi (APNS_* hoặc FCM_SERVICE_ACCOUNT).
 * Thiếu thì `/api/thongbao/*` 404 và client giấu chuông.
 */

export const TRE_MS = 20_000;
export const CACH_DOT_MS = 10 * 60_000;
export const CACH_MAY_MS = 30 * 60_000;
export const GIO_NGU = { tu: 22, den: 7 };

export type Nen = 'ios' | 'android';
export interface DangKy { token: string; nen: Nen; lang: string; lech_phut: number; gui_cuoi: number }

export interface EnvThongBao {
  APNS_KEY_ID?: string; APNS_TEAM_ID?: string; APNS_PRIVATE_KEY?: string;
  /** Bundle ID iOS — mặc định `com.hello314.flipmatch` (KHÁC Android, xem CLAUDE.md). */
  APNS_TOPIC?: string;
  /** `1` = gửi tới máy chủ sandbox (build Xcode chạy tay). Bản TestFlight/App Store là production. */
  APNS_SANDBOX?: string;
  /** JSON service account của project Firebase (có quyền Firebase Cloud Messaging). */
  FCM_SERVICE_ACCOUNT?: string;
}

const TAO_BANG = `CREATE TABLE IF NOT EXISTS push_dangky (
  token VARCHAR(255) NOT NULL PRIMARY KEY,
  nen ENUM('ios','android') NOT NULL,
  lang VARCHAR(8) NOT NULL DEFAULT 'en',
  lech_phut SMALLINT NOT NULL DEFAULT 0,
  tao BIGINT NOT NULL,
  gui_cuoi BIGINT NOT NULL DEFAULT 0
) CHARACTER SET ascii`;

/** Chữ thông báo theo ngôn ngữ máy đã khai. `{ten}` = tên chủ phòng. */
export const CHU: Record<string, { tieuDe: string; than: string }> = {
  vi: { tieuDe: 'Có phòng mới!', than: '{ten} đang chờ người chơi — vào ngay nhé' },
  en: { tieuDe: 'New room open!', than: '{ten} is waiting for players — join now' },
  es: { tieuDe: '¡Nueva sala!', than: '{ten} está esperando jugadores — únete ya' },
  pt: { tieuDe: 'Nova sala!', than: '{ten} está esperando jogadores — entre agora' },
  fr: { tieuDe: 'Nouveau salon !', than: '{ten} attend des joueurs — rejoins-le' },
  de: { tieuDe: 'Neuer Raum!', than: '{ten} wartet auf Mitspieler — jetzt beitreten' },
  it: { tieuDe: 'Nuova stanza!', than: '{ten} aspetta giocatori — entra ora' },
  tr: { tieuDe: 'Yeni oda açıldı!', than: '{ten} oyuncu bekliyor — hemen katıl' },
  ja: { tieuDe: '新しいルーム！', than: '{ten}さんが対戦相手を待っています' },
  ko: { tieuDe: '새 방이 열렸어요!', than: '{ten}님이 플레이어를 기다려요 — 지금 참가하세요' },
  zh: { tieuDe: '有新房间！', than: '{ten} 正在等待玩家，快来加入' },
  'zh-TW': { tieuDe: '有新房間！', than: '{ten} 正在等待玩家，快來加入' },
  ru: { tieuDe: 'Новая комната!', than: '{ten} ждёт игроков — присоединяйтесь' },
  id: { tieuDe: 'Ada ruang baru!', than: '{ten} sedang menunggu pemain — gabung sekarang' },
  th: { tieuDe: 'มีห้องใหม่!', than: '{ten} กำลังรอผู้เล่น — เข้าร่วมเลย' }
};

export function chuThongBao(lang: string, ten: string): { tieuDe: string; than: string } {
  const c = CHU[lang] ?? CHU.en!;
  return { tieuDe: c.tieuDe, than: c.than.replace('{ten}', ten.slice(0, 40)) };
}

/** Giờ ngủ theo giờ địa phương của máy. `lechPhut` = phút lệch so với UTC (VN = +420). */
export function dangGioNgu(lechPhut: number, now: number): boolean {
  const gio = new Date(now + lechPhut * 60_000).getUTCHours();
  return GIO_NGU.tu > GIO_NGU.den ? (gio >= GIO_NGU.tu || gio < GIO_NGU.den) : (gio >= GIO_NGU.tu && gio < GIO_NGU.den);
}

/** Lọc máy được nhận tin lúc `now`. Thuần — có test. */
export function chonNguoiNhan(rows: DangKy[], now: number): DangKy[] {
  return rows.filter((r) => now - r.gui_cuoi >= CACH_MAY_MS && !dangGioNgu(r.lech_phut, now));
}

/* ---------- APNs ---------- */

interface KhoaApns { keyId: string; teamId: string; privateKey: string; topic: string; sandbox: boolean }

function jwtApns(k: KhoaApns, now: number): string {
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', kid: k.keyId })).toString('base64url');
  const b = Buffer.from(JSON.stringify({ iss: k.teamId, iat: Math.floor(now / 1000) })).toString('base64url');
  const chuKy = sign('sha256', Buffer.from(`${h}.${b}`), {
    key: createPrivateKey(k.privateKey.replace(/\\n/g, '\n')), dsaEncoding: 'ieee-p1363'
  });
  return `${h}.${b}.${chuKy.toString('base64url')}`;
}

/** Kết quả gửi một máy: 'ok' | 'bo' (mã máy chết — xoá khỏi bảng) | 'loi' (thử lại lần sau). */
type KetQua = 'ok' | 'bo' | 'loi';

function guiApns(k: KhoaApns, jwt: string, rows: DangKy[], tin: (r: DangKy) => object): Promise<Map<string, KetQua>> {
  const kq = new Map<string, KetQua>();
  if (!rows.length) return Promise.resolve(kq);
  return new Promise((resolve) => {
    const s = connect(k.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com');
    let con = rows.length;
    const xong = (token: string, v: KetQua): void => {
      if (kq.has(token)) return;
      kq.set(token, v);
      if (--con === 0) { s.close(); resolve(kq); }
    };
    s.on('error', (e) => {
      console.error('[thongbao] APNs lỗi kết nối:', e.message);
      for (const r of rows) xong(r.token, 'loi');
    });
    for (const r of rows) {
      const req = s.request({
        [h2.HTTP2_HEADER_METHOD]: 'POST',
        [h2.HTTP2_HEADER_PATH]: `/3/device/${r.token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': k.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 600)
      });
      let status = 0; let body = '';
      req.on('response', (hd) => { status = Number(hd[h2.HTTP2_HEADER_STATUS]); });
      req.setEncoding('utf8');
      req.on('data', (c: string) => { body += c; });
      req.on('end', () => {
        if (status === 200) xong(r.token, 'ok');
        else {
          const lyDo = (() => { try { return (JSON.parse(body) as { reason?: string }).reason ?? ''; } catch { return ''; } })();
          // 410 = máy đã gỡ app / tắt thông báo; BadDeviceToken = mã sai môi trường hoặc rác
          const chet = status === 410 || lyDo === 'BadDeviceToken' || lyDo === 'Unregistered';
          if (!chet) console.error('[thongbao] APNs', status, lyDo);
          xong(r.token, chet ? 'bo' : 'loi');
        }
      });
      req.on('error', () => xong(r.token, 'loi'));
      req.end(JSON.stringify(tin(r)));
    }
    setTimeout(() => { for (const r of rows) xong(r.token, 'loi'); }, 15_000).unref();
  });
}

/* ---------- FCM ---------- */

interface TaiKhoanFcm { client_email: string; private_key: string; project_id: string }

async function tokenFcm(sa: TaiKhoanFcm, layFetch: typeof fetch): Promise<string> {
  const b64 = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const dau = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  })}`;
  const ky = sign('RSA-SHA256', Buffer.from(dau), createPrivateKey(sa.private_key)).toString('base64url');
  const r = await layFetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dau}.${ky}` })
  });
  if (!r.ok) throw new Error(`FCM OAuth ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

/* ---------- lớp chính ---------- */

export interface ThongBao {
  /** Xử lý `/api/thongbao/*`. Trả false nếu không phải đường của nó. */
  xuLy(req: IncomingMessage, res: ServerResponse, url: URL,
    json: (res: ServerResponse, body: unknown, status?: number) => void): Promise<boolean>;
  /** Sổ phòng vừa nhận một phòng công khai MỚI. `conCho` kiểm lại sau TRE_MS. */
  phongMoi(phong: PublicRoom, conCho: (code: string) => Promise<boolean>): void;
  /** Máy của chủ phòng (client gửi `?tb=` lúc tạo phòng) — không báo phòng của chính mình. */
  ghiChuPhong(code: string, token: string): void;
}

function docBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c: Buffer) => { s += c; if (s.length > 4096) { req.destroy(); resolve(null); } });
    req.on('end', () => { try { resolve(JSON.parse(s) as Record<string, unknown>); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

export async function moThongBao(
  pool: Pool | null, env: EnvThongBao, layFetch: typeof fetch = fetch
): Promise<ThongBao | null> {
  const apns: KhoaApns | null = env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY
    ? {
      keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID, privateKey: env.APNS_PRIVATE_KEY,
      topic: env.APNS_TOPIC || 'com.hello314.flipmatch', sandbox: env.APNS_SANDBOX === '1'
    }
    : null;
  let fcm: TaiKhoanFcm | null = null;
  if (env.FCM_SERVICE_ACCOUNT) {
    try { fcm = JSON.parse(env.FCM_SERVICE_ACCOUNT) as TaiKhoanFcm; } catch { console.error('[thongbao] FCM_SERVICE_ACCOUNT không phải JSON'); }
  }
  if (!pool || (!apns && !fcm)) return null;
  await pool.query(TAO_BANG);

  let jwtCache: { jwt: string; luc: number } | null = null;
  const layJwt = (now: number): string => {
    // Apple: JWT sống 1 giờ, làm mới không quá 1 lần mỗi 20 phút
    if (!jwtCache || now - jwtCache.luc > 40 * 60_000) jwtCache = { jwt: jwtApns(apns!, now), luc: now };
    return jwtCache.jwt;
  };
  let fcmCache: { token: string; luc: number } | null = null;
  const layFcm = async (now: number): Promise<string> => {
    if (!fcmCache || now - fcmCache.luc > 50 * 60_000) fcmCache = { token: await tokenFcm(fcm!, layFetch), luc: now };
    return fcmCache.token;
  };

  async function guiFcm(rows: DangKy[], phong: PublicRoom): Promise<Map<string, KetQua>> {
    const kq = new Map<string, KetQua>();
    if (!rows.length) return kq;
    let tk: string;
    try { tk = await layFcm(Date.now()); } catch (e) {
      console.error('[thongbao]', (e as Error).message);
      for (const r of rows) kq.set(r.token, 'loi');
      return kq;
    }
    await Promise.all(rows.map(async (r) => {
      const c = chuThongBao(r.lang, phong.chuPhong);
      try {
        const res = await layFetch(`https://fcm.googleapis.com/v1/projects/${fcm!.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: {
            token: r.token,
            notification: { title: c.tieuDe, body: c.than },
            data: { room: phong.code },
            android: { priority: 'high', ttl: '600s', notification: { tag: 'phong-moi', icon: 'ic_stat_thong_bao', color: '#5bc0f0' } }
          } })
        });
        if (res.ok) kq.set(r.token, 'ok');
        else {
          // CHỈ 404 (UNREGISTERED) là máy chết. 400 có thể do chính tin mình sai — xoá theo 400
          // là một lỗi soạn tin xoá sạch mọi máy Android đã đăng ký.
          const chet = res.status === 404;
          if (!chet) console.error('[thongbao] FCM', res.status);
          kq.set(r.token, chet ? 'bo' : 'loi');
        }
      } catch { kq.set(r.token, 'loi'); }
    }));
    return kq;
  }

  let dotCuoi = 0;
  const daBao = new Map<string, number>();

  const chuPhong = new Map<string, string>();

  async function guiDot(phong: PublicRoom): Promise<void> {
    const now = Date.now();
    if (now - dotCuoi < CACH_DOT_MS) return;
    const [rows] = await pool!.query('SELECT token, nen, lang, lech_phut, gui_cuoi FROM push_dangky WHERE gui_cuoi <= ?', [now - CACH_MAY_MS]);
    const nhan = chonNguoiNhan((rows as DangKy[]).map((r) => ({ ...r, gui_cuoi: Number(r.gui_cuoi) })), now)
      .filter((r) => (r.nen === 'ios' ? !!apns : !!fcm) && r.token !== chuPhong.get(phong.code));
    if (!nhan.length) return;
    dotCuoi = now;
    const ios = nhan.filter((r) => r.nen === 'ios');
    const [kqIos, kqAnd] = await Promise.all([
      apns ? guiApns(apns, layJwt(now), ios, (r) => {
        const c = chuThongBao(r.lang, phong.chuPhong);
        return { aps: { alert: { title: c.tieuDe, body: c.than }, sound: 'default', 'thread-id': 'phong-moi' }, room: phong.code };
      }) : Promise.resolve(new Map<string, KetQua>()),
      fcm ? guiFcm(nhan.filter((r) => r.nen === 'android'), phong) : Promise.resolve(new Map<string, KetQua>())
    ]);
    const ok: string[] = []; const bo: string[] = [];
    for (const m of [kqIos, kqAnd]) for (const [t, v] of m) (v === 'ok' ? ok : v === 'bo' ? bo : []).push(t);
    if (ok.length) await pool!.query('UPDATE push_dangky SET gui_cuoi = ? WHERE token IN (?)', [now, ok]);
    if (bo.length) await pool!.query('DELETE FROM push_dangky WHERE token IN (?)', [bo]);
    console.log(`[thongbao] phòng ${phong.code}: gửi ${ok.length}, bỏ ${bo.length}, lỗi ${nhan.length - ok.length - bo.length}`);
  }

  return {
    ghiChuPhong(code, token) {
      if (!/^[A-Za-z0-9:_-]{20,250}$/.test(token)) return;
      if (chuPhong.size > 5000) chuPhong.clear();
      chuPhong.set(code, token);
    },

    phongMoi(phong, conCho) {
      const now = Date.now();
      for (const [c, luc] of daBao) if (now - luc > 3_600_000) daBao.delete(c);
      if (daBao.has(phong.code)) return;
      daBao.set(phong.code, now);
      setTimeout(() => {
        void conCho(phong.code)
          .finally(() => setTimeout(() => chuPhong.delete(phong.code), 1000).unref())
          .then((con) => (con ? guiDot(phong) : undefined))
          .catch((e) => console.error('[thongbao] lỗi gửi:', (e as Error).message));
      }, TRE_MS).unref();
    },

    async xuLy(req, res, url, json) {
      if (!url.pathname.startsWith('/api/thongbao')) return false;
      if (url.pathname === '/api/thongbao/config' && req.method === 'GET') {
        json(res, { ios: !!apns, android: !!fcm });
        return true;
      }
      if (url.pathname === '/api/thongbao' && req.method === 'POST') {
        const b = await docBody(req);
        const token = typeof b?.token === 'string' ? b.token : '';
        const nen = b?.nen === 'ios' || b?.nen === 'android' ? b.nen : null;
        if (!nen || !/^[A-Za-z0-9:_-]{20,250}$/.test(token)) { json(res, { error: 'Sai dữ liệu' }, 400); return true; }
        const lang = typeof b?.lang === 'string' && CHU[b.lang] ? b.lang : 'en';
        const lech = Math.max(-840, Math.min(840, Math.round(Number(b?.lechPhut) || 0)));
        await pool!.query(
          `INSERT INTO push_dangky (token, nen, lang, lech_phut, tao) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nen = VALUES(nen), lang = VALUES(lang), lech_phut = VALUES(lech_phut)`,
          [token, nen, lang, lech, Date.now()]
        );
        json(res, { ok: true });
        return true;
      }
      if (url.pathname === '/api/thongbao/tat' && req.method === 'POST') {
        const b = await docBody(req);
        const token = typeof b?.token === 'string' ? b.token : '';
        if (token) await pool!.query('DELETE FROM push_dangky WHERE token = ?', [token]);
        json(res, { ok: true });
        return true;
      }
      return false;
    }
  };
}
