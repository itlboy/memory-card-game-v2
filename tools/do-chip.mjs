#!/usr/bin/env node
// ĐO CHIP NGƯỜI CHƠI TRÊN SAFARI (WebKit) — lớp canh thứ ba của luật "chip không vỡ"
// (17.10.2026, chủ dự án: "có cơ chế nào chống vỡ giao diện không, vì tương lai có thể bị").
//   1. số gọn ≤4 ký tự (`numGon`, unit test) · 2. điểm không co, tên co trước (test tĩnh)
//   3. công cụ này: phòng online THẬT 2 / 3 / 4 người, tên dài nhất (16 ký tự), điểm rộng nhất
//      có thể ("9,9k", "99k"), ba khổ iPhone. Đỏ khi: điểm bị cắt, chip lòi khỏi màn, hay tên
//      người đang đi còn chưa tới một chữ.
//
//   pnpm dev   (web :3001 + wrangler :8787)  rồi  pnpm do:chip
//   WEB=… MM_SERVER=… để đo chỗ khác. Ảnh ở /tmp/mm-chip.
import { devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { moTrinhDuyet } from './lib-playwright.mjs';

const WEB = process.env.WEB ?? 'http://localhost:3001';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const ANH = '/tmp/mm-chip';
mkdirSync(ANH, { recursive: true });
const KHO = [[375, 553, 'SE'], [390, 664, 'iPhone 14'], [430, 745, 'Pro Max']];
const TEN = 'Nguyễn Hoàng Anh'; // 16 ký tự = trần ô nhập tên
// Trần điểm lý thuyết là 5 chữ số (bàn 88 thẻ) → chuỗi rộng nhất numGon ra được là "9,9k" / "99k".
const DIEM = ['9,9k', '99k'];

const b = await moTrinhDuyet('webkit');
const loi = [];
const giaDangChay = new Set();
process.on('exit', () => { for (const g of giaDangChay) g.kill('SIGINT'); });

for (const [w, h, may] of KHO) for (const so of [2, 3, 4]) {
  const c = await b.newContext({ ...devices['iPhone 14'], viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.addInitScript((ten) => { localStorage.setItem('mm.lang', 'vi'); localStorage.setItem('mm.v2', JSON.stringify({ names: [ten] })); }, TEN);
  const p = await c.newPage();
  const code = (await (await fetch(SERVER + '/api/rooms', { method: 'POST' })).json()).code;
  await p.goto(`${WEB}/?room=${code}`);
  await p.waitForSelector('.lobby-chat', { timeout: 20000 });
  const gia = spawn('node', ['tools/gia-nguoi.mjs', code, '--so', String(so - 1), '--tre', '60000', '--ten', Array(so - 1).fill(TEN).join(',')],
    { stdio: 'ignore', env: { ...process.env, MM_SERVER: SERVER } });
  giaDangChay.add(gia);
  await p.waitForTimeout(4000); // người giả vào phòng + sẵn sàng
  await p.locator('button').filter({ hasText: /Bắt đầu/ }).last().click();
  await p.waitForSelector('.board-wrap .card', { timeout: 20000 });
  await p.waitForTimeout(3500);
  for (const diem of DIEM) {
    // Điểm thật không đẩy lên 99k được trong vài giây — đặt chữ RỘNG NHẤT numGon có thể ra.
    await p.evaluate((d) => document.querySelectorAll('.pchip .pts').forEach((e) => { e.textContent = d; e.classList.add('dai'); }), diem);
    await p.waitForTimeout(300);
    const kq = await p.evaluate((w) => {
      const chip = [...document.querySelectorAll('.pchip')];
      const r = { so: chip.length, cat: 0, lo: 0, ten: -1 };
      for (const c of chip) {
        const cr = c.getBoundingClientRect(); const s = c.querySelector('.pts'); const sr = s.getBoundingClientRect();
        if (sr.right > cr.right - 1 || sr.left < cr.left || s.scrollWidth > s.clientWidth + 1) r.cat++;
        if (cr.right > w + 1 || cr.left < -1) r.lo++;
        if (c.classList.contains('active')) r.ten = Math.round(c.querySelector('b')?.getBoundingClientRect().width ?? 0);
      }
      return r;
    }, w);
    const nhan = `${may} · ${so} người · ${diem}`;
    const sai = [];
    if (kq.so !== so) sai.push(`chỉ thấy ${kq.so} chip`);
    if (kq.cat) sai.push(`${kq.cat} chip bị cắt điểm`);
    if (kq.lo) sai.push(`${kq.lo} chip lòi khỏi màn`);
    if (kq.ten >= 0 && kq.ten < 12) sai.push(`tên người đang đi chỉ còn ${kq.ten}px`);
    console.log(`${sai.length ? '✗' : '✓'} ${nhan}: tên người đang đi ${kq.ten}px${sai.length ? ' — ' + sai.join(', ') : ''}`);
    if (sai.length) loi.push(nhan);
    const r = await p.locator('.pchip').first().boundingBox();
    await p.screenshot({ path: `${ANH}/${may.replace(/ /g, '')}-${so}ng-${diem.replace(',', '_')}.png`, clip: { x: 0, y: Math.max(0, r.y - 8), width: w, height: r.height + 16 } });
  }
  gia.kill('SIGINT'); giaDangChay.delete(gia);
  await c.close();
}
await b.close();
console.log(loi.length ? `\n✗ ${loi.length} ca hỏng (ảnh ở ${ANH})` : `\n✓ chip không vỡ ở mọi ca (ảnh ở ${ANH})`);
process.exit(loi.length ? 1 : 0);
