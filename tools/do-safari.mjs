/**
 * ĐO TRÊN WEBKIT (engine của Safari / mọi trình duyệt iPhone) — `pnpm do:safari [url]`.
 *
 * Vì sao có: mọi công cụ đo khác chạy Chrome, mà Chrome hỗ trợ thứ Safari KHÔNG có
 * (`overflow-clip-margin`…). Lỗi "cạnh nút bị cắt" ở Đêm Sao / Kẹo Bông / Gỗ (15.10.2026)
 * Chrome đo xanh, iPhone thì hỏng — WebKit của Playwright tái hiện đúng y ảnh chụp máy thật.
 *
 * Chạy: 3 khổ VÙNG WEB iPhone (SE · 14 · Pro Max, CLAUDE.md) × 5 skin × các màn chính.
 * Mỗi màn dò ba loại lỗi, có lỗi là mã thoát 1:
 *   · CẮT — viền/bóng (box-shadow) của một phần tử nằm TRỌN trong khung cắt (overflow
 *     khác visible) nhưng phần trang trí tràn ra và bị cắt phẳng (đúng lỗi 15.10.2026);
 *   · LÒI — nút/ô bấm được thò ra ngoài màn hình (luật KHÔNG SCROLL: nút chính bị đẩy ra);
 *   · CUỘN — cả trang cao hơn màn hình.
 * Ảnh từng màn ở OUT (mặc định /tmp/mm-safari) để soi bằng mắt.
 *
 * KHÔNG bắt được: lỗi lớp GPU chỉ có trên iPhone thật (ô trắng khi thiếu bộ nhớ) — vẫn
 * phải xem máy thật / video (CLAUDE.md "Lỗi hình chỉ có trên iPhone").
 *
 * Lần đầu: `pnpm exec playwright install webkit` (~100 MB, ở ~/Library/Caches/ms-playwright).
 * Cần web đang chạy (`pnpm dev` → :3001, hoặc dist). Lọc nhanh: SKINS=sao,go MAY=se.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { webkit, devices } from 'playwright';

const URL_APP = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '');
const OUT = process.env.OUT ?? '/tmp/mm-safari';
const SKINS = process.env.SKINS?.split(',') ?? ['keo', 'neon', 'go', 'sao', 'bong'];
const MAY_ALL = { se: [375, 553], ip14: [390, 664], promax: [430, 745] };
const MAY = process.env.MAY?.split(',') ?? Object.keys(MAY_ALL);
mkdirSync(OUT, { recursive: true });

/* Dò lỗi trong trang. Bóng đo theo phần NHÌN THẤY: spread + lệch + nửa độ nhoè. */
const DO = () => {
  const loi = [];
  const ten = (el) => (el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase())
    + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  const hien = (el, r) => r.width > 2 && r.height > 2 && el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false
    && !el.closest('.sr-only, [aria-hidden="true"]');
  const vuotBong = (bs) => {
    const v = { l: 0, r: 0, t: 0, b: 0 };
    if (!bs || bs === 'none') return v;
    for (const p of bs.split(/,(?![^(]*\))/)) {
      if (/inset/.test(p)) continue;
      const mau = p.match(/rgba?\([^)]*\)/)?.[0] ?? '';
      if (/rgba\([^)]*,\s*0(\.0+)?\)$/.test(mau)) continue;            // trong suốt
      const so = p.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g)?.map(parseFloat) ?? [];
      const [x = 0, y = 0, blur = 0, spread = 0] = so;
      const m = spread + blur / 2;
      v.l = Math.max(v.l, m - x); v.r = Math.max(v.r, m + x);
      v.t = Math.max(v.t, m - y); v.b = Math.max(v.b, m + y);
    }
    return v;
  };
  const W = innerWidth, H = innerHeight;
  // nằm trong một khung CUỘN ĐƯỢC (lưới theme, bản đồ Chiến dịch…): ra ngoài là chuyện cuộn
  const trongKhungCuon = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if ((/auto|scroll/.test(ac.overflowY) && a.scrollHeight > a.clientHeight + 1)
        || (/auto|scroll/.test(ac.overflowX) && a.scrollWidth > a.clientWidth + 1)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!hien(el, r)) continue;
    const cs = getComputedStyle(el);
    // CẮT
    const v = vuotBong(cs.boxShadow);
    if (Math.max(v.l, v.r, v.t, v.b) >= 1.5) {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (ac.overflowX === 'visible' && ac.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        const k = { l: ar.left + a.clientLeft, t: ar.top + a.clientTop };
        k.r = k.l + a.clientWidth; k.b = k.t + a.clientHeight;
        // mép khung trùng mép màn hình: phần bị cắt vốn ở ngoài màn, không ai thấy
        if (k.l <= 0.5) k.l = -1e4; if (k.t <= 0.5) k.t = -1e4;
        if (k.r >= W - 0.5) k.r = 1e4; if (k.b >= H - 0.5) k.b = 1e4;
        // phần tử phải nằm TRỌN trong khung (nằm ngoài một phần = đang cuộn / cố ý giấu)
        if (r.left < k.l - 0.5 || r.right > k.r + 0.5 || r.top < k.t - 0.5 || r.bottom > k.b + 0.5) break;
        // khung cuộn được theo chiều đứng: chỉ xét trái/phải (trên/dưới là chỗ cuộn)
        const cuonDoc = /auto|scroll/.test(ac.overflowY) && a.scrollHeight > a.clientHeight + 1;
        const cat = [];
        if (v.l >= 1.5 && r.left - v.l < k.l - 1) cat.push(`trái ${(k.l - r.left + v.l).toFixed(0)}px`);
        if (v.r >= 1.5 && r.right + v.r > k.r + 1) cat.push(`phải ${(r.right + v.r - k.r).toFixed(0)}px`);
        if (!cuonDoc && v.t >= 1.5 && r.top - v.t < k.t - 1) cat.push(`trên ${(k.t - r.top + v.t).toFixed(0)}px`);
        if (!cuonDoc && v.b >= 1.5 && r.bottom + v.b > k.b + 1) cat.push(`dưới ${(r.bottom + v.b - k.b).toFixed(0)}px`);
        if (cat.length) loi.push(`CẮT ${ten(el)} bởi ${ten(a).split(' "')[0]}: ${cat.join(', ')}`);
        break;   // khung cắt gần nhất là khung quyết định
      }
    }
    // LÒI
    if (el.matches('button, a[href], [role=button], .option, input, select')
      && !trongKhungCuon(el)
      && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1)) {
      loi.push(`LÒI ${ten(el)}: ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} (màn ${W}×${H})`);
    }
  }
  const se = document.scrollingElement;
  if (se.scrollHeight > H + 1) loi.push(`CUỘN cả trang: cao ${se.scrollHeight} > ${H}`);
  return [...new Set(loi)];
};

const browser = await webkit.launch();
const tatHet = async () => { try { await browser.close(); } catch { /* đã đóng */ } };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await tatHet(); process.exit(130); });

const ketQua = [];
let tongLoi = 0;
try {
  for (const may of MAY) {
    const [w, h] = MAY_ALL[may];
    for (const skin of SKINS) {
      const ctx = await browser.newContext({
        ...devices['iPhone 14'], viewport: { width: w, height: h }, deviceScaleFactor: 2,
        serviceWorkers: 'block'   // PWA precache = đo bản cũ (CLAUDE.md, do:menu)
      });
      await ctx.addInitScript(() => {
        if (sessionStorage.getItem('mm.safari')) return;
        sessionStorage.setItem('mm.safari', '1');
        localStorage.clear();
        localStorage.setItem('mm.lang', 'vi'); localStorage.setItem('mm.premium', '1');
        // có tiến độ Chiến dịch để mọi viên/lối tắt trên trang chủ đều hiện
        localStorage.setItem('mm.v2', JSON.stringify({ levels: { 'campaign:1': { stars: 3, best: 500 } } }));
      });
      const p = await ctx.newPage();
      const ve = async () => { await p.goto(`${URL_APP}/?lang=vi&skin=${skin}`); await p.waitForTimeout(1800); };
      const bam = async (chu) => { await p.locator('button, [role=button], .option').filter({ hasText: chu }).first().click({ timeout: 4000 }); await p.waitForTimeout(700); };
      const doMan = async (man) => {
        const loi = await p.evaluate(DO);
        const tag = `${may}-${skin}-${man}`;
        await p.screenshot({ path: `${OUT}/${tag}.png` });
        ketQua.push({ may, skin, man, loi });
        tongLoi += loi.length;
        console.log(`${loi.length ? '✗' : '✓'} ${tag.padEnd(28)}${loi.length ? '\n    ' + loi.slice(0, 8).join('\n    ') + (loi.length > 8 ? `\n    … và ${loi.length - 8} lỗi nữa` : '') : ''}`);
      };
      const buoc = async (ten, fn) => { try { await fn(); } catch (e) { console.log(`  (${may}-${skin}: dừng ở ${ten} — ${e.message.split('\n')[0]})`); } };

      await buoc('trang chủ', async () => { await ve(); await doMan('trang-chu'); });
      await buoc('chơi nhanh', async () => {
        await bam('Chơi nhanh'); await doMan('so-nguoi');
        await bam('Một mình'); await doMan('co-ban');
        await p.locator('.option').filter({ hasText: /^\s*12\s*thẻ/ }).first().click({ timeout: 4000 }); await p.waitForTimeout(600);
        if (await p.getByRole('button', { name: 'Tiếp' }).count()) await bam('Tiếp');
        await doMan('luat-ban');
        await bam('Bắt đầu'); await p.waitForTimeout(2500); await doMan('van-choi');
      });
      await buoc('đấu máy', async () => { await ve(); await bam('Đấu với máy'); await doMan('muc-may'); });
      await buoc('chiến dịch', async () => { await ve(); await bam('Chiến dịch'); await doMan('chien-dich'); });
      await buoc('online', async () => { await ve(); await bam('Chơi online'); await p.waitForTimeout(800); await doMan('online'); });
      await buoc('menu', async () => { await ve(); await p.locator('.topbar [aria-haspopup="menu"]').click(); await p.waitForTimeout(500); await doMan('menu'); });
      await ctx.close();
    }
  }
} finally {
  await tatHet();
}
writeFileSync(`${OUT}/safari.json`, JSON.stringify(ketQua, null, 1));
console.log(`\n${tongLoi ? '✗' : '✓'} ${tongLoi} lỗi trên WebKit · ảnh + chi tiết ở ${OUT}`);
process.exit(tongLoi ? 1 : 0);
