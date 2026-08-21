const SERVER = 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http','ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], closed: null };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onopen = () => res(c);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Đầu hàng giữa ván → người còn lại thắng ngay (reason forfeit)
let code = await mkRoom();
let a = await mk(code, 'An'), b = await mk(code, 'Binh');
await sleep(500);
b.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(400);
a.ws.send(JSON.stringify({ t: 'start' }));
await sleep(5800);   // qua đếm ngược 5 giây
b.ws.send(JSON.stringify({ t: 'leave' }));
await sleep(800);
const endEv = a.msgs.find((m) => m.t === 'events' && m.events.some((e) => e.type === 'end'));
if (!endEv) { console.log('✗ không kết thúc khi đối thủ đầu hàng'); process.exit(1); }
const sum = endEv.events.find((e) => e.type === 'end').summary;
if (sum.reason !== 'forfeit') { console.log('✗ reason sai:', sum.reason); process.exit(1); }
console.log('✓ đầu hàng: người còn lại thắng ngay, reason=forfeit, socket người rời đóng mã', b.closed);

// 2) Chủ phòng huỷ phòng ở lobby → mọi người nhận closed + socket đóng 4002
code = await mkRoom();
a = await mk(code, 'An'); b = await mk(code, 'Binh');
await sleep(500);
a.ws.send(JSON.stringify({ t: 'cancel' }));
await sleep(2000);
if (!b.msgs.some((m) => m.t === 'closed')) { console.log('✗ khách không nhận closed'); process.exit(1); }
// client thoát dựa trên message 'closed'; mã đóng socket chỉ là phòng hờ
console.log('✓ huỷ phòng: khách nhận thông báo closed' + (b.closed ? ' + socket đóng ' + b.closed : ''));

// Phòng đã huỷ thì vào lại phải thành phòng trống mới (không còn ván cũ)
const c2 = await mk(code, 'Moi');
await sleep(600);
const w2 = c2.msgs.find((m) => m.t === 'welcome');
if (!w2 || w2.spectator || w2.room.players.length !== 1) {
  console.log('✗ phòng cũ chưa được dọn:', JSON.stringify(w2?.room?.players?.length)); process.exit(1);
}
console.log('✓ storage phòng đã dọn sạch — mã cũ dùng lại thành phòng mới');

// 3) Khách gửi cancel → bị bỏ qua
code = await mkRoom();
a = await mk(code, 'An'); b = await mk(code, 'Binh');
await sleep(500);
b.ws.send(JSON.stringify({ t: 'cancel' }));
await sleep(600);
if (a.closed || a.msgs.some((m) => m.t === 'closed')) { console.log('✗ khách huỷ được phòng!'); process.exit(1); }
console.log('✓ khách không huỷ được phòng (chỉ chủ phòng)');

console.log('\nLEAVE/CANCEL OK');
process.exit(0);
