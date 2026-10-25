/**
 * MÃ GÓI CẬP NHẬT NÓNG — MỘT hàm cho CẢ HAI chỗ phải khớp nhau (18.10.2026):
 *  - `apps/web/vite.config.ts` → `__OTA_ID__` nhúng vào gói web (app CI build iOS/Android nhúng mã này);
 *  - `tools/dong-goi-ota.mjs`  → `id` trong `/ota/manifest.json` trên server.
 *
 * Mã theo NỘI DUNG NGUỒN (`<version>-<10 ký tự>`, 25.10.2026): băm các tree git của `NGUON_GOI` ở HEAD.
 * Trước đó theo sha COMMIT → commit chỉ sửa server/công cụ cũng đổi mã: máy tải lại gói y hệt, mà
 * mobile.yml (lọc theo đường dẫn) không ra bản app đi kèm → app vừa cài từ store vẫn cập nhật nóng
 * (chủ dự án báo). Đọc tree ở HEAD nên chạy được cả trên clone nông của CI. App và server dựng từ
 * CÙNG nội dung thì CÙNG mã → app mới cài không tự tải lại một gói giống hệt nội dung nó đang có
 * (chủ dự án hỏi: "đẩy cùng bản OTA và app thì app vào luôn phải update lại OTA à?" — trước đây
 * đúng là vậy, vì giờ build của CI và của `pnpm release` không bao giờ trùng, và tên file Vite
 * cũng khác giữa hai máy nên lượt tải đó vài MB).
 *
 * Mã nguồn có thay đổi CHƯA COMMIT (trong các thư mục dựng nên gói) → thêm đuôi giờ build: nội
 * dung khác commit thì mã cũng phải khác, không thì máy đang chạy commit đó sẽ bỏ qua bản này.
 * Không có git (gói nguồn tải về) → về mã theo giờ như cũ. `OTA_ID=<chuỗi>` vẫn ép được.
 *
 * App chỉ so mã BẰNG NHAU (lib/ota.ts), không so thứ tự → đổi định dạng mã an toàn với app cũ.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const GOC = new URL('..', import.meta.url).pathname;
/** Thư mục/tệp dựng nên gói web — thay đổi chưa commit ở đây làm mã mang đuôi giờ. */
export const NGUON_GOI = ['apps/web/src', 'apps/web/public', 'apps/web/index.html', 'apps/web/vite.config.ts', 'apps/web/package.json', 'packages', 'pnpm-lock.yaml'];

const git = (args) => {
  try { return execFileSync('git', args, { cwd: GOC, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};

export function maGoiOta(env = process.env) {
  if (env.OTA_ID) return env.OTA_ID;
  const version = JSON.parse(readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8')).version;
  const gio = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const cay = git(['rev-parse', ...NGUON_GOI.map((d) => `HEAD:${d}`)]);
  if (!cay) return `${version}-${gio}`;
  const sha = createHash('sha1').update(cay).digest('hex').slice(0, 10);
  const ban = git(['status', '--porcelain', '--untracked-files=no', '--', ...NGUON_GOI]);
  return ban ? `${version}-${sha}-${gio}` : `${version}-${sha}`;
}
