import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * NÚT BACK ANDROID (14.10.2026): thiếu plugin @capacitor/app là Back ở wizard thoát
 * thẳng app. Nay còn lịch sử thì lùi (useBackGuard đóng đúng một thứ), trang chủ thì
 * Back lần nữa trong 2 giây mới thoát.
 */
const exitApp = vi.fn();
let nghe: ((e: { canGoBack: boolean }) => void) | undefined;
vi.mock('@/lib/native', () => ({ nenApp: 'android', laApp: true }));
vi.mock('@capacitor/app', () => ({
  App: { addListener: (_: string, f: typeof nghe) => { nghe = f; return Promise.resolve({ remove() {} }); }, exitApp }
}));

afterEach(() => { vi.useRealTimers(); });

describe('nút Back Android', () => {
  it('còn bước để lùi thì history.back(), không thoát', async () => {
    const { ganNutBackAndroid } = await import('@/lib/nut-back');
    ganNutBackAndroid();
    await vi.waitFor(() => expect(nghe).toBeTypeOf('function'));
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    nghe!({ canGoBack: true });
    expect(back).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('trang chủ: lần một chỉ báo, lần hai trong 2 giây mới thoát', () => {
    vi.useFakeTimers();
    nghe!({ canGoBack: false });
    expect(exitApp).not.toHaveBeenCalled();
    expect(document.querySelector('.bao-thoat')?.textContent).toBeTruthy();
    vi.advanceTimersByTime(800);
    nghe!({ canGoBack: false });
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it('quá 2 giây thì lần sau lại chỉ báo', () => {
    vi.useFakeTimers();
    exitApp.mockClear();
    vi.advanceTimersByTime(5000);
    nghe!({ canGoBack: false });
    expect(exitApp).not.toHaveBeenCalled();
  });
});
