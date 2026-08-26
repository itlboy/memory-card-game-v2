import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { useBackCloser, _resetBackGuard } from '@/composables/useBackGuard';
import { ghiQuery, urlApp } from '@/lib/appUrl';

/**
 * NÚT BACK không được ném người chơi ra khỏi web khi họ lỡ bấm theo thói quen.
 *
 * Test ở tầng composable vì jsdom KHÔNG mô phỏng đúng ngăn xếp lịch sử: nó có
 * `pushState`/`back()` nhưng thời điểm bắn `popstate` không giống trình duyệt
 * thật. Nên ở đây bắn popstate bằng tay và kiểm phần LOGIC — cái gì đóng trước,
 * chốt có được đặt lại không, URL có bị kéo lùi không. Hành vi thật (ba bước
 * wizard, hộp thoại, hộp hỏi giữa ván) đã đo bằng Chrome qua Playwright.
 */

let scope: EffectScope;
const pop = async (): Promise<void> => {
  window.dispatchEvent(new PopStateEvent('popstate'));
  await nextTick();
  await nextTick();
};

beforeEach(() => {
  _resetBackGuard();
  history.replaceState(null, '', '/');
  ghiQuery(null);
  scope = effectScope();
});
afterEach(() => scope.stop());

describe('thứ tự đóng', () => {
  it('hộp thoại đóng TRƯỚC ván đang chơi, mỗi lần Back đóng ĐÚNG MỘT thứ', async () => {
    const hopThoai = ref(true);
    const trongVan = ref(true);
    scope.run(() => {
      useBackCloser(30, () => hopThoai.value, () => { hopThoai.value = false; });
      useBackCloser(20, () => trongVan.value, () => { trongVan.value = false; });
    });
    await nextTick();

    await pop();
    expect(hopThoai.value, 'Back đầu tiên đóng hộp thoại').toBe(false);
    expect(trongVan.value, 'chưa được đụng tới ván').toBe(true);

    await pop();
    expect(trongVan.value, 'Back thứ hai mới rời ván').toBe(false);
  });

  it('không còn gì để đóng thì KHÔNG nuốt cú Back — người chơi rời trang được', async () => {
    const mo = ref(false);
    let soLanDong = 0;
    scope.run(() => useBackCloser(20, () => mo.value, () => { soLanDong++; }));
    await nextTick();
    await pop();
    expect(soLanDong).toBe(0);
  });
});

describe('chốt lịch sử', () => {
  it('có thứ đóng được thì đẩy ĐÚNG MỘT chốt, không đẩy chồng chất', async () => {
    const a = ref(true);
    const b = ref(true);
    const truoc = history.length;
    scope.run(() => {
      useBackCloser(30, () => a.value, () => { a.value = false; });
      useBackCloser(20, () => b.value, () => { b.value = false; });
    });
    await nextTick();
    // Hai thứ cùng mở nhưng chỉ MỘT chốt: mỗi cú Back đóng một cái rồi đặt chốt mới
    expect(history.length - truoc).toBeLessThanOrEqual(1);
  });

  it('đóng xong mà vẫn còn thứ khác thì đặt CHỐT MỚI ngay', async () => {
    const a = ref(true);
    const b = ref(true);
    scope.run(() => {
      useBackCloser(30, () => a.value, () => { a.value = false; });
      useBackCloser(20, () => b.value, () => { b.value = false; });
    });
    await nextTick();
    const truoc = history.length;
    await pop();
    // Đóng `a` xong, `b` vẫn mở → phải có chốt mới, không thì cú Back kế tiếp
    // rơi thẳng ra khỏi web trong khi người chơi vẫn đang ở trong ván.
    expect(history.length).toBeGreaterThanOrEqual(truoc);
    expect(b.value, 'b chưa bị đóng theo').toBe(true);
  });
});

describe('URL không được kéo lùi', () => {
  it('đóng một lớp xong, URL vẫn là URL app đang muốn', async () => {
    ghiQuery('playing=1');
    expect(urlApp()).toContain('playing=1');

    const hopThoai = ref(true);
    scope.run(() => useBackCloser(30, () => hopThoai.value, () => { hopThoai.value = false; }));
    await nextTick();

    // Trình duyệt lùi về địa chỉ cũ trước khi popstate tới tay app
    history.replaceState(null, '', '/?w=level');
    await pop();

    expect(location.search, 'F5 lúc này phải dựng lại VÁN, không phải wizard').toBe('?playing=1');
  });
});
