import { describe, expect, it } from 'vitest';
import {
  Rng, TIM_THE_SO_THE, VanTimThe, timTheChonMs, timTheDiem, timTheHopLe, timTheMayChon, timTheMayDung, timTheSoCot, timTheXemMs
} from '../src/index.js';
import type { BotLevel, TimTheConfig } from '../src/index.js';

const HINH = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'];
const cfg = (soThe: number, doKho: TimTheConfig['doKho'] = 'vua', soLuot = 10): TimTheConfig => ({ soThe, doKho, soLuot });

describe('Tìm Thẻ — thời gian', () => {
  it('giờ xem = x × số thẻ; giờ chọn = nửa giờ xem, sàn 2 giây', () => {
    expect(timTheXemMs(cfg(9, 'de'))).toBe(9000);
    expect(timTheXemMs(cfg(9, 'vua'))).toBe(6750);
    expect(timTheXemMs(cfg(12, 'kho'))).toBe(6000);
    expect(timTheChonMs(cfg(12, 'de'))).toBe(6000);
    expect(timTheChonMs(cfg(9, 'vua'))).toBe(3375);
    expect(timTheChonMs(cfg(3, 'kho'))).toBe(2000);   // 0,75s nếu không có sàn
    expect(timTheChonMs(cfg(4, 'de'))).toBe(2000);
  });
  it('số cột theo số thẻ', () => {
    expect(TIM_THE_SO_THE.map(timTheSoCot)).toEqual([3, 2, 3, 3, 3, 3, 3]);
  });
  it('cấu hình lạ bị ép về hợp lệ', () => {
    expect(timTheHopLe({ soThe: 88, doKho: 'x' as never, soLuot: 999 })).toEqual({ soThe: 9, doKho: 'vua', soLuot: 10 });
    expect(timTheHopLe({ soThe: 8, doKho: 'kho', soLuot: 5 })).toEqual({ soThe: 8, doKho: 'kho', soLuot: 5 });
    // 12 và 16 thẻ đã bỏ (27.11.2026, bàn vòng tròn chỉ 3–9) — cấu hình cũ lưu trong máy về mặc định
    expect(timTheHopLe({ soThe: 12 }).soThe).toBe(9);
    expect(timTheHopLe(null)).toEqual({ soThe: 9, doKho: 'vua', soLuot: 10 });
  });
});

describe('Tìm Thẻ — điểm', () => {
  it('10 × số thẻ, gấp đôi nếu chọn tức thì, nhân chuỗi và độ khó', () => {
    const han = timTheChonMs(cfg(12, 'de'));
    expect(timTheDiem(cfg(12, 'de'), 1, han)).toBe(120);        // sát hết giờ: chỉ điểm gốc
    expect(timTheDiem(cfg(12, 'de'), 1, 0)).toBe(240);          // tức thì: gốc + tốc độ
    expect(timTheDiem(cfg(12, 'de'), 4, 0)).toBe(480);          // chuỗi 4+ → x2
    expect(timTheDiem(cfg(12, 'kho'), 1, timTheChonMs(cfg(12, 'kho')))).toBe(180);   // Khó x1,5
    expect(timTheDiem(cfg(3, 'de'), 1, 0)).toBe(60);            // bàn nhỏ thì điểm nhỏ — không cày xu được
  });
});

describe('Tìm Thẻ — máy', () => {
  it('xác suất đúng = (k+1)/n, có trần, giảm theo độ khó', () => {
    expect(timTheMayDung('easy', cfg(6, 'de'))).toBeCloseTo(0.5);
    expect(timTheMayDung('easy', cfg(12, 'de'))).toBeCloseTo(0.25);
    expect(timTheMayDung('divine', cfg(12, 'de'))).toBe(0.97);
    expect(timTheMayDung('hard', cfg(12, 'kho'))).toBeLessThan(timTheMayDung('hard', cfg(12, 'de')));
  });
  it('mức cao đúng nhiều hơn và nhanh hơn (mô phỏng 4.000 lượt)', () => {
    const c = cfg(9, 'vua');
    const thu = (level: BotLevel): { dung: number; ms: number } => {
      const rng = new Rng(7);
      let dung = 0, ms = 0;
      for (let i = 0; i < 4000; i++) { const n = timTheMayChon(level, c, i % 9, rng); if (n.viTri === i % 9) dung++; ms += n.ms; }
      return { dung: dung / 4000, ms: ms / 4000 };
    };
    const cap: BotLevel[] = ['easy', 'normal', 'hard', 'insane', 'divine'];
    const kq = cap.map(thu);
    for (let i = 1; i < kq.length; i++) {
      expect(kq[i]!.dung).toBeGreaterThanOrEqual(kq[i - 1]!.dung);
      expect(kq[i]!.ms).toBeLessThan(kq[i - 1]!.ms);
    }
    expect(kq[0]!.dung).toBeCloseTo(timTheMayDung('easy', c), 1);
  });
  it('máy chọn sai thì không bao giờ trúng ô đích', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const n = timTheMayChon('easy', cfg(3, 'kho'), 1, rng);
      expect(n.viTri).toBeGreaterThanOrEqual(0);
      expect(n.viTri).toBeLessThan(3);
    }
  });
});

describe('Tìm Thẻ — ván', () => {
  const mot = (seed = 1, c = cfg(6, 'de', 3)): VanTimThe => new VanTimThe(c, [{ id: 'p1', ten: 'A' }], HINH, seed);

  it('cùng seed thì cùng bàn, cùng thẻ hỏi', () => {
    const a = mot(42), b = mot(42);
    expect(a.the).toEqual(b.the);
    expect(a.dich).toBe(b.dich);
    expect(new Set(a.the).size).toBe(6);
  });
  it('mỗi lượt một bàn mới; hết số lượt là xong', () => {
    const v = mot(5);
    const ban: string[] = [];
    for (let i = 0; i < 3; i++) {
      ban.push(v.the.join());
      v.moHoi(); v.chon('p1', v.dich, 100); v.chot();
      expect(v.tiep()).toBe(i < 2);
    }
    expect(v.pha).toBe('xong');
    expect(new Set(ban).size).toBe(3);
  });
  it('chọn một lần, chỉ trong pha hỏi, không quá giờ', () => {
    const v = mot();
    expect(v.chon('p1', 0, 10)).toBe(false);          // đang xem
    v.moHoi();
    expect(v.chon('p1', 99, 10)).toBe(false);
    expect(v.chon('p1', 0, v.chonMs + 1)).toBe(false);
    expect(v.chon('p1', 0, 10)).toBe(true);
    expect(v.chon('p1', 1, 20)).toBe(false);
  });
  it('đúng liên tiếp nhân điểm; sai và hết giờ làm mất chuỗi', () => {
    const v = mot(9, cfg(8, 'de', 4));
    const han = v.chonMs;
    v.moHoi(); v.chon('p1', v.dich, han); let k = v.chot().ketQua[0]!;
    expect([k.ketCuc, k.diem, k.chuoi, k.heSo]).toEqual(['dung', 80, 1, 1]);
    v.tiep(); v.moHoi(); v.chon('p1', v.dich, han); k = v.chot().ketQua[0]!;
    expect([k.diem, k.chuoi, k.heSo]).toEqual([96, 2, 1.2]);
    v.tiep(); v.moHoi(); v.chon('p1', (v.dich + 1) % 8, 5); k = v.chot().ketQua[0]!;
    expect([k.ketCuc, k.diem, k.chuoi]).toEqual(['sai', 0, 0]);
    v.tiep(); v.moHoi(); k = v.chot().ketQua[0]!;
    expect(k.ketCuc).toBe('het-gio');
    expect(v.nguoi[0]).toMatchObject({ diem: 176, dung: 2, chuoiDai: 2, chuoi: 0, nhanhNhatMs: han });
  });
  it('một mình thì không có thưởng nhanh nhất', () => {
    const v = mot();
    v.moHoi(); v.chon('p1', v.dich, 0);
    expect(v.chot().ketQua[0]!.nhanhNhat).toBe(false);
  });
  it('nhiều người: chờ đủ người mới chấm, nhanh nhất được thêm 5 × số thẻ', () => {
    const v = new VanTimThe(cfg(6, 'de', 1), [{ id: 'a', ten: 'A' }, { id: 'b', ten: 'B' }], HINH, 3);
    v.moHoi();
    expect(v.chotLuc).toBe(v.chonMs);                 // chưa ai chọn → chờ hết giờ
    v.chon('a', v.dich, 1500);
    expect(v.chotLuc).toBe(v.chonMs);
    v.chon('b', v.dich, 600);
    expect(v.chotLuc).toBe(1500);                     // đủ người → chấm ở lần chọn muộn nhất
    const [a, b] = v.chot().ketQua;
    expect(b!.nhanhNhat).toBe(true);
    expect(a!.nhanhNhat).toBe(false);
    expect(b!.diem).toBe(timTheDiem(v.cfg, 1, 600) + 30);
    expect(v.xepHang().map((p) => [p.id, p.hang])).toEqual([['b', 1], ['a', 2]]);
  });
  it('trùng điểm thì đồng hạng', () => {
    const v = new VanTimThe(cfg(6, 'de', 1), [{ id: 'a', ten: 'A' }, { id: 'b', ten: 'B' }, { id: 'c', ten: 'C' }], HINH, 3);
    v.moHoi(); v.chon('c', v.dich, 100); v.chot(); v.tiep();
    expect(v.xepHang().map((p) => p.hang)).toEqual([1, 2, 2]);
  });
  it('máy tự chọn theo seed; đấu máy vẫn chấm đủ hai bên', () => {
    const v = new VanTimThe(cfg(9, 'vua', 10), [{ id: 'p1', ten: 'A' }, { id: 'bot', ten: 'Máy', may: 'divine' }], HINH, 11);
    let mayDung = 0;
    for (let i = 0; i < 10; i++) {
      v.moHoi();
      expect(v.chon('bot', 0, 10)).toBe(false);       // không ai chọn hộ máy được
      v.chon('p1', v.dich, 300);
      expect(v.chotLuc).toBeLessThanOrEqual(v.chonMs);
      if (v.chot().ketQua[1]!.ketCuc === 'dung') mayDung++;
      v.tiep();
    }
    expect(mayDung).toBeGreaterThanOrEqual(8);
    expect(v.pha).toBe('xong');
  });
  it('thiếu hình thì báo lỗi ngay', () => {
    expect(() => new VanTimThe(cfg(12), [{ id: 'p1', ten: 'A' }], ['a', 'b'], 1)).toThrow();
  });
});
