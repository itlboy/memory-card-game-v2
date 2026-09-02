import { moGoiTin } from './lib-view.mjs';
/*
 * SỔ PHÒNG CÔNG KHAI (ON-10) — danh sách phòng đang chờ ở màn "Chơi online".
 *
 * Chạy được với CẢ HAI server, và đó chính là điều đáng canh nhất: bản Cloudflare
 * phải dựng một Durable Object riêng (ở đó KHÔNG liệt kê được các DO đang sống),
 * bản Node chỉ là một Map — hai cài đặt khác hẳn nhau sau cùng một interface.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const liet = async () => (await (await fetch(`${SERVER}/api/rooms/public`)).json()).rooms;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], closed: null };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chet = (msg) => { console.log('✗', msg); process.exit(1); };
const phong = (c) => [...c.msgs].reverse().find((m) => m.t === 'room')?.room;
const tim = (rooms, code) => rooms.find((r) => r.code === code);

// 1) Mã vừa tạo mà CHƯA ai vào thì không lên danh sách: chưa có chủ phòng, mà
//    một dòng "Phòng của ..." không có ai trong đó là dòng chết.
const code = await mkRoom();
if (tim(await liet(), code)) chet('phòng chưa có người đã lên danh sách');
console.log('✓ mã vừa tạo, chưa ai vào: chưa lên danh sách');

// 2) Chủ phòng vào → phòng hiện ra, mang TÊN CHỦ PHÒNG.
const a = await mk(code, 'Kien');
await sleep(600);
let r = tim(await liet(), code);
if (!r) chet('chủ phòng đã vào mà phòng không lên danh sách');
if (r.chuPhong !== 'Kien') chet(`tên chủ phòng sai: ${r.chuPhong}`);
if (r.nguoi !== 1) chet(`số người sai: ${r.nguoi}`);
if (!r.the || r.the % 2) chet(`số thẻ vô lý: ${r.the}`);
if (!r.avatar) chet('thiếu avatar chủ phòng');
console.log(`✓ chủ phòng vào: hiện "Phòng của ${r.chuPhong}" · ${r.the} thẻ · ${r.nguoi}/${r.toiDa}`);

// 3) Thêm người → số người trên danh sách đi theo.
const b = await mk(code, 'Mai');
await sleep(600);
r = tim(await liet(), code);
if (r?.nguoi !== 2) chet(`số người không cập nhật: ${r?.nguoi}`);
console.log('✓ có người vào: số người trên danh sách đi theo');

// 4) Chủ phòng tắt công khai → biến khỏi danh sách, nhưng phòng VẪN SỐNG và
//    vẫn vào được bằng mã. Đây là toàn bộ ý nghĩa của "phòng riêng tư".
a.ws.send(JSON.stringify({ t: 'public', on: false }));
await sleep(600);
if (tim(await liet(), code)) chet('tắt công khai rồi mà vẫn nằm trong danh sách');
if (phong(a)?.congKhai !== false) chet('client không được báo trạng thái mới');
const c = await mk(code, 'Cuong');
await sleep(500);
if ((phong(c)?.players.length ?? 0) !== 3) chet('phòng riêng tư không vào được bằng mã');
console.log('✓ tắt công khai: biến khỏi danh sách, vẫn vào được bằng mã 6 số');

// 5) Bật lại → hiện lại.
a.ws.send(JSON.stringify({ t: 'public', on: true }));
await sleep(600);
if (!tim(await liet(), code)) chet('bật lại mà không hiện lại');
console.log('✓ bật lại: hiện lại trong danh sách');

// 6) KHÁCH không đổi được công khai (ON-09: client không đáng tin).
b.ws.send(JSON.stringify({ t: 'public', on: false }));
await sleep(500);
if (!tim(await liet(), code)) chet('khách tắt được công khai của phòng người khác!');
console.log('✓ chỉ chủ phòng đổi được công khai');

// 7) Vào ván → rời danh sách: bấm vào một phòng đang chơi chỉ được ngồi xem,
//    nên nó không có chỗ trong danh sách "phòng đang chờ".
b.ws.send(JSON.stringify({ t: 'ready', ready: true }));
c.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(400);
a.ws.send(JSON.stringify({ t: 'start' }));
await sleep(5800);
if (phong(a)?.status !== 'playing') chet(`ván chưa chạy: ${phong(a)?.status}`);
if (tim(await liet(), code)) chet('phòng đang chơi vẫn nằm trong danh sách chờ');
console.log('✓ vào ván: rời khỏi danh sách phòng đang chờ');

// 8) Về phòng chờ → quay lại danh sách.
//    Phải cho HAI người rời: ván chỉ kết thúc khi còn đúng một người chơi, ba
//    người mà một người bỏ thì hai người kia đánh tiếp (đúng luật forfeit).
a.ws.send(JSON.stringify({ t: 'leave' }));
await sleep(700);
c.ws.send(JSON.stringify({ t: 'leave' }));
await sleep(900);
if (phong(b)?.status !== 'ended') chet(`ván chưa kết thúc: ${phong(b)?.status}`);
b.ws.send(JSON.stringify({ t: 'tolobby' }));
await sleep(700);
const r2 = tim(await liet(), code);
if (!r2) chet('về phòng chờ mà không quay lại danh sách');
if (r2.chuPhong === 'Kien') chet('chủ phòng cũ đã rời, tên trên danh sách chưa đổi');
console.log(`✓ về phòng chờ: quay lại danh sách, chủ phòng nay là ${r2.chuPhong}`);

// 9) Huỷ phòng → gỡ khỏi danh sách NGAY, không chờ hết hạn bản ghi. Còn nằm lại
//    là ai bấm vào cũng nhận "Phòng không tồn tại".
b.ws.send(JSON.stringify({ t: 'cancel' }));
await sleep(800);
if (tim(await liet(), code)) chet('phòng đã huỷ vẫn nằm trong danh sách');
console.log('✓ huỷ phòng: gỡ khỏi danh sách ngay');

console.log('\nSỔ PHÒNG SMOKE OK');
process.exit(0);
