import { describe, expect, it } from 'vitest';
import { COT, COT_CHON, HANG, mocCap, VanMuaThe, nhipRoi, tocDo } from '../src/lib/mua-the';

/** Ngẫu nhiên có hạt giống — test không được đỏ thất thường. */
function hat(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const HINH = ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯'];
function chay(v: VanMuaThe, giay: number): void { for (let i = 0; i < giay * 60 && !v.ketThuc; i++) v.buoc(1 / 60); }

describe('Mưa Thẻ', () => {
  it('bàn N cột: lá cặp rơi trong N lá kế tiếp', () => {
    for (const soCot of COT_CHON) for (let seed = 1; seed <= 10; seed++) {
      const v = new VanMuaThe(HINH.concat(['🐵', '🐷', '🐸', '🐧']), hat(seed), soCot, 12);
      chay(v, 90);
      const ds = [...v.la].sort((a, b) => a.id - b.id).map((l) => l.sym);
      const mo = new Map<string, number>();
      ds.forEach((s, i) => {
        if (!mo.has(s)) { mo.set(s, i); return; }
        const cach = i - mo.get(s)!;
        expect(cach, `${soCot} cột, seed ${seed}: ${s} ở ${mo.get(s)} và ${i}`).toBeLessThanOrEqual(soCot);
        mo.delete(s);
      });
    }
  });

  it('không ai chạm thì mọi cột đầy rồi mới thua', () => {
    const v = new VanMuaThe(HINH, hat(2));
    chay(v, 300);
    expect(v.ketThuc).toBe(true);
    expect(v.cot.every((c) => c.length >= HANG)).toBe(true);   // một cột đầy chưa thua — đầy HẾT mới thua
    expect(v.cot.every((c) => c.length <= HANG)).toBe(true);
  });

  it('lá đang rơi thì ngửa, chạm đáy thì úp', () => {
    const v = new VanMuaThe(HINH, hat(3));
    chay(v, 0.4);
    const l = v.la[0]!;
    expect(l.roi && v.ngua(l)).toBe(true);
    while (l.roi) v.buoc(1 / 60);
    expect(v.ngua(l)).toBe(false);
  });

  it('ăn cặp: cộng điểm theo cấp × combo, lá phía trên tụt xuống lấp chỗ', () => {
    const v = new VanMuaThe(HINH, hat(4));
    chay(v, 20);
    const nam = v.la.filter((l) => !l.roi);
    const a = nam.find((l) => nam.some((b) => b !== l && b.sym === l.sym))!;
    const b = nam.find((x) => x !== a && x.sym === a.sym)!;
    expect(v.cham(a.id)).toBe('chon');
    expect(v.ngua(a)).toBe(true);
    expect(v.cham(b.id)).toBe('an');
    expect(v.diem).toBe(100);   // cùng gốc 100 điểm/cặp như chế độ thường, cấp 1, chưa combo
    expect(v.cot.flat()).not.toContain(a);
    v.donLaAn();
    chay(v, 1);
    for (const c of v.cot) c.forEach((l, k) => expect(l.y).toBeCloseTo(v.oY(k)));
  });

  it('chạm sai KHÔNG khoá: hai lá lộ hình một nhịp, lá thứ ba chạm được ngay', () => {
    const v = new VanMuaThe(HINH, hat(5));
    chay(v, 20);
    const nam = v.la.filter((l) => !l.roi);
    const a = nam[0]!, b = nam.find((x) => x.sym !== a.sym)!;
    v.cham(a.id);
    expect(v.cham(b.id)).toBe('sai');
    expect(v.ngua(a) && v.sai(a)).toBe(true);
    expect(v.cham(nam.find((x) => x !== a && x !== b)!.id)).toBe('chon');
    chay(v, 1);
    expect(v.ngua(a) || v.ngua(b)).toBe(false);
  });

  it('lên cấp theo ĐIỂM, không theo thời gian; cấp cao rơi nhanh hơn, dày hơn', () => {
    const v = new VanMuaThe(HINH, hat(6));
    chay(v, 60);
    expect(v.cap).toBe(1);   // không ăn gì thì đứng cấp 1 dù đã một phút
    v.diem = mocCap(2);
    expect(v.buoc(1 / 60).some((e) => e.loai === 'len-cap' && e.cap === 2)).toBe(true);
    expect(tocDo(5)).toBeGreaterThan(tocDo(1));
    expect(nhipRoi(5)).toBeLessThan(nhipRoi(1));
    expect(COT).toBeGreaterThanOrEqual(4);
  });
});

describe('Mưa Thẻ chia đều', () => {
  it('không ai chạm: lúc thua tải các cột chênh nhau không quá 2 lá', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const v = new VanMuaThe(HINH, hat(seed));
      chay(v, 300);
      // tải = lá nằm + lá đang rơi trong cột (lá đang rơi sẽ nằm vào đó)
      const cao = v.cot.map((c, i) => c.length + v.la.filter((l) => l.roi && l.cot === i).length);
      expect(Math.max(...cao) - Math.min(...cao), `seed ${seed}: ${cao}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('Mưa Thẻ số hàng', () => {
  it('6 cột: lá vuông không dưới 44px; máy cao hơn thì nhiều hàng hơn', async () => {
    const { hangChoGieng, DEM_DOC } = await import('../src/lib/mua-the');
    // giếng đo được trên iPhone SE / 14 / Pro Max (vùng web)
    const may = [[351, 420], [366, 525], [406, 600]] as const;
    const hang = may.map(([w, h]) => hangChoGieng(w, h, 6));
    for (const [i, [, h]] of may.entries()) expect(h / hang[i]! - DEM_DOC).toBeGreaterThanOrEqual(44);
    expect(hang[0]).toBeGreaterThanOrEqual(7);
    expect(hang[2]).toBeGreaterThan(hang[0]!);
  });
});
