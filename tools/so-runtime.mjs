#!/usr/bin/env node
// SO HIỆU NĂNG SERVER GAME GIỮA CÁC RUNTIME (Node ↔ Bun) — 22.11.2026, chủ dự án: "làm bản test so sánh
// hiệu năng… nếu tốt hơn thì chuyển sang bun". CÙNG một file `apps/node-server/dist/server.mjs`, cùng tải,
// chỉ đổi lệnh chạy. Mỗi runtime đo:
//   1. KHỞI ĐỘNG: từ lúc spawn tới khi /health trả 200.
//   2. RAM (RSS) lúc rỗi, ĐỈNH lúc tải, và sau tải — máy Dallas chỉ có 768 MB nên đây là số quan trọng nhất.
//   3. HTTP: file tĩnh (index.html) + /api/ping — req/giây, p50/p99.
//   4. PHÒNG ONLINE: PHONG phòng × 4 người giả lật thật nhanh trong GIAY giây (hết ván tự Chơi lại). Đo ĐỘ TRỄ từ
//      lúc gửi `flip` tới tin `state/events` kế tiếp về chính người lật (p50/p95/p99), số lượt lật server xử được,
//      và GIÂY CPU server tiêu cho ngần ấy việc (máy Dallas bị bóp khi CPU > 30%).
//
//   pnpm build && pnpm --filter @mm/node-server build      (cần dist của web + server)
//   node tools/so-runtime.mjs                              (mặc định RT=node,bun)
//   RT="node,bun" PHONG=250 GIAY=40 LAP=2 node tools/so-runtime.mjs
//
// Người giả chạy TRONG tiến trình này (luôn là Node) nên phía tải giống hệt nhau giữa các lượt.
// Số trên macOS chỉ để tham khảo — server thật chạy Linux: chạy workflow `so-runtime.yml` để có số Linux.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { moGoiTin } from './lib-view.mjs';

const RT = (process.env.RT ?? 'node,bun').split(',').map((s) => s.trim()).filter(Boolean);
const PHONG = Number(process.env.PHONG ?? 250);
const GIAY = Number(process.env.GIAY ?? 40);
const LAP = Number(process.env.LAP ?? 2);
const CONG = Number(process.env.CONG ?? 8811);
const GOC = new URL('..', import.meta.url).pathname;
const DIST = GOC + 'apps/node-server/dist/server.mjs';
const WEB = GOC + 'apps/web/dist';
if (!existsSync(DIST)) { console.error('Thiếu ' + DIST + ' — chạy `pnpm --filter @mm/node-server build` trước'); process.exit(1); }

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const pt = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const tb = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** RSS (MB) và giây CPU (user+sys) của tiến trình server. Linux đọc /proc cho chính xác, macOS dùng ps. */
function doTienTrinh(pid) {
  try {
    if (process.platform === 'linux') {
      const st = readFileSync(`/proc/${pid}/stat`, 'utf8'); const f = st.slice(st.lastIndexOf(')') + 2).split(' ');
      const hz = 100; const cpu = (Number(f[11]) + Number(f[12])) / hz;
      const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0) / 1024;
      return { rss, cpu };
    }
    const [rss, t] = execFileSync('ps', ['-o', 'rss=,cputime=', '-p', String(pid)], { encoding: 'utf8' }).trim().split(/\s+/);
    const m = t.split(/[:-]/).map(Number); let cpu = 0; for (const x of m) cpu = cpu * 60 + x;   // [hh:]mm:ss.xx
    return { rss: Number(rss) / 1024, cpu };
  } catch { return { rss: 0, cpu: 0 }; }
}

async function http(url, so, songSong, canOk = true) {
  const tre = []; let loi = 0; let con = so;
  const t0 = performance.now();
  await Promise.all(Array.from({ length: songSong }, async () => {
    while (con-- > 0) {
      const a = performance.now();
      try { const r = await fetch(url); await r.arrayBuffer(); if (canOk ? !r.ok : r.status >= 500 && r.status !== 503) loi++; } catch { loi++; }
      tre.push(performance.now() - a);
    }
  }));
  return { rps: Math.round(so / ((performance.now() - t0) / 1000)), p50: pt(tre, 0.5), p99: pt(tre, 0.99), loi };
}

/** Người giả tối giản (rút từ gia-nguoi.mjs): nhớ thẻ, lật ngay khi tới lượt, hết ván bấm Chơi lại. */
class Gia {
  constructor(sv, code, ten, so) { this.sv = sv; this.code = code; this.ten = ten; this.so = so; this.kyUc = new Map(); this.gui0 = 0; }
  vao() {
    return new Promise((ok, hong) => {
      this.ws = new WebSocket(`${this.sv.replace(/^http/, 'ws')}/ws/${this.code}?name=${encodeURIComponent(this.ten)}`);
      const han = setTimeout(() => hong(new Error('quá hạn nối')), 10000);
      this.ws.onerror = () => { clearTimeout(han); hong(new Error('lỗi WS')); };
      this.ws.onmessage = (e) => {
        let m; try { m = moGoiTin(JSON.parse(e.data)); } catch { return; }
        if (m.t === 'welcome') { clearTimeout(han); this.id = m.playerId; ok(); }
        this.nhan(m);
      };
    });
  }
  gui(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  nhan(m) {
    if (m.t === 'room' && m.room?.status === 'lobby') {
      this.xinLai = false; this.kyUc.clear();
      const toi = m.room.players.find((p) => p.id === this.id);
      if (toi && !toi.ready) this.gui({ t: 'ready', ready: true });
      const coMat = m.room.players.filter((p) => !p.disconnectedAt);
      if (m.room.hostId === this.id && !this.daBat && coMat.length >= 4 && coMat.every((p) => p.ready || p.id === this.id)) { this.daBat = true; this.gui({ t: 'start' }); }
      return;
    }
    if ((m.t !== 'state' && m.t !== 'events') || !m.view) return;
    if (this.gui0) { this.so.tre.push(performance.now() - this.gui0); this.gui0 = 0; }
    const v = m.view;
    if (v.status === 'won' || v.status === 'lost') {
      if (!this.xinLai) { this.xinLai = true; this.so.van++; setTimeout(() => this.gui({ t: 'again' }), 150); }
      return;
    }
    if (v.status === 'playing' && this.xinLai) { this.xinLai = false; this.kyUc.clear(); this.daBat = false; }
    if (v.moves === 0 && this.kyUc.size) this.kyUc.clear();
    for (const c of v.cards) { if (c.symbol) this.kyUc.set(c.index, c.symbol); if (c.state === 'matched') this.kyUc.delete(c.index); }
    if (v.status !== 'playing' || v.currentId !== this.id || this.dung) return;
    const dang = v.cards.filter((c) => c.state === 'up').map((c) => c.index);
    if (dang.length >= 2) return;
    const con = v.cards.filter((c) => c.state === 'down' && !c.blank).map((c) => c.index);
    if (!con.length) return;
    let chon = null;
    if (dang.length === 1) { const can = this.kyUc.get(dang[0]); if (can) chon = con.find((i) => this.kyUc.get(i) === can) ?? null; }
    if (chon === null) chon = con[(this.so.lat * 7 + this.so.tre.length) % con.length];   // tất định, không Math.random — hai runtime nhận tải như nhau
    this.so.lat++;
    this.gui0 = performance.now();
    this.gui({ t: 'flip', index: chon });
  }
}

async function doMot(rt, lan) {
  const cong = CONG + lan;
  const sv = `http://127.0.0.1:${cong}`;
  const t0 = performance.now();
  const con = spawn(rt, [DIST], { env: { ...process.env, PORT: String(cong), WEB_DIR: WEB, NODE_ENV: 'production', MYSQL_URL: '' }, stdio: 'ignore' });
  const tat = () => { try { con.kill('SIGTERM'); } catch { /* đã tắt */ } };
  process.on('exit', tat);
  try {
    let len = false;
    for (let i = 0; i < 400 && !len; i++) { try { len = (await fetch(sv + '/health')).ok; } catch { await nghi(10); } }
    if (!len) throw new Error(`${rt}: server không lên`);
    const khoiDong = performance.now() - t0;
    await nghi(1500);
    const roi = doTienTrinh(con.pid);

    const tinh = await http(sv + '/', 4000, 32);
    const ping = await http(sv + '/api/ping', 2000, 32, false);   // ping trả 503 khi máy đo sắp đầy ổ — vẫn là câu trả lời hợp lệ

    // PHÒNG ONLINE
    const so = { tre: [], lat: 0, van: 0 };
    const gia = [];
    for (let p = 0; p < PHONG; p++) {
      const code = (await (await fetch(sv + '/api/rooms', { method: 'POST' })).json()).code;
      if (!code) throw new Error(`${rt}: không tạo được phòng thứ ${p + 1}`);
      for (let i = 0; i < 4; i++) { const g = new Gia(sv, code, `G${p}-${i}`, so); await g.vao(); gia.push(g); }
    }
    const truoc = doTienTrinh(con.pid);
    so.tre.length = 0; so.lat = 0; so.van = 0;
    let dinh = truoc.rss;
    const canh = setInterval(() => { dinh = Math.max(dinh, doTienTrinh(con.pid).rss); }, 500);
    await nghi(GIAY * 1000);
    clearInterval(canh);
    const sau = doTienTrinh(con.pid);
    const kq = {
      rt, khoiDong, rssRoi: roi.rss, rssDinh: Math.max(dinh, sau.rss), tinh, ping,
      lat: so.lat, van: so.van, latMoiGiay: so.lat / GIAY, cpu: sau.cpu - truoc.cpu,
      cpuMoiNghinLat: so.lat ? ((sau.cpu - truoc.cpu) * 1000) / so.lat * 1000 : 0,   // ms CPU / 1000 lượt lật
      p50: pt(so.tre, 0.5), p95: pt(so.tre, 0.95), p99: pt(so.tre, 0.99), tbTre: tb(so.tre), ketNoi: gia.length
    };
    for (const g of gia) { g.dung = true; g.gui({ t: 'leave' }); }
    await nghi(400);
    for (const g of gia) g.ws?.close();
    await nghi(1500);
    kq.rssSau = doTienTrinh(con.pid).rss;
    return kq;
  } finally { tat(); process.off('exit', tat); await nghi(600); }
}

const phienBan = (rt) => { try { return execFileSync(rt, ['--version'], { encoding: 'utf8' }).trim(); } catch { return '?'; } };
console.log(`So runtime: ${RT.map((r) => `${r} ${phienBan(r)}`).join(' ↔ ')} · ${PHONG} phòng × 4 người · ${GIAY}s · ${LAP} lượt mỗi bên (xen kẽ) · ${process.platform}/${process.arch}`);
const tatCa = Object.fromEntries(RT.map((r) => [r, []]));
let lan = 0;
for (let l = 0; l < LAP; l++) for (const rt of RT) {
  const k = await doMot(rt, lan++);
  tatCa[rt].push(k);
  console.log(`  [${l + 1}/${LAP}] ${rt}: khởi động ${k.khoiDong.toFixed(0)}ms · RSS rỗi ${k.rssRoi.toFixed(0)} / đỉnh ${k.rssDinh.toFixed(0)} / sau ${k.rssSau.toFixed(0)} MB · tĩnh ${k.tinh.rps} rps · ping ${k.ping.rps} rps · ${k.lat} lượt lật (${k.van} ván) · CPU ${k.cpu.toFixed(1)}s · trễ p50 ${k.p50.toFixed(2)} p99 ${k.p99.toFixed(2)}ms${k.tinh.loi + k.ping.loi ? ` · LỖI HTTP ${k.tinh.loi + k.ping.loi}` : ''}`);
}

// Bảng tổng: lấy TRUNG VỊ các lượt
const giua = (rt, f) => pt(tatCa[rt].map(f), 0.5);
const HANG = [
  ['Khởi động (ms)', (k) => k.khoiDong, 0, 'thap'],
  ['RSS rỗi (MB)', (k) => k.rssRoi, 0, 'thap'],
  ['RSS đỉnh lúc tải (MB)', (k) => k.rssDinh, 0, 'thap'],
  ['RSS sau khi mọi người rời (MB)', (k) => k.rssSau, 0, 'thap'],
  ['File tĩnh (req/s)', (k) => k.tinh.rps, 0, 'cao'],
  ['File tĩnh p99 (ms)', (k) => k.tinh.p99, 1, 'thap'],
  ['/api/ping (req/s)', (k) => k.ping.rps, 0, 'cao'],
  ['Lượt lật xử được /giây', (k) => k.latMoiGiay, 0, 'cao'],
  ['CPU server cho cả bài (s)', (k) => k.cpu, 1, 'thap'],
  ['CPU / 1000 lượt lật (ms)', (k) => k.cpuMoiNghinLat, 0, 'thap'],
  ['Trễ lật p50 (ms)', (k) => k.p50, 2, 'thap'],
  ['Trễ lật p95 (ms)', (k) => k.p95, 2, 'thap'],
  ['Trễ lật p99 (ms)', (k) => k.p99, 2, 'thap']
];
console.log('\n| Chỉ số | ' + RT.join(' | ') + ' | Hơn |');
console.log('|---|' + RT.map(() => '---:').join('|') + '|---|');
for (const [ten, f, le, huong] of HANG) {
  const gt = RT.map((r) => giua(r, f));
  const tot = huong === 'thap' ? Math.min(...gt) : Math.max(...gt);
  const xau = huong === 'thap' ? Math.max(...gt) : Math.min(...gt);
  const lech = xau && tot ? Math.abs(xau - tot) / Math.max(xau, tot) : 0;
  const hon = lech < 0.05 ? '≈' : `${RT[gt.indexOf(tot)]} (${huong === 'thap' ? '−' : '+'}${Math.round((huong === 'thap' ? (xau - tot) / xau : (tot - xau) / xau) * 100)}%)`;
  console.log(`| ${ten} | ${gt.map((x) => x.toFixed(le)).join(' | ')} | ${hon} |`);
}
process.exit(0);
