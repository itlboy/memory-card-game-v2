import { moGoiTin } from './lib-view.mjs';
/*
 * ĐỘI THEO SỐ (15.11.2026, thay "chế độ Đồng đội" 1.7) — chạy thật qua server.
 * Canh: ai vào cũng có số đội riêng (= ván thường, view KHÔNG có `nguoiLat`); cùng số là cùng đội;
 * chỉ tự đổi đội mình (chủ phòng đổi được người khác); cả phòng một đội → không mở ván; có người
 * chung đội mà ai đó dùng app cũ → không mở ván; trong ván MỘT người lật cả hai lá, lượt sau của
 * đội tới người kế (A+B đấu C: A → C → B → C); cuối ván có số cặp từng người; máy vào đội nào cũng chạy.
 *   pnpm dev  rồi  node tools/smoke-dong-doi.mjs   (MM_SERVER=… để soi server khác)
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name, dd = 2) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}&pv=1&bv=2${dd ? `&dd=${dd}` : ''}`);
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
/*
 * Người giả NHỚ BÀI (lật ngẫu nhiên thì bàn 16 thẻ có lúc quá 3 phút — đỏ giả trên server thật,
 * 14.11.2026). Lá 1: nếu đã biết một cặp thì mở nó, không thì mở lá chưa biết. Lá 2: lá trùng nếu biết.
 */
const nho = new Map();
function chonLa(v) {
  for (const c of v.cards) { if (c.symbol && c.state !== 'matched') nho.set(c.index, c.symbol); if (c.state === 'matched') nho.delete(c.index); }
  const up = v.cards.filter((c) => c.state === 'up');
  const down = v.cards.filter((c) => c.state === 'down' && !c.blank).map((c) => c.index);
  if (up.length >= 2 || !down.length) return null;
  let pick;
  if (up.length === 1) pick = down.find((i) => nho.get(i) === up[0].symbol);
  else { const thay = {}; for (const i of down) { const sy = nho.get(i); if (sy === undefined) continue; if (thay[sy] !== undefined) { pick = i; break; } thay[sy] = i; } }
  return pick ?? down.find((i) => !nho.has(i)) ?? down[0];
}
const ma = (c) => c.msgs.find((m) => m.t === 'welcome')?.playerId;


const doiCua = (nhin, c) => phong(nhin).players.find((p) => p.id === ma(c))?.doiSo;

/** Lái ván tới hết: `ds` là các client người; trả về chuỗi người đã đi từng lượt. */
async function choiHet(ds, han = 240_000) {
  nho.clear();
  const luot = [];
  let seq = 0;
  const het = Date.now() + han;
  while (Date.now() < het) {
    const v = view(ds[0]);
    if (v?.summary) return luot;
    const key = v ? `${v.currentId}/${v.nguoiLat}` : '';
    if (v && v.status === 'playing' && luot.at(-1) !== key && v.cards.filter((c) => c.state === 'up').length === 0) luot.push(key);
    const ai = v && ds.find((c) => ma(c) === (v.nguoiLat ?? v.currentId));
    if (ai && v.status === 'playing') {
      const la = chonLa(v);
      if (la != null) gui(ai, { t: 'flip', index: la, seq: ++seq });
    }
    await sleep(350);
  }
  chet('ván không kết thúc trong hạn');
}

// 1) Phòng THƯỜNG: mỗi người một số đội, ván y như cũ
{
  const code = await mkRoom();
  const x = await mk(code, 'X'); const y = await mk(code, 'Y');
  await sleep(400);
  if ([doiCua(x, x), doiCua(x, y)].join('') !== '12') chet(`mặc định phải mỗi người một đội 1,2: ${doiCua(x, x)},${doiCua(x, y)}`);
  gui(y, { t: 'ready', ready: true }); await sleep(300);
  gui(x, { t: 'start' }); await sleep(800);
  const v = view(x);
  if (!v || 'nguoiLat' in v) chet('không ai chung đội mà view có nguoiLat (phải là ván thường)');
  if (v.players.map((p) => p.id).sort().join() !== [ma(x), ma(y)].sort().join()) chet('ván thường mà người chơi không phải từng người');
  gui(x, { t: 'leave' }); gui(y, { t: 'leave' });
  console.log('✓ mặc định mỗi người một đội → ván thường y như cũ (không có nguoiLat)');
}

// 2) An + Bình cùng đội 1, đấu Chi
{
  const code = await mkRoom();
  const an = await mk(code, 'An'); await sleep(150);
  const binh = await mk(code, 'Binh'); await sleep(150);
  const chi = await mk(code, 'Chi'); await sleep(500);
  gui(binh, { t: 'doi', playerId: ma(chi), doi: 1 }); await sleep(300);
  if (doiCua(an, chi) !== 3) chet('khách đổi được đội của người khác');
  gui(binh, { t: 'doi', playerId: ma(binh), doi: 1 }); await sleep(300);
  if (doiCua(an, binh) !== 1) chet('không tự đổi được đội mình');
  console.log('✓ tự đổi đội mình được, không đổi được đội người khác');

  // Cả phòng một đội → không mở ván
  gui(an, { t: 'doi', playerId: ma(chi), doi: 1 }); await sleep(300);
  if (doiCua(an, chi) !== 1) chet('chủ phòng không đổi được đội người khác');
  gui(binh, { t: 'ready', ready: true }); gui(chi, { t: 'ready', ready: true }); await sleep(300);
  gui(an, { t: 'start' }); await sleep(500);
  if (!an.msgs.some((m) => m.t === 'error' && m.code === 'doi-thieu') || phong(an).status !== 'lobby') chet('cả phòng một đội mà vẫn mở ván');
  console.log('✓ cả phòng cùng một đội → không mở ván (doi-thieu)');
  gui(an, { t: 'doi', playerId: ma(chi), doi: 3 }); await sleep(300);

  // App cũ (dd=1) trong phòng có người chung đội → không mở ván, nêu tên
  const cu = await mk(code, 'Cu', 1); await sleep(400);
  gui(cu, { t: 'ready', ready: true }); await sleep(300);
  gui(an, { t: 'start' }); await sleep(500);
  if (!an.msgs.some((m) => m.t === 'error' && m.code === 'doi-client-cu' && /Cu/.test(m.message))) chet('app cũ trong phòng có đội ghép mà không bị chặn');
  if (!an.msgs.some((m) => m.code === 'doi-client-cu' && Array.isArray(m.ten) && m.ten.includes('Cu'))) chet('lỗi doi-client-cu thiếu danh sách tên (client dịch câu)');
  // 16.11.2026: chính máy cũ cũng phải được báo (trước chỉ chủ phòng thấy)
  if (!cu.msgs.some((m) => m.t === 'error' && m.code === 'can-cap-nhat')) chet('máy dùng app cũ không được báo cần cập nhật');
  gui(cu, { t: 'leave' }); await sleep(400);
  console.log('✓ có người chung đội + app cũ trong phòng → không mở ván, nhắc cả chủ phòng lẫn máy cũ');

  gui(an, { t: 'start' }); await sleep(6200);
  let v = view(an);
  if (v?.players.map((p) => p.id).join() !== 'doi-1,doi-3' && v?.players.map((p) => p.id).join() !== 'doi-3,doi-1') chet(`ván phải có 2 đội doi-1/doi-3: ${v?.players.map((p) => p.id)}`);
  // Sai người lật: đồng đội KHÔNG phải người đi lượt này thì không lật được
  if (v.currentId === 'doi-1') {
    const sai = [an, binh].find((c) => ma(c) !== v.nguoiLat);
    gui(sai, { t: 'flip', index: v.cards.find((c) => c.state === 'down').index, seq: 900 });
    await sleep(400);
    if (view(an).cards.some((c) => c.state === 'up')) chet('đồng đội không tới lượt mà lật được');
    console.log('✓ đồng đội không phải người đi lượt này → không lật được');
  }
  const luot = await choiHet([an, binh, chi]);
  // Lượt của đội 1 phải LUÂN PHIÊN An/Bình; đội 3 luôn là Chi
  const d1 = luot.filter((k) => k.startsWith('doi-1/')).map((k) => k.split('/')[1]);
  for (let i = 1; i < d1.length; i++) if (d1[i] === d1[i - 1]) chet(`đội 1 không luân phiên người đi: ${d1.join(' ')}`);
  if (luot.some((k) => k.startsWith('doi-3/') && k !== `doi-3/${ma(chi)}`)) chet('đội 3 có người đi không phải Chi');
  if (d1.length < 2) chet('đội 1 đi quá ít lượt để kiểm luân phiên');
  const kq = view(an).summary.ranking;
  const doi1 = kq.find((p) => p.id === 'doi-1');
  const tong = Object.values(doi1.capTV ?? {}).reduce((a, b) => a + b, 0);
  if (tong !== doi1.pairs) chet(`số cặp từng người (${JSON.stringify(doi1.capTV)}) không cộng ra số cặp đội (${doi1.pairs})`);
  console.log(`✓ A+B đấu C: đội 1 luân phiên ${d1.length} lượt, mỗi lượt một người lật cả hai lá; cuối ván ${doi1.name}: ${doi1.score} điểm, cặp từng người ${JSON.stringify(doi1.capTV)}`);
  for (const c of [an, binh, chi]) gui(c, { t: 'leave' });
}

// 3) Máy: An + Bình (đội 1) đấu máy; rồi An + máy (đội 1) đấu Bình
for (const kieu of ['2 người đấu máy', 'người + máy chung đội']) {
  const code = await mkRoom();
  const an = await mk(code, 'An'); await sleep(150);
  const binh = await mk(code, 'Binh'); await sleep(400);
  gui(an, { t: 'bot', op: 'add', level: 'hard' }); await sleep(400);
  const may = phong(an).players.find((p) => p.may);
  if (may?.doiSo !== 3) chet(`máy mới phải đứng đội riêng (3): ${may?.doiSo}`);
  if (kieu === '2 người đấu máy') gui(binh, { t: 'doi', playerId: ma(binh), doi: 1 });
  else gui(an, { t: 'doi', playerId: may.id, doi: 1 });
  gui(binh, { t: 'ready', ready: true }); await sleep(400);
  gui(an, { t: 'start' }); await sleep(6200);
  if (!view(an)?.players.every((p) => p.id.startsWith('doi-'))) chet(`${kieu}: ván không chạy luật đội`);
  await choiHet([an, binh]);
  console.log(`✓ ${kieu}: ván chạy tới hết — ${view(an).summary.ranking.map((p) => `${p.name}:${p.score}`).join(' · ')}`);
  gui(an, { t: 'leave' }); gui(binh, { t: 'leave' });
}

console.log('\nĐỘI THEO SỐ OK');
process.exit(0);
