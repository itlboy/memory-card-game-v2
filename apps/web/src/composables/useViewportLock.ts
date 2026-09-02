import { onBeforeUnmount, onMounted } from 'vue';

/**
 * KHOÁ CHIỀU CAO THẬT CỦA VIEWPORT VÀ KÉO DOCUMENT VỀ MỐC 0.
 *
 * Lỗi người chơi báo (iPhone + Chrome): tắt Chrome, mở lại, Chrome tự tải lại
 * trang — header mất, dưới footer có một khoảng trắng, và KHÔNG kéo lại được.
 *
 * Hai chuyện xảy ra cùng lúc, và luật KHÔNG SCROLL của game làm nó thành bế tắc:
 *
 *  1. `100dvh` ĐO LỆCH lúc khôi phục tab. Trình duyệt dựng lại trang trước khi
 *     chốt xong chiều cao thanh URL / thanh công cụ, nên `#app` cao hơn phần
 *     thật sự nhìn thấy. Phần dôi ra tràn xuống dưới đáy màn hình.
 *  2. Trình duyệt KHÔI PHỤC LUÔN VỊ TRÍ CUỘN của lần trước (`scrollRestoration`
 *     mặc định là 'auto'). Document bị đẩy lên một khoảng — đó chính là cái
 *     "header mất": nó nằm phía trên vùng nhìn thấy.
 *
 * Bình thường người dùng chỉ cần kéo một cái là về. Nhưng `html, body { overflow:
 * hidden }` (chốt chặn của luật KHÔNG SCROLL) khoá luôn đường thoát đó, nên
 * trang đứng nguyên ở trạng thái lệch tới khi tải lại lần nữa. Vì vậy phải TỰ
 * kéo về, không thể trông vào người chơi.
 *
 * Cách chữa: đo chiều cao bằng JS rồi ghi vào `--app-h` (CSS đọc biến này,
 * `100dvh` chỉ còn là giá trị dự phòng), và đặt lại `scrollTop` về 0. Làm lại ở
 * MỌI lối trang có thể hiện lại: `pageshow` (kể cả từ cache back-forward),
 * `visibilitychange`, `focus`, `resize`, `orientationchange`.
 *
 * Vì sao dùng `innerHeight` mà không phải `visualViewport.height`:
 * `visualViewport` CO LẠI khi bàn phím ảo mở, nên lấy nó là đang gõ tên phòng
 * thì cả app tự thu nhỏ. `innerHeight` là chiều cao layout — đúng thứ `dvh`
 * muốn nói, chỉ là nó đáng tin hơn ở khoảnh khắc khôi phục tab.
 */
export function useViewportLock(): void {
  /** Chiều cao vừa ghi — chỉ ghi lại khi đổi thật, để không đụng style mỗi frame. */
  let daGhi = -1;

  function doVaKhoa(): void {
    const h = Math.round(window.innerHeight);
    if (h > 0 && h !== daGhi) {
      daGhi = h;
      document.documentElement.style.setProperty('--app-h', `${h}px`);
    }
    veMocKhong();
  }

  /**
   * Kéo document về 0 ở CẢ BA chỗ có thể giữ offset: `window`,
   * `document.scrollingElement` (html ở chế độ chuẩn) và `body` (một số bản
   * WebKit cũ vẫn cuộn ở body). Thiếu chỗ nào là còn đúng chỗ đó giữ lệch.
   */
  function veMocKhong(): void {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    const el = document.scrollingElement;
    if (el && el.scrollTop !== 0) el.scrollTop = 0;
    if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
  }

  const khiHien = (): void => {
    if (document.hidden) return;
    doVaKhoa();
    // Đo LẠI sau một nhịp: lúc vừa hiện lại, thanh URL của Safari/Chrome còn
    // đang trượt nên số đo đầu tiên vẫn là số cũ.
    requestAnimationFrame(doVaKhoa);
    setTimeout(doVaKhoa, 250);
  };

  onMounted(() => {
    // Đừng để trình duyệt tự khôi phục vị trí cuộn: trang này không cuộn, nên
    // mọi offset nó nhớ đều là rác — và là nguyên nhân "header mất".
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    doVaKhoa();
    window.addEventListener('resize', doVaKhoa);
    window.addEventListener('orientationchange', khiHien);
    window.addEventListener('pageshow', khiHien);
    window.addEventListener('focus', khiHien);
    document.addEventListener('visibilitychange', khiHien);
    // Trang không cuộn, nên mọi lần scroll xảy ra được đều là lệch: kéo về ngay.
    window.addEventListener('scroll', veMocKhong, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', doVaKhoa);
    window.removeEventListener('orientationchange', khiHien);
    window.removeEventListener('pageshow', khiHien);
    window.removeEventListener('focus', khiHien);
    document.removeEventListener('visibilitychange', khiHien);
    window.removeEventListener('scroll', veMocKhong);
  });
}
