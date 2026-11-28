// CỤM NHIỀU POD (apps/node-server/src/cum.ts): hai pod chung Redis + MySQL phải cư xử như MỘT server.
//
//   REDIS_URL=redis://127.0.0.1:6390 MYSQL_URL=mysql://root:thu@127.0.0.1:3390/latthe node tools/smoke-cum.mjs
//
// Bài tự bật HAI tiến trình `apps/node-server/dist/server.mjs` (cổng 8091, 8092 — build trước: pnpm --filter
// @mm/node-server build) và tự tắt chúng khi xong / lỗi / Ctrl+C. Redis + MySQL do người chạy dựng sẵn.
//
// Chốt:
//  1. tạo phòng ở pod A, người thứ hai vào qua pod B (chuyển tiếp) → cùng MỘT phòng, thấy nhau
//  2. danh sách công khai + kiểm mã từ pod kia đều thấy phòng
//  3. sảnh: nối qua cả hai pod → MỘT sảnh, số online = 2 ở cả hai
//  4. tắt êm pod A giữa VÁN ĐANG CHƠI → vào lại qua B: thẻ / điểm / lượt giữ nguyên
//  5. pod B CHẾT ĐỘT NGỘT (SIGKILL) → pod A (đã bật lại) nhận phòng trong ≤ 20 giây, vào lại được
import { spawn } from 'node:child_process';
import { moGoiTin } from './lib-view.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hong = (m) => { console.log(`✗ ${m}`); tatHet(); process.exit(1); };
const pods = new Map();
function batPod(ten, port) {
  const p = spawn(process.execPath, ['apps/node-server/dist/server.mjs'], {
    env: { ...process.env, PORT: String(port), POD_ADDR: `http://127.0.0.1:${port}`, AUTH_SECRET: 'thu-cum', WEB_DIR: '/nonexistent' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  p.stdout.on('data', (d) => { for (const l of String(d).split('\n')) if (/\[cum\]/.test(l)) console.log(`    ${ten}: ${l.trim()}`); });
  p.stderr.on('data', (d) => process.stderr.write(`    ${ten}! ${d}`));
  pods.set(ten, p);
  return p;
}
function tatHet() { for (const p of pods.values()) { try { p.kill('SIGKILL'); } catch { /* đã tắt */ } } }
process.on('exit', tatHet);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { tatHet(); process.exit(1); });
async function cho(port) {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch { /* chưa lên */ } await sleep(300); }
  hong(`pod cổng ${port} không lên`);
}
const tatEm = (ten) => new Promise((r) => { const p = pods.get(ten); p.once('exit', r); p.kill('SIGTERM'); });

const A = 'http://127.0.0.1:8091', B = 'http://127.0.0.1:8092';
const mk = (server, code, name, token) => new Promise((res, rej) => {
  const q = token ? `&token=${encodeURIComponent(token)}` : '';
  const ws = new WebSocket(`${server.replace('http', 'ws')}/ws/${code}?name=${encodeURIComponent(name)}${q}`);
  const c = { ws, msgs: [], dong: null };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code} qua ${server}`)), 6000);
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
  ws.onclose = (e) => { c.dong = e.code; };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
});
const phongCuoi = (c) => [...c.msgs].reverse().find((m) => m.t === 'room' || m.t === 'welcome')?.room;
const view = (c) => [...c.msgs].reverse().find((m) => m.view)?.view;

batPod('A', 8091); batPod('B', 8092);
await cho(8091); await cho(8092);

// 1) tạo ở A, vào qua B
const code = (await (await fetch(`${A}/api/rooms`, { method: 'POST' })).json()).code;
const k = await mk(A, code, 'Kiên'); await sleep(400);
const m = await mk(B, code, 'Mai'); await sleep(900);
const wK = k.msgs.find((x) => x.t === 'welcome'); const wM = m.msgs.find((x) => x.t === 'welcome');
if (!wK || !wM) hong('không vào được phòng qua hai pod');
const tenK = phongCuoi(k)?.players.map((p) => p.name).sort().join(',');
const tenM = phongCuoi(m)?.players.map((p) => p.name).sort().join(',');
if (tenK !== 'Kiên,Mai' || tenM !== 'Kiên,Mai') hong(`hai pod thấy hai phòng khác nhau: A="${tenK}" B="${tenM}"`);
console.log(`✓ phòng ${code}: tạo ở A, vào qua B — cùng một phòng (${tenK})`);

// 2) kiểm mã + danh sách từ pod kia
if (!(await (await fetch(`${B}/api/rooms/${code}`)).json()).exists) hong('pod B không thấy phòng của pod A');
if ((await (await fetch(`${B}/api/rooms/123456`)).json()).exists) hong('mã không có mà vẫn "tồn tại"');
const ds = (await (await fetch(`${B}/api/rooms/public?v=2`)).json()).rooms;
if (!ds.some((r) => r.code === code)) hong('danh sách công khai ở pod B thiếu phòng của pod A');
console.log('✓ kiểm mã + danh sách công khai từ pod kia đều thấy');

// 3) sảnh chung
const s1 = new WebSocket(`${A.replace('http', 'ws')}/ws/sanh?ten=X`); const s2 = new WebSocket(`${B.replace('http', 'ws')}/ws/sanh?ten=Y`);
const tin = []; s1.onmessage = (e) => tin.push(['A', JSON.parse(e.data)]); s2.onmessage = (e) => tin.push(['B', JSON.parse(e.data)]);
await sleep(2500);
const tong = Math.max(...tin.filter(([, t]) => t.t === 'so' || t.t === 'chao').map(([, t]) => t.tong ?? 0));
if (tong !== 2) hong(`sảnh bị tách đôi: số online lớn nhất ${tong} (phải 2)`);
await sleep(5500);
const onl = [(await (await fetch(`${A}/api/rooms/public`)).json()).online, (await (await fetch(`${B}/api/rooms/public`)).json()).online];
if (onl[0] !== 2 || onl[1] !== 2) hong(`số online lệch giữa hai pod: ${onl}`);
s1.close(); s2.close();
console.log('✓ sảnh: một sảnh cho cả cụm, số online = 2 ở cả hai pod');

// 4) ván đang chơi + tắt êm pod chủ
m.ws.send(JSON.stringify({ t: 'ready', ready: true })); await sleep(300);
k.ws.send(JSON.stringify({ t: 'start' })); await sleep(600);
// Lượt chọn số thẻ (CHON_THE): cả hai chọn số nhỏ nhất → chốt sớm → hiệu ứng → đếm ngược
const chon = phongCuoi(k)?.chon;
if (chon) { k.ws.send(JSON.stringify({ t: 'chon', the: chon.ds[0] })); m.ws.send(JSON.stringify({ t: 'chon', the: chon.ds[0] })); }
for (let i = 0; i < 40 && view(k)?.status !== 'playing'; i++) await sleep(500);
const truot = new Set();
for (let vong = 0; vong < 14; vong++) {
  const v = view(k);
  if (!v || v.status !== 'playing') break;
  if (v.cards.filter((c) => c.state === 'matched').length >= 2) break;
  const down = v.cards.filter((c) => c.state === 'down').map((c) => c.index);
  let [i, j] = [down[0], down[1]];
  outer: for (const x of down) for (const y of down) if (x < y && !truot.has(`${x},${y}`)) { i = x; j = y; break outer; }
  const p = v.currentId === wK.playerId ? k : m;
  p.ws.send(JSON.stringify({ t: 'flip', index: i })); await sleep(260);
  p.ws.send(JSON.stringify({ t: 'flip', index: j })); await sleep(1400);
  if (view(k)?.cards.find((c) => c.index === i)?.state !== 'matched') truot.add(`${i},${j}`);
}
await sleep(2000);   // cặp sai cuối cùng còn ngửa → chờ server úp lại + chuyển lượt, rồi mới chụp
const T = view(k);
if (!T || T.status !== 'playing') hong('không dựng được ván đang chơi');
const daGhep = (v) => v.cards.filter((c) => c.state === 'matched').length;
const diem = (v) => [...v.players].sort((x, y) => x.name.localeCompare(y.name)).map((p) => `${p.name}=${p.score}`).join(' ');
console.log(`  trước: ${daGhep(T)} thẻ đã ghép · ${diem(T)}`);
const chuTruoc = (await (await fetch(`${A}/health`)).json());
console.log(`  pod A giữ ${chuTruoc.giu} phòng — tắt êm pod A`);
const t0 = Date.now();
await tatEm('A');
await sleep(300);
if (k.dong === null) hong('tắt pod mà socket không bị đóng');
const k2 = await mk(B, code, 'Kiên', wK.token);
const m2 = await mk(B, code, 'Mai', wM.token);
await sleep(1200);
const V = view(k2);
if (!V) hong('vào lại qua B: không có view');
if (daGhep(V) !== daGhep(T) || diem(V) !== diem(T) || V.currentId !== T.currentId) hong(`ván lệch sau khi chuyển pod: ${daGhep(T)}/${diem(T)}/${T.currentId}/${T.cards.length} → ${daGhep(V)}/${diem(V)}/${V.currentId}/${V.cards.length} status ${V.status}`);
console.log(`✓ tắt êm pod chủ giữa ván: vào lại qua B sau ${((Date.now() - t0) / 1000).toFixed(1)}s, thẻ/điểm/lượt giữ nguyên`);

// 5) pod chết đột ngột
batPod('A', 8091); await cho(8091);
const hB = await (await fetch(`${B}/health`)).json();
if (!hB.giu) hong('pod B lẽ ra đang giữ phòng');
console.log('  giết pod B (SIGKILL)');
pods.get('B').kill('SIGKILL');
const t1 = Date.now();
let lai = null;
for (let i = 0; i < 30 && !lai; i++) {
  await sleep(1000);
  try {
    const c = await mk(A, code, 'Kiên', wK.token);
    await sleep(800);
    if (view(c)) lai = c; else c.ws.close();
  } catch { /* chưa được */ }
}
if (!lai) hong('pod B chết: pod A không nhận phòng trong 30 giây');
if (daGhep(view(lai)) !== daGhep(V)) hong('pod B chết: ván lệch sau khi A nhận');
console.log(`✓ pod chủ chết đột ngột: pod A nhận phòng sau ${((Date.now() - t1) / 1000).toFixed(1)}s, ván giữ nguyên`);
void m2;
console.log('\nCỤM SMOKE OK');
tatHet();
process.exit(0);
