// Mở Chrome headless cho các công cụ đo/chụp — MỘT cửa, để không bao giờ để lại Chrome mồ côi.
// Từng sót thật: chrome.kill() chỉ ở cuối luồng suôn sẻ, Node không chạy 'exit' khi nhận tín hiệu,
// và kill -9 thì không handler nào chạy — Chrome nằm lại hàng chục tiếng, hiện thêm biểu tượng trên Dock.
// Ba lớp: (1) handler exit + tín hiệu; (2) tiến trình canh tách rời, cha chết kiểu gì cũng tắt Chrome;
// (3) lúc mở, dọn Chrome mồ côi (cha đã chết) của lần chạy trước.
import { spawn, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Mọi profile của công cụ đều nằm dưới tiền tố này (mm-cdp-*, mm-shot-*, mm-icon-*, mm-splash-*).
const TIEN_TO = '/tmp/mm-';

function donMoCoi() {
  let ds = '';
  try { ds = execFileSync('ps', ['-axo', 'pid=,ppid=,args='], { encoding: 'utf8' }); } catch { return; }
  for (const dong of ds.split('\n')) {
    const m = dong.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m || m[2] !== '1') continue; // còn cha thì là của một lần chạy đang sống
    if (!m[3].includes('--headless') || !m[3].includes(`--user-data-dir=${TIEN_TO}`)) continue;
    try { process.kill(Number(m[1])); } catch { /* đã tắt */ }
  }
}

export function moChrome(bin, args, profile) {
  if (!profile.startsWith(TIEN_TO)) throw new Error(`profile phải bắt đầu bằng ${TIEN_TO}`);
  donMoCoi();
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(bin, args, { stdio: 'ignore' });
  // Tiến trình canh: sống tách khỏi Node, nên cả kill -9 cũng không bỏ sót Chrome.
  spawn('/bin/sh', ['-c',
    `while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done; kill ${chrome.pid} 2>/dev/null; sleep 2; rm -rf '${profile}'`],
  { detached: true, stdio: 'ignore' }).unref();
  process.on('exit', () => { chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome còn ghi — tiến trình canh xoá sau */ } });
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => process.exit(130)); // tín hiệu không chạy 'exit'
  return chrome;
}
