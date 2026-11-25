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

/** Avatar hợp lệ (trong danh sách) hoặc undefined. */
export const matHoSo = (x: unknown): string | undefined => (typeof x === 'string' && AVATAR_HO_SO.includes(x) ? x : undefined);
/** Màu hợp lệ (trong danh sách) hoặc undefined. */
export const mauHoSo = (x: unknown): string | undefined => (typeof x === 'string' && MAU_HO_SO.includes(x) ? x : undefined);
