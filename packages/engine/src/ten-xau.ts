/**
 * CHẶN TÊN BẬY (28.11.2026, chủ dự án: "xây dựng cơ chế để chặn những cái tên bất lịch sự, bậy bạ của người dùng, để tránh
 * việc nó bị hiển thị lên bảng xếp hạng thì rất là nguy hiểm").
 *
 * DÙNG CHUNG cho mọi nơi tên người chơi lộ ra người khác: bảng xếp hạng (node-server taikhoan), tên trong phòng online
 * (server room.ts), sảnh / danh sách mời (sanh.ts), và ô đặt tên trong app (báo "tên không phù hợp", không cho lưu).
 * Server lọc LÚC TRẢ RA nên cả tên bậy đã nằm sẵn trong DB cũng bị che — không cần dọn DB.
 *
 * Cách dò (thuần, tất định — không Date/Math.random):
 *   1. chuẩn hoá: thường hoá, bỏ dấu tiếng Việt (đ → d), đổi chữ lách (0→o 1→i 3→e 4→a 5→s 7→t @→a $→s), gộp chữ lặp
 *      ("fuuuck" → "fuck");
 *   2. CHUỖI DÀI, ĐẶC TRƯNG (`TU_TRONG`): tìm ở bất kỳ đâu trong tên đã bỏ hết dấu cách / dấu chấm ("f.u.c.k", "con cac");
 *   3. TỪ NGẮN dễ trùng tên thật (`TU_RIENG` — "lon" nằm trong "Long", "cac" trong "Ca Cac"…): chỉ chặn khi ĐỨNG RIÊNG thành
 *      một chữ, hoặc khi cả tên chỉ là từ đó.
 * Thêm từ: thêm vào đúng danh sách (đã CHUẨN HOÁ: không dấu, thường, không chữ lặp) + thêm ca vào test/ten-xau.test.ts.
 * Chặn oan tên người còn tệ hơn lọt một từ hiếm — từ nào có thể là một phần tên thật thì cho vào `TU_RIENG`, không vào `TU_TRONG`.
 */

/** Dò ở BẤT KỲ ĐÂU trong tên (đã bỏ dấu cách). Chỉ chuỗi KHÔNG thể là một phần tên người. */
const TU_TRONG = [
  // tiếng Việt (viết liền / viết tắt)
  'ditme', 'ditm', 'ditcon', 'ditbo', 'dume', 'duma', 'dumay', 'dumai', 'dcm', 'dkm', 'dmm', 'vcl', 'vkl', 'vcc', 'clgt', 'cailon',
  'conlon', 'concac', 'cucac', 'occho', 'occac', 'oclon', 'thangcho', 'concho', 'nguvl', 'phochet', 'divcl', 'loz',
  // tiếng Anh
  'fuck', 'fuk', 'fck', 'phuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'pussy', 'asshole',
  'penis', 'vagina', 'porn', 'motherf', 'dickhead', 'rapist', 'hitler', 'nazi', 'retard',
  // vài ngôn ngữ store đang có (từ rất bậy, viết không dấu)
  'puta', 'puto', 'pendejo', 'mierda', 'cabron', 'caralho', 'porra', 'merde', 'connard', 'salope', 'scheisse', 'arschloch',
  'cazzo', 'stronzo', 'suka', 'blyat', 'pizdec', 'kontol', 'memek', 'anjing', 'bangsat', 'ngentot', 'kimak', 'puki'
];
/** Chỉ chặn khi ĐỨNG RIÊNG thành một chữ VIẾT KHÔNG DẤU (hoặc cả tên là nó): dễ trùng một phần tên / chữ thường. */
const TU_RIENG = new Set([
  'lon', 'cac', 'buoi', 'dit', 'deo', 'dm', 'dmm', 'dcm', 'vl', 'cl', 'cave', 'cock', 'sex', 'xxx', 'tits', 'boobs', 'cum', 'fag', 'kys'
]);
/** Từ tiếng Việt CÓ DẤU bậy — so đúng dấu: "các", "buổi", "lôc" là chữ thường, "cặc", "buồi", "lồn" mới bậy. */
const VN_BAY = new Set(['cặc', 'lồn', 'buồi', 'địt', 'đéo', 'đĩ', 'đụ', 'đm', 'đmm', 'đcm', 'đkm']);

const LACH: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const boDau = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const gop = (s: string): string => s.replace(/([a-z])\1+/g, '$1');

/** Chuẩn hoá: thường, bỏ dấu, đ → d, chữ lách → chữ. Giữ dấu cách / dấu câu (để tách chữ). KHÔNG gộp chữ lặp (xem `gop`). */
export function chuanHoaTen(ten: string): string {
  return boDau(String(ten ?? '').toLowerCase()).replace(/[013457@$!]/g, (c) => LACH[c] ?? c);
}

/** Tên có chữ bậy không. */
export function laTenXau(ten: string): boolean {
  const thuong = String(ten ?? '').toLowerCase().normalize('NFC');
  const c = chuanHoaTen(thuong);
  const lien = c.replace(/[^a-z]/g, '');
  if (!lien) return false;
  // Chuỗi dài: tìm trong cả dạng nguyên ("occho") lẫn dạng gộp chữ lặp ("fuuuck" → "fuck")
  const lienGop = gop(lien);
  if (TU_TRONG.some((t) => lien.includes(t) || lienGop.includes(t))) return true;
  // "Có dấu" = có dấu thanh / mũ thật (không tính đ): "Các" là chữ thường, còn "đm", "đit" viết không dấu vẫn bị xét
  const coDau = (w: string): boolean => /[\u0300-\u036f]/.test(w.normalize('NFD'));
  // Từng chữ của tên GỐC (còn dấu)
  for (const w of thuong.split(/[^\p{L}\p{N}@$!]+/u).filter(Boolean)) {
    if (VN_BAY.has(w)) return true;
    const a = chuanHoaTen(w).replace(/[^a-z]/g, '');
    if (!coDau(w) && (TU_RIENG.has(a) || TU_RIENG.has(gop(a)))) return true;
  }
  // Cả tên viết rời từng chữ cái ("đ.m", "x x x") — chỉ khi tên không có dấu
  return !coDau(thuong) && (TU_RIENG.has(lien) || TU_RIENG.has(lienGop));
}

/** Tên thay thế khi tên gốc bậy — không mang ngôn ngữ nào, ai đọc cũng hiểu là đã bị che. */
export const TEN_CHE = '***';

/** Tên an toàn để HIỆN cho người khác: bậy thì thành `TEN_CHE`. */
export const tenAnToan = (ten: string): string => (laTenXau(ten) ? TEN_CHE : ten);
