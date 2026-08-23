/**
 * Chống spam emoji (3 lần / cửa sổ ROOM_LIMITS.emojiWindowMs) — E2E thật qua wrangler dev.
 * Chạy: pnpm dev:server (hoặc pnpm dev) rồi `node tools/smoke-chat-limit.mjs`.
 * Kiểm ở SERVER vì client không đáng tin (ON-09): người sửa client vẫn phải
 * chịu hạn mức.
 */
import { readFileSync } from 'node:fs';

const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
// Đọc danh sách thật từ engine (node thuần không nạp được .ts nên bóc bằng
// regex): hard-code emoji thì mỗi lần đổi QUICK_EMOJIS là test fail oan.
const src = readFileSync(new URL('../packages/engine/src/online.ts', import.meta.url), 'utf8');
const [E1, E2, E3] = [...src.match(/QUICK_EMOJIS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!E3) { console.log('✗ không đọc được QUICK_EMOJIS từ engine'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.log('✗ ' + msg); process.exit(1); };

const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { name, ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onopen = () => res(c);
});

const code = await mkRoom();
const host = await mk(code, 'Host');
const other = await mk(code, 'B');
await sleep(600);
const heard = (c) => c.msgs.filter((m) => m.t === 'emoji').length;

// Gửi dồn 5 cái: chỉ 3 cái đầu được phát
for (let i = 0; i < 5; i++) { host.send({ t: 'emoji', emoji: E1 }); await sleep(60); }
await sleep(500);
if (heard(other) !== 3) fail(`gửi dồn 5 lần, người kia nhận ${heard(other)} (phải là 3)`);
console.log('✓ gửi dồn 5 lần chỉ 3 cái được phát');

// Vẫn bị chặn khi cửa sổ chưa trôi qua
const before = heard(other);
host.send({ t: 'emoji', emoji: E2 });
await sleep(400);
if (heard(other) !== before) fail('cái thứ tư vẫn lọt qua trong cửa sổ chống spam');
console.log('✓ trong cửa sổ chống spam không lọt thêm cái nào');

// Hạn mức tính RIÊNG từng người
other.send({ t: 'emoji', emoji: E2 });
await sleep(400);
if (heard(host) < 1) fail('người khác bị chặn oan vì hạn mức của host');
console.log('✓ hạn mức tính riêng từng người');

// Hết cửa sổ thì gửi lại được. Chờ theo ĐÚNG hằng số của engine, không ghi cứng
// 10 giây — đổi emojiWindowMs là test này đỏ oan.
const WINDOW = Number(
  /emojiWindowMs:\s*([0-9_]+)/.exec(src)[1].replace(/_/g, '')
);
const beforeWait = heard(other);
await sleep(WINDOW + 800);
host.send({ t: 'emoji', emoji: E3 });
await sleep(500);
if (heard(other) !== beforeWait + 1) fail(`sau ${WINDOW / 1000} giây vẫn không gửi lại được`);
console.log(`✓ sau ${WINDOW / 1000} giây được gửi lại`);

console.log('\nCHAT LIMIT SMOKE OK');
process.exit(0);
