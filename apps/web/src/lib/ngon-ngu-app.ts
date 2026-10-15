import { registerPlugin } from '@capacitor/core';
import type { NgonNgu } from './i18n';

/**
 * GHI NGÔN NGỮ GAME XUỐNG CÀI ĐẶT MÁY (app gói) — chiều "game → máy" của đồng bộ
 * hai chiều (chiều kia ở `docBanDau`, lib/i18n.ts).
 *
 * Plugin native tự viết `NgonNguApp`:
 *  · iOS: ghi `AppleLanguages` của app — đúng thứ trang Cài đặt → Flip Match ghi;
 *    có hiệu lực từ lần mở sau (lúc đó game đã đúng ngôn ngữ sẵn rồi).
 *    Mã phải KHỚP thư mục `<mã>.lproj` (pt-BR, zh-Hans, zh-Hant).
 *  · Android 13+: `LocaleManager.setApplicationLocales`; activity khai
 *    `configChanges=…locale|layoutDirection` nên KHÔNG bị dựng lại (không tải lại game).
 *    Android cũ hơn không có ngôn ngữ riêng từng app → bỏ qua.
 */
const NgonNguApp = registerPlugin<{ dat(o: { ma: string }): Promise<void> }>('NgonNguApp');

/** Mã ngôn ngữ theo hệ: iOS theo tên thư mục lproj, Android theo thẻ BCP-47. */
export const MA_IOS: Record<NgonNgu, string> = {
  vi: 'vi', en: 'en', es: 'es', pt: 'pt-BR', fr: 'fr', de: 'de', it: 'it', tr: 'tr', ja: 'ja', ko: 'ko',
  zh: 'zh-Hans', 'zh-TW': 'zh-Hant', ru: 'ru', id: 'id', th: 'th'
};

export async function ghiXuongMay(l: NgonNgu): Promise<void> {
  await NgonNguApp.dat({ ma: MA_IOS[l] });
}
