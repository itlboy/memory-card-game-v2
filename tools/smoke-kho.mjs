// KHO BỀN: phòng có sống qua một lần khởi động lại server không, và phòng chết
// có thật sự bị xoá khỏi database không.
//
//   MM_SERVER=http://127.0.0.1:8095 node tools/smoke-kho.mjs --restart "<lệnh khởi động lại>"
//
// Không có MYSQL_URL ở server thì bài này vô nghĩa (phòng chỉ ở RAM), nên nó tự
// nhận ra qua /health và bỏ qua êm.
//
// Hai chốt ở đây đều là lỗi ĐÃ XẢY RA THẬT trong lúc làm:
//  1. Khôi phục xong mà quên đặt lại alarm thì phòng nằm chết — ván không tick,
//     người rớt không bao giờ bị xử, phòng rác không ai dọn.
//  2. `depPhong()` gọi deleteAll rồi deleteAlarm ngay sau; deleteAlarm cũng lưu
//     nên nó GHI ĐÈ lệnh xoá bằng một bản ghi rỗng — phòng đã huỷ sống lại
//     trong database dưới dạng rác, và bảng cứ thế phình lên mãi.
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const roomExists = async (c) => (await (await fetch(`${SERVER}/api/rooms/${c}`)).json()).exists;
const mk = (code, name, token) => new Promise((res, rej) => {
  const q = token ? `&token=${encodeURIComponent(token)}` : '';
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${encodeURIComponent(name)}${q}`);
  const c = { ws, msgs: [] };
  const hetgio = setTimeout(() => rej(new Error(`không mở được socket vào phòng ${code}`)), 5000);
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onopen = () => { clearTimeout(hetgio); res(c); };
  ws.onerror = () => { clearTimeout(hetgio); rej(new Error('socket lỗi')); };
});
const xong = (m) => { console.log(m); process.exit(0); };
const hong = (m) => { console.log(`✗ ${m}`); process.exit(1); };

// 1) Dựng một phòng có hai người
const code = await mkRoom();
const a = await mk(code, 'Kiên');
await sleep(300);
await mk(code, 'Mai');
await sleep(700);
const w = a.msgs.find((m) => m.t === 'welcome');
if (!w) hong('không vào được phòng vừa tạo');
console.log(`✓ phòng ${code}: ${a.msgs.filter((m) => m.t === 'room').at(-1)?.room.players.length ?? 1} người`);

// 2) Phòng đã HUỶ phải biến mất hẳn, không để lại bản ghi rỗng
const codeHuy = await mkRoom();
const h = await mk(codeHuy, 'Huỷ');
await sleep(400);
h.ws.send(JSON.stringify({ t: 'cancel' }));
await sleep(1200);
if (await roomExists(codeHuy)) hong('phòng đã huỷ mà mã vẫn còn sống — bản ghi rỗng ghi đè lệnh xoá?');
console.log('✓ phòng huỷ: xoá hẳn, không để lại bản ghi rỗng');

// 3) Khởi động lại server rồi vào lại bằng token
const iRestart = process.argv.indexOf('--restart');
if (iRestart === -1) xong('\n(bỏ qua phần khởi động lại: không truyền --restart)\nKHO SMOKE OK');
const { execSync } = await import('node:child_process');
console.log('… khởi động lại server');
execSync(process.argv[iRestart + 1], { stdio: 'ignore', shell: '/bin/bash' });
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`${SERVER}/health`)).ok) break; } catch { /* chưa lên */ }
  await sleep(500);
}
if (!await roomExists(code)) hong('phòng biến mất sau khi server khởi động lại');
const lai = await mk(code, 'Kiên', w.token);
await sleep(900);
const w2 = lai.msgs.find((m) => m.t === 'welcome');
if (!w2) hong('không vào lại được phòng sau khi khởi động lại');
if (w2.playerId !== w.playerId) hong(`vào lại bị cấp id MỚI (${w.playerId} → ${w2.playerId}) — token không còn khớp`);
if (w2.room.hostId !== w.playerId) hong('mất quyền chủ phòng sau khi khởi động lại');
const ten = w2.room.players.map((p) => p.name).sort().join(',');
if (ten !== 'Kiên,Mai') hong(`người trong phòng sai sau khi khôi phục: ${ten}`);
console.log(`✓ sau khởi động lại: phòng còn, vào lại giữ nguyên id/tên/chỗ chủ phòng (${ten})`);
xong('\nKHO SMOKE OK');
