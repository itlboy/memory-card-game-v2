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

/** Dò ở BẤT KỲ ĐÂU trong tên (đã bỏ dấu cách, chữ Latin). Chỉ chuỗi KHÔNG thể là một phần tên người. */
const TU_TRONG = [
  // tiếng Việt (viết liền / viết tắt)
  'ditme', 'ditm', 'ditcon', 'ditbo', 'dume', 'duma', 'dumay', 'dumai', 'dcm', 'dkm', 'dmm', 'vcl', 'vkl', 'vcc', 'clgt', 'cailon',
  'conlon', 'concac', 'cucac', 'occho', 'occac', 'oclon', 'thangcho', 'concho', 'nguvl', 'phochet', 'divcl', 'loz',
  // English
  'fuck', 'fck', 'phuck', 'bullshit', 'shithead', 'bitch', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'pussy', 'asshole',
  'penis', 'vagina', 'porn', 'motherf', 'dickhead', 'rapist', 'hitler', 'retard', 'jerkoff', 'blowjob', 'wanker',
  // Español
  'puta', 'puto', 'pendejo', 'mierda', 'cabron', 'gilipollas', 'joder', 'chingada', 'chingar', 'malparido', 'hijueputa',
  // Português
  'caralho', 'buceta', 'filhodaputa', 'arrombado', 'cuzao', 'foder',
  // Français
  'merde', 'connard', 'connasse', 'salope', 'putain', 'encule', 'niquetamere', 'batard',
  // Deutsch
  'scheisse', 'arschloch', 'fotze', 'wichser', 'hurensohn', 'ficken', 'missgeburt',
  // Italiano
  'cazzo', 'stronzo', 'vaffanculo', 'puttana', 'minchia', 'coglione', 'figadituamadre',
  // Русский (chữ Latin)
  'blyat', 'blyad', 'pizdec', 'pizda', 'nahui', 'nahuy', 'yebat', 'mudak', 'pidor', 'pidar',
  // Bahasa Indonesia
  'kontol', 'memek', 'anjing', 'bangsat', 'ngentot', 'kimak', 'jancok', 'jancuk', 'bajingan', 'pepek', 'titit',
  // Türkçe
  'orospu', 'siktir', 'sikis', 'yarrak', 'aminakoy', 'ananisikim', 'pezevenk', 'gavat',
  // 日本語 / 한국어 / ไทย (phiên âm Latin)
  'chinko', 'manko', 'chinpo', 'ssibal', 'shibal', 'sibal', 'byungsin', 'gaesaekki', 'jotna'
];
/** Chỉ chặn khi ĐỨNG RIÊNG thành một chữ (hoặc cả tên là nó): dễ trùng một phần tên / chữ thường ("suka" = "thích" ở
 *  Indonesia và trong "Sukarno"; "nique" trong "Monique"; "amk" trong "Hamka"). Không phân biệt dấu. */
const TU_RIENG = new Set([
  'dm', 'dmm', 'dcm', 'vl', 'cl', 'cave', 'cock', 'sex', 'xxx', 'tits', 'boobs', 'cum', 'fag', 'kys',
  'suka', 'puki', 'nique', 'bite', 'cono', 'culo', 'foda', 'viado', 'fick', 'troia', 'amk', 'aq', 'pic', 'got', 'goblok',   // KHÔNG 'huy'/'hui' (tiếng Nga Latin): trùng tên Việt "Huy" — chữ Nga хуй vẫn chặn
  'xuy', 'eblan', 'kuso', 'baka',
  // dò ở bất kỳ đâu thì chặn oan tên thật: Sop-hia, Amina, Fuk-uda, I-shit-a, Nazi-r, Verga-ra, Porra-s
  'shit', 'fuk', 'nazi', 'verga', 'porra', 'ntm', 'pute', 'hia', 'kuay'   // 'amina' bỏ hẳn: Amina là tên nữ phổ biến ('aminakoy' vẫn dò)
]);
/** Từ ngắn tiếng Việt VIẾT KHÔNG DẤU — chỉ chặn khi chữ đó không mang dấu ("các", "buổi", "lôc" là chữ thường). */
const TU_RIENG_VN = new Set(['lon', 'cac', 'buoi', 'dit', 'deo']);
/** Từ tiếng Việt CÓ DẤU bậy — so đúng dấu: "cặc", "buồi", "lồn" mới bậy. */
const VN_BAY = new Set(['cặc', 'lồn', 'buồi', 'địt', 'đéo', 'đĩ', 'đụ', 'đm', 'đmm', 'đcm', 'đkm']);
/**
 * Chữ KHÔNG phải Latin — dò thẳng trên tên gốc (thường hoá, NFKC, bỏ khoảng trắng): Nga (Cyrillic), Trung (giản + phồn),
 * Nhật (hiragana / katakana / kanji), Hàn, Thái. Bước chuẩn hoá Latin bỏ hết chữ này nên phải có danh sách riêng.
 */
const KHONG_LATIN = [
  // Русский
  'хуй', 'хуё', 'хуе', 'пизд', 'бля', 'ебат', 'ёбан', 'ебан', 'ебал', 'сука', 'сучк', 'мудак', 'мудил', 'пидор', 'пидар', 'гандон', 'залуп', 'шлюх', 'дерьм',
  // 中文 (简 + 繁)
  '操你', '肏', '屄', '傻逼', '傻屄', '煞笔', '鸡巴', '雞巴', '屌', '婊子', '他妈的', '他媽的', '你妈', '你媽', '干你娘', '幹你娘', '王八蛋', '狗日', '去死', '妓女', '贱人', '賤人', '尼玛', '尼瑪', '草泥马', '草泥馬',
  // 日本語
  'ちんこ', 'チンコ', 'まんこ', 'マンコ', 'ちんぽ', 'チンポ', 'セックス', 'ファック', '死ね', 'しね', 'シネ', 'きちがい', 'キチガイ', '売女', 'ヤリマン', 'やりまん',
  // 한국어
  '씨발', '시발', '씨바', '병신', '븅신', '좆', '개새끼', '개새', '새끼', '존나', '섹스', '썅', '니미', '애미', '느금', '보지', '자지',
  // ไทย
  'เหี้ย', 'ควย', 'หี', 'เย็ด', 'สัส', 'ไอ้สัตว์', 'อีดอก', 'ระยำ', 'แม่ง'
];

const LACH: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const boDau = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/ı/g, 'i').replace(/ß/g, 'ss');
const gop = (s: string): string => s.replace(/([a-z])\1+/g, '$1');

/** Chuẩn hoá: thường, bỏ dấu, đ → d, ı → i, chữ lách → chữ. Giữ dấu cách / dấu câu (để tách chữ). KHÔNG gộp chữ lặp. */
export function chuanHoaTen(ten: string): string {
  return boDau(String(ten ?? '').toLowerCase()).replace(/[013457@$!]/g, (c) => LACH[c] ?? c);
}

/** Tên có chữ bậy không (mọi ngôn ngữ của app). */
export function laTenXau(ten: string): boolean {
  const thuong = String(ten ?? '').toLowerCase().normalize('NFKC');
  // Chữ không phải Latin: dò thẳng, bỏ khoảng trắng / dấu câu chen giữa ("씨 발", "хуй.")
  const goc = thuong.replace(/[\s\p{P}\p{S}]+/gu, '');
  if (KHONG_LATIN.some((t) => goc.includes(t))) return true;
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
    if (TU_RIENG.has(a) || TU_RIENG.has(gop(a))) return true;
    if (!coDau(w) && TU_RIENG_VN.has(a)) return true;
  }
  // Cả tên viết rời từng chữ cái ("đ.m", "x x x", "s u k a")
  if (TU_RIENG.has(lien) || TU_RIENG.has(lienGop)) return true;
  return !coDau(thuong) && TU_RIENG_VN.has(lien);
}

/** Tên thay thế khi tên gốc bậy — không mang ngôn ngữ nào, ai đọc cũng hiểu là đã bị che. */
export const TEN_CHE = '***';

/** Tên an toàn để HIỆN cho người khác: bậy thì thành `TEN_CHE`. */
export const tenAnToan = (ten: string): string => (laTenXau(ten) ? TEN_CHE : ten);
