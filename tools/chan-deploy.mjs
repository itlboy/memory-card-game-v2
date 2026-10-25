/**
 * CHỐT CHẶN DEPLOY (25.10.2026): chỉ code đã nằm trên `main` mới được lên worker chính.
 *
 * Vì sao: Cloudflare Workers Builds có trigger "Deploy non-production branches" chạy
 * `wrangler deploy` cho MỌI nhánh trừ main → mỗi lần đẩy `develop` là bản chính bị đè bằng
 * code develop, gói OTA mang sha develop, app vừa cài từ store (sha main) lại tải OTA.
 * Chặn ở đây thì trigger đó, phiên Claude khác hay `pnpm release` lỡ chạy từ develop đều đỏ.
 * Khẩn cấp thật: `CHO_DEPLOY=1`.
 */
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const dung = (ly) => { console.error(`✗ Chặn deploy: ${ly}\n  Deploy từ worktree sạch ở origin/main (xem CLAUDE.md). Khẩn cấp: CHO_DEPLOY=1`); process.exit(1); };

if (process.env.CHO_DEPLOY !== '1') {
  const nhanCi = process.env.WORKERS_CI_BRANCH;            // Cloudflare Workers Builds đặt biến này
  if (nhanCi !== undefined) {
    if (nhanCi !== 'main') dung(`build Cloudflare của nhánh "${nhanCi}" không được đè bản chính`);
  } else {
    try { git('fetch', '-q', 'origin', 'main'); } catch { dung('không fetch được origin/main để kiểm'); }
    try { git('merge-base', '--is-ancestor', 'HEAD', 'FETCH_HEAD'); } catch { dung('HEAD chưa nằm trên origin/main'); }
    if (git('status', '--porcelain', '--untracked-files=no')) dung('còn thay đổi chưa commit');
  }
}
