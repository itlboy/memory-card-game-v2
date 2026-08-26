/**
 * TUỲ CHỌN BÀN CHƠI trong phòng online — E2E thật qua wrangler dev.
 *
 *   pnpm dev:server  rồi  node tools/smoke-options.mjs
 *   MM_SERVER=<url> node tools/smoke-options.mjs
 *
 * Hai chuyện phải đúng:
 *
 * 1. Tuỳ chọn chủ phòng đặt PHẢI tới được bàn thật (mạng, xem trước, xáo thẻ).
 * 2. Client KHÔNG ĐÁNG TIN (ON-09): gửi `lives: 999` hay `peek: 99` thì server
 *    phải kéo về khoảng hợp lệ, không phải dựng ra ván không ai chơi nổi. Đây
 *    là chỗ dễ quên nhất khi đổi từ `mode` (danh sách đóng) sang năm con số.
 */
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('✗ ' + m); process.exit(1); };

const mkRoom = async () => (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const mk = (code, name) => new Promise((res, rej) => {
  const ws = new WebSocket(`${SERVER.replace('http', 'ws')}/ws/${code}?name=${name}`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  const t = setTimeout(() => rej(new Error('không mở được socket')), 5000);
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));
  ws.onopen = () => { clearTimeout(t); res(c); };
});
const view = (c) => [...c.msgs].reverse().find((m) => m.view)?.view;
const room = (c) => [...c.msgs].reverse().find((m) => m.room)?.room;

/** Mở một phòng, đặt cấu hình, bắt đầu, trả về view sau khi ván chạy. */
async function chay(options, level = 6) {
  const code = await mkRoom();
  const a = await mk(code, 'An');
  const b = await mk(code, 'Binh');
  await sleep(500);
  a.send({ t: 'config', config: { level, themeIds: [], options } });
  await sleep(300);
  b.send({ t: 'ready', ready: true });
  await sleep(300);
  a.send({ t: 'start' });
  await sleep(4200);                    // qua đếm ngược 3 giây
  return { v: view(a), r: room(a), a, b };
}

// 1) Tuỳ chọn tới được bàn thật
{
  const { v, r } = await chay({ time: 0, lives: 3, peek: 2, shuffle: 2, special: 0 });
  if (!v) fail('không nhận được view nào');
  const mang = v.players[0].lives;
  if (mang === null) fail('bật tuỳ chọn mạng mà view báo không có mạng');
  if (typeof v.peekLeft !== 'number' || v.peekLeft <= 0) fail(`bật xem trước mà peekLeft = ${v.peekLeft}`);
  if (v.timeLeft !== null) fail(`tắt đồng hồ mà vẫn có timeLeft = ${v.timeLeft}`);
  if (r.config.options.lives !== 3) fail('cấu hình phòng không giữ đúng mức đã đặt');
  console.log(`✓ tuỳ chọn tới được bàn: ${mang} mạng · xem trước ${Math.ceil(v.peekLeft)}s · không đồng hồ`);
}

// 2) ON-09 — dữ liệu bẩn từ client bị kéo về khoảng hợp lệ
{
  const { v, r } = await chay({ lives: 999, peek: 99, shuffle: -5, special: 'x', time: 1.7 });
  if (!v) fail('không nhận được view nào');
  const o = r.config.options;
  for (const [k, muc] of Object.entries(o)) {
    if (!Number.isInteger(muc) || muc < 0 || muc > 3) fail(`server giữ mức bẩn: ${k} = ${muc}`);
  }
  const mang = v.players[0].lives;
  if (mang !== null && mang > 60) fail(`lives: 999 lọt qua — bàn có ${mang} mạng`);
  if (v.peekLeft !== null && v.peekLeft > 30) fail(`peek: 99 lọt qua — hé bàn ${v.peekLeft} giây`);
  console.log(`✓ ON-09: mức bẩn bị kéo về ${JSON.stringify(o)}`);
}

// 3) Bàn trơn: không tuỳ chọn nào bật thì không có luật lạ nào
{
  const { v } = await chay({ time: 0, lives: 0, peek: 0, shuffle: 0, special: 0 });
  if (v.timeLeft !== null) fail('bàn trơn mà vẫn có đồng hồ');
  if (v.peekLeft !== null) fail('bàn trơn mà vẫn hé bài');
  if (v.players[0].lives !== null) fail('bàn trơn mà vẫn có mạng');
  if (v.cards.some((c) => c.power)) fail('bàn trơn mà vẫn có thẻ đặc biệt');
  console.log('✓ bàn trơn: không đồng hồ, không mạng, không hé bài, không thẻ đặc biệt');
}

console.log('\nOPTIONS SMOKE OK');
process.exit(0);
