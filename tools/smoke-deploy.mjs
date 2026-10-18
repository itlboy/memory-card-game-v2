// DEPLOY KHÔNG MẤT LƯỢT (18.10.2026): đang GIỮA VÁN thì khởi động lại server Node (như Keel thay
// pod), rồi kiểm ba điều chủ dự án cần:
//   1. lúc tắt, mọi máy nhận mã đóng 1012 (server khởi động lại) — biết NGAY để nối lại nhanh;
//   2. vào lại bằng token: đúng danh tính cũ, ván còn nguyên;
//   3. đồng hồ LƯỢT không bị trừ phần thời gian server tắt (room.ts dungDeKhoiDongLai /
//      chayTiepSauKhoiDong + engine tamDungVan/chayTiepVan).
//
//   MM_SERVER=http://127.0.0.1:8091 node tools/smoke-deploy.mjs --restart "<lệnh tắt rồi bật lại server>"
//
// Server PHẢI có MYSQL_URL (không thì phòng chỉ ở RAM, khởi động lại là mất — bài này vô nghĩa).
// Lệnh khởi động lại nên tắt bằng SIGTERM và chờ ≥ 5 giây rồi mới bật: khoảng tắt càng dài thì
// lượt bị trừ (nếu lỗi quay lại) càng lộ.
import { moGoiTin } from './lib-view.mjs';
import { execSync } from 'node:child_process';

const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8080';
const WS = SERVER.replace('http', 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hong = (m) => { console.log(`✗ ${m}`); process.exit(1); };
const iRestart = process.argv.indexOf('--restart');
if (iRestart === -1) { console.log('(bỏ qua: không truyền --restart)'); process.exit(0); }

class Client {
  constructor(name) { this.name = name; this.inbox = []; this.dongMa = null; }
  connect(code, token = '') {
    const p = new URLSearchParams({ name: this.name, pv: '1' });
    if (token) p.set('token', token);
    this.inbox = []; this.dongMa = null;
    this.ws = new WebSocket(`${WS}/ws/${code}?${p}`);
    this.ws.onmessage = (e) => this.inbox.push(moGoiTin(JSON.parse(e.data)));
    this.ws.onclose = (e) => { this.dongMa = e.code; };
    return this.cho((m) => m.t === 'welcome', `welcome ${this.name}`);
  }
  async cho(pred, nhan, ms = 10000) {
    const het = Date.now() + ms;
    while (Date.now() < het) {
      const m = this.inbox.find(pred);
      if (m) return m;
      await sleep(50);
    }
    hong(`hết giờ chờ: ${nhan}`);
  }
  /** View MỚI NHẤT (state/events đều mang view) */
  viewCuoi() {
    for (let i = this.inbox.length - 1; i >= 0; i--) { const m = this.inbox[i]; if (m.view) return m.view; }
    return null;
  }
  send(msg) { this.ws.send(JSON.stringify(msg)); }
}

const code = (await (await fetch(`${SERVER}/api/rooms`, { method: 'POST' })).json()).code;
const an = new Client('An'), binh = new Client('Bình');
const w1 = await an.connect(code); an.id = w1.playerId; an.token = w1.token;
const w2 = await binh.connect(code); binh.id = w2.playerId; binh.token = w2.token;
an.send({ t: 'config', config: { level: 1, options: { time: 0, lives: 0, peek: 0, shuffle: 0, special: 0 } } });
await sleep(300);
binh.send({ t: 'ready', ready: true }); await sleep(300);
an.send({ t: 'start' });
await an.cho((m) => m.t === 'state' && m.view?.status === 'playing', 'ván bắt đầu', 12000);
await sleep(2500);   // để đồng hồ lượt chạy một chút
an.send({ t: 'resync' }); await sleep(400);
const truoc = an.viewCuoi();
if (!truoc || truoc.turnTimeLeft == null) hong('không đọc được đồng hồ lượt trước khi tắt');
console.log(`✓ phòng ${code}: giữa ván, lượt còn ${truoc.turnTimeLeft.toFixed(1)}s`);

const t0 = Date.now();
execSync(process.argv[iRestart + 1], { stdio: 'ignore', shell: '/bin/bash' });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${SERVER}/health`)).ok) break; } catch { /* chưa lên */ }
  await sleep(250);
}
const tat = (Date.now() - t0) / 1000;
console.log(`  server tắt + bật lại mất ${tat.toFixed(1)}s`);

if (an.dongMa !== 1012 || binh.dongMa !== 1012) hong(`lúc tắt phải đóng socket mã 1012, nhận được ${an.dongMa} / ${binh.dongMa}`);
console.log('✓ lúc tắt mọi máy nhận mã 1012 (server khởi động lại)');

const v1 = await an.connect(code, an.token);
const v2 = await binh.connect(code, binh.token);
if (v1.playerId !== an.id || v2.playerId !== binh.id) hong('vào lại thành người mới — mất danh tính qua lần khởi động lại');
an.send({ t: 'resync' }); await sleep(600);
const sau = an.viewCuoi();
if (!sau || sau.status !== 'playing') hong(`ván không còn sau khi khởi động lại (status ${sau?.status})`);
const mat = truoc.turnTimeLeft - sau.turnTimeLeft;
console.log(`  lượt còn ${sau.turnTimeLeft.toFixed(1)}s sau khi dựng lại (hụt ${mat.toFixed(1)}s, server tắt ${tat.toFixed(1)}s)`);
// Hụt cho phép ~2s (đo resync trước tắt + sau bật, nối lại). Lỗi quay lại thì hụt ≈ thời gian tắt (≥ 5s).
if (mat > 2.5) hong(`đồng hồ lượt bị trừ ${mat.toFixed(1)}s vì deploy — người đang tới lượt mất lượt`);
console.log('✓ vào lại đúng danh tính, ván còn nguyên, đồng hồ lượt KHÔNG bị trừ phần server tắt');
an.ws.close(); binh.ws.close();
console.log('DEPLOY SMOKE OK');
process.exit(0);
