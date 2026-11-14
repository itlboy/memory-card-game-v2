import { moGoiTin } from './lib-view.mjs';
/*
 * CHẾ ĐỘ ĐỒNG ĐỘI 2 đấu 2 (docs/che-do-dong-doi.md) — chạy thật qua server.
 * Canh: client cũ bị từ chối; chia đội xen kẽ + đổi đội; chỉ đúng người được lật đúng lá;
 * "chỉ thẻ"/emoji đội CHỈ tới đồng đội (đội kia không nhận gói tin); một người rời → đồng đội lật
 * cả hai lá; ván chạy tới hết; phòng THƯỜNG không nhận gì mới (`nguoiLat` vắng trong view).
 *   pnpm dev  rồi  node tools/smoke-dong-doi.mjs   (MM_SERVER=… để soi server khác)
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name, dd = true) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}&pv=1&bv=2${dd ? '&dd=1' : ''}`);
  const c = { ws, msgs: [], closed: null, name };
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
const ma = (c) => c.msgs.find((m) => m.t === 'welcome')?.playerId;

// Phòng THƯỜNG: view không có trường mới
{
  const code = await mkRoom();
  const x = await mk(code, 'X'); const y = await mk(code, 'Y');
  await sleep(400); gui(y, { t: 'ready', ready: true }); await sleep(300);
  gui(x, { t: 'start' }); await sleep(800);
  if (!view(x) || 'nguoiLat' in view(x)) chet('phòng thường mà view có nguoiLat (đổi định dạng gói tin cũ)');
  if (phong(x).players.some((p) => 'doi' in p)) chet('phòng thường mà RoomInfo có trường doi');
  gui(x, { t: 'leave' }); gui(y, { t: 'leave' });
  console.log('✓ phòng thường: không có trường mới nào trong view / RoomInfo');
}

const code = await mkRoom();
const ds = [];
for (const n of ['An', 'Binh', 'Chi', 'Dung']) { ds.push(await mk(code, n)); await sleep(150); }
const [an, binh, chi, dung] = ds;
await sleep(500);

// Khách không bật được; chủ phòng bật → chia xen kẽ A B A B
gui(binh, { t: 'doi', on: true }); await sleep(300);
if (phong(an).config.doi) chet('khách bật được chế độ Đồng đội');
gui(an, { t: 'doi', on: true }); await sleep(500);
let r = phong(an);
if (!r.config.doi) chet('chủ phòng bật Đồng đội không ăn');
const doiCua = (c) => phong(an).players.find((p) => p.id === ma(c))?.doi;
if ([an, binh, chi, dung].map(doiCua).join('') !== 'ABAB') chet(`chia đội không xen kẽ: ${[an, binh, chi, dung].map(doiCua).join('')}`);
console.log('✓ khách không bật được; chủ phòng bật → chia xen kẽ A B A B');

// Đổi đội: Bình sang A, Chi sang B → A = An+Bình, B = Chi+Dũng
gui(an, { t: 'doi', playerId: ma(binh), doi: 'A' });
gui(an, { t: 'doi', playerId: ma(chi), doi: 'B' });
await sleep(500);
if ([an, binh, chi, dung].map(doiCua).join('') !== 'AABB') chet('đổi đội không ăn');
console.log('✓ chủ phòng đổi đội: An+Bình | Chi+Dũng');

// Client CŨ (không ?dd=1) vào phòng Đồng đội → nhận lời nhắc + đóng, không thành người chơi
const cu = await mk(code, 'Cu', false);
await sleep(600);
if (!cu.msgs.some((m) => m.t === 'closed' && /cập nhật/.test(m.message))) chet('client cũ không nhận lời nhắc cập nhật');
if (phong(an).players.length !== 4) chet('client cũ lọt vào danh sách người chơi');
cu.ws.close();   // client thật tự rời phòng khi nhận `closed`
console.log('✓ client cũ bị từ chối kèm lời nhắc cập nhật, không thành người chơi');

// Máy không được thêm vào phòng Đồng đội
gui(an, { t: 'bot', op: 'add' }); await sleep(300);
if (phong(an).players.some((p) => p.may)) chet('thêm được máy vào phòng Đồng đội');

// Bắt đầu
for (const c of [binh, chi, dung]) gui(c, { t: 'ready', ready: true });
await sleep(400);
gui(an, { t: 'start' });
await sleep(400);
const loi = an.msgs.find((m) => m.t === 'error');
if (loi) chet(`mở ván bị từ chối: ${loi.message}`);
let batDau = Date.now();
while (view(an)?.status !== 'playing' && Date.now() - batDau < 15000) await sleep(200);
let v = view(an);
if (!v?.nguoiLat || v.players.length !== 2 || !v.players.every((p) => p.thanhVien?.length === 2)) chet('view ván Đồng đội thiếu đội / nguoiLat');
console.log(`✓ ván 2 đấu 2 bắt đầu: ${v.players.map((p) => p.name).join(' vs ')}, lượt ${v.currentId}, ${v.nguoiLat} lật`);

const theoMa = Object.fromEntries([an, binh, chi, dung].map((c) => [ma(c), c]));
// Người SAI lật → bỏ qua
const sai = [an, binh, chi, dung].find((c) => ma(c) !== v.nguoiLat);
const truoc = v.cards.filter((c) => c.state === 'up').length;
gui(sai, { t: 'flip', index: v.cards.find((c) => c.state === 'down').index, seq: 1 });
await sleep(500);
if (view(an).cards.filter((c) => c.state === 'up').length !== truoc) chet(`${sai.name} lật trộm được dù không tới lá của mình`);
console.log(`✓ người không tới lá (${sai.name}) lật thì server bỏ qua`);

// Chỉ thẻ: chỉ đồng đội nhận
const nguoiChi = theoMa[v.nguoiLat];
const dongDoi = [an, binh, chi, dung].find((c) => c !== nguoiChi && doiCua(c) === doiCua(nguoiChi));
const doiKia = [an, binh, chi, dung].filter((c) => doiCua(c) !== doiCua(nguoiChi));
gui(nguoiChi, { t: 'chi', index: 3 });
await sleep(500);
if (!dongDoi.msgs.some((m) => m.t === 'chi' && m.index === 3)) chet('đồng đội không nhận được "chỉ thẻ"');
if (doiKia.some((c) => c.msgs.some((m) => m.t === 'chi'))) chet('đội KIA nhận được gói tin chỉ thẻ');
console.log('✓ chỉ thẻ: đồng đội nhận, đội kia KHÔNG nhận gói tin nào');

// Chơi: luôn để đúng người lật. Giữa chừng Dũng rời → Chi lật cả hai lá của đội B.
const seq = new Map();
let daRoi = false; let chiLatCaHai = false; let soNuoc = 0;
batDau = Date.now();
while (Date.now() - batDau < 180_000) {
  await sleep(200);
  if (phong(an)?.status === 'ended') break;
  v = view(an);
  if (!v || v.status !== 'playing' || !v.nguoiLat) continue;
  if (!daRoi && soNuoc >= 6) { gui(dung, { t: 'leave' }); daRoi = true; await sleep(500); continue; }
  const ai = theoMa[v.nguoiLat];
  if (!ai || ai.closed) continue;
  const up = v.cards.filter((c) => c.state === 'up');
  if (up.length >= 2) continue;
  const down = v.cards.filter((c) => c.state === 'down' && !c.blank);
  if (!down.length) continue;
  if (daRoi && ai === chi && up.length === 1 && doiCua(chi) === 'B') chiLatCaHai = true;
  const s = (seq.get(ai) ?? 1) + 1; seq.set(ai, s);
  gui(ai, { t: 'flip', index: down[Math.floor(Math.random() * down.length)].index, seq: s });
  soNuoc++;
  await sleep(250);
}
if (phong(an)?.status !== 'ended') chet('ván Đồng đội không kết thúc trong 3 phút');
if (!chiLatCaHai) chet('Dũng rời mà Chi không được lật lá thứ hai của đội B');
const kq = view(an)?.summary?.ranking;
console.log(`✓ Dũng rời giữa ván → Chi lật cả hai lá, đội B chơi tiếp; kết quả ${kq?.map((p) => `${p.name}:${p.score}`).join(' · ')}`);

// ---- 2 NGƯỜI ĐẤU MÁY: máy là một đội đứng riêng, tự lật cả hai lá ----
{
  const code2 = await mkRoom();
  const x = await mk(code2, 'Xuan'); await sleep(150);
  const y = await mk(code2, 'Yen'); await sleep(400);
  gui(x, { t: 'doi', on: true }); await sleep(300);
  gui(x, { t: 'bot', op: 'add', level: 'normal' }); await sleep(400);
  gui(x, { t: 'bot', op: 'add', level: 'easy' }); await sleep(300);
  let r2 = phong(x);
  const mayP = r2.players.filter((p) => p.may);
  if (mayP.length !== 1) chet(`phòng Đồng đội phải chỉ nhận MỘT máy (có ${mayP.length})`);
  // Mặc định xen kẽ: Xuân A, Yến B → xếp hai người vào đội của nhau, máy đội kia
  const doiMay = mayP[0].doi;
  const doiNguoi = doiMay === 'A' ? 'B' : 'A';
  for (const c of [x, y]) gui(x, { t: 'doi', playerId: ma(c), doi: doiNguoi });
  await sleep(500);
  r2 = phong(x);
  if (r2.players.filter((p) => p.doi === doiNguoi && !p.may).length !== 2) chet('không xếp được hai người vào cùng đội');
  gui(y, { t: 'ready', ready: true }); await sleep(300);
  gui(x, { t: 'start' }); await sleep(400);
  const l2 = x.msgs.find((m) => m.t === 'error');
  if (l2) chet(`2 người + máy mở ván bị từ chối: ${l2.message}`);
  const theo2 = { [ma(x)]: x, [ma(y)]: y };
  const s2 = new Map(); let mayLat = 0; let luotTruoc = '';
  const bd = Date.now(); let daThay = 0;
  while (Date.now() - bd < 180_000) {
    await sleep(200);
    if (phong(x)?.status === 'ended') break;
    for (const m of x.msgs.slice(daThay)) {
      if (m.t === 'events' && luotTruoc === mayP[0].id) mayLat += m.events.filter((e) => e.type === 'flip').length;
      if (m.view) luotTruoc = m.view.nguoiLat ?? '';
    }
    daThay = x.msgs.length;
    const v2 = view(x);
    if (!v2 || v2.status !== 'playing') continue;
    const ai = theo2[v2.nguoiLat];
    if (!ai) continue;                       // lượt máy
    if (v2.cards.filter((c) => c.state === 'up').length >= 2) continue;
    const down = v2.cards.filter((c) => c.state === 'down' && !c.blank);
    if (!down.length) continue;
    const sq = (s2.get(ai) ?? 1) + 1; s2.set(ai, sq);
    gui(ai, { t: 'flip', index: down[Math.floor(Math.random() * down.length)].index, seq: sq });
    await sleep(250);
  }
  if (phong(x)?.status !== 'ended') chet('ván 2 người đấu máy không kết thúc');
  if (mayLat < 2) chet(`máy không tự lật đủ (lật ${mayLat} lá)`);
  console.log(`✓ 2 người đấu máy: máy (đội riêng) lật ${mayLat} lá; kết quả ${view(x)?.summary?.ranking.map((p) => `${p.name}:${p.score}`).join(' · ')}`);
}

console.log('\nĐỒNG ĐỘI SMOKE OK');
process.exit(0);
