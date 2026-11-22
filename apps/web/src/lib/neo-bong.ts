/**
 * CHỖ NEO BONG BÓNG CHAT — dùng CHUNG cho bong bóng emoji (EmojiBlast) và bong bóng chữ (LoiNoi).
 * 22.11.2026, chủ dự án: "bong bóng chat chữ cũng hiện trên, vị trí giống hệt với chat icon" — trước đó
 * mỗi component tự tính, chữ nằm DƯỚI chip còn emoji nằm TRÊN. Đổi chỗ neo là đổi Ở ĐÂY, đừng chép lại.
 *
 * MỌI CHỖ ĐỀU TRỎ VÀO AVATAR (19.11.2026): trong ván, phòng chờ, bảng kết quả — bong bóng nằm TRÊN,
 * đuôi chỉ xuống tâm mặt. Kẹp bong bóng vào màn hình rồi dời CHÂN ĐUÔI (`vt`) cho nó vẫn đúng tâm mặt.
 * Bảng kết quả đang mở thì neo vào đó trước: nó phủ kín màn chơi, chip trong ván bị che.
 */
export type NeoBong = { x: number; y: number; nho: boolean; vt: number };

export const thay = (el: Element | null | undefined): DOMRect | null => {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
};

/** Mặt người gửi trong ô neo: `.avatar` (chip trong ván, phòng chờ), `.mat` / `.mat-ct` (bảng kết quả).
 *  Ô CHÍNH LÀ cái mặt (thành viên đội ở bảng kết quả `.mat`, dải đội `.m`) thì lấy chính nó. */
function matCua(o: Element): DOMRect | null {
  if (o.matches('.avatar, .mat, .m')) return thay(o);
  return thay(o.querySelector('.avatar, .mat, .mat-ct'));
}

/**
 * `rong` = bề rộng thật của bong bóng (chữ dài ngắn khác nhau) để kẹp mép phải; bỏ trống = cỡ bong bóng emoji.
 * `y` là chỗ MŨI ĐUÔI — bong bóng tự kéo lên trọn chiều cao mình (`translateY(-100%)`).
 * Không thấy ô neo (khán giả, màn khác đang phủ) → null, component tự xếp ở mép trên kèm tên.
 */
export function timNeoBong(id: string, rong?: number): NeoBong | null {
  const k = CSS.escape(id);
  const kq = document.querySelector(`[data-kq-for="${k}"]`);
  const o = thay(kq) ? kq! : document.querySelector(`[data-chip-for="${k}"]`);
  const ro = thay(o);
  if (!ro) return null;
  const trongVan = o !== kq && !o!.closest('.lobby-list');
  const av = matCua(o!);
  const ten = thay(o!.querySelector('.ten-kq, b'));
  const tam = av ? av.left + av.width / 2 : ten ? ten.left + 18 : ro.left + ro.width / 2;
  // Dòng kết quả / phòng chờ: bong bóng emoji nhỏ (~64px), nằm giữa chữ chứ không giữa khoảng trời trống
  const x = Math.max(Math.min(tam - 24, window.innerWidth - (rong ?? (trongVan ? 110 : 64)) - 8), 8);
  const y = trongVan ? ro.top - 10 : (av ?? ten ?? ro).top - 6;
  return { x, y, nho: !trongVan, vt: Math.max(16, tam - x) };
}
