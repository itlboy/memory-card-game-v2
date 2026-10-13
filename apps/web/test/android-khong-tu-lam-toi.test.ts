import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * APP ANDROID KHÔNG ĐƯỢC ĐỂ HỆ THỐNG TỰ LÀM TỐI WEBVIEW.
 *
 * Người chơi báo 14.10.2026: máy để giao diện tối thì emoji gấu trúc, đám mây,
 * mặt bài trắng đều hoá đen sì — "rất nhiều chỗ". Không phải lỗi từng hình:
 * WebView đảo màu CẢ TRANG (algorithmic darkening / force dark) vì theme để
 * DayNight. Game có chế độ tối riêng nên phải chặn ở gốc, hai lớp:
 *  1. MainActivity tắt tính năng đó trên WebView (Android 13+ và 10–12);
 *  2. theme không phải DayNight và cấm forceDarkAllowed.
 * `cap sync` / nâng Capacitor có thể sinh lại hai file này — test này đỏ là biết.
 */
const android = resolve(__dirname, '../android/app/src/main');

function timFile(dir: string, ten: string): string | null {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const r = timFile(p, ten); if (r) return r; } else if (e.name === ten) return p;
  }
  return null;
}

describe('Android không tự làm tối WebView', () => {
  it('MainActivity tắt algorithmic darkening (13+) và force dark (10–12)', () => {
    const p = timFile(join(android, 'java'), 'MainActivity.java');
    expect(p, 'không thấy MainActivity.java').toBeTruthy();
    const src = readFileSync(p!, 'utf8');
    expect(src).toMatch(/setAlgorithmicDarkeningAllowed\(\s*\w+\s*,\s*false\s*\)/);
    expect(src).toMatch(/setForceDark\(\s*\w+\s*,\s*WebSettingsCompat\.FORCE_DARK_OFF\s*\)/);
  });

  it('theme của activity không phải DayNight và cấm forceDarkAllowed', () => {
    const xml = readFileSync(join(android, 'res/values/styles.xml'), 'utf8');
    const theme = xml.match(/<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?<\/style>/)?.[0] ?? '';
    expect(theme, 'thiếu theme AppTheme.NoActionBar').not.toBe('');
    expect(theme).not.toMatch(/DayNight/);
    expect(theme).toMatch(/android:forceDarkAllowed"[^>]*>false</);
  });
});
