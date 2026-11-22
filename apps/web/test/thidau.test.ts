import { describe, expect, it } from 'vitest';
import { THI_DAU_SO_THE, chiaTran } from '@mm/engine';
import { CHO_MS, GOM_MS, NGHI_BO_QUA_MS, NGHI_DE_SAU_MS, moThiDau, tdMoi, type NguoiTd } from '../../node-server/src/thidau';

/**
 * THI ĐẤU (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k): gọi mọi người rảnh, tự chia
 * trận 2–3 người, không chủ phòng. Test chạy thẳng máy trạng thái của server với đồng hồ giả.
 */
function dung() {
  let t = 1_000_000;
  const hen: { luc: number; f: () => void; huy: boolean }[] = [];
  const ketNoi = new Map<string, NguoiTd>();
  const tin = new Map<string, Record<string, unknown>[]>();
  const phong: { soThe: number; n: number }[] = [];
  const ghi: [string, Record<string, unknown>][] = [];
  const bao: string[] = [];
  const td = moThiDau({
    ketNoi, now: () => t,
    gui: (k, m) => { tin.get(k.sid)!.push(m as Record<string, unknown>); },
    taoPhong: async (soThe, n) => { phong.push({ soThe, n }); return String(100000 + phong.length); },
    ghi: (loai, _sid, d) => { ghi.push([loai, d]); },
    baoCho: (ten) => { bao.push(ten); },
    hen: (f, ms) => { const h = { luc: t + ms, f, huy: false }; hen.push(h); return h as unknown as ReturnType<typeof setTimeout>; },
    ngauNhien: () => 0
  });
  // clearTimeout của Node bỏ qua đối tượng lạ → tự đánh dấu huỷ qua so mốc: chạy hẹn theo thứ tự, mỗi hẹn một lần
  const chay = async (ms: number): Promise<void> => {
    const den = t + ms;
    for (;;) {
      const h = hen.filter((x) => !x.huy && x.luc <= den).sort((a, b) => a.luc - b.luc)[0];
      if (!h) break;
      h.huy = true; t = Math.max(t, h.luc); h.f();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    }
    t = den;
  };
  const them = (sid: string, tt = 'chu', ho = true): NguoiTd => {
    const k: NguoiTd = { sid, ten: sid.toUpperCase(), mat: '🙂', tt, td: tdMoi(ho) };
    ketNoi.set(sid, k); tin.set(sid, []); td.xet();
    return k;
  };
  const cuoi = (sid: string, loai: string) => [...tin.get(sid)!].reverse().find((m) => m.t === loai);
  return { td, them, chay, tin, cuoi, phong, ghi, bao, ketNoi, gio: () => t };
}

describe('chia trận', () => {
  it('2–3 người một trận, rải đều, không ai lẻ một mình', () => {
    expect(chiaTran(0)).toEqual([]);
    expect(chiaTran(1)).toEqual([]);
    expect(chiaTran(2)).toEqual([2]);
    expect(chiaTran(3)).toEqual([3]);
    expect(chiaTran(4)).toEqual([2, 2]);
    expect(chiaTran(5)).toEqual([3, 2]);
    expect(chiaTran(6)).toEqual([3, 3]);
    expect(chiaTran(7)).toEqual([3, 2, 2]);
    expect(chiaTran(8)).toEqual([3, 3, 2]);
    for (let n = 2; n <= 40; n++) {
      const c = chiaTran(n);
      expect(c.reduce((a, b) => a + b, 0)).toBe(n);
      expect(c.every((x) => x === 2 || x === 3), `n=${n}`).toBe(true);
    }
  });
  it('số thẻ tối thiểu theo số người: 2 người từ 12, 3 người từ 24 (chủ dự án 22.11.2026)', () => {
    expect(THI_DAU_SO_THE[2][0]).toBe(12);
    expect(THI_DAU_SO_THE[3][0]).toBe(24);
    expect(Math.min(...THI_DAU_SO_THE[3])).toBe(24);
  });
});

describe('đợt gọi', () => {
  it('chỉ một người rảnh thì KHÔNG hỏi ai', async () => {
    const x = dung();
    x.them('a');
    await x.chay(1000);
    expect(x.cuoi('a', 'td_hoi')).toBeUndefined();
  });

  it('từ 2 người rảnh: mọi người cùng được hỏi; cả hai tham gia → một trận 2 người, bốc số thẻ trong các số đã chọn', async () => {
    const x = dung();
    const a = x.them('a'), b = x.them('b');
    await x.chay(1000);
    const ha = x.cuoi('a', 'td_hoi')!, hb = x.cuoi('b', 'td_hoi')!;
    expect(ha.id).toBe(hb.id);
    expect(ha.n).toBe(2);
    x.td.tin(a, { t: 'td_tra', id: ha.id, dong: true });
    x.td.tin(b, { t: 'td_tra', id: hb.id, dong: true });
    expect(x.cuoi('a', 'td_gom')!.n).toBe(2);
    await x.chay(GOM_MS);
    const tr = x.cuoi('a', 'td_tran')!;
    expect((tr.nguoi as unknown[]).length).toBe(2);
    expect(tr.soThe).toEqual(THI_DAU_SO_THE[2]);
    x.td.tin(a, { t: 'td_chon', id: tr.id, n: 16 });
    x.td.tin(b, { t: 'td_chon', id: tr.id, n: 7 });      // số ngoài danh sách bị bỏ
    x.td.tin(b, { t: 'td_chon', id: tr.id, n: 24 });
    await x.chay(1000);                                    // ai cũng chốt → không chờ hết giờ
    expect(x.phong.length).toBe(1);
    expect([16, 24]).toContain(x.phong[0]!.soThe);        // bốc trong các số ĐÃ CHỌN, không ra số khác
    expect(x.phong[0]!.n).toBe(2);
    expect(x.cuoi('a', 'td_vao')!.ma).toBe('100001');
    expect(x.cuoi('b', 'td_vao')!.soThe).toBe(x.phong[0]!.soThe);
  });

  it('6 người tham gia → hai trận 3 người, số thẻ từ 24', async () => {
    const x = dung();
    const ng = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => x.them(s));
    await x.chay(1000);
    for (const k of ng) x.td.tin(k, { t: 'td_tra', id: x.cuoi(k.sid, 'td_hoi')!.id, dong: true });
    await x.chay(GOM_MS);
    const tran = new Set(ng.map((k) => x.cuoi(k.sid, 'td_tran')!.id));
    expect(tran.size).toBe(2);
    expect(x.cuoi('a', 'td_tran')!.soThe).toEqual(THI_DAU_SO_THE[3]);
    await x.chay(20_000);                                  // không ai chọn → số nhỏ nhất của trận
    expect(x.phong).toEqual([{ soThe: 24, n: 3 }, { soThe: 24, n: 3 }]);
  });

  it('đang giữa ván (choi), app cũ, hay tắt gợi ý thì không được hỏi', async () => {
    const x = dung();
    x.them('a'); x.them('b', 'choi'); x.them('c', 'chu', false);
    const d = x.them('d'); d.td.gy = false;
    await x.chay(1000);
    for (const s of ['a', 'b', 'c', 'd']) expect(x.cuoi(s, 'td_hoi'), s).toBeUndefined();
  });

  it('đang chơi offline MỘT MÌNH vẫn được hỏi và được xếp trận; chơi nhiều người cùng máy thì không (chủ dự án 23.11.2026)', async () => {
    const x = dung();
    const a = x.them('a');
    const b = x.them('b', 'choi'); b.td.mot = true;          // một mình
    const c = x.them('c', 'choi');                            // nhiều người cùng máy
    x.td.xet(); await x.chay(1000);
    expect(x.cuoi('a', 'td_hoi')!.n).toBe(2);
    expect(x.cuoi('b', 'td_hoi')).toBeTruthy();
    expect(x.cuoi('c', 'td_hoi')).toBeUndefined();
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: true });
    x.td.tin(b, { t: 'td_tra', id: x.cuoi('b', 'td_hoi')!.id, dong: true });
    await x.chay(GOM_MS);
    expect(x.cuoi('b', 'td_tran')!.id).toBe(x.cuoi('a', 'td_tran')!.id);
    void c;
  });

  it('"Để sau" nghỉ lâu hơn bỏ qua; hết hạn nghỉ mới hỏi lại', async () => {
    const x = dung();
    const a = x.them('a'), b = x.them('b');
    await x.chay(1000);
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: false });
    await x.chay(GOM_MS);
    expect(a.td.nghi - x.gio()).toBeGreaterThan(NGHI_BO_QUA_MS);
    expect(a.td.nghi - x.gio()).toBeLessThanOrEqual(NGHI_DE_SAU_MS);
    expect(b.td.nghi - x.gio()).toBeLessThanOrEqual(NGHI_BO_QUA_MS);
    const truoc = x.tin.get('b')!.filter((m) => m.t === 'td_hoi').length;
    x.td.nhip(); await x.chay(NGHI_BO_QUA_MS - 60_000);
    expect(x.tin.get('b')!.filter((m) => m.t === 'td_hoi').length).toBe(truoc);
  });
});

describe('chưa đủ người', () => {
  it('chỉ một người tham gia → được giữ chờ + báo đẩy; người mới tới bấm tham gia là thành trận NGAY', async () => {
    const x = dung();
    const a = x.them('a'); x.them('b');
    await x.chay(1000);
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: true });
    await x.chay(GOM_MS);
    expect(x.cuoi('a', 'td_cho')!.con).toBe(CHO_MS);
    expect(x.bao).toEqual(['A']);
    expect(x.td.soLieu().cho).toBe(1);
    const c = x.them('c');
    await x.chay(1000);
    const hc = x.cuoi('c', 'td_hoi')!;
    expect(hc.cho).toEqual({ ten: 'A', mat: '🙂' });
    x.td.tin(c, { t: 'td_tra', id: hc.id, dong: true });
    expect(x.cuoi('a', 'td_tran')).toBeTruthy();           // không chờ thêm 15 giây gom
    expect(x.cuoi('c', 'td_tran')!.id).toBe(x.cuoi('a', 'td_tran')!.id);
    expect(x.td.soLieu().cho).toBe(0);
  });

  it('hết 10 phút không ai vào → báo hết chờ', async () => {
    const x = dung();
    const a = x.them('a'); const b = x.them('b');
    await x.chay(1000);
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: true });
    x.td.tin(b, { t: 'td_tra', id: x.cuoi('b', 'td_hoi')!.id, dong: false });
    await x.chay(GOM_MS);
    await x.chay(CHO_MS);
    x.td.nhip();
    expect(x.cuoi('a', 'td_het_cho')).toBeTruthy();
    expect(a.td.cho).toBe(0);
  });

  it('trận 2 người có người rời trước khi vào bàn → người còn lại được báo và giữ chờ', async () => {
    const x = dung();
    const a = x.them('a'), b = x.them('b');
    await x.chay(1000);
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: true });
    x.td.tin(b, { t: 'td_tra', id: x.cuoi('b', 'td_hoi')!.id, dong: true });
    await x.chay(GOM_MS);
    x.ketNoi.delete('b'); x.td.roi(b);
    expect(x.cuoi('a', 'td_huy')).toBeTruthy();
    expect(a.td.cho).toBeGreaterThan(x.gio());
    expect(x.phong).toEqual([]);
  });
});

describe('thống kê', () => {
  it('ghi đủ các bước: hỏi → trả lời → chia → chọn số thẻ', async () => {
    const x = dung();
    const a = x.them('a'), b = x.them('b');
    await x.chay(1000);
    x.td.tin(a, { t: 'td_tra', id: x.cuoi('a', 'td_hoi')!.id, dong: true });
    x.td.tin(b, { t: 'td_tra', id: x.cuoi('b', 'td_hoi')!.id, dong: true });
    await x.chay(GOM_MS + 20_000);
    const loai = x.ghi.map((g) => g[0]);
    for (const l of ['td_dot', 'td_hoi', 'td_tra_loi', 'td_chia', 'td_chon_the']) expect(loai, l).toContain(l);
    expect(x.ghi.find((g) => g[0] === 'td_chia')![1]).toMatchObject({ thamGia: 2, tran2: 1, tran3: 0, du: true });
  });
});
