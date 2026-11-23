import { moGoiTin } from './lib-view.mjs';
/**
 * CHỌN SỐ THẺ TRƯỚC MỖI VÁN (23.11.2026) — E2E thật qua server (KHÔNG đặt CHON_THE=0).
 * Chạy: server node rồi `MM_SERVER=http://127.0.0.1:8092 node tools/smoke-chon-the.mjs`.
 *   1. Chủ phòng bấm Bắt đầu → phòng VẪN ở phòng chờ, `room.chon` có ba lựa chọn quanh số thẻ hiện tại, còn ≤ 3 giây.
 *   2. Số đông thắng: 2 phiếu cho ô cao nhất, 1 phiếu ô thấp nhất → mọi người đã chọn thì chốt SỚM, ván mở với ô cao nhất.
 *   3. Phiếu ngoài danh sách và phiếu của người xem bị bỏ.
 *   4. App cũ (không ai bỏ phiếu): hết ~3 giây vẫn vào ván, giữ nguyên số thẻ. (Đường "Chơi lại" dùng chung `moChonThe` —
 *      đã thử tay bằng gia-nguoi.mjs, chưa có trong smoke này.)
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.log('✗ ' + msg); process.exit(1); };
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, q) => new Promise((res) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?${q}`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(moGoiTin(JSON.parse(e.data)));
  ws.onopen = () => res(c);
});
const phong = (c) => c.msgs.filter((m) => m.t === 'room' || m.t === 'welcome').at(-1)?.room;
const cho = async (dk, ms, chu) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = dk(); if (v) return v; await sleep(40); } fail(`quá ${ms} ms: ${chu}`); };
const soThe = (c) => c.msgs.filter((m) => (m.t === 'state' || m.t === 'events') && m.view).at(-1)?.view.cards.filter((x) => !x.blank).length;

// ---------- 1 + 2 + 3: ba người chơi, một người xem
{
  const code = await mkRoom();
  const a = await mk(code, 'name=An'); await sleep(150);
  const b = await mk(code, 'name=Binh'); const c = await mk(code, 'name=Chi'); await sleep(150);
  const x = await mk(code, 'name=Xem&xem=1'); await sleep(250);
  b.send({ t: 'ready', ready: true }); c.send({ t: 'ready', ready: true }); await sleep(300);
  const idCua = (k) => k.msgs.find((m) => m.t === 'welcome').playerId;
  a.send({ t: 'start' });
  const ch = await cho(() => phong(a)?.chon, 1500, 'bấm Bắt đầu mà không mở lượt chọn');
  if (phong(a).status !== 'lobby') fail(`đang chọn mà phòng đã sang ${phong(a).status} (app cũ sẽ thấy sai màn)`);
  if (ch.ds.length !== 3 || ch.con > 3000 || ch.con < 2000) fail(`lượt chọn sai: ${JSON.stringify(ch)}`);
  console.log(`✓ bấm Bắt đầu → mở lượt chọn ${ch.ds.join(' · ')}, còn ${ch.con} ms, phòng vẫn ở phòng chờ`);
  if (!phong(x)?.chon) fail('người xem không nhận được lượt chọn (để hiện bảng chỉ xem)');
  a.send({ t: 'start' });                                   // bấm lần nữa: không mở lượt mới
  x.send({ t: 'chon', the: ch.ds[0] });                      // người xem: bỏ
  a.send({ t: 'chon', the: 9999 });                          // ngoài danh sách: bỏ
  a.send({ t: 'chon', the: ch.ds[2] }); b.send({ t: 'chon', the: ch.ds[2] });
  await sleep(250);
  const giua = phong(a)?.chon;
  if (!giua || giua.id !== ch.id) fail('bấm Bắt đầu lần hai đã mở lượt chọn mới');
  if (Object.keys(giua.phieu).length !== 2 || giua.phieu[idCua(a)] !== ch.ds[2]) fail(`phiếu ghi sai: ${JSON.stringify(giua.phieu)}`);
  console.log('✓ phiếu ngoài danh sách và phiếu của người xem bị bỏ; bấm Bắt đầu lần hai không mở lượt mới');
  const t0 = Date.now();
  c.send({ t: 'chon', the: ch.ds[0] });
  await cho(() => phong(a) && !phong(a).chon && phong(a).status !== 'lobby', 1200, 'mọi người đã chọn mà không chốt sớm');
  console.log(`✓ mọi người đã chọn → chốt sau ${Date.now() - t0} ms, không chờ hết giờ`);
  const n = await cho(() => soThe(a), 8000, 'chốt rồi mà ván không mở');
  if (n !== ch.ds[2]) fail(`số đông chọn ${ch.ds[2]} mà ván mở ${n} thẻ`);
  console.log(`✓ số đông (2/3) chọn ${ch.ds[2]} → ván mở ${n} thẻ`);
  for (const k of [a, b, c, x]) k.ws.close();
}

// ---------- 4: không ai bỏ phiếu (app cũ)
{
  const code = await mkRoom();
  const a = await mk(code, 'name=Cu1'); await sleep(150);
  const b = await mk(code, 'name=Cu2'); await sleep(250);
  b.send({ t: 'ready', ready: true }); await sleep(300);
  const truoc = phong(a).config.level;
  const t0 = Date.now();
  a.send({ t: 'start' });
  await cho(() => phong(a)?.chon, 1500, 'không mở lượt chọn');
  await cho(() => phong(a) && !phong(a).chon && phong(a).status !== 'lobby', 4500, 'hết 3 giây mà không tự chốt');
  const lau = Date.now() - t0;
  if (lau < 2500) fail(`không ai chọn mà chốt sau ${lau} ms (phải chờ đủ ~3 giây)`);
  if (phong(a).config.level !== truoc) fail('không ai chọn mà số thẻ vẫn đổi');
  console.log(`✓ không ai bỏ phiếu: tự chốt sau ${lau} ms, giữ nguyên số thẻ, vào ván như thường`);
  await cho(() => soThe(a), 8000, 'ván không mở');
  a.ws.close(); b.ws.close();
}
console.log('✓ chọn số thẻ ổn');
process.exit(0);
