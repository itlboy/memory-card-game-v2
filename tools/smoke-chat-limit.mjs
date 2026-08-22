/**
 * Chống spam emoji (3 lần / 10 giây) — E2E thật qua wrangler dev.
 * Chạy: pnpm dev:server (hoặc pnpm dev) rồi `node tools/smoke-chat-limit.mjs`.
 * Kiểm ở SERVER vì client không đáng tin (ON-09): người sửa client vẫn phải
 * chịu hạn mức.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
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
for (let i = 0; i < 5; i++) { host.send({ t: 'emoji', emoji: '👍' }); await sleep(60); }
await sleep(500);
if (heard(other) !== 3) fail(`gửi dồn 5 lần, người kia nhận ${heard(other)} (phải là 3)`);
console.log('✓ gửi dồn 5 lần chỉ 3 cái được phát');

// Vẫn bị chặn khi cửa sổ chưa trôi qua
const before = heard(other);
host.send({ t: 'emoji', emoji: '🔥' });
await sleep(400);
if (heard(other) !== before) fail('cái thứ tư vẫn lọt qua trong cửa sổ 10 giây');
console.log('✓ trong cửa sổ 10 giây không lọt thêm cái nào');

// Hạn mức tính RIÊNG từng người
other.send({ t: 'emoji', emoji: '😂' });
await sleep(400);
if (heard(host) < 1) fail('người khác bị chặn oan vì hạn mức của host');
console.log('✓ hạn mức tính riêng từng người');

// Hết cửa sổ thì gửi lại được
const beforeWait = heard(other);
await sleep(10_000);
host.send({ t: 'emoji', emoji: '🎉' });
await sleep(500);
if (heard(other) !== beforeWait + 1) fail('sau 10 giây vẫn không gửi lại được');
console.log('✓ sau 10 giây được gửi lại');

console.log('\nCHAT LIMIT SMOKE OK');
process.exit(0);
