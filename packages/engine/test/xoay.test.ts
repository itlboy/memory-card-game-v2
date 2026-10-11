import { describe, expect, it } from 'vitest';
import { MemoryGame, xoayNguoiDau } from '../src/index.js';

const DS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const ids = (x: { id: string }[]) => x.map((p) => p.id).join('');

describe('xoay vòng người đi đầu', () => {
  it('ván đầu bốc theo số ngẫu nhiên đưa vào', () => {
    expect(ids(xoayNguoiDau(DS, null, 0))).toBe('abc');
    expect(ids(xoayNguoiDau(DS, null, 0.5))).toBe('bca');
    expect(ids(xoayNguoiDau(DS, null, 0.99))).toBe('cab');
  });
  it('ván sau bắt đầu từ người NGAY SAU người đi đầu ván trước, giữ nguyên thứ tự', () => {
    expect(ids(xoayNguoiDau(DS, 'a', 0.9))).toBe('bca');
    expect(ids(xoayNguoiDau(DS, 'c', 0.9))).toBe('abc');
  });
  it('ba ván liền: mỗi người đi đầu đúng một lần', () => {
    let truoc: string | null = null;
    const dau: string[] = [];
    for (let i = 0; i < 3; i++) { const x: { id: string }[] = xoayNguoiDau(DS, truoc, 0.3); dau.push(x[0]!.id); truoc = x[0]!.id; }
    expect(new Set(dau).size).toBe(3);
  });
  it('người đi đầu đã rời thì bốc lại; một người thì không đổi', () => {
    expect(ids(xoayNguoiDau(DS, 'z', 0))).toBe('abc');
    expect(ids(xoayNguoiDau([{ id: 'a' }], 'a', 0.5))).toBe('a');
  });
  it('engine giữ đúng thứ tự khi tắt shufflePlayers', () => {
    const players = xoayNguoiDau([{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], 'p1', 0);
    const g = new MemoryGame({ cols: 2, rows: 2, symbols: ['x', 'y'], seed: 5, players, shufflePlayers: false } as never);
    expect(g.current.id).toBe('p2');
  });
});
