import { moGoiTin } from './lib-view.mjs';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { code } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
const mk = (name) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http','ws')}/ws/${code}?name=${encodeURIComponent(name)}`);
  const c = { ws, name, msgs: [] };
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
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
// Neo vào hằng số chứ đừng chép tay: con số này đã đổi 15 → 25 vì 15 giây
// không chừa chỗ nào cho mạng yếu (xem TURN_LIMIT_SEC).
const TRAN = Number(process.env.MM_TURN_LIMIT ?? 25);
console.log('turnTimeLeft đầu ván:', st.view.turnTimeLeft, `(phải ≤${TRAN})`);
if (st.view.turnTimeLeft > TRAN) process.exit(1);

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

/*
 * TURN TIMEOUT: không ai đi gì hết lượt → server tự chuyển lượt qua alarm.
 *
 * PHẢI GỬI `alive` như client thật, nếu không server thấy im lặng quá LAG_MS
 * (7 giây) và DỪNG đồng hồ lượt lại — đúng như thiết kế, để mạng yếu không ăn
 * mất lượt của ai. Không gửi thì cái smoke này đo nhầm sang đường tạm dừng.
 */
const nhip = setInterval(() => {
  for (const c of [a, b]) { try { c.ws.send(JSON.stringify({ t: 'alive' })); } catch { /* đã đóng */ } }
}, 3000);
console.log(`chờ ${TRAN + 2}s xem server tự chuyển lượt…`);
await new Promise((r) => setTimeout(r, (TRAN + 2) * 1000));
clearInterval(nhip);
const to = a.msgs.find((m) => m.t === 'events' && m.events.some((e) => e.type === 'turn-timeout'));
if (!to) { console.log('✗ không có turn-timeout'); process.exit(1); }
console.log('✓ turn-timeout qua alarm, lượt mới:', to.view.currentId, '— clock:', to.view.turnTimeLeft + 's');
if (to.view.currentId === st.view.currentId) { console.log('✗ lượt không đổi'); process.exit(1); }
console.log('\nTIMER + SPECTATOR OK');
process.exit(0);
