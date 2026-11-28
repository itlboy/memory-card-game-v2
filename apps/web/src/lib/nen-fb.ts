/**
 * CỜ BẢN FACEBOOK + đường dẫn tài nguyên — module RIÊNG, không phụ thuộc gì: nhiều test giả lập
 * trọn `@/lib/native` (vi.mock), thêm export vào đó là hỏng các test ấy.
 */

/**
 * BẢN FACEBOOK INSTANT GAMES (22.11.2026) — cờ LÚC BUILD (`VITE_NEN=facebook`, lệnh `pnpm build:fb`),
 * không dò lúc chạy: web và app build như cũ thì cờ này là `false` hằng số và mọi nhánh `laFacebook`
 * bị Vite cắt khỏi gói. Trong Facebook game chạy trong khung của Meta, origin không phải của mình:
 * không service worker, không OTA, không đăng nhập Google/Apple, không link ra ngoài (Meta cấm đưa
 * người chơi rời game), tài nguyên nằm ở đường dẫn TƯƠNG ĐỐI (gói zip Meta host ở thư mục con).
 *
 * `nenApp` vẫn là 'web' ở bản này: server (phòng, sảnh, thông báo) chỉ biết ios/android/web — thêm
 * giá trị thứ tư phải sửa server trước. Chỗ nào cần phân biệt thì hỏi `laFacebook`.
 */
export const laFacebook: boolean = (import.meta.env.VITE_NEN as string | undefined) === 'facebook';

/**
 * BẢN CỔNG GAME WEB (28.11.2026 — CrazyGames, itch.io…; `VITE_NEN=cong VITE_CONG=<tên cổng>`, lệnh `pnpm build:cong`).
 * Cùng hoàn cảnh với bản Facebook: game chạy trong khung của người khác, ở thư mục con. Luật chung của các cổng
 * (docs/ban-cong.md): đường dẫn tương đối, KHÔNG link cài app / link ra web của mình, KHÔNG đăng nhập ngoài, KHÔNG
 * quảng cáo tự gắn. Bản app và web chính KHÔNG có quảng cáo — cổng nào bắt gắn SDK quảng cáo thì chỉ nằm trong nhánh
 * `laCong` của bản build đó.
 */
export const laCong: boolean = (import.meta.env.VITE_NEN as string | undefined) === 'cong';
/** Tên cổng (chữ thường, không dấu) — đi vào đường dẫn GA `/cong/<tên>` để đo riêng từng cổng. */
export const tenCong: string = laCong ? (((import.meta.env.VITE_CONG as string | undefined) ?? '').replace(/[^a-z0-9-]/g, '') || 'khac') : '';
/** Bản NHÚNG trong khung của bên khác (Facebook hoặc cổng game): mọi thứ chung của hai bản hỏi cờ này. */
export const laNhung: boolean = laFacebook || laCong;

/**
 * Đường dẫn tài nguyên tĩnh (`/img/…`, `/emoji/…`) viết trong CHUỖI JS. Web và app: giữ nguyên.
 * Bản Facebook: `/emoji/` (43 MB, không nhét vào zip) tải từ tên miền web; còn lại đi tương đối
 * theo gói (`./img/…`). Đường dẫn trong CSS `url()` và thuộc tính tĩnh của template thì Vite tự
 * đổi theo `base` — KHÔNG bọc hàm này.
 */
export const GOC_EMOJI_FB = 'https://flipmatch.cozypi.com';
export function tn(duong: string): string {
  if (!laNhung) return duong;
  return duong.startsWith('/emoji/') ? GOC_EMOJI_FB + duong : `.${duong}`;
}
