/**
 * NHỊP ĐỔI NGẪU NHIÊN của hình nền + nhạc nền (26.11.2026, chủ dự án: "việc đổi ngẫu nhiên khoảng 30 phút một lần nhé, và
 * không đổi khi trong ván"). Bản đầu đổi mỗi lần về trang chủ — chơi ván ngắn thì vài phút đổi một lần, loạn mắt.
 *
 * Mốc lần đổi cuối lưu ở localStorage để tính XUYÊN các lần mở app: mở lại sau 10 phút thì chưa đổi, sau 40 phút thì đổi.
 * Hình nền và nhạc dùng CHUNG một mốc nên đổi cùng lúc. App.vue hỏi `denGioDoi()` (lúc mở app, lúc rời ván, mỗi phút khi
 * đang ở ngoài ván, lúc app hiện lại) rồi mới gọi hai hàm đổi; đang trong ván thì App không hỏi.
 */
export const NHIP_NGAU_NHIEN_MS = 30 * 60_000;
const KHOA = 'mm.nn.luc';

/** Đã đủ 30 phút kể từ lần đổi cuối chưa. Chưa có mốc (vừa bật, hoặc bộ nhớ bị xoá) = chưa: mốc được đặt lúc bật. */
export function denGioDoi(bayGio = Date.now()): boolean {
  let luc = NaN;
  try { luc = Number(localStorage.getItem(KHOA)); } catch { /* chế độ riêng tư */ }
  if (!Number.isFinite(luc) || luc <= 0) { ghiMocDoi(bayGio); return false; }
  // đồng hồ máy bị chỉnh lùi: mốc nằm ở tương lai → coi như vừa đổi, đặt lại mốc
  if (luc > bayGio) { ghiMocDoi(bayGio); return false; }
  return bayGio - luc >= NHIP_NGAU_NHIEN_MS;
}

/** Ghi "vừa đổi" — gọi sau mỗi lần đổi và lúc người chơi bật mục Ngẫu nhiên (bật là đổi ngay một lần). */
export function ghiMocDoi(bayGio = Date.now()): void {
  try { localStorage.setItem(KHOA, String(bayGio)); } catch { /* chế độ riêng tư */ }
}
