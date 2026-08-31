/**
 * Typecheck CHO RIÊNG node-server.
 *
 * Vì sao phải có script riêng thay vì gọi thẳng `tsc --noEmit`: node-server nạp
 * `apps/server/src/room.ts` (dùng CHUNG luật phòng, xem CLAUDE.md), mà file đó
 * viết cho Cloudflare Workers — `DurableObjectNamespace`, `WebSocketPair`,
 * `deserializeAttachment`… chỉ có type ở apps/server, nơi tsconfig nạp
 * `@cloudflare/workers-types`. Gọi tsc ở đây là room.ts nhả ra một loạt lỗi
 * GIẢ, và chính vì thế node-server bị bỏ hẳn khỏi `pnpm typecheck` — nên mọi
 * lỗi kiểu THẬT trong `kho-mysql.ts`, `cf-shim.ts`, `index.ts` đều lọt.
 *
 * Script này chạy tsc rồi chỉ giữ lỗi của file TRONG src/ của node-server.
 * room.ts vẫn được kiểm đầy đủ — ở apps/server, đúng chỗ có type của nó.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const kq = spawnSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', cwd: import.meta.dirname });
const dong = (kq.stdout ?? '').split('\n');
const cuaMinh = dong.filter((l) => /^src[/\\]/.test(l));

/*
 * Lỗi đã biết và CỐ Ý bỏ qua — cùng một gốc: room.ts viết cho Workers.
 *
 * Nhận diện bằng CHÍNH DÒNG CODE tại chỗ lỗi, không bằng lời thông báo: thông
 * báo của tsc chỉ nói "Expected 1 arguments, but got 4", không nhắc tên hàm
 * nào — lọc theo lời thông báo là nuốt luôn mọi lỗi TS2554 khác về sau.
 */
const BO_QUA_DONG = [
  // Gọi webSocketClose với 4 tham số (chữ ký Workers); kiểu room.ts thấy ở đây
  // chỉ có 1 — bản Workers mới là bản đúng.
  /webSocketClose/,
  // MmSocket là bản bọc quanh `ws`, cố ý không đủ mặt của WebSocket trình duyệt.
  /new MmSocket|as unknown as/
];
const doc = new Map();
const dongCode = (tep, so) => {
  if (!doc.has(tep)) {
    try { doc.set(tep, readFileSync(join(import.meta.dirname, tep), 'utf8').split('\n')); }
    catch { doc.set(tep, []); }
  }
  return doc.get(tep)[so - 1] ?? '';
};
const that = cuaMinh.filter((l) => {
  const m = /^(src[/\\][^(]+)\((\d+),/.exec(l);
  if (!m) return true;
  const code = dongCode(m[1], Number(m[2]));
  return !BO_QUA_DONG.some((r) => r.test(code));
});

if (that.length) {
  console.error('Lỗi kiểu trong node-server:');
  for (const l of that) console.error('  ' + l);
  process.exit(1);
}
console.log(`Done (bỏ qua ${cuaMinh.length - that.length} lỗi đã biết của tầng dịch Workers→Node)`);
