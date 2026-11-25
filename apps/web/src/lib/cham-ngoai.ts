import type { Directive } from 'vue';

/**
 * `v-cham-ngoai="dong"` — CHẠM NỀN hộp thoại là đóng NGAY lúc nhấc ngón tay (25.11.2026, chủ dự án: "khi có popup mà bấm
 * ra ngoài thì một lúc sau popup mới bị ẩn").
 *
 * Nền hộp thoại là một <div>, không phải nút. Trên iPhone (WKWebView) `click` của vùng không-phải-nút đến TRỄ ~1/3 giây
 * (máy chờ xem có chạm hai lần không); nút ✕ thì không trễ — đúng triệu chứng được báo. Giả lập cảm ứng trên máy tính
 * KHÔNG tái hiện được (đo 2–3 ms), nên đây là sửa theo cơ chế chứ chưa đo được trên máy thật.
 * Cách làm: tự đóng ở `touchend`, không chờ `click`. Ba điều phải giữ:
 *  · CHỈ khi chạm bắt đầu và kết thúc trên CHÍNH NỀN (touch event bắn về phần tử lúc chạm xuống) — chạm trong hộp không đóng.
 *  · Ngón tay trượt quá `XE_DICH` px là đang kéo/cuộn, không phải chạm.
 *  · `preventDefault()` ở touchend để máy KHÔNG sinh `click` muộn nữa: nền vừa biến mất, cú click đó sẽ rơi trúng nút
 *    nằm bên dưới ("bấm xuyên") — chạm ra ngoài để đóng mà lại mở luôn Chơi nhanh.
 * Chuột (máy tính) không có touch → vẫn đi đường `@click.self` sẵn có; hai đường không chồng nhau vì đã chặn click.
 */
const XE_DICH = 12;
type Nen = HTMLElement & { _chamNgoai?: { dong: () => void; go: () => void } };

export const vChamNgoai: Directive<Nen, () => void> = {
  mounted(el, binding) {
    let x = 0, y = 0, hopLe = false;
    const bat = (e: TouchEvent): void => {
      const t = e.touches[0];
      hopLe = e.target === el && e.touches.length === 1 && !!t;
      if (t) { x = t.clientX; y = t.clientY; }
    };
    const tha = (e: TouchEvent): void => {
      const duoc = hopLe && e.target === el;
      hopLe = false;
      const t = e.changedTouches[0];
      if (!duoc || !t || Math.hypot(t.clientX - x, t.clientY - y) > XE_DICH) return;
      e.preventDefault();
      el._chamNgoai?.dong();
    };
    const huy = (): void => { hopLe = false; };
    el.addEventListener('touchstart', bat, { passive: true });
    el.addEventListener('touchend', tha, { passive: false });
    el.addEventListener('touchcancel', huy, { passive: true });
    el._chamNgoai = {
      dong: binding.value,
      go: () => { el.removeEventListener('touchstart', bat); el.removeEventListener('touchend', tha); el.removeEventListener('touchcancel', huy); }
    };
  },
  updated(el, binding) { if (el._chamNgoai) el._chamNgoai.dong = binding.value; },
  unmounted(el) { el._chamNgoai?.go(); delete el._chamNgoai; }
};
