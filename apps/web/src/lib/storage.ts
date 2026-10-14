import { CAMPAIGN_LEVELS, DEFAULT_OPTIONS, LEVEL_KEYS, sanitizeOptions } from '@mm/engine';
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
  /** Hình mặt bài: 'vector' = Twemoji SVG, 'may' = emoji của máy. Chưa chọn thì
   *  theo máy (lib/emoji.ts): không-Apple → vector, Apple → emoji của máy. */
  kieuEmoji?: 'vector' | 'may';
  /** Giữ lại để đọc bản lưu cũ; mức thật nằm ở `soundLevel`. */
  sound: boolean;
  soundLevel: SoundLevel;
  mode: Mode;
  /** Khoá cỡ bàn đang chọn (1..LEVEL_KEYS) ở chế độ thường. Màn Chiến dịch
   *  KHÔNG ghi vào đây — hai thang khác nhau. */
  level: number;
  /** Các theme đang chọn — bàn thẻ trộn biểu tượng của tất cả. */
  themes: string[];
  playerCount: number;
  /** Tuỳ chọn bàn chơi (năm công tắc 0..3) — nhớ giữa các ván để người chơi
   *  không phải đặt lại luật mỗi lần vào. */
  options: BoardOptions;
  /** Chế độ debug (đèn nháy cạnh logo + công cụ trong Luật chơi). Lưu lại vì
   *  lỗi cần soi thường chỉ hiện trên MỘT máy cụ thể: bật một lần rồi chơi qua
   *  nhiều ván, khỏi phải nhớ thêm `?debug=1` vào mọi đường vào. */
  debug: boolean;
  /** Bảng đo nhịp (fps, trễ gói tin) ở góc màn — công tắc RIÊNG trong chế độ debug,
   *  mặc định TẮT (chủ dự án 14.10.2026: bật kèm debug thì "trông xấu quá"). */
  doNhip?: boolean;
  /** Rung khi ghép thẻ (lib/rung.ts). Mặc định bật. */
  rung: boolean;
  /** Nhạc nền (lib/nhac.ts). Mặc định bật — tắt âm thanh là tắt luôn nhạc. */
  nhac: boolean;
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
  /** Định danh BỀN của trình duyệt này — xem `clientId()`. */
  clientId?: string;
  /** Bộ đếm cho danh hiệu đếm (lib/achievements.ts). */
  boDem?: BoDem;
}

/**
 * Bộ đếm cục bộ. Đăng nhập thì `wins` lấy MAX với số của tài khoản (xem
 * `thongKeHienTai`); các bộ khác chỉ có ở máy.
 */
export interface BoDem {
  wins: number; botWins: number; onlineWins: number;
  /** Ngày chơi gần nhất, `YYYY-MM-DD` giờ máy. */
  ngayCuoi: string;
  chuoi: number; chuoiMax: number;
}
const BO_DEM_RONG: BoDem = { wins: 0, botWins: 0, onlineWins: 0, ngayCuoi: '', chuoi: 0, chuoiMax: 0 };

/** `YYYY-MM-DD` theo giờ MÁY (người chơi nghĩ "hôm nay" theo giờ của họ). */
export function ngayMay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const KEY = 'mm.v2';

/** Số cấp đã qua (≥1 sao) trong `levels` (khoá `mode:cấp`), lọc theo chế độ. */
function daQua(s: { levels?: Record<string, { stars: number }> }, lay: (mode: string) => boolean): number[] {
  return Object.entries(s.levels ?? {})
    .filter(([k, v]) => v.stars > 0 && lay(k.split(':')[0]!))
    .map(([k]) => Number(k.split(':')[1]));
}

/** Cỡ bàn cũ ('4x4') → số màn có đúng số cặp đó. Bản cũ chỉ lưu cỡ bàn. */
function levelFromOldGrid(grid: string | undefined): number {
  const m = /^(\d+)x(\d+)$/.exec(grid ?? '');
  if (!m) return 1;
  const pairs = Math.floor((Number(m[1]) * Number(m[2])) / 2);
  // Cấp n có đúng n cặp
  return Math.min(LEVEL_KEYS, Math.max(1, pairs));
}

const DEFAULT_PREFS: Prefs = {
  // themes rỗng = chưa từng chọn; App sẽ điền TẤT CẢ theme đang mở khoá.
  // Đặt sẵn ['animals'] thì người mới chỉ có một theme và không nhận ra là
  // chọn được nhiều.
  dark: false, sound: true, soundLevel: 'high',
  mode: 'classic', level: 1, themes: [], playerCount: 1,
  options: DEFAULT_OPTIONS, debug: false, rung: true, nhac: true
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
    // Chơi chung một máy tối đa 4 người (11.10.2026); bản lưu cũ có thể còn 5–10
    merged.playerCount = Math.min(4, Math.max(1, Number(merged.playerCount) || 1));
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

  /** Mọi kỷ lục đang có, khoá `mode:L<cấp>` — để đồng bộ lên tài khoản. */
  allBest(): Record<string, BestRecord> { return { ...(read().best ?? {}) }; },

  /** Hợp kỷ lục kéo từ tài khoản về: chỉ ghi khi điểm CAO HƠN bản máy. */
  mergeBest(records: Record<string, BestRecord>): void {
    const s = read();
    s.best ??= {};
    let doi = false;
    for (const [k, r] of Object.entries(records)) {
      if (!s.best[k] || r.score > s.best[k]!.score) { s.best[k] = r; doi = true; }
    }
    if (doi) write(s);
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
   * Màn Chiến dịch cao nhất được phép chơi: qua màn n thì mở màn n+1. CHỈ đọc
   * tiến độ Chiến dịch — chế độ thường dùng thang khoá cỡ bàn (1..LEVEL_KEYS),
   * số cấp hai bên không còn cùng nghĩa (Chiến dịch 12 cỡ × 5 màn, 14.10.2026).
   */
  unlockedLevel(): number {
    const s = read();
    const ids = [
      // bản lưu cũ: `campaign` không mang chế độ trong khoá
      ...Object.entries(s.campaign ?? {}).filter(([, v]) => v.stars > 0).map(([k]) => Number(k)),
      ...daQua(s, (mode) => mode === 'campaign')
    ].filter((n) => Number.isFinite(n));
    return ids.length ? Math.min(CAMPAIGN_LEVELS, Math.max(...ids) + 1) : 1;
  },

  /** Khoá cỡ bàn cao nhất đã mở ở chế độ thường — chỉ để biết có "cấp sau". */
  unlockedKey(): number {
    const ids = daQua(read(), (mode) => mode !== 'campaign').filter((n) => Number.isFinite(n));
    return ids.length ? Math.min(LEVEL_KEYS, Math.max(...ids) + 1) : 1;
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

  boDem(): BoDem { return { ...BO_DEM_RONG, ...(read().boDem ?? {}) }; },

  /**
   * Cộng MỘT ván đã xong vào bộ đếm. Gọi đúng một lần mỗi ván, ở watcher kết
   * ván. Chuỗi ngày: cùng ngày thì giữ, hôm qua thì +1, cách xa thì về 1.
   */
  ghiVanBoDem(v: { thang: boolean; may?: boolean; online?: boolean }, homNay = ngayMay()): BoDem {
    const s = read();
    const b: BoDem = { ...BO_DEM_RONG, ...(s.boDem ?? {}) };
    if (v.thang) {
      b.wins++;
      if (v.may) b.botWins++;
      if (v.online) b.onlineWins++;
    }
    if (b.ngayCuoi !== homNay) {
      const homQua = new Date(`${homNay}T12:00:00`);
      homQua.setDate(homQua.getDate() - 1);
      b.chuoi = b.ngayCuoi === ngayMay(homQua) ? b.chuoi + 1 : 1;
      b.ngayCuoi = homNay;
      b.chuoiMax = Math.max(b.chuoiMax, b.chuoi);
    }
    s.boDem = b;
    write(s);
    return b;
  },

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

  /**
   * Định danh bền của TRÌNH DUYỆT này, sinh một lần rồi giữ mãi.
   *
   * Vì sao cần: `playerId` do server cấp lại mỗi lần vào phòng, còn `token` chỉ
   * sống trong một phiên — nên hai ván của cùng một người trông như hai người
   * xa lạ, và hai người trùng tên thì trông như một. Có cái này thì sổ ván đấu
   * mới cộng lại theo NGƯỜI được, mà không cần đăng nhập gì cả.
   *
   * Nó định danh TRÌNH DUYỆT chứ không phải con người: đổi máy hay xoá dữ liệu
   * web là thành người mới, còn hai người dùng chung một máy thì bị tính là
   * một. Chấp nhận được cho một trò chơi với bạn bè — đừng dùng nó cho thứ gì
   * cần biết chắc ai là ai.
   */
  clientId(): string {
    const s = read();
    if (s.clientId) return s.clientId;
    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 36);
    s.clientId = id;
    write(s);
    return id;
  },

  playerNames(): string[] { return read().names ?? []; },

  savePlayerNames(names: string[]): void {
    const s = read();
    s.names = names;
    write(s);
  }
};
