/**
 * TÊN CỦA BOT PHÒNG THƯỜNG TRỰC (apps/node-server/src/phong-bot.ts) — phần THUẦN, không import gì (Node và web cùng dùng).
 *
 * Chủ dự án 25.11.2026: "bot giờ phải gen tên khác, tạo ra bộ mẫu tên người ở các quốc gia, 1 từ 60%, 2 từ 30%, 3 từ 10%"
 * và "cho người bật chế độ debug biết ai là bot".
 *
 * NHẬN RA BOT: server không biết bot là máy (xem đầu phong-bot.ts) nên không có cờ nào để phát. Bot tự mang DẤU trong
 * tên: ký tự U+2060 (WORD JOINER — không rộng, không hiện, không phải khoảng trắng nên server không cắt) chèn sau chữ
 * đầu. Người chơi không thấy gì; app đang bật debug thì gắn nhãn (lib/ten.ts). Tên thật ≤ 15 ký tự để cộng dấu vẫn ≤ 16.
 * Đây không phải bí mật: ai soi gói tin cũng thấy — chỉ để chủ dự án phân biệt lúc thử.
 */
export const DAU_BOT = '⁠';
export const laTenBotPhong = (ten: string | null | undefined): boolean => !!ten && ten.includes(DAU_BOT);

interface Bo { ten: string[]; ho: string[]; dem?: string[]; hoTruoc?: boolean; tyLe: number }
const BO: Record<string, Bo> = {
  vi: { tyLe: 22, hoTruoc: true,
    ho: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Phan', 'Võ', 'Ngô'],
    dem: ['Minh', 'Thu', 'Ngọc', 'Đức', 'Quốc', 'Hồng', 'Thanh', 'Gia', 'Bảo', 'Khánh', 'Thị', 'Văn'],
    ten: ['Anh', 'Minh', 'Hà', 'Linh', 'Nam', 'Hùng', 'Trang', 'Hương', 'Tuấn', 'Dũng', 'Lan', 'Mai', 'Phúc', 'Khoa', 'Vy', 'Nhi',
      'Long', 'Hải', 'Thảo', 'Quân', 'Bình', 'My', 'Tú', 'Sơn', 'Hiếu', 'Ngân', 'Duy', 'Trâm', 'Huy', 'Yến'] },
  en: { tyLe: 22,
    ten: ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Lucas', 'Mia', 'Ethan', 'Sophia', 'Mason', 'Lily', 'Jack', 'Chloe',
      'Ryan', 'Zoe', 'Daniel', 'Grace', 'Leo', 'Ella', 'Ben', 'Kate', 'Sam', 'Amy', 'Max', 'Ruby'],
    ho: ['Smith', 'Brown', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Clark', 'Hall', 'Young', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Hill', 'Moore'] },
  es: { tyLe: 7,
    ten: ['Mateo', 'Sofía', 'Diego', 'Lucía', 'Carlos', 'María', 'Pablo', 'Elena', 'Javier', 'Carmen', 'Luis', 'Ana', 'Andrés', 'Paula', 'Miguel', 'Laura'],
    ho: ['García', 'López', 'Pérez', 'Ruiz', 'Torres', 'Díaz', 'Gómez', 'Rojas', 'Vega', 'Cruz', 'Ramos', 'Silva'] },
  pt: { tyLe: 5,
    ten: ['João', 'Ana', 'Pedro', 'Beatriz', 'Lucas', 'Júlia', 'Rafael', 'Camila', 'Bruno', 'Larissa', 'Tiago', 'Marina'],
    ho: ['Silva', 'Santos', 'Costa', 'Souza', 'Lima', 'Rocha', 'Alves', 'Pinto'] },
  fr: { tyLe: 4,
    ten: ['Léa', 'Hugo', 'Chloé', 'Louis', 'Emma', 'Jules', 'Manon', 'Lucas', 'Camille', 'Théo', 'Inès', 'Nathan'],
    ho: ['Martin', 'Bernard', 'Dubois', 'Petit', 'Moreau', 'Laurent', 'Roux', 'Blanc'] },
  de: { tyLe: 4,
    ten: ['Lukas', 'Anna', 'Felix', 'Lena', 'Jonas', 'Mia', 'Paul', 'Laura', 'Max', 'Sophie', 'Tim', 'Hannah'],
    ho: ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Becker', 'Koch', 'Wolf', 'Braun'] },
  it: { tyLe: 3,
    ten: ['Luca', 'Giulia', 'Marco', 'Sara', 'Matteo', 'Chiara', 'Andrea', 'Elisa', 'Paolo', 'Marta'],
    ho: ['Rossi', 'Russo', 'Ferrari', 'Bianchi', 'Romano', 'Gallo', 'Costa', 'Conti'] },
  // Tiếng Nga viết Latinh và chỉ tên nam đi với họ nam (họ nữ đổi đuôi — ghép bừa là sai)
  ru: { tyLe: 4,
    ten: ['Ivan', 'Dima', 'Sasha', 'Oleg', 'Misha', 'Nikita', 'Pavel', 'Artem', 'Maxim', 'Andrey'],
    ho: ['Ivanov', 'Smirnov', 'Popov', 'Volkov', 'Sokolov', 'Orlov', 'Petrov', 'Morozov'] },
  tr: { tyLe: 4,
    ten: ['Emre', 'Elif', 'Can', 'Zeynep', 'Mert', 'Ayşe', 'Burak', 'Selin', 'Kerem', 'Ece', 'Deniz', 'Derya'],
    ho: ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Arslan', 'Polat'] },
  id: { tyLe: 5,
    ten: ['Budi', 'Siti', 'Agus', 'Dewi', 'Rizky', 'Putri', 'Andi', 'Ayu', 'Dimas', 'Rina', 'Fajar', 'Indah'],
    ho: ['Santoso', 'Wijaya', 'Pratama', 'Saputra', 'Lestari', 'Hidayat', 'Susanto', 'Kusuma'] },
  th: { tyLe: 3,
    ten: ['Nok', 'Ploy', 'Ton', 'Mint', 'Bank', 'Fern', 'Beam', 'Mook', 'Game', 'Praew', 'Boss', 'Nam'],
    ho: ['Srisai', 'Boonmee', 'Thongdee', 'Saetang', 'Chaiya', 'Wongsa'] },
  ja: { tyLe: 4,
    ten: ['Haruto', 'Yui', 'Sota', 'Aoi', 'Ren', 'Hina', 'Yuto', 'Sakura', 'Riku', 'Mio', 'Kaito', 'Rin'],
    ho: ['Sato', 'Suzuki', 'Tanaka', 'Ito', 'Kato', 'Yamada', 'Kimura', 'Mori'] },
  ko: { tyLe: 4, hoTruoc: true,
    ten: ['Minjun', 'Seoyeon', 'Jiho', 'Jiwoo', 'Hyun', 'Yuna', 'Jisoo', 'Dohyun', 'Sora', 'Eunji'],
    dem: ['Min', 'Ji', 'Seo', 'Hye', 'Jun', 'Eun'],
    ho: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Lim'] },
  zh: { tyLe: 4, hoTruoc: true,
    ten: ['Wei', 'Jun', 'Mei', 'Hao', 'Xin', 'Yan', 'Lei', 'Jing', 'Tao', 'Ming', 'Lan', 'Fang'],
    dem: ['Xiao', 'Zi', 'Yu', 'Jia', 'Hui', 'Wen'],
    ho: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Wu', 'Zhou'] },
  in: { tyLe: 3,
    ten: ['Arjun', 'Priya', 'Rahul', 'Ananya', 'Rohan', 'Neha', 'Amit', 'Pooja', 'Vikram', 'Kavya', 'Ravi', 'Meera'],
    ho: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair', 'Mehta'] },
  ph: { tyLe: 2,
    ten: ['Juan', 'Maria', 'Paolo', 'Angel', 'Miguel', 'Joy', 'Carlo', 'Grace', 'Jose', 'Bea'],
    ho: ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Ramos'] },
};
export const NUOC_TEN_BOT = Object.keys(BO);
const TONG = Object.values(BO).reduce((s, b) => s + b.tyLe, 0);
const boc = <T>(ds: readonly T[], rnd: () => number): T => ds[Math.floor(rnd() * ds.length)]!;
const boDau = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/** Số từ: 1 từ 60%, 2 từ 30%, 3 từ 10%. */
export function soTuTenBot(rnd: () => number = Math.random): 1 | 2 | 3 {
  const x = rnd();
  return x < 0.6 ? 1 : x < 0.9 ? 2 : 3;
}

function ghep(b: Bo, soTu: 1 | 2 | 3, rnd: () => number): string {
  const ten = boc(b.ten, rnd);
  if (soTu === 1) return ten;
  if (soTu === 2) {
    // Việt: "Minh Anh" (đệm + tên) tự nhiên hơn "Nguyễn Anh"; nước họ-trước khác: họ + tên; còn lại: tên + họ
    if (b.dem && b.hoTruoc && b === BO.vi) return `${boc(b.dem, rnd)} ${ten}`;
    return b.hoTruoc ? `${boc(b.ho, rnd)} ${ten}` : `${ten} ${boc(b.ho, rnd)}`;
  }
  if (b.hoTruoc) return `${boc(b.ho, rnd)} ${boc(b.dem ?? b.ten, rnd)} ${ten}`;
  let hai = boc(b.ten, rnd);
  for (let i = 0; i < 5 && hai === ten; i++) hai = boc(b.ten, rnd);
  return `${ten} ${hai} ${boc(b.ho, rnd)}`;
}

/** Tên KHÔNG kèm dấu bot — để test và để ghép dấu ở `taoTenBotPhong`. */
export function tenNguoiNgauNhien(rnd: () => number = Math.random, soTu: 1 | 2 | 3 = soTuTenBot(rnd)): string {
  // Bốc lại CẢ NƯỚC khi tên quá dài / lặp từ: vài nước tên dài, ba từ hiếm khi lọt 15 ký tự — bốc mãi một nước là kẹt
  let ma = 'en', ten = '';
  for (let i = 0; i < 400; i++) {
    let x = rnd() * TONG;
    for (const k of NUOC_TEN_BOT) { x -= BO[k]!.tyLe; if (x < 0) { ma = k; break; } }
    ten = ghep(BO[ma]!, soTu, rnd);
    if (ten.length <= 15 && new Set(ten.split(' ')).size === soTu) break;
    ten = '';
  }
  if (!ten) { ma = 'en'; ten = ['Sam', 'Sam Hall', 'Sam Amy Hall'][soTu - 1]!; }   // không tới được trong thực tế
  // Như người thật gõ: người Việt hay bỏ dấu; ai cũng có lúc viết thường hết
  if (ma === 'vi' && rnd() < 0.35) ten = boDau(ten);
  if (rnd() < 0.18) ten = ten.toLowerCase();
  return ten;
}

/** Tên bot phòng: tên người + DẤU bot sau chữ đầu. */
export function taoTenBotPhong(rnd: () => number = Math.random): string {
  const ten = tenNguoiNgauNhien(rnd);
  const dau = [...ten][0]!;
  return dau + DAU_BOT + ten.slice(dau.length);
}
