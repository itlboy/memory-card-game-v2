import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * VUỐT MÉP TRÁI ĐỂ LÙI (app iOS, 25.10.2026): tự làm bằng web vì cử chỉ có sẵn của
 * WKWebView trượt ảnh chụp cũ vào và làm trang cũ nháy lên.
 */
let coChot = true;
vi.mock('@/lib/native', () => ({ nenApp: 'ios', laApp: true }));
vi.mock('@/composables/useBackGuard', () => ({ coTheLui: () => coChot }));
const moc = vi.fn();
vi.mock('@/lib/rung', () => ({ rung: { moc: () => moc() } }));

function cham(loai: string, x: number, y = 300, ts?: number): void {
  const e = new Event(loai, { bubbles: true });
  if (ts !== undefined) Object.defineProperty(e, 'timeStamp', { value: ts });
  const ds = loai === 'touchend' ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(e, 'touches', { value: ds });
  document.dispatchEvent(e);
}

/** Kéo chậm (10px mỗi 50ms) — không thành vuốt nhanh. */
let dongHo = 0;
function vuot(tu: number, den: number): void {
  cham('touchstart', tu, 300, dongHo += 50);
  for (let x = tu; x <= den; x += 10) cham('touchmove', x, 300, dongHo += 50);
  cham('touchmove', den, 300, dongHo += 50);
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

  it('qua ngưỡng thì rung đúng một nhịp, trang co theo ngón rồi trả lại', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
    moc.mockClear();
    cham('touchstart', 5);
    cham('touchmove', 40);
    expect(app.classList.contains('vuot-lui-trang')).toBe(true);
    expect(moc).not.toHaveBeenCalled();
    cham('touchmove', 100);
    cham('touchmove', 120);
    expect(moc).toHaveBeenCalledTimes(1);
    cham('touchend', 120);
    expect(moc).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(app.style.getPropertyValue('--k')).toBe('0');
    app.remove();
    back.mockRestore();
  });

  it('vuốt nhanh chưa tới ngưỡng vẫn lùi (flick), kéo chậm thì không', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    cham('touchstart', 5, 300, 1000);
    cham('touchmove', 20, 300, 1010);
    cham('touchmove', 45, 300, 1030);
    cham('touchend', 45);
    expect(back).toHaveBeenCalledTimes(1);
    cham('touchstart', 5, 300, 2000);
    cham('touchmove', 20, 300, 2200);
    cham('touchmove', 45, 300, 2600);
    cham('touchend', 45);
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
