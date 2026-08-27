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

/**
 * Tuổi bản build thành chữ: "238 ngày 15 giờ trước", "3 phút 12 giây trước".
 *
 * Chỉ giữ HAI đơn vị lớn nhất khác 0. Bản cũ liệt kê cả bốn và chỉ cắt các đơn
 * vị 0 Ở ĐẦU, nên một đơn vị 0 nằm GIỮA vẫn hiện ra: "238 ngày 15 giờ 0 phút
 * 56 giây trước". Chuyện đó chỉ xảy ra đúng phút thứ 0 của mỗi giờ nên test đỏ
 * thất thường theo giờ chạy CI — và với bản build 238 ngày tuổi thì số giây
 * cũng chẳng ai cần đọc.
 */
export function buildAgeText(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'vừa xong';
  const giay = Math.floor(ms / 1000);
  const phan = [
    { n: Math.floor(giay / 86400), ten: 'ngày' },
    { n: Math.floor((giay % 86400) / 3600), ten: 'giờ' },
    { n: Math.floor((giay % 3600) / 60), ten: 'phút' },
    { n: giay % 60, ten: 'giây' }
  ];
  // Hai đơn vị KHÁC 0 đầu tiên, bỏ qua đơn vị 0 nằm giữa: "3 ngày 0 giờ 12 phút"
  // đọc thành "3 ngày 12 phút", không phải "3 ngày" — giữ được thông tin mà vẫn
  // không bao giờ in ra một số 0.
  const co = phan.filter((p) => p.n > 0).slice(0, 2);
  if (!co.length) return 'vừa xong';
  return `${co.map((p) => `${p.n} ${p.ten}`).join(' ')} trước`;
}
