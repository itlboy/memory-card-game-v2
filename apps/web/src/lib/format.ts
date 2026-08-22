export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Điểm có dấu phân nhóm: "12.480" dễ đọc hơn "12480" khi điểm lên vạn.
 *  Dùng dấu chấm theo quy ước tiếng Việt. */
export const num = (n: number): string => Math.round(n).toLocaleString('vi-VN');
