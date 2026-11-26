import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BAI_DE_TEST, BAI_NHAC, BAI_PREMIUM, ICON_BAI } from '@/lib/nhac';

/**
 * CHÍN BÀI NHẠC NỀN (26.11.2026) — chủ dự án: "tôi muốn chúng ta làm 9 nhạc nền luôn, đảm bảo premium x3 free".
 */
describe('chín bài nhạc nền', () => {
  it('9 bài: 3 thường + 6 Premium — người có Premium nghe được GẤP BA', () => {
    const thuong = BAI_NHAC.filter((b) => !BAI_PREMIUM.has(b));
    expect(BAI_NHAC).toHaveLength(9);
    expect(thuong).toEqual(['keo', 'dem', 'sau']);
    expect(BAI_NHAC.length).toBe(thuong.length * 3);
    expect(BAI_NHAC.slice(0, 3), 'bài thường đứng trước — hàng đầu của lưới 3 cột').toEqual(thuong);
  });

  it('bài nào cũng có biểu tượng, màu ô, và tên ở đủ 15 ngôn ngữ', () => {
    const bang = readFileSync(resolve(process.cwd(), 'src/components/ChonNhac.vue'), 'utf8');
    const nn = ['vi', 'en', 'de', 'fr', 'es', 'it', 'id', 'ko', 'ru', 'ja', 'pt', 'tr', 'zh-TW', 'th', 'zh'];
    for (const b of BAI_NHAC) {
      expect(ICON_BAI[b], b).toBeTruthy();
      expect(bang, `màu ô ${b}`).toContain(`.ic.${b} { background:`);
      for (const n of nn) expect(readFileSync(resolve(process.cwd(), `src/locales/${n}.ts`), 'utf8'), `${n}:${b}`).toContain(`'tb.nhacBai.${b}':`);
    }
  });

  it('dữ liệu từng bài hợp lệ: đủ móc mỗi ô, chỉ số rải nằm trong hợp âm, nốt trong âm vực nghe được', () => {
    for (const b of BAI_NHAC) {
      const d = BAI_DE_TEST[b];
      const moc = d.moc ?? 8;
      expect(d.giai.length, `${b}: số ô giai điệu = số ô hợp âm`).toBe(d.vong.length);
      for (const o of d.giai) {
        expect(o.length, `${b}: mỗi ô ${moc} móc`).toBe(moc);
        for (const n of o) expect(n === 0 || (n >= 55 && n <= 96), `${b}: nốt ${n}`).toBe(true);
      }
      expect(d.rai.length, `${b}: rải`).toBe(moc);
      for (const h of d.vong) {
        expect(h.ton.length).toBeGreaterThanOrEqual(4);
        expect(h.bass >= 33 && h.bass <= 52, `${b}: bass ${h.bass}`).toBe(true);
        for (const r of d.rai) expect(r < h.ton.length, `${b}: chỉ số rải ${r}`).toBe(true);
      }
      for (const m of [...(d.bassMoc ?? []), ...(d.raiMoc ?? [])]) expect(m < moc, `${b}: móc ${m}`).toBe(true);
      for (const be of [d.bass, d.raiBe, d.giaiBe]) expect(be.to > 0 && be.to <= 0.1 && be.dai > 0, `${b}: bè`).toBe(true);
    }
  });

  it('luật "mỗi bài khác nhau ở NHỊP ĐIỆU + KẾT CẤU": không hai bài nào trùng cả khuôn rải lẫn khuôn bass', () => {
    const khuon = BAI_NHAC.map((b) => {
      const d = BAI_DE_TEST[b];
      return JSON.stringify([d.moc ?? 8, d.raiMoc ?? 'moi', d.bassMoc ?? 'macdinh', !!d.caHopAm, d.rai, d.swing ?? 0]);
    });
    expect(new Set(khuon).size).toBe(BAI_NHAC.length);
  });
});
