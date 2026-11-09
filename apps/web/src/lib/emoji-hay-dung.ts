/**
 * EMOJI HAY DÙNG (07.11.2026, chủ dự án duyệt mockup chọn emoji).
 *
 * Hàng emoji ngoài thanh = emoji MÌNH hay bấm nhất; máy chưa bấm gì thì là bộ phổ
 * biến `EMOJI_PHO_BIEN`. Đếm trên từng máy (localStorage), không gửi đi đâu.
 * Hoà số lần thì giữ thứ tự mặc định.
 */
import { EMOJI_PHO_BIEN, QUICK_EMOJIS, type QuickEmoji } from '@mm/engine';

const KHOA = 'mm.emojiDung';

function doc(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA) ?? '{}') as Record<string, unknown>;
    const ra: Record<string, number> = {};
    for (const [e, n] of Object.entries(v)) if (QUICK_EMOJIS.includes(e) && typeof n === 'number' && n > 0) ra[e] = n;
    return ra;
  } catch { return {}; }
}

let dem: Record<string, number> = doc();

/** Thứ tự hàng ngoài: dùng nhiều trước, còn lại theo bộ phổ biến, rồi tới cả danh sách. */
export function xepHayDung(soLan: Record<string, number>, n: number): QuickEmoji[] {
  const goc = [...EMOJI_PHO_BIEN, ...QUICK_EMOJIS.filter((e) => !EMOJI_PHO_BIEN.includes(e as QuickEmoji))] as QuickEmoji[];
  const viTri = new Map(goc.map((e, i) => [e, i]));
  return [...goc]
    .sort((a, b) => (soLan[b] ?? 0) - (soLan[a] ?? 0) || viTri.get(a)! - viTri.get(b)!)
    .slice(0, n);
}

/*
 * THỨ TỰ CHỐT THEO PHIÊN (09.11.2026, chủ dự án: "emoji chat nhiều đột xuất nhảy"): hàng
 * ngoài xếp MỘT LẦN lúc mở game, từ số lần đã đếm tới lúc đó. Bấm trong lúc chơi chỉ cộng
 * số đếm — thứ tự mới có ở lần mở game sau, hàng không bao giờ nhảy dưới ngón tay.
 */
const thuTuPhien = xepHayDung(doc(), QUICK_EMOJIS.length);
export const hayDung = (n: number): QuickEmoji[] => thuTuPhien.slice(0, n);

export function ghiDung(e: string): void {
  if (!QUICK_EMOJIS.includes(e)) return;
  dem = { ...dem, [e]: (dem[e] ?? 0) + 1 };
  try { localStorage.setItem(KHOA, JSON.stringify(dem)); } catch { /* chế độ riêng tư */ }
}
