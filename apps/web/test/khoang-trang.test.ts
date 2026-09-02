import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

/**
 * KHOẢNG TRẮNG TRƯỚC MÃ PHÒNG.
 *
 * Trình biên dịch template của Vue chạy `whitespace: 'condense'`: nó CẮT khoảng
 * trắng ở đầu và cuối phần con của một thẻ. Nên `<b> {{ code }}</b>` viết ra
 * trông có dấu cách, mà chạy lên thành "phòngABC123" dính liền — người chơi báo
 * đúng chuyện này. Mắt đọc mã nguồn không thấy được, phải DỰNG THẬT rồi đọc
 * text mới thấy.
 */
const dung = (tpl: string) => mount(defineComponent({
  template: tpl, data: () => ({ code: 'ABC123' })
})).text();

describe('khoảng trắng quanh mã phòng', () => {
  it('dấu cách thường ở ĐẦU phần con bị Vue cắt mất — đây là cái bẫy', () => {
    expect(dung('<p>phòng<b> {{ code }}</b></p>')).toBe('phòngABC123');
  });

  it('&nbsp; thì giữ được', () => {
    expect(dung('<p>phòng<b>&nbsp;{{ code }}</b></p>')).toBe('phòng ABC123');
  });

  it('màn "đang vào lại phòng" thật sự có khoảng trắng', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'src/components/OnlineScreen.vue'), 'utf8');
    const dong = src.split('\n').find((l) => l.includes('Đang vào lại phòng'))!;
    expect(dong, 'thiếu khoảng trắng trước mã phòng').toContain('&nbsp;{{ codeInput }}');
  });
});
