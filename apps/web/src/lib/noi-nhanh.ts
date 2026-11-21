import type { QuickSay } from '@mm/engine';

/**
 * Emoji đi kèm mỗi câu nói nhanh — CHUNG cho mọi ngôn ngữ (chữ thì dịch qua
 * `say.<mã>`). Emoji giúp nhận ra câu trong một liếc, cả khi khác ngôn ngữ.
 */
export const EMOJI_NOI: Record<QuickSay, string> = {
  chao: '👋', hay: '👏', wow: '😮', tiec: '😅', den: '🌚', anMay: '🤞',
  gg: '🤝', camOn: '🙏', dongY: '👍', vanNua: '🎮', ban: '😔', tamBiet: '🏃',
  // nút nói nhanh 22.11.2026
  gioi: '🌟', choiTiep: '🔁', henGap: '⏰', vuiChoi: '😊'
};
