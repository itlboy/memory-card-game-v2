import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Luật deploy của Worker gộp (web + phòng online trong MỘT Worker).
 *
 * Vì sao test nằm ở apps/web: đây là package duy nhất có vitest chạy trong
 * `pnpm test`. Nội dung nó kiểm là apps/server/wrangler.jsonc.
 *
 * Vì sao phải kiểm: sai ở đây KHÔNG có gì báo đỏ. Bỏ run_worker_first thì SPA
 * fallback trả index.html cho /api/rooms — client nhận HTML, `res.json()` ném
 * lỗi lúc chạy, và chỉ người chơi thấy.
 */
const raw = readFileSync(resolve(process.cwd(), '../server/wrangler.jsonc'), 'utf8');
// jsonc: bỏ comment dòng trước khi parse
const cfg = JSON.parse(raw.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n'));

describe('cấu hình deploy Worker gộp', () => {
  it('Worker phục vụ web đã build', () => {
    expect(cfg.assets?.directory).toBe('../web/dist');
    expect(cfg.main).toBeTruthy();
  });

  it('/api và /ws PHẢI vào Worker, không bị SPA fallback nuốt', () => {
    const first: string[] = cfg.assets?.run_worker_first ?? [];
    expect(first).toContain('/api/*');
    expect(first).toContain('/ws/*');
  });

  it('đường dẫn không khớp file nào thì trả index.html (app một trang)', () => {
    expect(cfg.assets?.not_found_handling).toBe('single-page-application');
  });

  it('Durable Object vẫn ở Worker — Pages không đặt được DO', () => {
    expect(cfg.durable_objects?.bindings?.[0]?.class_name).toBe('RoomDO');
    expect(cfg.migrations?.[0]?.new_sqlite_classes).toContain('RoomDO');
  });

  it('KHÔNG bật Workers Cache — bật là request file tĩnh chuyển thành có phí', () => {
    expect(raw).not.toMatch(/"cache"\s*:/);
  });
});
