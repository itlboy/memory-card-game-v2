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
import { webkit } from 'playwright';

const URL_GOC = process.argv[2] ?? 'http://127.0.0.1:18438';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let loi = 0;
const ket = (ok, msg) => { console.log(ok ? '✓' : '✗', msg); if (!ok) loi++; };

const trinh = await webkit.launch();
const dong = async () => { try { await trinh.close(); } catch { /* đã đóng */ } };
process.on('SIGINT', async () => { await dong(); process.exit(130); });
process.on('SIGTERM', async () => { await dong(); process.exit(143); });

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
    const ghi = () => {
      const s = document.querySelector('.lobby-chat') ? 'phong-cho'
        : document.querySelector('.vao-lai') ? 'dang-vao-lai'
        : document.querySelector('.online') ? 'man-online-khac'
        : document.querySelector('#app')?.children.length ? 'man-khac' : 'trong';
      if (window.__nk.at(-1)?.s !== s) window.__nk.push({ s, t: Math.round(performance.now()) });
    };
    new MutationObserver(ghi).observe(document, { subtree: true, childList: true, attributes: true });
    // Thứ THẬT SỰ được vẽ: lấy mẫu mỗi khung hình (MutationObserver thấy cả trạng
    // thái trung gian chưa bao giờ lên màn).
    window.__khung = [];
    const mau = () => {
      const s = document.querySelector('.lobby-chat') ? 'phong-cho'
        : document.querySelector('.vao-lai') ? 'dang-vao-lai'
        : document.querySelector('.online') ? 'man-online-khac'
        : document.querySelector('#app')?.children.length
          ? 'man-khac:' + [...document.querySelector('#app').querySelectorAll(':scope > *, main > *')].map((e) => e.className).join('|').slice(0, 120)
          : 'trong';
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
} finally {
  await dong();
}
console.log(loi ? `\n${loi} LỖI` : '\nXONG — không nháy.');
process.exit(loi ? 1 : 0);
