#!/usr/bin/env node
// ĐO CHIP NGƯỜI CHƠI TRÊN SAFARI (WebKit) — lớp canh thứ ba của luật "chip không vỡ"
// (17.10.2026, chủ dự án: "có cơ chế nào chống vỡ giao diện không, vì tương lai có thể bị").
//   1. số gọn ≤4 ký tự (`numGon`, unit test) · 2. điểm không co, tên co trước (test tĩnh)
//   3. công cụ này: phòng online THẬT 2 / 3 / 4 người, tên dài nhất (16 ký tự), điểm rộng nhất
//      có thể ("9,9k", "99k") + 🏅12 tỷ số loạt, ba khổ iPhone. Đỏ khi: điểm bị cắt, chip lòi khỏi màn, hay tên
//      người đang đi còn chưa tới một chữ.
//
//   `--tim` (28.11.2026): phòng TÌM THẺ — cùng hàng chip (DaiNguoiChoi, dùng chung với ghép cặp) nhưng có thêm viên
//      giây / "+điểm" tràn mép chip, không có người đang đi. Đo lúc đáp án (có viên giây) VÀ khi một người MẤT MẠNG
//      thật (tắt hẳn tiến trình người giả đó): mọi chip phải còn tên, điểm không cắt, viên không lòi khỏi màn.
//
//   pnpm dev   (web :3001 + wrangler :8787)  rồi  pnpm do:chip  [--tim]
//   WEB=… MM_SERVER=… để đo chỗ khác. Ảnh ở /tmp/mm-chip.
import { devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { moTrinhDuyet } from './lib-playwright.mjs';

const WEB = process.env.WEB ?? 'http://localhost:3001';
const SERVER = process.env.MM_SERVER ?? 'http://127.0.0.1:8787';
const TIM = process.argv.includes('--tim');
const ANH = TIM ? '/tmp/mm-chip-tim' : '/tmp/mm-chip';
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
  // Đã có hồ sơ (bỏ màn "Chào bạn mới" bắt buộc từ 25.11) + đã nhận quà Premium (không bật bảng Premium)
  await c.addInitScript((ten) => {
    localStorage.setItem('mm.lang', 'vi'); localStorage.setItem('mm.anCai', '1'); localStorage.setItem('mm.premium.tang', '1');
    localStorage.setItem('mm.v2', JSON.stringify({ names: [ten], hoSo: { mat: '🦊', mau: '#ff9a1f', xong: true } }));
  }, TEN);
  const p = await c.newPage();
  const code = (await (await fetch(SERVER + '/api/rooms', { method: 'POST' })).json()).code;
  await p.goto(`${WEB}/?room=${code}`);
  await p.waitForSelector('.nut-kieu', { timeout: 20000 }); // hàng Kiểu chơi chỉ có ở phòng chờ
  if (TIM) { await p.locator('.nut-kieu').nth(1).click(); await p.waitForTimeout(500); }
  const moGia = (n, ten) => {
    if (n < 1) return null;
    const g = spawn('node', ['tools/gia-nguoi.mjs', code, '--so', String(n), '--tre', '60000', '--ten', Array(n).fill(ten).join(',')],
      { stdio: 'ignore', env: { ...process.env, MM_SERVER: SERVER } });
    giaDangChay.add(g);
    return g;
  };
  // Tìm Thẻ: người giả CUỐI chạy tiến trình riêng để tắt nó giữa ván = mất mạng thật
  const gia = moGia(TIM ? so - 2 : so - 1, TEN);
  const giaRot = TIM ? moGia(1, TEN) : null;
  await p.waitForTimeout(4000); // người giả vào phòng + sẵn sàng
  await p.locator('button').filter({ hasText: /Bắt đầu/ }).last().click();
  if (TIM) {
    // Tới đáp án lượt đầu (có viên giây), rồi cắt mạng người giả cuối và chờ chip báo
    await p.waitForSelector('.ott-ban', { timeout: 30000 });
    await p.waitForSelector('.giay-chip', { timeout: 45000 });
    giaRot.kill('SIGKILL'); giaDangChay.delete(giaRot);
    await p.waitForSelector('.pchip .netbad', { timeout: 30000 });
  } else {
    await p.waitForSelector('.board-wrap .card', { timeout: 20000 });
    await p.waitForTimeout(3500);
  }
  for (const diem of DIEM) {
    // Điểm thật không đẩy lên 99k được trong vài giây — đặt chữ RỘNG NHẤT numGon có thể ra.
    await p.evaluate((d) => document.querySelectorAll('.pchip .pts').forEach((e) => { e.textContent = d; e.classList.add('dai'); }), diem);
    // 🏅 TỶ SỐ LOẠT ở MỌI chip (07.11.2026): lỗi "điểm chip phải bị cắt" ở bàn 2 người trên
    // iPhone 15 Pro Max chỉ hiện khi có 🏅 — các lần đo trước không có nó nên không thấy.
    // Tìm Thẻ: viên giây + "+điểm" RỘNG NHẤT ở MỌI chip (ván thật chỉ người đã chọn mới có)
    if (TIM) await p.evaluate(() => document.querySelectorAll('.pchip').forEach((c) => {
      const mau = document.querySelector('.giay-chip');
      const them = (lop, chu) => {
        let e = c.querySelector('.' + lop);
        if (!e) { e = document.createElement('span'); for (const a of mau.attributes) if (a.name.startsWith('data-v')) e.setAttribute(a.name, ''); e.className = lop; c.appendChild(e); }
        e.textContent = chu; e.style.animation = 'none';
      };
      them('giay-chip', '19.9s'); them('cong', '+999');
    }));
    if (!TIM) await p.evaluate(() => document.querySelectorAll('.pchip').forEach((c) => {
      const pts = c.querySelector('.pts'); let wn = c.querySelector('.wins');
      if (!wn) { wn = document.createElement('span'); for (const a of pts.attributes) if (a.name.startsWith('data-v')) wn.setAttribute(a.name, ''); wn.className = 'wins'; pts.before(wn); }
      // Từ 16.11.2026 chỉ con số (không 🏅); chip đầu là người DẪN (xanh)
      wn.textContent = '12'; wn.classList.toggle('dan', c === c.parentElement.firstElementChild); c.classList.add('co-loat');
    }));
    await p.waitForTimeout(300);
    const kq = await p.evaluate((w) => {
      const chip = [...document.querySelectorAll('.pchip')];
      const r = { so: chip.length, cat: 0, lo: 0, ten: -1, tenMin: 999, mat: document.querySelectorAll('.pchip .netbad').length };
      for (const c of chip) {
        const cr = c.getBoundingClientRect(); const s = c.querySelector('.pts'); const sr = s.getBoundingClientRect();
        if (sr.right > cr.right - 1 || sr.left < cr.left || s.scrollWidth > s.clientWidth + 1) r.cat++;
        if (cr.right > w + 1 || cr.left < -1) r.lo++;
        for (const v of c.querySelectorAll('.giay-chip, .cong')) { const vr = v.getBoundingClientRect(); if (vr.right > w + 1 || vr.left < -1 || vr.top < -1) r.lo++; }
        // Tên ẨN hẳn (0px) là thiết kế khi chip hẹp (avatar là danh tính); tên còn hiện thì phải đọc được ≥ 12px
        const wb = Math.round(c.querySelector('b')?.getBoundingClientRect().width ?? 0);
        if (wb > 0) r.tenMin = Math.min(r.tenMin, wb);
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
    // Tìm Thẻ không có người đang đi — mọi chip đều phải còn đọc được tên; và phải thấy chip mất mạng
    if (TIM && kq.tenMin < 12) sai.push(`có tên bị ép còn ${kq.tenMin}px`);
    if (TIM && !kq.mat) sai.push('không thấy chip mất mạng');
    console.log(`${sai.length ? '✗' : '✓'} ${nhan}: ${TIM ? `tên hẹp nhất ${kq.tenMin === 999 ? 'ẩn hết' : kq.tenMin + 'px'}, ${kq.mat} mất mạng` : `tên người đang đi ${kq.ten}px`}${sai.length ? ' — ' + sai.join(', ') : ''}`);
    if (sai.length) loi.push(nhan);
    const r = await p.locator('.pchip').first().boundingBox();
    await p.screenshot({ path: `${ANH}/${may.replace(/ /g, '')}-${so}ng-${diem.replace(',', '_')}.png`, clip: { x: 0, y: Math.max(0, r.y - 14), width: w, height: r.height + 28 } });
  }
  if (gia) { gia.kill('SIGINT'); giaDangChay.delete(gia); }
  await c.close();
}
await b.close();
console.log(loi.length ? `\n✗ ${loi.length} ca hỏng (ảnh ở ${ANH})` : `\n✓ chip không vỡ ở mọi ca (ảnh ở ${ANH})`);
process.exit(loi.length ? 1 : 0);
