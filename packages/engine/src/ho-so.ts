/**
 * HỒ SƠ NGƯỜI CHƠI — danh sách DÙNG CHUNG client + server (25.11.2026, mockup https://claude.ai/artifact/TEoguR6Vy3GDoLpFcyx8go).
 * Server chỉ nhận avatar/màu nằm trong hai danh sách này (client gửi lên, không tin chuỗi tự do).
 * CHỈ THÊM VÀO CUỐI — bản lưu và DB giữ chính emoji/mã màu, đổi chỗ không hỏng gì nhưng xoá là người đang dùng mất avatar.
 */

/** 93 con lấy từ bộ thẻ Động vật (104 con), bỏ gián, muỗi, ruồi, giun, chuột cống, nhện, bọ cạp, sâu, dấu chân, lông vũ. */
export const AVATAR_HO_SO: readonly string[] = [
  '🐶', '🐱', '🦁', '🐼', '🦊', '🐻', '🐨', '🐯', '🐵', '🐷', '🐸', '🐧', '🦉', '🦋', '🐢', '🐬', '🦄', '🐔',
  '🐴', '🐝', '🐞', '🦀', '🐙', '🦑', '🐘', '🦒', '🦓', '🦏', '🦛', '🐆', '🐅', '🐊', '🦍', '🐒', '🦘', '🦬',
  '🐃', '🦌', '🐪', '🐫', '🦙', '🦨', '🦡', '🦫', '🦦', '🦥', '🐗', '🦜', '🦧', '🐍', '🦎', '🦩', '🐈', '🐈‍⬛',
  '🐟', '🐭', '🐕', '🦮', '🐕‍🦺', '🐩', '🐹', '🐰', '🐦', '🐤', '🐥', '🐣', '🕊️', '🐠', '🐡', '🦔', '🐇', '🐄',
  '🐖', '🐑', '🐐', '🐓', '🦆', '🐎', '🦃', '🐂', '🐏', '🦚', '🦅', '🦢', '🦤', '🐌', '🐜', '🪲', '🦗', '🦝',
  '🐮', '🐽', '🦣',
];

/** 12 màu — vòng avatar, viền chip. Trùng màu trong một ván: cứ để trùng (chủ dự án 25.11). */
export const MAU_HO_SO: readonly string[] = [
  '#ff5a6e', '#ff9a1f', '#f5c400', '#9acd32', '#3fbf4a', '#14b3a3',
  '#22b8e6', '#2f8ff0', '#7a5cf0', '#b04fe0', '#e25bc8', '#8a6a4f',
];

/**
 * HUY HIỆU PREMIUM (26.11.2026, mockup duyệt https://claude.ai/artifact/UTdgp7a6ngSsiWyv3ZXz7U): dấu nhỏ ở góc trên phải avatar
 * cho biết đó là người có Premium. Ba kiểu người chơi tự chọn: `vm` vương miện · `tim` trái tim (người ủng hộ) · `kc` kim cương.
 * Đi trên dây như màu hồ sơ (`?hh=`), server chỉ nhận mã trong danh sách — và KHÔNG kiểm ai có Premium (trang trí, như mọi thứ
 * Premium khác). CHỈ THÊM VÀO CUỐI.
 */
export const HUY_HIEU = ['vm', 'tim', 'kc'] as const;
export type HuyHieu = (typeof HUY_HIEU)[number];
export const huyHieuHoSo = (x: unknown): HuyHieu | undefined => (typeof x === 'string' && (HUY_HIEU as readonly string[]).includes(x) ? (x as HuyHieu) : undefined);

/** Avatar hợp lệ (trong danh sách) hoặc undefined. */
export const matHoSo = (x: unknown): string | undefined => (typeof x === 'string' && AVATAR_HO_SO.includes(x) ? x : undefined);
/** Màu hợp lệ (trong danh sách) hoặc undefined. */
export const mauHoSo = (x: unknown): string | undefined => (typeof x === 'string' && MAU_HO_SO.includes(x) ? x : undefined);

/**
 * MÀU CHO MÁY (bot) — 28.11.2026, chủ dự án: "avatar của bot chưa có màu bao quanh… cho vào như người bình thường". Ổn định
 * theo `seed` (tên / mã máy: vào lại vẫn đúng màu), ưu tiên màu CHƯA AI trong phòng dùng để dễ phân biệt.
 */
export function mauMay(seed: string, daDung: readonly (string | undefined)[] = []): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const con = MAU_HO_SO.filter((m) => !daDung.includes(m));
  const ds = con.length ? con : MAU_HO_SO;
  return ds[h % ds.length]!;
}
