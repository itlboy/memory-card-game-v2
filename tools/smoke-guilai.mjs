// Smoke: NƯỚC ĐI GỬI LẠI ĐƯỢC.
//   MM_SERVER=http://127.0.0.1:8787 node tools/smoke-guilai.mjs
//
// Đây là thứ khiến "game đi lần lượt mà mạng yếu vẫn hỏng": trước đây một nước
// lật rơi giữa đường là mất luôn, vì client không dám gửi lại — trên dây, gửi
// lại một nước cũ trông y hệt lật thêm một thẻ. Nay mỗi nước mang `seq` và
// server bỏ tin trùng, nên gửi lại bao nhiêu lần cũng chỉ lật đúng một thẻ.
import { moGoiTin } from './lib-view.mjs';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const WS = SERVER.replace('http', 'ws');
const hong = (m) => { console.error('✗', m); process.exit(1); };
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

function mo(code, name, token = '') {
  const p = new URLSearchParams({ name });
  if (token) p.set('token', token);
  const ws = new WebSocket(`${WS}/ws/${code}?${p}`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  return new Promise((res) => { ws.onopen = () => res(c); });
}
const cuoi = (c, t) => c.msgs.filter((m) => m.t === t).at(-1);

const { code } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
const a = await mo(code, 'An'); await cho(400);
const b = await mo(code, 'Bình'); await cho(400);
const wA = cuoi(a, 'welcome'), wB = cuoi(b, 'welcome');
if (typeof wA.flipSeq !== 'number') hong('welcome không kèm flipSeq — client tải lại trang giữa ván sẽ bị nuốt hết nước đi');
console.log('✓ welcome mang flipSeq =', wA.flipSeq);

b.send({ t: 'ready', ready: true }); await cho(400);
a.send({ t: 'start' });
await cho(7000);
let v = cuoi(a, 'state')?.view ?? cuoi(a, 'events')?.view;
if (!v) hong('ván không bắt đầu');
if (!v.cards) hong('view không mở gói được — dạng trên dây sai');
console.log(`✓ ván chạy, bàn ${v.cards.length} thẻ`);

// Người đang tới lượt gửi CÙNG MỘT nước ba lần, đúng như lúc mạng chập chờn
const di = v.currentId === wA.playerId ? a : b;
const seq = Date.now();
const truoc = v.moves;
for (let i = 0; i < 3; i++) { di.send({ t: 'flip', index: 0, seq }); await cho(120); }
await cho(700);
v = cuoi(di, 'events')?.view ?? cuoi(di, 'state')?.view;
const ngua = v.cards.filter((c) => c.state === 'up').length;
if (ngua !== 1) hong(`gửi lại 3 lần mà lật ${ngua} thẻ — chốt chống trùng hỏng, đây đúng là lỗi lật thêm thẻ`);
console.log('✓ gửi lại 3 lần chỉ lật đúng 1 thẻ');

// seq cũ hơn thì bỏ qua, nhưng VẪN phải trả view — im lặng là client treo tới hết hạn
const truocSoTin = di.msgs.length;
di.send({ t: 'flip', index: 5, seq: seq - 1 });
await cho(600);
if (di.msgs.length === truocSoTin) hong('tin trùng bị nuốt im — người gửi ngồi chờ tới hết lượt');
v = cuoi(di, 'state')?.view ?? cuoi(di, 'events')?.view;
if (v.cards.filter((c) => c.state === 'up').length !== 1) hong('seq cũ vẫn lật được thẻ');
console.log('✓ seq cũ: bỏ qua nước đi nhưng vẫn trả view về');

// resync: xin lại trạng thái trên chính socket đang mở
const truocResync = a.msgs.length;
a.send({ t: 'resync' });
await cho(600);
const moi = a.msgs.slice(truocResync);
if (!moi.some((m) => m.t === 'state')) hong('resync không trả state — vẫn phải đập kết nối mỗi khi nghi ngờ');
if (!moi.some((m) => m.t === 'room')) hong('resync không trả room');
console.log('✓ resync trả về room + state trên socket đang mở');

// predeal không đi kèm mỗi nước lật nữa
const diB = cuoi(a, 'state')?.view?.currentId === wA.playerId ? a : b;
const truocPredeal = a.msgs.filter((m) => m.t === 'predeal').length;
diB.send({ t: 'flip', index: 1, seq: Date.now() });
await cho(700);
const sauPredeal = a.msgs.filter((m) => m.t === 'predeal').length;
if (process.env.PREDEAL !== '0' && sauPredeal > truocPredeal) {
  hong('predeal vẫn gửi kèm mỗi nước lật — cả bàn đi lại dù bàn không đổi chỗ thẻ');
}
console.log('✓ predeal không đi kèm nước lật thường');

console.log('\nGUI-LAI SMOKE OK');
process.exit(0);
