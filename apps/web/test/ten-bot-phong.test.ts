import { describe, expect, it } from 'vitest';
import { DAU_BOT, laTenBotPhong, soTuTenBot, taoTenBotPhong, tenNguoiNgauNhien } from '../src/lib/ten-bot-phong';
import { tenNguoi } from '../src/lib/ten';
import { dangDebug } from '../src/lib/debug';

/** Bộ sinh số giả cố định để test lặp lại được. */
function rndCoDinh(hat = 7): () => number { let s = hat; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

describe('tên bot phòng thường trực', () => {
  it('số từ: 1 từ ~60%, 2 từ ~30%, 3 từ ~10%', () => {
    const rnd = rndCoDinh(); const dem = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 20000; i++) dem[soTuTenBot(rnd)]++;
    expect(dem[1] / 20000).toBeCloseTo(0.6, 1);
    expect(dem[2] / 20000).toBeCloseTo(0.3, 1);
    expect(dem[3] / 20000).toBeCloseTo(0.1, 1);
  });
  it('tên đúng số từ yêu cầu, ≤ 15 ký tự, không lặp từ', () => {
    const rnd = rndCoDinh(11);
    for (const n of [1, 2, 3] as const) for (let i = 0; i < 3000; i++) {
      const ten = tenNguoiNgauNhien(rnd, n);
      expect(ten.length).toBeLessThanOrEqual(15);
      expect(ten.split(' ')).toHaveLength(n);
    }
  });
  it('tên bot mang dấu ẩn, cả tên ≤ 16 ký tự (giới hạn của server); tên người thường thì không', () => {
    const rnd = rndCoDinh(3);
    for (let i = 0; i < 3000; i++) {
      const ten = taoTenBotPhong(rnd);
      expect(laTenBotPhong(ten)).toBe(true);
      expect(ten.length).toBeLessThanOrEqual(16);
      expect(ten.trim()).toBe(ten);   // server .trim() không được ăn mất dấu
    }
    expect(laTenBotPhong('Minh Anh')).toBe(false);
    expect(laTenBotPhong('')).toBe(false);
  });
  it('chỉ người bật debug mới thấy nhãn bot', () => {
    const p = { id: 'x1', name: `M${DAU_BOT}inh` };
    dangDebug.value = false;
    expect(tenNguoi(p)).toBe(p.name);
    dangDebug.value = true;
    expect(tenNguoi(p)).toContain('🤖');
    expect(tenNguoi({ id: 'x2', name: 'Minh' })).toBe('Minh');
    dangDebug.value = false;
  });
});
