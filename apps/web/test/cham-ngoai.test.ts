import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, withDirectives } from 'vue';
import { vChamNgoai } from '@/lib/cham-ngoai';

/** Nền có một hộp con bên trong, như mọi hộp thoại. */
function dung(dong: () => void) {
  return mount(defineComponent({
    render: () => withDirectives(h('div', { class: 'nen' }, [h('div', { class: 'hop' }, 'nội dung')]), [[vChamNgoai, dong]])
  }), { attachTo: document.body });
}
/** Bắn một touch event giả lên `dich` (happy-dom không có TouchEvent đủ trường). */
function cham(dich: Element, loai: 'touchstart' | 'touchend', x: number, y: number, soNgon = 1): Event {
  const e = new Event(loai, { bubbles: true, cancelable: true });
  const diem = { clientX: x, clientY: y };
  Object.assign(e, { touches: loai === 'touchstart' ? Array.from({ length: soNgon }, () => diem) : [], changedTouches: [diem] });
  dich.dispatchEvent(e);
  return e;
}

describe('v-cham-ngoai: chạm nền hộp thoại là đóng ngay ở touchend', () => {
  it('chạm xuống rồi nhấc trên NỀN → đóng, và chặn click muộn (không bấm xuyên xuống nút bên dưới)', () => {
    const dong = vi.fn();
    const w = dung(dong);
    cham(w.element, 'touchstart', 50, 50);
    const e = cham(w.element, 'touchend', 52, 51);
    expect(dong).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    w.unmount();
  });

  it('chạm TRONG hộp không đóng, không chặn gì', () => {
    const dong = vi.fn();
    const w = dung(dong);
    const hop = w.element.querySelector('.hop')!;
    cham(hop, 'touchstart', 50, 50);
    const e = cham(hop, 'touchend', 50, 50);
    expect(dong).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    w.unmount();
  });

  it('ngón tay trượt (kéo/cuộn) hoặc chạm hai ngón thì không tính là chạm để đóng', () => {
    const dong = vi.fn();
    const w = dung(dong);
    cham(w.element, 'touchstart', 50, 50);
    cham(w.element, 'touchend', 50, 90);
    cham(w.element, 'touchstart', 50, 50, 2);
    cham(w.element, 'touchend', 50, 50);
    expect(dong).not.toHaveBeenCalled();
    w.unmount();
  });

  it('touchend lẻ (không có touchstart trên nền trước đó) không đóng', () => {
    const dong = vi.fn();
    const w = dung(dong);
    cham(w.element, 'touchend', 50, 50);
    expect(dong).not.toHaveBeenCalled();
    w.unmount();
  });

  it('gỡ hộp thoại thì gỡ luôn bộ nghe', () => {
    const dong = vi.fn();
    const w = dung(dong);
    const el = w.element;
    w.unmount();
    cham(el, 'touchstart', 50, 50);
    cham(el, 'touchend', 50, 50);
    expect(dong).not.toHaveBeenCalled();
  });
});
