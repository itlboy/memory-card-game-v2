// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NGON_NGU } from '@/lib/i18n';
import {
  CACH_MAY_MS, CHU, CHU_GV, TRE_MS, canNhacGioVang, chonNguoiNhan, chuThongBao, dangGioNgu, gioMay, moThongBao, type DangKy
} from '../../node-server/src/thongbao';

/**
 * CHUÔNG "CÓ PHÒNG MỚI" — chống làm phiền ở server, và lớp phủ ở client (không có plugin /
 * server không bật thì chuông KHÔNG được vẽ, game chạy y như cũ).
 */

describe('server: thongbao.ts', () => {
  const UTC_12H = Date.UTC(2026, 10, 18, 12, 0, 0);

  it('giờ ngủ tính theo giờ CỦA MÁY: 12h UTC là 19h ở VN (thức), 22h ở Tokyo+10 (ngủ)', () => {
    expect(dangGioNgu(420, UTC_12H)).toBe(false);
    expect(dangGioNgu(600, UTC_12H)).toBe(true);
    expect(dangGioNgu(-300, Date.UTC(2026, 10, 18, 11, 0))).toBe(true); // 6h sáng New York: còn ngủ
  });

  it('6h59 còn ngủ, 7h00 thức, 21h59 thức, 22h00 ngủ', () => {
    const luc = (h: number, m: number) => Date.UTC(2026, 10, 18, h, m);
    expect(dangGioNgu(0, luc(6, 59))).toBe(true);
    expect(dangGioNgu(0, luc(7, 0))).toBe(false);
    expect(dangGioNgu(0, luc(21, 59))).toBe(false);
    expect(dangGioNgu(0, luc(22, 0))).toBe(true);
  });

  it('mỗi máy tối đa một tin mỗi CACH_MAY_MS, và bỏ máy đang giờ ngủ', () => {
    const may = (token: string, gui_cuoi: number, lech_phut = 0): DangKy =>
      ({ token, nen: 'ios', lang: 'vi', lech_phut, gui_cuoi });
    const ds = [
      may('moi-gui', UTC_12H - 60_000),
      may('lau-roi', UTC_12H - CACH_MAY_MS),
      may('chua-bao-gio', 0),
      may('dang-ngu', 0, 600)
    ];
    expect(chonNguoiNhan(ds, UTC_12H).map((r) => r.token)).toEqual(['lau-roi', 'chua-bao-gio']);
  });

  it('có chữ cho ĐỦ mọi ngôn ngữ của game, có chỗ cho tên chủ phòng', () => {
    for (const l of NGON_NGU) {
      expect(CHU[l.id], l.id).toBeDefined();
      expect(CHU[l.id]!.than, l.id).toContain('{ten}');
    }
    expect(chuThongBao('xx', 'Kiên').than).toContain('Kiên'); // mã lạ → tiếng Anh
  });

  it('thiếu MySQL hoặc thiếu cả APNs lẫn FCM → null (đường /api/thongbao 404)', async () => {
    expect(await moThongBao(null, { APNS_KEY_ID: 'a', APNS_TEAM_ID: 'b', APNS_PRIVATE_KEY: 'c' })).toBeNull();
    expect(await moThongBao({ query: vi.fn() } as never, {})).toBeNull();
  });
});

describe('server: gửi một đợt (FCM giả, MySQL giả)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('chờ TRE_MS · bỏ máy chủ phòng · 404 thì xoá mã · đợt thứ hai trong 10 phút bị chặn', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 18, 5, 0)); // 12h trưa giờ VN
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = JSON.stringify({ client_email: 'x@y', project_id: 'p', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    const may = (token: string) => ({ token, nen: 'android', lang: 'vi', lech_phut: 420, gui_cuoi: 0 });
    const cau: { sql: string; v: unknown[] }[] = [];
    const pool = { query: vi.fn(async (sql: string, v: unknown[] = []) => {
      cau.push({ sql, v });
      return sql.startsWith('SELECT') ? [[may('a'.repeat(30)), may('chu'.repeat(10)), may('chet'.repeat(8))]] : [[]];
    }) };
    const gui: string[] = [];
    const layFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }));
      const tok = (JSON.parse(String(init!.body)) as { message: { token: string } }).message.token;
      gui.push(tok);
      return new Response('{}', { status: tok.startsWith('chet') ? 404 : 200 });
    });
    const tb = (await moThongBao(pool as never, { FCM_SERVICE_ACCOUNT: sa }, layFetch as never))!;
    tb.ghiChuPhong('123456', 'chu'.repeat(10));
    const phong = { code: '123456', chuPhong: 'Kiên', avatar: '', nguoi: 1, toiDa: 4, the: 16, luc: Date.now() };
    tb.phongMoi(phong, async () => true);
    tb.phongMoi(phong, async () => true); // khai lại cùng mã: không đặt lịch lần hai
    await vi.advanceTimersByTimeAsync(TRE_MS - 500);
    expect(gui).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(cau.some((c) => c.sql.startsWith('DELETE'))).toBe(true));
    expect(gui.sort()).toEqual(['a'.repeat(30), 'chet'.repeat(8)]);
    expect(cau.find((c) => c.sql.startsWith('UPDATE'))!.v[1]).toEqual(['a'.repeat(30)]);
    expect(cau.find((c) => c.sql.startsWith('DELETE'))!.v[0]).toEqual(['chet'.repeat(8)]);

    gui.length = 0;
    tb.phongMoi({ ...phong, code: '654321' }, async () => true);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(gui).toEqual([]); // trong 10 phút sau đợt trước
  });

  it('phòng đã đủ người/đóng sau TRE_MS → không gửi gì', async () => {
    vi.useFakeTimers();
    const pool = { query: vi.fn(async () => [[]]) };
    const layFetch = vi.fn();
    const tb = (await moThongBao(pool as never, { APNS_KEY_ID: 'k', APNS_TEAM_ID: 't', APNS_PRIVATE_KEY: 'p' }, layFetch as never))!;
    tb.phongMoi({ code: '111111', chuPhong: 'A', avatar: '', nguoi: 1, toiDa: 2, the: 16, luc: Date.now() }, async () => false);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(pool.query.mock.calls.filter((c) => String(c[0]).startsWith('SELECT') && !String(c[0]).includes('information_schema'))).toEqual([]);
  });
});

describe('server: giờ vàng (nhắc 19:55 theo giờ CỦA MÁY)', () => {
  // 12:55 UTC = 19:55 ở Việt Nam (+420)
  const luc = (h: number, m: number) => Date.UTC(2026, 11, 4, h, m);
  const vn = (o: Partial<{ gv_day: number; seen_at: number }> = {}) => ({ lech_phut: 420, gv_day: 0, seen_at: 0, ...o });

  it('chỉ trong 19:55–20:05 giờ máy; mỗi ngày (địa phương) một lần', () => {
    expect(canNhacGioVang(vn(), luc(12, 54))).toBe(false);
    expect(canNhacGioVang(vn(), luc(12, 55))).toBe(true);
    expect(canNhacGioVang(vn(), luc(13, 4))).toBe(true);
    expect(canNhacGioVang(vn(), luc(13, 5))).toBe(false);
    expect(canNhacGioVang(vn({ gv_day: gioMay(420, luc(12, 55)).ngay }), luc(12, 56))).toBe(false);
    // cùng khoảnh khắc 12:55 UTC, máy ở New York (-300) đang 7:55 sáng → không nhắc
    expect(canNhacGioVang({ lech_phut: -300, gv_day: 0, seen_at: 0 }, luc(12, 55))).toBe(false);
  });

  it('đã mở app từ 19:00 giờ máy hôm đó thì không nhắc', () => {
    expect(canNhacGioVang(vn({ seen_at: luc(12, 0) + 1 }), luc(12, 56))).toBe(false);   // 19:00:00.001 giờ VN
    expect(canNhacGioVang(vn({ seen_at: luc(11, 59) }), luc(12, 56))).toBe(true);       // 18:59 giờ VN
  });

  it('có chữ giờ vàng cho ĐỦ mọi ngôn ngữ của game', () => {
    for (const n of NGON_NGU) expect(CHU_GV[n.id], n.id).toBeTruthy();
  });

  it('vòng gửi: chỉ máy GIÀNH được (UPDATE đổi 1 dòng) mới nhận — nhiều pod không gửi trùng', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(luc(12, 56));
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = JSON.stringify({ client_email: 'x@y', project_id: 'p', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    const may = (token: string) => ({ token, nen: 'android', lang: 'vi', lech_phut: 420, gui_cuoi: 0, gv_day: 0, seen_at: 0 });
    const a = 'a'.repeat(30), b = 'b'.repeat(30);
    const pool = { query: vi.fn(async (sql: string, v: unknown[] = []) => {
      if (sql.startsWith('SELECT') && sql.includes('gv_on = 1')) return [[may(a), may(b)]];
      if (sql.startsWith('UPDATE push_subscriptions SET gv_day')) return [{ affectedRows: v[1] === a ? 1 : 0 }];   // pod khác đã giành b
      return [[]];
    }) };
    const gui: { token: string; title: string; data: unknown }[] = [];
    const layFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }));
      const m = (JSON.parse(String(init!.body)) as { message: { token: string; notification: { title: string }; data: unknown } }).message;
      gui.push({ token: m.token, title: m.notification.title, data: m.data });
      return new Response('{}');
    });
    const tb = (await moThongBao(pool as never, { FCM_SERVICE_ACCOUNT: sa }, layFetch as never, { khongHenGio: true }))!;
    await tb.vongGioVang();
    expect(gui).toEqual([{ token: a, title: CHU_GV.vi!.tieuDe, data: { gv: '1' } }]);
  });
});

describe('client: thong-bao.ts', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('trình duyệt (không phải app) → không vẽ chuông, không gọi server', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const tb = await import('@/lib/thong-bao');
    await tb.khoiDongThongBao();
    expect(tb.coChuong.value).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(tb.maMayHienTai()).toBeNull();
  });
});
