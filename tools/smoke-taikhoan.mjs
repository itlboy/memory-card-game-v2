/**
 * SMOKE TẦNG TÀI KHOẢN — chạy với server Node CÓ MySQL + GOOGLE_CLIENT_ID.
 *
 *   MM_SERVER=http://127.0.0.1:8080 MYSQL_URL=mysql://root:x@127.0.0.1:3307/latthe \
 *     node tools/smoke-taikhoan.mjs
 *
 * Không đi qua Google thật: tạo thẳng một dòng `users` rồi tự ký phiên bằng
 * đúng cách server suy khoá (sha256 của "mm-auth:" + MYSQL_URL khi không đặt
 * AUTH_SECRET). Nhờ thế kiểm được toàn bộ SQL của /api/me*, /api/bxh — thứ
 * test đơn vị không chạm tới.
 */
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8080';
const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) { console.error('cần MYSQL_URL'); process.exit(2); }
const require = createRequire(new URL('../apps/node-server/package.json', import.meta.url));
const { createConnection } = require('mysql2/promise');

const secret = process.env.AUTH_SECRET ?? createHash('sha256').update(`mm-auth:${MYSQL_URL}`).digest('hex');
const ky = (t) => createHmac('sha256', secret).update(t).digest('base64url');
const phien = (uid) => { const t = `${uid}.${Date.now() + 3600_000}`; return `${t}.${ky(t)}`; };

let loi = 0;
const ok = (dk, msg) => { console.log(`${dk ? '✓' : '✗'} ${msg}`); if (!dk) loi++; };
const goi = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${SERVER}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  let data = null; try { data = await res.json(); } catch { /* không phải json */ }
  return { status: res.status, data };
};

const db = await createConnection({ uri: MYSQL_URL });
const sub = `smoke-${Date.now()}`;
await db.execute(
  'INSERT INTO users (google_sub, email, name, avatar_url, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)',
  [sub, 'smoke@x.vn', 'Smoke', null, Date.now(), Date.now()]
);
const [[{ id: uid }]] = await db.query('SELECT id FROM users WHERE google_sub = ?', [sub]);
const token = phien(uid);

try {
  let r = await goi('/api/auth/config');
  ok(r.status === 200 && r.data?.googleClientId, 'GET /api/auth/config trả client id');

  r = await goi('/api/auth/google', { method: 'POST', body: { credential: 'rac-'.repeat(10) } });
  ok(r.status === 401, 'POST /api/auth/google với token rác → 401');

  r = await goi('/api/me');
  ok(r.status === 401, 'GET /api/me không phiên → 401');
  r = await goi('/api/me', { token: token.slice(0, -2) + 'zz' });
  ok(r.status === 401, 'GET /api/me phiên sửa chữ ký → 401');

  r = await goi('/api/me', { token });
  ok(r.status === 200 && r.data?.me?.name === 'Smoke' && r.data.me.matches === 0, 'GET /api/me đúng hồ sơ mới');

  r = await goi('/api/me/van', { method: 'POST', token, body: {
    ketQua: 'thang', score: 300, boardKey: 'classic:L3', moves: 9, seconds: 20, achievements: ['flawless']
  } });
  ok(r.status === 200 && r.data.me.totalScore === 300 && r.data.me.wins === 1 && r.data.me.matches === 1,
    'ván thắng: cộng điểm, +1 ván, +1 thắng');
  ok(r.data.me.best['classic:L3']?.score === 300 && r.data.me.achievements.includes('flawless'),
    'ván thắng: ghi kỷ lục và danh hiệu');

  r = await goi('/api/me/van', { method: 'POST', token, body: {
    ketQua: 'thang', score: 200, boardKey: 'classic:L3', moves: 5, seconds: 10
  } });
  ok(r.data.me.best['classic:L3'].score === 300 && r.data.me.best['classic:L3'].moves === 9,
    'kỷ lục thấp hơn KHÔNG ghi đè (giữ cả moves/seconds cũ)');

  r = await goi('/api/me/van', { method: 'POST', token, body: { ketQua: 'hoa', score: 50 } });
  ok(r.data.me.draws === 1 && r.data.me.matches === 3 && r.data.me.totalScore === 550, 'ván hoà: +1 hoà');
  r = await goi('/api/me/van', { method: 'POST', token, body: { ketQua: 'thua', score: 0, boardKey: 'classic:L1' } });
  ok(r.data.me.losses === 1 && !r.data.me.best['classic:L1'], 'ván thua: +1 thua, không ghi kỷ lục');

  r = await goi('/api/me/van', { method: 'POST', token, body: { ketQua: 'thang', score: 10_000_000 } });
  ok(r.status === 400, 'điểm vượt trần → 400');

  r = await goi('/api/me/dongbo', { method: 'POST', token, body: {
    totalScore: 5000, best: { 'classic:L3': { score: 900, moves: 4, seconds: 8 }, 'rac;drop': { score: 1 } },
    achievements: ['combo-master', 'flawless']
  } });
  ok(r.data.me.totalScore === 5000, 'đồng bộ: tổng điểm NÂNG lên bản cục bộ cao hơn');
  ok(r.data.me.best['classic:L3'].score === 900 && !r.data.me.best['rac;drop'], 'đồng bộ: hợp kỷ lục theo MAX, bỏ khoá rác');
  ok(r.data.me.achievements.length === 2, 'đồng bộ: danh hiệu hợp nhất, không trùng');
  r = await goi('/api/me/dongbo', { method: 'POST', token, body: { totalScore: 100, best: {}, achievements: [] } });
  ok(r.data.me.totalScore === 5000, 'đồng bộ lần hai với số thấp hơn: KHÔNG hạ, KHÔNG cộng dồn');

  r = await goi('/api/bxh');
  ok(r.status === 200 && r.data.top.some((d) => d.id === uid && d.totalScore === 5000), 'bảng xếp hạng có người này');
  ok(!JSON.stringify(r.data).includes('smoke@x.vn'), 'bảng xếp hạng KHÔNG lộ email');

  r = await goi('/api/me/khong-co', { token });
  ok(r.status === 404, 'đường lạ dưới /api/me → 404');
} finally {
  await db.execute('DELETE FROM users WHERE google_sub = ?', [sub]);
  await db.end();
}
console.log(loi ? `\n${loi} lỗi` : '\nsmoke tài khoản: sạch');
process.exit(loi ? 1 : 0);
