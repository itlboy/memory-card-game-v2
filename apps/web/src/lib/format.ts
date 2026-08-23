export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Điểm có dấu phân nhóm: "12.480" dễ đọc hơn "12480" khi điểm lên vạn.
 *  Dùng dấu chấm theo quy ước tiếng Việt. */
export const num = (n: number): string => Math.round(n).toLocaleString('vi-VN');

/**
 * Số gọn cho chỗ hẹp: 90.000 → "90k", 1.250.000 → "1,3tr".
 *
 * Vì sao cần: huy hiệu điểm trên thanh trên cùng dùng chung một hàng với tên
 * game. Điểm lên sáu chữ số là huy hiệu phình ra và cắt mất chữ "Lật Thẻ" — đo
 * trên iPhone SE: khung tên chỉ còn 85px cho chữ cần 103px. Giá trị đầy đủ vẫn
 * nằm trong tooltip nên không mất thông tin.
 */
export const numShort = (n: number): string => {
  const v = Math.round(n);
  if (v < 10_000) return v.toLocaleString('vi-VN');
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
};
