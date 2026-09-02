// Smoke test E2E: 2 client chơi trọn ván qua wrangler dev (Node 22 có sẵn WebSocket)
// Mặc định đánh vào wrangler dev; đặt MM_SERVER để soi worker đã deploy thật,
// ví dụ MM_SERVER=https://memory-match-server.nkien-bk.workers.dev
import { moGoiTin } from './lib-view.mjs';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const WS = SERVER.replace('http', 'ws');
const fail = (m) => { console.error('✗', m); process.exit(1); };

class Client {
  constructor(name) { this.name = name; this.inbox = []; this.waiters = []; }
  connect(code, token = '') {
    const p = new URLSearchParams({ name: this.name });
    if (token) p.set('token', token);
    this.ws = new WebSocket(`${WS}/ws/${code}?${p}`);
    this.ws.onmessage = (e) => {
      const msg = moGoiTin(JSON.parse(e.data));
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
// Cấp 1 là bàn nhỏ nhất — ván ngắn nhất để smoke chạy nhanh
// Tắt sạch năm tuỳ chọn: mặc định nay bật cả năm ở mức 1, mà "xem trước" giữ
// bàn hé mở mấy giây đầu nên nước lật đầu tiên của smoke rơi vào lúc bàn khoá.
const BAN_TRON = { time: 0, lives: 0, peek: 0, shuffle: 0, special: 0 };
an.send({ t: 'config', config: { level: 1, options: BAN_TRON } });
const cfg = await binh.wait((m) => m.t === 'room' && m.room.config.level === 1, 'config cấp 1');
console.log('✓ chủ phòng đổi sang cấp 1 (bàn nhỏ nhất)');
// Chỉ soi các tin ĐẾN SAU đây: inbox còn giữ tin lúc phòng mới lập (cấp mặc
// định), xét cả inbox thì assertion nào cũng đỏ
const mark = an.inbox.length;
binh.send({ t: 'config', config: { level: 18 } });             // phải bị bỏ qua
// Số cấp rác cũng phải bị bỏ qua, không thì presetConfig ném lỗi lúc start và
// treo cả phòng (ON-09)
an.send({ t: 'config', config: { level: 999 } });
an.send({ t: 'config', config: { level: 2.5 } });
binh.send({ t: 'start' });                                     // khách không được start
await new Promise((r) => setTimeout(r, 400));
if (an.inbox.slice(mark).some((m) => m.t === 'room' && m.room.config.level !== 1)) {
  fail('config bị đổi sai — khách đổi được, hoặc số cấp rác lọt qua!');
}
if (an.inbox.some((m) => m.t === 'state')) fail('khách start được ván!');
console.log('✓ khách không đổi được config / không start được (ON-03, ON-09)');

binh.send({ t: 'ready', ready: true });
await new Promise((r) => setTimeout(r, 400));
an.send({ t: 'start' });
await new Promise((r) => setTimeout(r, 5600));   // qua đếm ngược 5 giây
const st = await binh.wait((m) => m.t === 'state', 'state đầu ván');
const view = st.view;
// SUY RA từ view, không ghi cứng: thang cấp đổi thì con số ghi cứng làm smoke
// đỏ oan (đã xảy ra khi cấp 2 chuyển từ bàn 2×2 sang 2×3)
if (view.cards.length !== view.cols * view.rows) fail('số thẻ không khớp cols×rows');
if (view.totalPairs * 2 !== view.cards.length) fail('bàn phải kín, không ô trống');
console.log(`  bàn ${view.cols}×${view.rows} = ${view.cards.length} thẻ, ${view.totalPairs} cặp`);
if (view.cards.some((c) => c.symbol)) fail('LỘ THẺ ÚP! (NF-04)');
console.log('✓ ván bắt đầu, không thẻ nào lộ symbol');

// Lật khi không phải lượt mình → server bỏ qua
const [current, other] = view.currentId === an.id ? [an, binh] : [binh, an];
other.send({ t: 'flip', index: 0 });
await new Promise((r) => setTimeout(r, 300));
if ([an, binh].some((c) => c.inbox.some((m) => m.t === 'events'))) fail('sai lượt mà vẫn lật được!');
console.log('✓ lật sai lượt bị server bỏ qua (ON-09)');

// Chơi trọn ván: lật 0,1 — nếu trượt thì server tự úp lại, thử cặp khác
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
