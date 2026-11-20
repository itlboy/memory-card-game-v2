import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';

/** Mã commit: biến GIT_SHA (CI truyền qua build-arg vì .dockerignore loại .git), không có thì đọc thẳng .git (build ở máy). */
function maCommit() {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 12);   // CI (Docker không có .git)
  try {
    const goc = new URL('../../.git/', import.meta.url);
    const head = readFileSync(new URL('HEAD', goc), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head.slice(0, 12);
    const ref = head.slice(5);
    const f = new URL(ref, goc);
    if (existsSync(f)) return readFileSync(f, 'utf8').trim().slice(0, 12);
    const dong = readFileSync(new URL('packed-refs', goc), 'utf8').split('\n').find((l) => l.endsWith(' ' + ref));
    return dong ? dong.slice(0, 12) : 'khong-ro';
  } catch { return 'khong-ro'; }
}
/*
 * THÔNG TIN BẢN BUILD cho /api/ping (20.11.2026). CỐ Ý không có giờ build: ảnh Docker được làm cho TRÙNG mã băm
 * khi nội dung không đổi (Dockerfile ghim mtime) — nhét giờ vào là lần build nào cũng ra ảnh mới, Keel khởi động lại
 * server nhà vô cớ. Phiên bản + commit đã đủ định danh.
 */
const BAN_BUILD = {
  ban: JSON.parse(readFileSync(new URL('../web/package.json', import.meta.url), 'utf8')).version,
  commit: maCommit()
};

/**
 * Gói server dự phòng thành MỘT file để chạy bằng `node dist/server.mjs`.
 *
 * Ba phép thay ở đây là toàn bộ chỗ "dịch" Cloudflare → Node. Nhờ chúng mà
 * `apps/server/src/room.ts` được dùng NGUYÊN VẸN, không phải sửa một dòng:
 *
 *  - `cloudflare:workers` không tồn tại ngoài Workers → trỏ sang shim;
 *  - `Response` của Node NÉM LỖI với status 101 (chỉ nhận 200–599), mà 101 là
 *    đúng cách CF trả WebSocket về → đổi sang MmResponse;
 *  - `WebSocketPair` / `WebSocketRequestResponsePair` là API Hibernation, Node
 *    không có → đổi sang bản bọc quanh thư viện `ws`.
 *
 * Thay bằng biến TOÀN CỤC chứ không bằng import: `define` đổi tên định danh
 * trong mọi file được gói (kể cả room.ts), mà room.ts không thể import shim —
 * nó phải chạy được cả trên Workers. index.ts gán các biến này lúc khởi động,
 * trước khi có request nào; room.ts chỉ đọc chúng bên trong hàm nên không có
 * chuyện dùng trước khi gán.
 */
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // `mysql2` cũng để ngoài: nó nạp driver theo nhánh lúc chạy nên gói vào là
  // esbuild kéo theo cả đống thứ không dùng — và server phải chạy được cả khi
  // KHÔNG có nó (không đặt MYSQL_URL thì `import()` không bao giờ chạy).
  external: ['ws', 'mysql2', 'mysql2/promise'],
  alias: { 'cloudflare:workers': './src/cf-shim.ts' },
  define: {
    Response: 'globalThis.__mmResponse',
    WebSocketPair: 'globalThis.__mmPair',
    WebSocketRequestResponsePair: 'globalThis.__mmPairRR',
    __BAN_BUILD__: JSON.stringify(BAN_BUILD)
  }
});
console.log('đã gói: dist/server.mjs');
