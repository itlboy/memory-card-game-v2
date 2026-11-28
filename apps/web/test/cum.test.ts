import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CỤM NHIỀU POD (28.11.2026, apps/node-server/src/cum.ts). Thử thật ở `tools/smoke-cum.mjs` (cần Redis + MySQL);
 * ở đây canh các luật mà sai thì KHÔNG có gì báo đỏ ngay — chỉ lộ ra khi deploy giữa giờ đông người.
 */
const doc = (f: string): string => readFileSync(resolve(process.cwd(), '../node-server', f), 'utf8');
const idx = doc('src/index.ts');
const cum = doc('src/cum.ts');

describe('cụm nhiều pod', () => {
  it('tắt êm: GHI xong → NHẢ phòng → rồi mới đóng socket (máy nối lại phải gặp khoá đã trống)', () => {
    const a = idx.indexOf('kho?.dayNgay()', idx.indexOf("for (const tin of ['SIGTERM'"));
    const b = idx.indexOf('cum.nha(code)', a);
    const c = idx.indexOf("c.close(1012, 'restart')", b);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('có Redis mà không có MySQL / không nối được Redis thì DỪNG, không chạy kiểu một pod', () => {
    expect(idx).toMatch(/cum && !kho\) \{[\s\S]{0,200}process\.exit\(1\)/);
    expect(idx).toMatch(/moCum\([\s\S]{0,300}process\.exit\(1\)/);
  });

  it('mất khoá phòng thì bỏ phòng ngay và thôi ghi kho (box.nha)', () => {
    const at = idx.indexOf('function boPhong(');
    const than = idx.slice(at, idx.indexOf('\n}', at));
    expect(than).toMatch(/box\.nha\(\)/);
    expect(than).toMatch(/kho\?\.quen\(code\)/);
  });

  it('gia hạn chỉ khi khoá còn là của mình; giành khoá pod chết phải so đúng id cũ', () => {
    expect(cum).toMatch(/redis\.call\('GET', k\) == ARGV\[1\]/);
    expect(cum).toMatch(/LUA_CUOP[\s\S]{0,120}redis\.call\('GET', KEYS\[1\]\) == ARGV\[1\]/);
    expect(cum).toMatch(/'NX'\)\) return true/);
  });

  it('request đã chuyển một lần thì không chuyển tiếp nữa (hai pod đá bóng khi khoá đổi chủ)', () => {
    expect(idx).toMatch(/return daChuyen \? 'ban' : chu/);
  });

  it('đường nội bộ /_noi/ cần khoá và không bao giờ nhận request qua tunnel', () => {
    expect(idx).toMatch(/x-lt-noi'\] !== NOI_KEY \|\| req\.headers\['cf-connecting-ip'\]/);
  });

  it('phòng mới giao theo máy ít phòng nhất (tunnel dồn request vào một pod) + đếm tạm khi giao', () => {
    expect(idx).toMatch(/cum && !daChuyen\(req\)\) \{\s*const chon = chonPod\(await cum\.podSong\(\)\);\s*if \(chon\) await cum\.daGiao/);
  });

  it('thông báo "phòng mới" chỉ một lần cho cả cụm', () => {
    expect(idx).toMatch(/cum\.lanDau\('bao'/);
  });

  it('vá cột MySQL có khoá — hai pod khởi động cùng lúc không đập nhau', () => {
    const k = doc('src/kho-mysql.ts');
    expect(k).toMatch(/GET_LOCK\('lt_kho_mo'/);
    expect(k).toMatch(/RELEASE_LOCK\('lt_kho_mo'\)/);
  });
});
