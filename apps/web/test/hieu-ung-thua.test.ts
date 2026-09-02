import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryGame, isDraw } from '@mm/engine';
import { HIEU_UNG, TOI_THIEU_MOI_LOAI, bocHieuUng, hieuUngCua } from '@/lib/ketcuc-fx';
import type { Summary } from '@mm/engine';

/**
 * THẮNG và THUA phải nhìn ra khác nhau — ở MỌI đường thua.
 *
 * `summary.status === 'won'` chỉ có nghĩa BÀN ĐÃ SẠCH, không phải "tôi thắng".
 * Đấu máy mà máy dọn nhiều cặp hơn thì vẫn là 'won', nên trước đây thua bot vẫn
 * được pháo hoa và nhạc chiến thắng — người chơi báo đúng chuyện này. Ba đường
 * thua còn lại ('lost': hết giờ, hết mạng, hết nước) thì ván offline không có
 * HÌNH nào cả, giống hệt một ván đang chơi dở.
 *
 * Test này soi đúng phép quyết định đó, ở cả hai nhánh (offline và online).
 */

/** Bản xếp hạng tối thiểu để `isDraw` và phép chọn hiệu ứng chạy được. */
const p = (id: string, score: number) =>
  ({ id, name: id, score, bestStreak: 1, pairs: score / 100, forfeited: false });

const tomTat = (status: 'won' | 'lost', ranking: unknown[]): Summary =>
  ({ status, reason: 'cleared', score: 0, moves: 0, seconds: 0, timeBonus: 0,
    bestStreak: 0, stars: 0, ranking } as unknown as Summary);

/**
 * Bản sao phép quyết định của `useGameSession.nguoiChoiThang` — giữ ở đây để
 * test đọc được không cần dựng cả App. Sửa một bên PHẢI sửa bên kia; phép kiểm
 * "mã nguồn có đúng luật này" ở cuối file canh chuyện đó.
 */
function nguoiChoiThang(s: Summary): boolean {
  if (s.status !== 'won') return false;
  const champ = s.ranking[0];
  if (!champ || !s.ranking.some((x) => x.id === 'bot')) return true;
  return champ.id !== 'bot' || isDraw(s.ranking);
}

describe('mọi đường thua đều có hiệu ứng thua', () => {
  it('thua BOT (bàn sạch, bot dẫn đầu) KHÔNG được ăn mừng', () => {
    const s = tomTat('won', [p('bot', 900), p('p1', 300)]);
    expect(nguoiChoiThang(s), 'lỗi người chơi báo: thua máy mà vẫn bắn pháo hoa').toBe(false);
  });

  it('thắng bot thì vẫn ăn mừng bình thường', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p1', 900), p('bot', 300)]))).toBe(true);
  });

  it('HOÀ với bot là ăn mừng, không phải thua', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p1', 500), p('bot', 500)]))).toBe(true);
  });

  it('nhiều người CÙNG MÁY: người thắng đang ngồi đây nên vẫn mừng', () => {
    expect(nguoiChoiThang(tomTat('won', [p('p2', 900), p('p1', 300)]))).toBe(true);
  });

  for (const reason of ['timeout', 'no-lives', 'no-moves'] as const) {
    it(`thua vì ${reason} thì không ăn mừng`, () => {
      const s = tomTat('lost', [p('p1', 100)]);
      (s as { reason: string }).reason = reason;
      expect(nguoiChoiThang(s)).toBe(false);
    });
  }

  it('engine thật: hết giờ ra status lost', () => {
    const g = new MemoryGame({
      cols: 2, rows: 2, pairs: 2, symbols: ['a', 'b'], seed: 7, timeLimit: 5,
      players: [{ id: 'p1', name: 'A' }]
    } as never);
    g.start(0);
    const ev = g.tick(6000);
    const end = ev.find((e) => e.type === 'end');
    expect(end && (end as { summary: Summary }).summary.status).toBe('lost');
  });
});

describe('mã nguồn giữ đúng luật', () => {
  const doc = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

  it('App.vue chọn hiệu ứng theo `loaiKetCuc`, KHÔNG theo status trần', () => {
    const src = doc('src/App.vue');
    expect(src, 'ván offline thua phải có hình riêng').toContain('<KetCucFx');
    expect(src).toContain('session.loaiKetCuc.value');
    expect(src, "status === 'won' không phải là 'tôi thắng'")
      .not.toMatch(/v-if="session\.summary\.value\?\.status === 'won'/);
  });

  it('useGameSession nhận ra bot qua BẢNG XẾP HẠNG, không qua cờ botLevel', () => {
    const src = doc('src/composables/useGameSession.ts');
    // Cờ `botLevel` tắt được giữa ván; lúc đó ván vẫn có một người tên 'bot'.
    expect(src).toMatch(/ranking\.some\(\(p\) => p\.id === BOT_ID\)/);
    // Hoà phải ra 'hoa', không được rơi vào nhánh thua.
    expect(src).toMatch(/isDraw\(s\.ranking\)\) return 'hoa'/);
  });

  it('online: ba kết cục đi qua MỘT chỗ quyết định', () => {
    const src = doc('src/components/OnlineGame.vue');
    expect(src, 'hoà mà tro rơi thì nhìn như vừa bị hạ')
      .toMatch(/hoa\.value \? 'hoa' : iWon\.value \? 'thang' : 'thua'/);
  });
});

describe('sổ đăng ký hiệu ứng', () => {
  it(`mỗi loại có ít nhất ${TOI_THIEU_MOI_LOAI} hình`, () => {
    for (const loai of ['thang', 'thua', 'hoa'] as const) {
      expect(hieuUngCua(loai).length, `loại ${loai} quá ít hình, chơi vài ván là thấy lặp`)
        .toBeGreaterThanOrEqual(TOI_THIEU_MOI_LOAI);
    }
  });

  it('id không trùng nhau', () => {
    const ids = HIEU_UNG.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi lớp mà sổ khai đều có CSS', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/ketcuc-fx.css'), 'utf8');
    const thieu: string[] = [];
    for (const h of HIEU_UNG) {
      const nhin = (ds: { lop: string; con?: { lop: string }[] }[]): void => {
        for (const l of ds) {
          for (const cl of l.lop.split(' ')) if (!css.includes(`.${cl}`)) thieu.push(`${h.id}: ${cl}`);
          if (l.con) nhin(l.con);
        }
      };
      nhin(h.dung(7) as { lop: string; con?: { lop: string }[] }[]);
    }
    expect(thieu, 'lớp không có CSS = hiệu ứng vô hình').toEqual([]);
  });

  it('lớp hiệu ứng nằm DƯỚI hộp kết quả', () => {
    // Lỗi đã xảy ra thật (có ảnh): lớp xám + vết rạn phủ lên cả bảng tỉ số.
    const css = readFileSync(resolve(process.cwd(), 'src/styles/ketcuc-fx.css'), 'utf8');
    const dialog = readFileSync(resolve(process.cwd(), 'src/components/ResultDialog.vue'), 'utf8');
    const zFx = Number(/\.ketcuc-fx \{[\s\S]*?z-index: (\d+)/.exec(css)![1]);
    const zHop = Number(/position: fixed; inset: 0; z-index: (\d+)/.exec(dialog)![1]);
    expect(zFx, 'hiệu ứng đè lên bảng tỉ số thì không ai đọc được kết quả')
      .toBeLessThan(zHop);
  });

  it('bốc theo SEED nên tất định — F5 không đổi hình', () => {
    for (const loai of ['thang', 'thua', 'hoa'] as const) {
      for (let seed = 0; seed < 200; seed++) {
        expect(bocHieuUng(loai, seed).id).toBe(bocHieuUng(loai, seed).id);
        expect(bocHieuUng(loai, seed).loai).toBe(loai);
      }
    }
  });

  it('mọi hình đều bốc được ra — không có hình chết', () => {
    for (const loai of ['thang', 'thua', 'hoa'] as const) {
      const thay = new Set(Array.from({ length: 4000 }, (_, s) => bocHieuUng(loai, s).id));
      expect(thay.size, `loại ${loai} có hình không bao giờ xuất hiện`)
        .toBe(hieuUngCua(loai).length);
    }
  });
});
