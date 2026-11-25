import { t } from './i18n';

/**
 * Gợi ý số thật của tuỳ chọn do ENGINE sinh bằng tiếng Việt ("5 mạng", "30 giây", "xáo 3 lần", "4 thẻ") → câu theo ngôn
 * ngữ đang chọn. Trước 25.11.2026 chỗ này chỉ thay mẫu sang tiếng Anh, nên 13 ngôn ngữ còn lại thấy "5 lives", "30s"
 * (lượt rà bản dịch: chủ dự án hỏi "app có chỗ nào thiếu bản dịch không"). Mẫu lạ thì trả nguyên văn.
 */
export function dichGoiYTuyChon(s: string | null): string | null {
  if (!s) return s;
  let m: RegExpExecArray | null;
  if ((m = /^xáo (\d+) lần$/.exec(s))) return t('opt.goiY.xao', { n: Number(m[1]) }); // i18n-bo-qua — mẫu của engine là thứ ĐI DỊCH
  if ((m = /^(\d+) mạng$/.exec(s))) return t('opt.goiY.mang', { n: Number(m[1]) }); // i18n-bo-qua
  if ((m = /^(\d+) giây$/.exec(s))) return t('opt.goiY.giay', { n: Number(m[1]) }); // i18n-bo-qua
  if ((m = /^(\d+) thẻ$/.exec(s))) return t('opt.goiY.the', { n: Number(m[1]) }); // i18n-bo-qua
  return s;
}
