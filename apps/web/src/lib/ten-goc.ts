/**
 * SINH TÊN NGẪU NHIÊN — phần THUẦN (không import gì, không đụng trình duyệt). Tách khỏi ten-ngau-nhien.ts ngày
 * 22.11.2026 để module bot phòng (`apps/node-server/src/phong-bot.ts`, chạy Node) dùng ĐÚNG bộ tên của người chơi.
 * Luật đặt tên + lý do: xem đầu ten-ngau-nhien.ts. Đổi danh sách ở đây là đổi cho cả người mới lẫn bot.
 */
const VI = {
  loai: ['Sóc', 'Gấu', 'Cáo', 'Mèo', 'Thỏ', 'Hổ', 'Cú', 'Vịt', 'Gà', 'Cá', 'Ếch', 'Khỉ', 'Nai', 'Sói', 'Rùa', 'Hươu',
    'Chuột', 'Heo', 'Công', 'Sẻ', 'Ngựa', 'Dê', 'Bò', 'Voi', 'Báo', 'Cò', 'Ong', 'Cua'],
  mau: ['Đỏ', 'Nâu', 'Cam', 'Vàng', 'Xanh', 'Tím', 'Hồng', 'Trắng', 'Đen', 'Xám', 'Mướp', 'Bạc', 'Đốm', 'Vằn'],
  net: ['Nhỏ', 'Con', 'Mập', 'Lém', 'Lanh', 'Ngố', 'Nhanh', 'Khôn', 'Vui', 'Hiền', 'Liều', 'Lì', 'Tếu', 'Xinh', 'Ú',
    'Lùn', 'Bự', 'Nhí', 'Ngầu', 'Lắc'],
};
const EN = {
  loai: ['Fox', 'Bear', 'Cat', 'Bunny', 'Tiger', 'Owl', 'Duck', 'Frog', 'Monkey', 'Deer', 'Wolf', 'Turtle', 'Mouse',
    'Pig', 'Panda', 'Koala', 'Otter', 'Seal', 'Goat', 'Llama', 'Bee', 'Crab', 'Squirrel', 'Puppy'],
  mau: ['Red', 'Brown', 'Orange', 'Gold', 'Green', 'Blue', 'Purple', 'Pink', 'White', 'Black', 'Gray', 'Silver', 'Spotty', 'Stripy'],
  net: ['Tiny', 'Big', 'Chubby', 'Sly', 'Quick', 'Silly', 'Wise', 'Happy', 'Gentle', 'Brave', 'Cheeky', 'Fluffy',
    'Sleepy', 'Lucky', 'Jolly', 'Bold', 'Cool', 'Zippy', 'Sunny', 'Witty'],
};
/*
 * BẢY NGÔN NGỮ GHÉP TỪ THẲNG ĐƯỢC (22.11.2026, chủ dự án chọn nhóm này trước; "nhớ làm cho cả người mới vào"):
 * id · tr · ja · ko · zh · zh-TW · th — không có giống đực/cái hay đuôi tính từ phải khớp. Nhóm CÓ giống ngữ pháp
 * (es · pt · fr · it · de · ru) làm sau, theo cách riêng — xem khối bên dưới.
 * `truoc`: nét + màu đứng TRƯỚC loài (như tiếng Anh); không thì loài trước (như tiếng Việt). `cach`: dấu nối
 * ('' = viết liền, đúng thói quen tiếng Nhật / Trung / Thái). Từ chọn NGẮN để tên ≤ 16 ký tự.
 * Tên do máy ghép — CHƯA có người bản xứ duyệt; sửa từ nào thì sửa thẳng trong danh sách.
 */
const ID = {
  loai: ['Kucing', 'Rubah', 'Beruang', 'Kelinci', 'Macan', 'Bebek', 'Katak', 'Monyet', 'Rusa', 'Tikus', 'Panda', 'Koala',
    'Kambing', 'Lebah', 'Tupai', 'Ayam', 'Ikan', 'Sapi', 'Gajah', 'Kuda', 'Singa', 'Domba', 'Burung', 'Penyu'],
  mau: ['Merah', 'Cokelat', 'Jingga', 'Emas', 'Hijau', 'Biru', 'Ungu', 'Pink', 'Putih', 'Hitam', 'Abu', 'Perak', 'Belang', 'Totol'],
  net: ['Kecil', 'Besar', 'Gemuk', 'Lincah', 'Cepat', 'Lucu', 'Pintar', 'Ceria', 'Baik', 'Berani', 'Jahil', 'Imut',
    'Mungil', 'Hebat', 'Keren', 'Santai', 'Manis', 'Gesit', 'Riang', 'Kocak'],
};
const TR = {
  loai: ['Tilki', 'Ayı', 'Kedi', 'Tavşan', 'Kaplan', 'Baykuş', 'Ördek', 'Maymun', 'Geyik', 'Kurt', 'Fare', 'Panda',
    'Koala', 'Keçi', 'Arı', 'Yengeç', 'Sincap', 'Kuzu', 'Balık', 'Kuş', 'Aslan', 'Fil', 'Penguen', 'Kirpi'],
  mau: ['Kırmızı', 'Turuncu', 'Altın', 'Yeşil', 'Mavi', 'Mor', 'Pembe', 'Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Benekli', 'Çizgili', 'Sarı'],
  net: ['Minik', 'Koca', 'Tombul', 'Kurnaz', 'Hızlı', 'Şaşkın', 'Bilge', 'Mutlu', 'Nazik', 'Cesur', 'Yaramaz', 'Tüylü',
    'Uykucu', 'Şanslı', 'Neşeli', 'Tatlı', 'Havalı', 'Çevik', 'Zeki', 'Şirin'],
  truoc: true,
};
const JA = {
  loai: ['キツネ', 'クマ', 'ネコ', 'ウサギ', 'トラ', 'フクロウ', 'アヒル', 'カエル', 'サル', 'シカ', 'オオカミ', 'カメ', 'ネズミ',
    'ブタ', 'パンダ', 'コアラ', 'ラッコ', 'アザラシ', 'ヤギ', 'ハチ', 'カニ', 'リス', 'イヌ', 'ペンギン'],
  mau: ['あか', 'ちゃ', 'オレンジ', 'きん', 'みどり', 'あお', 'むらさき', 'もも', 'しろ', 'くろ', 'はい', 'ぎん', 'ぶち', 'しま'],
  net: ['ちび', 'でか', 'ぽちゃ', 'のんびり', 'すばやい', 'おとぼけ', 'かしこい', 'にこにこ', 'やさしい', 'ゆうかん', 'やんちゃ',
    'ふわふわ', 'ねむねむ', 'ラッキー', 'ごきげん', 'げんき', 'クール', 'わんぱく', 'ぴかぴか', 'おちゃめ'],
  truoc: true, cach: '',
};
const KO = {
  loai: ['여우', '곰', '고양이', '토끼', '호랑이', '부엉이', '오리', '개구리', '원숭이', '사슴', '늑대', '거북이', '생쥐',
    '돼지', '판다', '코알라', '수달', '물개', '염소', '꿀벌', '다람쥐', '강아지', '펭귄', '병아리'],
  mau: ['빨간', '갈색', '주황', '금빛', '초록', '파란', '보라', '분홍', '하얀', '까만', '회색', '은빛', '점박이', '줄무늬'],
  net: ['작은', '큰', '통통한', '영리한', '빠른', '엉뚱한', '똑똑한', '행복한', '순한', '용감한', '졸린', '신난', '씩씩한',
    '멋진', '날쌘', '밝은', '귀여운', '착한', '느긋한', '명랑한'],
  truoc: true,
};
const ZH = {
  loai: ['狐狸', '熊', '猫', '兔子', '老虎', '猫头鹰', '鸭子', '青蛙', '猴子', '小鹿', '狼', '乌龟', '老鼠', '小猪', '熊猫',
    '考拉', '水獭', '海豹', '山羊', '蜜蜂', '螃蟹', '松鼠', '小狗', '企鹅'],
  mau: ['红', '棕', '橙', '金', '绿', '蓝', '紫', '粉', '白', '黑', '灰', '银', '花', '斑'],
  net: ['小', '大', '胖', '机灵', '飞快', '呆萌', '聪明', '快乐', '温柔', '勇敢', '调皮', '毛茸茸', '瞌睡', '幸运', '开心',
    '大胆', '酷酷', '活泼', '阳光', '淘气'],
  truoc: true, cach: '',
};
const ZH_TW = {
  loai: ['狐狸', '熊', '貓', '兔子', '老虎', '貓頭鷹', '鴨子', '青蛙', '猴子', '小鹿', '狼', '烏龜', '老鼠', '小豬', '熊貓',
    '無尾熊', '水獺', '海豹', '山羊', '蜜蜂', '螃蟹', '松鼠', '小狗', '企鵝'],
  mau: ['紅', '棕', '橙', '金', '綠', '藍', '紫', '粉', '白', '黑', '灰', '銀', '花', '斑'],
  net: ['小', '大', '胖', '機靈', '飛快', '呆萌', '聰明', '快樂', '溫柔', '勇敢', '調皮', '毛茸茸', '瞌睡', '幸運', '開心',
    '大膽', '酷酷', '活潑', '陽光', '淘氣'],
  truoc: true, cach: '',
};
const TH = {
  loai: ['แมว', 'หมี', 'หมา', 'เสือ', 'กบ', 'ลิง', 'กวาง', 'เต่า', 'หนู', 'หมู', 'แพะ', 'ผึ้ง', 'ปู', 'นก', 'ปลา', 'ช้าง',
    'ม้า', 'เป็ด', 'ไก่', 'วัว', 'แกะ', 'สิงโต', 'แพนด้า', 'กระต่าย'],
  mau: ['แดง', 'น้ำตาล', 'ส้ม', 'ทอง', 'เขียว', 'ฟ้า', 'ม่วง', 'ชมพู', 'ขาว', 'ดำ', 'เทา', 'เงิน', 'ลาย', 'จุด'],
  net: ['น้อย', 'ใหญ่', 'อ้วน', 'ซน', 'ไว', 'ขี้เล่น', 'ฉลาด', 'ร่าเริง', 'ใจดี', 'กล้า', 'ขี้เซา', 'โชคดี', 'สดใส', 'เท่',
    'น่ารัก', 'จอมซน', 'ตัวจิ๋ว', 'ขี้อาย', 'แสนรู้', 'อารมณ์ดี'],
  cach: '',
};

/*
 * SÁU NGÔN NGỮ CÓ GIỐNG NGỮ PHÁP (25.11.2026, chủ dự án: "viết đi"): es · pt · fr · it · de · ru. Cách né sai ngữ pháp:
 * MỌI danh từ đều GIỐNG ĐỰC, mọi tính từ ở dạng giống đực số ít (hoặc dạng không đổi) — ghép cặp nào cũng khớp.
 * THÊM TỪ MỚI PHẢI GIỮ LUẬT NÀY: thêm một danh từ giống cái (it "tigre", ru "панда") là cả loạt tên sai.
 *  - es · pt · fr · it: loài + màu + nét ("Gato Rojo Feliz") — tính từ đứng sau danh từ, đúng thói quen.
 *  - de · ru: HAI TỪ, tính từ + loài ("Flinker Fuchs", "Рыжий Лис") — ba từ không lọt 16 ký tự. `mau: ['']` là ô trống
 *    (ghep bỏ phần rỗng), màu và nét gộp chung vào `net`. Tiếng Đức: tính từ đuôi -er (giống đực, không mạo từ).
 * Tên do máy ghép — CHƯA có người bản xứ duyệt.
 */
const ES = {
  loai: ['Gato', 'Zorro', 'Oso', 'Lobo', 'Pato', 'Mono', 'Tigre', 'Búho', 'León', 'Perro', 'Panda', 'Koala', 'Ratón', 'Cerdo',
    'Burro', 'Pulpo', 'Sapo', 'Pavo', 'Toro', 'Topo', 'Loro', 'Erizo', 'Pez', 'Gallo'],
  mau: ['Rojo', 'Azul', 'Verde', 'Rosa', 'Gris', 'Negro', 'Lila', 'Ocre', 'Malva', 'Pardo', 'Blanco', 'Dorado', 'Café', 'Añil'],
  net: ['Feliz', 'Veloz', 'Audaz', 'Sabio', 'Listo', 'Fiel', 'Genial', 'Alegre', 'Dulce', 'Bravo', 'Fuerte', 'Ágil', 'Noble',
    'Chulo', 'Guay', 'Vivaz', 'Tierno', 'Suave', 'Hábil', 'Gentil'],
};
const PT = {
  loai: ['Gato', 'Urso', 'Lobo', 'Pato', 'Tigre', 'Leão', 'Sapo', 'Panda', 'Coala', 'Rato', 'Porco', 'Burro', 'Polvo', 'Peru',
    'Touro', 'Galo', 'Peixe', 'Macaco', 'Cervo', 'Coelho', 'Grilo', 'Pombo', 'Cão', 'Tatu'],
  mau: ['Azul', 'Verde', 'Rosa', 'Cinza', 'Preto', 'Lilás', 'Roxo', 'Ruivo', 'Bege', 'Branco', 'Dourado', 'Pardo', 'Rubro', 'Anil'],
  net: ['Feliz', 'Veloz', 'Audaz', 'Sábio', 'Fiel', 'Alegre', 'Doce', 'Bravo', 'Forte', 'Ágil', 'Nobre', 'Legal', 'Gentil',
    'Esperto', 'Fofo', 'Calmo', 'Manso', 'Vivo', 'Hábil', 'Leal'],
};
const FR = {
  loai: ['Chat', 'Renard', 'Ours', 'Loup', 'Tigre', 'Hibou', 'Lion', 'Singe', 'Cerf', 'Panda', 'Koala', 'Lapin', 'Cochon', 'Âne',
    'Poulpe', 'Crabe', 'Coq', 'Poisson', 'Chien', 'Canard', 'Castor', 'Zèbre', 'Lynx', 'Lézard'],
  mau: ['Rouge', 'Bleu', 'Vert', 'Rose', 'Gris', 'Noir', 'Blanc', 'Doré', 'Brun', 'Roux', 'Lilas', 'Mauve', 'Beige', 'Jaune'],
  net: ['Joyeux', 'Rapide', 'Sage', 'Malin', 'Fidèle', 'Gentil', 'Doux', 'Brave', 'Fort', 'Agile', 'Noble', 'Chic', 'Rusé',
    'Calme', 'Vif', 'Futé', 'Rigolo', 'Câlin', 'Zen', 'Cool'],
};
const IT = {
  loai: ['Gatto', 'Orso', 'Lupo', 'Gufo', 'Leone', 'Panda', 'Koala', 'Topo', 'Asino', 'Polpo', 'Gallo', 'Pesce', 'Cane', 'Cervo',
    'Riccio', 'Tasso', 'Falco', 'Corvo', 'Grillo', 'Cigno', 'Ghiro', 'Merlo', 'Picchio', 'Granchio'],
  mau: ['Rosso', 'Blu', 'Verde', 'Rosa', 'Grigio', 'Nero', 'Bianco', 'Dorato', 'Bruno', 'Viola', 'Lilla', 'Giallo', 'Beige', 'Azzurro'],
  net: ['Felice', 'Veloce', 'Saggio', 'Furbo', 'Fedele', 'Gentile', 'Dolce', 'Bravo', 'Forte', 'Agile', 'Nobile', 'Buffo',
    'Calmo', 'Vivace', 'Tenero', 'Astuto', 'Allegro', 'Mite', 'Lesto', 'Fiero'],
};
const DE = {
  loai: ['Fuchs', 'Bär', 'Kater', 'Hase', 'Tiger', 'Uhu', 'Frosch', 'Affe', 'Hirsch', 'Wolf', 'Panda', 'Koala', 'Otter', 'Igel',
    'Dachs', 'Biber', 'Löwe', 'Esel', 'Hund', 'Fisch', 'Krebs', 'Luchs', 'Rabe', 'Pinguin'],
  mau: [''],
  net: ['Roter', 'Blauer', 'Grüner', 'Gelber', 'Grauer', 'Weißer', 'Bunter', 'Goldener', 'Brauner', 'Rosa', 'Lila', 'Kleiner',
    'Großer', 'Flinker', 'Kluger', 'Froher', 'Lieber', 'Mutiger', 'Frecher', 'Müder', 'Wilder', 'Schlauer', 'Netter', 'Cooler',
    'Lustiger', 'Starker', 'Stiller', 'Wacher', 'Sanfter', 'Treuer', 'Dicker', 'Schneller', 'Weiser', 'Toller', 'Süßer',
    'Flotter', 'Heller', 'Tapferer', 'Munterer', 'Fixer'],
  truoc: true,
};
const RU = {
  loai: ['Лис', 'Кот', 'Волк', 'Тигр', 'Лев', 'Ёж', 'Заяц', 'Медведь', 'Енот', 'Бобр', 'Олень', 'Слон', 'Пёс', 'Хомяк', 'Филин',
    'Барсук', 'Краб', 'Жук', 'Кит', 'Гусь', 'Лось', 'Сурок', 'Пингвин', 'Ворон'],
  mau: [''],
  net: ['Рыжий', 'Синий', 'Белый', 'Серый', 'Чёрный', 'Золотой', 'Алый', 'Розовый', 'Зелёный', 'Бурый', 'Малый', 'Большой',
    'Быстрый', 'Умный', 'Весёлый', 'Добрый', 'Смелый', 'Хитрый', 'Сонный', 'Дикий', 'Ловкий', 'Милый', 'Крутой', 'Шустрый',
    'Сильный', 'Тихий', 'Мудрый', 'Храбрый', 'Славный', 'Пушистый', 'Толстый', 'Юркий', 'Бодрый', 'Важный', 'Гордый',
    'Забавный', 'Ласковый', 'Честный', 'Яркий', 'Щедрый'],
  truoc: true,
};

type BoTen = { loai: readonly string[]; mau: readonly string[]; net: readonly string[]; truoc?: boolean; cach?: string };
const BO: Record<string, BoTen> = {
  vi: VI, en: { ...EN, truoc: true }, id: ID, tr: TR, ja: JA, ko: KO, zh: ZH, 'zh-tw': ZH_TW, th: TH,
  es: ES, pt: PT, fr: FR, it: IT, de: DE, ru: RU
};
/** Ngôn ngữ CÓ bộ tên riêng — từ 25.11.2026 là đủ cả 15 ngôn ngữ của app (mã lạ vẫn rơi về tiếng Anh). */
export const NGON_NGU_CO_TEN: readonly string[] = ['vi', 'en', 'id', 'tr', 'ja', 'ko', 'zh', 'zh-TW', 'th', 'es', 'pt', 'fr', 'it', 'de', 'ru'];

/** Bộ tên của một mã ngôn ngữ: khớp nguyên mã trước (zh-TW ≠ zh), rồi tới hai chữ đầu, không có thì tiếng Anh. */
function boCua(lang: string): BoTen {
  const l = lang.toLowerCase();
  return BO[l] ?? BO[l.slice(0, 2)] ?? BO.en!;
}

export const DO_DAI_TOI_DA = 16;

const boc = <T>(ds: readonly T[], r: () => number): T => ds[Math.floor(r() * ds.length)]!;

const ghep = (b: BoTen, loai: string, mau: string, net: string): string =>
  (b.truoc ? [net, mau, loai] : [loai, mau, net]).filter(Boolean).join(b.cach ?? ' ');   // ô rỗng = bộ hai từ (de, ru)

/** Một tên ngẫu nhiên (≤ 16 ký tự) theo ngôn ngữ. `r` để test cố định. */
export function taoTen(lang: string, r: () => number = Math.random): string {
  const b = boCua(lang);
  for (let i = 0; i < 50; i++) {
    const ten = ghep(b, boc(b.loai, r), boc(b.mau, r), boc(b.net, r));
    if (ten.length <= DO_DAI_TOI_DA) return ten;
  }
  // Dự phòng (r() hỏng / bị giả thành hằng số trong test): tổ hợp ĐẦU TIÊN vừa độ dài — không trả ghép cứng loai[0]+mau[0]+net[0]
  // (CI 28.11.2026: ghép cứng ra 18 ký tự, vượt ô tên 16).
  for (const loai of b.loai) for (const mau of b.mau) for (const net of b.net) {
    const ten = ghep(b, loai, mau, net);
    if (ten.length <= DO_DAI_TOI_DA) return ten;
  }
  return ghep(b, b.loai[0]!, b.mau[0]!, b.net[0]!).slice(0, DO_DAI_TOI_DA);
}

/** Số tổ hợp của một ngôn ngữ (để biết độ "khó trùng"). */
export const soToHop = (lang: string): number => {
  const b = boCua(lang);
  return b.loai.length * b.mau.length * b.net.length;
};

/**
 * Tên này có phải do `taoTen` GHÉP RA không (25.11.2026, hồ sơ người chơi: người cũ còn mang tên tự sinh thì phải gõ
 * tên thật ở màn chào). Không lưu cờ nào từ trước, nên nhận ra bằng cách thử mọi bộ từ: tên đúng bằng loài + màu + nét
 * (theo thứ tự + dấu nối của ngôn ngữ đó). Ai TỰ GÕ trùng y kiểu đó thì bị hỏi lại một lần — vô hại.
 */
export function laTenTuSinh(ten: string): boolean {
  const s = ten.trim();
  if (!s) return false;
  for (const b of Object.values(BO)) {
    for (const loai of b.loai) {
      if (!s.includes(loai)) continue;
      for (const mau of b.mau) {
        if (!s.includes(mau)) continue;
        for (const net of b.net) if (ghep(b, loai, mau, net) === s) return true;
      }
    }
  }
  return false;
}
