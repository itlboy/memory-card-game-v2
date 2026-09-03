import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HET_HOI_MS, HIEU_UNG, conLai } from '@/lib/ketcuc-fx';
import type { LopFx } from '@/lib/ketcuc-fx';

/**
 * HIỆU ỨNG KẾT VÁN KHÔNG ĐƯỢC CHẠY MÃI.
 *
 * Hiệu ứng nằm dưới bảng kết quả, và bảng đó ở lại tới khi người chơi bấm. Lớp
 * nào khai animation `infinite` thì phải được đánh dấu `tam` để `KetCucFx` gỡ
 * đi ở mốc `HET_HOI_MS` — thiếu dấu là điện thoại quay hàng trăm animation
 * trong lúc người chơi bấm "Chơi lại" (đã bị báo: delay tới vài chục giây).
 */
const css = readFileSync(resolve(__dirname, '../src/styles/ketcuc-fx.css'), 'utf8');

/** Tên class mà CSS cho chạy vô hạn. */
function classVoHan(): Set<string> {
  const ten = new Set<string>();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const chon = m[1]!;
    if (chon.trim().startsWith('@') || !/infinite/.test(m[2]!)) continue;
    for (const c of chon.matchAll(/\.(fx-[\w-]+)/g)) ten.add(c[1]!);
  }
  return ten;
}

/** Mọi lớp của mọi hiệu ứng, phẳng ra (kèm cờ `tam` kế thừa từ lớp cha). */
function moiLop(): { lop: string; tam: boolean }[] {
  const ra: { lop: string; tam: boolean }[] = [];
  const di = (l: LopFx, chaTam: boolean): void => {
    const tam = chaTam || !!l.tam;
    for (const c of l.lop.split(/\s+/)) ra.push({ lop: c, tam });
    for (const con of l.con ?? []) di(con, tam);
  };
  for (const h of HIEU_UNG) for (const l of h.dung(7)) di(l, false);
  return ra;
}

describe('hạt bay của hiệu ứng kết ván có hạn', () => {
  it('mọi class chạy vô hạn đều nằm trong lớp `tam`', () => {
    const voHan = classVoHan();
    expect(voHan.size).toBeGreaterThan(0);
    const thieu = moiLop().filter((l) => voHan.has(l.lop) && !l.tam).map((l) => l.lop);
    expect([...new Set(thieu)]).toEqual([]);
  });

  it('gỡ hạt rồi thì hiệu ứng nào cũng còn lớp nền hoặc trống hẳn', () => {
    const voHan = classVoHan();
    for (const h of HIEU_UNG) {
      const con = conLai(h.dung(7));
      const conVoHan = con.flatMap((l) => l.lop.split(/\s+/)).filter((c) => voHan.has(c));
      expect(conVoHan, h.id).toEqual([]);
    }
  });

  it('mốc hết hơi ở sau lúc bảng kết quả hiện (2,2s) và tiếng tắt (5,2s)', () => {
    expect(HET_HOI_MS).toBeGreaterThan(5200);
    expect(HET_HOI_MS).toBeLessThanOrEqual(15000);
  });
});
