import { describe, expect, it } from 'vitest';
import { anhHopLe } from '../src/online.js';

describe('anhHopLe — chỉ nhận ảnh máy chủ Google', () => {
  it('nhận ảnh lh3.googleusercontent.com', () => {
    const u = 'https://lh3.googleusercontent.com/a/ACg8ocK_abc-123=s96-c';
    expect(anhHopLe(u)).toBe(u);
  });
  it('từ chối nơi khác, http, ký tự lạ, quá dài', () => {
    for (const u of [
      'https://evil.com/a.png', 'http://lh3.googleusercontent.com/a/x',
      'https://lh3.googleusercontent.com.evil.com/a', 'https://lh3.googleusercontent.com/a/x"onerror=1',
      `https://lh3.googleusercontent.com/${'a'.repeat(600)}`, '', null, undefined
    ]) expect(anhHopLe(u)).toBeUndefined();
  });
});
