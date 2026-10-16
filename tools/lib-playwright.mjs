// Mở trình duyệt Playwright (WebKit / Chromium) cho công cụ đo — MỘT cửa, để không bao giờ để
// lại trình duyệt mồ côi (anh em của lib-chrome.mjs, dùng cho công cụ CDP). 16.10.2026 chủ dự
// án thấy "Chrome vẫn bật" sau các lần đo → xử lý triệt để:
//   1. Trình duyệt CHẠY ẨN của Playwright (chromium headless shell / webkit) — KHÔNG dùng
//      `channel: 'chrome'` (Chrome thật của máy: hiện icon trên Dock, dễ lẫn với Chrome đang dùng).
//   2. Tắt khi script xong, lỗi, Ctrl+C, SIGTERM (handler exit + tín hiệu).
//   3. kill -9 thì không handler nào chạy → TIẾN TRÌNH CANH tách rời: cha chết là giết hết
//      tiến trình con cháu của trình duyệt (pid ghi lại ngay sau khi mở).
//   4. Lúc mở, dọn trình duyệt Playwright mồ côi (cha = 1) của lần chạy trước.
// Script ad-hoc trong tools/ (kể cả file tạm `.t.mjs`) CŨNG phải mở trình duyệt qua đây.
import { spawn, execFileSync } from 'node:child_process';

const DAU_HIEU = /ms-playwright|playwright-core|pw_run\.sh|MiniBrowser|WebKitWebProcess|WebKitNetworkProcess|chrome-headless-shell/;

function bangTienTrinh() {
  try {
    return execFileSync('ps', ['-axo', 'pid=,ppid=,args='], { encoding: 'utf8' }).split('\n')
      .map((d) => d.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
      .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), lenh: m[3] }));
  } catch { return []; }
}

/** Con cháu của `goc` (không gồm `goc`). */
function conChau(goc) {
  const ds = bangTienTrinh();
  const ket = []; const hang = [goc];
  while (hang.length) {
    const p = hang.shift();
    for (const t of ds) if (t.ppid === p) { ket.push(t.pid); hang.push(t.pid); }
  }
  return ket;
}

function donMoCoi() {
  for (const t of bangTienTrinh()) {
    if (t.ppid === 1 && DAU_HIEU.test(t.lenh)) { try { process.kill(t.pid); } catch { /* đã tắt */ } }
  }
}

/**
 * @param {'webkit'|'chromium'|'firefox'} loai
 * @param {import('playwright').LaunchOptions} [tuyChon]  — `channel` bị bỏ qua (không dùng Chrome thật)
 */
export async function moTrinhDuyet(loai = 'webkit', tuyChon = {}) {
  donMoCoi();
  const pw = await import('playwright');
  const { channel: _boQua, ...con } = tuyChon;
  const truoc = new Set(conChau(process.pid));
  const trinh = await pw[loai].launch({ headless: true, ...con });
  const pids = conChau(process.pid).filter((p) => !truoc.has(p));
  if (pids.length) {
    spawn('/bin/sh', ['-c', `while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done; kill ${pids.join(' ')} 2>/dev/null; sleep 2; kill -9 ${pids.join(' ')} 2>/dev/null`],
      { detached: true, stdio: 'ignore' }).unref();
  }
  const giet = () => { for (const p of pids) { try { process.kill(p); } catch { /* đã tắt */ } } };
  process.on('exit', giet);
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(s, async () => { try { await trinh.close(); } catch { /* bỏ qua */ } process.exit(130); });
  }
  return trinh;
}
