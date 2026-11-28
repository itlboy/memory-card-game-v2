import { describe, expect, it } from 'vitest';
import { doSucKhoe, mucCanhBao } from '../../node-server/src/suc-khoe-may';

describe('sức khoẻ máy (bảng máy chủ admin, 28.11.2026)', () => {
  it('ngưỡng: ≥ 80% vàng, ≥ 95% đỏ, dưới 80 hoặc không có số thì không', () => {
    expect(mucCanhBao(79.9)).toBeNull();
    expect(mucCanhBao(80)).toBe('vang');
    expect(mucCanhBao(94.9)).toBe('vang');
    expect(mucCanhBao(95)).toBe('do');
    expect(mucCanhBao(null)).toBeNull();
  });
  it('đo được số hợp lệ (ổ đĩa luôn có; CPU lần đầu có thể null)', async () => {
    const a = await doSucKhoe();
    const b = await doSucKhoe(Date.now() + 1000);
    for (const v of [b.may.oDia, b.may.ram, b.pod.ramMB]) expect(v).toBeGreaterThanOrEqual(0);
    expect(b.may.oDia).toBeLessThanOrEqual(100);
    expect(a.luc).toBeLessThan(b.luc);
  });
});
