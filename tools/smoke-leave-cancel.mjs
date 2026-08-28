const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
// Hạn chờ 5 giây: server từ chối (404) thì `onopen` KHÔNG BAO GIỜ chạy, và
// node lặng lẽ thoát với mã 0 ở `await` treo — test nhìn ra thành XANH trong khi
// nó chưa chạy tới đâu. Đã thật sự xảy ra: hai bước cuối của file này chưa từng
// được kiểm.
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http','ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], closed: null };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error(`socket lỗi khi vào phòng ${code}`)); };
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
});
const roomExists = async (c) => (await (await fetch(`${SERVER}/api/rooms/${c}`)).json()).exists;
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

// Phòng đã huỷ thì MÃ CHẾT HẲN — không phải "vào lại thành phòng trống mới".
// Chủ phòng bấm huỷ là chủ ý dẹp phòng, mà mã còn sống thì người vào sau tưởng
// mình đang chờ trong phòng của bạn.
if (await roomExists(code)) { console.log('✗ phòng đã huỷ mà mã vẫn còn sống'); process.exit(1); }
console.log('✓ huỷ phòng: storage dọn sạch, mã chết hẳn');

// 3) Khách gửi cancel → bị bỏ qua
code = await mkRoom();
a = await mk(code, 'An'); b = await mk(code, 'Binh');
await sleep(500);
b.ws.send(JSON.stringify({ t: 'cancel' }));
await sleep(600);
if (a.closed || a.msgs.some((m) => m.t === 'closed')) { console.log('✗ khách huỷ được phòng!'); process.exit(1); }
console.log('✓ khách không huỷ được phòng (chỉ chủ phòng)');

// 4) LUỒNG CHIA LINK: tạo phòng → thoát ra gửi link → bạn vào được.
// Trước đây người cuối rời lobby là phòng bị xoá NGAY, nên cái link vừa gửi đã
// chết trước khi bạn kịp bấm. Đa phần chơi trên điện thoại, mà ở đó "gửi link"
// đúng là rời app đi.
code = await mkRoom();
a = await mk(code, 'Chu');
await sleep(500);
a.ws.close();                       // thoát ra để đi gửi link
await sleep(1500);
if (!await roomExists(code)) { console.log('✗ phòng chết ngay khi chủ phòng thoát'); process.exit(1); }
const ban = await mk(code, 'Ban');   // bạn bấm link
await sleep(600);
const wBan = ban.msgs.find((m) => m.t === 'welcome');
if (!wBan || wBan.spectator) { console.log('✗ bạn vào bằng link mà thành khán giả'); process.exit(1); }
console.log('✓ chia link: chủ phòng thoát ra, phòng vẫn sống, bạn vào được');

/*
 * QUYỀN CHỦ PHÒNG KHÔNG ĐỔI CHỦ NGAY. Rớt kết nối ở lobby còn được giữ chỗ
 * LOBBY_HOLD_MS (30 giây thật; smoke chạy server với LOBBY_HOLD_MS=2000) —
 * không có nó thì khoá màn hình một nhịp là mất quyền trong phòng của chính
 * mình. Hết hạn mà không quay lại thì mới chuyển quyền cho người còn ngồi đó.
 */
if (wBan.room.hostId === wBan.playerId) {
  console.log('✗ chủ phòng vừa rớt đã bị tước quyền ngay, không có hạn giữ chỗ'); process.exit(1);
}
console.log('✓ trong hạn giữ chỗ: quyền chủ phòng vẫn thuộc người vừa rớt');

// Chờ quá hạn giữ chỗ: người rớt bị gỡ, quyền chuyển cho người còn lại
await sleep(3500);
const doi = ban.msgs.filter((m) => m.t === 'room').at(-1);
if (!doi || doi.room.hostId !== wBan.playerId) {
  console.log('✗ hết hạn giữ chỗ mà quyền chủ phòng không chuyển cho người còn lại');
  process.exit(1);
}
if (doi.room.players.length !== 1) {
  console.log(`✗ hết hạn giữ chỗ mà người rớt vẫn nằm trong phòng (${doi.room.players.length} người)`);
  process.exit(1);
}
console.log('✓ hết hạn giữ chỗ: người rớt bị gỡ, quyền chủ phòng chuyển sang người còn lại');

console.log('\nLEAVE/CANCEL OK');
process.exit(0);
