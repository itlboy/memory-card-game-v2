/**
 * Chế độ CHỚP NHOÁNG trong phòng online: cả bàn hé mở rồi phải TỰ ÚP LẠI đúng
 * hạn, và client phải biết còn mấy giây.
 *
 *   pnpm dev:server  rồi  node tools/smoke-peek.mjs
 *   MM_SERVER=<url> node tools/smoke-peek.mjs
 *
 * Vì sao cần kịch bản riêng: lúc hé bàn, `flip()` bị chặn (status = 'peeking')
 * nên KHÔNG có nước đi nào làm engine nhích. Thứ duy nhất kết thúc được nó là
 * alarm phía server — mà `scheduleNext()` từng không hẹn mốc `revealUntil`, nên
 * bàn nằm mở tới khi có alarm khác tình cờ nổ. Bug này cũng đúng với thẻ Mắt
 * thần (hé cả bàn 5 giây) ở mọi chế độ.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('✗ ' + m); process.exit(1); };
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(5)}s]`, ...a);

const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  const t = setTimeout(() => rej(new Error('không mở được socket')), 5000);
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onopen = () => { clearTimeout(t); res(c); };
});
const view = (c) => [...c.msgs].reverse().find((m) => m.view)?.view;

const code = await mkRoom();
const a = await mk(code, 'An');
const b = await mk(code, 'Binh');
await sleep(500);
// Cấp 2 = bàn nhỏ để thời gian hé ngắn, test không phải chờ lâu.
// KHÔNG còn `mode`: luật phòng giờ là năm tuỳ chọn (xem engine/options.ts).
a.send({ t: 'config', config: { level: 2, options: { time: 0, lives: 0, peek: 2, shuffle: 0, special: 0 } } });
await sleep(300);
b.send({ t: 'ready', ready: true });
await sleep(300);
a.send({ t: 'start' });

// Qua đếm ngược 3 giây rồi ván chạy → cả bàn phải đang hé mở
await sleep(4200);
const v1 = view(a);
if (!v1) fail('không nhận được view nào sau khi bắt đầu');
const moTruoc = v1.cards.filter((c) => c.state === 'up').length;
log(`đang hé mở: ${moTruoc}/${v1.cards.length} thẻ · peekLeft = ${v1.peekLeft}`);
if (moTruoc !== v1.cards.length) fail(`bàn phải hé mở TRỌN VẸN, mới có ${moTruoc}/${v1.cards.length}`);
if (typeof v1.peekLeft !== 'number' || v1.peekLeft <= 0) {
  fail(`view phải chở peekLeft (số giây còn lại), đang là ${JSON.stringify(v1.peekLeft)}`);
}

// Không ai lật gì (lật lúc này bị chặn) — server PHẢI tự úp lại đúng hạn.
const conLai = v1.peekLeft;
log(`không ai thao tác, chờ ${conLai.toFixed(1)}s + 1,5s xem server có tự úp lại…`);
await sleep(conLai * 1000 + 1500);
const v2 = view(a);
const moSau = v2.cards.filter((c) => c.state === 'up').length;
log(`sau hạn hé mở: ${moSau} thẻ còn mở · status = ${v2.status}`);
if (moSau !== 0) fail(`bàn phải úp lại hết mà còn ${moSau} thẻ mở — chuỗi alarm không hẹn mốc peek`);
if (v2.status !== 'playing') fail(`status phải là 'playing', đang là '${v2.status}'`);
if (v2.peekLeft !== null) fail(`hết hé mở thì peekLeft phải null, đang là ${v2.peekLeft}`);
console.log('✓ chớp nhoáng online: bàn hé mở trọn vẹn, tự úp lại đúng hạn, view chở peekLeft');
console.log('\nPEEK SMOKE OK');
process.exit(0);
