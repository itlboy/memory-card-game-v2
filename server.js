#!/usr/bin/env node
/**
 * Web server tĩnh cho bản build production — Node thuần, không dependency.
 *
 * Dùng:  pnpm build && node server.js [port]        (mặc định 3001)
 * Thư mục gốc mặc định là apps/web/dist, đổi bằng biến môi trường MM_ROOT.
 *
 * Khi phát triển hãy dùng `pnpm dev` (Vite) để có HMR.
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.argv[2] || process.env.PORT || 3001);
const ROOT = path.resolve(__dirname, process.env.MM_ROOT ?? 'apps/web/dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (req, res) => {
  const send = (code, body, headers = {}) => {
    res.writeHead(code, { 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(400, 'Bad Request');
  }

  // Chặn path traversal: mọi đường dẫn phải nằm trong ROOT
  const target = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return send(403, 'Forbidden');

  try {
    let file = target;
    if ((await fsp.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const stat = await fsp.stat(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Content-Length': stat.size };

    console.log(`${req.method} ${urlPath} → 200`);
    if (req.method === 'HEAD') return send(200, null, headers);
    res.writeHead(200, { 'Cache-Control': 'no-store', ...headers });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.log(`${req.method} ${urlPath} → ${err.code === 'ENOENT' ? 404 : 500}`);
    if (err.code !== 'ENOENT') return send(500, 'Server Error');
    // SPA fallback: đường dẫn không có phần mở rộng thì trả về index.html
    if (!path.extname(urlPath)) {
      try {
        const html = await fsp.readFile(path.join(ROOT, 'index.html'));
        return send(200, html, { 'Content-Type': MIME['.html'] });
      } catch { /* chưa build */ }
    }
    send(404, 'Not Found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Port ${PORT} đang bị chiếm. Thử: node server.js ${PORT + 1}`);
    process.exit(1);
  }
  throw err;
});

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`✗ Không thấy ${path.join(ROOT, 'index.html')} — hãy chạy: pnpm build`);
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`▸ Lật Thẻ (bản build): http://127.0.0.1:${PORT}  (Ctrl+C để dừng)`);
});
