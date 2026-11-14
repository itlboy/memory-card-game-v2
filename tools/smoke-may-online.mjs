import { moGoiTin } from './lib-view.mjs';
/*
 * MÁY CHƠI CÙNG ONLINE (1.6.0) — máy chạy TRÊN SERVER, đánh thức bằng alarm của phòng.
 *
 * Canh: chỉ chủ phòng thêm/đổi/bỏ máy; trần 4 tính cả máy; máy luôn sẵn sàng (1 người + máy
 * mở ván được); máy TỰ ĐI và ván chạy tới hết; người duy nhất rời → máy đi theo, phòng không
 * bị máy giữ sống.
 *   pnpm dev  rồi  node tools/smoke-may-online.mjs   (MM_SERVER=… để soi server khác)
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chet = (msg) => { console.log('✗', msg); process.exit(1); };
const phong = (c) => [...c.msgs].reverse().find((m) => m.t === 'room')?.room;
const view = (c) => [...c.msgs].reverse().find((m) => (m.t === 'state' || m.t === 'events') && m.view)?.view;
const gui = (c, m) => c.ws.send(JSON.stringify(m));

const code = await mkRoom();
const a = await mk(code, 'An');
const b = await mk(code, 'Binh');
await sleep(500);
const maA = a.msgs.find((m) => m.t === 'welcome').playerId;

// Khách KHÔNG thêm được máy
gui(b, { t: 'bot', op: 'add', level: 'easy' });
await sleep(400);
if (phong(a).players.some((p) => p.may)) chet('khách thêm được máy');
console.log('✓ khách không thêm được máy');

// Chủ phòng thêm 2 máy → đủ 4; máy thứ ba bị chặn bởi trần
gui(a, { t: 'bot', op: 'add', level: 'easy' });
gui(a, { t: 'bot', op: 'add', level: 'hard' });
gui(a, { t: 'bot', op: 'add', level: 'divine' });
await sleep(600);
let r = phong(a);
const may = r.players.filter((p) => p.may);
if (r.players.length !== 4 || may.length !== 2) chet(`trần 4 (kể cả máy) sai: ${r.players.length} người, ${may.length} máy`);
if (!may.every((p) => p.ready && p.connected && /^bot\d?$/.test(p.id))) chet('máy phải sẵn sàng, có mặt, mã bot/bot2');
console.log(`✓ thêm máy: ${may.map((p) => `${p.id}=${p.may}`).join(', ')} — máy thứ 3 bị chặn (trần 4)`);

// Đổi mức + bỏ máy; Bình rời → còn An + máy
gui(a, { t: 'bot', op: 'set', id: may[0].id, level: 'normal' });
gui(a, { t: 'bot', op: 'remove', id: may[1].id });
gui(b, { t: 'leave' });
await sleep(700);
r = phong(a);
if (r.players.length !== 2 || r.players.find((p) => p.may)?.may !== 'normal') chet(`đổi mức/bỏ máy sai: ${JSON.stringify(r.players.map((p) => [p.id, p.may]))}`);
console.log('✓ đổi mức, bỏ máy; phòng còn An + 1 máy (Gà cứng)');

// Thêm lại 1 máy, mở ván: 1 người + 2 máy, không ai phải bấm sẵn sàng
gui(a, { t: 'bot', op: 'add', level: 'insane' });
await sleep(400);
gui(a, { t: 'start' });
await sleep(400);
const loi = a.msgs.find((m) => m.t === 'error');
if (loi) chet(`mở ván bị từ chối: ${loi.message}`);
console.log('✓ 1 người + 2 máy mở ván được');

// Chơi: tới lượt An thì lật hai lá úp bất kỳ; máy tự đi. Đếm nước của máy.
const batDau = Date.now();
let nuocMay = 0; let daThay = 0; let luotTruoc = '';
while (Date.now() - batDau < 180_000) {
  await sleep(250);
  if (phong(a)?.status === 'ended') break;
  const v = view(a);
  if (!v || v.status !== 'playing') continue;
  // Sự kiện `flip` không mang mã người lật: lượt của VIEW NGAY TRƯỚC là của ai thì nước đó của người ấy
  for (const m of a.msgs.slice(daThay)) {
    if (m.t === 'events' && luotTruoc && /^bot\d?$/.test(luotTruoc)) nuocMay += m.events.filter((e) => e.type === 'flip').length;
    if (m.view) luotTruoc = m.view.currentId;
  }
  daThay = a.msgs.length;
  if (v.currentId !== maA) continue;
  const up = v.cards.filter((c) => c.state === 'down').map((c) => c.index);
  const dangMo = v.cards.filter((c) => c.state === 'up').length;
  if (dangMo >= 2 || !up.length) continue;
  gui(a, { t: 'flip', index: up[Math.floor(Math.random() * up.length)] });
  await sleep(350);
}
r = phong(a);
if (r?.status !== 'ended') chet(`ván không kết thúc trong 3 phút (máy treo?) — nước của máy: ${nuocMay}`);
const kq = view(a)?.summary?.ranking;
if (!nuocMay) chet('máy không lật lá nào');
console.log(`✓ ván chạy tới hết: máy lật ${nuocMay} lá; xếp hạng ${kq?.map((p) => `${p.name}:${p.score}`).join(' · ')}`);

// Chơi lại: chỉ cần phiếu của người thật
gui(a, { t: 'again' });
await sleep(700);
if (!['countdown', 'playing'].includes(phong(a)?.status)) chet(`'again' với máy không mở được ván: ${phong(a)?.status}`);
console.log("✓ 'again': một người thật bấm là đủ (máy không phải bỏ phiếu)");

// Người thật duy nhất rời → máy đi theo, phòng không bị máy giữ
gui(a, { t: 'leave' });
await sleep(800);
const conPhong = (await (await fetch(`${SERVER}/api/rooms/${code}`)).json()).exists;
const c = await mk(code, 'Cuong').catch(() => null);
if (c) {
  await sleep(600);
  const rc = phong(c);
  if (rc?.players.some((p) => p.may)) chet('người cuối rời mà máy vẫn ngồi trong phòng');
}
console.log(`✓ người thật cuối cùng rời: máy đi theo (phòng ${conPhong ? 'còn mã, trống máy' : 'đã dọn'})`);

console.log('\nMÁY ONLINE SMOKE OK');
process.exit(0);
