import type { QuickSay } from '@mm/engine';
import type { Component } from 'vue';
import {
  CalendarX, Clock, CloudRain, Clover, Frown, Gamepad2, Hand, Handshake, Heart, Hourglass, LogOut, PartyPopper, Repeat, Rocket, Smile, Sparkles,
  Star, ThumbsUp, Undo2, Zap
} from 'lucide-vue-next';

/**
 * Emoji đi kèm mỗi câu nói nhanh — CHUNG cho mọi ngôn ngữ (chữ thì dịch qua
 * `say.<mã>`). Emoji giúp nhận ra câu trong một liếc, cả khi khác ngôn ngữ.
 */
export const EMOJI_NOI: Record<QuickSay, string> = {
  chao: '👋', hay: '👏', wow: '😮', tiec: '😅', den: '🌚', anMay: '🤞',
  gg: '🤝', camOn: '🙏', dongY: '👍', vanNua: '🎮', ban: '😔', tamBiet: '🏃',
  // nút nói nhanh 22.11.2026
  gioi: '🌟', choiTiep: '🔁', henGap: '⏰', vuiChoi: '😊',
  // 26.11.2026
  choChut: '⏳', quayLai: '🙋', batDau: '🚀', mayMan: '🍀'
};

/**
 * ICON đi kèm mỗi câu (22.11.2026, mockup duyệt https://claude.ai/artifact/74bGgXpFDdDXSEXVwEWe6k mục 3): Lucide trong vòng
 * màu — cùng một icon ở dòng trong khung nói nhanh VÀ trong bong bóng (trước: khung không có icon, bong bóng lại có
 * emoji). Vẽ bằng IconNoi.vue. Câu cũ (không còn trong khung) vẫn có icon: máy bản cũ còn gửi được.
 */
export type MauNoi = 'vang' | 'xanh' | 'xam' | 'hong' | 'troi' | 'tim';
export const ICON_NOI: Record<QuickSay, { c: Component; mau: MauNoi }> = {
  chao: { c: Hand, mau: 'vang' }, hay: { c: PartyPopper, mau: 'xanh' }, wow: { c: Zap, mau: 'vang' }, tiec: { c: Frown, mau: 'xam' },
  den: { c: CloudRain, mau: 'xam' }, anMay: { c: Clover, mau: 'xanh' }, gg: { c: Handshake, mau: 'troi' }, camOn: { c: Heart, mau: 'hong' },
  dongY: { c: ThumbsUp, mau: 'troi' }, vanNua: { c: Gamepad2, mau: 'tim' }, ban: { c: CalendarX, mau: 'xam' }, tamBiet: { c: LogOut, mau: 'xam' },
  gioi: { c: Sparkles, mau: 'vang' }, choiTiep: { c: Repeat, mau: 'xanh' }, henGap: { c: Clock, mau: 'xam' }, vuiChoi: { c: Smile, mau: 'hong' },
  choChut: { c: Hourglass, mau: 'vang' }, quayLai: { c: Undo2, mau: 'xanh' }, batDau: { c: Rocket, mau: 'tim' }, mayMan: { c: Star, mau: 'troi' }
};
