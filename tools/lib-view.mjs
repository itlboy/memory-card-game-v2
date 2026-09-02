/**
 * Mở gói `view` cho các bộ smoke.
 *
 * Server gửi view ở dạng gọn: bỏ mảng `cards`, chỉ mang `n` (số ô) và `o`
 * (những ô KHÔNG phải "úp trơn"). Bàn 88 thẻ nhờ vậy từ ~3.000 byte xuống vài
 * trăm — xem `WireView` trong packages/engine/src/online.ts. Bộ smoke đọc
 * `view.cards` khắp nơi nên mở gói ngay tại cửa nhận, đúng như client làm.
 *
 * Nhận cả hai dạng: đã có `cards` thì trả nguyên si.
 */
export function moGoiTin(msg) {
  if ((msg?.t === 'state' || msg?.t === 'events') && msg.view && !msg.view.cards) {
    const { n, o, ...con } = msg.view;
    const tra = new Map(o.map((c) => [c.index, c]));
    const cards = Array.from({ length: n }, (_, i) => tra.get(i) ?? { index: i, state: 'down' });
    return { ...msg, view: { ...con, cards } };
  }
  return msg;
}
