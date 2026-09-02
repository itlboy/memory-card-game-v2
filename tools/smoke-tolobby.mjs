import { moGoiTin } from './lib-view.mjs';
/*
 * VỀ PHÒNG CHỜ sau khi ván kết thúc — lối ra khi đối phương đã đi.
 *
 * Vì sao cần smoke riêng: 'again' đòi MỌI người còn kết nối cùng bấm, nên khi
 * đối phương thoát giữa ván thì nó không bao giờ đủ phiếu và người ở lại kẹt ở
 * màn kết quả, chỉ còn đường về menu — tức là mất phòng, phải tạo mã mới rồi
 * mời lại. 'tolobby' là lối ra đó: MỘT người bấm là đủ, phòng giữ nguyên mã.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], closed: null };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
});
const roomExists = async (c) => (await (await fetch(`${SERVER}/api/rooms/${c}`)).json()).exists;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chet = (msg) => { console.log('✗', msg); process.exit(1); };
/** Tin `room` mới nhất — trạng thái phòng client đang thấy. */
const phong = (c) => [...c.msgs].reverse().find((m) => m.t === 'room')?.room;

// Dựng một ván rồi cho Bình đầu hàng → ván 'ended' với đúng một người còn lại.
const code = await mkRoom();
const a = await mk(code, 'An');
const b = await mk(code, 'Binh');
await sleep(500);
b.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(400);
a.ws.send(JSON.stringify({ t: 'start' }));
await sleep(5800);            // qua đếm ngược
b.ws.send(JSON.stringify({ t: 'leave' }));
await sleep(800);
if (phong(a)?.status !== 'ended') chet(`ván chưa kết thúc: ${phong(a)?.status}`);
console.log('✓ đối phương rời giữa ván: ván kết thúc, An ở màn kết quả một mình');

// 'again' KHÔNG đủ phiếu (chỉ còn một người, dưới minPlayers) — đây là cái bẫy cũ.
a.ws.send(JSON.stringify({ t: 'again' }));
await sleep(700);
if (phong(a)?.status !== 'ended') chet("'again' một người mà đã mở ván mới");
console.log("✓ 'again' một mình vẫn kẹt ở 'ended' (đúng thiết kế: chơi lại cần đủ người)");

// 'tolobby': một người bấm là đủ.
a.ws.send(JSON.stringify({ t: 'tolobby' }));
await sleep(700);
const r = phong(a);
if (r?.status !== 'lobby') chet(`về phòng chờ thất bại: ${r?.status}`);
if (r.code !== code) chet(`mã phòng bị đổi: ${r.code} ≠ ${code}`);
if (r.hostId !== a.msgs.find((m) => m.t === 'welcome').playerId) chet('An không được làm chủ phòng');
if (r.players.some((p) => p.ready)) chet('cờ sẵn sàng chưa được xoá');
if (!(await roomExists(code))) chet('mã phòng chết sau khi về lobby');
console.log('✓ tolobby: phòng về lobby, GIỮ NGUYÊN mã, An làm chủ phòng, cờ sẵn sàng đã xoá');

// Người mới vào được bằng đúng mã cũ → đúng thứ người chơi cần: không phải mời lại.
const c = await mk(code, 'Cuong');
await sleep(600);
if ((phong(c)?.players.length ?? 0) !== 2) chet('người mới không vào được phòng cũ');
console.log('✓ người mới vào bằng mã cũ, phòng lại đủ 2 người');

// Đang ở lobby thì 'tolobby' phải bị bỏ qua, không được dẹp ván/đổi gì.
c.ws.send(JSON.stringify({ t: 'tolobby' }));
await sleep(500);
if (phong(c)?.status !== 'lobby') chet('tolobby ở lobby làm hỏng trạng thái');
console.log('✓ tolobby ngoài trạng thái ended: bị bỏ qua êm');

console.log('\nTOLOBBY SMOKE OK');
process.exit(0);
