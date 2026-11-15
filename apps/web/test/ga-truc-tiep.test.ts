import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { taoGaTrucTiep } from '../src/lib/ga-truc-tiep';

/**
 * GA4 GỬI THẲNG CHO iOS (15.11.2026): gtag.js huỷ mọi sự kiện ở `capacitor://` → 0 người iOS.
 * Canh đúng tham số (chép từ yêu cầu thật của gtag.js) và luật phiên.
 */
function dung(over: { eu?: boolean; kho?: Map<string, string> } = {}) {
  const urls: URLSearchParams[] = [];
  let t = 1_800_000_000_000;
  const m = over.kho ?? new Map<string, string>();
  const gui = taoGaTrucTiep({
    tid: 'G-TEST123', cid: 'may-1', dl: 'https://flipmatch.cozypi.com/app/ios', eu: !!over.eu,
    up: { nen_tang: 'ios', ban_web: '1.8.1-x' },
    gui: (u) => { urls.push(new URL(u).searchParams); return Promise.resolve(); },
    kho: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } },
    now: () => t
  });
  return { urls, gui, m, troi: (ms: number) => { t += ms; } };
}

describe('GA4 gửi thẳng (iOS)', () => {
  it('lần đầu: page_view mở phiên, có _ss + _fv, đúng mã đo / mã máy / địa chỉ trang', () => {
    const { urls } = dung();
    expect(urls).toHaveLength(1);
    const q = urls[0]!;
    expect(q.get('en')).toBe('page_view');
    expect([q.get('v'), q.get('tid'), q.get('cid'), q.get('dl')]).toEqual(['2', 'G-TEST123', 'may-1', 'https://flipmatch.cozypi.com/app/ios']);
    expect([q.get('_ss'), q.get('_fv'), q.get('sct'), q.get('npa'), q.get('gcs')]).toEqual(['1', '1', '1', '1', 'G101']);
  });

  it('sự kiện: chữ → ep., số → epn., kèm thuộc tính người dùng và thời gian đã xem', () => {
    const { urls, gui, troi } = dung();
    troi(4000);
    gui('van_bat_dau', { nen_tang: 'ios', so_the: 16, co_may: true, bo: undefined });
    const q = urls[1]!;
    expect(q.get('en')).toBe('van_bat_dau');
    expect([q.get('ep.nen_tang'), q.get('epn.so_the'), q.get('ep.co_may'), q.has('ep.bo')]).toEqual(['ios', '16', 'true', false]);
    expect([q.get('up.nen_tang'), q.get('up.ban_web')]).toEqual(['ios', '1.8.1-x']);
    expect(q.get('_et')).toBe('4000');
    expect([q.has('_ss'), q.has('_fv')]).toEqual([false, false]);
    expect(q.get('sid')).toBe(urls[0]!.get('sid'));
  });

  it('xem đủ 10 giây → phiên có tương tác (seg=1)', () => {
    const { urls, gui, troi } = dung();
    troi(4000); gui('a');
    troi(7000); gui('b');
    expect([urls[1]!.get('seg'), urls[2]!.get('seg')]).toEqual(['0', '1']);
  });

  it('quay lại sau 30 phút → phiên MỚI mở bằng page_view, sct tăng, không còn _fv', () => {
    const { urls, gui, troi } = dung();
    troi(31 * 60_000);
    gui('van_bat_dau');
    expect(urls.map((q) => q.get('en'))).toEqual(['page_view', 'page_view', 'van_bat_dau']);
    expect([urls[1]!.get('_ss'), urls[1]!.get('sct'), urls[1]!.has('_fv')]).toEqual(['1', '2', false]);
    expect(urls[1]!.get('sid')).not.toBe(urls[0]!.get('sid'));
  });

  it('mở lại app trong 30 phút → CÙNG phiên (đọc từ kho), không _ss', () => {
    const kho = new Map<string, string>();
    const a = dung({ kho });
    const b = dung({ kho });
    expect(b.urls[0]!.get('sid')).toBe(a.urls[0]!.get('sid'));
    expect(b.urls[0]!.has('_ss')).toBe(false);
  });

  it('châu Âu: không dùng mã máy lưu sẵn, không lưu phiên, không _fv', () => {
    const { urls, m } = dung({ eu: true });
    const q = urls[0]!;
    expect(q.get('cid')).not.toBe('may-1');
    expect(q.get('gcs')).toBe('G100');
    expect(q.has('_fv')).toBe(false);
    expect(m.size).toBe(0);
  });

  it('phan-tich.ts: CHỈ trang không phải http/https mới đi đường gửi thẳng', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/phan-tich.ts'), 'utf8');
    expect(src).toMatch(/if \(!\/\^https\?:\$\/\.test\(location\.protocol\)\) \{\s*kieuGui = 'direct';/);
  });
});
