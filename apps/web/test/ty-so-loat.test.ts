import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tySoLoat } from '@/lib/ty-so-loat';

/* Tỷ số cả loạt (mockup duyệt 16.11.2026): luôn hiện từ 2 người, người dẫn xanh, bằng nhau không ai xanh. */
const ds = (...ten: string[]) => ten.map((name) => ({ name }));

describe('tỷ số cả loạt', () => {
  it('ván đầu VẪN hiện: cả bàn 0, không ai dẫn', () => {
    expect(tySoLoat(ds('A', 'B'), {})).toEqual({ A: { n: 0, dan: false }, B: { n: 0, dan: false } });
  });
  it('2–0: người dẫn xanh, người 0 vẫn có số', () => {
    expect(tySoLoat(ds('A', 'B'), { A: 2 })).toEqual({ A: { n: 2, dan: true }, B: { n: 0, dan: false } });
  });
  it('hoà loạt 1–1: không ai xanh', () => {
    const r = tySoLoat(ds('A', 'B'), { A: 1, B: 1 })!;
    expect(r.A!.dan || r.B!.dan).toBe(false);
  });
  it('2–2–0: hai người cùng dẫn đều xanh', () => {
    const r = tySoLoat(ds('A', 'B', 'C'), { A: 2, B: 2 })!;
    expect([r.A!.dan, r.B!.dan, r.C!.dan]).toEqual([true, true, false]);
  });
  it('chơi một mình: không có tỷ số', () => {
    expect(tySoLoat(ds('A'), { A: 3 })).toBeNull();
  });
  it.each(['OnlineGame.vue', 'PlayerStrip.vue'])('%s: không còn 🏅, hiện số qua tySoLoat', (f) => {
    const src = readFileSync(resolve(process.cwd(), 'src/components', f), 'utf8');
    expect(src).not.toMatch(/class="huy"|🏅\{\{/);
    expect(src).toMatch(/tySoLoat\(/);
    // Từng ẩn khi 0 ván — đúng lỗi chủ dự án báo
    expect(src).not.toMatch(/v-if="\(o?\.?seriesWins[^"]*\) > 0" class="wins"/);
  });
});
