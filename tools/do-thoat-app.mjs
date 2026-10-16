/*
 * ĐO "PHÒNG NHÁY" KHI THOÁT APP RỒI VÀO LẠI (chủ dự án 15.10.2026: "thoát ra vào
 * lại cứ thấy cái phòng bị nháy một chút mặc dù tôi là chủ phòng").
 *
 * WebKit (engine Safari/iPhone) của Playwright, khổ iPhone 14. Ghi MỌI thay đổi
 * DOM (MutationObserver, không chỉ từng khung hình) xem phòng chờ có lúc nào biến
 * khỏi màn không, trong hai ca:
 *   1. app xuống nền, socket chết, quay lại (app còn sống);
 *   2. app bị hệ điều hành tắt hẳn, mở lại từ gốc (URL mất ?room=).
 *
 *   LOBBY_HOLD_MS=2000 PORT=18438 WEB_DIR=../../apps/web/dist node apps/node-server/dist/server.mjs
 *   node tools/do-thoat-app.mjs http://127.0.0.1:18438
 * Lần đầu: `pnpm exec playwright install webkit`.
 */
import { moTrinhDuyet } from './lib-playwright.mjs';

const URL_GOC = process.argv[2] ?? 'http://127.0.0.1:18438';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let loi = 0;
const ket = (ok, msg) => { console.log(ok ? '✓' : '✗', msg); if (!ok) loi++; };

const trinh = await moTrinhDuyet('webkit');   // lib-playwright: không bao giờ để lại trình duyệt mồ côi
const dong = async () => { try { await trinh.close(); } catch { /* đã đóng */ } };

try {
  const ctx = await trinh.newContext({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('mm.v2')) localStorage.setItem('mm.v2', JSON.stringify({ names: ['Kien'] }));
    // Giữ mọi socket để "giết" được như iOS làm khi app nằm nền
    const Goc = window.WebSocket;
    window.__ws = [];
    window.WebSocket = class extends Goc { constructor(...a) { super(...a); window.__ws.push(this); } };
    // visibilityState giả: Playwright không cho app "xuống nền" thật
    window.__an = false;
    Object.defineProperty(document, 'visibilityState', { get: () => (window.__an ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { get: () => window.__an });
    // Nhật ký: mỗi lần DOM đổi, phòng chờ còn trên màn không, và đang hiện gì
    window.__nk = [];
    window.__loai = () => {
      const vl = document.querySelector('.vao-lai');
      return document.querySelector('.room.sk') ? 'KHUNG-XAM'
        : vl && (vl.textContent.trim() || vl.children.length) ? 'MAN-CHO-VAO-LAI'
        : document.querySelector('.reconnect') ? 'BANG-MAT-KET-NOI'
        : document.querySelector('.lobby-chat') ? 'phong-cho'
        : document.querySelector('.board-wrap .card') ? 'ban-choi'
        : vl ? 'trong'
        : document.querySelector('.rooms, .empty') ? 'danh-sach'
        : document.querySelector('.online') ? 'man-online-khac'
        : document.querySelector('#app')?.children.length ? 'man-khac' : 'trong';
    };
    const ghi = () => {
      const s = window.__loai();
      if (window.__nk.at(-1)?.s !== s) window.__nk.push({ s, t: Math.round(performance.now()) });
    };
    new MutationObserver(ghi).observe(document, { subtree: true, childList: true, attributes: true });
    // Thứ THẬT SỰ được vẽ: lấy mẫu mỗi khung hình (MutationObserver thấy cả trạng
    // thái trung gian chưa bao giờ lên màn).
    window.__khung = [];
    const mau = () => {
      const s = window.__loai();
      if (window.__khung.at(-1)?.s !== s) window.__khung.push({ s, t: Math.round(performance.now()) });
      requestAnimationFrame(mau);
    };
    requestAnimationFrame(mau);
  });

  const code = (await (await fetch(`${URL_GOC}/api/rooms`, { method: 'POST' })).json()).code;
  const page = await ctx.newPage();
  await page.goto(`${URL_GOC}/?room=${code}`);
  await page.waitForSelector('.lobby-chat', { timeout: 15000 });
  await sleep(800);
  ket(true, `vào phòng ${code} (chủ phòng)`);

  // ---- Ca 1: xuống nền, socket chết, quay lại ----
  await page.evaluate(() => { window.__nk = [{ s: 'phong-cho', t: 0 }]; window.__khung = [{ s: 'phong-cho', t: 0 }]; });
  await page.evaluate(() => {
    window.__an = true; document.dispatchEvent(new Event('visibilitychange'));
    for (const s of window.__ws) try { s.close(); } catch { /* */ }
  });
  await sleep(3500);   // quá hạn giữ chỗ (2 giây ở server đo)
  await page.evaluate(() => { window.__an = false; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(2500);
  const nk1 = [...await page.evaluate(() => window.__nk), ...await page.evaluate(() => window.__khung.filter((x) => x.t > 0))];
  const roi1 = nk1.filter((x) => x.s !== 'phong-cho');
  ket(!roi1.length, `xuống nền → quay lại: phòng chờ ${roi1.length ? 'NHÁY sang ' + roi1.map((x) => x.s).join(', ') : 'đứng yên suốt'}`);
  const laChu1 = await page.evaluate(() => !!document.querySelector('.btn-primary') && !document.querySelector('.is-ready'));
  ket(laChu1, 'vẫn là chủ phòng (nút Bắt đầu, không phải Sẵn sàng)');

  // ---- Ca 2: app bị tắt hẳn, mở lại từ gốc ----
  await page.close();
  await sleep(3500);
  const p2 = await ctx.newPage();
  await p2.goto(`${URL_GOC}/`);
  await p2.waitForSelector('.lobby-chat', { timeout: 15000 }).catch(() => {});
  await sleep(2000);
  const nk2 = await p2.evaluate(() => window.__khung);
  if (process.env.CHI_TIET) console.log(nk2, await p2.evaluate(() => window.__nk));
  const truoc = nk2.filter((x) => x.s !== 'phong-cho' && x.s !== 'trong');
  ket(nk2.some((x) => x.s === 'phong-cho'), 'mở lại từ gốc: vào thẳng phòng chờ');
  ket(!truoc.length, `mở lại từ gốc: ${truoc.length ? 'thấy ' + truoc.map((x) => x.s).join(', ') + ' trước' : 'không thấy màn trung gian nào'}`);
  ket(await p2.evaluate((c) => location.search.includes(`room=${c}`), code), 'URL mang lại ?room=');

  // ---- Ca 3: phiên lưu từ BẢN CŨ (chưa có ảnh phòng) — không spinner, không chữ ----
  await p2.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mm.online'));
    delete s.phong; delete s.id; delete s.ban;
    localStorage.setItem('mm.online', JSON.stringify(s));
  });
  await p2.close();
  const p3 = await ctx.newPage();
  await p3.goto(`${URL_GOC}/`);
  await p3.waitForSelector('.lobby-chat', { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const k3 = await p3.evaluate(() => window.__khung);
  const xau3 = k3.filter((x) => /[A-Z]/.test(x.s));
  ket(!xau3.length && k3.some((x) => x.s === 'phong-cho'),
    `phiên bản cũ mở lại: ${xau3.length ? 'THẤY ' + xau3.map((x) => x.s).join(', ') : 'không màn chờ, vào phòng'}`);

  // ---- Ca 4: mở lại app GIỮA VÁN — bàn hiện ngay, không màn chờ ----
  const khach = new WebSocket(`${URL_GOC.replace('http', 'ws')}/ws/${code}?name=Mai&pv=1&bv=2`);
  await new Promise((r) => { khach.onopen = r; });
  const giuSong = setInterval(() => khach.send(JSON.stringify({ t: 'alive' })), 3000);
  khach.send(JSON.stringify({ t: 'ready', ready: true }));
  await sleep(1200);
  await p3.locator('.btn-primary').last().click();
  await p3.waitForSelector('.board-wrap .card', { timeout: 15000 });
  await sleep(6000);   // qua đếm ngược, ván chạy thật
  await p3.evaluate(() => { window.__an = true; document.dispatchEvent(new Event('visibilitychange')); });
  await p3.close();
  const p4 = await ctx.newPage();
  await p4.goto(`${URL_GOC}/`);
  await p4.waitForSelector('.board-wrap .card', { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const k4 = await p4.evaluate(() => window.__khung);
  const xau4 = k4.filter((x) => x.s !== 'ban-choi' && x.s !== 'trong');
  ket(k4.some((x) => x.s === 'ban-choi') && !xau4.length,
    `mở lại giữa ván: ${xau4.length ? 'THẤY ' + xau4.map((x) => x.s).join(', ') : 'bàn hiện thẳng, không màn chờ'}`);
  clearInterval(giuSong);
  khach.close();
  await p4.close();

  // ---- Ca 5: danh sách phòng TRỐNG tự làm mới — không nháy khung xám ----
  const ctx5 = await trinh.newContext({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });
  await ctx5.addInitScript(() => {
    window.__xam = 0; let co = false;
    const mau = () => {
      const nay = !!document.querySelector('.room.sk');
      if (nay && !co) window.__xam++;
      co = nay; requestAnimationFrame(mau);
    };
    requestAnimationFrame(mau);
  });
  const p5 = await ctx5.newPage();
  await p5.route('**/api/rooms/public', (r) => r.fulfill({ json: { rooms: [] } }));
  await p5.goto(`${URL_GOC}/?online=1`);
  await sleep(12500);   // hơn hai nhịp làm mới 5 giây
  const xam = await p5.evaluate(() => window.__xam);
  ket(xam <= 1, `danh sách trống 12 giây: khung xám hiện ${xam} lần (chỉ được lần tải đầu)`);
  await ctx5.close();
} finally {
  await dong();
}
console.log(loi ? `\n${loi} LỖI` : '\nXONG — không nháy.');
process.exit(loi ? 1 : 0);
