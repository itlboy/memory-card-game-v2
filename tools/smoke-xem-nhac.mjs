import { moGoiTin } from './lib-view.mjs';
/*
 * NHẮC + NGƯỜI XEM + PHÒNG ĐANG CHƠI TRONG DANH SÁCH (19.11.2026, mockup duyệt
 * https://claude.ai/artifact/H3Szxmuu6WZbDVoFozH9aH). Chạy với cả hai server (MM_SERVER).
 *  1. Chủ phòng `nhac` → CHỈ người chưa sẵn sàng nhận `{t:'nhac', from}`; nhắc dồn trong 10 giây bị bỏ.
 *  2. Khách không nhắc được (chỉ chủ phòng).
 *  3. Vào ván: phòng vẫn ở /api/rooms/public?v=2 với `dangChoi` + tên người chơi; KHÔNG có ở bản không `v=2`.
 *  4. Người xem vào giữa ván: `room.xem` có tên + mặt; người xem đi thì `xem` rỗng.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const liet = async (v2) => (await (await fetch(`${SERVER}/api/rooms/public${v2 ? '?v=2' : ''}`)).json()).rooms;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${encodeURIComponent(name)}&pv=1&bv=2&dd=2`);
  const c = { ws, msgs: [], closed: null };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chet = (msg) => { console.log('✗', msg); process.exit(1); };
const phong = (c) => [...c.msgs].reverse().find((m) => m.t === 'room' || m.t === 'welcome')?.room;
const soNhac = (c) => c.msgs.filter((m) => m.t === 'nhac').length;

const code = await mkRoom();
const chu = await mk(code, 'Kien');
const linh = await mk(code, 'Linh');
const minh = await mk(code, 'Minh');
await sleep(400);
linh.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(300);

// 1) Nhắc
chu.ws.send(JSON.stringify({ t: 'nhac' }));
await sleep(400);
if (soNhac(minh) !== 1) chet(`người chưa sẵn sàng phải nhận 1 tin nhắc, nhận ${soNhac(minh)}`);
if (minh.msgs.find((m) => m.t === 'nhac')?.from !== 'Kien') chet('tin nhắc phải ghi tên chủ phòng');
if (soNhac(linh) !== 0) chet('người ĐÃ sẵn sàng không được bị nhắc');
if (soNhac(chu) !== 0) chet('chủ phòng không tự nhắc mình');
chu.ws.send(JSON.stringify({ t: 'nhac' }));
await sleep(400);
if (soNhac(minh) !== 1) chet('nhắc dồn trong 10 giây phải bị bỏ');
console.log('✓ nhắc: chỉ tới người chưa sẵn sàng, chặn nhắc dồn');

// 2) Khách không nhắc được
linh.ws.send(JSON.stringify({ t: 'nhac' }));
await sleep(300);
if (soNhac(minh) !== 1) chet('khách nhắc được — chỉ chủ phòng mới được');
console.log('✓ khách không nhắc được');

// 3) Vào ván → vẫn trong sổ, cờ dangChoi, chỉ cho client v=2
minh.ws.send(JSON.stringify({ t: 'ready', ready: true }));
await sleep(300);
chu.ws.send(JSON.stringify({ t: 'start' }));
await sleep(800);
const r2 = (await liet(true)).find((r) => r.code === code);
if (!r2) chet('phòng đang chơi phải còn trong danh sách ?v=2');
if (!r2.dangChoi) chet('phòng đang chơi phải có cờ dangChoi');
if (!(r2.ten ?? []).includes('Linh')) chet('phòng đang chơi phải ghi tên người chơi');
if ((await liet(false)).some((r) => r.code === code)) chet('client cũ (không ?v=2) không được thấy phòng đang chơi');
console.log('✓ phòng đang chơi: có trong ?v=2 (dangChoi + tên), ẩn với client cũ');

// 4) Người xem
const nam = await mk(code, 'Nam');
await sleep(500);
const welcome = nam.msgs.find((m) => m.t === 'welcome');
if (!welcome?.spectator) chet('vào giữa ván phải là người xem');
const xem = phong(chu)?.xem ?? [];
if (xem.length !== 1 || xem[0].ten !== 'Nam' || !xem[0].mat) chet(`room.xem phải có Nam kèm mặt, có ${JSON.stringify(xem)}`);
nam.ws.close(1000);
await sleep(600);
if ((phong(chu)?.xem ?? []).length !== 0) chet('người xem đi rồi mà room.xem chưa rỗng');
console.log('✓ người xem: có tên + mặt trong room.xem, đi thì gỡ');

for (const c of [chu, linh, minh]) { try { c.ws.send(JSON.stringify({ t: 'leave' })); c.ws.close(1000); } catch { /* đã đóng */ } }
console.log('✓ smoke-xem-nhac xong');
process.exit(0);
