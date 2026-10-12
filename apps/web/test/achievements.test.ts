import type { Summary } from '@mm/engine';
import { describe, expect, it } from 'vitest';
import { BOARD_SIZES } from '@mm/engine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACHIEVEMENTS, NHOM, THEME_DH, byId, daCo, earned, goiY, levelChoCells, moKhoa, vuaMo, xetThongKe
} from '@/lib/achievements';
import { store } from '@/lib/storage';

const summary = (over: Partial<Summary> = {}): Summary => ({
  status: 'won', reason: 'cleared', score: 1000, moves: 8, seconds: 20,
  timeBonus: 0, bestStreak: 8, stars: 3, ranking: [], ...over
});

const ctx = (over = {}) => ({
  summary: summary(), mode: 'classic', cells: 16, misses: 2, livesLeft: Infinity,
  lives: null as number | null, peekMs: 0, ...over
});

describe('xét thành tích', () => {
  it('thua thì không mở thành tích nào', () => {
    expect(earned(ctx({ summary: summary({ status: 'lost', reason: 'timeout' }), misses: 0 }))).toEqual([]);
  });

  it('Trí nhớ siêu phàm: thắng không lật sai lần nào', () => {
    expect(earned(ctx({ misses: 0 }))).toContain('flawless');
    expect(earned(ctx({ misses: 1 }))).not.toContain('flawless');
  });

  it('Tốc độ ánh sáng: xong lưới 4×4 dưới 30 giây', () => {
    expect(earned(ctx({ summary: summary({ seconds: 29 }), cells: 16 }))).toContain('lightspeed');
    expect(earned(ctx({ summary: summary({ seconds: 30 }), cells: 16 }))).not.toContain('lightspeed');
    // Lưới khác 4×4 không tính, dù nhanh hơn
    expect(earned(ctx({ summary: summary({ seconds: 5 }), cells: 36 }))).not.toContain('lightspeed');
  });

  it('Bậc thầy combo: chuỗi từ 6 cặp liên tiếp', () => {
    expect(earned(ctx({ summary: summary({ bestStreak: 6 }) }))).toContain('combo-master');
    expect(earned(ctx({ summary: summary({ bestStreak: 5 }) }))).not.toContain('combo-master');
  });

  /*
   * Xét theo LUẬT THẬT của bàn, không theo tên chế độ: bỏ chế độ thì `mode` luôn
   * là 'classic' ở chơi nhanh, nên hai thành tích này từng thành bất khả thi mà
   * không có gì báo đỏ. So với số mạng BAN ĐẦU chứ không với hằng số 5 — số mạng
   * giờ tuỳ cỡ bàn (bàn 42 thẻ có tới 56 mạng ở mức "nhiều").
   */
  it('Người sống sót: bàn có bật mạng và đi hết ván không mất mạng nào', () => {
    expect(earned(ctx({ lives: 3, livesLeft: 3 }))).toContain('survivor');
    expect(earned(ctx({ lives: 56, livesLeft: 56 }))).toContain('survivor');
    expect(earned(ctx({ lives: 3, livesLeft: 2 }))).not.toContain('survivor');
    expect(earned(ctx({ lives: null, livesLeft: Infinity })), 'tắt mạng thì không tính')
      .not.toContain('survivor');
  });

  it('Thần nhãn: bàn có bật xem trước', () => {
    expect(earned(ctx({ peekMs: 6000 }))).toContain('blind-seer');
    expect(earned(ctx({ peekMs: 0 }))).not.toContain('blind-seer');
  });

  it('Chiến dịch: mốc màn 10 và mốc 3 sao', () => {
    // Mốc màn nay đọc từ BỘ ĐẾM (màn cao nhất đã qua), không từ màn vừa chơi
    expect(earned(ctx({ mode: 'campaign', levelId: 10, thongKe: { wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 10, stars3: 0 } }))).toContain('campaign-10');
    expect(earned(ctx({ mode: 'campaign', levelId: 9, thongKe: { wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 9, stars3: 0 } }))).not.toContain('campaign-10');
    expect(earned(ctx({ mode: 'campaign', levelId: 1 }))).toContain('three-star');
    expect(earned(ctx({ mode: 'campaign', levelId: 1, summary: summary({ stars: 2 }) })))
      .not.toContain('three-star');
    // Chế độ khác không xét sao dù summary có stars = 3
    expect(earned(ctx({ mode: 'classic' }))).not.toContain('three-star');
  });

  it('một ván có thể mở nhiều thành tích cùng lúc', () => {
    const got = earned(ctx({ mode: 'campaign', levelId: 12, misses: 0, cells: 16, thongKe: { wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 12, stars3: 0 } }));
    expect(got).toEqual(expect.arrayContaining(['flawless', 'lightspeed', 'combo-master', 'campaign-10', 'three-star']));
  });

  it('mọi id sinh ra đều có mô tả trong danh sách', () => {
    const ids = new Set([
      ...earned(ctx({ mode: 'campaign', levelId: 20, misses: 0, cells: 16 })),
      ...earned(ctx({ mode: 'survival', livesLeft: 5 })),
      ...earned(ctx({ mode: 'peek' }))
    ]);
    for (const id of ids) expect(byId(id), id).toBeDefined();
    expect(ACHIEVEMENTS.every((a) => a.name && a.hint)).toBe(true);
  });

  it('id không tồn tại thì trả về undefined', () => {
    expect(byId('khong-co')).toBeUndefined();
  });
});

describe('danh hiệu mới (08.10.2026)', () => {
  it('xét theo KẾT CỤC CỦA TÔI khi có ketQua: bàn sạch mà thua máy thì không có gì', () => {
    expect(earned(ctx({ ketQua: 'thua', botLevel: 'divine' }))).toEqual([]);
    expect(earned(ctx({ ketQua: 'thang', botLevel: 'divine' })))
      .toEqual(expect.arrayContaining(['first-win', 'bot-normal', 'bot-hard', 'bot-insane', 'bot-divine']));
    // Hạ gà mờ không được danh hiệu máy nào
    expect(earned(ctx({ ketQua: 'thang', botLevel: 'easy' }))).not.toContain('bot-normal');
  });

  it('cỡ bàn: mỗi cỡ là MỘT lần chinh phục, thắng bàn to không mở bàn nhỏ', () => {
    expect(earned(ctx({ cells: 56 }))).toContain('board-56');
    expect(earned(ctx({ cells: 56 }))).not.toContain('board-36');
    expect(earned(ctx({ cells: 88 }))).toContain('board-88');
    // Không sai lần nào thì thêm danh hiệu hoàn hảo của đúng cỡ đó
    expect(earned(ctx({ cells: 56, misses: 0 }))).toContain('perfect-56');
    expect(earned(ctx({ cells: 56, misses: 1 }))).not.toContain('perfect-56');
  });

  it('luật bàn đọc từ năm tuỳ chọn', () => {
    const o = { time: 3, lives: 0, peek: 0, shuffle: 3, special: 2 } as const;
    const r = earned(ctx({ options: o }));
    expect(r).toEqual(expect.arrayContaining(['time-rush', 'shuffle-master', 'special-win']));
    expect(r).not.toContain('iron-man');
    expect(earned(ctx({ options: { time: 2, lives: 2, peek: 2, shuffle: 2, special: 2 } }))).toContain('iron-man');
  });

  it('online thắng → Vô địch phòng; không có misses thì không xét flawless', () => {
    const r = earned(ctx({ online: true, ketQua: 'thang', misses: undefined }));
    expect(r).toContain('online-win');
    expect(r).not.toContain('flawless');
  });

  it('chiến dịch: mốc 10 / 25 / 50 theo màn cao nhất đã qua', () => {
    expect(earned(ctx({ mode: 'campaign', thongKe: { wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 25, stars3: 0 } }))).toEqual(expect.arrayContaining(['campaign-5', 'campaign-10', 'campaign-25']));
    expect(earned(ctx({ mode: 'campaign', thongKe: { wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 50, stars3: 0 } }))).toContain('campaign-50');
  });

  it('mọi danh hiệu có id duy nhất và mọi id earned() trả về đều có trong sổ', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tatCa = earned(ctx({
      cells: 88, misses: 0, ketQua: 'thang', botLevel: 'divine', online: true,
      options: { time: 3, lives: 2, peek: 2, shuffle: 3, special: 2 },
      lives: 5, livesLeft: 5, peekMs: 1000, summary: summary({ bestStreak: 10 })
    }));
    for (const id of tatCa) expect(ids, `${id} không có trong ACHIEVEMENTS`).toContain(id);
  });

  it('levelChoCells trả về cấp đầu tiên của đúng cỡ bàn', () => {
    expect(levelChoCells(16)).toBeGreaterThan(0);
    expect(levelChoCells(88)).toBe(50);
    expect(levelChoCells(7)).toBe(1);   // không có cỡ này → về cấp 1
  });
});

describe('sổ 103 danh hiệu (11.10.2026)', () => {
  const tk = (o = {}) => ({ wins: 0, botWins: 0, onlineWins: 0, totalScore: 0, chuoiNgay: 0, campaignMax: 0, stars3: 0, ...o });

  it('đủ khoảng một trăm danh hiệu, mỗi nhóm khai trong NHOM', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(100);
    const nhom = new Set(NHOM.map((n) => n.id));
    for (const a of ACHIEVEMENTS) expect(nhom, a.id).toContain(a.nhom);
  });

  it('id hợp lệ với server (a-z0-9-, ≤32 ký tự) — sai là server lặng lẽ bỏ', () => {
    for (const a of ACHIEVEMENTS) expect(a.id).toMatch(/^[a-z0-9-]{1,32}$/);
  });

  it('danh hiệu theme khớp ĐÚNG danh sách theme trong themes.json', () => {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/themes.json'), 'utf8'));
    const ds = (Array.isArray(raw) ? raw : raw.themes) as { id: string }[];
    expect([...THEME_DH].sort()).toEqual(ds.map((t) => t.id).sort());
  });

  it('bí mật thì không có nút chinh phục; mọi danh hiệu không bí mật đều có', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.biMat) expect(a.chinhPhuc, a.id).toBeUndefined();
      else expect(a.chinhPhuc, a.id).toBeDefined();
    }
  });

  it('chinh phục cỡ bàn trỏ tới cỡ có thật', () => {
    for (const a of ACHIEVEMENTS) {
      const c = a.chinhPhuc?.cells;
      if (c != null) expect(levelChoCells(c), `${a.id}: ${c} thẻ`).toBe(BOARD_SIZES.find((b) => b.cols * b.rows === c)!.level);
    }
  });

  it('danh hiệu đếm mở từ bộ đếm, kể cả khi THUA', () => {
    const r = earned(ctx({ ketQua: 'thua', thongKe: tk({ wins: 10, totalScore: 100_000, chuoiNgay: 7 }) }));
    expect(r).toEqual(expect.arrayContaining(['wins-10', 'score-10k', 'score-100k', 'days-3', 'days-7']));
    expect(r).not.toContain('first-win');
    expect(xetThongKe(tk({ wins: 9 }))).not.toContain('wins-10');
  });

  it('theme chỉ tính khi bàn dùng ĐÚNG một theme và từ 16 thẻ', () => {
    expect(earned(ctx({ cells: 16, themeIds: ['ocean'] }))).toContain('theme-ocean');
    expect(earned(ctx({ cells: 16, themeIds: ['ocean', 'space'] }))).not.toContain('theme-ocean');
    expect(earned(ctx({ cells: 8, themeIds: ['ocean'] }))).not.toContain('theme-ocean');
  });

  it('bí mật: giây cuối, cú đêm, kiên trì, hoà', () => {
    expect(earned(ctx({ timeLimit: 30, summary: summary({ seconds: 28 }) }))).toContain('giay-cuoi');
    expect(earned(ctx({ timeLimit: 30, summary: summary({ seconds: 20 }) }))).not.toContain('giay-cuoi');
    expect(earned(ctx({ gio: 2 }))).toContain('cu-dem');
    expect(earned(ctx({ gio: 12 }))).not.toContain('cu-dem');
    expect(earned(ctx({ misses: 20 }))).toContain('kien-tri');
    expect(earned(ctx({ ketQua: 'hoa' }))).toEqual(['ngang-tai']);
  });

  it('gợi ý: ưu tiên danh hiệu đếm đã đi quá nửa đường; bỏ bí mật, online, theme khoá', () => {
    const co = new Set(['first-win']);
    expect(goiY(co, tk({ wins: 40 }))?.id).toBe('wins-50');
    const g = goiY(co, tk());
    expect(g && !g.biMat && !g.chinhPhuc?.online).toBe(true);
    const tatCaTheme = new Set(ACHIEVEMENTS.filter((a) => a.nhom !== 'theme').map((a) => a.id));
    expect(goiY(tatCaTheme, tk(), new Set(['animals']))?.id).not.toBe('theme-animals');
  });

  it('gợi ý KHÔNG đưa chuỗi ngày — chơi thêm ván hôm nay không nhích được (từng gợi "3 ngày liền" ở 2/3)', () => {
    const co = new Set(['first-win']);
    expect(goiY(co, tk({ chuoiNgay: 2 }))?.nhom).not.toBe('chuyen-can');
    // Kể cả khi mọi thứ khác đã đạt hết
    const conLai = new Set(ACHIEVEMENTS.filter((a) => a.nhom !== 'chuyen-can').map((a) => a.id));
    expect(goiY(conLai, tk({ chuoiNgay: 6 }))).toBeNull();
  });
});

describe('bộ đếm và chuỗi ngày', () => {
  it('cùng ngày giữ chuỗi, hôm sau +1, cách ngày về 1; chuỗi dài nhất được giữ', () => {
    localStorage.clear();
    expect(store.ghiVanBoDem({ thang: true }, '2026-10-01').chuoi).toBe(1);
    expect(store.ghiVanBoDem({ thang: false }, '2026-10-01').chuoi).toBe(1);
    expect(store.ghiVanBoDem({ thang: true, may: true }, '2026-10-02').chuoi).toBe(2);
    expect(store.ghiVanBoDem({ thang: true, online: true }, '2026-10-03').chuoi).toBe(3);
    const b = store.ghiVanBoDem({ thang: false }, '2026-10-06');
    expect(b).toMatchObject({ chuoi: 1, chuoiMax: 3, wins: 3, botWins: 1, onlineWins: 1 });
  });

  it('moKhoa chỉ nhận id có trong sổ, và đưa danh hiệu mới vào hàng đợi khoe (trừ khi im)', () => {
    localStorage.clear();
    vuaMo.value = [];
    expect(moKhoa(['first-win', 'khong-co-that'])).toEqual(['first-win']);
    expect(vuaMo.value.map((v) => v.id)).toEqual(['first-win']);
    moKhoa(['wins-10'], { im: true });
    expect(vuaMo.value.length).toBe(1);
    expect(daCo.value).toEqual(expect.arrayContaining(['first-win', 'wins-10']));
  });
});
