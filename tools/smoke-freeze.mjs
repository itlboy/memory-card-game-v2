// Soi lỗi "bàn treo": lật hai thẻ lệch nhau rồi xem server có TỰ úp lại và
// chuyển lượt hay không, in dòng thời gian từng tin nhắn.
//
// Lỗi đã gặp trên production: hai thẻ mở, đồng hồ lượt về 0, cả hai người chơi
// không làm gì được, mấy chục giây sau mới tự chạy tiếp. Local không tái hiện
// được nên giữ kịch bản này lại để soi thẳng production:
//
//   node tools/smoke-freeze.mjs                                   # wrangler dev
//   MM_SERVER=https://thebai.hello314.com node tools/smoke-freeze.mjs
//
// Dấu hiệu HỎNG: sau dòng events(flip+miss) mà quá ~1,5 giây không thấy
// events(turn) thì chuỗi alarm phía server đã đứt.
import { moGoiTin } from './lib-view.mjs';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const WS = SERVER.replace('http', 'ws');
const T0 = Date.now();
const log = (...a) => console.log(`[${String(Date.now() - T0).padStart(6)}ms]`, ...a);
class C {
  constructor(n) { this.name = n; this.view = null; }
  connect(code) {
    this.ws = new WebSocket(`${WS}/ws/${code}?name=${encodeURIComponent(this.name)}`);
    this.ws.onmessage = (e) => {
      const m = moGoiTin(JSON.parse(e.data));
      if (m.view) this.view = m.view;
      if (m.t === 'welcome') { this.id = m.playerId; this.ok = true; }
      const nhan = m.t === 'events' ? `events(${m.events.map((x) => x.type).join('+')})` : m.t;
      const up = m.view ? m.view.cards.filter((c) => c.state === 'up').length : '-';
      const luot = m.view ? (m.view.currentId === this.id ? 'MÌNH' : 'kia') : '-';
      log(`${this.name} ← ${nhan}  [đang mở: ${up}, lượt: ${luot}, tLượt: ${m.view?.turnTimeLeft ?? '-'}]`);
    };
    return new Promise((r) => { const i = setInterval(() => { if (this.ok) { clearInterval(i); r(); } }, 30); });
  }
  send(m) { log(`${this.name} → ${m.t}${m.index !== undefined ? ' #' + m.index : ''}`); this.ws.send(JSON.stringify(m)); }
}
const { code } = await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json();
const a = new C('An'), b = new C('Bình');
await a.connect(code); await b.connect(code);
await new Promise((r) => setTimeout(r, 400));
a.send({ t: 'config', config: { level: 50, mode: 'time' } });
await new Promise((r) => setTimeout(r, 400));
b.send({ t: 'ready', ready: true });
await new Promise((r) => setTimeout(r, 300));
a.send({ t: 'start' });
await new Promise((r) => setTimeout(r, 4000));

for (let i = 0; i < 3; i++) {
  const v = a.view;
  const cur = v.currentId === a.id ? a : b;
  const down = v.cards.filter((c) => c.state === 'down').map((c) => c.index);
  cur.send({ t: 'flip', index: down[0] });
  await new Promise((r) => setTimeout(r, 500));
  const cur2 = (cur.view ?? v).currentId === cur.id ? cur : (cur === a ? b : a);
  const down2 = (cur.view ?? v).cards.filter((c) => c.state === 'down').map((c) => c.index);
  cur2.send({ t: 'flip', index: down2[0] });
  log(`--- chờ 6 giây xem server có tự xử lý ---`);
  await new Promise((r) => setTimeout(r, 6000));
}
process.exit(0);
