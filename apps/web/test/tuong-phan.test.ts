import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * QUY CHUẨN TƯƠNG PHẢN CHỮ / NỀN (chủ dự án 14.10.2026, sau viên "Màn 2" chữ trắng
 * trên nền trắng ở Neon + Đêm Sao). Đây là lớp TĨNH, đọc mã nguồn; lớp đo THẬT trên
 * trình duyệt là `pnpm do:tuong-phan` (mọi skin × sáng/tối, mọi chữ đang hiện).
 *
 * Luật: nền và chữ đi theo CẶP token của skin (`--nhan-nen/--nhan-chu`,
 * `--chon-nen/--chon-chu`), đừng ghép một màu CỨNG với một token — token đổi theo skin,
 * màu cứng thì không, và skin tối là chỗ cặp đó lật ngược.
 */
const src = (p: string) => resolve('src', p);
const doc = (p: string) => readFileSync(src(p), 'utf8');

const L = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};
const tp = (a: string, b: string) => {
  const x = L(a), y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const dai = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h.toLowerCase());
const hexTrong = (v: string) => (v.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []).map(dai);

/** Biến CSS khai trong khối đầu tiên khớp `sel` */
function khoi(css: string, sel: string): Record<string, string> {
  const i = css.indexOf(sel);
  if (i < 0) return {};
  const mo = css.indexOf('{', i), dong = css.indexOf('}', mo);
  const ra: Record<string, string> = {};
  for (const m of css.slice(mo + 1, dong).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) ra[m[1]!] = m[2]!.trim();
  return ra;
}
const giai = (v: string, bien: Record<string, string>, sau = 0): string =>
  sau > 8 ? v : v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, k: string, du?: string) => giai(bien[k] ?? du ?? '', bien, sau + 1));

const tokens = doc('styles/tokens.css');
const SANG = khoi(tokens, ':root');
const TOI = { ...SANG, ...khoi(tokens, "[data-theme='dark']") };
const SKINS = readdirSync(src('styles/skins')).filter((f) => f.endsWith('.css')).map((f) => f.replace('.css', ''));
const BO: [string, Record<string, string>][] = [
  ['mặc định sáng', SANG], ['mặc định tối', TOI],
  ...SKINS.map((id) => [id, { ...SANG, ...khoi(doc(`styles/skins/${id}.css`), `:root[data-skin='${id}']`) }] as [string, Record<string, string>]),
];

describe('tương phản: cặp token nền/chữ của mọi skin', () => {
  it('đọc được đủ skin (chốt chống xanh rỗng)', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(5);
    expect(TOI['--accent']).not.toBe(SANG['--accent']);
  });
  for (const [ten, bien] of BO) {
    for (const [nen, chu] of [['--nhan-nen', '--nhan-chu'], ['--chon-nen', '--chon-chu']] as const) {
      it(`${ten}: ${nen} / ${chu} ≥ 3:1 ở MỌI điểm màu`, () => {
        const mauNen = hexTrong(giai(bien[nen] ?? '', bien));
        const mauChu = hexTrong(giai(bien[chu] ?? '', bien));
        expect(mauNen.length, `${nen} không giải ra màu`).toBeGreaterThan(0);
        expect(mauChu.length, `${chu} không giải ra màu`).toBe(1);
        for (const m of mauNen) expect(tp(m, mauChu[0]!), `${m} với ${mauChu[0]}`).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('tương phản: ô gradient định danh (.g-*) mang chữ trắng', () => {
  const g = [...doc('styles/global.css').matchAll(/^\.(g-[\w-]+)\s*\{[^}]*linear-gradient\(([^)]*)\)/gm)];
  it('có đủ các ô màu', () => expect(g.length).toBeGreaterThanOrEqual(8));
  for (const [, ten, grad] of g) {
    it(`.${ten}: mọi điểm màu ≥ 3:1 với chữ trắng`, () => {
      for (const m of hexTrong(grad!)) expect(tp(m, '#ffffff'), `${m}`).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('tương phản: không ghép màu CỨNG với token chữ/nền trong cùng một khối', () => {
  // Đúng dạng lỗi viên "Màn 2": `background: #fff; color: var(--fg)` — --fg sáng ở
  // skin tối nên chữ trắng trên nền trắng.
  const tep = [
    ...readdirSync(src('components')).filter((f) => f.endsWith('.vue')).map((f) => `components/${f}`),
    ...readdirSync(src('styles')).filter((f) => f.endsWith('.css') && f !== 'tokens.css').map((f) => `styles/${f}`),
  ];
  it('quét được file', () => expect(tep.length).toBeGreaterThan(30));
  it('không khối CSS nào có nền trắng/đen cứng + chữ --fg/--muted (hoặc ngược lại)', () => {
    const sai: string[] = [];
    for (const f of tep) {
      const css = doc(f).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const than = m[2]!;
        const nenCung = /background(?:-color)?\s*:\s*(#fff\b|#ffffff\b|white\b|#000\b|#000000\b|black\b)/i.test(than);
        const chuToken = /(?:^|;|\s)color\s*:\s*var\(--(fg|muted)\b/.test(than);
        const nenToken = /background(?:-color)?\s*:\s*var\(--(bg|surface|card)\b/.test(than);
        const chuCung = /(?:^|;|\s)color\s*:\s*(#fff\b|#ffffff\b|white\b)/i.test(than);
        if ((nenCung && chuToken) || (nenToken && chuCung)) sai.push(`${f}: ${m[1]!.trim().slice(0, 60)}`);
      }
    }
    expect(sai).toEqual([]);
  });
});
