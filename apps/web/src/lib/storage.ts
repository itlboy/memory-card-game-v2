import type { Mode } from '@mm/engine';

/** Ba mức âm lượng: tắt / nhỏ / to — một nút bấm xoay vòng. */
export type SoundLevel = 'off' | 'low' | 'high';

export interface Prefs {
  dark: boolean;
  /** Giữ lại để đọc bản lưu cũ; mức thật nằm ở `soundLevel`. */
  sound: boolean;
  soundLevel: SoundLevel;
  mode: Mode;
  grid: string;
  /** Các theme đang chọn — bàn thẻ trộn biểu tượng của tất cả. */
  themes: string[];
  playerCount: number;
}

export interface BestRecord { score: number; moves: number; seconds: number }
export interface LevelProgress { stars: number; score: number }

interface Save {
  prefs?: Partial<Prefs> & { theme?: string };   // `theme` là khoá cũ (1 theme)
  best?: Record<string, BestRecord>;
  campaign?: Record<string, LevelProgress>;
  totalScore?: number;
  achievements?: string[];
  names?: string[];
}

const KEY = 'mm.v2';

const DEFAULT_PREFS: Prefs = {
  // themes rỗng = chưa từng chọn; App sẽ điền TẤT CẢ theme đang mở khoá.
  // Đặt sẵn ['animals'] thì người mới chỉ có một theme và không nhận ra là
  // chọn được nhiều.
  dark: false, sound: true, soundLevel: 'high',
  mode: 'classic', grid: '4x4', themes: [], playerCount: 1
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
    return merged;
  },

  savePrefs(patch: Partial<Prefs>): void {
    const s = read();
    s.prefs = { ...this.prefs(), ...patch };
    write(s);
  },

  best(mode: Mode, grid: string): BestRecord | null {
    return read().best?.[`${mode}:${grid}`] ?? null;
  },

  /** Ghi kết quả ván; trả về true nếu là kỷ lục mới. */
  saveResult(mode: Mode, grid: string, r: BestRecord): boolean {
    const s = read();
    s.best ??= {};
    const key = `${mode}:${grid}`;
    const better = !s.best[key] || r.score > s.best[key]!.score;
    if (better) s.best[key] = r;
    s.totalScore = (s.totalScore ?? 0) + r.score;
    write(s);
    return better;
  },

  campaign(): Record<string, LevelProgress> {
    return read().campaign ?? {};
  },

  /** Lưu sao của một màn Campaign; chỉ ghi khi tốt hơn lần trước. */
  saveLevel(id: number, stars: number, score: number): void {
    const s = read();
    s.campaign ??= {};
    const prev = s.campaign[String(id)];
    if (!prev || stars > prev.stars || score > prev.score) {
      s.campaign[String(id)] = { stars: Math.max(stars, prev?.stars ?? 0), score: Math.max(score, prev?.score ?? 0) };
    }
    s.totalScore = (s.totalScore ?? 0) + score;
    write(s);
  },

  /** Màn cao nhất được phép chơi: đã qua màn n thì mở màn n+1. */
  unlockedLevel(): number {
    const done = Object.entries(this.campaign()).filter(([, v]) => v.stars > 0).map(([k]) => Number(k));
    return done.length ? Math.max(...done) + 1 : 1;
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
