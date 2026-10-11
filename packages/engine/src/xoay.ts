/**
 * XOAY VÒNG NGƯỜI ĐI ĐẦU (chủ dự án yêu cầu 11.10.2026).
 *
 * Giữ nguyên thứ tự người chơi, chỉ đổi điểm bắt đầu: ván sau bắt đầu từ người
 * NGAY SAU người đi đầu ván trước. Ván đầu (chưa có ai, hoặc người đó đã rời)
 * thì bốc theo `ngauNhien` ∈ [0, 1) — engine tất định nên số ngẫu nhiên do chỗ
 * gọi đưa vào. MỘT hàm cho cả server online (room.ts) lẫn ván offline (App):
 * hai bản luật là có ngày lệch nhau.
 *
 * Chỗ gọi phải đặt `shufflePlayers: false` — xáo của engine chính là thứ khiến
 * lượt đầu ngẫu nhiên mỗi ván.
 */
export function xoayNguoiDau<T extends { id: string }>(ds: readonly T[], truocId: string | null | undefined, ngauNhien: number): T[] {
  if (ds.length < 2) return [...ds];
  const truoc = ds.findIndex((p) => p.id === truocId);
  const dau = truoc >= 0 ? (truoc + 1) % ds.length : Math.min(ds.length - 1, Math.floor(ngauNhien * ds.length));
  return [...ds.slice(dau), ...ds.slice(0, dau)];
}
