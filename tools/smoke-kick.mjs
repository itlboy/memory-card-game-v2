// MỜI NGƯỜI CHƠI RA KHỎI PHÒNG (chủ phòng).
//
//   MM_SERVER=http://127.0.0.1:8787 node tools/smoke-kick.mjs
//
// Cái bẫy lớn nhất: client TỰ NỐI LẠI mỗi 500ms. Đóng socket suông là người bị
// mời ra quay vào ngay lập tức — nên phải đóng bằng mã RIÊNG (4003) để client
// biết đừng thử lại. Bài cuối ở đây canh đúng chuyện đó.
import { moGoiTin } from './lib-view.mjs';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${encodeURIComponent(name)}`);
  const c = { ws, msgs: [], closed: null, send: (m) => ws.send(JSON.stringify(m)) };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onclose = (e) => { c.closed = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
});
const hong = (m) => { console.log(`✗ ${m}`); process.exit(1); };

const code = await mkRoom();
const chu = await mk(code, 'Chủ'); await sleep(300);
const khach = await mk(code, 'Khách'); await sleep(600);
const wChu = chu.msgs.find((m) => m.t === 'welcome');
const wKhach = khach.msgs.find((m) => m.t === 'welcome');
if (!wChu || !wKhach) hong('không vào được phòng');

// 1) KHÁCH không mời ai ra được
khach.send({ t: 'kick', playerId: wChu.playerId });
await sleep(600);
if (chu.closed !== null) hong('khách mời được CHỦ PHÒNG ra!');
console.log('✓ khách không mời ai ra được (chỉ chủ phòng)');

// 2) Chủ phòng không tự mời chính mình ra — muốn đi thì có nút rời phòng, đi
//    đường đó mới chuyển quyền chủ phòng cho người khác
chu.send({ t: 'kick', playerId: wChu.playerId });
await sleep(600);
if (chu.closed !== null) hong('chủ phòng tự mời được chính mình ra');
console.log('✓ chủ phòng không tự mời chính mình ra');

// 3) Mời ra thật: báo lý do TRƯỚC khi đóng, và đóng bằng mã 4003
chu.send({ t: 'kick', playerId: wKhach.playerId });
await sleep(900);
const bao = khach.msgs.find((m) => m.t === 'closed');
if (!bao) hong('người bị mời ra không nhận được lý do — họ chỉ thấy mất kết nối');
if (khach.closed !== 4003) hong(`đóng bằng mã ${khach.closed}, phải là 4003 để client biết ĐỪNG nối lại`);
console.log(`✓ mời ra: báo lý do ("${bao.message}") rồi đóng bằng mã 4003`);

// 4) Phòng còn đúng một người
const conLai = chu.msgs.filter((m) => m.t === 'room').at(-1);
if (conLai?.room.players.length !== 1) {
  hong(`phòng còn ${conLai?.room.players.length} người, phải còn 1`);
}
console.log('✓ phòng còn đúng chủ phòng');

console.log('\nKICK SMOKE OK');
process.exit(0);
