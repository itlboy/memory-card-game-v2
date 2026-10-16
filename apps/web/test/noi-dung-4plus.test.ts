/**
 * APP 4+ / MỌI LỨA TUỔI — CHẶN NỘI DUNG NHẠY CẢM TRONG BỘ HÌNH (chủ dự án 16.10.2026, sau khi
 * thấy ♋ "trông như 69"; rà ra thêm 🏩 love hotel trong theme MIỄN PHÍ). Ba lớp:
 *   1. CẤM HẲN ở mọi theme: vũ khí/chất nổ, rượu bia, thuốc lá, kim tiêm, cờ bạc, 18+, cử
 *      chỉ thô, và hình dễ đọc nhầm (♋ ≈ "69").
 *   2. CỜ: chỉ quốc gia THÀNH VIÊN LIÊN HỢP QUỐC, và không thuộc nhóm tranh chấp/xung đột
 *      chính trị (Đài Loan, Kosovo, Palestine, Israel, Tây Sahara, Hồng Kông, Ma Cao, Triều
 *      Tiên). Cờ Việt Nam Cộng hoà không có trong Unicode — đừng bao giờ thêm bằng ảnh tự vẽ.
 *   3. CHỈ Ở THEME PREMIUM (đang ẩn, `banPremium`): kinh dị/chết chóc, thuốc, bài lá. Bật bán
 *      Premium là PHẢI khai lại Age Rating (Apple) + IARC (Google) — CLAUDE.md "APP LÀ 4+".
 * Thêm emoji mới vào theme mà đỏ ở đây: đổi emoji, đừng nới danh sách nếu chưa hỏi chủ dự án.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Theme { id: string; premium?: boolean; symbols: string[] }
const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/themes.json'), 'utf8')) as Theme[] | { themes: Theme[] };
const THEMES = Array.isArray(raw) ? raw : raw.themes;
const bo = (s: string): string => s.replace(/️/g, '');

const CAM: Record<string, string> = {
  '🔫': 'súng', '🔪': 'dao', '🗡': 'dao găm', '⚔': 'kiếm', '🏹': 'cung tên', '🪓': 'rìu chiến',
  '🧨': 'pháo nổ', '💣': 'bom', '🪤': 'bẫy', '🩸': 'máu',
  '🍺': 'bia', '🍻': 'bia', '🍷': 'rượu vang', '🥂': 'rượu', '🍸': 'cocktail', '🍹': 'cocktail',
  '🍾': 'sâm panh', '🥃': 'rượu mạnh', '🍶': 'rượu sake',
  '🚬': 'thuốc lá', '💉': 'kim tiêm', '🎰': 'máy đánh bạc', '🔞': '18+', '🖕': 'cử chỉ thô',
  '💋': 'môi hôn', '🏩': 'love hotel', '♋': 'trông như "69"', '🍆': 'nghĩa lóng (chỉ được ở veggies)'
};
/** Ngoại lệ có ngữ cảnh rõ ràng: emoji → các theme được phép. */
const NGU_CANH: Record<string, string[]> = { '🍆': ['veggies'] };
const CHI_PREMIUM: Record<string, string> = {
  '💀': 'đầu lâu', '☠': 'đầu lâu xương chéo', '⚰': 'quan tài', '🪦': 'bia mộ', '🧟': 'xác sống',
  '🧛': 'ma cà rồng', '👹': 'quỷ', '👺': 'yêu tinh', '💊': 'thuốc', '🃏': 'bài lá'
};
const LHQ = new Set(('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PA PG PY PE PH PL PT QA KR RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW').split(' '));
const CO_NHAY_CAM = new Set(['TW', 'XK', 'PS', 'IL', 'EH', 'HK', 'MO', 'KP']);
const maCo = (s: string): string | null => {
  const c = [...s].map((x) => x.codePointAt(0)!);
  return c.length === 2 && c.every((v) => v >= 0x1f1e6 && v <= 0x1f1ff) ? String.fromCharCode(...c.map((v) => v - 0x1f1e6 + 65)) : null;
};

describe('bộ hình hợp app 4+', () => {
  it('có đủ dữ liệu để kiểm (ít nhất 40 theme)', () => { expect(THEMES.length).toBeGreaterThan(40); });

  it('không emoji CẤM nào (trừ ngoại lệ có ngữ cảnh)', () => {
    const loi: string[] = [];
    for (const t of THEMES) for (const s of t.symbols) {
      const k = bo(s);
      if (CAM[k] && !(NGU_CANH[k]?.includes(t.id))) loi.push(`${t.id}: ${s} (${CAM[k]})`);
    }
    expect(loi).toEqual([]);
  });

  it('cờ: chỉ thành viên Liên Hợp Quốc, không vùng tranh chấp / xung đột chính trị', () => {
    const loi: string[] = [];
    for (const t of THEMES) for (const s of t.symbols) {
      const m = maCo(s);
      if (!m) continue;
      if (!LHQ.has(m)) loi.push(`${t.id}: ${s} ${m} không phải thành viên LHQ`);
      if (CO_NHAY_CAM.has(m)) loi.push(`${t.id}: ${s} ${m} nhạy cảm chính trị`);
    }
    expect(loi).toEqual([]);
  });

  it('kinh dị / thuốc / bài lá CHỈ ở theme premium (bật bán là phải khai lại độ tuổi)', () => {
    const loi: string[] = [];
    for (const t of THEMES) if (!t.premium) for (const s of t.symbols) {
      if (CHI_PREMIUM[bo(s)]) loi.push(`${t.id} (miễn phí): ${s} (${CHI_PREMIUM[bo(s)]})`);
    }
    expect(loi).toEqual([]);
  });

  it('bản sao server (apps/server/src/themes.ts) cũng không có emoji cấm', () => {
    const src = readFileSync(resolve(process.cwd(), '../server/src/themes.ts'), 'utf8');
    for (const k of ['🏩', '♋', '🔫', '🍺', '🚬', '🎰', '🔞', '🖕', '🇵🇸', '🇹🇼', '🇽🇰', '🇮🇱']) expect(src, k).not.toContain(k);
  });
});
