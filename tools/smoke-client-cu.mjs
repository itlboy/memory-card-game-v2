// Smoke: CLIENT CŨ VẪN PHẢI CHƠI ĐƯỢC.
//   MM_SERVER=http://127.0.0.1:8787 node tools/smoke-client-cu.mjs
//
// Web này là PWA — service worker giữ bản JS cũ trong cache, nên ngay sau MỖI
// lần deploy luôn có người đang chạy client cũ hơn server. Đây không phải tình
// huống hiếm cần lo xa: nó là trạng thái BÌNH THƯỜNG của vài phút đầu sau mỗi
// lần đẩy code, và của những máy chưa mở lại app.
//
// Đã hỏng thật một lần: server đổi sang gửi view dạng gọn cho TẤT CẢ, client cũ
// đọc `view.cards` ra `undefined` và người chơi trên iPhone thấy BÀN TRẮNG
// KHÔNG CÓ THẺ NÀO. Luật rút ra và được canh ở đây: đổi dạng trên dây thì
// CLIENT phải tự khai (`?pv=1`), server không bao giờ tự quyết.
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const WS = SERVER.replace('http', 'ws');
const hong = (m) => { console.error('✗', m); process.exit(1); };
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/** `pv` để trống = client CŨ, không biết mở gói; 'pv=1' = client mới. */
function mo(code, q) {
  const ws = new WebSocket(`${WS}/ws/${code}?${q}`);
  const c = { ws, msgs: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(e.data));   // KHÔNG mở gói
  return new Promise((res) => { ws.onopen = () => res(c); });
}
const viewCuoi = (c) => [...c.msgs].reverse().find((m) => m.view)?.view;

const { code, token } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
// Chủ phòng chạy bản CŨ, khách chạy bản MỚI — đúng cảnh giữa hai lần deploy.
const cu = await mo(code, `token=${token}&name=Cu`); await cho(300);
const moi = await mo(code, 'name=Moi&pv=1'); await cho(300);
moi.send({ t: 'ready', ready: true }); await cho(300);
cu.send({ t: 'start' }); await cho(7000);

const vCu = viewCuoi(cu);
if (!vCu) hong('client cũ không nhận được view nào');
if (!Array.isArray(vCu.cards)) {
  hong('client cũ đọc view.cards ra undefined — đây đúng là BÀN TRẮNG trên iPhone');
}
console.log(`✓ client cũ nhận view đầy đủ: ${vCu.cards.length} thẻ`);

const vMoi = viewCuoi(moi);
if (Array.isArray(vMoi.cards)) hong('client mới vẫn nhận dạng đầy đủ — tiết kiệm băng thông mất tác dụng');
if (typeof vMoi.n !== 'number') hong('client mới nhận dạng lạ, không có `n`');
console.log(`✓ client mới nhận dạng gọn: n=${vMoi.n}`);

// Và hai bên phải thấy CÙNG một bàn — gói/không gói chỉ là cách viết trên dây.
if (vMoi.n !== vCu.cards.length) hong(`hai bên thấy bàn khác nhau: ${vMoi.n} vs ${vCu.cards.length}`);
console.log('✓ cùng một bàn, chỉ khác cách viết trên dây');

// Nước đi của client cũ (không có `seq`) vẫn phải chạy — chốt chống trùng
// KHÔNG được nuốt tin của người chưa biết gửi seq.
const di = vCu.currentId === cu.msgs.find((m) => m.t === 'welcome').playerId ? cu : moi;
const truoc = viewCuoi(di);
di.send({ t: 'flip', index: 0 });          // đúng như bản cũ: không kèm seq
await cho(800);
const sau = viewCuoi(di);
const soNgua = (v) => (v.cards ?? Array.from({ length: v.n }, (_, i) =>
  v.o.find((c) => c.index === i) ?? { state: 'down' })).filter((c) => c.state === 'up').length;
if (soNgua(sau) !== 1) hong(`nước đi không kèm seq bị nuốt — client cũ bấm mà không lật được (${soNgua(truoc)}→${soNgua(sau)})`);
console.log('✓ nước đi không kèm `seq` vẫn lật được thẻ');

console.log('\nCLIENT-CU SMOKE OK');
process.exit(0);
