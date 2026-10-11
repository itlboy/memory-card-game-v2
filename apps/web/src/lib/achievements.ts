import { BOARD_SIZES } from '@mm/engine';
import type { BoardOptions, BotLevel, Summary } from '@mm/engine';
import { ref } from 'vue';
import { store } from './storage';
import type { BacDanhHieu } from './ketcuc-fx';

/**
 * SỔ DANH HIỆU — 103 mục, 12 nhóm (mở rộng 11.10.2026).
 *
 * Mỗi danh hiệu có thể mang:
 *  - `chinhPhuc`: cách MỞ NGAY một bàn đúng điều kiện (bấm "Chinh phục");
 *  - `tienDo`: [đang có, cần] cho danh hiệu ĐẾM — vẽ thanh tiến độ, và là thứ
 *    chọn gợi ý "sắp đạt" ở bảng kết quả;
 *  - `biMat`: ẩn tên và cách đạt tới khi đạt.
 *
 * Xét ở `earned()` SAU MỖI VÁN. Phần đếm (`xetThongKe`) chạy cả khi thua, vì
 * tổng điểm và chuỗi ngày chơi vẫn tăng khi thua.
 *
 * Danh hiệu theme chép tay danh sách theme (cần tên lúc build); test
 * `achievements.test.ts` canh khớp với `public/data/themes.json`.
 */

export interface ChinhPhuc {
  /** Số thẻ của bàn (một trong BOARD_SIZES). */
  cells?: number;
  /** Tuỳ chọn bàn cần bật (phần còn lại về 0). */
  options?: Partial<BoardOptions>;
  /** Đấu máy ở mức này. */
  bot?: BotLevel;
  /** Chỉ dùng đúng một theme. */
  theme?: string;
  /** Chiến dịch: mở màn đang được mở (không nhảy cóc). */
  campaign?: true;
  /** Mở màn Chơi online. */
  online?: true;
}

/** Số liệu tích luỹ — để xét danh hiệu đếm và vẽ tiến độ. */
export interface ThongKe {
  wins: number;
  botWins: number;
  onlineWins: number;
  totalScore: number;
  /** Chuỗi ngày chơi liên tiếp DÀI NHẤT từng đạt. */
  chuoiNgay: number;
  /** Màn Chiến dịch cao nhất đã qua. */
  campaignMax: number;
  /** Số màn Chiến dịch đạt 3 sao. */
  stars3: number;
}

export type NhomId =
  | 'nhap-mon' | 'thang' | 'diem' | 'ban' | 'hoan-hao' | 'luat'
  | 'may' | 'online' | 'chien-dich' | 'theme' | 'chuyen-can' | 'bi-mat';

export const NHOM: { id: NhomId; ten: string }[] = [
  { id: 'nhap-mon', ten: 'Nhập môn' },
  { id: 'ban', ten: 'Chinh phục cỡ bàn' },
  { id: 'may', ten: 'Đấu với máy' },
  { id: 'luat', ten: 'Luật bàn' },
  { id: 'thang', ten: 'Số ván thắng' },
  { id: 'diem', ten: 'Tổng điểm' },
  { id: 'hoan-hao', ten: 'Không sai lần nào' },
  { id: 'chien-dich', ten: 'Chiến dịch' },
  { id: 'online', ten: 'Online' },
  { id: 'theme', ten: 'Bậc thầy theme' },
  { id: 'chuyen-can', ten: 'Chuyên cần' },
  { id: 'bi-mat', ten: 'Bí mật' }
];

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  nhom: NhomId;
  chinhPhuc?: ChinhPhuc;
  tienDo?: (tk: ThongKe) => [number, number];
  biMat?: true;
  /** Bậc huy hiệu — gán ở `bacCua()` theo độ khó, không khai tay từng mục. */
  bac?: BacDanhHieu;
}

/** 24 theme — PHẢI khớp themes.json (test canh). */
export const THEME_DH: readonly [id: string, ten: string][] = [
  ['animals', 'Động vật'], ['food', 'Đồ ăn'], ['fruits', 'Trái cây'], ['nature', 'Thiên nhiên'],
  ['smileys', 'Mặt cười'], ['sports', 'Thể thao'], ['flags', 'Cờ quốc gia'], ['ocean', 'Đại dương'],
  ['space', 'Vũ trụ'], ['tech', 'Công nghệ'], ['vehicles', 'Phương tiện'], ['letters', 'Chữ & số'],
  ['music', 'Nhạc cụ'], ['festive', 'Lễ hội'], ['myth', 'Huyền thoại'], ['flowers', 'Hoa lá'],
  ['weather', 'Thời tiết'], ['jobs', 'Nghề nghiệp'], ['objects', 'Đồ vật'], ['clothes', 'Quần áo'],
  ['buildings', 'Nhà cửa'], ['drinks', 'Đồ uống'], ['games', 'Trò chơi'], ['garden', 'Vườn nhà']
];

const CO_BAN = BOARD_SIZES.map((b) => b.cols * b.rows);
const nghin = (n: number): string => (n >= 1_000_000 ? `${n / 1_000_000} triệu` : `${(n / 1000).toLocaleString('vi-VN')} nghìn`);

/** Bàn vừa sức cho một ván chinh phục luật bàn / mức máy. */
const BAN_VUA = 16;

export const ACHIEVEMENTS: Achievement[] = [
  // --- nhập môn ---
  { id: 'first-win', nhom: 'nhap-mon', name: 'Khởi đầu', hint: 'Thắng ván đầu tiên', chinhPhuc: { cells: 6 } },
  { id: 'flawless', nhom: 'nhap-mon', name: 'Trí nhớ siêu phàm', hint: 'Thắng một ván không lật sai lần nào', chinhPhuc: { cells: 12 } },
  { id: 'lightspeed', nhom: 'nhap-mon', name: 'Tốc độ ánh sáng', hint: 'Hoàn thành lưới 4×4 dưới 30 giây', chinhPhuc: { cells: 16 } },
  { id: 'combo-master', nhom: 'nhap-mon', name: 'Bậc thầy combo', hint: 'Đạt chuỗi 6 cặp đúng liên tiếp', chinhPhuc: { cells: 24 } },
  { id: 'combo-8', nhom: 'nhap-mon', name: 'Combo rực lửa', hint: 'Đạt chuỗi 8 cặp đúng liên tiếp', chinhPhuc: { cells: 30 } },
  { id: 'combo-10', nhom: 'nhap-mon', name: 'Chuỗi bất tận', hint: 'Đạt chuỗi 10 cặp đúng liên tiếp', chinhPhuc: { cells: 36 } },
  { id: 'combo-12', nhom: 'nhap-mon', name: 'Thần combo', hint: 'Đạt chuỗi 12 cặp đúng liên tiếp', chinhPhuc: { cells: 42 } },

  // --- cỡ bàn: thắng + thắng không sai ---
  ...CO_BAN.map((c): Achievement => ({
    id: `board-${c}`, nhom: 'ban', name: `Bàn ${c} thẻ`, hint: `Thắng một ván bàn ${c} thẻ`, chinhPhuc: { cells: c }
  })),
  ...CO_BAN.map((c): Achievement => ({
    id: `perfect-${c}`, nhom: 'hoan-hao', name: `Hoàn hảo ${c} thẻ`,
    hint: `Thắng bàn ${c} thẻ mà không lật sai lần nào`, chinhPhuc: { cells: c }
  })),

  // --- luật bàn ---
  { id: 'survivor', nhom: 'luat', name: 'Người sống sót', hint: 'Thắng một ván có bật mạng mà không mất mạng nào', chinhPhuc: { cells: BAN_VUA, options: { lives: 2 } } },
  { id: 'blind-seer', nhom: 'luat', name: 'Thần nhãn', hint: 'Thắng một ván có bật xem trước', chinhPhuc: { cells: BAN_VUA, options: { peek: 2 } } },
  { id: 'time-rush', nhom: 'luat', name: 'Chạy đua với giờ', hint: 'Thắng một ván đồng hồ mức Nhanh', chinhPhuc: { cells: BAN_VUA, options: { time: 3 } } },
  { id: 'shuffle-master', nhom: 'luat', name: 'Bậc thầy xáo bài', hint: 'Thắng một ván xáo thẻ mức Nhiều', chinhPhuc: { cells: BAN_VUA, options: { shuffle: 3 } } },
  { id: 'special-win', nhom: 'luat', name: 'Phù thuỷ thẻ', hint: 'Thắng một ván có thẻ đặc biệt từ mức Bình thường', chinhPhuc: { cells: 24, options: { special: 2 } } },
  { id: 'iron-man', nhom: 'luat', name: 'Người sắt', hint: 'Thắng một ván bật CẢ NĂM tuỳ chọn ở mức 2 trở lên', chinhPhuc: { cells: 24, options: { time: 2, lives: 2, peek: 2, shuffle: 2, special: 2 } } },
  { id: 'hell-mode', nhom: 'luat', name: 'Địa ngục', hint: 'Thắng một ván bật CẢ NĂM tuỳ chọn ở mức cao nhất', chinhPhuc: { cells: 24, options: { time: 3, lives: 3, peek: 3, shuffle: 3, special: 3 } } },

  // --- đấu máy ---
  { id: 'bot-normal', nhom: 'may', name: 'Hạ gà cứng', hint: 'Thắng máy mức Gà cứng', chinhPhuc: { cells: BAN_VUA, bot: 'normal' } },
  { id: 'bot-hard', nhom: 'may', name: 'Hạ báo đen', hint: 'Thắng máy mức Báo đen', chinhPhuc: { cells: 24, bot: 'hard' } },
  { id: 'bot-insane', nhom: 'may', name: 'Hạ mãnh hổ', hint: 'Thắng máy mức Mãnh hổ', chinhPhuc: { cells: 24, bot: 'insane' } },
  { id: 'bot-divine', nhom: 'may', name: 'Hạ rồng thần', hint: 'Thắng máy mức Rồng thần', chinhPhuc: { cells: 36, bot: 'divine' } },
  { id: 'divine-56', nhom: 'may', name: 'Đồ long', hint: 'Thắng Rồng thần trên bàn 56 thẻ', chinhPhuc: { cells: 56, bot: 'divine' } },
  { id: 'divine-88', nhom: 'may', name: 'Truyền thuyết', hint: 'Thắng Rồng thần trên bàn 88 thẻ', chinhPhuc: { cells: 88, bot: 'divine' } },
  { id: 'bot-wins-10', nhom: 'may', name: 'Khắc tinh máy móc', hint: 'Thắng máy 10 ván (mức Gà cứng trở lên)', chinhPhuc: { cells: BAN_VUA, bot: 'normal' }, tienDo: (t) => [t.botWins, 10] },

  // --- số ván thắng ---
  ...([10, 50, 100, 500] as const).map((n): Achievement => ({
    id: `wins-${n}`, nhom: 'thang', name: `${n} chiến thắng`, hint: `Thắng tổng cộng ${n} ván`,
    chinhPhuc: { cells: BAN_VUA }, tienDo: (t) => [t.wins, n]
  })),

  // --- tổng điểm ---
  ...([10_000, 100_000, 1_000_000, 10_000_000] as const).map((n): Achievement => ({
    id: `score-${n >= 1_000_000 ? `${n / 1_000_000}m` : `${n / 1000}k`}`, nhom: 'diem',
    name: `${nghin(n)} điểm`, hint: `Tích luỹ ${n.toLocaleString('vi-VN')} điểm`,
    chinhPhuc: { cells: 36 }, tienDo: (t) => [t.totalScore, n]
  })),

  // --- chiến dịch ---
  ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((n): Achievement => ({
    id: `campaign-${n}`, nhom: 'chien-dich', name: n === 50 ? 'Hết chiến dịch' : `Qua màn ${n}`,
    hint: `Qua màn ${n} của Chiến dịch`, chinhPhuc: { campaign: true }, tienDo: (t) => [t.campaignMax, n]
  })),
  { id: 'three-star', nhom: 'chien-dich', name: 'Hoàn hảo', hint: 'Đạt 3 sao ở một màn Chiến dịch', chinhPhuc: { campaign: true } },
  ...([10, 25, 50] as const).map((n): Achievement => ({
    id: `stars3-${n}`, nhom: 'chien-dich', name: `${n} màn ba sao`, hint: `Đạt 3 sao ở ${n} màn Chiến dịch`,
    chinhPhuc: { campaign: true }, tienDo: (t) => [t.stars3, n]
  })),

  // --- online ---
  { id: 'online-win', nhom: 'online', name: 'Vô địch phòng', hint: 'Thắng một ván online', chinhPhuc: { online: true } },
  { id: 'online-10', nhom: 'online', name: 'Cao thủ online', hint: 'Thắng 10 ván online', chinhPhuc: { online: true }, tienDo: (t) => [t.onlineWins, 10] },
  { id: 'online-50', nhom: 'online', name: 'Huyền thoại online', hint: 'Thắng 50 ván online', chinhPhuc: { online: true }, tienDo: (t) => [t.onlineWins, 50] },
  { id: 'online-big', nhom: 'online', name: 'Vua đám đông', hint: 'Thắng một phòng online từ 5 người trở lên', chinhPhuc: { online: true } },

  // --- theme ---
  ...THEME_DH.map(([id, ten]): Achievement => ({
    id: `theme-${id}`, nhom: 'theme', name: `Bậc thầy ${ten}`,
    hint: `Thắng bàn từ 16 thẻ chỉ dùng theme ${ten}`, chinhPhuc: { cells: 16, theme: id }
  })),

  // --- chuyên cần ---
  ...([3, 7, 30] as const).map((n): Achievement => ({
    id: `days-${n}`, nhom: 'chuyen-can', name: `${n} ngày liền`, hint: `Chơi xong ít nhất một ván mỗi ngày, ${n} ngày liên tiếp`,
    chinhPhuc: { cells: BAN_VUA }, tienDo: (t) => [t.chuoiNgay, n]
  })),

  // --- bí mật: không có nút chinh phục, tên ẩn tới khi đạt ---
  { id: 'giay-cuoi', nhom: 'bi-mat', biMat: true, name: 'Ngàn cân treo sợi tóc', hint: 'Thắng khi đồng hồ còn 3 giây hoặc ít hơn' },
  { id: 'cu-dem', nhom: 'bi-mat', biMat: true, name: 'Cú đêm', hint: 'Thắng một ván trong khoảng 0–4 giờ sáng' },
  { id: 'binh-minh', nhom: 'bi-mat', biMat: true, name: 'Đón bình minh', hint: 'Thắng một ván trong khoảng 5–6 giờ sáng' },
  { id: 'kien-tri', nhom: 'bi-mat', biMat: true, name: 'Kiên trì', hint: 'Thắng một ván dù đã lật sai từ 20 lần' },
  { id: 'ngang-tai', nhom: 'bi-mat', biMat: true, name: 'Kỳ phùng địch thủ', hint: 'Hoà một ván' }
];

/**
 * BẬC HUY HIỆU theo độ khó: Đồng · Bạc · Vàng · Bí mật. Một chỗ quyết định,
 * suy từ id, để thêm danh hiệu mới không phải nhớ khai bậc.
 */
const VANG = new Set(['board-72', 'board-88', 'combo-12', 'hell-mode', 'bot-divine', 'divine-56', 'divine-88',
  'wins-500', 'score-10m', 'campaign-50', 'stars3-50', 'online-50', 'days-30',
  'perfect-42', 'perfect-56', 'perfect-72', 'perfect-88']);
const BAC = new Set(['board-36', 'board-42', 'board-56', 'combo-8', 'combo-10', 'iron-man', 'time-rush', 'shuffle-master',
  'bot-hard', 'bot-insane', 'bot-wins-10', 'wins-50', 'wins-100', 'score-100k', 'score-1m',
  'campaign-25', 'campaign-30', 'campaign-35', 'campaign-40', 'campaign-45', 'stars3-10', 'stars3-25',
  'online-10', 'online-big', 'days-7', 'perfect-20', 'perfect-24', 'perfect-30', 'perfect-36', 'lightspeed']);
export function bacCua(a: Achievement): BacDanhHieu {
  if (a.biMat) return 'bi-mat';
  if (VANG.has(a.id)) return 'vang';
  if (BAC.has(a.id)) return 'bac';
  return 'dong';
}
for (const a of ACHIEVEMENTS) a.bac = bacCua(a);

export interface AchievementContext {
  summary: Summary;
  mode: string;
  cells: number;
  /** Số lần lật sai của người chơi; online không biết → bỏ qua phần cần nó. */
  misses?: number;
  livesLeft?: number;
  levelId?: number;
  /** Luật thật của bàn vừa chơi, đọc từ config chứ không từ tên chế độ. */
  lives: number | null;
  peekMs: number;
  /** Năm tuỳ chọn của bàn (ngoài Chiến dịch); null nếu không có. */
  options?: BoardOptions | null;
  /** Đấu máy: mức máy. */
  botLevel?: BotLevel | null;
  /** Ván online, kèm số người. */
  online?: boolean;
  soNguoi?: number;
  /**
   * KẾT CỤC CỦA TÔI. `summary.status === 'won'` chỉ là "bàn đã sạch" — thua
   * máy vẫn 'won' (xem CLAUDE.md). Có `ketQua` thì xét theo nó.
   */
  ketQua?: 'thang' | 'thua' | 'hoa';
  /** Theme của bàn — chỉ tính danh hiệu theme khi bàn dùng ĐÚNG MỘT theme. */
  themeIds?: readonly string[];
  /** Giới hạn thời gian ván (giây), null là không có đồng hồ. */
  timeLimit?: number | null;
  /** Giờ địa phương lúc kết thúc (0..23). */
  gio?: number;
  /** Số liệu tích luỹ SAU khi đã cộng ván này. */
  thongKe?: ThongKe;
}

/** Danh hiệu đếm đạt được từ số liệu tích luỹ — chạy được cả ngoài ván. */
export function xetThongKe(tk: ThongKe): string[] {
  return ACHIEVEMENTS.filter((a) => a.tienDo && (() => { const [c, n] = a.tienDo!(tk); return c >= n; })())
    .map((a) => a.id);
}

/** Xét thành tích đạt được sau một ván. */
export function earned(ctx: AchievementContext): string[] {
  const { summary: s, mode, cells } = ctx;
  const out: string[] = ctx.thongKe ? xetThongKe(ctx.thongKe) : [];
  const ketQua = ctx.ketQua ?? (s.status === 'won' ? 'thang' : 'thua');
  if (ketQua === 'hoa') out.push('ngang-tai');
  if (ketQua !== 'thang') return out;

  out.push('first-win');
  if (ctx.misses === 0) out.push('flawless');
  if (cells === 16 && s.seconds < 30) out.push('lightspeed');
  if (s.bestStreak >= 6) out.push('combo-master');
  if (s.bestStreak >= 8) out.push('combo-8');
  if (s.bestStreak >= 10) out.push('combo-10');
  if (s.bestStreak >= 12) out.push('combo-12');
  // Thắng bàn lớn hơn KHÔNG tự mở danh hiệu bàn nhỏ: mỗi cỡ là một lần chinh phục
  if (CO_BAN.includes(cells)) {
    out.push(`board-${cells}`);
    if (ctx.misses === 0) out.push(`perfect-${cells}`);
  }
  // So với `lives` ban đầu chứ không so với hằng số: số mạng tuỳ cỡ bàn.
  if (ctx.lives != null && ctx.lives > 0 && ctx.livesLeft != null && ctx.livesLeft >= ctx.lives) out.push('survivor');
  if (ctx.peekMs > 0) out.push('blind-seer');
  const o = ctx.options;
  if (o) {
    if (o.time >= 3) out.push('time-rush');
    if (o.shuffle >= 3) out.push('shuffle-master');
    if (o.special >= 2) out.push('special-win');
    if (o.time >= 2 && o.lives >= 2 && o.peek >= 2 && o.shuffle >= 2 && o.special >= 2) out.push('iron-man');
    if (o.time >= 3 && o.lives >= 3 && o.peek >= 3 && o.shuffle >= 3 && o.special >= 3) out.push('hell-mode');
  }
  const bot = ctx.botLevel;
  if (bot) {
    const thu = ['easy', 'normal', 'hard', 'insane', 'divine'].indexOf(bot);
    if (thu >= 1) out.push('bot-normal');
    if (thu >= 2) out.push('bot-hard');
    if (thu >= 3) out.push('bot-insane');
    if (thu >= 4) {
      out.push('bot-divine');
      if (cells >= 56) out.push('divine-56');
      if (cells >= 88) out.push('divine-88');
    }
  }
  if (ctx.online) {
    out.push('online-win');
    if ((ctx.soNguoi ?? 0) >= 5) out.push('online-big');
  }
  if (ctx.themeIds?.length === 1 && cells >= 16) out.push(`theme-${ctx.themeIds[0]}`);
  if (mode === 'campaign' && s.stars === 3) out.push('three-star');
  // Bí mật
  if (ctx.timeLimit && ctx.timeLimit - s.seconds <= 3) out.push('giay-cuoi');
  if (ctx.gio != null && ctx.gio >= 0 && ctx.gio < 4) out.push('cu-dem');
  if (ctx.gio === 5 || ctx.gio === 6) out.push('binh-minh');
  if ((ctx.misses ?? 0) >= 20) out.push('kien-tri');
  return [...new Set(out)];
}

export const byId = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);

/** Cấp (level) đầu tiên của cỡ bàn có `cells` thẻ — để mở bàn đúng cỡ. */
export function levelChoCells(cells: number): number {
  return BOARD_SIZES.find((b) => b.cols * b.rows === cells)?.level ?? 1;
}

/* ---------- trạng thái dùng chung: đã có gì, vừa mở gì ---------- */

const ID_SO = new Set(ACHIEVEMENTS.map((a) => a.id));
const docDaCo = (): string[] => store.achievements().filter((id) => ID_SO.has(id));

/** Danh hiệu đã có (chỉ id có trong sổ) — reactive, cho viên 🏅 và các màn. */
export const daCo = ref<string[]>(docDaCo());
/** Hàng đợi danh hiệu vừa mở, để `MoKhoaFx` khoe từng cái. `luc`: không khoe
 *  trước mốc này (performance.now) — để cảnh kết ván chạy xong đã. */
export const vuaMo = ref<{ id: string; key: number; luc: number }[]>([]);
let khoa = 0;
/** Số huy hiệu ĐANG bay (0/1). Viên 🏅 trừ cả hàng đợi lẫn cái đang bay, nên
 *  số trên viên chỉ nhích lên ĐÚNG LÚC huy hiệu chạm vào nó. */
export const dangKhoe = ref(0);

/**
 * CỬA DUY NHẤT để mở danh hiệu (thay vì gọi thẳng store). Trả về id MỚI.
 * `im`: đồng bộ từ tài khoản thì không khoe — người chơi không vừa làm gì.
 */
export function moKhoa(ids: string[], { im = false, treMs = 0 } = {}): string[] {
  const moi = store.unlockAchievements(ids.filter((id) => ID_SO.has(id)));
  daCo.value = docDaCo();
  if (!im) {
    const luc = (typeof performance === 'undefined' ? 0 : performance.now()) + treMs;
    // Bậc cao khoe TRƯỚC: một ván mở năm danh hiệu thì cái đáng giá nhất không bị chôn cuối hàng
    const thu = { 'bi-mat': 0, vang: 1, bac: 2, dong: 3 } as const;
    const xep = [...moi].sort((a, b) => thu[byId(a)?.bac ?? 'dong'] - thu[byId(b)?.bac ?? 'dong']);
    vuaMo.value = [...vuaMo.value, ...xep.map((id) => ({ id, key: ++khoa, luc }))];
  }
  return moi;
}

/** Đọc lại sau khi thứ khác ghi thẳng vào store (đồng bộ tài khoản). */
export function napLaiDaCo(): void { daCo.value = docDaCo(); }

/**
 * Số liệu tích luỹ hiện tại. `serverWins`: số ván thắng của tài khoản — lấy MAX
 * với bộ đếm máy để đăng nhập hai máy không thấy hai con số khác nhau.
 */
export function thongKeHienTai(serverWins = 0): ThongKe {
  const b = store.boDem();
  const cd = Object.entries(store.progress('campaign'));
  return {
    wins: Math.max(b.wins, serverWins),
    botWins: b.botWins,
    onlineWins: b.onlineWins,
    totalScore: store.totalScore(),
    chuoiNgay: b.chuoiMax,
    campaignMax: cd.filter(([, v]) => v.stars > 0).reduce((m, [k]) => Math.max(m, Number(k) || 0), 0),
    stars3: cd.filter(([, v]) => v.stars >= 3).length
  };
}

/**
 * GỢI Ý danh hiệu kế tiếp cho bảng kết quả: danh hiệu ĐẾM nào đã đi được ≥ nửa
 * đường thì ưu tiên (gần đích kéo mạnh nhất), không có thì cái đầu tiên chưa có
 * theo thứ tự nhóm (nhóm dễ đứng trước). Bỏ bí mật, bỏ theme còn khoá.
 */
export function goiY(co: ReadonlySet<string>, tk: ThongKe, themeKhoa: ReadonlySet<string> = new Set()): Achievement | null {
  const ung = ACHIEVEMENTS.filter((a) => !co.has(a.id) && !a.biMat && a.chinhPhuc
    && !(a.chinhPhuc.theme && themeKhoa.has(a.chinhPhuc.theme))
    // Online rời khỏi bàn đang chơi — không đưa vào lời mời "chơi tiếp"
    && !a.chinhPhuc.online);
  const gan = ung
    .filter((a) => a.tienDo)
    .map((a) => { const [c, n] = a.tienDo!(tk); return { a, r: c / n }; })
    .filter((x) => x.r >= 0.5 && x.r < 1)
    .sort((x, y) => y.r - x.r)[0];
  if (gan) return gan.a;
  const thuTu = NHOM.map((n) => n.id);
  return [...ung].sort((x, y) => thuTu.indexOf(x.nhom) - thuTu.indexOf(y.nhom))[0] ?? null;
}
