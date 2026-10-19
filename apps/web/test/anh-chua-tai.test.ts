// Lá ngửa mà ảnh 3D CHƯA TẢI XONG: hiện tạm emoji của máy, không bao giờ ô trắng (chủ dự án 19.10.2026:
// "người chơi online trên web vẫn bị trắng khi bấm vào thẻ bài chưa tải"). Ảnh về (@load) thì thay vào.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CardTile from '@/components/CardTile.vue';

const props = (symbol: string) => ({
  card: { index: 0, pairId: 1, symbol }, dealOrder: 0, faceUp: true, matched: false, wrong: false,
  peeking: false, disabled: false, pending: false, coAnh: 256
});

describe('mặt lá chờ ảnh 3D', () => {
  it('chưa tải: emoji máy hiện, ảnh 3D nằm ẩn (vẫn đang tải); tải xong: chỉ còn ảnh 3D', async () => {
    const w = mount(CardTile, { props: props('🦊') });
    const img = w.find('img.emoji');
    expect(img.exists(), 'ảnh 3D phải được gắn để trình duyệt tải').toBe(true);
    expect(img.classes()).toContain('cho');
    expect(w.find('.emoji-tam').text()).toBe('🦊');
    await img.trigger('load');
    expect(w.find('.emoji-tam').exists()).toBe(false);
    expect(w.find('img.emoji').classes()).not.toContain('cho');
  });

  it('lá úp (online chưa được phép biết ký hiệu) không có gì trên mặt — không lộ bài qua emoji tạm', () => {
    const w = mount(CardTile, { props: { ...props(''), faceUp: false } });
    expect(w.find('.emoji-tam').exists()).toBe(false);
    expect(w.find('img.emoji').exists()).toBe(false);
  });
});
