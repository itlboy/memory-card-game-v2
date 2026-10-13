import { nenApp } from './native';

/**
 * MẶT BÀI VẼ EMOJI BẰNG GÌ (phương án B, chủ dự án chốt 14.10.2026).
 *
 * Emoji của máy KHÔNG phải Apple là ảnh bitmap nhỏ (Android: Noto ~136px) → phóng
 * lên mặt bài là mờ; Windows còn không có emoji cờ. Các máy đó vẽ bằng SVG Twemoji
 * đóng gói sẵn (public/emoji, `node tools/tai-twemoji.mjs`). iPhone/iPad/Mac GIỮ
 * emoji Apple — vốn nét và đẹp nhất, và ảnh App Store chụp bằng nó.
 *
 * Chỉ đổi CÁCH VẼ: ký hiệu trên dây/engine vẫn là chuỗi emoji, nên Android chơi
 * online với iPhone y như cũ (so cặp theo mã, không theo hình).
 */
function laThietBiApple(): boolean {
  if (nenApp === 'ios') return true;
  if (nenApp === 'android') return false;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  // iPadOS báo "Macintosh"; Mac nào cũng có font Apple Color Emoji
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua);
}

export const DUNG_VECTOR = !laThietBiApple();

const LA_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Tên file SVG = mã điểm hex nối "-", BỎ fe0f (khớp tools/tai-twemoji.mjs). */
export function tenFileEmoji(e: string): string {
  return [...e].map((c) => c.codePointAt(0)!.toString(16)).filter((c) => c !== 'fe0f').join('-');
}

/** Đường dẫn SVG cho ký hiệu, hoặc null = vẽ bằng chữ (máy Apple, chữ/số, ô úp rỗng). */
export function anhEmoji(kyHieu: string | undefined, dungVector = DUNG_VECTOR): string | null {
  if (!dungVector || !kyHieu || !LA_EMOJI.test(kyHieu)) return null;
  return `/emoji/${tenFileEmoji(kyHieu)}.svg`;
}
