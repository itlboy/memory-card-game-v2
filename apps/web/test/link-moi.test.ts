import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { maPhongTuLink } from '@/lib/link-moi';

/**
 * LINK MỜI MỞ THẲNG APP: ba nơi phải khớp nhau — file xác minh trên web
 * (public/.well-known), khai báo trong app (AndroidManifest, App.entitlements),
 * và mã định danh app (khác nhau giữa hai nền, xem CLAUDE.md).
 */
const goc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const HOSTS = ['flipmatch.cozypi.com', 'flipmatch.hello314.com', 'thebai.hello314.com'];

describe('mã phòng từ link', () => {
  it('đọc đúng ?room=6 số, bỏ thứ khác', () => {
    expect(maPhongTuLink('https://flipmatch.cozypi.com/?room=123456')).toBe('123456');
    expect(maPhongTuLink('https://flipmatch.cozypi.com/?room=12345')).toBeNull();
    expect(maPhongTuLink('https://flipmatch.cozypi.com/privacy.html')).toBeNull();
    expect(maPhongTuLink('rác')).toBeNull();
  });
});

describe('Android App Links', () => {
  it('assetlinks.json trỏ đúng package Android', () => {
    const j = JSON.parse(goc('public/.well-known/assetlinks.json'));
    expect(j[0].target.package_name).toBe('com.cozypi.flipmatch');
    expect(goc('android/app/build.gradle')).toContain('com.cozypi.flipmatch');
    for (const fp of j[0].target.sha256_cert_fingerprints) expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
  it('manifest khai đủ host, autoVerify, chỉ đường "/"', () => {
    const m = goc('android/app/src/main/AndroidManifest.xml');
    expect(m).toContain('android:autoVerify="true"');
    expect(m).toContain('android:path="/"');
    for (const h of HOSTS) expect(m).toContain(`android:host="${h}"`);
  });
});

describe('iOS Universal Links', () => {
  it('entitlements khai đủ host', () => {
    const e = goc('ios/App/App/App.entitlements');
    for (const h of HOSTS) expect(e).toContain(`applinks:${h}`);
  });
  it('apple-app-site-association trỏ đúng bundle iOS, chỉ nhận ?room=', () => {
    const p = 'public/.well-known/apple-app-site-association';
    if (!existsSync(resolve(process.cwd(), p))) return;   // thêm ở bước 2 (cần Team ID)
    const j = JSON.parse(goc(p));
    const d = j.applinks.details[0];
    expect(d.appIDs[0]).toMatch(/^[A-Z0-9]{10}\.com\.hello314\.flipmatch$/);
    expect(d.components[0]['?']).toEqual({ room: '??????' });
  });
});
