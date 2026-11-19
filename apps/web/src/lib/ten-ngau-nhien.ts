/**
 * TÊN NGẪU NHIÊN CHO NGƯỜI MỚI (19.11.2026, chủ dự án: "gen ra tên ngẫu nhiên… mà không cần lấy tên xấu như
 * 'player1'… tổ hợp 3 thứ kiểu sóc đỏ nhỏ, gấu nâu con… khó bị trùng"; KHÔNG có nút tạo lại tên).
 *
 * Lần đầu mở app mà chưa có tên → tạo LOÀI + MÀU + NÉT theo ngôn ngữ máy (tiếng Việt: "Sóc Đỏ Nhỏ"; mọi ngôn
 * ngữ khác dùng tiếng Anh, tính từ đứng trước: "Tiny Red Squirrel"), lưu vào `playerNames[0]` — CHUNG ô với tên
 * online và tên trên bảng xếp hạng. Tạo một lần rồi giữ, đổi ngôn ngữ không đổi tên; người chơi sửa tay được.
 * Chống trùng: hỏi server (`/api/ten/trong`) trong một loạt ứng viên, lấy cái chưa ai dùng trên bảng xếp
 * hạng — chỉ thay khi người chơi CHƯA tự sửa tên. Mất mạng / server không có tài khoản: giữ tên đã tạo.
 * Mọi tên ≤ 16 ký tự (ô tên + `locTen` của server cắt ở 16).
 */
import { store } from './storage';

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

/**
 * Chưa có tên → đặt tên ngẫu nhiên NGAY (dùng được cả khi mất mạng). `hoiTrong` (nếu có): hỏi server những
 * ứng viên chưa ai dùng — tên vừa đặt bị trùng mà người chơi chưa sửa thì đổi sang ứng viên còn trống.
 */
export async function ganTenNeuChua(lang: string, hoiTrong?: (ds: string[]) => Promise<string[]>): Promise<string | null> {
  const ds = store.playerNames();
  if ((ds[0] ?? '').trim()) return null;
  const ten = taoTen(lang);
  store.savePlayerNames([ten, ...ds.slice(1)]);
  if (!hoiTrong) return ten;
  try {
    const ungVien = [ten, ...Array.from({ length: 7 }, () => taoTen(lang))];
    const trong = await hoiTrong([...new Set(ungVien)]);
    if (trong.includes(ten) || !trong.length) return ten;
    const hienTai = store.playerNames();
    if (hienTai[0] !== ten) return hienTai[0] ?? null;          // người chơi đã tự sửa: không đụng
    store.savePlayerNames([trong[0]!, ...hienTai.slice(1)]);
    return trong[0]!;
  } catch { return ten; }
}
