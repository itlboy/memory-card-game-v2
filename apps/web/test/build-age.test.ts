import { describe, expect, it } from 'vitest';
import { buildAgeText } from '@/lib/format';

const s = 1000, ph = 60 * s, h = 60 * ph, ng = 24 * h;

describe('tuổi bản build thành chữ', () => {
  it('giữ hai đơn vị lớn nhất, không bao giờ hiện đơn vị bằng 0', () => {
    // Đúng ca làm CI đỏ thất thường: phút = 0 nằm GIỮA ngày và giây
    expect(buildAgeText(238 * ng + 15 * h + 56 * s)).toBe('238 ngày 15 giờ trước');
    expect(buildAgeText(3 * ng + 0 * h + 12 * ph)).toBe('3 ngày 12 phút trước');
    expect(buildAgeText(5 * ph + 0 * s)).toBe('5 phút trước');
    expect(buildAgeText(2 * h + 30 * ph + 9 * s)).toBe('2 giờ 30 phút trước');
    expect(buildAgeText(45 * s)).toBe('45 giây trước');
  });

  it('mọi mốc trong một năm đều không chứa "0 <đơn vị>"', () => {
    for (let i = 0; i < 4000; i++) {
      const ms = i * 137 * s + i * i * 31 * ph;   // rải đều, tất định
      expect(buildAgeText(ms), `ms=${ms}`).not.toMatch(/\b0 (ngày|giờ|phút|giây)/);
    }
  });

  it('dưới một giây, hoặc mốc lỗi, thì nói "vừa xong"', () => {
    expect(buildAgeText(0)).toBe('vừa xong');
    expect(buildAgeText(999)).toBe('vừa xong');
    expect(buildAgeText(-5)).toBe('vừa xong');
    expect(buildAgeText(NaN)).toBe('vừa xong');
  });
});
