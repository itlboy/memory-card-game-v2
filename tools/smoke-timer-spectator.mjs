const SERVER = 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { code } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
const mk = (name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http','ws')}/ws/${code}?name=${encodeURIComponent(name)}`);
  const c = { ws, name, msgs: [] };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onopen = () => res(c);
});
const a = await mk('An'), b = await mk('Binh');
await new Promise((r) => setTimeout(r, 600));
b.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(400);
a.ws.send(JSON.stringify({ t: 'start' }));
await sleep(5600);   // qua đếm ngược 5 giây
await new Promise((r) => setTimeout(r, 800));
const st = [...a.msgs].reverse().find((m) => m.view);
console.log('turnTimeLeft đầu ván:', st.view.turnTimeLeft, '(phải ≤15)');
if (st.view.turnTimeLeft > 15) process.exit(1);

// KHÁN GIẢ: vào khi ván đã bắt đầu
const spec = await mk('KhanGia');
await new Promise((r) => setTimeout(r, 600));
const w = spec.msgs.find((m) => m.t === 'welcome');
if (!w?.spectator) { console.log('✗ không nhận cờ spectator'); process.exit(1); }
const sv = spec.msgs.find((m) => m.t === 'state');
if (!sv) { console.log('✗ khán giả không nhận state'); process.exit(1); }
if (sv.view.cards.some((c) => c.state === 'down' && c.symbol)) { console.log('✗ lộ thẻ với khán giả'); process.exit(1); }
console.log('✓ khán giả vào xem được, không lộ thẻ úp, không có trong danh sách:',
  w.room.players.length, 'người chơi');
// Khán giả thử lật → phải bị bỏ qua
spec.ws.send(JSON.stringify({ t: 'flip', index: 0 }));
await new Promise((r) => setTimeout(r, 500));
if (a.msgs.some((m) => m.t === 'events' && m.events.some((e) => e.type === 'flip'))) {
  console.log('✗ khán giả lật được thẻ!'); process.exit(1);
}
console.log('✓ khán giả không thao tác được');

// TURN TIMEOUT: không ai đi gì 16 giây → server tự chuyển lượt qua alarm
console.log('chờ 16.5s xem server tự chuyển lượt…');
await new Promise((r) => setTimeout(r, 16_500));
const to = a.msgs.find((m) => m.t === 'events' && m.events.some((e) => e.type === 'turn-timeout'));
if (!to) { console.log('✗ không có turn-timeout'); process.exit(1); }
console.log('✓ turn-timeout qua alarm, lượt mới:', to.view.currentId, '— clock:', to.view.turnTimeLeft + 's');
if (to.view.currentId === st.view.currentId) { console.log('✗ lượt không đổi'); process.exit(1); }
console.log('\nTIMER + SPECTATOR OK');
process.exit(0);
