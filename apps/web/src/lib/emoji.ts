import { ref } from 'vue';
import { nenApp } from './native';
import { store } from './storage';
import THIEU_3D from '../../public/emoji/3d/thieu.json';

/**
 * MẶT BÀI VẼ EMOJI BẰNG GÌ (phương án B 14.10.2026, đổi sang Noto 3D 15.10.2026).
 *
 * Emoji của máy KHÔNG phải Apple là ảnh bitmap nhỏ (Android: Noto ~136px) → phóng
 * lên mặt bài là mờ; Windows còn không có emoji cờ. Các máy đó vẽ bằng NOTO 3D
 * của Google đóng gói sẵn (public/emoji/3d/<mã>.webp, `node tools/tai-noto3d.mjs`)
 * — chủ dự án so 5 bộ và chọn nó vì gần emoji Apple nhất. Hình Noto 3D chưa có
 * (`thieu.json`) lùi về SVG Twemoji (public/emoji, `node tools/tai-twemoji.mjs`).
 * iPhone/iPad/Mac GIỮ emoji Apple — vốn nét và đẹp nhất, và ảnh App Store chụp bằng nó.
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

/** Mặc định theo máy — đổi phương án A/B/... là sửa ĐÚNG dòng này. */
export const MAC_DINH_VECTOR = !laThietBiApple();

/**
 * Đang vẽ bằng ảnh hay emoji của máy. Công tắc "Hình lá bài nét" ở menu ĐÃ BỎ
 * (chủ dự án 14.10.2026): máy Apple luôn emoji Apple, máy khác luôn Noto 3D. Bản
 * lưu `kieuEmoji` cũ bị BỎ QUA — không còn công tắc thì người từng tắt sẽ kẹt mãi.
 * `datDungVector` giữ lại cho test/harness.
 */
export const dungVector = ref<boolean>(MAC_DINH_VECTOR);
export function datDungVector(v: boolean): void {
  dungVector.value = v;
  try { store.savePrefs({ kieuEmoji: v ? 'vector' : 'may' }); } catch { /* bỏ qua */ }
}

const LA_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Tên file = mã điểm hex nối "-", BỎ fe0f (khớp tools/tai-twemoji.mjs + tai-noto3d.mjs). */
export function tenFileEmoji(e: string): string {
  return [...e].map((c) => c.codePointAt(0)!.toString(16)).filter((c) => c !== 'fe0f').join('-');
}

/**
 * BỘ HÌNH ĐỂ SO TRÊN MÁY THẬT — CHỈ trong chế độ debug (Luật chơi), chủ dự án
 * 15.10.2026. `null` = theo mặc định (`dungVector`). Noto 2D tải thẳng từ GitHub
 * googlefonts/noto-emoji (SVG Apache 2.0) — KHÔNG đóng gói, cần mạng.
 */
export const BO_EMOJI = ['may', 'twemoji', 'noto', 'noto3d'] as const;
export type BoEmoji = (typeof BO_EMOJI)[number];
const KHOA_BO = 'mm.boEmoji';
function docBo(): BoEmoji | null {
  try {
    const v = localStorage.getItem(KHOA_BO);
    return (BO_EMOJI as readonly string[]).includes(v ?? '') ? (v as BoEmoji) : null;
  } catch { return null; }
}
export const boEmojiThu = ref<BoEmoji | null>(docBo());
/** Bộ đang vẽ (đã tính bản thử debug). */
export function boEmojiHien(): BoEmoji {
  return boEmojiThu.value ?? (dungVector.value ? 'noto3d' : 'may');
}
/** Xoay vòng sang bộ kế tiếp và nhớ ở máy này. */
export function doiBoEmojiThu(): void {
  const i = BO_EMOJI.indexOf(boEmojiHien());
  const moi = BO_EMOJI[(i + 1) % BO_EMOJI.length]!;
  boEmojiThu.value = moi;
  try { localStorage.setItem(KHOA_BO, moi); } catch { /* bỏ qua */ }
}

const NOTO = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main';
const laCo = (e: string) => /\p{Regional_Indicator}/u.test(e);
const CHUA_CO_3D = new Set<string>(THIEU_3D);

/**
 * NOTO 3D CÓ BA CỠ đóng gói sẵn: 128 · 256 (thư mục con) và 512 (gốc). Lá nhỏ
 * dùng ảnh nhỏ — ảnh giải nén chiếm RAM theo số điểm ảnh (512² ≈ 1MB), bàn 88
 * thẻ toàn ảnh 512 là ~44MB, mà iOS thả lớp GPU khi thiếu bộ nhớ (lỗi "ô trắng").
 */
export const CO_ANH_3D = [128, 256, 512] as const;
/** Cỡ nhỏ nhất đủ nét cho hình rộng `cssPx` trên màn này (chừa 10% non tay). */
export function chonCoAnh(cssPx: number, dpr = typeof window === 'undefined' ? 2 : window.devicePixelRatio || 1): number {
  const can = cssPx * dpr * 0.9;
  return CO_ANH_3D.find((c) => c >= can) ?? 512;
}

/** Đường dẫn ảnh cho ký hiệu, hoặc null = vẽ bằng chữ (máy Apple, chữ/số, ô úp rỗng).
 *  `co` = cỡ ảnh Noto 3D cần (`chonCoAnh`); bỏ trống là 512. */
export function anhEmoji(kyHieu: string | undefined, vector?: boolean, co = 512): string | null {
  const bo: BoEmoji = vector === undefined ? boEmojiHien() : vector ? 'noto3d' : 'may';
  if (bo === 'may' || !kyHieu || !LA_EMOJI.test(kyHieu)) return null;
  const ma = tenFileEmoji(kyHieu);
  if (bo === 'noto3d') {
    if (CHUA_CO_3D.has(ma)) return `/emoji/${ma}.svg`;
    return co >= 512 ? `/emoji/3d/${ma}.webp` : `/emoji/3d/${co}/${ma}.webp`;
  }
  if (bo === 'twemoji') return `/emoji/${ma}.svg`;
  const noto = `emoji_u${ma.replaceAll('-', '_')}`;
  // Cờ của Noto 2D nằm riêng (bộ cờ bay phấp phới)
  return laCo(kyHieu) ? `${NOTO}/third_party/region-flags/waved-svg/${noto}.svg` : `${NOTO}/2D/svg/${noto}.svg`;
}
