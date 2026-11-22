/**
 * TÊN NGẪU NHIÊN CHO NGƯỜI MỚI (19.11.2026, chủ dự án: "gen ra tên ngẫu nhiên… mà không cần lấy tên xấu như
 * 'player1'… tổ hợp 3 thứ kiểu sóc đỏ nhỏ, gấu nâu con… khó bị trùng"; KHÔNG có nút tạo lại tên).
 *
 * Lần đầu mở app mà chưa có tên → tạo LOÀI + MÀU + NÉT theo ngôn ngữ máy (tiếng Việt: "Sóc Đỏ Nhỏ"; tiếng Anh, tính
 * từ đứng trước: "Tiny Red Squirrel"; từ 22.11.2026 thêm id · tr · ja · ko · zh · zh-TW · th — xem ten-goc.ts; sáu tiếng
 * có giống ngữ pháp es · pt · fr · it · de · ru vẫn dùng tiếng Anh), lưu vào `playerNames[0]` — CHUNG ô với tên
 * online và tên trên bảng xếp hạng. Tạo một lần rồi giữ, đổi ngôn ngữ không đổi tên; người chơi sửa tay được.
 * Chống trùng: hỏi server (`/api/ten/trong`) trong một loạt ứng viên, lấy cái chưa ai dùng trên bảng xếp
 * hạng — chỉ thay khi người chơi CHƯA tự sửa tên. Mất mạng / server không có tài khoản: giữ tên đã tạo.
 * Mọi tên ≤ 16 ký tự (ô tên + `locTen` của server cắt ở 16).
 */
import { store } from './storage';

import { DO_DAI_TOI_DA, soToHop, taoTen } from './ten-goc';

// Phần SINH TÊN thuần (không đụng trình duyệt) nằm ở ten-goc.ts — module bot phòng của server dùng chung.
export { DO_DAI_TOI_DA, soToHop, taoTen };

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
