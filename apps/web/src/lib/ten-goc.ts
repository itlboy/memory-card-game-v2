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
export const DO_DAI_TOI_DA = 16;

const boc = <T>(ds: readonly T[], r: () => number): T => ds[Math.floor(r() * ds.length)]!;

/** Một tên ngẫu nhiên (≤ 16 ký tự) theo ngôn ngữ. `r` để test cố định. */
export function taoTen(lang: string, r: () => number = Math.random): string {
  const vi = lang.toLowerCase().startsWith('vi');
  const b = vi ? VI : EN;
  for (let i = 0; i < 50; i++) {
    const loai = boc(b.loai, r), mau = boc(b.mau, r), net = boc(b.net, r);
    const ten = vi ? `${loai} ${mau} ${net}` : `${net} ${mau} ${loai}`;
    if (ten.length <= DO_DAI_TOI_DA) return ten;
  }
  return vi ? 'Sóc Đỏ Nhỏ' : 'Tiny Red Fox';
}

/** Số tổ hợp của một ngôn ngữ (để biết độ "khó trùng"). */
export const soToHop = (lang: string): number => {
  const b = lang.toLowerCase().startsWith('vi') ? VI : EN;
  return b.loai.length * b.mau.length * b.net.length;
};
