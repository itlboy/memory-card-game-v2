import { build } from 'esbuild';

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
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['ws'],
  alias: { 'cloudflare:workers': './src/cf-shim.ts' },
  define: {
    Response: 'globalThis.__mmResponse',
    WebSocketPair: 'globalThis.__mmPair',
    WebSocketRequestResponsePair: 'globalThis.__mmPairRR'
  }
});
console.log('đã gói: dist/server.mjs');
