import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * VUỐT MÉP TRÁI ĐỂ LÙI (app iOS, 25.10.2026): tự làm bằng web vì cử chỉ có sẵn của
 * WKWebView trượt ảnh chụp cũ vào và làm trang cũ nháy lên.
 */
let coChot = true;
vi.mock('@/lib/native', () => ({ nenApp: 'ios', laApp: true }));
vi.mock('@/composables/useBackGuard', () => ({ coTheLui: () => coChot }));

function cham(loai: string, x: number, y = 300): void {
  const e = new Event(loai, { bubbles: true });
  const ds = loai === 'touchend' ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(e, 'touches', { value: ds });
  document.dispatchEvent(e);
}

function vuot(tu: number, den: number): void {
  cham('touchstart', tu);
  for (let x = tu; x <= den; x += 10) cham('touchmove', x);
  cham('touchmove', den);
  cham('touchend', den);
}

beforeAll(async () => {
  const { ganVuotLuiIos } = await import('@/lib/nut-back');
  ganVuotLuiIos();
});

describe('vuốt mép trái để lùi (iOS)', () => {
  it('từ mép, kéo qua ngưỡng rồi thả → history.back() đúng một lần', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    vuot(5, 120);
    expect(back).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.vuot-lui')).toBeNull();
    back.mockRestore();
  });

  it('kéo chưa tới ngưỡng, bắt đầu giữa màn, hay vuốt dọc → không lùi', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    vuot(5, 40);
    vuot(100, 300);
    cham('touchstart', 5, 300);
    cham('touchmove', 20, 400);
    cham('touchmove', 90, 400);
    cham('touchend', 90);
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('mũi tên hiện khi kéo, bị huỷ (touchcancel) thì biến mất và không lùi', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    cham('touchstart', 5);
    cham('touchmove', 100);
    expect(document.querySelector('.vuot-lui.du')).not.toBeNull();
    cham('touchcancel', 100);
    expect(document.querySelector('.vuot-lui')).toBeNull();
    cham('touchend', 100);
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('trang chủ (không có chốt) → không bắt cử chỉ', () => {
    coChot = false;
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    vuot(5, 150);
    expect(back).not.toHaveBeenCalled();
    expect(document.querySelector('.vuot-lui')).toBeNull();
    back.mockRestore();
    coChot = true;
  });
});
