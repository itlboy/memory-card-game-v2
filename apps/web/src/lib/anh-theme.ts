import { anhEmoji } from './emoji';
import type { CardTheme } from './themes';

/**
 * ẢNH Ô THEME — TẢI TRƯỚC + GIẢI MÃ SẴN (17.10.2026).
 *
 * Lưới chọn theme vẽ 4 hình × 36–72 ô. Để hình hiện CÙNG LÚC (chủ dự án: "load tuần tự gợn sóng"),
 * ThemePicker chờ cả tab giải mã xong mới hiện — nhưng chờ ngay lúc mở bước là ra khoảng trống
 * ("delay một lúc"). Nên tải trước từ TRANG CHỦ lúc máy rảnh (`taiTruocTheme`): tới bước theme
 * hình đã sẵn, hiện tức thì. `daSan` là tập URL đã giải mã, ThemePicker đọc chung.
 */
export const daSan = new Set<string>();
const dangTai = new Map<string, Promise<void>>();

export const urlTheme = (ds: CardTheme[]): string[] =>
  [...new Set(ds.flatMap((x) => x.symbols.slice(0, 4).map((s) => anhEmoji(s, undefined, 128)).filter((u): u is string => !!u)))];

export function taiAnh(u: string): Promise<void> {
  if (daSan.has(u)) return Promise.resolve();
  let p = dangTai.get(u);
  if (!p) {
    const img = new Image();
    img.src = u;
    p = img.decode().then(() => { daSan.add(u); }).catch(() => undefined);
    dangTai.set(u, p);
  }
  return p;
}

/**
 * Tải trước mọi hình ô theme — bắt đầu từ LẦN CHẠM ĐẦU TIÊN (18.10.2026, SEO/tốc độ): ~270 hình
 * ≈ 1 MB. Tải ngay lúc mở trang thì Googlebot và máy đo tốc độ (Lighthouse) cũng phải tải, trang
 * bị chấm nặng; người chơi thì từ trang chủ tới bước theme còn qua ít nhất một lần chạm, đủ thời gian.
 */
let daHen = false;
export function taiTruocTheme(ds: CardTheme[]): void {
  if (daHen || typeof document === 'undefined') return;
  daHen = true;
  const chay = (): void => { for (const u of urlTheme(ds)) void taiAnh(u); };
  document.addEventListener('pointerdown', chay, { once: true, capture: true, passive: true });
  document.addEventListener('keydown', chay, { once: true, capture: true, passive: true });
}
