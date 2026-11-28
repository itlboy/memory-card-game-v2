import { describe, expect, it } from 'vitest';
import { chonPod } from '../../node-server/src/chon-pod';

const p = (pod: string, may: string, phong: number) => ({ pod, diaChi: `http://${may}:8080`, phong });

describe('chia phòng mới cho cụm (28.11.2026)', () => {
  it('cân theo MÁY: máy hai pod không nhận gấp đôi máy một pod', () => {
    // da-2 (10.19.106.3) hai pod 3+3 = 6, da-3 (10.19.106.2) một pod 5 → da-3 ít hơn → chọn da-3
    expect(chonPod([p('a', '10.19.106.3', 3), p('b', '10.19.106.3', 3), p('c', '10.19.106.2', 5)])?.pod).toBe('c');
  });

  it('máy vừa bật lại (0 phòng) nhận phòng mới; trên cùng máy chọn pod ít phòng', () => {
    expect(chonPod([p('a', '10.19.106.3', 4), p('b', '10.19.106.3', 1), p('c', '10.19.106.2', 0)])?.pod).toBe('c');
    expect(chonPod([p('a', '10.19.106.3', 4), p('b', '10.19.106.3', 1), p('c', '10.19.106.2', 9)])?.pod).toBe('b');
  });

  it('giao 40 phòng liên tiếp (đếm tạm mỗi lần giao): hai máy lệch nhau ≤ 1', () => {
    const ds = [p('a', '10.19.106.3', 0), p('b', '10.19.106.3', 0), p('c', '10.19.106.2', 0)];
    for (let i = 0; i < 40; i++) chonPod(ds)!.phong++;
    const da2 = ds[0]!.phong + ds[1]!.phong, da3 = ds[2]!.phong;
    expect(Math.abs(da2 - da3)).toBeLessThanOrEqual(1);
    expect(Math.abs(ds[0]!.phong - ds[1]!.phong)).toBeLessThanOrEqual(1);
  });

  it('danh sách rỗng → không chọn', () => { expect(chonPod([])).toBeUndefined(); });
});
