// Smoke test E2E: 2 client chơi trọn ván qua wrangler dev (Node 22 có sẵn WebSocket)
const SERVER = 'http://127.0.0.1:8787';
const WS = SERVER.replace('http', 'ws');
const fail = (m) => { console.error('✗', m); process.exit(1); };

class Client {
  constructor(name) { this.name = name; this.inbox = []; this.waiters = []; }
  connect(code, token = '') {
    const p = new URLSearchParams({ name: this.name });
    if (token) p.set('token', token);
    this.ws = new WebSocket(`${WS}/ws/${code}?${p}`);
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const i = this.waiters.findIndex((w) => w.pred(msg));
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
      else this.inbox.push(msg);
    };
    return this.wait((m) => m.t === 'welcome', 'welcome ' + this.name);
  }
  wait(pred, label, ms = 8000) {
    const i = this.inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        console.error('INBOX', this.name, JSON.stringify(this.inbox.map((m) => m.t === 'events' ? m.events.map((e) => e.type).join('+') : m.t)));
        reject(new Error('timeout: ' + label));
      }, ms);
      this.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }
  send(msg) { this.ws.send(JSON.stringify(msg)); }
}

const { code } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
console.log('phòng:', code);

const an = new Client('An'), binh = new Client('Bình');
const w1 = await an.connect(code);
an.id = w1.playerId; an.token = w1.token;
if (w1.room.hostId !== an.id) fail('An phải là chủ phòng');

const w2 = await binh.connect(code);
binh.id = w2.playerId;
const roomUpd = await an.wait((m) => m.t === 'room' && m.room.players.length === 2, 'Bình vào phòng');
console.log('✓ 2 người trong phòng:', roomUpd.room.players.map((p) => p.name).join(', '));

// Chủ phòng chỉnh cấu hình; khách chỉnh phải bị từ chối
an.send({ t: 'config', config: { grid: '2x2' } });
const cfg = await binh.wait((m) => m.t === 'room' && m.room.config.grid === '2x2', 'config 2x2');
console.log('✓ chủ phòng đổi lưới 2x2');
binh.send({ t: 'config', config: { grid: '6x6' } });          // phải bị bỏ qua
binh.send({ t: 'start' });                                     // khách không được start
await new Promise((r) => setTimeout(r, 400));
if (an.inbox.some((m) => m.t === 'room' && m.room.config.grid === '6x6')) fail('khách đổi được config!');
if (an.inbox.some((m) => m.t === 'state')) fail('khách start được ván!');
console.log('✓ khách không đổi được config / không start được (ON-03, ON-09)');

binh.send({ t: 'ready', ready: true });
await new Promise((r) => setTimeout(r, 400));
an.send({ t: 'start' });
await new Promise((r) => setTimeout(r, 5600));   // qua đếm ngược 5 giây
const st = await binh.wait((m) => m.t === 'state', 'state đầu ván');
const view = st.view;
if (view.cards.length !== 4) fail('bàn 2x2 phải có 4 thẻ');
if (view.cards.some((c) => c.symbol)) fail('LỘ THẺ ÚP! (NF-04)');
console.log('✓ ván bắt đầu, không thẻ nào lộ symbol');

// Lật khi không phải lượt mình → server bỏ qua
const [current, other] = view.currentId === an.id ? [an, binh] : [binh, an];
other.send({ t: 'flip', index: 0 });
await new Promise((r) => setTimeout(r, 300));
if ([an, binh].some((c) => c.inbox.some((m) => m.t === 'events'))) fail('sai lượt mà vẫn lật được!');
console.log('✓ lật sai lượt bị server bỏ qua (ON-09)');

// Chơi trọn ván 2x2: lật 0,1 — nếu trượt thì server tự úp lại, thử cặp khác
async function flipBoth(c, i, j) {
  c.send({ t: 'flip', index: i });
  await Promise.all([an, binh].map((x) => x.wait((m) => m.t === 'events' && m.events.some((e) => e.type === 'flip' && e.index === i), `flip ${i}`)));
  c.send({ t: 'flip', index: j });
  const r = await c.wait((m) => m.t === 'events' && m.events.some((e) => e.type === 'match' || e.type === 'miss'), `kq ${i},${j}`);
  return { match: r.events.some((e) => e.type === 'match'), view: r.view, events: r.events };
}
let v = view, guard = 0, turnHolder = current;
const missed = new Set();   // các tổ hợp đã biết là trượt
while (!v.summary && guard++ < 16) {
  // Xả message 'events' tồn đọng của vòng trước — broadcast tới cả 2 client
  // nhưng mỗi vòng chỉ một bên consume, bên kia sẽ match nhầm ở vòng sau
  for (const c of [an, binh]) c.inbox = c.inbox.filter((m) => m.t !== 'events');
  const down = v.cards.filter((c) => c.state === 'down').map((c) => c.index);
  let [i, j] = [down[0], down[1]];
  outer: for (const a of down) { for (const b of down) { if (a < b && !missed.has(`${a},${b}`)) { i = a; j = b; break outer; } } }
  console.log('  lật', i, j, 'bởi', turnHolder.name);
  const r = await flipBoth(turnHolder, i, j);
  if (!r.match) missed.add(`${i},${j}`);
  v = r.view;
  if (!r.match) {
    // đợi server úp lại + chuyển lượt (alarm ~1s)
    const upd = await an.wait((m) => m.t === 'events' && m.events.some((e) => e.type === 'turn'), 'chuyển lượt', 5000);
    v = upd.view;
    turnHolder = v.currentId === an.id ? an : binh;
  }
}
if (!v.summary) fail('ván không kết thúc');
console.log('✓ ván kết thúc:', v.summary.ranking.map((p) => `${p.name}=${p.score}`).join(' '), '— người thắng:', v.summary.ranking[0].name);

// Emoji chat
an.send({ t: 'emoji', emoji: '🔥' });
const em = await binh.wait((m) => m.t === 'emoji', 'emoji');
if (em.emoji !== '🔥' || em.from !== an.id) fail('emoji sai');
an.send({ t: 'emoji', emoji: 'chữ tự do' });   // ngoài danh sách → bị chặn
await new Promise((r) => setTimeout(r, 300));
if (binh.inbox.some((m) => m.t === 'emoji' && m.emoji === 'chữ tự do')) fail('emoji tự do lọt lưới!');
console.log('✓ emoji trong danh sách đi qua, ngoài danh sách bị chặn (ON-08)');

// Reconnect bằng token (ON-07)
an.ws.close();
await new Promise((r) => setTimeout(r, 500));
const w3 = await an.connect(code, an.token);
if (w3.playerId !== an.id) fail('reconnect ra id khác!');
console.log('✓ vào lại bằng token giữ nguyên danh tính (ON-07)');

console.log('\nSMOKE TEST PASSED');
process.exit(0);
