import { moGoiTin } from './lib-view.mjs';
/**
 * NÓI NHANH (`t:'say'`, 14.10.2026) — E2E thật qua server.
 * Chạy: pnpm dev:server (hoặc pnpm node:dev) rồi `node tools/smoke-noi-nhanh.mjs`
 * (MM_SERVER=<url> để chọn server). Kiểm ở SERVER vì client không đáng tin:
 *   1. mã câu hợp lệ → người kia nhận `{t:'say', from, id}`;
 *   2. mã lạ (ngoài QUICK_SAYS) → bị bỏ, không ai nhận — chat tự do không lọt qua đường này;
 *   3. CHUNG hạn mức với emoji: hết lượt emoji thì câu nói cũng bị nuốt.
 */
import { readFileSync } from 'node:fs';

const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const src = readFileSync(new URL('../packages/engine/src/online.ts', import.meta.url), 'utf8');
const SAYS = [...src.match(/QUICK_SAYS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const [E1] = [...src.match(/QUICK_EMOJIS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const BURST = Number(/emojiBurst:\s*([0-9_]+)/.exec(src)[1].replace(/_/g, ''));
if (SAYS.length < 2 || !E1) { console.log('✗ không đọc được QUICK_SAYS / QUICK_EMOJIS'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.log('✗ ' + msg); process.exit(1); };

const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { name, ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onopen = () => res(c);
});
const says = (c) => c.msgs.filter((m) => m.t === 'say');
const myId = (c) => c.msgs.find((m) => m.t === 'welcome')?.playerId ?? c.msgs.find((m) => m.t === 'welcome')?.you;

const code = await mkRoom();
const a = await mk(code, 'An');
const b = await mk(code, 'Binh');
await sleep(600);

a.send({ t: 'say', id: SAYS[1] });
await sleep(400);
const nghe = says(b);
if (nghe.length !== 1 || nghe[0].id !== SAYS[1]) fail(`người kia phải nhận đúng câu ${SAYS[1]}, nhận ${JSON.stringify(nghe)}`);
const idA = myId(a);
if (idA && nghe[0].from !== idA) fail(`from phải là id người nói (${idA}), nhận ${nghe[0].from}`);
console.log(`✓ câu "${SAYS[1]}" tới người kia, kèm đúng người nói`);

a.send({ t: 'say', id: 'chu-tu-do' });
a.send({ t: 'say', id: '<script>' });
await sleep(400);
if (says(b).length !== 1) fail('mã câu lạ vẫn được phát');
console.log('✓ mã câu ngoài danh sách bị bỏ');

// Chung hạn mức: dùng hết lượt bằng emoji (đã tốn 1 lượt cho câu ở trên)
for (let i = 0; i < BURST; i++) { a.send({ t: 'emoji', emoji: E1 }); await sleep(30); }
await sleep(300);
const truoc = says(b).length;
a.send({ t: 'say', id: SAYS[0] });
await sleep(400);
if (says(b).length !== truoc) fail('hết lượt emoji mà câu nói vẫn lọt — hai kênh phải chung hạn mức');
console.log('✓ câu nói và emoji chung một hạn mức chống spam');

a.ws.close(); b.ws.close();
console.log('✓ nói nhanh ổn');
process.exit(0);
