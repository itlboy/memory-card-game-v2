const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http','ws')}/ws/${code}?name=${name}`);
  const c = { name, ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onclose = (e) => console.log('   [socket', name, 'đóng', e.code, e.reason + ']');
  ws.onerror = () => console.log('   [socket', name, 'lỗi]');
  ws.onopen = () => res(c);
});
const last = (c, t) => [...c.msgs].reverse().find((m) => m.t === t);

// Kịch bản: 3 người; HOST dẫn điểm rồi đầu hàng
const code = await mkRoom();
const host = await mk(code, 'Host'), b = await mk(code, 'B'), c = await mk(code, 'C');
await sleep(600);
b.send({ t: 'ready', ready: true });
c.send({ t: 'ready', ready: true });
await sleep(400);
// Chưa đủ sẵn sàng thì start phải bị chặn? (đủ rồi — thử thiếu trước)
host.send({ t: 'ready', ready: false });   // host mặc nhiên sẵn sàng, lệnh này vô hại
host.send({ t: 'start' });
await sleep(5800);   // qua đếm ngược 5 giây

// flip NaN / chuỗi / số thực — server không được crash
const cur = () => last(b, 'events')?.view ?? last(b, 'state').view;
for (const bad of ['abc', 1.5, -3, 999, null]) {
  host.send({ t: 'flip', index: bad });
  b.send({ t: 'flip', index: bad });
}
await sleep(500);
const alive = await fetch(`${SERVER}/health`);
if (!alive.ok) { console.log('✗ server chết vì flip bẩn'); process.exit(1); }
if ([host, b, c].some((x) => x.msgs.some((m) => m.t === 'events'))) {
  console.log('✗ flip bẩn sinh ra sự kiện'); process.exit(1);
}
console.log('✓ flip NaN/chuỗi/số thực bị nuốt êm, DO sống khoẻ');

// Ai đang tới lượt thì người đó lật — trượt thì lượt chuyển, bám theo currentId
const idOf = (x) => last(x, 'welcome').playerId;
const byId = (id) => [host, b, c].find((x) => idOf(x) === id);
let view = cur(), scorer = null, tries = 0;
const missed = new Set();
// Deck không còn xếp hai thẻ cùng cặp cạnh nhau, mà vòng dò dưới đây luôn thử
// từ cặp ô gần nhau nhất — đúng những cặp bị loại. Với lưới 4×4 có thể phải
// thử tới 15 lượt mới ra một cặp, nên giới hạn 10 là quá chặt.
while (!scorer && tries++ < 30) {
  for (const cl of [host, b, c]) cl.msgs = cl.msgs.filter((m) => m.t !== 'events');
  const actor = byId(view.currentId);
  const down = view.cards.filter((k) => k.state === 'down').map((k) => k.index);
  let i = down[0], j = down[1];
  outer: for (const x of down) for (const y of down) {
    if (x < y && !missed.has(String(x) + ',' + String(y))) { i = x; j = y; break outer; }
  }
  actor.send({ t: 'flip', index: i });
  await sleep(500);
  actor.send({ t: 'flip', index: j });
  await sleep(700);
  const ev = last(actor, 'events');
  if (!ev) { console.log('✗ flip hợp lệ không sinh sự kiện'); process.exit(1); }
  view = ev.view;
  if (ev.events.some((e) => e.type === 'match')) {
    scorer = actor;
  } else {
    missed.add(String(i) + ',' + String(j));
    await sleep(1400);                                   // chờ úp lại + chuyển lượt
    view = (last(actor, 'events') ?? ev).view;
  }
}
if (!scorer) { console.log('✗ không tạo được thế dẫn điểm'); process.exit(1); }
const scorerScore = view.players.find((p) => p.id === idOf(scorer)).score;
if (scorerScore <= 0) { console.log('✗ scorer không có điểm'); process.exit(1); }
console.log('✓ ' + scorer.name + ' ghép được cặp, đang có ' + String(scorerScore) + ' điểm — giờ đầu hàng');
const leader = scorer;

leader.send({ t: 'leave' });
await sleep(900);
const roomAfter = last(b === leader ? host : b, 'room').room;
// (1) người bỏ cuộc không thắng
const endMsg = [host, b, c].filter((x) => x !== leader)
  .map((x) => x.msgs.find((m) => m.t === 'events' && m.events.some((e) => e.type === 'end')))
  .find(Boolean);
if (endMsg) {
  const rank = endMsg.events.find((e) => e.type === 'end').summary.ranking;
  if (rank[0].id === idOf(leader)) { console.log('✗ người bỏ cuộc vẫn thắng!'); process.exit(1); }
}
console.log('✓ 3 người: người dẫn điểm đầu hàng — ván tiếp tục với 2 người còn lại');
// (2) người rời bị gỡ khỏi phòng, host chuyển quyền nếu cần
if (roomAfter.players.some((p) => p.id === idOf(leader))) { console.log('✗ người rời vẫn trong phòng'); process.exit(1); }
if (!roomAfter.players.some((p) => p.id === roomAfter.hostId)) { console.log('✗ hostId mồ côi'); process.exit(1); }
console.log('✓ người rời bị gỡ khỏi phòng, hostId luôn trỏ vào người còn lại:', roomAfter.hostId === idOf(host) ? 'host cũ' : 'host MỚI được chuyển quyền');
console.log('\nAUDIT SMOKE OK');
process.exit(0);
