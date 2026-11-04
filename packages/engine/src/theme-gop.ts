/**
 * GỘP 72 THEME CŨ THÀNH 12 (04.11.2026, chủ dự án: "72 theme cho người dùng chọn là quá
 * nhiều, chỉ cần 12"). Mỗi theme mới là hợp các bộ hình cũ (+ icon bổ sung), bàn thẻ vẫn
 * bốc ngẫu nhiên đủ số cặp từ kho to hơn nên mỗi ván đa dạng hơn.
 *
 * Bảng này giữ cho dữ liệu CŨ còn chạy: lựa chọn đã lưu trong máy, cấu hình phòng do app
 * bản cũ gửi lên server, danh hiệu `theme-<id cũ>` đã đạt (đổi sang danh hiệu của nhóm
 * chứa nó — chủ dự án chọn giữ thành tích). ĐỪNG xoá dòng nào: app chưa cập nhật vẫn gửi
 * id cũ lên server hàng tháng sau.
 */
export const THEME_GOP: Readonly<Record<string, string>> = {
  safari: 'animals', jungle: 'animals', cats: 'animals', pets: 'animals', farm: 'animals', birds: 'animals', insects: 'animals',
  space: 'ocean',
  flowers: 'nature', garden: 'nature', weather: 'nature', scenery: 'nature',
  summer: 'seasons', winter: 'seasons', autumn: 'seasons', camping: 'seasons',
  fruits: 'food', veggies: 'food', sweets: 'food', breakfast: 'food', asianfood: 'food', market: 'food', drinks: 'food', kitchen: 'food', teaparty: 'food',
  shapes: 'letters',
  expressions: 'smileys', hearts: 'smileys', hands: 'smileys', body: 'smileys', people: 'smileys', jobs: 'smileys', athletes: 'smileys',
  sports: 'games', music: 'games', hobbies: 'games', circus: 'games',
  tools: 'objects', office: 'objects', home: 'objects', clothes: 'objects', clocks: 'objects', tech: 'objects', lab: 'objects', school: 'objects',
  vehicles: 'travel', landmarks: 'travel', buildings: 'travel', signs: 'travel',
  tet: 'festive', halloween: 'festive', zodiac: 'festive', myth: 'festive', fairytale: 'festive', treasure: 'festive',
  flagsasia: 'flags', flagseurope: 'flags', flagsamericas: 'flags', flagsafrica: 'flags', flagstricky: 'flags', flagsislands: 'flags',
};

/** Id theme hiện hành của một id (cũ hoặc mới). */
export const themeMoi = (id: string): string => THEME_GOP[id] ?? id;

/** Đổi danh sách id (có thể lẫn id cũ) sang id mới, bỏ trùng, giữ thứ tự. */
export const doiThemeIds = (ids: readonly string[]): string[] => [...new Set(ids.map(themeMoi))];

/** Đổi id danh hiệu `theme-<id cũ>` sang `theme-<id mới>`; danh hiệu khác giữ nguyên. */
export const doiDanhHieu = (id: string): string =>
  id.startsWith('theme-') ? `theme-${themeMoi(id.slice(6))}` : id;
