/**
 * PHÒNG THỬ — giả vài người chơi vào một phòng online để soát log `[ws]` của server mà KHÔNG làm
 * phiền người thật: phòng tạo bằng `?thu=1` không lên danh sách công khai, không bắn thông báo
 * "có phòng mới" (apps/node-server/src/index.ts, `phongThu`).
 *
 *   node tools/phong-thu.mjs [server] [số người]
 *   node tools/phong-thu.mjs https://flipmatch-api.cozypi.com 3
 *
 * Kịch bản: N người vào (đập nhịp tim như app) → người 2 xin `resync` (giống lúc mạng nghẽn) →
 * người 3 rớt rồi vào lại bằng token → mọi người rời (`leave`) → phòng tự dẹp.
 * Đọc kết quả: kubectl -n thebai logs deploy/thebai-server | grep '\[ws\]'
 * Cần Node ≥ 22 (WebSocket có sẵn).
 */
const SERVER = (process.argv[2] ?? 'https://flipmatch-api.cozypi.com').replace(/\/$/, '');
const SO = Number(process.argv[3] ?? 3);
const WS = SERVER.replace(/^http/, 'ws');
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${SERVER}/api/rooms?thu=1`, { method: 'POST' });
if (!res.ok) { console.error(`✗ Tạo phòng hỏng: ${res.status}`); process.exit(1); }
const { code } = await res.json();
console.log(`Phòng thử ${code}`);

function vao(i, token) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ name: `Thử ${i}`, cid: `thu${i}${code}`, pv: '1', bv: '2', dd: '2', v: 'phong-thu', nen: 'thu' });
    if (token) q.set('token', token);
    const ws = new WebSocket(`${WS}/ws/${code}?${q}`);
    const nguoi = { i, ws, token, nhip: 0 };
    const hen = setTimeout(() => reject(new Error(`người ${i}: 10 giây không có welcome`)), 10_000);
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.t === 'welcome') { nguoi.token = m.token ?? nguoi.token; clearTimeout(hen); resolve(nguoi); }
    };
    ws.onclose = (e) => { clearTimeout(hen); if (!nguoi.token) reject(new Error(`người ${i}: đóng ${e.code} ${e.reason}`)); };
    ws.onopen = () => {
      nguoi.nhip = setInterval(() => { ws.send(JSON.stringify({ t: 'ping' })); ws.send(JSON.stringify({ t: 'alive' })); }, 3000);
    };
  });
}
const thoi = (n) => clearInterval(n.nhip);

const ds = [];
for (let i = 1; i <= SO; i++) { ds.push(await vao(i)); console.log(`  ✓ người ${i} vào`); await cho(500); }
await cho(4000);
if (ds[1]) { ds[1].ws.send(JSON.stringify({ t: 'resync' })); console.log('  ✓ người 2 xin resync'); }
await cho(1500);
if (ds[2]) {
  const n = ds[2];
  thoi(n); n.ws.close(1000, 'thu rot');
  await cho(1500);
  ds[2] = await vao(3, n.token);
  console.log('  ✓ người 3 rớt rồi vào lại');
}
await cho(2000);
for (const n of ds) { thoi(n); n.ws.send(JSON.stringify({ t: 'leave' })); }
await cho(800);
for (const n of ds) n.ws.close(1000);
await cho(500);
console.log(`Xong. Xem log: kubectl -n thebai logs deploy/thebai-server | grep '${code}'`);
process.exit(0);
