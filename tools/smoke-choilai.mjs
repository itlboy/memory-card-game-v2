import { moGoiTin } from './lib-view.mjs';
/*
 * CHƠI LẠI + XOAY VÒNG NGƯỜI ĐI ĐẦU (chủ dự án báo 11.10.2026).
 *
 *  1. Cả hai cùng bấm "Chơi lại" thì PHẢI vào ván mới luôn (đếm ngược). Bản cũ
 *     chỉ đưa phòng về phòng chờ và bắt bấm Sẵn sàng lần nữa, nên hai người bấm
 *     mà "không có hiện tượng gì".
 *  2. Người đi đầu XOAY VÒNG giữa các ván, không bốc ngẫu nhiên lại mỗi ván.
 *
 * Chơi THẬT tới hết ván: bàn 2×2, lật theo bản đồ `predeal` server gửi xuống.
 *   MM_SERVER=http://127.0.0.1:8080 node tools/smoke-choilai.mjs
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chet = (msg) => { console.log('✗', msg); process.exit(1); };
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}&pv=1`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  const hg = setTimeout(() => rej(new Error('không mở được socket')), 5000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onopen = () => { clearTimeout(hg); res(c); };
  ws.onerror = () => rej(new Error('socket lỗi'));
});
const cuoi = (c, t) => [...c.msgs].reverse().find((m) => m.t === t);
const phong = (c) => cuoi(c, 'room')?.room;
const view = (c) => { const m = [...c.msgs].reverse().find((x) => x.view); return m?.view; };
const choToi = async (dk, ms, msg) => { const t0 = Date.now(); while (!dk()) { if (Date.now() - t0 > ms) chet(msg); await sleep(100); } };

const code = await mkRoom();
const a = await mk(code, 'An'), b = await mk(code, 'Binh');
await sleep(500);
const id = { [a.msgs.find((m) => m.t === 'welcome').playerId]: a, [b.msgs.find((m) => m.t === 'welcome').playerId]: b };
// Bàn nhỏ nhất (cấp 1 = 2×2) để chơi hết nhanh
a.send({ t: 'config', config: { level: 1 } });
await sleep(300);
b.send({ t: 'ready', ready: true });
await sleep(300);

let seq = Date.now();
async function choiHetVan(lan) {
  await choToi(() => phong(a)?.status === 'playing', 9000, `ván ${lan}: không vào trạng thái playing`);
  for (let buoc = 0; buoc < 20 && phong(a)?.status !== 'ended'; buoc++) {
    const v = view(a);
    const ai = id[v.currentId];
    const ban = cuoi(ai, 'predeal')?.symbols ?? cuoi(a, 'predeal')?.symbols;
    if (!ban) chet('không có predeal để biết bàn');
    const con = v.cards.map((c, i) => (c.state === 'matched' ? -1 : i)).filter((i) => i >= 0);
    const i = con[0], j = con.find((k) => k !== i && ban[k] === ban[i]);
    ai.send({ t: 'flip', index: i, seq: ++seq }); await sleep(250);
    ai.send({ t: 'flip', index: j, seq: ++seq }); await sleep(700);
  }
  await choToi(() => phong(a)?.status === 'ended', 5000, `ván ${lan}: không kết thúc`);
}

const dauVan = [];
a.send({ t: 'start' });
await choToi(() => cuoi(a, 'countdown'), 3000, 'không có đếm ngược ván 1');
dauVan.push(cuoi(a, 'countdown').firstId);
await choiHetVan(1);
console.log(`✓ ván 1 chơi hết (đi đầu: ${id[dauVan[0]] === a ? 'An' : 'Binh'})`);

for (let van = 2; van <= 3; van++) {
  const soDem = a.msgs.filter((m) => m.t === 'countdown').length;
  a.send({ t: 'again' });
  await sleep(400);
  if (phong(a)?.status !== 'ended') chet(`một người bấm Chơi lại mà ván ${van} đã mở`);
  b.send({ t: 'again' });
  await choToi(() => a.msgs.filter((m) => m.t === 'countdown').length > soDem, 3000,
    `ván ${van}: cả hai bấm Chơi lại mà KHÔNG vào đếm ngược (trạng thái: ${phong(a)?.status})`);
  const s = phong(a)?.status;
  if (s !== 'countdown' && s !== 'playing') chet(`ván ${van}: phải đếm ngược, đang là ${s}`);
  dauVan.push(cuoi(a, 'countdown').firstId);
  if (dauVan[van - 1] === dauVan[van - 2]) chet(`ván ${van}: người đi đầu KHÔNG xoay vòng (vẫn là ${id[dauVan[van - 1]] === a ? 'An' : 'Binh'})`);
  console.log(`✓ ván ${van}: cả hai bấm Chơi lại → vào đếm ngược ngay; đi đầu xoay sang ${id[dauVan[van - 1]] === a ? 'An' : 'Binh'}`);
  await choiHetVan(van);
}
console.log('\nCHƠI LẠI + XOAY VÒNG SMOKE OK');
process.exit(0);
