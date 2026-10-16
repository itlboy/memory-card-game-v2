import { ref } from 'vue';
import { store } from './storage';

/**
 * MẶT BÀI VẼ EMOJI BẰNG GÌ: NOTO 3D TRÊN MỌI MÁY (chủ dự án 15.10.2026).
 *
 * Emoji của Android là ảnh bitmap nhỏ (Noto ~136px) → phóng lên mặt bài là mờ;
 * Windows không có emoji cờ. Nên mặt bài vẽ bằng NOTO 3D của Google đóng gói sẵn
 * (public/emoji/3d/<mã>.webp, `node tools/tai-noto3d.mjs`) — chủ dự án so 5 bộ và
 * chọn nó. Từ cùng ngày áp cho CẢ iPhone/iPad/Mac: một diện mạo trên mọi máy (online
 * hai bên thấy cùng một lá), app iOS vốn đã mang sẵn bộ ảnh. Đổi là phải chụp lại ảnh
 * CẢ HAI store (asc-store + play-store). KHÔNG còn bộ dự phòng: Twemoji và Noto 2D
 * đã gỡ (chủ dự án 15.10.2026) — emoji Noto 3D chưa có thì test `emoji-vector` đỏ,
 * chọn emoji khác cho theme.
 *
 * Chỉ đổi CÁCH VẼ: ký hiệu trên dây/engine vẫn là chuỗi emoji, nên Android chơi
 * online với iPhone y như cũ (so cặp theo mã, không theo hình).
 */
/** Mặc định — đổi phương án là sửa ĐÚNG dòng này. Từng là `!laThietBiApple()`
 *  (máy Apple giữ emoji Apple) tới 15.10.2026. */
export const MAC_DINH_VECTOR = true;

/**
 * Đang vẽ bằng ảnh hay emoji của máy. Công tắc "Hình lá bài nét" ở menu ĐÃ BỎ
 * (chủ dự án 14.10.2026): mọi máy vẽ Noto 3D (debug vẫn đổi được). Bản
 * lưu `kieuEmoji` cũ bị BỎ QUA — không còn công tắc thì người từng tắt sẽ kẹt mãi.
 * `datDungVector` giữ lại cho test/harness.
 */
export const dungVector = ref<boolean>(MAC_DINH_VECTOR);
export function datDungVector(v: boolean): void {
  dungVector.value = v;
  try { store.savePrefs({ kieuEmoji: v ? 'vector' : 'may' }); } catch { /* bỏ qua */ }
}

const LA_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Tên file = mã điểm hex nối "-", BỎ fe0f (khớp tools/tai-noto3d.mjs). */
export function tenFileEmoji(e: string): string {
  return [...e].map((c) => c.codePointAt(0)!.toString(16)).filter((c) => c !== 'fe0f').join('-');
}

/**
 * BỘ HÌNH ĐỂ SO TRÊN MÁY THẬT — CHỈ trong chế độ debug (Luật chơi), chủ dự án
 * 15.10.2026. `null` = theo mặc định (`dungVector`). Chỉ hai bộ: emoji của máy và Noto 3D.
 */
export const BO_EMOJI = ['may', 'noto3d'] as const;
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
/** Về bộ mặc định — gọi khi TẮT chế độ debug (App.vue): lựa chọn thử không được
 *  sống sót ra ngoài debug, không thì người tắt debug kẹt ở một bộ lạ mà không thấy nút đổi. */
export function boEmojiVeMacDinh(): void {
  boEmojiThu.value = null;
  try { localStorage.removeItem(KHOA_BO); } catch { /* bỏ qua */ }
}
/** Xoay vòng sang bộ kế tiếp và nhớ ở máy này. */
export function doiBoEmojiThu(): void {
  const i = BO_EMOJI.indexOf(boEmojiHien());
  const moi = BO_EMOJI[(i + 1) % BO_EMOJI.length]!;
  boEmojiThu.value = moi;
  try { localStorage.setItem(KHOA_BO, moi); } catch { /* bỏ qua */ }
}


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

/**
 * TẢI TRƯỚC ảnh mặt bài của cả bàn lúc chia (chủ dự án 15.10.2026: trên web lần đầu
 * lật lá ra Ô TRẮNG vì ảnh mới bắt đầu tải). Giữ tham chiếu Image để trình duyệt không
 * vứt bản đã giải mã; mỗi URL tải một lần cho cả phiên.
 */
const daTai = new Map<string, HTMLImageElement>();
export function taiTruocAnh(kyHieu: Iterable<string | undefined>, co: number): void {
  if (typeof Image === 'undefined') return;
  for (const k of kyHieu) {
    const url = anhEmoji(k, undefined, co);
    if (!url || daTai.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.decode?.().catch(() => undefined);
    daTai.set(url, img);
  }
}

/** Đường dẫn ảnh cho ký hiệu, hoặc null = vẽ bằng chữ (máy Apple, chữ/số, ô úp rỗng).
 *  `co` = cỡ ảnh Noto 3D cần (`chonCoAnh`); bỏ trống là 512. */
export function anhEmoji(kyHieu: string | undefined, vector?: boolean, co = 512): string | null {
  const bo: BoEmoji = vector === undefined ? boEmojiHien() : vector ? 'noto3d' : 'may';
  if (bo === 'may' || !kyHieu || !LA_EMOJI.test(kyHieu)) return null;
  const ma = tenFileEmoji(kyHieu);
  if (co >= 512 && !co512.value) co = 256;
  return co >= 512 ? `/emoji/3d/${ma}.webp` : `/emoji/3d/${co}/${ma}.webp`;
}

/**
 * GÓI THIẾU ẢNH 512? Gói cập nhật nóng cài bằng ZIP cố ý bỏ ảnh 512 (zip phải dưới 25MiB
 * để Cloudflare Worker phục vụ — tools/dong-goi-ota.mjs). App gọi `kiemCo512()` lúc khởi
 * động: không có thì mọi chỗ xin 512 nhận 256 (hơi kém nét ở lá to, không vỡ hình). Web và
 * gói cài bằng tải chênh lệch luôn đủ 512.
 */
export const co512 = ref(true);
export async function kiemCo512(): Promise<void> {
  try {
    const r = await fetch(`/emoji/3d/${tenFileEmoji('😀')}.webp`, { cache: 'no-store' });
    if (!r.ok) co512.value = false;
  } catch { co512.value = false; }
}
