import { CAMPAIGN_LEVELS, DEFAULT_OPTIONS, sanitizeOptions } from '@mm/engine';
import type { BoardOptions, Mode } from '@mm/engine';

/** Ba mức âm lượng: tắt / nhỏ / to — một nút bấm xoay vòng. */
export type SoundLevel = 'off' | 'low' | 'high';

/**
 * Người chơi cũ mở game lên phải thấy đúng kiểu bàn mình quen, dù bốn chế độ đã
 * tan thành tuỳ chọn. Chỉ chạy MỘT LẦN: sau đó `options` có trong bản lưu và
 * nhánh này không đụng tới nữa.
 */
function optionsFromOldMode(mode: Mode | undefined): Partial<BoardOptions> {
  switch (mode) {
    case 'time':     return { time: 2 };
    case 'survival': return { time: 0, lives: 2, special: 2 };
    case 'peek':     return { time: 2, peek: 2 };
    default:         return {};
  }
}

export interface Prefs {
  dark: boolean;
  /** Giữ lại để đọc bản lưu cũ; mức thật nằm ở `soundLevel`. */
  sound: boolean;
  soundLevel: SoundLevel;
  mode: Mode;
  /** Màn đang chọn (1..CAMPAIGN_LEVELS) — mọi chế độ đều chọn màn. */
  level: number;
  /** Các theme đang chọn — bàn thẻ trộn biểu tượng của tất cả. */
  themes: string[];
  playerCount: number;
  /** Tuỳ chọn bàn chơi (năm công tắc 0..3) — nhớ giữa các ván để người chơi
   *  không phải đặt lại luật mỗi lần vào. */
  options: BoardOptions;
}

export interface BestRecord { score: number; moves: number; seconds: number }
export interface LevelProgress { stars: number; score: number }

interface Save {
  prefs?: Partial<Prefs> & { theme?: string };   // `theme` là khoá cũ (1 theme)
  best?: Record<string, BestRecord>;
  /** Tiến độ màn của TỪNG chế độ, khoá `${mode}:${id}`. */
  levels?: Record<string, LevelProgress>;
  /** Khoá cũ: chỉ có tiến độ Chiến dịch. Đọc để chuyển sang `levels`. */
  campaign?: Record<string, LevelProgress>;
  totalScore?: number;
  achievements?: string[];
  names?: string[];
}

const KEY = 'mm.v2';

/** Cỡ bàn cũ ('4x4') → số màn có đúng số cặp đó. Bản cũ chỉ lưu cỡ bàn. */
function levelFromOldGrid(grid: string | undefined): number {
  const m = /^(\d+)x(\d+)$/.exec(grid ?? '');
  if (!m) return 1;
  const pairs = Math.floor((Number(m[1]) * Number(m[2])) / 2);
  // Cấp n có đúng n cặp
  return Math.min(CAMPAIGN_LEVELS, Math.max(1, pairs));
}

const DEFAULT_PREFS: Prefs = {
  // themes rỗng = chưa từng chọn; App sẽ điền TẤT CẢ theme đang mở khoá.
  // Đặt sẵn ['animals'] thì người mới chỉ có một theme và không nhận ra là
  // chọn được nhiều.
  dark: false, sound: true, soundLevel: 'high',
  mode: 'classic', level: 1, themes: [], playerCount: 1,
  options: DEFAULT_OPTIONS
};

function read(): Save {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}) as Save; } catch { return {}; }
}

function write(save: Save): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* chế độ riêng tư */ }
}

/** Tiến trình chơi đơn lưu cục bộ — không cần đăng nhập (mục 3.7). */
export const store = {
  prefs(): Prefs {
    const saved = read().prefs ?? {};
    const merged = { ...DEFAULT_PREFS, ...saved };
    // Migration từ bản cũ chỉ lưu một theme
    if (!saved.themes?.length && saved.theme) merged.themes = [saved.theme];
    // KHÔNG ép về ['animals'] khi rỗng: rỗng là tín hiệu "chưa từng chọn", để
    // App điền tất cả theme đang mở khoá.
    // Bản cũ chỉ có bật/tắt: người đang tắt tiếng thì giữ tắt, còn lại về "to"
    if (!saved.soundLevel) merged.soundLevel = saved.sound === false ? 'off' : 'high';
    // Bản cũ lưu cỡ bàn ('4x4'); đổi sang số màn có cùng số cặp để người chơi
    // quay lại không bị đẩy về bàn 2×2
    if (!saved.level) merged.level = levelFromOldGrid((saved as { grid?: string }).grid);
    // Bản lưu cũ không có `options`, và bản lưu tay có thể hỏng: lọc về khoảng
    // hợp lệ thay vì tin. Bản cũ từng chơi Sinh tồn/Chớp nhoáng thì tuỳ chọn
    // tương ứng bật sẵn, để họ mở game lên vẫn thấy đúng kiểu mình quen.
    merged.options = sanitizeOptions(saved.options ?? optionsFromOldMode(saved.mode));
    return merged;
  },

  savePrefs(patch: Partial<Prefs>): void {
    const s = read();
    s.prefs = { ...this.prefs(), ...patch };
    write(s);
  },

  best(mode: Mode, level: number): BestRecord | null {
    return read().best?.[`${mode}:L${level}`] ?? null;
  },

  /** Ghi kết quả ván; trả về true nếu là kỷ lục mới. */
  saveResult(mode: Mode, level: number, r: BestRecord): boolean {
    const s = read();
    s.best ??= {};
    const key = `${mode}:L${level}`;
    const better = !s.best[key] || r.score > s.best[key]!.score;
    if (better) s.best[key] = r;
    s.totalScore = (s.totalScore ?? 0) + r.score;
    write(s);
    return better;
  },

  /** Tiến độ các màn của MỘT chế độ. Mỗi chế độ một chuỗi màn riêng, nên qua
   *  màn 10 của Cổ điển không mở sẵn màn 10 của Sinh tồn. */
  progress(mode: Mode): Record<string, LevelProgress> {
    const s = read();
    const out: Record<string, LevelProgress> = {};
    // Bản cũ chỉ có tiến độ Chiến dịch, nằm ở khoá `campaign` không mang chế độ
    if (mode === 'campaign') Object.assign(out, s.campaign ?? {});
    for (const [k, v] of Object.entries(s.levels ?? {})) {
      const [m, id] = k.split(':');
      if (m === mode && id) out[id] = v;
    }
    return out;
  },

  /** Lưu tiến độ một cấp; chỉ ghi khi tốt hơn lần trước. KHÔNG cộng điểm vào
   *  tổng — việc đó là của saveResult(), gọi cả hai thì điểm bị tính hai lần.
   *  Chế độ không xếp sao thì truyền stars = 1 để đánh dấu "đã qua". */
  saveLevel(mode: Mode, id: number, stars: number, score: number): void {
    const s = read();
    s.levels ??= {};
    const key = `${mode}:${id}`;
    const prev = s.levels[key] ?? (mode === 'campaign' ? s.campaign?.[String(id)] : undefined);
    if (!prev || stars > prev.stars || score > prev.score) {
      s.levels[key] = {
        stars: Math.max(stars, prev?.stars ?? 0),
        score: Math.max(score, prev?.score ?? 0)
      };
    }
    write(s);
  },

  /**
   * Cấp cao nhất được phép chơi: qua cấp n thì mở cấp n+1. Mở khoá dùng CHUNG
   * cho mọi chế độ — tách riêng thì đổi sang Sinh tồn là lại phải bò từ bàn 2
   * thẻ, dù người chơi đã qua cấp 20 ở Cổ điển. Sao và kỷ lục thì vẫn riêng
   * từng chế độ (xem progress()).
   */
  unlockedLevel(): number {
    const s = read();
    const ids = [
      ...Object.entries(s.campaign ?? {}).filter(([, v]) => v.stars > 0).map(([k]) => Number(k)),
      ...Object.entries(s.levels ?? {})
        .filter(([, v]) => v.stars > 0)
        .map(([k]) => Number(k.split(':')[1]))
    ].filter((n) => Number.isFinite(n));
    return ids.length ? Math.min(CAMPAIGN_LEVELS, Math.max(...ids) + 1) : 1;
  },

  totalScore(): number { return read().totalScore ?? 0; },

  /** Cộng điểm vào tổng tích luỹ mà không ghi kỷ lục — dùng cho ván thi đấu
   *  (nhiều người / online), nơi kỷ lục theo lưới không có nghĩa. */
  addScore(score: number): void {
    if (score <= 0) return;
    const s = read();
    s.totalScore = (s.totalScore ?? 0) + score;
    write(s);
  },

  achievements(): string[] { return read().achievements ?? []; },

  /** Trả về danh sách thành tích vừa mở khoá lần này. */
  unlockAchievements(ids: string[]): string[] {
    const s = read();
    const have = new Set(s.achievements ?? []);
    const fresh = ids.filter((id) => !have.has(id));
    if (fresh.length) {
      s.achievements = [...have, ...fresh];
      write(s);
    }
    return fresh;
  },

  playerNames(): string[] { return read().names ?? []; },

  savePlayerNames(names: string[]): void {
    const s = read();
    s.names = names;
    write(s);
  }
};
