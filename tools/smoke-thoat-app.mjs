import { moGoiTin } from './lib-view.mjs';
/*
 * THOÁT APP RỒI QUAY LẠI — phòng không được mất (chủ dự án báo 15.10.2026:
 * "tạo bàn, thoát ứng dụng ra thì đôi khi thấy bàn bị mất").
 *
 * Cần server chạy với hạn giữ chỗ phòng chờ HẠ XUỐNG cho nhanh:
 *   LOBBY_HOLD_MS=2000 PORT=18438 node apps/node-server/dist/server.mjs
 *   MM_SERVER=http://127.0.0.1:18438 node tools/smoke-thoat-app.mjs
 * (Cloudflare: `LOBBY_HOLD_MS=2000 npx wrangler dev --port 8797` không đọc được
 *  biến này — bản Worker giữ 30 giây thật; truyền `HOLD=30000`, chạy chậm hơn.)
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const HOLD = Number(process.env.HOLD ?? process.env.LOBBY_HOLD_MS ?? 2000);
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const liet = async () => (await (await fetch(`${SERVER}/api/rooms/public`)).json()).rooms;
const conPhong = async (code) => (await (await fetch(`${SERVER}/api/rooms/${code}`)).json()).exists;
const mk = (code, name, token = '') => new Promise((res, rej) => {
  const q = new URLSearchParams({ name, pv: '1', bv: '2' });
  if (token) q.set('token', token);
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?${q}`);
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
const chao = (c) => c.msgs.find((m) => m.t === 'welcome');
const tim = (rooms, code) => rooms.find((r) => r.code === code);
const gui = (c, m) => c.ws.send(JSON.stringify(m));
const dong = async (c) => { c.ws.close(); await sleep(300); };

// 1) Chủ phòng tạo phòng rồi THOÁT APP (socket đóng), vắng lâu hơn hạn giữ chỗ.
{
  const code = await mkRoom();
  const a = await mk(code, 'Kien');
  await sleep(400);
  const { playerId, token } = chao(a);
  await dong(a);
  await sleep(HOLD + 1500);
  const r = tim(await liet(), code);
  if (!r) chet('chủ phòng thoát app quá hạn giữ chỗ: phòng BIẾN khỏi danh sách');
  if (r.chuPhong !== 'Kien') chet(`danh sách mất tên chủ phòng: ${r.chuPhong}`);
  console.log('✓ thoát app quá hạn giữ chỗ: phòng vẫn trong danh sách, đúng tên chủ phòng');

  const a2 = await mk(code, 'Kien', token);
  await sleep(400);
  const w = chao(a2);
  if (w.playerId !== playerId) chet('quay lại thành NGƯỜI LẠ (id mới) trong phòng của chính mình');
  if (w.room.hostId !== playerId) chet('quay lại mà mất quyền chủ phòng');
  if (w.room.players.length !== 1) chet(`phòng có ${w.room.players.length} người — một người hoá hai`);
  console.log('✓ quay lại: đúng danh tính cũ, vẫn là chủ phòng, không nhân đôi');

  // 2) Chủ phòng vắng, bạn vào bằng link: chủ phòng giữ quyền trong hạn giữ chỗ
  //    TÍNH TỪ LÚC BẠN VÀO, không phải từ lúc chủ phòng rời đi.
  await dong(a2);
  await sleep(HOLD + 1500);
  const b = await mk(code, 'Mai');
  await sleep(Math.min(800, HOLD / 2));
  if (phong(b)?.hostId !== playerId) chet('khách vừa vào là chủ phòng (đang vắng) bị gỡ ngay');
  console.log('✓ khách vào phòng đang vắng: chủ phòng vẫn giữ quyền, chờ đủ hạn mới chuyển');
  await sleep(HOLD + 1500);
  const bi = chao(b).playerId;
  if (phong(b)?.hostId !== bi) chet('hết hạn giữ chỗ mà quyền chủ phòng không chuyển cho người đang chờ');
  console.log('✓ hết hạn (có người chờ): quyền chủ phòng chuyển cho người đang ở đó');
  await dong(b);
}

// 3) Chủ phòng CHỦ ĐỘNG rời (nút thoát → 'cancel') — phòng đóng hẳn.
{
  const code = await mkRoom();
  const a = await mk(code, 'Kien');
  await sleep(400);
  gui(a, { t: 'cancel' });
  await sleep(600);
  if (await conPhong(code)) chet('chủ phòng huỷ mà mã phòng vẫn sống');
  if (tim(await liet(), code)) chet('chủ phòng huỷ mà phòng còn nằm trong danh sách');
  console.log('✓ chủ phòng chủ động thoát: phòng đóng, rời danh sách');
}

// 4) Rời phòng TRONG LÚC ĐẾM NGƯỢC — không để lại người "ma" trong ván.
{
  const code = await mkRoom();
  const a = await mk(code, 'A'); await sleep(200);
  const b = await mk(code, 'B'); await sleep(200);
  const c = await mk(code, 'C'); await sleep(300);
  gui(b, { t: 'ready', ready: true }); gui(c, { t: 'ready', ready: true });
  await sleep(400);
  gui(a, { t: 'start' });
  await sleep(600);
  if (phong(a)?.status !== 'countdown') chet(`chưa vào đếm ngược: ${phong(a)?.status}`);
  gui(c, { t: 'leave' });
  await sleep(700);
  const st = [...a.msgs].reverse().find((m) => m.t === 'state')?.view;
  if (!st || st.players.length !== 2) chet(`ván sau khi C rời lúc đếm ngược còn ${st?.players.length} người`);
  console.log('✓ rời lúc đếm ngược (3 người): ván dựng lại với 2 người còn lại');
  gui(b, { t: 'leave' });
  await sleep(700);
  if (phong(a)?.status !== 'lobby') chet(`còn 1 người mà phòng ở ${phong(a)?.status}, không về phòng chờ`);
  console.log('✓ rời lúc đếm ngược (còn 1 người): về phòng chờ');
  await dong(a); await dong(b); await dong(c);
}

// 5) Phòng ĐẦY không nằm trong danh sách (bấm vào chỉ được làm khán giả).
{
  const code = await mkRoom();
  const ds = [await mk(code, 'P0')];
  await sleep(500);
  const toiDa = tim(await liet(), code)?.toiDa;
  if (!toiDa) chet('không đọc được sức chứa phòng');
  for (let i = 1; i < toiDa; i++) { ds.push(await mk(code, `P${i}`)); await sleep(80); }
  await sleep(600);
  if (tim(await liet(), code)) chet(`phòng đầy ${toiDa}/${toiDa} vẫn nằm trong danh sách`);
  // Người thứ toiDa+1 vào được nhưng chỉ làm khán giả
  const kg = await mk(code, 'Xem');
  await sleep(400);
  if (!chao(kg)?.spectator) chet('phòng đầy mà người tới sau vẫn thành người chơi');
  await dong(kg);
  await dong(ds.pop());
  await sleep(700);
  // Người vừa rời còn trong hạn giữ chỗ — chờ hạn qua rồi mới có chỗ thật
  await sleep(HOLD + 1500);
  if (!tim(await liet(), code)) chet('có chỗ trống rồi mà phòng không hiện lại');
  console.log('✓ phòng đầy rời danh sách; có chỗ trống thì hiện lại');
  for (const s of ds) await dong(s);
}

console.log('\nXONG — phòng sống qua lần thoát app.');
process.exit(0);
