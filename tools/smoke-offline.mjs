// Tái hiện MẤT MẠNG thật: hai trình duyệt trong một phòng, cắt mạng một bên bằng
// Playwright setOffline (cắt TCP, KHÔNG sinh sự kiện close — đúng như mất wifi).
//
//   node tools/smoke-offline.mjs        (cần `pnpm dev` đang chạy)
//
// Phải thấy:
//   - bên MẤT MẠNG: "📡 Mất kết nối — đang vào lại…" trong ~2–4 giây, bàn khoá;
//   - bên CÒN MẠNG: "📴 mất mạng" trên chip đối thủ trong ~10 giây (server phát
//     hiện im lặng), và lượt tự chuyển về mình khi hết 15 giây;
//   - nối lại mạng: cả hai đồng bộ lại trong vài giây, không mất thẻ nào.
//
// Cảnh HỎNG đã từng gặp: bên mất mạng thấy bàn đóng băng (thẻ vẫn mở, đồng hồ
// lượt đếm về 0 rồi đứng) mà KHÔNG có thông báo gì — người chơi tưởng game hỏng.
import { createRequire } from 'node:module';
const require = createRequire('/Users/KienNT/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
const b = await chromium.launch({ channel: 'chrome' });
const ctxA = await b.newContext({ viewport: { width: 420, height: 820 } });
const ctxB = await b.newContext({ viewport: { width: 420, height: 820 } });
const A = await ctxA.newPage(), B = await ctxB.newPage();
for (const [p, t] of [[A, 'A'], [B, 'B']]) p.on('pageerror', (e) => log(`${t} LỖI: ${String(e).slice(0, 70)}`));

const tinh = (p) => p.evaluate(() => {
  const t = document.body.innerText;
  return {
    bao: (t.match(/(Mất kết nối[^\n]*|Mạng chậm[^\n]*|Bàn không phản hồi[^\n]*|📴[^\n]*|📡[^\n]*)/) ?? [null])[0],
    luot: document.querySelector('.pchip.active')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 24) ?? '?',
    chip: [...document.querySelectorAll('.pchip')].map((c) => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 22)),
    mo: document.querySelectorAll('.card.up:not(.done)').length,
    conLai: document.querySelectorAll('.card:not(.done):not(.blank)').length,
    xong: /Chơi lại|Về menu/.test(t)
  };
});

// --- A tạo phòng ---
await A.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
await A.locator('.option').nth(3).click(); await A.waitForTimeout(350);
await A.locator('.option').nth(0).click(); await A.waitForTimeout(450);
await A.locator('input').first().fill('An');
await A.getByRole('button', { name: 'Tiếp tục' }).click(); await A.waitForTimeout(500);
await A.locator('.option').first().click(); await A.waitForTimeout(450);          // Cổ điển
await A.locator('.node:not(.locked)').nth(2).click(); await A.waitForTimeout(450);  // cấp 3 = 12 thẻ
await A.locator('.btn-primary').first().click(); await A.waitForTimeout(1300);
const code = await A.evaluate(() => document.body.innerText.match(/\b[A-Z0-9]{6}\b/)?.[0]);
log('phòng', code);

// --- B vào phòng ---
await B.goto(`http://localhost:3001/?room=${code}&online=1`, { waitUntil: 'networkidle' });
await B.waitForTimeout(800);
const inputB = await B.locator('input').count();
if (inputB) { await B.locator('input').first().fill('Bình'); await B.getByRole('button', { name: /Tiếp tục|Vào phòng/ }).first().click(); }
await B.waitForTimeout(1200);
await B.getByRole('button', { name: /Sẵn sàng/ }).first().click().catch(() => {});
await B.waitForTimeout(500);
await A.getByRole('button', { name: /Bắt đầu/ }).first().click().catch(() => {});
await A.waitForTimeout(4200);
log('A', JSON.stringify(await tinh(A)));
log('B', JSON.stringify(await tinh(B)));

// --- lật một thẻ rồi CẮT MẠNG người đang tới lượt ---
const luotA = await A.evaluate(() => !!document.querySelector('.board:not(.locked)') &&
  !!document.querySelector('.player.active')?.textContent?.includes('An'));
const [cur, curTen, ctxCur] = luotA ? [A, 'A', ctxA] : [B, 'B', ctxB];
log(`lượt của ${curTen} — lật 1 thẻ rồi cắt mạng giữa lượt`);
await cur.locator('.card:not(.done)').first().click(); await cur.waitForTimeout(600);
await ctxCur.setOffline(true);
log('>>> ĐÃ CẮT MẠNG ' + curTen);
// bấm thêm thẻ thứ hai trong lúc mất mạng — đây là ca người chơi thật gặp
await cur.locator('.card:not(.done)').nth(1).click().catch(() => {});
for (const s of [4, 10, 17, 25]) {
  await cur.waitForTimeout(s === 4 ? 4000 : 6000 + (s === 17 ? 1000 : s === 25 ? 2000 : 0));
  log(`${curTen} offline ${s}s:`, JSON.stringify(await tinh(cur)));
  log(`  bên kia    :`, JSON.stringify(await tinh(curTen === 'A' ? B : A)));
}
log('>>> NỐI LẠI MẠNG');
await ctxCur.setOffline(false);
for (const s of [2, 6]) {
  await cur.waitForTimeout(s === 2 ? 2000 : 4000);
  log(`${curTen} online lại ${s}s:`, JSON.stringify(await tinh(cur)));
}
await cur.screenshot({ path: '/tmp/off-cur.png' });
await b.close();
